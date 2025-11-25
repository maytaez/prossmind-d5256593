import { Pool, PoolClient, PoolConfig } from "pg";

export type BpmnEventType = "start" | "end";

export interface BpmnEvent {
  caseId: string;
  activityId: string;
  activityName: string;
  eventType: BpmnEventType;
  timestamp?: Date | string;
  resource?: string | null;
}

interface LoggerOptions {
  connectionString: string;
  tableName?: string;
  batchSize?: number;
  flushIntervalMs?: number;
  idleTimeoutMs?: number;
}

type FlushTimer = ReturnType<typeof setTimeout> | undefined;

/**
 * BpmnEventLogger batches execution listener events and persists them
 * into the `bpmn_events` table defined in schema.sql. It is idempotent
 * through a unique constraint on (case_id, activity_id, event_type, ts).
 *
 * This class is designed to run inside a Node/TypeScript service that
 * listens for Camunda execution listener callbacks referenced via
 * ${bpmnEventLogger}. Register an instance as a delegate bean and call
 * `log()` for each start/end notification.
 */
export class BpmnEventLogger {
  private pool: Pool;
  private tableName: string;
  private queue: BpmnEvent[] = [];
  private batchSize: number;
  private flushInterval: number;
  private timer: FlushTimer;
  private initializing: Promise<void>;

  constructor(options: LoggerOptions) {
    const {
      connectionString,
      tableName = "bpmn_events",
      batchSize = 25,
      flushIntervalMs = 1000,
      idleTimeoutMs = 5000,
    } = options;

    if (!connectionString) {
      throw new Error("BpmnEventLogger requires a Postgres connection string");
    }

    const poolConfig: PoolConfig = {
      connectionString,
      idleTimeoutMillis: idleTimeoutMs,
    };

    this.pool = new Pool(poolConfig);
    this.tableName = tableName;
    this.batchSize = batchSize;
    this.flushInterval = flushIntervalMs;
    this.initializing = this.ensureSchema();
  }

  /**
   * Ensures the bpmn_events table and supporting indexes exist.
   */
  private async ensureSchema() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.tableName} (
          id SERIAL PRIMARY KEY,
          case_id VARCHAR(128) NOT NULL,
          activity_id VARCHAR(128) NOT NULL,
          activity_name VARCHAR(256),
          event_type VARCHAR(16) NOT NULL,
          ts TIMESTAMP NOT NULL,
          resource VARCHAR(256)
        );
      `);

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_${this.tableName}_uniq
        ON ${this.tableName} (case_id, activity_id, event_type, ts);
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_${this.tableName}_activity
        ON ${this.tableName} (activity_name, ts);
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Appends an event to the in-memory buffer. Flushes automatically when
   * the batch size or flush interval is reached.
   */
  async log(event: BpmnEvent): Promise<void> {
    await this.initializing;

    const normalized: BpmnEvent = {
      ...event,
      caseId: event.caseId,
      activityId: event.activityId,
      activityName: event.activityName,
      eventType: event.eventType,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      resource: event.resource ?? null,
    };

    this.queue.push(normalized);

    if (this.queue.length >= this.batchSize) {
      await this.flush();
      return;
    }

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush().catch((error) =>
          console.error("[BpmnEventLogger] Flush error:", error)
        );
        this.timer = undefined;
      }, this.flushInterval);
      if (typeof this.timer.unref === "function") {
        this.timer.unref();
      }
    }
  }

  /**
   * Forces a flush of the current buffer regardless of size.
   */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer as number);
      this.timer = undefined;
    }

    if (!this.queue.length) {
      return;
    }

    const events = this.queue.splice(0, this.queue.length);
    const client: PoolClient = await this.pool.connect();

    try {
      const values: string[] = [];
      const params: unknown[] = [];

      events.forEach((event, index) => {
        const offset = index * 6;
        values.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
        );
        params.push(
          event.caseId,
          event.activityId,
          event.activityName,
          event.eventType,
          event.timestamp ?? new Date(),
          event.resource ?? null
        );
      });

      const query = `
        INSERT INTO ${this.tableName}
          (case_id, activity_id, activity_name, event_type, ts, resource)
        VALUES ${values.join(", ")}
        ON CONFLICT (case_id, activity_id, event_type, ts) DO NOTHING;
      `;
      await client.query(query, params);
    } finally {
      client.release();
    }
  }

  /**
   * Gracefully shuts down the logger, ensuring pending events are flushed.
   */
  async close(): Promise<void> {
    await this.flush();
    await this.pool.end();
  }
}

