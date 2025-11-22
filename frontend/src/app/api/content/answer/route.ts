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
    
    console.log('[API /content/answer] Request:', { question, hasContext: !!context })
    
    // Get orchestrator model preference
    const { data: preferences } = await supabase
      .from('model_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    const orchestratorModelId = preferences?.orchestrator_model || 'llama-3.3-70b-versatile'
    
    console.log('[API /content/answer] Using orchestrator model:', orchestratorModelId)
    
    // Detect provider from model ID
    const provider = detectProviderFromModel(orchestratorModelId)
    if (!provider) {
      return NextResponse.json(
        { error: `Could not detect provider for model: ${orchestratorModelId}` },
        { status: 400 }
      )
    }
    
    // Get user's API key for this provider
    const { data: userKey } = await supabase
      .from('user_api_keys')
      .select('id, encrypted_key, provider, is_active, validation_status, nickname')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('is_active', true)
      .eq('validation_status', 'valid')
      .limit(1)
      .single()
    
    if (!userKey) {
      return NextResponse.json(
        { 
          error: `No ${provider.toUpperCase()} API key found. Please add your key at /settings/api-keys`,
          provider
        },
        { status: 400 }
      )
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
          contextString += `\n\nAvailable Content: ${contentKeys.length} segments with written content`
        }
      }
    }
    
    // Construct prompt for answering
    const systemPrompt = `You are an intelligent writing assistant helping authors with their creative work.
You have access to the story structure and content, and your job is to answer questions thoughtfully and helpfully.
Be conversational, insightful, and provide actionable suggestions when appropriate.`
    
    const userPrompt = `${contextString ? `Context:${contextString}\n\n` : ''}Question: ${question}

Please answer this question based on the available context. Be helpful and specific.`
    
    // Generate answer using provider adapter
    const result = await adapter.generate(apiKey, {
      model: orchestratorModelId,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      max_tokens: 1000,
      temperature: 0.7
    })
    
    console.log('[API /content/answer] Generated answer length:', result.content.length)
    
    return NextResponse.json({
      success: true,
      answer: result.content
    })
    
  } catch (error) {
    console.error('[API /content/answer] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to answer question' },
      { status: 500 }
    )
  }
}

