/**
 * API Route: Generate Content for Segment
 * 
 * This endpoint generates content for a specific segment/section in the document.
 * It uses the writer model (not orchestrator) to produce narrative content.
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
    const { segmentId, prompt, storyStructureNodeId } = await request.json()
    
    if (!segmentId || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: segmentId, prompt' },
        { status: 400 }
      )
    }
    
    console.log('[API /content/generate] Request:', { segmentId, prompt, storyStructureNodeId })
    
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
    
    // Get writer model preference
    const { data: preferences } = await supabase
      .from('model_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    const writerModelId = preferences?.writer_models?.[0] || 'llama-3.3-70b-versatile'
    
    console.log('[API /content/generate] Using writer model:', writerModelId)
    
    // Construct writing prompt
    const systemPrompt = `You are a professional writer tasked with generating high-quality narrative content.
Write engaging, descriptive content that matches the tone and style requested by the user.
Focus on creating vivid scenes, compelling dialogue, and meaningful character development.`
    
    const userPrompt = `Generate content for the following segment:

Segment ID: ${segmentId}
User Request: ${prompt}

Write compelling narrative content that fulfills this request. Be creative and engaging.`
    
    // Call the provider's API (this is a simplified version - in production, route based on model provider)
    const providerKey = apiKeys[0] // TODO: Select correct provider based on model
    
    let generatedContent = ''
    
    // Determine provider from model ID
    if (writerModelId.includes('gpt')) {
      // OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerKey.key_value}`
        },
        body: JSON.stringify({
          model: writerModelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 2000
        })
      })
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      generatedContent = data.choices[0]?.message?.content || ''
      
    } else if (writerModelId.includes('claude')) {
      // Anthropic
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': providerKey.key_value,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: writerModelId,
          max_tokens: 2000,
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
      generatedContent = data.content[0]?.text || ''
      
    } else {
      // Default to Groq
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerKey.key_value}`
        },
        body: JSON.stringify({
          model: writerModelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 2000
        })
      })
      
      if (!response.ok) {
        throw new Error(`Groq API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      generatedContent = data.choices[0]?.message?.content || ''
    }
    
    console.log('[API /content/generate] Generated content length:', generatedContent.length)
    
    return NextResponse.json({
      success: true,
      content: generatedContent,
      segmentId
    })
    
  } catch (error) {
    console.error('[API /content/generate] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate content' },
      { status: 500 }
    )
  }
}

