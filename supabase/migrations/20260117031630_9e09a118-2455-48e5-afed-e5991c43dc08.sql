-- Make user_id nullable in vision_bpmn_jobs table for guest uploads
ALTER TABLE public.vision_bpmn_jobs 
ALTER COLUMN user_id DROP NOT NULL;