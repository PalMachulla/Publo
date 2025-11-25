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
    const { question, context } = await request.json()
    
    if (!question) {
      return NextResponse.json(
        { error: 'Missing required field: question' },
        { status: 400 }
      )
    }
    
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
    
    // Get configured orchestrator directly from user_api_keys
    // This respects the selection made in the CreateStoryPanel dropdown
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
        console.log('[API /content/answer] Fallback successful: Using default Llama 3.3')
      } else {
        // No keys at all?
        return NextResponse.json(
          { error: 'No active API keys found. Please add an API key in Settings -> API Keys.' },
          { status: 400 }
        )
      }
    }
    
    // Decrypt the API key
    const apiKey = decryptAPIKey(userKey.encrypted_key)

    
    // Get provider adapter
    const adapter = getProviderAdapter(provider)
    
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
    let stream: ReadableStream
    try {
      stream = await adapter.generateStream(apiKey, generateOptions)
      console.log('[API /content/answer] Stream created successfully')
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
    
    console.log('[API /content/answer] Returning streaming response')
    
    // Return streaming response as plain text stream (not SSE)
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    })
    
  } catch (error) {
    console.error('[API /content/answer] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to answer question' },
      { status: 500 }
    )
  }
}

