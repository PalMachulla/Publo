-- Create model_metadata table for admin-managed model capabilities
CREATE TABLE IF NOT EXISTS public.model_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'groq', 'google', 'deepseek')),
  
  -- Active/Inactive status (admin can disable models)
  is_active BOOLEAN DEFAULT true,
  
  -- Capabilities
  supports_structured_output TEXT CHECK (supports_structured_output IN ('full', 'json-mode', 'none')),
  supports_reasoning BOOLEAN DEFAULT false,
  supports_streaming BOOLEAN DEFAULT true,
  supports_function_calling BOOLEAN DEFAULT false,
  supports_vision BOOLEAN DEFAULT false,
  
  -- Performance metadata
  tier TEXT CHECK (tier IN ('frontier', 'premium', 'standard', 'fast')),
  speed TEXT CHECK (speed IN ('instant', 'fast', 'medium', 'slow')),
  cost TEXT CHECK (cost IN ('cheap', 'moderate', 'expensive')),
  
  -- Technical specs
  context_window INTEGER,
  max_output_tokens INTEGER,
  
  -- Best use cases (JSON array)
  best_for JSONB DEFAULT '[]'::jsonb,
  
  -- Admin notes
  notes TEXT,
  admin_verified BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Unique constraint: one metadata entry per model_id+provider
  UNIQUE(model_id, provider)
);

-- Enable RLS
ALTER TABLE public.model_metadata ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for write operations
CREATE POLICY "Admins can read all model metadata"
  ON public.model_metadata
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert model metadata"
  ON public.model_metadata
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update model metadata"
  ON public.model_metadata
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete model metadata"
  ON public.model_metadata
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Everyone can read active models (for model selection)
CREATE POLICY "Everyone can read active model metadata"
  ON public.model_metadata
  FOR SELECT
  USING (is_active = true);

-- Updated timestamp trigger
CREATE TRIGGER update_model_metadata_updated_at
  BEFORE UPDATE ON public.model_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_model_metadata_lookup ON public.model_metadata(provider, model_id);
CREATE INDEX IF NOT EXISTS idx_model_metadata_active ON public.model_metadata(is_active) WHERE is_active = true;

