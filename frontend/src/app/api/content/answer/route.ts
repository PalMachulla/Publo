/**
 * API Route: Answer Question
 * 
 * This endpoint uses the orchestrator model to answer questions about the story content.
 * It has access to the full context (structure, content map, active segment).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
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
    
    // TODO: Fetch user's API keys and model preferences
    const { data: apiKeys } = await supabase
      .from('user_api_keys')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true)
    
    if (!apiKeys || apiKeys.length === 0) {
      return NextResponse.json(
        { error: 'No API keys configured. Please add an API key in your profile settings.' },
        { status: 400 }
      )
    }
    
    // Get orchestrator model preference
    const { data: preferences } = await supabase
      .from('model_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    const orchestratorModelId = preferences?.orchestrator_model || 'llama-3.3-70b-versatile'
    
    console.log('[API /content/answer] Using orchestrator model:', orchestratorModelId)
    
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
    
    // Call the provider's API
    const providerKey = apiKeys[0] // TODO: Select correct provider based on model
    
    let answer = ''
    
    // Determine provider from model ID
    if (orchestratorModelId.includes('gpt')) {
      // OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerKey.key_value}`
        },
        body: JSON.stringify({
          model: orchestratorModelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      answer = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'
      
    } else if (orchestratorModelId.includes('claude')) {
      // Anthropic
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': providerKey.key_value,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: orchestratorModelId,
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ]
        })
      })
      
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      answer = data.content[0]?.text || 'I apologize, but I was unable to generate a response.'
      
    } else {
      // Default to Groq
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerKey.key_value}`
        },
        body: JSON.stringify({
          model: orchestratorModelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      })
      
      if (!response.ok) {
        throw new Error(`Groq API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      answer = data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'
    }
    
    console.log('[API /content/answer] Generated answer length:', answer.length)
    
    return NextResponse.json({
      success: true,
      answer
    })
    
  } catch (error) {
    console.error('[API /content/answer] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to answer question' },
      { status: 500 }
    )
  }
}

