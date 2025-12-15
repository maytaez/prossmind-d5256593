-- Fix security warnings for dashboard views and function

-- Recreate views with SECURITY INVOKER (default, but explicit)
DROP VIEW IF EXISTS dashboard_daily_stats;
DROP VIEW IF EXISTS dashboard_cost_analysis;
DROP VIEW IF EXISTS dashboard_cache_performance;
DROP VIEW IF EXISTS dashboard_error_summary;

-- Recreate daily stats view with explicit security invoker
CREATE VIEW dashboard_daily_stats 
WITH (security_invoker = true) AS
SELECT 
  DATE(request_timestamp) as date,
  diagram_type,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status = 'success') as successful_requests,
  COUNT(*) FILTER (WHERE status = 'error') as failed_requests,
  COUNT(*) FILTER (WHERE status = 'cached') as cached_requests,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  ROUND(AVG(generation_duration_ms)::numeric, 2) as avg_duration_ms,
  ROUND(AVG(input_tokens)::numeric, 2) as avg_input_tokens,
  ROUND(AVG(output_tokens)::numeric, 2) as avg_output_tokens,
  ROUND(SUM(estimated_cost_usd)::numeric, 6) as total_cost_usd,
  COUNT(DISTINCT user_id) as active_users
FROM bpmn_generation_logs
GROUP BY DATE(request_timestamp), diagram_type;

-- Recreate cost analysis view with explicit security invoker
CREATE VIEW dashboard_cost_analysis 
WITH (security_invoker = true) AS
SELECT 
  user_id,
  diagram_type,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  ROUND(SUM(estimated_cost_usd)::numeric, 6) as total_cost,
  ROUND(SUM(estimated_cost_usd) FILTER (WHERE cache_hit = false)::numeric, 6) as cost_without_cache,
  ROUND(SUM(estimated_cost_usd) FILTER (WHERE cache_hit = false)::numeric - SUM(estimated_cost_usd)::numeric, 6) as cost_saved_by_cache,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens
FROM bpmn_generation_logs
WHERE request_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY user_id, diagram_type;

-- Recreate cache performance view with explicit security invoker
CREATE VIEW dashboard_cache_performance 
WITH (security_invoker = true) AS
SELECT 
  DATE(request_timestamp) as date,
  diagram_type,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  COUNT(*) FILTER (WHERE cache_hit = false) as cache_misses,
  ROUND((COUNT(*) FILTER (WHERE cache_hit = true)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as cache_hit_rate_percent,
  ROUND(AVG(cache_similarity_score) FILTER (WHERE cache_hit = true)::numeric, 4) as avg_similarity_score
FROM bpmn_generation_logs
WHERE request_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE(request_timestamp), diagram_type;

-- Recreate error summary view with explicit security invoker
CREATE VIEW dashboard_error_summary 
WITH (security_invoker = true) AS
SELECT 
  error_message,
  diagram_type,
  source_function,
  COUNT(*) as error_count,
  MAX(request_timestamp) as last_occurred,
  ARRAY_AGG(DISTINCT user_id) as affected_users
FROM bpmn_generation_logs
WHERE status = 'error'
  AND request_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY error_message, diagram_type, source_function
ORDER BY error_count DESC, last_occurred DESC
LIMIT 100;

-- Fix cleanup function with proper search_path
CREATE OR REPLACE FUNCTION public.cleanup_old_dashboard_logs(days_old INT DEFAULT 30)
RETURNS TABLE (deleted_count BIGINT) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH deleted AS (
    DELETE FROM bpmn_generation_logs
    WHERE request_timestamp < NOW() - (days_old || ' days')::INTERVAL
    RETURNING *
  )
  SELECT COUNT(*)::BIGINT FROM deleted INTO deleted_count;
  
  RAISE NOTICE 'Deleted % old dashboard log entries', deleted_count;
  RETURN NEXT;
END;
$$;