/**
 * Model Sync API
 * 
 * Fetches latest models from vendor APIs and updates the model catalog.
 * Can be triggered manually or via cron job.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MODEL_CATALOG, type ModelCapabilities } from '@/lib/models/modelCapabilities'

interface SyncResult {
  success: boolean
  provider: string
  modelsFound: number
  newModels: string[]
  errors?: string[]
}

/**
 * Fetch models from OpenAI API
 */
async function syncOpenAI(apiKey: string): Promise<SyncResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }
    
    const data = await response.json()
    const models = data.data || []
    
    // Filter for chat/text generation models only
    const chatModels = models.filter((m: any) => 
      (m.id.includes('gpt') || m.id.includes('o1')) &&
      !m.id.includes('embedding') &&
      !m.id.includes('tts') &&
      !m.id.includes('whisper') &&
      !m.id.includes('dall-e')
    )
    
    // Find new models not in our catalog
    const catalogIds = MODEL_CATALOG.filter(m => m.provider === 'openai').map(m => m.id)
    const newModels = chatModels
      .map((m: any) => m.id)
      .filter((id: string) => !catalogIds.includes(id))
    
    return {
      success: true,
      provider: 'openai',
      modelsFound: chatModels.length,
      newModels
    }
  } catch (error) {
    return {
      success: false,
      provider: 'openai',
      modelsFound: 0,
      newModels: [],
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Fetch models from Anthropic API
 */
async function syncAnthropic(apiKey: string): Promise<SyncResult> {
  try {
    // Anthropic doesn't have a models list endpoint, so we'll use a known list
    // and check if they're available via a test request
    const knownModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ]
    
    // For now, just return the known models
    // In production, you could test each model with a small request
    const catalogIds = MODEL_CATALOG.filter(m => m.provider === 'anthropic').map(m => m.id)
    const newModels = knownModels.filter(id => !catalogIds.includes(id))
    
    return {
      success: true,
      provider: 'anthropic',
      modelsFound: knownModels.length,
      newModels
    }
  } catch (error) {
    return {
      success: false,
      provider: 'anthropic',
      modelsFound: 0,
      newModels: [],
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Fetch models from Groq API
 */
async function syncGroq(apiKey: string): Promise<SyncResult> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }
    
    const data = await response.json()
    const models = data.data || []
    
    // Filter for chat models only (exclude embeddings, etc.)
    const chatModels = models.filter((m: any) => 
      !m.id.includes('whisper') &&
      !m.id.includes('guard') &&
      !m.id.includes('embedding')
    )
    
    const catalogIds = MODEL_CATALOG.filter(m => m.provider === 'groq').map(m => m.id)
    const newModels = chatModels
      .map((m: any) => m.id)
      .filter((id: string) => !catalogIds.includes(id))
    
    return {
      success: true,
      provider: 'groq',
      modelsFound: chatModels.length,
      newModels
    }
  } catch (error) {
    return {
      success: false,
      provider: 'groq',
      modelsFound: 0,
      newModels: [],
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Fetch models from Google API
 */
async function syncGoogle(apiKey: string): Promise<SyncResult> {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey)
    
    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`)
    }
    
    const data = await response.json()
    const models = data.models || []
    
    // Filter for text generation models
    const chatModels = models.filter((m: any) => 
      m.name.includes('gemini') &&
      m.supportedGenerationMethods?.includes('generateContent')
    )
    
    const catalogIds = MODEL_CATALOG.filter(m => m.provider === 'google').map(m => m.id)
    const newModels = chatModels
      .map((m: any) => m.name.replace('models/', ''))
      .filter((id: string) => !catalogIds.includes(id))
    
    return {
      success: true,
      provider: 'google',
      modelsFound: chatModels.length,
      newModels
    }
  } catch (error) {
    return {
      success: false,
      provider: 'google',
      modelsFound: 0,
      newModels: [],
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * POST /api/models/sync
 * 
 * Syncs models from all configured providers
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Fetch user's API keys
    const { data: keys, error: keysError } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
    
    if (keysError || !keys || keys.length === 0) {
      return NextResponse.json({ 
        error: 'No active API keys found. Add API keys in your profile first.' 
      }, { status: 400 })
    }
    
    // Sync each provider
    const results: SyncResult[] = []
    
    for (const key of keys) {
      let result: SyncResult
      
      switch (key.provider) {
        case 'openai':
          result = await syncOpenAI(key.api_key)
          break
        case 'anthropic':
          result = await syncAnthropic(key.api_key)
          break
        case 'groq':
          result = await syncGroq(key.api_key)
          break
        case 'google':
          result = await syncGoogle(key.api_key)
          break
        default:
          result = {
            success: false,
            provider: key.provider,
            modelsFound: 0,
            newModels: [],
            errors: ['Provider not supported for auto-sync']
          }
      }
      
      results.push(result)
      
      // Update models_cache in database if successful
      if (result.success && result.modelsFound > 0) {
        // Fetch fresh models list for this provider
        const modelsResponse = await fetch(`${request.nextUrl.origin}/api/models?provider=${key.provider}`, {
          headers: {
            'Cookie': request.headers.get('cookie') || ''
          }
        })
        
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json()
          
          // Update the cache
          await supabase
            .from('user_api_keys')
            .update({ 
              models_cache: modelsData.models,
              updated_at: new Date().toISOString()
            })
            .eq('id', key.id)
        }
      }
    }
    
    // Record sync in database
    await supabase
      .from('model_sync_history')
      .insert({
        user_id: user.id,
        sync_results: results,
        total_new_models: results.reduce((sum, r) => sum + r.newModels.length, 0),
        synced_at: new Date().toISOString()
      })
    
    // Calculate summary
    const totalNew = results.reduce((sum, r) => sum + r.newModels.length, 0)
    const allNewModels = results.flatMap(r => r.newModels)
    const errors = results.filter(r => !r.success)
    
    return NextResponse.json({
      success: true,
      summary: {
        totalProviders: results.length,
        successfulSyncs: results.filter(r => r.success).length,
        totalNewModels: totalNew,
        newModels: allNewModels,
        errors: errors.length > 0 ? errors : undefined
      },
      results,
      message: totalNew > 0 
        ? `✅ Found ${totalNew} new model(s)! Check your model selector.`
        : '✅ All models up to date!'
    })
    
  } catch (error) {
    console.error('Model sync error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/models/sync
 * 
 * Get last sync status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get last sync
    const { data: lastSync, error: syncError } = await supabase
      .from('model_sync_history')
      .select('*')
      .eq('user_id', user.id)
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()
    
    if (syncError && syncError.code !== 'PGRST116') { // PGRST116 = no rows
      throw syncError
    }
    
    return NextResponse.json({
      lastSync: lastSync || null,
      needsSync: !lastSync || 
        (new Date().getTime() - new Date(lastSync.synced_at).getTime()) > 30 * 24 * 60 * 60 * 1000 // 30 days
    })
    
  } catch (error) {
    console.error('Get sync status error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

