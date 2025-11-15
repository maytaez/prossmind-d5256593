-- Fix search_path for all cache-related functions to prevent security issues

-- Update match_similar_prompts function with search_path
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
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Update update_cache_access function with search_path
CREATE OR REPLACE FUNCTION update_cache_access(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bpmn_prompt_cache
  SET 
    hit_count = hit_count + 1,
    last_accessed_at = now()
  WHERE id = cache_id;
END;
$$;

-- Update update_vision_cache_access function with search_path
CREATE OR REPLACE FUNCTION update_vision_cache_access(cache_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vision_analysis_cache
  SET 
    hit_count = hit_count + 1,
    last_accessed_at = now()
  WHERE id = cache_id;
END;
$$;

-- Update clean_old_cache_entries function with search_path
CREATE OR REPLACE FUNCTION clean_old_cache_entries(
  days_old INTEGER DEFAULT 90,
  min_hit_count INTEGER DEFAULT 2
)
RETURNS TABLE (
  deleted_prompt_cache_count INTEGER,
  deleted_vision_cache_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Update get_cache_statistics function with search_path
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
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Update get_cache_hit_rate_stats function with search_path
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
STABLE
SECURITY DEFINER
SET search_path = public
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