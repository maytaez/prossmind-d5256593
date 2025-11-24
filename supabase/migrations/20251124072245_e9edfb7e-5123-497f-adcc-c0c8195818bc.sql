-- Create visitor_tracking table
CREATE TABLE public.visitor_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT,
  page_path TEXT NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  session_id TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX idx_visitor_tracking_created_at ON public.visitor_tracking(created_at DESC);
CREATE INDEX idx_visitor_tracking_page_path ON public.visitor_tracking(page_path);
CREATE INDEX idx_visitor_tracking_session_id ON public.visitor_tracking(session_id);

-- Enable Row Level Security
ALTER TABLE public.visitor_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous visitors to insert their own tracking data
CREATE POLICY "Allow public insert for visitor tracking"
ON public.visitor_tracking
FOR INSERT
TO anon
WITH CHECK (true);

-- Policy: Allow authenticated users to insert tracking data
CREATE POLICY "Allow authenticated insert for visitor tracking"
ON public.visitor_tracking
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Only admins can view tracking data
CREATE POLICY "Admins can view all visitor tracking"
ON public.visitor_tracking
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Policy: No updates or deletes allowed (tracking data should be immutable)
-- No policies for UPDATE or DELETE means no one can modify/delete records