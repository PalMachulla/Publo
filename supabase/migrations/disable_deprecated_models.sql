-- Disable deprecated model IDs that are no longer in MODEL_TIERS
-- This prevents the system from trying to use models that don't exist

-- Update model_preferences to disable gpt-4-turbo-2024-04-09
UPDATE user_api_keys
SET model_preferences = 
  CASE 
    WHEN model_preferences ? 'gpt-4-turbo-2024-04-09' 
    THEN jsonb_set(
      model_preferences,
      '{gpt-4-turbo-2024-04-09}',
      'false'::jsonb,
      true
    )
    ELSE model_preferences
  END
WHERE model_preferences ? 'gpt-4-turbo-2024-04-09'
  AND (model_preferences->>'gpt-4-turbo-2024-04-09')::boolean = true;

-- Log the update
DO $$
DECLARE
  updated_count integer;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Disabled deprecated model gpt-4-turbo-2024-04-09 in % user preferences', updated_count;
END $$;

COMMENT ON TABLE user_api_keys IS 'Deprecated models (gpt-4-turbo-2024-04-09) have been disabled. System now validates all models against MODEL_TIERS.';

