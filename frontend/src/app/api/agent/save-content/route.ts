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

    // STEP 1.5: PRE-CHECK - Does the node exist at all? (using maybeSingle to avoid errors)
    console.log('🔍 [API /api/agent/save-content] PRE-CHECK: Verifying node exists...')
    const preCheckClient = createAdminClient()
    const { data: preCheckNode, error: preCheckError } = await preCheckClient
      .from('nodes')
      .select('id, type, story_id, created_at')
      .eq('id', storyStructureNodeId)
      .maybeSingle()
    
    console.log('📊 [API /api/agent/save-content] PRE-CHECK result:', {
      nodeId: storyStructureNodeId,
      found: !!preCheckNode,
      nodeType: preCheckNode?.type,
      storyId: preCheckNode?.story_id,
      createdAt: preCheckNode?.created_at,
      error: preCheckError,
      diagnosis: preCheckNode 
        ? `✅ Node exists (type: ${preCheckNode.type})` 
        : `❌ NODE NOT IN DATABASE! Query returned 0 rows.`
    })
    
    if (!preCheckNode) {
      console.error('❌ [API /api/agent/save-content] FATAL: Node does not exist in database!')
      console.error('   This means either:')
      console.error('   1. Node was never created (UPSERT failed silently)')
      console.error('   2. Node ID format is wrong')
      console.error('   3. Node was deleted/rolled back')
      
      // List recent nodes to help debug
      const { data: recentNodes } = await preCheckClient
        .from('nodes')
        .select('id, type, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      
      console.log('📋 [API /api/agent/save-content] Recent nodes in database:', {
        count: recentNodes?.length || 0,
        nodeIds: recentNodes?.map(n => ({ id: n.id, type: n.type, created: n.created_at })) || []
      })
    }

    // STEP 2: Use ADMIN client to fetch node + verify ownership
    // (Regular client blocked by RLS because auth.uid() is NULL in Next.js API routes)
    console.log('📡 [API /api/agent/save-content] Using admin client to fetch node data...')
    const adminClient = createAdminClient()
    
    // ✅ DEBUG: Verify admin client is using service_role key
    console.log('🔑 [API /api/agent/save-content] Admin client check:', {
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceRolePrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...',
      queryDetails: {
        table: 'nodes',
        filter: `id=eq.${storyStructureNodeId}`,
        expectedBehavior: 'SERVICE_ROLE should bypass ALL RLS policies'
      }
    })
    
    const { data: node, error: fetchError } = await adminClient
      .from('nodes')
      .select('id, document_data, story_id')
      .eq('id', storyStructureNodeId)
      .single()

    if (fetchError || !node) {
      console.error('❌ [API /api/agent/save-content] Failed to fetch node:', fetchError)
      return NextResponse.json(
        { success: false, error: `Node not found: ${fetchError?.message || 'Unknown error'}` },
        { status: 404 }
      )
    }

    console.log('✅ [API /api/agent/save-content] Node fetched:', {
      nodeId: node.id,
      storyId: node.story_id
    })

    // STEP 3: Verify user owns the story (security check using admin client)
    console.log('🔐 [API /api/agent/save-content] Verifying story ownership...')
    const { data: story, error: storyError } = await adminClient
      .from('stories')
      .select('user_id')
      .eq('id', node.story_id)
      .single()

    if (storyError || !story) {
      console.error('❌ [API /api/agent/save-content] Story not found:', storyError)
      return NextResponse.json(
        { success: false, error: 'Story not found' },
        { status: 404 }
      )
    }

    if (story.user_id !== userId) {
      console.error('❌ [API /api/agent/save-content] Ownership verification failed:', {
        storyUserId: story.user_id,
        requestUserId: userId,
        match: false
      })
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not own this story' },
        { status: 403 }
      )
    }

    console.log('✅ [API /api/agent/save-content] Ownership verified:', {
      userId: story.user_id,
      match: true
    })

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

