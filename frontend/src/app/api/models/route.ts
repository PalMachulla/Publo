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
      .select('id, provider, nickname, encrypted_key, models_cache, models_cached_at, is_active')
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
          
          if (key.models_cache && isCacheFresh) {
            // Use cached models
            models = key.models_cache as NormalizedModel[]
            console.log(`Using cached models for ${key.provider} key ${key.id}`)
          } else {
            // Fetch fresh models
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

          grouped.push({
            provider: key.provider as LLMProvider,
            source: 'user',
            key_id: key.id,
            key_nickname: key.nickname || undefined,
            models,
          })

          allModels.push(...models)
        } catch (error) {
          console.error(`Failed to fetch models for ${key.provider} key ${key.id}:`, error)
          // Continue with other keys
        }
      }
    }

    // 3. Add Publo's default Groq models (always available as fallback)
    if (process.env.GROQ_PUBLO_KEY) {
      try {
        const groqAdapter = getProviderAdapter('groq')
        const publoGroqModels = await groqAdapter.fetchModels(process.env.GROQ_PUBLO_KEY)
        
        // Only add Publo models if user doesn't have their own Groq key
        const hasUserGroqKey = userKeys?.some(k => k.provider === 'groq')
        
        if (!hasUserGroqKey) {
          grouped.push({
            provider: 'groq',
            source: 'publo',
            models: publoGroqModels,
          })
          allModels.push(...publoGroqModels)
        }
      } catch (error) {
        console.error('Failed to fetch Publo Groq models:', error)
      }
    }

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

