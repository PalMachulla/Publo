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
    const { 
      segmentId, 
      prompt, 
      storyStructureNodeId,
      structureItems = [],
      contentMap = {},
      format
    } = await request.json()
    
    if (!segmentId || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: segmentId, prompt' },
        { status: 400 }
      )
    }
    
    console.log('[API /content/generate] Request:', { 
      segmentId, 
      prompt, 
      storyStructureNodeId,
      structureItemsCount: structureItems.length,
      contentMapSize: Object.keys(contentMap).length,
      format
    })
    
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
      console.error('[API /content/generate] Could not detect provider for model:', writerModelId)
      return NextResponse.json(
        { error: `Could not detect provider for model: ${writerModelId}` },
        { status: 400 }
      )
    }
    
    console.log('[API /content/generate] Detected provider:', provider)
    
    // Get user's API key for this provider
    const { data: userKey, error: keyError } = await supabase
      .from('user_api_keys')
      .select('id, encrypted_key, provider, is_active, validation_status, nickname')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('is_active', true)
      .eq('validation_status', 'valid')
      .limit(1)
      .single()
    
    console.log('[API /content/generate] User key query result:', { 
      found: !!userKey, 
      error: keyError?.message,
      provider 
    })
    
    if (!userKey) {
      console.error('[API /content/generate] No API key found:', {
        provider,
        userId: user.id,
        keyError: keyError?.message
      })
      return NextResponse.json(
        { 
          error: `No ${provider.toUpperCase()} API key found. Please add your key at /settings/api-keys`,
          provider,
          details: keyError?.message
        },
        { status: 400 }
      )
    }
    
    // Decrypt the API key
    console.log('[API /content/generate] Decrypting API key...')
    let apiKey: string
    try {
      apiKey = decryptAPIKey(userKey.encrypted_key)
      console.log('[API /content/generate] API key decrypted successfully')
    } catch (decryptError) {
      console.error('[API /content/generate] Failed to decrypt API key:', decryptError)
      throw new Error(`Failed to decrypt API key: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`)
    }
    
    // Get provider adapter
    console.log('[API /content/generate] Getting provider adapter for:', provider)
    const adapter = getProviderAdapter(provider)
    
    // BUILD STRATEGIC CONTEXT FOR WRITER (orchestrator's instructions)
    // Find the target segment in structure
    const targetSegment = structureItems.find((item: any) => item.id === segmentId)
    const targetIndex = structureItems.findIndex((item: any) => item.id === segmentId)
    
    // Build context sections
    let contextSections = ''
    
    // 1. BEFORE: What has happened (previous segments)
    const previousSegments = structureItems.slice(0, targetIndex)
    if (previousSegments.length > 0) {
      contextSections += `\n\n=== WHAT HAS HAPPENED (Before this segment) ===\n`
      previousSegments.forEach((item: any) => {
        const content = contentMap[item.id]
        if (content) {
          // Truncate long content, show full summaries
          const preview = content.length > 300 
            ? content.substring(0, 300) + '...[continues]'
            : content
          contextSections += `\n${item.name}: ${preview}\n`
        }
      })
    }
    
    // 2. CURRENT: What should happen (target segment summary)
    if (targetSegment?.summary) {
      contextSections += `\n\n=== YOUR WRITING GOAL (This segment) ===\n`
      contextSections += `${targetSegment.name}: ${targetSegment.summary}\n`
      contextSections += `\nUser's specific instruction: ${prompt}\n`
    }
    
    // 3. AFTER: What will happen (future segments)
    const futureSegments = structureItems.slice(targetIndex + 1)
    if (futureSegments.length > 0) {
      contextSections += `\n\n=== WHAT WILL HAPPEN (After this segment) ===\n`
      contextSections += `You should subtly foreshadow or set up for these future events:\n`
      futureSegments.slice(0, 5).forEach((item: any) => {
        if (item.summary) {
          contextSections += `\n${item.name}: ${item.summary}\n`
        }
      })
    }
    
    // Construct strategic writing prompt
    const systemPrompt = `You are a professional writer working under the direction of a master storyteller (the orchestrator).
The orchestrator has planned the entire story structure and is providing you with full context.

Your job: Write compelling narrative content for ONE specific segment, maintaining coherence with what came before and setting up what comes after.

Guidelines:
- Match the tone and style of the ${format || 'story'}
- Create vivid scenes, compelling dialogue, and meaningful character development
- Reference events from previous segments naturally
- Subtly foreshadow or set up future events when appropriate
- Stay true to the orchestrator's plan (the summaries)
- Be creative within the constraints`
    
    const userPrompt = `${contextSections}

=== YOUR TASK ===
Write detailed, engaging content for "${targetSegment?.name || segmentId}".
Follow the orchestrator's plan above, maintaining story coherence.

Now write the content:`
    
    console.log('[API /content/generate] Calling provider API...', {
      provider,
      model: writerModelId,
      maxTokens: 2000
    })
    
    // Detect if this is a reasoning model (o1, gpt-5, etc.) that restricts parameters
    const isReasoningModel = writerModelId.toLowerCase().includes('o1') || 
                             writerModelId.toLowerCase().includes('gpt-5')
    
    // Build generation options (reasoning models don't support custom temperature)
    const generateOptions: any = {
      model: writerModelId,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      max_tokens: 2000
    }
    
    // Only add temperature for non-reasoning models
    if (!isReasoningModel) {
      generateOptions.temperature = 0.8
    }
    
    // Generate content using provider adapter
    const result = await adapter.generate(apiKey, generateOptions)
    
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

