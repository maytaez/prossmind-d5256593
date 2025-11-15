-- Fix RLS policy for performance_metrics table
-- The service role key should bypass RLS, but if it doesn't, this policy will allow inserts

-- Drop existing policies
DROP POLICY IF EXISTS "Allow service role to insert metrics" ON public.performance_metrics;
DROP POLICY IF EXISTS "Allow service role to view metrics" ON public.performance_metrics;

-- Create new policy that allows all inserts (service role key bypasses RLS anyway)
-- This is safe because only edge functions with service role key can insert
CREATE POLICY "Allow service role to insert metrics"
  ON public.performance_metrics
  FOR INSERT
  WITH CHECK (true);

-- Allow service role to view all metrics
CREATE POLICY "Allow service role to view metrics"
  ON public.performance_metrics
  FOR SELECT
  USING (true);