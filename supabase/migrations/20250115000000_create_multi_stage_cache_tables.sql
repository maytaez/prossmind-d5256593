-- Multi-Stage BPMN Generation Cache Tables
-- Creates tables for semantic_cache, bpmn_ir_cache, and enterprise_style_profiles

-- Semantic cache table (Stage 1 cache)
CREATE TABLE IF NOT EXISTS public.semantic_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash TEXT NOT NULL UNIQUE,
  semantic_core JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ DEFAULT now()
);

-- BPMN IR cache table (Stage 2 cache)
CREATE TABLE IF NOT EXISTS public.bpmn_ir_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semantic_hash TEXT NOT NULL,
  template_hash TEXT NOT NULL,
  style_hash TEXT NOT NULL,
  bpmn_ir JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_ir_cache UNIQUE (semantic_hash, template_hash, style_hash)
);

-- Enterprise style profiles table
CREATE TABLE IF NOT EXISTS public.enterprise_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id TEXT NOT NULL,
  project_id TEXT,
  style_profile JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_enterprise_profile UNIQUE (enterprise_id, project_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_semantic_cache_hash ON public.semantic_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_expires ON public.semantic_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_bpmn_ir_cache_hashes ON public.bpmn_ir_cache(semantic_hash, template_hash, style_hash);
CREATE INDEX IF NOT EXISTS idx_bpmn_ir_cache_expires ON public.bpmn_ir_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_style_profiles_enterprise ON public.enterprise_style_profiles(enterprise_id, project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.semantic_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bpmn_ir_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_style_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for semantic_cache (service role can access all)
CREATE POLICY "Service role can access semantic_cache" ON public.semantic_cache
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for bpmn_ir_cache (service role can access all)
CREATE POLICY "Service role can access bpmn_ir_cache" ON public.bpmn_ir_cache
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for enterprise_style_profiles (service role can access all)
CREATE POLICY "Service role can access enterprise_style_profiles" ON public.enterprise_style_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- Function to clean up expired cache entries (optional, can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.semantic_cache WHERE expires_at < now();
  DELETE FROM public.bpmn_ir_cache WHERE expires_at < now();
END;
$$;
