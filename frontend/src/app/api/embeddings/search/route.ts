/**
 * API Route: /api/embeddings/search
 * Performs semantic search on embedded document chunks
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  searchDocumentChunks,
  hybridSearch,
  getNodeContext,
  checkEmbeddingsExist,
  buildContextFromResults,
} from '@/lib/embeddings/retrievalService'

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
    const {
      query,
      nodeId,
      matchThreshold = 0.7,
      matchCount = 10,
      includeMetadata = true,
      searchMode = 'semantic', // 'semantic' | 'hybrid'
      buildContext = false, // If true, return formatted context string
    } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid query parameter' },
        { status: 400 }
      )
    }

    // Check if embeddings exist for the target node
    if (nodeId) {
      const embeddingStatus = await checkEmbeddingsExist(supabase, nodeId)
      
      if (!embeddingStatus.exists) {
        return NextResponse.json(
          {
            error: 'No embeddings found for this node',
            embeddingStatus,
            suggestion: 'Generate embeddings first using /api/embeddings/generate',
          },
          { status: 404 }
        )
      }

      if (embeddingStatus.status === 'pending' || embeddingStatus.status === 'processing') {
        return NextResponse.json(
          {
            error: 'Embeddings are still being generated',
            embeddingStatus,
          },
          { status: 202 } // Accepted but not ready
        )
      }
    }

    // Perform search
    let searchResult
    if (searchMode === 'hybrid') {
      searchResult = await hybridSearch(supabase, user.id, query, {
        matchThreshold,
        matchCount,
        filterNodeId: nodeId,
        includeMetadata,
      })
    } else {
      searchResult = await searchDocumentChunks(supabase, user.id, query, {
        matchThreshold,
        matchCount,
        filterNodeId: nodeId,
        includeMetadata,
      })
    }

    // Optionally build context string for LLM prompt
    let context: string | undefined
    if (buildContext && searchResult.results.length > 0) {
      context = buildContextFromResults(searchResult.results, {
        includeMetadata: true,
        includeSimilarity: false,
        maxTotalTokens: 5000,
      })
    }

    return NextResponse.json({
      success: true,
      results: searchResult.results,
      stats: searchResult.stats,
      context,
    })
  } catch (error) {
    console.error('Embedding search error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET: Get context for a specific node (without query)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const nodeId = searchParams.get('nodeId')
    const query = searchParams.get('query')
    const matchCount = parseInt(searchParams.get('matchCount') || '10', 10)

    if (!nodeId) {
      return NextResponse.json(
        { error: 'Missing nodeId parameter' },
        { status: 400 }
      )
    }

    // Check if embeddings exist
    const embeddingStatus = await checkEmbeddingsExist(nodeId)
    
    if (!embeddingStatus.exists) {
      return NextResponse.json(
        {
          error: 'No embeddings found for this node',
          embeddingStatus,
        },
        { status: 404 }
      )
    }

    // Get node context
    const result = await getNodeContext(supabase, user.id, nodeId, query || undefined, {
      matchCount,
      includeMetadata: true,
    })

    // Build context string
    const context = buildContextFromResults(result.results, {
      includeMetadata: true,
      includeSimilarity: false,
      maxTotalTokens: 5000,
    })

    return NextResponse.json({
      success: true,
      nodeId,
      results: result.results,
      stats: result.stats,
      context,
    })
  } catch (error) {
    console.error('Error getting node context:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

