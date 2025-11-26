/**
 * API Route: /api/agent/save-content
 * 
 * Server-side endpoint for agents to save generated content.
 * Uses service role to bypass RLS restrictions.
 */

import { createClient } from '@/lib/supabase/server'
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

    // Create Supabase client with server-side auth
    const supabase = await createClient()

    // Verify user is authenticated
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

    // 🔍 WORKAROUND: Query stories first to establish ownership context
    // Then query nodes - RLS might allow queries when user owns related story
    console.log('📡 [API /api/agent/save-content] Step 1: Fetching all user stories...')
    
    const { data: userStories, error: storiesError } = await supabase
      .from('stories')
      .select('id')
      .eq('user_id', userId)

    if (storiesError || !userStories || userStories.length === 0) {
      console.error('❌ [API /api/agent/save-content] Failed to fetch user stories:', storiesError)
      return NextResponse.json(
        { success: false, error: 'No stories found for user' },
        { status: 404 }
      )
    }

    const storyIds = userStories.map(s => s.id)
    console.log(`✅ [API /api/agent/save-content] Found ${storyIds.length} stories owned by user`)

    // Step 2: Fetch node filtered by user's story IDs
    console.log('📡 [API /api/agent/save-content] Step 2: Fetching node...')
    
    const { data: node, error: fetchError } = await supabase
      .from('nodes')
      .select('id, document_data, story_id')
      .eq('id', storyStructureNodeId)
      .in('story_id', storyIds) // Only nodes from user's stories
      .single()

    if (fetchError || !node) {
      console.error('❌ [API /api/agent/save-content] Failed to fetch node:', {
        error: fetchError,
        nodeId: storyStructureNodeId,
        userStoryIds: storyIds
      })
      return NextResponse.json(
        { success: false, error: `Node not found or unauthorized: ${fetchError?.message || 'Unknown error'}` },
        { status: fetchError?.code === 'PGRST116' ? 403 : 404 }
      )
    }

    console.log('✅ [API /api/agent/save-content] Node fetched and ownership verified:', {
      nodeId: node.id,
      storyId: node.story_id
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

    // Save back to Supabase
    const { error: updateError } = await supabase
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

