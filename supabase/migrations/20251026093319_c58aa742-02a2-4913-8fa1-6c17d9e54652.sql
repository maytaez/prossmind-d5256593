-- Create table for storing screen recording to BPMN job results
CREATE TABLE IF NOT EXISTS public.screen_recording_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  recording_metadata JSONB,
  extracted_frames JSONB,
  bpmn_xml TEXT,
  error_message TEXT,
  complexity_score INTEGER,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.screen_recording_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own screen recording jobs"
ON public.screen_recording_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create their own screen recording jobs"
ON public.screen_recording_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (for status updates)
CREATE POLICY "Users can update their own screen recording jobs"
ON public.screen_recording_jobs
FOR UPDATE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_screen_recording_jobs_updated_at
BEFORE UPDATE ON public.screen_recording_jobs
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- Enable realtime for job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.screen_recording_jobs;