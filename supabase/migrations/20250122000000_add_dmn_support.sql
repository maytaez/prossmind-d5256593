-- Add DMN support to projects table
-- Update diagram_type constraint to include 'dmn'
ALTER TABLE public.projects 
  DROP CONSTRAINT IF EXISTS projects_diagram_type_check;

ALTER TABLE public.projects 
  ADD CONSTRAINT projects_diagram_type_check 
  CHECK (diagram_type IN ('bpmn', 'pid', 'dmn'));

-- Create dmn_links table to store BPMN gateway -> DMN decision table relationships
CREATE TABLE IF NOT EXISTS public.dmn_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  bpmn_gateway_id TEXT NOT NULL,
  dmn_decision_id TEXT NOT NULL,
  dmn_project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT dmn_links_unique_link UNIQUE (project_id, bpmn_gateway_id, dmn_project_id, dmn_decision_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_dmn_links_project_id ON public.dmn_links(project_id);
CREATE INDEX IF NOT EXISTS idx_dmn_links_dmn_project_id ON public.dmn_links(dmn_project_id);
CREATE INDEX IF NOT EXISTS idx_dmn_links_gateway_id ON public.dmn_links(bpmn_gateway_id);
CREATE INDEX IF NOT EXISTS idx_dmn_links_decision_id ON public.dmn_links(dmn_decision_id);

-- Enable RLS
ALTER TABLE public.dmn_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dmn_links

-- Users can view links for their own projects
CREATE POLICY "Users can view links for their own projects"
  ON public.dmn_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.project_id 
      AND projects.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.dmn_project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can insert links for their own projects
CREATE POLICY "Users can insert links for their own projects"
  ON public.dmn_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.project_id 
      AND projects.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.dmn_project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update links for their own projects
CREATE POLICY "Users can update links for their own projects"
  ON public.dmn_links
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.project_id 
      AND projects.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.dmn_project_id 
      AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.project_id 
      AND projects.user_id = auth.uid()
    ) AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.dmn_project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Users can delete links for their own projects
CREATE POLICY "Users can delete links for their own projects"
  ON public.dmn_links
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.project_id 
      AND projects.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = dmn_links.dmn_project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at timestamp
CREATE TRIGGER set_dmn_links_updated_at
  BEFORE UPDATE ON public.dmn_links
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();






