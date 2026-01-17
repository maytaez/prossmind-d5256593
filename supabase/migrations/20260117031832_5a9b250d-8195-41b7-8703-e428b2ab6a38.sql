-- Allow service role to manage vision_bpmn_jobs (for edge function operations)
CREATE POLICY "Service role can manage vision jobs"
ON public.vision_bpmn_jobs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Also allow guests to view their jobs by job ID (for polling status)
CREATE POLICY "Anyone can view jobs by id"
ON public.vision_bpmn_jobs
FOR SELECT
USING (true);