/**
 * Test Model Access API
 * 
 * Actually tries to use a model with a tiny request to confirm access
 * Much more reliable than checking /v1/models list
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'
import type { LLMProvider } from '@/types/api-keys'

export async function POST(request: Request) {
  try {
    const { modelId, provider } = await request.json()

    if (!modelId || !provider) {
      return NextResponse.json(
        { error: 'modelId and provider are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's API key for this provider
    const { data: userKey, error: keyError } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('is_active', true)
      .single()

    if (keyError || !userKey) {
      return NextResponse.json(
        { error: `No active API key found for ${provider}` },
        { status: 404 }
      )
    }

    // Decrypt key
    const apiKey = decryptAPIKey(userKey.encrypted_key)

    // Get adapter
    const adapter = getProviderAdapter(provider as LLMProvider)

    // Try to use the model with a tiny request
    console.log(`🧪 Testing access to ${modelId}...`)
    
    try {
      const response = await adapter.generate(apiKey, {
        model: modelId,
        system_prompt: 'You are a helpful assistant.',
        user_prompt: 'Say "OK"',
        max_tokens: 5,
        temperature: 0,
      })

      console.log(`✅ Access confirmed for ${modelId}`)

      return NextResponse.json({
        success: true,
        hasAccess: true,
        modelId,
        provider,
        response: response.content,
        usage: response.usage,
      })
    } catch (error: any) {
      console.log(`❌ Access denied for ${modelId}:`, error.message)

      // Parse error to determine reason
      let reason = 'unknown'
      if (error.message?.includes('model_not_found') || error.message?.includes('does not exist')) {
        reason = 'model_not_found'
      } else if (error.message?.includes('insufficient_quota') || error.message?.includes('quota')) {
        reason = 'insufficient_quota'
      } else if (error.message?.includes('rate_limit')) {
        reason = 'rate_limit'
      } else if (error.message?.includes('permission') || error.message?.includes('access')) {
        reason = 'no_permission'
      }

      return NextResponse.json({
        success: true,
        hasAccess: false,
        modelId,
        provider,
        reason,
        error: error.message,
      })
    }
  } catch (error: any) {
    console.error('❌ Error in POST /api/models/test:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

