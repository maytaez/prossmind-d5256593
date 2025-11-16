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

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompt_cache_hash ON public.bpmn_prompt_cache(prompt_hash, diagram_type);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_embedding ON public.bpmn_prompt_cache 
USING ivfflat (prompt_embedding vector_cosine_ops)
WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_diagram_type ON public.bpmn_prompt_cache(diagram_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_cache_last_accessed ON public.bpmn_prompt_cache(last_accessed_at DESC);

-- Enable RLS
ALTER TABLE public.bpmn_prompt_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read cache (public cache for performance)
CREATE POLICY "Allow read access to prompt cache"
  ON public.bpmn_prompt_cache
  FOR SELECT
  USING (true);

-- Policy: Allow service role to insert/update (for edge functions)
CREATE POLICY "Allow service role to manage cache"
  ON public.bpmn_prompt_cache
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update hit count and last accessed time
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



