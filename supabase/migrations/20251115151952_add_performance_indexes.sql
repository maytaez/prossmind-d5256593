-- Add composite indexes for improved query performance

-- Index for vision_bpmn_jobs queries
CREATE INDEX IF NOT EXISTS idx_vision_jobs_user_status_created 
ON public.vision_bpmn_jobs(user_id, status, created_at DESC);

-- Index for bpmn_generations queries
CREATE INDEX IF NOT EXISTS idx_bpmn_generations_user_input_created 
ON public.bpmn_generations(user_id, input_description, created_at DESC);

-- Index for screen_recording_jobs queries
CREATE INDEX IF NOT EXISTS idx_screen_recording_jobs_user_status_created 
ON public.screen_recording_jobs(user_id, status, created_at DESC);

-- Additional index for bpmn_generations by input_type
CREATE INDEX IF NOT EXISTS idx_bpmn_generations_input_type 
ON public.bpmn_generations(input_type, created_at DESC);




