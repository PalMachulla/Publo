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

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    if (user_key_id) {
      // Use user's specified key
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
    } else {
      // Use Publo's default key (Groq only for now)
      if (provider !== 'groq' || !process.env.GROQ_PUBLO_KEY) {
        return NextResponse.json(
          { error: 'No API key available for this provider. Please add your own key.' },
          { status: 400 }
        )
      }

      apiKey = process.env.GROQ_PUBLO_KEY
    }

    // Get provider adapter
    const adapter = getProviderAdapter(provider)

    // Generate content
    console.log(`🤖 Generating with ${provider} model ${model}`)
    
    const generationResult = await adapter.generate(apiKey, {
      model,
      system_prompt,
      user_prompt,
      max_tokens,
      temperature,
      top_p,
    })

    // Calculate cost
    const cost = await adapter.calculateCost(model, generationResult.usage)

    console.log(`✅ Generation complete. Tokens: ${generationResult.usage.total_tokens}, Cost: $${cost.total_cost.toFixed(4)}`)

    // Track usage in database
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

