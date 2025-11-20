-- Add orchestrator and writer model preferences to user_api_keys table
-- This allows users to:
-- 1. Select preferred orchestrator model per API key
-- 2. Enable specific writer models for task delegation
-- 3. Fall back to orchestrator if no writers selected

-- Add orchestrator preference column
ALTER TABLE public.user_api_keys
ADD COLUMN IF NOT EXISTS orchestrator_model_id TEXT DEFAULT NULL;

-- Add writer models preference column (array of model IDs)
ALTER TABLE public.user_api_keys
ADD COLUMN IF NOT EXISTS writer_model_ids TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.user_api_keys.orchestrator_model_id IS 
  'Preferred orchestrator model ID for this API key. NULL means auto-select the best available orchestrator model for this provider.';

COMMENT ON COLUMN public.user_api_keys.writer_model_ids IS 
  'Array of enabled writer model IDs. Empty array means orchestrator will write all content itself (single-model mode). Non-empty array enables multi-agent delegation.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_api_keys_orchestrator 
  ON public.user_api_keys(orchestrator_model_id) 
  WHERE orchestrator_model_id IS NOT NULL;

-- Note: No data migration needed - NULL orchestrator and empty writer array
-- are valid defaults that enable auto-selection behavior

