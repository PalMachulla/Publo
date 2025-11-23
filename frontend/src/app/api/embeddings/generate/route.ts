/**
 * API Route: /api/embeddings/generate
 * Generates embeddings for a document section or entire story structure
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processSingleSection, processStoryStructureNode, estimateEmbeddingCost } from '@/lib/embeddings/embeddingPipeline'
import { StoryStructureItem } from '@/types/document'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { mode, documentSectionId, nodeId, sections } = body

    // Mode: 'single' or 'batch'
    if (mode === 'single') {
      // Generate embeddings for a single document section
      if (!documentSectionId || !nodeId) {
        return NextResponse.json(
          { error: 'Missing documentSectionId or nodeId' },
          { status: 400 }
        )
      }

      // Get document section
      const { data: sectionData, error: sectionError } = await supabase
        .from('document_sections')
        .select('content, structure_item_id, story_structure_node_id')
        .eq('id', documentSectionId)
        .single()

      if (sectionError || !sectionData) {
        return NextResponse.json(
          { error: 'Document section not found' },
          { status: 404 }
        )
      }

      // Verify ownership
      const { data: nodeData, error: nodeError } = await supabase
        .from('nodes')
        .select('story_id, stories!inner(user_id)')
        .eq('id', sectionData.story_structure_node_id)
        .single()

      if (nodeError || !nodeData || (nodeData.stories as { user_id: string }).user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to this document' },
          { status: 403 }
        )
      }

      // Create minimal structure item
      const structureItem: StoryStructureItem = {
        id: sectionData.structure_item_id,
        level: 0,
        type: 'scene',
        content: sectionData.content,
      }

      const result = await processSingleSection(
        documentSectionId,
        sectionData.content,
        structureItem,
        nodeId
      )

      return NextResponse.json({
        success: result.success,
        chunksCreated: result.chunksCreated,
        totalTokens: result.totalTokens,
        error: result.error,
      })
    } else if (mode === 'batch') {
      // Generate embeddings for entire story structure
      if (!nodeId || !sections || !Array.isArray(sections)) {
        return NextResponse.json(
          { error: 'Missing nodeId or sections array' },
          { status: 400 }
        )
      }

      // Verify ownership of the node
      const { data: nodeData, error: nodeError } = await supabase
        .from('nodes')
        .select('story_id, stories!inner(user_id)')
        .eq('id', nodeId)
        .single()

      if (nodeError || !nodeData || (nodeData.stories as { user_id: string }).user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to this story' },
          { status: 403 }
        )
      }

      const result = await processStoryStructureNode(nodeId, sections)

      return NextResponse.json({
        success: result.success,
        totalSections: result.totalSections,
        successfulSections: result.successfulSections,
        totalChunks: result.totalChunks,
        totalTokens: result.totalTokens,
        errors: result.errors,
      })
    } else if (mode === 'estimate') {
      // Estimate cost without generating embeddings
      if (!sections || !Array.isArray(sections)) {
        return NextResponse.json(
          { error: 'Missing sections array' },
          { status: 400 }
        )
      }

      const estimate = await estimateEmbeddingCost(sections)

      return NextResponse.json({
        totalTokens: estimate.totalTokens,
        estimatedCost: estimate.estimatedCost,
        estimatedTimeSeconds: estimate.estimatedTimeSeconds,
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "single", "batch", or "estimate"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Embedding generation error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET: Check embedding status for a node
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')

    if (!nodeId) {
      return NextResponse.json(
        { error: 'Missing nodeId parameter' },
        { status: 400 }
      )
    }

    // Get embedding count (handle case where table doesn't exist)
    const { count: embeddingCount, error: countError } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('story_structure_node_id', nodeId)
      .eq('embedding_status', 'completed')

    // If table doesn't exist or other error, return unavailable status
    if (countError) {
      console.warn('Embeddings table not available:', countError.message)
      return NextResponse.json({
        exists: false,
        chunkCount: 0,
        queueStatus: 'unavailable',
        error: 'Embeddings feature not set up. Run migration 013_create_document_embeddings.sql',
      })
    }

    // Get queue status (don't use .single() as it throws error if no rows)
    const { data: queueData, error: queueError } = await supabase
      .from('embedding_queue')
      .select('status, created_at, processed_at')
      .eq('story_structure_node_id', nodeId)
      .order('created_at', { ascending: false })
      .limit(1)

    // Ignore queue errors (queue table might not exist yet)
    if (queueError) {
      console.warn('Embedding queue table not available:', queueError.message)
    }

    // Get first item from array (or null if no queue entries)
    const latestQueueEntry = queueData && queueData.length > 0 ? queueData[0] : null

    return NextResponse.json({
      exists: embeddingCount !== null && embeddingCount > 0,
      chunkCount: embeddingCount || 0,
      queueStatus: latestQueueEntry?.status || 'none',
      queuedAt: latestQueueEntry?.created_at,
      processedAt: latestQueueEntry?.processed_at,
    })
  } catch (error) {
    console.error('Error checking embedding status:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

