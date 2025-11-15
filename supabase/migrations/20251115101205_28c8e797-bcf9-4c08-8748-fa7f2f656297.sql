-- Enable pgvector extension for semantic similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table for caching BPMN/P&ID generation prompts and results
CREATE TABLE IF NOT EXISTS public.bpmn_prompt_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  prompt_embedding vector(1536),
  diagram_type TEXT NOT NULL CHECK (diagram_type IN ('bpmn', 'pid')),
  bpmn_xml TEXT NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_prompt_hash_diagram UNIQUE (prompt_hash, diagram_type)
);

-- Create table for caching vision analysis results
CREATE TABLE IF NOT EXISTS public.vision_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_hash TEXT NOT NULL,
  diagram_type TEXT NOT NULL CHECK (diagram_type IN ('bpmn', 'pid')),
  process_description TEXT NOT NULL,
  bpmn_xml TEXT,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_image_hash_diagram UNIQUE (image_hash, diagram_type)
);

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

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompt_cache_hash ON public.bpmn_prompt_cache(prompt_hash, diagram_type);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_embedding ON public.bpmn_prompt_cache 
USING ivfflat (prompt_embedding vector_cosine_ops)
WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_diagram_type ON public.bpmn_prompt_cache(diagram_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_last_accessed ON public.bpmn_prompt_cache(last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_vision_cache_hash ON public.vision_analysis_cache(image_hash, diagram_type);
CREATE INDEX IF NOT EXISTS idx_vision_cache_diagram_type ON public.vision_analysis_cache(diagram_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_cache_last_accessed ON public.vision_analysis_cache(last_accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_function_name ON public.performance_metrics(function_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_cache_type ON public.performance_metrics(cache_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);

-- Composite indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_vision_jobs_user_status_created ON public.vision_bpmn_jobs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bpmn_generations_user_input_created ON public.bpmn_generations(user_id, input_description, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screen_recording_jobs_user_status_created ON public.screen_recording_jobs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bpmn_generations_input_type ON public.bpmn_generations(input_type, created_at DESC);

-- Enable RLS
ALTER TABLE public.bpmn_prompt_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vision_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for bpmn_prompt_cache
CREATE POLICY "Allow read access to prompt cache"
  ON public.bpmn_prompt_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role to manage cache"
  ON public.bpmn_prompt_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for vision_analysis_cache
CREATE POLICY "Allow read access to vision cache"
  ON public.vision_analysis_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Allow service role to manage vision cache"
  ON public.vision_analysis_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Policies for performance_metrics
CREATE POLICY "Allow service role to insert metrics"
  ON public.performance_metrics
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow service role to view metrics"
  ON public.performance_metrics
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Function for matching similar prompts using cosine similarity
CREATE OR REPLACE FUNCTION match_similar_prompts(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 5,
  diagram_type_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  prompt_text text,
  bpmn_xml text,
  similarity float,
  diagram_type text,
  hit_count integer
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bpmn_prompt_cache.id,
    bpmn_prompt_cache.prompt_text,
    bpmn_prompt_cache.bpmn_xml,
    1 - (bpmn_prompt_cache.prompt_embedding <=> query_embedding) as similarity,
    bpmn_prompt_cache.diagram_type,
    bpmn_prompt_cache.hit_count
  FROM bpmn_prompt_cache
  WHERE 
    bpmn_prompt_cache.prompt_embedding IS NOT NULL
    AND (diagram_type_filter IS NULL OR bpmn_prompt_cache.diagram_type = diagram_type_filter)
    AND 1 - (bpmn_prompt_cache.prompt_embedding <=> query_embedding) > match_threshold
  ORDER BY bpmn_prompt_cache.prompt_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to update hit count and last accessed time for prompt cache
CREATE OR REPLACE FUNCTION update_cache_access(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.bpmn_prompt_cache
  SET 
    hit_count = hit_count + 1,
    last_accessed_at = now()
  WHERE id = cache_id;
END;
$$;

-- Function to update hit count and last accessed time for vision cache
CREATE OR REPLACE FUNCTION update_vision_cache_access(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.vision_analysis_cache
  SET 
    hit_count = hit_count + 1,
    last_accessed_at = now()
  WHERE id = cache_id;
END;
$$;

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION clean_old_cache_entries(
  days_old INTEGER DEFAULT 90,
  min_hit_count INTEGER DEFAULT 2
)
RETURNS TABLE (
  deleted_prompt_cache_count INTEGER,
  deleted_vision_cache_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  prompt_deleted INTEGER;
  vision_deleted INTEGER;
BEGIN
  -- Delete old prompt cache entries
  WITH deleted AS (
    DELETE FROM public.bpmn_prompt_cache
    WHERE 
      created_at < now() - (days_old || ' days')::INTERVAL
      AND hit_count < min_hit_count
    RETURNING id
  )
  SELECT COUNT(*) INTO prompt_deleted FROM deleted;

  -- Delete old vision cache entries
  WITH deleted AS (
    DELETE FROM public.vision_analysis_cache
    WHERE 
      created_at < now() - (days_old || ' days')::INTERVAL
      AND hit_count < min_hit_count
    RETURNING id
  )
  SELECT COUNT(*) INTO vision_deleted FROM deleted;

  RETURN QUERY SELECT prompt_deleted, vision_deleted;
END;
$$;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics()
RETURNS TABLE (
  total_prompt_cache_entries BIGINT,
  total_vision_cache_entries BIGINT,
  total_prompt_cache_hits BIGINT,
  total_vision_cache_hits BIGINT,
  avg_prompt_cache_hits NUMERIC,
  avg_vision_cache_hits NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.bpmn_prompt_cache) as total_prompt_cache_entries,
    (SELECT COUNT(*) FROM public.vision_analysis_cache) as total_vision_cache_entries,
    (SELECT COALESCE(SUM(hit_count), 0) FROM public.bpmn_prompt_cache) as total_prompt_cache_hits,
    (SELECT COALESCE(SUM(hit_count), 0) FROM public.vision_analysis_cache) as total_vision_cache_hits,
    (SELECT COALESCE(AVG(hit_count), 0) FROM public.bpmn_prompt_cache) as avg_prompt_cache_hits,
    (SELECT COALESCE(AVG(hit_count), 0) FROM public.vision_analysis_cache) as avg_vision_cache_hits;
END;
$$;

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