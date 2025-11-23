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
    
    // Get configured orchestrator directly from user_api_keys
    const { data: configuredKeys } = await supabase
      .from('user_api_keys')
      .select('id, provider, encrypted_key, orchestrator_model_id, nickname')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('validation_status', 'valid')
      .not('orchestrator_model_id', 'is', null)
      .limit(1)

    let orchestratorModelId: string
    let userKey: any
    let provider: string

    if (configuredKeys && configuredKeys.length > 0) {
      userKey = configuredKeys[0]
      orchestratorModelId = userKey.orchestrator_model_id
      provider = userKey.provider
      console.log('[API /intent/analyze] Using configured orchestrator:', orchestratorModelId)
    } else {
      // Fallback to Groq
      const { data: groqKey } = await supabase
        .from('user_api_keys')
        .select('id, provider, encrypted_key, nickname')
        .eq('user_id', user.id)
        .eq('provider', 'groq')
        .eq('is_active', true)
        .eq('validation_status', 'valid')
        .limit(1)
        .maybeSingle()
      
      if (groqKey) {
        userKey = groqKey
        provider = 'groq'
        orchestratorModelId = 'llama-3.3-70b-versatile'
      } else {
        return NextResponse.json(
          { error: 'No active API keys found.' },
          { status: 400 }
        )
      }
    }
    
    // Decrypt the API key
    const apiKey = decryptAPIKey(userKey.encrypted_key)
    
    // Get provider adapter
    const adapter = getProviderAdapter(provider)
    
    // Detect if this is a reasoning model (o1, gpt-5, etc.) that restricts parameters
    const isReasoningModel = orchestratorModelId.toLowerCase().includes('o1') || 
                             orchestratorModelId.toLowerCase().includes('gpt-5')
    
    // Build generation options (reasoning models don't support custom temperature)
    const generateOptions: any = {
      model: orchestratorModelId,
      system_prompt,
      user_prompt,
      max_tokens: 500 // Intent analysis doesn't need many tokens
    }
    
    // Only add temperature for non-reasoning models
    if (!isReasoningModel) {
      generateOptions.temperature = temperature
    }
    
    // Generate intent analysis using orchestrator
    const result = await adapter.generate(apiKey, generateOptions)
    
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

