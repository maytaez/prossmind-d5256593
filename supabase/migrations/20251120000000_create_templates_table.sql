-- Create templates table for storing BPMN and P&ID diagram templates
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('Business', 'E-Commerce', 'Finance', 'IT', 'Manufacturing', 'Utilities')),
  diagram_type TEXT NOT NULL CHECK (diagram_type IN ('bpmn', 'pid')),
  bpmn_xml TEXT NOT NULL,
  icon_name TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_diagram_type ON public.templates(diagram_type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON public.templates(is_active, diagram_type, category);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON public.templates(created_by);

-- Enable RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- All authenticated users can view active templates
CREATE POLICY "Users can view active templates"
  ON public.templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can insert templates
CREATE POLICY "Admins can insert templates"
  ON public.templates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can update templates
CREATE POLICY "Admins can update templates"
  ON public.templates
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Only admins can delete templates
CREATE POLICY "Admins can delete templates"
  ON public.templates
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create trigger for updated_at timestamp
CREATE TRIGGER set_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();


