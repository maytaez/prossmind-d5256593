-- Add prompt-based generation support to vision_bpmn_jobs table
-- This allows the table to handle both vision-based (image) and prompt-based (text) BPMN generation

-- Add new columns for prompt-based generation
ALTER TABLE vision_bpmn_jobs 
  ADD COLUMN IF NOT EXISTS prompt TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'vision' 
    CHECK (source_type IN ('vision', 'prompt')),
  ADD COLUMN IF NOT EXISTS diagram_type TEXT DEFAULT 'bpmn' 
    CHECK (diagram_type IN ('bpmn', 'pid'));

-- Make image_data nullable since prompt-based jobs won't have images
ALTER TABLE vision_bpmn_jobs 
  ALTER COLUMN image_data DROP NOT NULL;

-- Add index for efficient querying of prompt-based jobs
CREATE INDEX IF NOT EXISTS idx_vision_jobs_source_type 
  ON vision_bpmn_jobs(source_type, status, created_at DESC);

-- Add comment to document the change
COMMENT ON TABLE vision_bpmn_jobs IS 'Stores both vision-based (image-to-BPMN) and prompt-based (text-to-BPMN) generation jobs';
COMMENT ON COLUMN vision_bpmn_jobs.source_type IS 'Type of generation: vision (image-based) or prompt (text-based)';
COMMENT ON COLUMN vision_bpmn_jobs.prompt IS 'Text prompt for prompt-based BPMN generation (null for vision-based)';
COMMENT ON COLUMN vision_bpmn_jobs.image_data IS 'Base64 image data for vision-based generation (null for prompt-based)';
COMMENT ON COLUMN vision_bpmn_jobs.diagram_type IS 'Type of diagram to generate: bpmn or pid';