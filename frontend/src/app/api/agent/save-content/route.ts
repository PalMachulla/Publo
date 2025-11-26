/**
 * API Route: /api/agent/save-content
 * 
 * Server-side endpoint for agents to save generated content.
 * Uses TWO clients: regular client for auth, admin client for data access.
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DocumentManager } from '@/lib/document/DocumentManager'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { storyStructureNodeId, sectionId, content, userId } = await request.json()

    console.log('📡 [API /api/agent/save-content] Request received:', {
      nodeId: storyStructureNodeId,
      sectionId,
      userId,
      contentLength: content?.length || 0
    })

    // Validate input
    if (!storyStructureNodeId || !sectionId || !content || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // STEP 1: Verify user authentication (using regular client)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('❌ [API /api/agent/save-content] Unauthorized: No user session')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.id !== userId) {
      console.error('❌ [API /api/agent/save-content] Forbidden: User ID mismatch')
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    console.log('✅ [API /api/agent/save-content] User authenticated:', user.id)

    // STEP 2: Verify ownership using regular client (respects RLS)
    console.log('🔐 [API /api/agent/save-content] Verifying story ownership...')
    const { data: nodeOwnership, error: ownershipError } = await supabase
      .from('nodes')
      .select('story_id')
      .eq('id', storyStructureNodeId)
      .single()

    if (ownershipError || !nodeOwnership) {
      console.error('❌ [API /api/agent/save-content] Node not found or access denied:', ownershipError)
      return NextResponse.json(
        { success: false, error: 'Node not found or you do not have access' },
        { status: 403 }
      )
    }

    // Verify user owns the story
    const { data: storyOwnership, error: storyError } = await supabase
      .from('stories')
      .select('user_id')
      .eq('id', nodeOwnership.story_id)
      .single()

    if (storyError || !storyOwnership || storyOwnership.user_id !== userId) {
      console.error('❌ [API /api/agent/save-content] User does not own this story')
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this story' },
        { status: 403 }
      )
    }

    console.log('✅ [API /api/agent/save-content] Ownership verified')

    // STEP 3: Fetch and update using ADMIN client (bypasses RLS after auth check)
    console.log('📡 [API /api/agent/save-content] Using admin client to fetch node data...')
    const adminClient = createAdminClient()
    
    const { data: node, error: fetchError } = await adminClient
      .from('nodes')
      .select('id, document_data, story_id')
      .eq('id', storyStructureNodeId)
      .single()

    if (fetchError || !node) {
      console.error('❌ [API /api/agent/save-content] Failed to fetch node with admin client:', fetchError)
      return NextResponse.json(
        { success: false, error: `Failed to fetch node: ${fetchError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log('✅ [API /api/agent/save-content] Node fetched successfully')

    // Update content using DocumentManager
    const docManager = new DocumentManager(node.document_data)
    const updateSuccess = docManager.updateContent(sectionId, content)

    if (!updateSuccess) {
      console.error('❌ [API /api/agent/save-content] Section not found in document')
      return NextResponse.json(
        { success: false, error: `Section ${sectionId} not found in document` },
        { status: 404 }
      )
    }

    const updatedData = docManager.getData()

    // STEP 4: Save back to Supabase using admin client (bypasses RLS)
    console.log('💾 [API /api/agent/save-content] Saving updated content with admin client...')
    const { error: updateError } = await adminClient
      .from('nodes')
      .update({ document_data: updatedData })
      .eq('id', storyStructureNodeId)

    if (updateError) {
      console.error('❌ [API /api/agent/save-content] Failed to update node:', updateError)
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    const wordCount = content.trim().split(/\s+/).length

    console.log('✅ [API /api/agent/save-content] Content saved successfully:', {
      sectionId,
      wordCount,
      totalWordCount: updatedData.totalWordCount
    })

    return NextResponse.json({
      success: true,
      wordCount: updatedData.totalWordCount
    })

  } catch (error) {
    console.error('❌ [API /api/agent/save-content] Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

