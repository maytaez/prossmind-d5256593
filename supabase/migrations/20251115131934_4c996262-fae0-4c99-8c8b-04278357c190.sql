-- Add image_embedding column to vision_analysis_cache for semantic similarity search
ALTER TABLE public.vision_analysis_cache 
ADD COLUMN IF NOT EXISTS image_embedding vector(1536);

-- Create index for vector similarity search on image embeddings
CREATE INDEX IF NOT EXISTS vision_analysis_cache_image_embedding_idx 
ON public.vision_analysis_cache 
USING ivfflat (image_embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function to match similar images using embeddings
CREATE OR REPLACE FUNCTION public.match_similar_images(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.80,
  match_count int DEFAULT 3,
  diagram_type_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  image_hash text,
  process_description text,
  bpmn_xml text,
  similarity float,
  diagram_type text,
  hit_count int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vision_analysis_cache.id,
    vision_analysis_cache.image_hash,
    vision_analysis_cache.process_description,
    vision_analysis_cache.bpmn_xml,
    1 - (vision_analysis_cache.image_embedding <=> query_embedding) as similarity,
    vision_analysis_cache.diagram_type,
    vision_analysis_cache.hit_count
  FROM vision_analysis_cache
  WHERE 
    vision_analysis_cache.image_embedding IS NOT NULL
    AND (diagram_type_filter IS NULL OR vision_analysis_cache.diagram_type = diagram_type_filter)
    AND 1 - (vision_analysis_cache.image_embedding <=> query_embedding) > match_threshold
  ORDER BY vision_analysis_cache.image_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;