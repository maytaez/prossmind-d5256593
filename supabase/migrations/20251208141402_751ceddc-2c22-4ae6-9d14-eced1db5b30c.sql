-- Drop the existing SECURITY DEFINER view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.unique_visitors_by_country;

-- Recreate the view with SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.unique_visitors_by_country
WITH (security_invoker = true)
AS
SELECT 
    country,
    count(DISTINCT fingerprint) AS unique_visitors,
    count(*) AS total_visits,
    min(created_at) AS first_visit,
    max(created_at) AS last_visit
FROM visitor_tracking
WHERE fingerprint IS NOT NULL
GROUP BY country
ORDER BY count(DISTINCT fingerprint) DESC;