-- Create table for tracking website visitors
CREATE TABLE IF NOT EXISTS public.visitor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  landing_page TEXT NOT NULL,
  country TEXT,
  city TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  language TEXT,
  timezone TEXT,
  cookie_consent BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_created_at ON public.visitor_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_session_id ON public.visitor_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_user_id ON public.visitor_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_visitor_tracking_landing_page ON public.visitor_tracking(landing_page);

-- Enable RLS
ALTER TABLE public.visitor_tracking ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for tracking visitors who haven't logged in)
CREATE POLICY "Allow anonymous visitor tracking"
ON public.visitor_tracking
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Users can view their own tracking data
CREATE POLICY "Users can view own tracking data"
ON public.visitor_tracking
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all tracking data
CREATE POLICY "Admins can view all tracking data"
ON public.visitor_tracking
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_visitor_tracking_updated_at
BEFORE UPDATE ON public.visitor_tracking
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime (optional, for admin dashboards)
ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_tracking;

