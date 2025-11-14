-- Phase 1: Fix Critical BPMN Data Exposure

-- Step 1: Delete any existing records with NULL user_id (cleanup)
DELETE FROM public.bpmn_generations WHERE user_id IS NULL;

-- Step 2: Make user_id NOT NULL to prevent future NULL insertions
ALTER TABLE public.bpmn_generations 
ALTER COLUMN user_id SET NOT NULL;

-- Step 3: Drop existing RLS policies that allow NULL user_id bypass
DROP POLICY IF EXISTS "Users can view own generations" ON public.bpmn_generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON public.bpmn_generations;
DROP POLICY IF EXISTS "Users can update own generations" ON public.bpmn_generations;

-- Step 4: Create secure RLS policies without NULL bypass
CREATE POLICY "Users can view own generations" 
ON public.bpmn_generations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" 
ON public.bpmn_generations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations" 
ON public.bpmn_generations 
FOR UPDATE 
USING (auth.uid() = user_id);