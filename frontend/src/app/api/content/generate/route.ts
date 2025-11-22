/**
 * API Route: Generate Content for Segment
 * 
 * This endpoint generates content for a specific segment/section in the document.
 * It uses the writer model (not orchestrator) to produce narrative content.
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
    const { segmentId, prompt, storyStructureNodeId } = await request.json()
    
    if (!segmentId || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: segmentId, prompt' },
        { status: 400 }
      )
    }
    
    console.log('[API /content/generate] Request:', { segmentId, prompt, storyStructureNodeId })
    
    // Get writer model preference
    const { data: preferences } = await supabase
      .from('model_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    const writerModelId = preferences?.writer_models?.[0] || 'llama-3.3-70b-versatile'
    
    console.log('[API /content/generate] Using writer model:', writerModelId)
    
    // Detect provider from model ID
    const provider = detectProviderFromModel(writerModelId)
    if (!provider) {
      return NextResponse.json(
        { error: `Could not detect provider for model: ${writerModelId}` },
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
    
    // Construct writing prompt
    const systemPrompt = `You are a professional writer tasked with generating high-quality narrative content.
Write engaging, descriptive content that matches the tone and style requested by the user.
Focus on creating vivid scenes, compelling dialogue, and meaningful character development.`
    
    const userPrompt = `Generate content for the following segment:

Segment ID: ${segmentId}
User Request: ${prompt}

Write compelling narrative content that fulfills this request. Be creative and engaging.`
    
    // Generate content using provider adapter
    const result = await adapter.generate(apiKey, {
      model: writerModelId,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      max_tokens: 2000,
      temperature: 0.8
    })
    
    console.log('[API /content/generate] Generated content length:', result.content.length)
    
    return NextResponse.json({
      success: true,
      content: result.content,
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

