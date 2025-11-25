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
import { LLMProvider } from '@/types/api-keys'

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
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('[API /intent/analyze] Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { system_prompt, user_prompt, conversation_history, temperature = 0.3 } = body
    
    console.log('[API /intent/analyze] Request params:', {
      hasSystemPrompt: !!system_prompt,
      systemPromptLength: system_prompt?.length || 0,
      hasUserPrompt: !!user_prompt,
      userPromptLength: user_prompt?.length || 0,
      hasConversationHistory: !!conversation_history,
      temperature
    })
    
    if (!system_prompt || !user_prompt) {
      console.error('[API /intent/analyze] Missing required fields:', {
        system_prompt: system_prompt ? 'present' : 'MISSING',
        user_prompt: user_prompt ? 'present' : 'MISSING'
      })
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
    let provider: LLMProvider

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
    
    // Generate intent analysis using orchestrator with intelligent fallback
    let result
    let attemptedModel = orchestratorModelId
    
    try {
      result = await adapter.generate(apiKey, generateOptions)
      console.log(`[API /intent/analyze] ✅ Success with ${attemptedModel}, length: ${result.content.length}`)
    } catch (primaryError: any) {
      console.warn(`[API /intent/analyze] ⚠️ Primary model (${attemptedModel}) failed:`, primaryError.message)
      
      // Check if it's a rate limit, quota, or credit error
      const isRateLimitError = primaryError.message?.toLowerCase().includes('rate limit') ||
                               primaryError.message?.toLowerCase().includes('quota') ||
                               primaryError.message?.toLowerCase().includes('insufficient') ||
                               primaryError.statusCode === 429
      
      if (isRateLimitError) {
        console.log('[API /intent/analyze] 🔄 Attempting fallback to alternative model...')
        
        // Try to find an alternative model from a different provider
        const { data: fallbackKeys } = await supabase
          .from('user_api_keys')
          .select('id, provider, encrypted_key, nickname')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .eq('validation_status', 'valid')
          .neq('provider', provider) // Different provider
          .limit(1)
        
        if (fallbackKeys && fallbackKeys.length > 0) {
          const fallbackKey = fallbackKeys[0]
          const fallbackProvider = fallbackKey.provider as LLMProvider
          const fallbackAdapter = getProviderAdapter(fallbackProvider)
          const fallbackApiKey = decryptAPIKey(fallbackKey.encrypted_key)
          
          // Use a sensible default model for the fallback provider
          const fallbackModel = fallbackProvider === 'groq' ? 'llama-3.1-8b-instant' :
                               fallbackProvider === 'openai' ? 'gpt-4-turbo' :
                               fallbackProvider === 'anthropic' ? 'claude-3-haiku-20240307' :
                               'default'
          
          const fallbackOptions = {
            ...generateOptions,
            model: fallbackModel
          }
          
          attemptedModel = `${fallbackModel} (fallback)`
          result = await fallbackAdapter.generate(fallbackApiKey, fallbackOptions)
          console.log(`[API /intent/analyze] ✅ Fallback succeeded with ${fallbackModel}`)
        } else {
          throw primaryError // No fallback available
        }
      } else {
        throw primaryError // Not a rate limit error, re-throw
      }
    }
    
    return NextResponse.json({
      success: true,
      content: result.content,
      modelUsed: attemptedModel
    })
    
  } catch (error) {
    console.error('[API /intent/analyze] ❌ All attempts failed:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze intent',
        suggestion: 'Please check your API credits or try again later'
      },
      { status: 500 }
    )
  }
}

