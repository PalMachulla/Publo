import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'
import type { LLMProvider, NormalizedModel } from '@/types/api-keys'

interface DiscoveredModel {
  model_id: string
  provider: LLMProvider
  name: string
  context_window: number | null
  max_output_tokens: number | null
  supports_chat: boolean
  supports_system_prompt: boolean
  category: 'production' | 'preview' | 'deprecated'
  already_configured: boolean // Whether it exists in model_metadata
}

/**
 * POST /api/admin/models/fetch-vendors
 * Fetch models from vendor APIs using admin's API keys (admin only)
 * Returns discovered models that can be added to model_metadata
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch admin's active API keys
    const { data: adminKeys, error: keysError } = await supabase
      .from('user_api_keys')
      .select('id, provider, nickname, encrypted_key, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (keysError) {
      console.error('❌ [Admin Fetch Vendors] Error fetching admin keys:', keysError)
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    if (!adminKeys || adminKeys.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No API keys found',
        message: 'Please add API keys in your Profile settings first, then try again.'
      }, { status: 400 })
    }

    // Fetch existing model_metadata to check what's already configured
    const { data: existingMetadata } = await supabase
      .from('model_metadata')
      .select('model_id, provider')

    const configuredSet = new Set<string>()
    if (existingMetadata) {
      for (const meta of existingMetadata) {
        configuredSet.add(`${meta.provider}:${meta.model_id}`)
      }
    }

    // Fetch models from each provider the admin has keys for
    const discoveredModels: DiscoveredModel[] = []
    const errors: string[] = []

    for (const key of adminKeys) {
      try {
        const adapter = getProviderAdapter(key.provider as LLMProvider)
        const decryptedKey = decryptAPIKey(key.encrypted_key)
        
        console.log(`🔍 [Admin Fetch Vendors] Fetching models from ${key.provider}...`)
        const models = await adapter.fetchModels(decryptedKey)
        
        console.log(`✅ [Admin Fetch Vendors] Found ${models.length} models from ${key.provider}`)

        // Convert to discovered models format
        for (const model of models) {
          const key = `${model.provider}:${model.id}`
          const alreadyConfigured = configuredSet.has(key)

          discoveredModels.push({
            model_id: model.id,
            provider: model.provider,
            name: model.name,
            context_window: model.context_window,
            max_output_tokens: model.max_output_tokens,
            supports_chat: model.supports_chat,
            supports_system_prompt: model.supports_system_prompt,
            category: model.category,
            already_configured: alreadyConfigured
          })
        }
      } catch (error: any) {
        const errorMsg = `Failed to fetch ${key.provider} models: ${error.message || 'Unknown error'}`
        console.error(`❌ [Admin Fetch Vendors] ${errorMsg}`)
        errors.push(errorMsg)
        // Continue with other providers
      }
    }

    // Sort: unconfigured first, then by provider, then by model_id
    discoveredModels.sort((a, b) => {
      if (a.already_configured !== b.already_configured) {
        return a.already_configured ? 1 : -1
      }
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider)
      }
      return a.model_id.localeCompare(b.model_id)
    })

    return NextResponse.json({
      success: true,
      models: discoveredModels,
      stats: {
        total: discoveredModels.length,
        new: discoveredModels.filter(m => !m.already_configured).length,
        already_configured: discoveredModels.filter(m => m.already_configured).length,
        by_provider: discoveredModels.reduce((acc, m) => {
          acc[m.provider] = (acc[m.provider] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      },
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('❌ [Admin Fetch Vendors] Unexpected error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

