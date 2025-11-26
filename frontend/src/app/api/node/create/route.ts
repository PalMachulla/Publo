/**
 * API Route: /api/node/create
 * 
 * Server-side endpoint for creating story structure nodes.
 * Uses admin client to bypass RLS INSERT policy issues.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { nodeId, storyId, nodeType, data, documentData, positionX, positionY, userId } = await request.json()

    console.log('📥 [API /api/node/create] Request received:', {
      nodeId,
      storyId,
      nodeType,
      userId,
      hasData: !!data,
      hasDocumentData: !!documentData,
      position: { x: positionX, y: positionY }
    })

    // Validate input
    if (!nodeId || !storyId || !nodeType || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // STEP 1: Verify user authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== userId) {
      console.error('❌ [API /api/node/create] Unauthorized')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('✅ [API /api/node/create] User authenticated:', user.id)

    // STEP 2: Verify user owns the story
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('user_id')
      .eq('id', storyId)
      .single()
    
    if (storyError || !story || story.user_id !== userId) {
      console.error('❌ [API /api/node/create] Story not found or unauthorized')
      return NextResponse.json(
        { success: false, error: 'Story not found or unauthorized' },
        { status: 403 }
      )
    }

    console.log('✅ [API /api/node/create] Story ownership verified')

    // STEP 3: Use ADMIN client to create node (bypasses RLS INSERT policy)
    console.log('📡 [API /api/node/create] Using admin client to UPSERT node...')
    const adminClient = createAdminClient()
    
    const nodePayload = {
      id: nodeId,
      story_id: storyId,
      type: nodeType,
      data: data || {},
      document_data: documentData || null,
      position_x: positionX || 0,
      position_y: positionY || 0
    }

    console.log('📦 [API /api/node/create] UPSERT payload:', {
      nodeId: nodePayload.id,
      storyId: nodePayload.story_id,
      type: nodePayload.type,
      hasDocumentData: !!nodePayload.document_data
    })

    const { data: upsertedNode, error: upsertError } = await adminClient
      .from('nodes')
      .upsert(nodePayload, { onConflict: 'id' })
      .select()
      .single()

    if (upsertError) {
      console.error('❌ [API /api/node/create] UPSERT failed:', upsertError)
      return NextResponse.json(
        { success: false, error: upsertError.message },
        { status: 500 }
      )
    }

    console.log('✅ [API /api/node/create] Node created successfully:', upsertedNode.id)

    // STEP 4: Verify node exists (paranoid check)
    const { data: verifyNode, error: verifyError } = await adminClient
      .from('nodes')
      .select('id, type')
      .eq('id', nodeId)
      .maybeSingle()
    
    if (verifyError || !verifyNode) {
      console.error('❌ [API /api/node/create] CRITICAL: Node created but not queryable!', {
        verifyError,
        nodeId
      })
      return NextResponse.json(
        { success: false, error: 'Node created but verification failed' },
        { status: 500 }
      )
    }

    console.log('✅ [API /api/node/create] Node verified and persisted:', verifyNode.id)

    return NextResponse.json({
      success: true,
      nodeId: verifyNode.id,
      nodeType: verifyNode.type
    })

  } catch (error) {
    console.error('❌ [API /api/node/create] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

