-- BPMN Dashboard Migration
-- Creates comprehensive tracking for BPMN generation requests, errors, and analytics

-- Create main tracking table
CREATE TABLE IF NOT EXISTS public.bpmn_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request Information
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_prompt TEXT NOT NULL,
  diagram_type VARCHAR(10) NOT NULL CHECK (diagram_type IN ('bpmn', 'pid')),
  detected_language VARCHAR(10),
  complexity_level VARCHAR(20), -- 'simple', 'moderate', 'complex', 'multi-prompt'
  source_function VARCHAR(50) NOT NULL, -- 'generate-bpmn', 'generate-bpmn-combined', 'process-bpmn-job'
  
  -- Result Information
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'partial', 'cached')),
  result_xml TEXT,
  error_message TEXT,
  error_stack TEXT,
  
  -- Performance Metrics
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generation_duration_ms INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE,
  cache_similarity_score DECIMAL(5,4),
  cached_from_id UUID REFERENCES bpmn_prompt_cache(id),
  
  -- Token & Cost Tracking
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_usd DECIMAL(10,6),
  
  -- Multi-diagram Tracking
  is_multi_diagram BOOLEAN DEFAULT FALSE,
  sub_prompt_count INTEGER,
  parent_request_id UUID REFERENCES bpmn_generation_logs(id) ON DELETE CASCADE,
  
  -- Additional Metadata
  job_id UUID, -- Link to vision_bpmn_jobs for async jobs
  client_info JSONB,
  additional_metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_gen_logs_user_timestamp 
  ON bpmn_generation_logs(user_id, request_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gen_logs_status 
  ON bpmn_generation_logs(status, request_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gen_logs_cache_hit 
  ON bpmn_generation_logs(cache_hit, request_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gen_logs_parent 
  ON bpmn_generation_logs(parent_request_id) 
  WHERE parent_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gen_logs_diagram_type 
  ON bpmn_generation_logs(diagram_type, request_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gen_logs_source_function 
  ON bpmn_generation_logs(source_function, request_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_gen_logs_job_id 
  ON bpmn_generation_logs(job_id) 
  WHERE job_id IS NOT NULL;

-- Full-text search on prompts
CREATE INDEX IF NOT EXISTS idx_gen_logs_prompt_search 
  ON bpmn_generation_logs USING gin(to_tsvector('english', original_prompt));

-- Enable RLS
ALTER TABLE public.bpmn_generation_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read (for dashboard access)
CREATE POLICY "Allow authenticated users to read logs"
  ON public.bpmn_generation_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Allow service role to insert/update (for edge functions)
CREATE POLICY "Allow service role to manage logs"
  ON public.bpmn_generation_logs
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create view for daily statistics
CREATE OR REPLACE VIEW dashboard_daily_stats AS
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
GROUP BY DATE(request_timestamp), diagram_type
ORDER BY date DESC, diagram_type;

-- Create view for cost analysis
CREATE OR REPLACE VIEW dashboard_cost_analysis AS
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

-- Create view for cache performance
CREATE OR REPLACE VIEW dashboard_cache_performance AS
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
GROUP BY DATE(request_timestamp), diagram_type
ORDER BY date DESC;

-- Create view for error summary
CREATE OR REPLACE VIEW dashboard_error_summary AS
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

-- Create function for automatic cleanup (30-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_dashboard_logs(days_old INT DEFAULT 30)
RETURNS TABLE (deleted_count BIGINT) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE bpmn_generation_logs IS 'Comprehensive tracking for all BPMN generation requests across all edge functions';
COMMENT ON COLUMN bpmn_generation_logs.source_function IS 'Which edge function processed this request: generate-bpmn, generate-bpmn-combined, or process-bpmn-job';
COMMENT ON COLUMN bpmn_generation_logs.complexity_level IS 'Prompt complexity: simple, moderate, complex, or multi-prompt';
COMMENT ON COLUMN bpmn_generation_logs.cache_hit IS 'Whether this request was served from semantic cache';
COMMENT ON COLUMN bpmn_generation_logs.job_id IS 'Link to vision_bpmn_jobs table for async background jobs';
COMMENT ON FUNCTION cleanup_old_dashboard_logs IS 'Deletes dashboard logs older than specified days (default 30). Run manually or via pg_cron.';