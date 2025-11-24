-- Fix invalid orchestrator model preference
-- This clears the invalid "gpt-5.1-chat-latest" model and allows auto-selection

-- Reset any invalid orchestrator model preferences to NULL (auto-select)
UPDATE user_api_keys
SET orchestrator_model_id = NULL
WHERE orchestrator_model_id = 'gpt-5.1-chat-latest';

-- Also clear any other potentially invalid gpt-5 variants
UPDATE user_api_keys
SET orchestrator_model_id = NULL
WHERE orchestrator_model_id LIKE 'gpt-5%' 
  AND orchestrator_model_id NOT IN (
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'llama-3.1-8b-instant'
  );

-- Note: NULL orchestrator_model_id means the system will auto-select
-- the best available model from your configured API keys

