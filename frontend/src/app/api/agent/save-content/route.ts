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

    // Fetch current document_data
    console.log('📡 [API /api/agent/save-content] Fetching node from Supabase...')
    const { data: node, error: fetchError } = await supabase
      .from('nodes')
      .select('document_data, story_id')
      .eq('id', storyStructureNodeId)
      .single()

    if (fetchError || !node) {
      console.error('❌ [API /api/agent/save-content] Failed to fetch node:', fetchError)
      return NextResponse.json(
        { success: false, error: `Node not found: ${fetchError?.message || 'Unknown error'}` },
        { status: 404 }
      )
    }

    console.log('✅ [API /api/agent/save-content] Node fetched successfully')

    // Verify user owns the story (additional security check)
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('user_id')
      .eq('id', node.story_id)
      .single()

    if (storyError || !story || story.user_id !== userId) {
      console.error('❌ [API /api/agent/save-content] Story ownership check failed')
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not own this story' },
        { status: 403 }
      )
    }

    console.log('✅ [API /api/agent/save-content] Ownership verified')

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

