/**
 * Available Models API with Tier Metadata
 * 
 * Returns models that:
 * 1. User has API keys for (from existing /api/models endpoint)
 * 2. Are cross-referenced with MODEL_TIERS for metadata
 * 3. Include reasoning capability, tier, and performance info
 * 
 * GET /api/models/available
 * 
 * Used by orchestrator for intelligent model selection
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'
import { MODEL_TIERS, type TieredModel } from '@/lib/orchestrator/core/modelRouter'
import type { NormalizedModel, LLMProvider } from '@/types/api-keys'

export interface AvailableModel extends TieredModel {
  // From user's API
  available: boolean
  apiKeyId: string
  apiKeyNickname?: string
  
  // From NormalizedModel
  input_price_per_1m: number | null
  output_price_per_1m: number | null
  max_output_tokens: number | null
}

export interface AvailableModelsResponse {
  success: boolean
  
  // All models with tier metadata
  models: AvailableModel[]
  
  // Separated by capability
  reasoningModels: AvailableModel[]
  writingModels: AvailableModel[]
  
  // Statistics
  stats: {
    total: number
    byProvider: Record<string, number>
    byTier: Record<string, number>
    reasoningCount: number
    writingCount: number
  }
  
  // Unavailable models (in MODEL_TIERS but not accessible)
  unavailable: Array<{
    id: string
    displayName: string
    reason: 'no_api_key' | 'disabled' | 'not_found'
  }>
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

    console.log('🔍 [/api/models/available] Fetching models for user:', user.id)

    // Fetch user's active API keys
    const { data: userKeys, error: keysError } = await supabase
      .from('user_api_keys')
      .select('id, provider, nickname, encrypted_key, models_cache, models_cached_at, model_preferences, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (keysError) {
      console.error('❌ Error fetching user API keys:', keysError)
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      )
    }

    if (!userKeys || userKeys.length === 0) {
      console.warn('⚠️ No active API keys found for user')
      return NextResponse.json<AvailableModelsResponse>({
        success: true,
        models: [],
        reasoningModels: [],
        writingModels: [],
        stats: {
          total: 0,
          byProvider: {},
          byTier: {},
          reasoningCount: 0,
          writingCount: 0,
        },
        unavailable: MODEL_TIERS.map(m => ({
          id: m.id,
          displayName: m.displayName,
          reason: 'no_api_key'
        }))
      })
    }

    // Fetch models from each provider
    const availableModels: AvailableModel[] = []
    const modelIdSet = new Set<string>()

    for (const key of userKeys) {
      try {
        const adapter = getProviderAdapter(key.provider as LLMProvider)
        
        // Use cached models if available and fresh (< 24 hours)
        const cacheAge = key.models_cached_at 
          ? Date.now() - new Date(key.models_cached_at).getTime()
          : Infinity
        
        const isCacheFresh = cacheAge < 24 * 60 * 60 * 1000
        
        let models: NormalizedModel[]
        
        const cacheHasRequiredFields = key.models_cache && 
          Array.isArray(key.models_cache) && 
          key.models_cache.length > 0 &&
          'supports_chat' in key.models_cache[0]
        
        if (key.models_cache && isCacheFresh && cacheHasRequiredFields) {
          models = key.models_cache as NormalizedModel[]
          console.log(`✅ Using cached models for ${key.provider}`)
        } else {
          const reason = !key.models_cache ? 'no cache' : 
                        !isCacheFresh ? 'stale cache' : 
                        'missing required fields'
          console.log(`🔄 Fetching fresh ${key.provider} models (${reason})`)
          
          const decryptedKey = decryptAPIKey(key.encrypted_key)
          models = await adapter.fetchModels(decryptedKey)
          
          // ✅ FIX: Update cache in background (Postgrest doesn't have .catch())
          const { error: cacheError } = await supabase
            .from('user_api_keys')
            .update({
              models_cache: models as any,
              models_cached_at: new Date().toISOString(),
            })
            .eq('id', key.id)
          
          if (cacheError) {
            console.error('Failed to update cache:', cacheError)
          }
        }

        // Filter by user preferences and chat compatibility
        const prefs = key.model_preferences as Record<string, boolean> | null
        
        const filteredModels = models.filter(model => {
          if (model.supports_chat === false) return false
          const prefValue = prefs?.[model.id]
          return prefValue === true // Only enabled models
        })

        console.log(`📊 ${key.provider}: ${models.length} total → ${filteredModels.length} enabled`)

        // Cross-reference with MODEL_TIERS and enrich
        for (const model of filteredModels) {
          // Find matching tier metadata
          const tierModel = MODEL_TIERS.find(t => 
            t.id === model.id || 
            // Also match by base name (e.g., "gpt-4o" matches "gpt-4o-2024-11-20")
            t.id.startsWith(model.id.split('-')[0])
          )

          if (tierModel && !modelIdSet.has(model.id)) {
            modelIdSet.add(model.id)
            
            availableModels.push({
              // From MODEL_TIERS
              ...tierModel,
              
              // From user's API
              available: true,
              apiKeyId: key.id,
              apiKeyNickname: key.nickname || undefined,
              
              // From NormalizedModel (actual API data)
              input_price_per_1m: model.input_price_per_1m,
              output_price_per_1m: model.output_price_per_1m,
              max_output_tokens: model.max_output_tokens,
            })
          }
        }
      } catch (error) {
        console.error(`❌ Failed to fetch models for ${key.provider}:`, error)
        // Continue with other providers
      }
    }

    // ✅ NEW APPROACH: For models in MODEL_TIERS but not in provider's list,
    // assume they're available if user has the provider key (fail gracefully at runtime)
    // This handles new models like GPT-5.1 that aren't in /v1/models yet
    const availableProviders = new Set(userKeys.map(k => k.provider))
    const unavailable: AvailableModelsResponse['unavailable'] = []
    
    console.log('🔍 [Optimistic Loading] Starting check...')
    console.log(`   Available providers: ${Array.from(availableProviders).join(', ')}`)
    console.log(`   Models already found: ${Array.from(modelIdSet).join(', ')}`)
    console.log(`   Total MODEL_TIERS: ${MODEL_TIERS.length}`)
    
    for (const tierModel of MODEL_TIERS) {
      if (!modelIdSet.has(tierModel.id)) {
        if (availableProviders.has(tierModel.provider as LLMProvider)) {
          // User has API key for this provider - assume model is available!
          // If it's not, the actual generation will fail gracefully
          console.log(`➕ [Optimistic] Adding ${tierModel.id} (${tierModel.displayName}) - user has ${tierModel.provider} key`)
          
          const userKey = userKeys.find(k => k.provider === tierModel.provider)
          if (userKey) {
            modelIdSet.add(tierModel.id)
            availableModels.push({
              ...tierModel,
              available: true,
              apiKeyId: userKey.id,
              apiKeyNickname: userKey.nickname || undefined,
              // Use estimated pricing from MODEL_TIERS
              input_price_per_1m: null,
              output_price_per_1m: null,
              max_output_tokens: null,
            })
          } else {
            console.warn(`⚠️ [Optimistic] Could not find API key for ${tierModel.provider}`)
          }
        } else {
          // User doesn't have API key for this provider
          unavailable.push({
            id: tierModel.id,
            displayName: tierModel.displayName,
            reason: 'no_api_key'
          })
        }
      }
    }
    
    console.log(`✅ [Optimistic Loading] Complete. Total available models: ${availableModels.length}`)

    // ✅ FIX: Calculate statistics AFTER optimistic loading
    const reasoningModels = availableModels.filter(m => m.reasoning === true)
    const writingModels = availableModels.filter(m => m.reasoning === false)

    const stats = {
      total: availableModels.length,
      byProvider: availableModels.reduce((acc, m) => {
        acc[m.provider] = (acc[m.provider] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byTier: availableModels.reduce((acc, m) => {
        acc[m.tier] = (acc[m.tier] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      reasoningCount: reasoningModels.length,
      writingCount: writingModels.length,
    }

    console.log('✅ Available models:', {
      total: stats.total,
      reasoning: stats.reasoningCount,
      writing: stats.writingCount,
      byProvider: stats.byProvider,
    })

    return NextResponse.json<AvailableModelsResponse>({
      success: true,
      models: availableModels,
      reasoningModels,
      writingModels,
      stats,
      unavailable,
    })
  } catch (error: any) {
    console.error('❌ Error in GET /api/models/available:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

