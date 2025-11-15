-- Enable pgvector extension for semantic similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create function for matching similar prompts using cosine similarity
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

