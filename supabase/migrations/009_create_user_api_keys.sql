-- Add user_api_keys table for BYOAPI (Bring Your Own API) feature
-- This allows users to connect their own API keys from various LLM providers

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('groq', 'openai', 'anthropic', 'google')),
  nickname TEXT, -- Optional friendly name like "My Personal Key" or "Work OpenAI"
  encrypted_key TEXT NOT NULL, -- AES-256-GCM encrypted API key
  key_hash TEXT NOT NULL, -- SHA-256 hash for deduplication without decryption
  is_active BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMP WITH TIME ZONE,
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid', 'expired')),
  models_cache JSONB, -- Cache of available models from this key's provider
  models_cached_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate keys for same user/provider combination
  UNIQUE(user_id, provider, key_hash)
);

-- Enable Row Level Security
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see and manage their own API keys
CREATE POLICY "Users can manage their own API keys"
  ON public.user_api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups by user and provider
CREATE INDEX idx_user_api_keys_user_provider 
  ON public.user_api_keys(user_id, provider, is_active);

-- Index for finding active keys
CREATE INDEX idx_user_api_keys_active 
  ON public.user_api_keys(user_id, is_active) 
  WHERE is_active = true;

-- Trigger to automatically update updated_at timestamp
CREATE TRIGGER update_user_api_keys_updated_at
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.user_api_keys IS 'Stores encrypted API keys from various LLM providers for user-owned model access';
COMMENT ON COLUMN public.user_api_keys.encrypted_key IS 'API key encrypted with AES-256-GCM, never sent to client';
COMMENT ON COLUMN public.user_api_keys.key_hash IS 'SHA-256 hash of the key for deduplication checks';
COMMENT ON COLUMN public.user_api_keys.models_cache IS 'Cached list of available models to reduce API calls';
COMMENT ON COLUMN public.user_api_keys.usage_count IS 'Number of times this key has been used for generation';

