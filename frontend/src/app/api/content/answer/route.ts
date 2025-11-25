/**
 * API Route: Answer Question
 * 
 * This endpoint uses the orchestrator model to answer questions about the story content.
 * It has access to the full context (structure, content map, active segment).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter, detectProviderFromModel } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'
import { LLMProvider } from '@/types/api-keys'

export async function POST(request: NextRequest) {
  console.log('[API /content/answer] ===== REQUEST START =====')
  try {
    console.log('[API /content/answer] Step 1: Creating Supabase client')
    const supabase = await createClient()
    
    console.log('[API /content/answer] Step 2: Verifying authentication')
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[API /content/answer] Auth failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    console.log('[API /content/answer] User authenticated:', user.id)
    
    console.log('[API /content/answer] Step 3: Parsing request body')
    // Parse request body
    const { question, context } = await request.json()
    
    if (!question) {
      console.error('[API /content/answer] Missing question')
      return NextResponse.json(
        { error: 'Missing required field: question' },
        { status: 400 }
      )
    }
    console.log('[API /content/answer] Question received:', question.substring(0, 100))
    
    console.log('[API /content/answer] Request:', { 
      question, 
      hasContext: !!context,
      structureItemsCount: context?.structureItems?.length,
      contentMapKeys: context?.contentMap ? Object.keys(context.contentMap) : [],
      contentMapSample: context?.contentMap ? Object.keys(context.contentMap).slice(0, 3).map(key => ({
        id: key,
        contentLength: context.contentMap[key]?.length,
        preview: context.contentMap[key]?.substring(0, 50)
      })) : []
    })
    
    console.log('[API /content/answer] Step 4: Fetching configured orchestrator model')
    // Get configured orchestrator directly from user_api_keys
    // This respects the selection made in the CreateStoryPanel dropdown
    const { data: configuredKeys, error: keysFetchError } = await supabase
      .from('user_api_keys')
      .select('id, provider, encrypted_key, orchestrator_model_id, nickname')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('validation_status', 'valid')
      .not('orchestrator_model_id', 'is', null)
      .limit(1)

    if (keysFetchError) {
      console.error('[API /content/answer] Failed to fetch keys:', keysFetchError)
      return NextResponse.json(
        { error: 'Failed to fetch API keys configuration', details: keysFetchError.message },
        { status: 500 }
      )
    }

    let orchestratorModelId: string
    let userKey: any
    let provider: LLMProvider

    if (configuredKeys && configuredKeys.length > 0) {
      // Found explicit user preference
      userKey = configuredKeys[0]
      orchestratorModelId = userKey.orchestrator_model_id
      provider = userKey.provider
      console.log('[API /content/answer] Using configured orchestrator:', {
        model: orchestratorModelId,
        provider: provider,
        keyNick: userKey.nickname
      })
    } else {
      // Fallback: Try to find a valid Groq key for default model
      console.log('[API /content/answer] No orchestrator configured, attempting fallback to Groq')
      const { data: groqKey, error: groqError } = await supabase
        .from('user_api_keys')
        .select('id, provider, encrypted_key, nickname')
        .eq('user_id', user.id)
        .eq('provider', 'groq')
        .eq('is_active', true)
        .eq('validation_status', 'valid')
        .limit(1)
        .maybeSingle()
      
      if (groqError) {
        console.error('[API /content/answer] Failed to fetch Groq key:', groqError)
        return NextResponse.json(
          { error: 'Failed to fetch fallback API key', details: groqError.message },
          { status: 500 }
        )
      }
      
      if (groqKey) {
        userKey = groqKey
        provider = 'groq'
        orchestratorModelId = 'llama-3.3-70b-versatile'
        console.log('[API /content/answer] Fallback successful: Using default Llama 3.3')
      } else {
        console.error('[API /content/answer] No API keys found at all')
        return NextResponse.json(
          { error: 'No active API keys found. Please add an API key in Settings -> API Keys.' },
          { status: 400 }
        )
      }
    }
    
    console.log('[API /content/answer] Step 5: Decrypting API key')
    // Decrypt the API key
    let apiKey: string
    try {
      apiKey = decryptAPIKey(userKey.encrypted_key)
      console.log('[API /content/answer] API key decrypted successfully')
    } catch (decryptError) {
      console.error('[API /content/answer] Failed to decrypt API key:', decryptError)
      return NextResponse.json(
        { error: 'Failed to decrypt API key', details: decryptError instanceof Error ? decryptError.message : 'Unknown error' },
        { status: 500 }
      )
    }

    console.log('[API /content/answer] Step 6: Getting provider adapter for:', provider)
    // Get provider adapter
    let adapter: any
    try {
      adapter = getProviderAdapter(provider)
      console.log('[API /content/answer] Provider adapter obtained successfully')
    } catch (adapterError) {
      console.error('[API /content/answer] Failed to get provider adapter:', adapterError)
      return NextResponse.json(
        { error: 'Failed to initialize provider adapter', details: adapterError instanceof Error ? adapterError.message : 'Unknown error' },
        { status: 500 }
      )
    }
    
    console.log('[API /content/answer] Step 7: Building context string')
    // Build context string
    let contextString = ''
    if (context) {
      if (context.activeContext) {
        contextString += `\n\nActive Section: ${context.activeContext.name}`
        if (context.activeContext.title) {
          contextString += ` - ${context.activeContext.title}`
        }
      }
      
      if (context.structureItems && Array.isArray(context.structureItems)) {
        contextString += `\n\nStory Structure (${context.structureItems.length} sections):`
        context.structureItems.slice(0, 10).forEach((item: any) => {
          contextString += `\n- Level ${item.level}: ${item.name}`
          if (item.title) contextString += ` - ${item.title}`
        })
      }
      
      if (context.contentMap && typeof context.contentMap === 'object') {
        const contentKeys = Object.keys(context.contentMap)
        if (contentKeys.length > 0) {
          contextString += `\n\nDocument Content:\n`
          
          // Include actual content from sections
          // Match content IDs with structure items to get section names
          const structureById: Record<string, any> = {}
          if (context.structureItems) {
            context.structureItems.forEach((item: any) => {
              structureById[item.id] = item
            })
          }
          
          // Add content for each section (limit to prevent token overflow)
          let contentCount = 0
          const maxSections = 10 // Don't overwhelm the context
          
          for (const [sectionId, content] of Object.entries(context.contentMap)) {
            if (contentCount >= maxSections) break
            if (!content || typeof content !== 'string') continue
            
            const section = structureById[sectionId]
            const sectionName = section ? section.name : sectionId
            
            // Truncate very long content
            const contentPreview = content.length > 500 
              ? content.substring(0, 500) + '...[truncated]'
              : content
            
            contextString += `\n### ${sectionName}:\n${contentPreview}\n`
            contentCount++
          }
          
          contextString += `\n(Total: ${contentKeys.length} sections with content)`
        }
      }
    }
    
    // Construct prompt for answering
    const systemPrompt = `You are an intelligent writing assistant helping authors with their creative work.
You have access to the story structure and content, and your job is to answer questions thoughtfully and helpfully.
Be conversational, insightful, and provide actionable suggestions when appropriate.`
    
    const userPrompt = `${contextString ? `Context:${contextString}\n\n` : ''}Question: ${question}

Please answer this question based on the available context. Be helpful and specific.`
    
    console.log('[API /content/answer] Step 8: Configuring model parameters')
    // Detect if this is a reasoning model (o1, gpt-5, etc.) that restricts parameters
    const isReasoningModel = orchestratorModelId.toLowerCase().includes('o1') || 
                             orchestratorModelId.toLowerCase().includes('gpt-5')
    
    console.log('[API /content/answer] Model type:', {
      model: orchestratorModelId,
      isReasoningModel,
      willUseTemperature: !isReasoningModel
    })
    
    // Build generation options (reasoning models don't support custom temperature)
    const generateOptions: any = {
      model: orchestratorModelId,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      max_tokens: 1000
    }
    
    // Only add temperature for non-reasoning models
    if (!isReasoningModel) {
      generateOptions.temperature = 0.7
    }
    
    console.log('[API /content/answer] Calling generateStream with options:', {
      model: orchestratorModelId,
      hasApiKey: !!apiKey,
      optionsKeys: Object.keys(generateOptions)
    })
    
    // Generate answer using provider adapter with streaming
    // ✅ FIX: Wrap in try-catch to handle stream creation errors
    let asyncGenerator: AsyncGenerator<any>
    try {
      asyncGenerator = adapter.generateStream(apiKey, generateOptions)
      console.log('[API /content/answer] Async generator created successfully')
    } catch (streamError) {
      console.error('[API /content/answer] Stream creation failed:', streamError)
      return NextResponse.json(
        { 
          error: streamError instanceof Error ? streamError.message : 'Failed to create response stream',
          details: 'The model may not support streaming or the configuration is invalid.'
        },
        { status: 500 }
      )
    }
    
    console.log('[API /content/answer] Step 9: Converting async generator to ReadableStream')
    
    // ✅ FIX: Convert async generator (yields objects) to ReadableStream (emits text)
    const textStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of asyncGenerator) {
            // Extract text from the object based on chunk type
            if (chunk.type === 'content' && chunk.content) {
              // Emit plain text (not object)
              controller.enqueue(new TextEncoder().encode(chunk.content))
            } else if (chunk.type === 'done') {
              // Stream complete
              controller.close()
              return
            } else if (chunk.type === 'error') {
              // Handle error
              controller.error(new Error(chunk.error || 'Stream error'))
              return
            }
          }
          // Generator exhausted
          controller.close()
        } catch (error) {
          console.error('[API /content/answer] Stream error:', error)
          controller.error(error)
        }
      }
    })
    
    console.log('[API /content/answer] Returning streaming response')
    
    // Return streaming response as plain text stream (not SSE)
    return new Response(textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    })
    
  } catch (error) {
    console.error('[API /content/answer] ===== CAUGHT ERROR =====')
    console.error('[API /content/answer] Error type:', error?.constructor?.name)
    console.error('[API /content/answer] Error message:', error instanceof Error ? error.message : String(error))
    console.error('[API /content/answer] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[API /content/answer] ===========================')
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to answer question',
        type: error?.constructor?.name || 'UnknownError'
      },
      { status: 500 }
    )
  }
}

