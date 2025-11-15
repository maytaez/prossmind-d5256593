-- Function to clean old cache entries
-- Removes entries older than specified days with low hit counts
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

