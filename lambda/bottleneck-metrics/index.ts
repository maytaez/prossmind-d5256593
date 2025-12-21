import { serve } from '../shared/aws-shim';

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventRecord = {
  case_id: string;
  activity_id: string | null;
  activity_name: string | null;
  event_type: "start" | "end";
  ts: string;
  resource: string | null;
};

type Metric = {
  activityId: string;
  activityName: string;
  avgDurationSeconds: number;
  p95Seconds: number;
  maxSeconds: number;
  cases: number;
  samples: number;
  severity: "normal" | "watch" | "warning" | "critical";
  heat: number;
};

const thresholds = {
  watch: 60, // seconds
  warning: 150,
  critical: 300,
};

const formatSeverity = (avgSeconds: number): Metric["severity"] => {
  if (avgSeconds >= thresholds.critical) return "critical";
  if (avgSeconds >= thresholds.warning) return "warning";
  if (avgSeconds >= thresholds.watch) return "watch";
  return "normal";
};

const percentile = (values: number[], p: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)));
  return sorted[idx];
};

export const handler = serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.body ? await req.json() : {};
    const {
      activityIds,
      activityNames,
      timeframeHours = 168, // last 7 days default
      limit = 10,
    } = body || {};

    const supabaseUrl = process.env["SUPABASE_URL"];
    const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from("bpmn_events")
      .select("case_id, activity_id, activity_name, event_type, ts, resource")
      .order("ts", { ascending: true });

    if (Array.isArray(activityIds) && activityIds.length > 0) {
      query = query.in("activity_id", activityIds);
    } else if (Array.isArray(activityNames) && activityNames.length > 0) {
      query = query.in("activity_name", activityNames);
    }

    if (typeof timeframeHours === "number" && timeframeHours > 0) {
      const since = new Date(Date.now() - timeframeHours * 60 * 60 * 1000).toISOString();
      query = query.gte("ts", since);
    }

    const { data: events, error } = await query.limit(100000) as { data: EventRecord[] | null; error: Error | null };

    if (error) {
      console.error("Failed to fetch bpmn_events:", error);
      throw new Error(error.message || "Failed to load BPMN events");
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          activityMetrics: [],
          bottlenecks: [],
          warnings: ["No BPMN monitoring events found for the requested window."],
          eventCount: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const warnings = new Set<string>();
    const startStacks = new Map<
      string,
      Array<{ ts: number; activityName: string; activityId: string }>
    >();
    const stats = new Map<
      string,
      {
        activityId: string;
        activityName: string;
        durations: number[];
        total: number;
        cases: Set<string>;
      }
    >();

    const getKey = (caseId: string, activityId: string) => `${caseId}::${activityId}`;

    for (const event of events) {
      const activityId = event.activity_id || event.activity_name || "unknown";
      const activityName = event.activity_name || activityId;
      const key = getKey(event.case_id, activityId);
      if (event.event_type === "start") {
        const stack = startStacks.get(key) ?? [];
        stack.push({
          ts: new Date(event.ts).getTime(),
          activityName,
          activityId,
        });
        startStacks.set(key, stack);
      } else if (event.event_type === "end") {
        const stack = startStacks.get(key);
        if (!stack || stack.length === 0) {
          warnings.add(
            `End event without matching start for activity "${activityName}" (case ${event.case_id}).`,
          );
          continue;
        }
        const start = stack.shift()!;
        const durationSeconds = (new Date(event.ts).getTime() - start.ts) / 1000;
        if (durationSeconds <= 0) {
          warnings.add(
            `Non-positive duration detected for activity "${activityName}" (case ${event.case_id}).`,
          );
          continue;
        }
        const stat = stats.get(activityId) ?? {
          activityId,
          activityName,
          durations: [] as number[],
          total: 0,
          cases: new Set<string>(),
        };
        stat.durations.push(durationSeconds);
        stat.total += durationSeconds;
        stat.cases.add(event.case_id);
        stats.set(activityId, stat);
      }
    }

    // Any remaining open starts -> warning
    startStacks.forEach((stack) => {
      if (stack.length > 0) {
        const pending = stack[0];
        warnings.add(`Activity "${pending.activityName}" has ${stack.length} start event(s) without matching end events.`);
      }
    });

    const activityMetrics: Metric[] = Array.from(stats.values()).map((stat) => {
      const avg = stat.total / stat.durations.length;
      const p95 = percentile(stat.durations, 0.95);
      const max = Math.max(...stat.durations);
      const severity = formatSeverity(avg);
      const heat = Math.min(avg / thresholds.critical, 1);
      return {
        activityId: stat.activityId,
        activityName: stat.activityName,
        avgDurationSeconds: avg,
        p95Seconds: p95,
        maxSeconds: max,
        cases: stat.cases.size,
        samples: stat.durations.length,
        severity,
        heat,
      };
    });

    const bottlenecks = activityMetrics
      .filter((metric) => metric.samples > 0)
      .sort((a, b) => b.avgDurationSeconds - a.avgDurationSeconds)
      .slice(0, limit);

    return new Response(
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        timeframeHours,
        eventCount: events.length,
        activityCount: activityMetrics.length,
        activityMetrics,
        bottlenecks,
        warnings: Array.from(warnings),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in bottleneck-metrics function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

