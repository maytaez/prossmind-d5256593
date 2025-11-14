-- Create table for storing vision-to-bpmn job results
CREATE TABLE IF NOT EXISTS public.vision_bpmn_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  image_data TEXT NOT NULL,
  bpmn_xml TEXT,
  error_message TEXT,
  complexity_score INTEGER,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.vision_bpmn_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view their own vision BPMN jobs"
ON public.vision_bpmn_jobs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create their own vision BPMN jobs"
ON public.vision_bpmn_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (for status updates)
CREATE POLICY "Users can update their own vision BPMN jobs"
ON public.vision_bpmn_jobs
FOR UPDATE
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_vision_bpmn_jobs_updated_at
BEFORE UPDATE ON public.vision_bpmn_jobs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.vision_bpmn_jobs;