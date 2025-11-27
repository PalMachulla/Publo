-- Check what OpenAI models are actually stored in your database
SELECT 
  provider,
  nickname,
  jsonb_pretty(models_cache) as models,
  orchestrator_model_id,
  created_at
FROM user_api_keys
WHERE provider = 'openai'
  AND is_active = true
ORDER BY created_at DESC
LIMIT 1;
