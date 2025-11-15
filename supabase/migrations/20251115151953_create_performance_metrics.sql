-- Create table for tracking performance metrics
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  cache_type TEXT CHECK (cache_type IN ('exact_hash', 'semantic', 'none')),
  model_used TEXT,
  prompt_length INTEGER,
  complexity_score INTEGER,
  response_time_ms INTEGER,
  token_usage INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  similarity_score FLOAT,
  error_occurred BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_function_name 
ON public.performance_metrics(function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_cache_type 
ON public.performance_metrics(cache_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at 
ON public.performance_metrics(created_at DESC);

-- Enable RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert metrics
CREATE POLICY "Allow service role to insert metrics"
  ON public.performance_metrics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Allow service role to view all metrics
CREATE POLICY "Allow service role to view metrics"
  ON public.performance_metrics
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Function to get cache hit rate statistics
CREATE OR REPLACE FUNCTION get_cache_hit_rate_stats(
  start_date TIMESTAMPTZ DEFAULT now() - INTERVAL '7 days',
  end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  function_name TEXT,
  total_requests BIGINT,
  exact_hash_hits BIGINT,
  semantic_hits BIGINT,
  cache_misses BIGINT,
  exact_hit_rate NUMERIC,
  semantic_hit_rate NUMERIC,
  total_hit_rate NUMERIC,
  avg_response_time_ms NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.function_name,
    COUNT(*)::BIGINT as total_requests,
    COUNT(*) FILTER (WHERE pm.cache_type = 'exact_hash')::BIGINT as exact_hash_hits,
    COUNT(*) FILTER (WHERE pm.cache_type = 'semantic')::BIGINT as semantic_hits,
    COUNT(*) FILTER (WHERE pm.cache_type = 'none')::BIGINT as cache_misses,
    ROUND(
      (COUNT(*) FILTER (WHERE pm.cache_type = 'exact_hash')::NUMERIC / COUNT(*)::NUMERIC) * 100,
      2
    ) as exact_hit_rate,
    ROUND(
      (COUNT(*) FILTER (WHERE pm.cache_type = 'semantic')::NUMERIC / COUNT(*)::NUMERIC) * 100,
      2
    ) as semantic_hit_rate,
    ROUND(
      ((COUNT(*) FILTER (WHERE pm.cache_type = 'exact_hash') + 
        COUNT(*) FILTER (WHERE pm.cache_type = 'semantic'))::NUMERIC / COUNT(*)::NUMERIC) * 100,
      2
    ) as total_hit_rate,
    ROUND(AVG(pm.response_time_ms), 2) as avg_response_time_ms
  FROM public.performance_metrics pm
  WHERE pm.created_at BETWEEN start_date AND end_date
  GROUP BY pm.function_name
  ORDER BY total_requests DESC;
END;
$$;

