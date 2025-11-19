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
    const supabase = await createClient()

    // Try to get user from session (but don't require it)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // Log authentication status
    if (user) {
      console.log(`✅ Authenticated user: ${user.email}`)
    } else {
      console.log('⚠️ No authenticated user - will use default Publo keys only')
      if (authError) {
        console.log('Auth check error (non-fatal):', authError.message)
      }
    }

    // Parse request body
    const body: GenerateRequest = await request.json()
    const { model, system_prompt, user_prompt, max_tokens, user_key_id, temperature, top_p } = body

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

    // Get API key to use
    let apiKey: string
    let keyId: string | null = null

    if (user_key_id && user) {
      // Use user's specified key (requires authentication)
      const { data: userKey, error: keyError } = await supabase
        .from('user_api_keys')
        .select('encrypted_key, provider, is_active, validation_status')
        .eq('id', user_key_id)
        .eq('user_id', user.id)
        .single()

      if (keyError || !userKey) {
        return NextResponse.json(
          { error: 'API key not found or you don\'t have access' },
          { status: 404 }
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
      provider = userKey.provider as LLMProvider
    } else if (user) {
      // Try to find user's key for this provider as fallback
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
        console.log(`Using user's ${provider} key (${userKeys.nickname || 'unnamed'}) as fallback`)
        apiKey = decryptAPIKey(userKeys.encrypted_key)
        keyId = userKeys.id
      } else if (provider === 'groq' && process.env.GROQ_PUBLO_KEY) {
        // Fall back to Publo's default Groq key
        console.log('Using Publo default Groq key')
        apiKey = process.env.GROQ_PUBLO_KEY
      } else {
        return NextResponse.json(
          { 
            error: `No ${provider.toUpperCase()} API key available. Please add your own key at /settings/api-keys`,
            provider 
          },
          { status: 400 }
        )
      }
    } else {
      // No user authenticated - use Publo's default key only
      if (provider === 'groq' && process.env.GROQ_PUBLO_KEY) {
        console.log('Using Publo default Groq key (unauthenticated request)')
        apiKey = process.env.GROQ_PUBLO_KEY
      } else {
        return NextResponse.json(
          { 
            error: `Authentication required. No default key available for ${provider.toUpperCase()}.`,
            provider 
          },
          { status: 401 }
        )
      }
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

    // Track usage in database (only if user is authenticated)
    if (user) {
      const { error: usageError } = await supabase
        .from('ai_usage_history')
        .insert({
          user_id: user.id,
          key_id: keyId,
          provider,
          model,
          format: (body as any).format || null, // Optional format tracking
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
    } else {
      console.log('⚠️ Skipping usage tracking (unauthenticated request)')
    }

    // Return response
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

