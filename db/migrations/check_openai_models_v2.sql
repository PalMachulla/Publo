-- Check what's stored in your OpenAI API key record
SELECT 
  id,
  provider,
  nickname,
  created_at,
  models_cached_at,
  orchestrator_model_id,
  CASE 
    WHEN models_cache IS NULL THEN 'NULL (no cache)'
    WHEN jsonb_array_length(models_cache) = 0 THEN 'Empty array'
    ELSE jsonb_array_length(models_cache)::text || ' models'
  END as cache_status
FROM user_api_keys
WHERE provider = 'openai'
  AND user_id = auth.uid()
ORDER BY created_at DESC;

-- If models_cache exists, show first 10 model IDs
SELECT 
  elem->>'id' as model_id,
  elem->>'name' as model_name
FROM user_api_keys,
     jsonb_array_elements(models_cache) as elem
WHERE provider = 'openai'
  AND user_id = auth.uid()
ORDER BY elem->>'id'
LIMIT 10;
