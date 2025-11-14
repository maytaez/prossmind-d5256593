-- Create table for BPMN generations to track and improve over time
CREATE TABLE IF NOT EXISTS public.bpmn_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL CHECK (input_type IN ('text', 'image', 'log')),
  input_description TEXT,
  image_analysis TEXT,
  generated_bpmn_xml TEXT NOT NULL,
  alternative_models JSONB DEFAULT '[]'::jsonb,
  user_feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  was_helpful BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bpmn_generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own generations
CREATE POLICY "Users can view own generations"
  ON public.bpmn_generations
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert their own generations
CREATE POLICY "Users can insert own generations"
  ON public.bpmn_generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own generations (for feedback)
CREATE POLICY "Users can update own generations"
  ON public.bpmn_generations
  FOR UPDATE
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all generations for analysis
CREATE POLICY "Admins can view all generations"
  ON public.bpmn_generations
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_bpmn_generations_user_id ON public.bpmn_generations(user_id);
CREATE INDEX idx_bpmn_generations_rating ON public.bpmn_generations(rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_bpmn_generations_created_at ON public.bpmn_generations(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_bpmn_generations_updated_at
  BEFORE UPDATE ON public.bpmn_generations
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();