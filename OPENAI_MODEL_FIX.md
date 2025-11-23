# Fix for OpenAI Model ID Mismatch

## Problem
Your Publo UI shows `gpt-5.1-chat-latest`, but OpenAI's actual model IDs are:
- `gpt-5.1` (alias, always latest)
- `gpt-5.1-2025-11-13` (snapshot)

## Solution: Refresh Models Cache

### Option 1: Via UI (Recommended)
1. Go to **Profile → BYOAPI Settings**
2. Find your OpenAI API key
3. Click **"Refresh Models"** button (if it exists)
4. Or **delete and re-add** your OpenAI API key

### Option 2: Via Supabase SQL (Quick Fix)
Run this in your Supabase SQL editor:

```sql
-- Clear the models cache for your OpenAI key
-- This will force a refresh on next use
UPDATE user_api_keys
SET 
  models_cache = NULL,
  models_cached_at = NULL,
  orchestrator_model_id = NULL  -- Clear invalid model ID
WHERE provider = 'openai'
  AND user_id = auth.uid();
```

Then:
1. Go back to Publo
2. Navigate to Profile
3. The system will automatically fetch fresh models from OpenAI
4. Select the correct model: `gpt-5.1` or `gpt-5.1-2025-11-13`

### Option 3: Manual Database Update (If you know the correct ID)
If you want to use the snapshot version:

```sql
UPDATE user_api_keys
SET orchestrator_model_id = 'gpt-5.1-2025-11-13'
WHERE provider = 'openai'
  AND user_id = auth.uid()
  AND orchestrator_model_id = 'gpt-5.1-chat-latest';
```

Or use the alias (always latest):

```sql
UPDATE user_api_keys
SET orchestrator_model_id = 'gpt-5.1'
WHERE provider = 'openai'
  AND user_id = auth.uid()
  AND orchestrator_model_id = 'gpt-5.1-chat-latest';
```

## Why This Happened

OpenAI's API sometimes returns different model IDs than what's documented. The `-chat-latest` suffix might have been:
1. An old alias that's been deprecated
2. A beta/preview ID that's no longer valid
3. A caching issue on OpenAI's side

## Prevention

Add a "Refresh Models" button in the Profile page to let users manually refresh their models cache when OpenAI updates their model list.

## Verification

After fixing, check that:
1. The dropdown shows `gpt-5.1` or `gpt-5.1-2025-11-13`
2. Content generation works without 404 errors
3. The model responds correctly (reasoning models should show thinking process)

