-- Add usage tracking for AI generations
-- Tracks token usage, costs, and provider for each generation

CREATE TABLE IF NOT EXISTS public.ai_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_id UUID REFERENCES public.user_api_keys(id) ON DELETE SET NULL, -- null if using Publo's key
  provider TEXT NOT NULL CHECK (provider IN ('groq', 'openai', 'anthropic', 'google')),
  model TEXT NOT NULL,
  format TEXT, -- screenplay, novel, etc.
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  input_cost DECIMAL(10, 6) NOT NULL DEFAULT 0, -- Cost in USD
  output_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.ai_usage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own usage
CREATE POLICY "Users can view their own usage history"
  ON public.ai_usage_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can insert (for API routes)
CREATE POLICY "Service role can insert usage"
  ON public.ai_usage_history
  FOR INSERT
  WITH CHECK (true);

-- Indexes for fast queries
CREATE INDEX idx_ai_usage_user_date 
  ON public.ai_usage_history(user_id, created_at DESC);

CREATE INDEX idx_ai_usage_key 
  ON public.ai_usage_history(key_id, created_at DESC);

CREATE INDEX idx_ai_usage_provider 
  ON public.ai_usage_history(user_id, provider, created_at DESC);

-- Trigger to automatically update user_api_keys.usage_count
CREATE OR REPLACE FUNCTION public.increment_key_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key_id IS NOT NULL THEN
    UPDATE public.user_api_keys
    SET 
      usage_count = usage_count + 1,
      last_used_at = NEW.created_at
    WHERE id = NEW.key_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_key_usage
  AFTER INSERT ON public.ai_usage_history
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_key_usage();

-- Comments for documentation
COMMENT ON TABLE public.ai_usage_history IS 'Tracks AI generation usage, tokens, and costs per user/key';
COMMENT ON COLUMN public.ai_usage_history.key_id IS 'Reference to user API key; NULL if using Publo default key';
COMMENT ON COLUMN public.ai_usage_history.input_cost IS 'Cost in USD for prompt tokens';
COMMENT ON COLUMN public.ai_usage_history.output_cost IS 'Cost in USD for completion tokens';
COMMENT ON COLUMN public.ai_usage_history.total_cost IS 'Total cost in USD (input + output)';

