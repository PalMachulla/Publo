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
import { MODEL_TIERS, type TieredModel, type ModelTier } from '@/lib/orchestrator/core/modelRouter'
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
  
  // ✅ NEW: From database metadata (enriched)
  cost_per_1k_tokens_input?: number | null
  cost_per_1k_tokens_output?: number | null
  speed_tokens_per_sec?: number | null
  vendor_category?: 'production' | 'preview' | 'deprecated' | null
  vendor_synced_at?: string | null
  admin_verified?: boolean
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

    // ✅ NEW: Fetch admin metadata for models (includes active/inactive status)
    const { data: adminMetadata, error: metadataError } = await supabase
      .from('model_metadata')
      .select('*')
    
    if (metadataError) {
      console.warn('⚠️ [Available Models] Failed to fetch admin metadata:', metadataError)
    }
    
    // Create a map for quick lookup: provider:model_id -> metadata
    const metadataMap = new Map<string, any>()
    if (adminMetadata) {
      for (const meta of adminMetadata) {
        // Only include active, non-deprecated models in metadata map
        // (We'll still check is_active and vendor_category when filtering, but this map is for enrichment)
        if (meta.is_active !== false && meta.vendor_category !== 'deprecated') {
          metadataMap.set(`${meta.provider}:${meta.model_id}`, meta)
        }
      }
    }
    
    console.log(`📦 [Available Models] Loaded ${metadataMap.size} active admin metadata entries`)

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

        // Cross-reference with MODEL_TIERS and admin metadata, then enrich
        for (const model of filteredModels) {
          // ✅ Check if model is marked inactive or deprecated by admin
          const adminMeta = metadataMap.get(`${key.provider}:${model.id}`)
          if (adminMeta) {
            if (adminMeta.is_active === false) {
              console.log(`⏭️ [Available Models] Skipping inactive model: ${key.provider}:${model.id}`)
              continue
            }
            if (adminMeta.vendor_category === 'deprecated') {
              console.log(`⏭️ [Available Models] Skipping deprecated model: ${key.provider}:${model.id}`)
              continue
            }
          }
          
          // Find matching tier metadata
          const tierModel = MODEL_TIERS.find(t => 
            t.id === model.id || 
            // Also match by base name (e.g., "gpt-4o" matches "gpt-4o-2024-11-20")
            t.id.startsWith(model.id.split('-')[0])
          )

          if (tierModel && !modelIdSet.has(model.id)) {
            modelIdSet.add(model.id)
            
            // ✅ ENHANCED: Merge admin metadata with MODEL_TIERS (admin metadata takes precedence)
            const mergedModel: AvailableModel = {
              // Start with MODEL_TIERS as base
              ...tierModel,
              
              // ✅ Override with admin metadata if available (database is source of truth)
              ...(adminMeta ? {
                structuredOutput: (adminMeta.supports_structured_output || tierModel.structuredOutput) as 'full' | 'json-mode' | 'none',
                reasoning: adminMeta.supports_reasoning ?? tierModel.reasoning,
                tier: (adminMeta.tier || tierModel.tier) as ModelTier,
                speed: (adminMeta.speed || tierModel.speed) as 'instant' | 'fast' | 'medium' | 'slow',
                cost: (adminMeta.cost || tierModel.cost) as 'cheap' | 'moderate' | 'expensive',
                contextWindow: adminMeta.context_window || tierModel.contextWindow,
                bestFor: adminMeta.best_for && Array.isArray(adminMeta.best_for) 
                  ? adminMeta.best_for as TieredModel['bestFor']
                  : tierModel.bestFor,
              } : {}),
              
              // From user's API
              available: true,
              apiKeyId: key.id,
              apiKeyNickname: key.nickname || undefined,
              
              // From NormalizedModel (actual API data)
              input_price_per_1m: model.input_price_per_1m,
              output_price_per_1m: model.output_price_per_1m,
              max_output_tokens: model.max_output_tokens,
              
              // ✅ NEW: Enrich with database metadata (pricing, speed, vendor info)
              cost_per_1k_tokens_input: adminMeta?.cost_per_1k_tokens_input ?? null,
              cost_per_1k_tokens_output: adminMeta?.cost_per_1k_tokens_output ?? null,
              speed_tokens_per_sec: adminMeta?.speed_tokens_per_sec ?? null,
              vendor_category: adminMeta?.vendor_category ?? null,
              vendor_synced_at: adminMeta?.vendor_synced_at ?? null,
              admin_verified: adminMeta?.admin_verified ?? false,
            }
            
            availableModels.push(mergedModel)
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
        // ✅ Check if model is marked inactive or deprecated by admin
        const adminMeta = metadataMap.get(`${tierModel.provider}:${tierModel.id}`)
        if (adminMeta) {
          if (adminMeta.is_active === false) {
            console.log(`⏭️ [Optimistic] Skipping inactive model: ${tierModel.provider}:${tierModel.id}`)
            unavailable.push({
              id: tierModel.id,
              displayName: tierModel.displayName,
              reason: 'disabled' // Admin disabled this model
            })
            continue
          }
          if (adminMeta.vendor_category === 'deprecated') {
            console.log(`⏭️ [Optimistic] Skipping deprecated model: ${tierModel.provider}:${tierModel.id}`)
            unavailable.push({
              id: tierModel.id,
              displayName: tierModel.displayName,
              reason: 'disabled' // Model is deprecated
            })
            continue
          }
        }
        
        if (availableProviders.has(tierModel.provider as LLMProvider)) {
          // User has API key for this provider - assume model is available!
          // If it's not, the actual generation will fail gracefully
          console.log(`➕ [Optimistic] Adding ${tierModel.id} (${tierModel.displayName}) - user has ${tierModel.provider} key`)
          
          const userKey = userKeys.find(k => k.provider === tierModel.provider)
          if (userKey) {
            modelIdSet.add(tierModel.id)
            
            // ✅ ENHANCED: Merge admin metadata with MODEL_TIERS (admin metadata takes precedence)
            const mergedModel: AvailableModel = {
              // Start with MODEL_TIERS as base
              ...tierModel,
              
              // ✅ Override with admin metadata if available (database is source of truth)
              ...(adminMeta ? {
                structuredOutput: (adminMeta.supports_structured_output || tierModel.structuredOutput) as 'full' | 'json-mode' | 'none',
                reasoning: adminMeta.supports_reasoning ?? tierModel.reasoning,
                tier: (adminMeta.tier || tierModel.tier) as ModelTier,
                speed: (adminMeta.speed || tierModel.speed) as 'instant' | 'fast' | 'medium' | 'slow',
                cost: (adminMeta.cost || tierModel.cost) as 'cheap' | 'moderate' | 'expensive',
                contextWindow: adminMeta.context_window || tierModel.contextWindow,
                bestFor: adminMeta.best_for && Array.isArray(adminMeta.best_for) 
                  ? adminMeta.best_for as TieredModel['bestFor']
                  : tierModel.bestFor,
              } : {}),
              
              available: true,
              apiKeyId: userKey.id,
              apiKeyNickname: userKey.nickname || undefined,
              // Use estimated pricing from MODEL_TIERS (no API data for optimistic models)
              input_price_per_1m: null,
              output_price_per_1m: null,
              max_output_tokens: null,
              
              // ✅ NEW: Enrich with database metadata (pricing, speed, vendor info)
              cost_per_1k_tokens_input: adminMeta?.cost_per_1k_tokens_input ?? null,
              cost_per_1k_tokens_output: adminMeta?.cost_per_1k_tokens_output ?? null,
              speed_tokens_per_sec: adminMeta?.speed_tokens_per_sec ?? null,
              vendor_category: adminMeta?.vendor_category ?? null,
              vendor_synced_at: adminMeta?.vendor_synced_at ?? null,
              admin_verified: adminMeta?.admin_verified ?? false,
            }
            
            availableModels.push(mergedModel)
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

