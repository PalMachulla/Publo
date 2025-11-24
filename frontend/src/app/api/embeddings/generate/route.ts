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
    const supabase = await createClient()

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

      if (nodeError || !nodeData || (nodeData.stories as any)?.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to this document' },
          { status: 403 }
        )
      }

      // Create minimal structure item
      const structureItem: StoryStructureItem = {
        id: sectionData.structure_item_id,
        level: 0,
        name: 'Section',
        order: 0,
        content: sectionData.content,
      }

      const result = await processSingleSection(
        supabase,
        user.id,
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

      if (nodeError || !nodeData || (nodeData.stories as any)?.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to this story' },
          { status: 403 }
        )
      }

      // Try to generate embeddings (may fail if tables don't exist)
      try {
        const result = await processStoryStructureNode(supabase, user.id, nodeId, sections)

        return NextResponse.json({
          success: result.success,
          totalSections: result.totalSections,
          successfulSections: result.successfulSections,
          totalChunks: result.totalChunks,
          totalTokens: result.totalTokens,
          errors: result.errors,
        })
      } catch (embeddingError) {
        // Check if error is due to missing tables
        const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError)
        if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Embeddings feature not set up',
              details: 'Database tables do not exist. Please run migration: 013_create_document_embeddings.sql',
              hint: 'Go to Supabase → SQL Editor → Paste and run the migration file'
            },
            { status: 503 } // Service Unavailable
          )
        }
        // Re-throw other errors
        throw embeddingError
      }
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
    // Early return with cached response to prevent excessive calls
    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')

    if (!nodeId) {
      return NextResponse.json(
        { error: 'Missing nodeId parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

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

    // Get embedding count (handle case where table doesn't exist)
    const { count: embeddingCount, error: countError } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('story_structure_node_id', nodeId)
      .eq('embedding_status', 'completed')

    // If table doesn't exist or other error, return unavailable status
    if (countError) {
      console.warn('Embeddings table not available:', countError.message)
      const response = NextResponse.json({
        exists: false,
        chunkCount: 0,
        queueStatus: 'unavailable',
        error: 'Embeddings feature not set up. Run migration 013_create_document_embeddings.sql',
      })
      // Cache error response to prevent repeated failed calls
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
      return response
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

    const response = NextResponse.json({
      exists: embeddingCount !== null && embeddingCount > 0,
      chunkCount: embeddingCount || 0,
      queueStatus: latestQueueEntry?.status || 'none',
      queuedAt: latestQueueEntry?.created_at,
      processedAt: latestQueueEntry?.processed_at,
    })

    // Cache response for 60 seconds to prevent excessive calls
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
    
    return response
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

