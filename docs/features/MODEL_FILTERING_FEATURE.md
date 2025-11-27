# Model Filtering & Selection Feature

## Overview

This feature implements model filtering and user preferences for BYOAPI models. It addresses two key issues:
1. **Model Compatibility** - Filters out models that don't support chat completions (v1/chat/completions endpoint)
2. **User Preferences** - Allows users to select which models they want to see in model selection dropdowns

## Changes Made

### 1. Database Changes

**New Migration**: `supabase/migrations/011_add_model_preferences.sql`
- Adds `model_preferences` JSONB column to `user_api_keys` table
- Stores format: `{model_id: boolean}` where `true` = enabled, `false` = disabled
- Default: `{}` (all models enabled by default)

**To Apply**:
```bash
# From project root
npx supabase db push
# OR manually via Supabase Studio SQL editor
```

### 2. Type Updates

**File**: `frontend/src/types/api-keys.ts`

Added new fields to `NormalizedModel`:
- `supports_chat: boolean` - Indicates if model supports v1/chat/completions endpoint
- `user_enabled?: boolean` - User preference for showing this model (optional)

Added to `UserAPIKey`:
- `model_preferences: Record<string, boolean> | null` - Stores user's model enable/disable choices

### 3. Provider Adapter Updates

**Files**:
- `frontend/src/lib/providers/groq.ts`
- `frontend/src/lib/providers/openai.ts`

Both adapters now set `supports_chat: true` in their `normalizeModel()` methods, since all Groq and OpenAI models we fetch support chat completions.

### 4. API Endpoints

#### Updated: `GET /api/models`

**File**: `frontend/src/app/api/models/route.ts`

Changes:
- Now fetches `model_preferences` from database
- Filters models based on user preferences (shows only enabled models)
- Default behavior: If preference not set for a model, it's enabled

#### Updated: `GET /api/user/api-keys`

**File**: `frontend/src/app/api/user/api-keys/route.ts`

Changes:
- Now includes `model_preferences` in SELECT query

#### New: `PATCH /api/user/api-keys/[keyId]/models`

**File**: `frontend/src/app/api/user/api-keys/[keyId]/models/route.ts`

New endpoint to update model preferences:

```typescript
// Request
PATCH /api/user/api-keys/{keyId}/models
{
  "modelId": "gpt-4o",
  "enabled": false
}

// Response
{
  "success": true,
  "preferences": { "gpt-4o": false, ... }
}
```

### 5. Frontend Changes

#### CreateStoryPanel

**File**: `frontend/src/components/panels/CreateStoryPanel.tsx`

Changes:
- Added filter to only show chat-compatible models (`model.supports_chat === true`)
- Filters before displaying models in the dropdown

#### Profile Page

**File**: `frontend/src/app/profile/page.tsx`

New UI in BYOAPI section:
- **Collapsible "Available Models" section** for each API key
- Shows all cached models with checkboxes
- User can check/uncheck to enable/disable models
- Changes are saved immediately to database
- Shows model metadata:
  - Name and category badge (Production/Preview)
  - Chat support badge
  - Context window, max output tokens
  - Pricing (per 1M tokens)
- Only chat-compatible models are shown (filters out legacy completions-only models)

## User Flow

### Viewing & Managing Models

1. Go to **Profile** page
2. Click on **BYOAPI** section
3. Expand a provider (e.g., Groq, OpenAI)
4. Click **"Available Models (N)"** to expand model list
5. Check/uncheck models to enable/disable them
6. Changes save automatically

### Model Selection in Story Generation

1. Create a new **Orchestrator Node** on canvas
2. Click **"Generate Structure"**
3. In the model dropdown:
   - Only **chat-compatible** models appear
   - Only **user-enabled** models appear
   - Models are grouped by provider and key

## Technical Details

### Model Filtering Logic

```typescript
// In /api/models - Filter by user preferences
const filteredModels = models.filter(model => {
  const prefs = key.model_preferences as Record<string, boolean> | null
  return prefs?.[model.id] !== false  // Show if undefined or true
})

// In CreateStoryPanel - Filter by chat support
const filteredGroups = data.grouped.map((group: GroupedModels) => ({
  ...group,
  models: group.models.filter((m: NormalizedModel) => m.supports_chat)
})).filter((group: GroupedModels) => group.models.length > 0)
```

### Default Behavior

- **New keys**: All models enabled by default (`model_preferences = {}`)
- **Unknown model**: Enabled by default (`prefs?.[model.id] !== false`)
- **Explicitly disabled**: User must uncheck to disable (`prefs[model.id] = false`)

### Error Handling

- If PATCH request fails, checkbox reverts to previous state
- Console errors logged for debugging
- Profile page refreshes after successful update to show latest state

## Benefits

1. **Prevents API Errors**: Filters out incompatible models that would cause 404 errors
2. **Cleaner UX**: Users only see models they care about in dropdowns
3. **Flexible**: Per-key preferences allow different configurations for different API keys
4. **Secure**: Preferences stored server-side, validated on every request
5. **Fast**: Uses cached models, no extra API calls needed

## Future Enhancements

- [ ] Add "Enable All" / "Disable All" buttons for quick bulk changes
- [ ] Add model search/filter in the Available Models list
- [ ] Show usage statistics per model
- [ ] Add model presets (e.g., "Fast Models", "High Quality", "Cost-Effective")
- [ ] Support for other providers (Anthropic, Google, Azure, Bedrock)

## Testing

### Test the Error Fix

**Before**:
```
Error: 404 This is not a chat model and thus not supported in the v1/chat/completions endpoint
```

**After**: Non-chat models won't appear in the dropdown, preventing this error.

### Test Model Selection

1. Add a Groq or OpenAI API key
2. Go to Profile → BYOAPI
3. Expand the provider
4. Click "Available Models"
5. Uncheck a model (e.g., gpt-4o-mini)
6. Go to Canvas
7. Create Orchestrator Node
8. Verify gpt-4o-mini doesn't appear in model dropdown
9. Go back to Profile
10. Re-check gpt-4o-mini
11. Return to Canvas
12. Refresh page (or refetch models)
13. Verify gpt-4o-mini now appears

## Files Modified

- ✅ `supabase/migrations/011_add_model_preferences.sql` (new)
- ✅ `frontend/src/types/api-keys.ts`
- ✅ `frontend/src/lib/providers/groq.ts`
- ✅ `frontend/src/lib/providers/openai.ts`
- ✅ `frontend/src/app/api/models/route.ts`
- ✅ `frontend/src/app/api/user/api-keys/route.ts`
- ✅ `frontend/src/app/api/user/api-keys/[keyId]/models/route.ts` (new)
- ✅ `frontend/src/components/panels/CreateStoryPanel.tsx`
- ✅ `frontend/src/app/profile/page.tsx`

## Migration Required

⚠️ **Important**: Run the database migration before using this feature:

```bash
cd /Users/palmac/Aiakaki/Code/publo
npx supabase db push
```

Or copy the SQL from `supabase/migrations/011_add_model_preferences.sql` and run it in Supabase Studio.

