CREATE TABLE IF NOT EXISTS bpmn_events (
  id SERIAL PRIMARY KEY,
  case_id VARCHAR(128) NOT NULL,
  activity_id VARCHAR(128) NOT NULL,
  activity_name VARCHAR(256),
  event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('start', 'end')),
  ts TIMESTAMP NOT NULL,
  resource VARCHAR(256),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bpmn_events_unique
  ON bpmn_events (case_id, activity_id, event_type, ts);

CREATE INDEX IF NOT EXISTS idx_bpmn_events_activity
  ON bpmn_events (activity_name, ts DESC);

