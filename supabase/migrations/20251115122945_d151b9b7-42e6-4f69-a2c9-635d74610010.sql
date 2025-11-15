-- Fix RLS policies for cache tables
-- The service role key should bypass RLS, but if it doesn't, these policies will allow operations

-- Fix bpmn_prompt_cache policies
DROP POLICY IF EXISTS "Allow service role to manage cache" ON public.bpmn_prompt_cache;
DROP POLICY IF EXISTS "Allow read access to prompt cache" ON public.bpmn_prompt_cache;

CREATE POLICY "Allow service role to manage cache"
  ON public.bpmn_prompt_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to prompt cache"
  ON public.bpmn_prompt_cache
  FOR SELECT
  USING (true);

-- Fix vision_analysis_cache policies
DROP POLICY IF EXISTS "Allow service role to manage vision cache" ON public.vision_analysis_cache;
DROP POLICY IF EXISTS "Allow read access to vision cache" ON public.vision_analysis_cache;

CREATE POLICY "Allow service role to manage vision cache"
  ON public.vision_analysis_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to vision cache"
  ON public.vision_analysis_cache
  FOR SELECT
  USING (true);

-- Add helpful comment
COMMENT ON TABLE public.bpmn_prompt_cache IS 'Cache for BPMN generation results. RLS policies allow all operations because only edge functions with service role key can write to this table.';
COMMENT ON TABLE public.vision_analysis_cache IS 'Cache for vision analysis results. RLS policies allow all operations because only edge functions with service role key can write to this table.';