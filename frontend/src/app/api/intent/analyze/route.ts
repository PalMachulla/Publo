/**
 * API Route: Analyze Intent using LLM
 * 
 * Uses the orchestrator model to reason about user intent.
 * This is much smarter than pattern matching and can understand context.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter, detectProviderFromModel } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Parse request body
    const { system_prompt, user_prompt, conversation_history, temperature = 0.3 } = await request.json()
    
    if (!system_prompt || !user_prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: system_prompt, user_prompt' },
        { status: 400 }
      )
    }
    
    console.log('[API /intent/analyze] Analyzing intent with LLM...')
    
    // Get orchestrator model preference
    const { data: preferences } = await supabase
      .from('model_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    const orchestratorModelId = preferences?.orchestrator_model || 'llama-3.3-70b-versatile'
    
    console.log('[API /intent/analyze] Using orchestrator:', orchestratorModelId)
    
    // Detect provider from model ID
    const provider = detectProviderFromModel(orchestratorModelId)
    if (!provider) {
      return NextResponse.json(
        { error: `Could not detect provider for model: ${orchestratorModelId}` },
        { status: 400 }
      )
    }
    
    // Get user's API key for this provider
    const { data: userKey, error: keyError } = await supabase
      .from('user_api_keys')
      .select('id, encrypted_key, provider, is_active, validation_status, nickname')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('is_active', true)
      .eq('validation_status', 'valid')
      .limit(1)
      .single()
    
    if (!userKey) {
      console.error('[API /intent/analyze] No API key found:', {
        provider,
        userId: user.id,
        keyError: keyError?.message
      })
      return NextResponse.json(
        { 
          error: `No ${provider.toUpperCase()} API key found. Please add your key at /settings/api-keys`,
          provider,
          details: keyError?.message
        },
        { status: 400 }
      )
    }
    
    // Decrypt the API key
    const apiKey = decryptAPIKey(userKey.encrypted_key)
    
    // Get provider adapter
    const adapter = getProviderAdapter(provider)
    
    // Generate intent analysis using orchestrator
    const result = await adapter.generate(apiKey, {
      model: orchestratorModelId,
      system_prompt,
      user_prompt,
      max_tokens: 500, // Intent analysis doesn't need many tokens
      temperature
    })
    
    console.log('[API /intent/analyze] Analysis complete, length:', result.content.length)
    
    return NextResponse.json({
      success: true,
      content: result.content
    })
    
  } catch (error) {
    console.error('[API /intent/analyze] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze intent' },
      { status: 500 }
    )
  }
}

