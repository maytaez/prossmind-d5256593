-- Add unique visitor tracking columns to visitor_tracking table
ALTER TABLE public.visitor_tracking 
ADD COLUMN IF NOT EXISTS fingerprint TEXT,
ADD COLUMN IF NOT EXISTS is_unique_visitor BOOLEAN DEFAULT true;

-- Create index for faster fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_fingerprint ON public.visitor_tracking(fingerprint);
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_country ON public.visitor_tracking(country);

-- Create a unique visitors view for analytics
CREATE OR REPLACE VIEW public.unique_visitors_by_country AS
SELECT 
  country,
  COUNT(DISTINCT fingerprint) as unique_visitors,
  COUNT(*) as total_visits,
  MIN(created_at) as first_visit,
  MAX(created_at) as last_visit
FROM public.visitor_tracking
WHERE fingerprint IS NOT NULL
GROUP BY country
ORDER BY unique_visitors DESC;