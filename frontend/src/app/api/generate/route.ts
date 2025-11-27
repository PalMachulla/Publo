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
      mode = 'legacy', // NEW: orchestrator | writer | legacy (default)
      stream = false,   // NEW: Enable streaming responses (SSE)
      response_format,  // NEW: Structured outputs (OpenAI, Groq)
      tools,            // NEW: Tool use (Anthropic)
      tool_choice,      // NEW: Force tool (Anthropic)
      use_function_calling // NEW: Function calling (Google)
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

      // ✅ FIX: Detect provider from model and check for mismatch
      const detectedProvider = detectProviderFromModel(model)
      const isProviderMismatch = detectedProvider !== userKey.provider
      
      if (isProviderMismatch) {
        console.warn(`⚠️ Provider mismatch detected!`, {
          keyId: user_key_id,
          keyProvider: userKey.provider,
          model,
          detectedProvider,
        })
        
        // Find the correct provider's key
        const { data: correctKey } = await supabase
          .from('user_api_keys')
          .select('id, encrypted_key, provider, is_active, validation_status, nickname')
          .eq('user_id', user!.id) // ✅ FIX: Add null assertion (user is checked above)
          .eq('provider', detectedProvider)
          .eq('is_active', true)
          .eq('validation_status', 'valid')
          .limit(1)
          .single()
        
        if (correctKey) {
          console.log(`✅ Switched to correct ${detectedProvider} key:`, {
            from: userKey.provider,
            to: detectedProvider,
            model
          })
          apiKey = decryptAPIKey(correctKey.encrypted_key)
          keyId = correctKey.id
          keyOwnerId = user!.id // ✅ FIX: Add null assertion
          provider = detectedProvider as LLMProvider // ✅ FIX: Type assertion
        } else {
          return NextResponse.json(
            { 
              error: `Model ${model} requires ${detectedProvider?.toUpperCase() || 'UNKNOWN'} API key, but you only have ${userKey.provider.toUpperCase()} configured.`,
              provider: detectedProvider,
              details: 'Please add your API key for this provider at /settings/api-keys'
            },
            { status: 400 }
          )
        }
      } else {
        // No mismatch, use the provided key
        apiKey = decryptAPIKey(userKey.encrypted_key)
        keyId = user_key_id
        keyOwnerId = userKey.user_id
        provider = userKey.provider as LLMProvider
        
        console.log(`✅ Using API key:`, {
          keyId: user_key_id,
          provider,
          model,
        })
      }
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

    // ═══════════════════════════════════════════════════════════════
    // STREAMING MODE: Return SSE stream
    // ═══════════════════════════════════════════════════════════════
    if (stream) {
      console.log(`🌊 Streaming generation with ${provider} model ${model}`)
      
      const encoder = new TextEncoder()
      
      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Check if adapter supports streaming
            if (typeof adapter.generateStream !== 'function') {
              // Fallback to batch mode if streaming not supported
              console.warn(`⚠️ ${provider} adapter doesn't support streaming, falling back to batch`)
              
              const result = await adapter.generate(apiKey, {
                model,
                system_prompt,
                user_prompt,
                max_tokens,
                temperature,
                top_p,
                response_format,
                tools,
                tool_choice,
                use_function_calling
              })
              
              // Send as single chunk
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'content',
                content: result.content,
                done: true
              })}\n\n`))
              
              controller.close()
              return
            }
            
            // Stream from provider
            for await (const chunk of adapter.generateStream(apiKey, {
              model,
              system_prompt,
              user_prompt,
              max_tokens,
              temperature,
              top_p,
              response_format,
              tools,
              tool_choice,
              use_function_calling
            })) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            }
            
            controller.close()
          } catch (error: any) {
            console.error('❌ Streaming error:', error)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error.message || 'Streaming failed'
            })}\n\n`))
            controller.close()
          }
        }
      })
      
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        }
      })
    }
    
    // ═══════════════════════════════════════════════════════════════
    // BATCH MODE: Return JSON (existing behavior)
    // ═══════════════════════════════════════════════════════════════
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
        response_format,
        tools,
        tool_choice,
        use_function_calling
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
      // Orchestrator mode: return structured output if available, otherwise parse JSON
      const response: any = {
        success: true,
        content: generationResult.content, // Raw content (may be JSON string)
        usage: generationResult.usage,
        cost,
        model: generationResult.model,
        provider,
        timestamp: new Date().toISOString(),
      }
      
      // If the provider adapter returned structured_output, include it
      if ((generationResult as any).structured_output) {
        response.structured_output = (generationResult as any).structured_output
        console.log('✅ Including structured_output in API response')
      } else {
        // Try to parse content as JSON for backward compatibility
        try {
          response.plan = JSON.parse(generationResult.content)
          console.log('✅ Parsed content as JSON plan')
        } catch (parseError) {
          console.warn('⚠️ Content is not valid JSON, returning as-is')
        }
      }
      
      return NextResponse.json(response)
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

