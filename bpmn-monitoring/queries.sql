-- Activity durations
WITH start_events AS (
  SELECT case_id, activity_id, ts AS start_ts
  FROM bpmn_events
  WHERE event_type = 'start'
),
end_events AS (
  SELECT case_id, activity_id, ts AS end_ts
  FROM bpmn_events
  WHERE event_type = 'end'
)
SELECT
  s.case_id,
  s.activity_id,
  EXTRACT(EPOCH FROM (e.end_ts - s.start_ts)) AS duration_seconds
FROM start_events s
JOIN end_events e USING (case_id, activity_id)
WHERE e.end_ts > s.start_ts;

WITH start_events AS (
  SELECT case_id, activity_id, ts AS start_ts
  FROM bpmn_events
  WHERE event_type = 'start'
),
end_events AS (
  SELECT case_id, activity_id, ts AS end_ts
  FROM bpmn_events
  WHERE event_type = 'end'
),
activity_durations AS (
  SELECT
    s.case_id,
    s.activity_id,
    COALESCE(a.activity_name, s.activity_id) AS activity_name,
    EXTRACT(EPOCH FROM (e.end_ts - s.start_ts)) AS duration_seconds
  FROM start_events s
  JOIN end_events e USING (case_id, activity_id)
  LEFT JOIN bpmn_events a
    ON a.case_id = s.case_id
   AND a.activity_id = s.activity_id
   AND a.event_type = 'start'
  WHERE e.end_ts > s.start_ts
)
SELECT
  activity_name,
  AVG(duration_seconds) AS avg_service_time,
  COUNT(*) AS executions
FROM activity_durations
GROUP BY activity_name
ORDER BY avg_service_time DESC;

WITH start_events AS (
  SELECT case_id, activity_id, ts AS start_ts
  FROM bpmn_events
  WHERE event_type = 'start'
),
end_events AS (
  SELECT case_id, activity_id, ts AS end_ts
  FROM bpmn_events
  WHERE event_type = 'end'
),
activity_durations AS (
  SELECT
    s.case_id,
    s.activity_id,
    COALESCE(a.activity_name, s.activity_id) AS activity_name,
    EXTRACT(EPOCH FROM (e.end_ts - s.start_ts)) AS duration_seconds
  FROM start_events s
  JOIN end_events e USING (case_id, activity_id)
  LEFT JOIN bpmn_events a
    ON a.case_id = s.case_id
   AND a.activity_id = s.activity_id
   AND a.event_type = 'start'
  WHERE e.end_ts > s.start_ts
)
SELECT
  activity_name,
  AVG(duration_seconds) AS avg_service,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_seconds) AS p95,
  COUNT(*) AS cases
FROM activity_durations
GROUP BY activity_name
ORDER BY avg_service DESC
LIMIT 10;

