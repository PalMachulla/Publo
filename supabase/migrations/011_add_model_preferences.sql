-- Add model_preferences column to user_api_keys table
-- This stores which models the user wants to see in model selection dropdowns

ALTER TABLE public.user_api_keys
ADD COLUMN IF NOT EXISTS model_preferences JSONB DEFAULT '{}';

COMMENT ON COLUMN public.user_api_keys.model_preferences IS 'User preferences for which models to show/hide in model selection. Format: {model_id: boolean}';

