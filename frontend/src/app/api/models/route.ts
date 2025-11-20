/**
 * Unified Models API
 * Fetches models from all user's API keys + Publo's default keys
 * 
 * GET /api/models - Returns all available models grouped by provider
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'
import type { NormalizedModel, LLMProvider } from '@/types/api-keys'

interface ModelsResponse {
  success: boolean
  models: NormalizedModel[]
  grouped: {
    provider: LLMProvider
    source: 'user' | 'publo'
    key_id?: string
    key_nickname?: string
    models: NormalizedModel[]
  }[]
  has_user_keys: boolean
  total_count: number
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const grouped: ModelsResponse['grouped'] = []
    const allModels: NormalizedModel[] = []

    // 1. Fetch user's active API keys
    const { data: userKeys, error: keysError } = await supabase
      .from('user_api_keys')
      .select('id, provider, nickname, encrypted_key, models_cache, models_cached_at, model_preferences, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (keysError) {
      console.error('Error fetching user API keys:', keysError)
      // Continue with Publo's keys only
    }

    // 2. Fetch models from each user key
    if (userKeys && userKeys.length > 0) {
      for (const key of userKeys) {
        try {
          const adapter = getProviderAdapter(key.provider as LLMProvider)
          
          // Use cached models if available and fresh (< 24 hours)
          const cacheAge = key.models_cached_at 
            ? Date.now() - new Date(key.models_cached_at).getTime()
            : Infinity
          
          const isCacheFresh = cacheAge < 24 * 60 * 60 * 1000 // 24 hours
          
          let models: NormalizedModel[]
          
          // Check if cache has required fields (supports_chat was added later)
          const cacheHasRequiredFields = key.models_cache && 
            Array.isArray(key.models_cache) && 
            key.models_cache.length > 0 &&
            'supports_chat' in key.models_cache[0]
          
          if (key.models_cache && isCacheFresh && cacheHasRequiredFields) {
            // Use cached models
            models = key.models_cache as NormalizedModel[]
            console.log(`✅ Using cached models for ${key.provider} key ${key.id}`)
          } else {
            // Fetch fresh models (cache miss, stale, or missing required fields)
            const reason = !key.models_cache ? 'no cache' : 
                          !isCacheFresh ? 'stale cache' : 
                          'missing supports_chat field'
            console.log(`🔄 Fetching fresh ${key.provider} models (${reason})`)
            
            const decryptedKey = decryptAPIKey(key.encrypted_key)
            models = await adapter.fetchModels(decryptedKey)
            
            // Update cache in background (don't await)
            supabase
              .from('user_api_keys')
              .update({
                models_cache: models as any,
                models_cached_at: new Date().toISOString(),
              })
              .eq('id', key.id)
              .then((result) => {
                if (result.error) {
                  console.error('Failed to update model cache:', result.error)
                } else {
                  console.log(`Updated model cache for ${key.provider} key ${key.id}`)
                }
              })
          }

          // Filter models based on user preferences and chat compatibility
          const prefs = key.model_preferences as Record<string, boolean> | null
          console.log(`[API /models] Key ${key.id} (${key.provider}) preferences:`, prefs)
          console.log(`[API /models] Total models for ${key.provider}:`, models.length)
          
          const filteredModels = models.filter(model => {
            // Only show chat-compatible models
            if (model.supports_chat === false) {
              return false
            }
            
            // NEW BEHAVIOR: Models are DISABLED by default
            // Must be explicitly enabled (true) to show
            // undefined = hide (not enabled yet)
            // true = show (explicitly enabled)
            // false = hide (explicitly disabled)
            const prefValue = prefs?.[model.id]
            const isEnabled = prefValue === true
            
            if (key.provider === 'openai') {
              console.log(`[API /models] ${isEnabled ? '✅' : '❌'} ${model.name} (${model.id}): pref=${prefValue}`)
            }
            
            return isEnabled
          })

          console.log(`[API /models] ${key.provider}: ${models.length} total → ${filteredModels.length} enabled`)
          
          if (key.provider === 'openai') {
            console.log('[API /models] OpenAI enabled models:', filteredModels.map(m => m.name))
          }

          grouped.push({
            provider: key.provider as LLMProvider,
            source: 'user',
            key_id: key.id,
            key_nickname: key.nickname || undefined,
            models: filteredModels,
          })

          allModels.push(...filteredModels)
        } catch (error) {
          console.error(`Failed to fetch models for ${key.provider} key ${key.id}:`, error)
          // Continue with other keys
        }
      }
    }

    // 3. NO PUBLO KEYS - User must bring their own API keys
    // This ensures we never use .env keys for generation

    // 4. Sort grouped by provider order
    const providerOrder: Record<LLMProvider, number> = {
      openai: 1,
      anthropic: 2,
      google: 3,
      groq: 4,
    }
    
    grouped.sort((a, b) => {
      // User keys first
      if (a.source !== b.source) {
        return a.source === 'user' ? -1 : 1
      }
      // Then by provider order
      return (providerOrder[a.provider] || 99) - (providerOrder[b.provider] || 99)
    })

    return NextResponse.json<ModelsResponse>({
      success: true,
      models: allModels,
      grouped,
      has_user_keys: (userKeys?.length || 0) > 0,
      total_count: allModels.length,
    })
  } catch (error: any) {
    console.error('Error in GET /api/models:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

