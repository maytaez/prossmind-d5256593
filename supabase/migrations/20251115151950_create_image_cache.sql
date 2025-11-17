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

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_vision_cache_hash ON public.vision_analysis_cache(image_hash, diagram_type);
CREATE INDEX IF NOT EXISTS idx_vision_cache_diagram_type ON public.vision_analysis_cache(diagram_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_cache_last_accessed ON public.vision_analysis_cache(last_accessed_at DESC);

-- Enable RLS
ALTER TABLE public.vision_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read cache
CREATE POLICY "Allow read access to vision cache"
  ON public.vision_analysis_cache
  FOR SELECT
  USING (true);

-- Policy: Allow service role to manage cache
CREATE POLICY "Allow service role to manage vision cache"
  ON public.vision_analysis_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update hit count and last accessed time
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




