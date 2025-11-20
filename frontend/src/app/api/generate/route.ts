/**
 * Unified Generation API
 * Generates content using user's API keys or Publo's default keys
 * Tracks usage and costs automatically
 * 
 * POST /api/generate
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter, detectProviderFromModel } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'
import type { GenerateRequest, GenerateResponse, LLMProvider } from '@/types/api-keys'

export async function POST(request: Request) {
  try {
    // Parse request body first (before auth, so we can check for key_id)
    const body: GenerateRequest = await request.json()
    const { 
      model, 
      system_prompt, 
      user_prompt, 
      max_tokens, 
      user_key_id, 
      temperature, 
      top_p,
      mode = 'legacy' // NEW: orchestrator | writer | legacy (default)
    } = body
    
    const supabase = await createClient()

    // Try to get user, but don't fail if session is invalid (Vercel cookie issues)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // If no user AND no key_id provided, reject the request
    if (!user && !user_key_id) {
      console.error('❌ Authentication required in /api/generate:', authError?.message)
      return NextResponse.json({ 
        error: 'Authentication required. Please log in to use AI generation.',
        details: 'You must be logged in and have your own API keys configured.'
      }, { status: 401 })
    }

    if (user) {
      console.log(`✅ Authenticated user: ${user.email}`)
    } else {
      console.log(`⚠️ No user session, but key_id provided: ${user_key_id}`)
    }

    // Validate input
    if (!model || !system_prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: model, system_prompt' },
        { status: 400 }
      )
    }

    // Detect provider from model ID
    let provider = body.provider || detectProviderFromModel(model)
    if (!provider) {
      return NextResponse.json(
        { error: `Could not detect provider for model: ${model}` },
        { status: 400 }
      )
    }

    // Get API key to use - User MUST provide their own key
    let apiKey: string
    let keyId: string | null = null
    let keyOwnerId: string | null = null

    if (user_key_id) {
      // Use specified key (works with or without user session)
      const { data: userKey, error: keyError } = await supabase
        .from('user_api_keys')
        .select('encrypted_key, provider, is_active, validation_status, user_id')
        .eq('id', user_key_id)
        .single()

      if (keyError || !userKey) {
        return NextResponse.json(
          { error: 'API key not found or you don\'t have access' },
          { status: 404 }
        )
      }

      // If we have a user session, verify ownership
      if (user && userKey.user_id !== user.id) {
        return NextResponse.json(
          { error: 'You don\'t have access to this API key' },
          { status: 403 }
        )
      }

      if (!userKey.is_active) {
        return NextResponse.json(
          { error: 'This API key is inactive. Please activate it first.' },
          { status: 400 }
        )
      }

      if (userKey.validation_status !== 'valid') {
        return NextResponse.json(
          { error: 'This API key is invalid or expired. Please update it.' },
          { status: 400 }
        )
      }

      apiKey = decryptAPIKey(userKey.encrypted_key)
      keyId = user_key_id
      keyOwnerId = userKey.user_id
      provider = userKey.provider as LLMProvider
      
      console.log(`✅ Using API key:`, {
        keyId: user_key_id,
        provider,
        model,
        detectedProvider: detectProviderFromModel(model),
        keyProviderFromDB: userKey.provider,
        isProviderMismatch: detectProviderFromModel(model) !== userKey.provider
      })
    } else if (user) {
      // Try to find user's key for this provider automatically
      const { data: userKeys } = await supabase
        .from('user_api_keys')
        .select('id, encrypted_key, provider, is_active, validation_status, nickname')
        .eq('user_id', user.id)
        .eq('provider', provider)
        .eq('is_active', true)
        .eq('validation_status', 'valid')
        .limit(1)
        .single()

      if (userKeys) {
        // Use user's key
        console.log(`Using user's ${provider} key (${userKeys.nickname || 'unnamed'})`)
        apiKey = decryptAPIKey(userKeys.encrypted_key)
        keyId = userKeys.id
        keyOwnerId = user.id
      } else {
        // No key found - user MUST add their own
        return NextResponse.json(
          { 
            error: `No ${provider.toUpperCase()} API key found. Please add your own key at /settings/api-keys`,
            provider,
            details: 'Publo uses a BYOAPI model - you must provide your own API keys.'
          },
          { status: 400 }
        )
      }
    } else {
      // No user session and no key_id - this shouldn't happen due to earlier check
      return NextResponse.json(
        { error: 'Authentication required and no API key provided' },
        { status: 401 }
      )
    }

    // Get provider adapter
    const adapter = getProviderAdapter(provider)

    // Generate content
    console.log(`🤖 Generating with ${provider} model ${model}`, {
      keyLength: apiKey.length,
      keyPreview: `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`,
      keyId: keyId || 'publo-default'
    })
    
    let generationResult
    try {
      generationResult = await adapter.generate(apiKey, {
        model,
        system_prompt,
        user_prompt,
        max_tokens,
        temperature,
        top_p,
      })
    } catch (error: any) {
      console.error('❌ Generation failed:', {
        provider,
        model,
        error: error.message,
        status: error.status,
        details: error
      })
      
      // Return user-friendly error
      if (error.status === 401 || error.message?.includes('API key') || error.message?.includes('authentication')) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your key and try again.' },
          { status: 401 }
        )
      }
      
      return NextResponse.json(
        { 
          error: error.message || 'Generation failed',
          details: error.details || undefined
        },
        { status: 500 }
      )
    }

    // Calculate cost
    const cost = await adapter.calculateCost(model, generationResult.usage)

    console.log(`✅ Generation complete. Tokens: ${generationResult.usage.total_tokens}, Cost: $${cost.total_cost.toFixed(4)}`)

    // Track usage in database (use key owner's ID for tracking)
    const { error: usageError } = await supabase
      .from('ai_usage_history')
      .insert({
        user_id: keyOwnerId,
        key_id: keyId,
        provider,
        model,
        format: (body as any).format || null,
        prompt_tokens: generationResult.usage.prompt_tokens,
        completion_tokens: generationResult.usage.completion_tokens,
        total_tokens: generationResult.usage.total_tokens,
        input_cost: cost.input_cost,
        output_cost: cost.output_cost,
        total_cost: cost.total_cost,
      })

    if (usageError) {
      console.error('Failed to track usage:', usageError)
      // Continue anyway - don't fail the generation
    }

    // Return response based on mode
    if (mode === 'orchestrator') {
      // Orchestrator mode: expect JSON response from model
      try {
        const plan = JSON.parse(generationResult.content)
        
        return NextResponse.json({
          success: true,
          plan, // Parsed JSON plan
          usage: generationResult.usage,
          cost,
          model: generationResult.model,
          provider,
          timestamp: new Date().toISOString(),
        })
      } catch (parseError: any) {
        console.error('❌ Failed to parse orchestrator JSON response:', parseError)
        return NextResponse.json(
          { 
            error: 'Orchestrator returned invalid JSON',
            details: parseError.message,
            rawContent: generationResult.content.substring(0, 500)
          },
          { status: 500 }
        )
      }
    } else if (mode === 'writer') {
      // Writer mode: return plain text content
      return NextResponse.json({
        success: true,
        content: generationResult.content, // Plain text
        usage: generationResult.usage,
        cost,
        model: generationResult.model,
        provider,
        timestamp: new Date().toISOString(),
      })
    } else {
      // Legacy mode: return markdown (backward compatibility)
      const response: GenerateResponse = {
        success: true,
        markdown: generationResult.content,
        usage: generationResult.usage,
        cost,
        model: generationResult.model,
        provider,
        timestamp: new Date().toISOString(),
      }

      return NextResponse.json(response)
    }
  } catch (error: any) {
    console.error('Error in POST /api/generate:', error)

    // Handle provider-specific errors
    if (error.name === 'InvalidAPIKeyError') {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your key and try again.' },
        { status: 401 }
      )
    }

    if (error.name === 'RateLimitError') {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

