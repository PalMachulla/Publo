/**
 * RAG Integration for Orchestrator
 * 
 * Enhances the orchestrator's canvas awareness by using semantic search (RAG)
 * to retrieve relevant content from Story Structure nodes when they have embeddings.
 * 
 * Flow:
 * 1. User sends message in canvas view
 * 2. Detect if message references a Story Structure node
 * 3. Check if node has embeddings
 * 4. If yes: Use RAG to find relevant chunks
 * 5. If no: Fall back to standard context extraction
 * 6. Inject retrieved content into orchestrator prompt
 */

import { buildContextFromResults, type RetrievalResult } from '@/lib/embeddings/retrievalService'
import { CanvasContext, NodeContext, resolveNode } from './core/contextProvider'
// Deprecated imports (functionality moved to core/contextProvider):
// import { findReferencedNode } from './canvasContextProvider.deprecated'
// import { resolveNodeWithLLM } from './llmNodeResolver.deprecated'

export interface RAGEnhancedContext {
  hasRAG: boolean
  ragContent?: string
  ragStats?: {
    queryTokens: number
    resultsFound: number
    searchTimeMs: number
    averageSimilarity: number
  }
  fallbackReason?: string
  referencedNode?: NodeContext
}

/**
 * Enhance orchestrator context with RAG retrieval
 * 
 * @param userMessage - The user's query/message
 * @param canvasContext - Current canvas context (connected nodes)
 * @param explicitNodeId - Optional: Specific node ID to search (overrides auto-detection)
 * @returns Enhanced context with RAG content if available
 */
export async function enhanceContextWithRAG(
  userMessage: string,
  canvasContext: CanvasContext,
  explicitNodeId?: string,
  conversationHistory?: Array<{ role: string, content: string }>
): Promise<RAGEnhancedContext> {
  try {
    // Skip during SSR
    if (typeof window === 'undefined') {
      console.log('⚠️ [RAG] Skipping during SSR')
      return {
        hasRAG: false,
        fallbackReason: 'RAG not available during server-side rendering',
      }
    }

    console.log('🔍 [RAG] Attempting RAG enhancement for message:', userMessage)

    // Step 1: Determine target node
    let targetNodeId: string | undefined = explicitNodeId
    let referencedNode: NodeContext | undefined

    if (!targetNodeId) {
      // STRATEGY 1: Simple node search
      // TODO: Refactor to use resolveNode from core/contextProvider (requires blackboard)
      if (conversationHistory && conversationHistory.length > 0) {
        console.log('🧠 [RAG] Searching for story structure node...')
        referencedNode = canvasContext.connectedNodes.find(
          n => n.nodeType === 'story-structure' || n.nodeType === 'storyStructureNode'
        )
        
        if (referencedNode) {
          targetNodeId = referencedNode.nodeId
          console.log('✅ [RAG] Found node:', {
            nodeId: targetNodeId,
            label: referencedNode.label
          })
        }
      }
      
      // STRATEGY 2: Fall back to keyword matching if LLM fails
      // TODO: Refactor to use resolveNode from core/contextProvider (requires blackboard)
      if (!referencedNode) {
        console.log('🔍 [RAG] Falling back to simple node search...')
        // Simple fallback: find first story-structure node
        referencedNode = canvasContext.connectedNodes.find(
          n => n.nodeType === 'story-structure' || n.nodeType === 'storyStructureNode'
        )
        
        if (referencedNode) {
          targetNodeId = referencedNode.nodeId
          console.log('🎯 [RAG] Using first story structure node:', {
            nodeId: targetNodeId,
            label: referencedNode.label
          })
        }
      }
    } else {
      // Find the node in canvas context
      referencedNode = canvasContext.connectedNodes.find(n => n.nodeId === targetNodeId)
    }

    if (!targetNodeId) {
      console.log('⚠️ [RAG] No story structure node detected in message or canvas')
      return {
        hasRAG: false,
        fallbackReason: 'No story structure node referenced or detected',
      }
    }

    // Step 2: Check if embeddings exist for this node (via API)
    const statusResponse = await fetch(`/api/embeddings/generate?nodeId=${targetNodeId}`)
    if (!statusResponse.ok) {
      console.error('⚠️ [RAG] Failed to check embedding status')
      return {
        hasRAG: false,
        fallbackReason: 'Failed to check embedding status',
        referencedNode,
      }
    }
    
    const embeddingStatus = await statusResponse.json()
    console.log('📊 [RAG] Embedding status:', embeddingStatus)

    if (!embeddingStatus.exists) {
      console.log('⚠️ [RAG] No embeddings found for node:', targetNodeId)
      return {
        hasRAG: false,
        fallbackReason: 'Embeddings not generated for this story node',
        referencedNode,
      }
    }

    if (embeddingStatus.queueStatus && embeddingStatus.queueStatus !== 'completed' && embeddingStatus.queueStatus !== 'none') {
      console.log('⚠️ [RAG] Embeddings not ready:', embeddingStatus.queueStatus)
      return {
        hasRAG: false,
        fallbackReason: `Embeddings are ${embeddingStatus.queueStatus}`,
        referencedNode,
      }
    }

    // Step 3: Perform semantic search (via API)
    console.log('🚀 [RAG] Performing semantic search...')
    const searchResponse = await fetch('/api/embeddings/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: userMessage,
        matchThreshold: 0.3, // Lower threshold for broader retrieval (0.3 = 30% similarity)
        matchCount: 10, // Get more chunks for better context
        nodeId: targetNodeId,
        includeMetadata: true,
      }),
    })

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json()
      console.error('⚠️ [RAG] Search API error:', errorData)
      return {
        hasRAG: false,
        fallbackReason: `Search failed: ${errorData.error || 'Unknown error'}`,
        referencedNode,
      }
    }

    const searchResult = await searchResponse.json()

    console.log('✅ [RAG] Search complete:', {
      resultsFound: searchResult.results.length,
      avgSimilarity: searchResult.stats.averageSimilarity,
    })

    if (searchResult.results.length === 0) {
      return {
        hasRAG: false,
        fallbackReason: 'No relevant content found in embeddings',
        referencedNode,
      }
    }

    // Step 4: Build context string from results
    const ragContent = buildContextFromResults(searchResult.results, {
      includeMetadata: true,
      includeSimilarity: false,
      maxTotalTokens: 4000, // Leave room for rest of prompt
    })

    console.log('📝 [RAG] Context built:', {
      contentLength: ragContent.length,
      estimatedTokens: Math.ceil(ragContent.length / 4),
    })

    return {
      hasRAG: true,
      ragContent,
      ragStats: searchResult.stats,
      referencedNode,
    }
  } catch (error) {
    console.error('❌ [RAG] Error during RAG enhancement:', error)
    return {
      hasRAG: false,
      fallbackReason: `RAG error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Build enhanced LLM prompt with RAG context
 * 
 * @param basePrompt - Original orchestrator system prompt
 * @param ragContext - RAG-enhanced context
 * @param canvasContext - Standard canvas context
 * @returns Enhanced prompt with RAG content injected
 */
export function buildRAGEnhancedPrompt(
  basePrompt: string,
  ragContext: RAGEnhancedContext,
  canvasContext: CanvasContext
): string {
  let enhanced = basePrompt

  // Add canvas context visibility
  if (canvasContext.connectedNodes.length > 0) {
    enhanced += '\n\n📊 CANVAS CONTEXT:\n'
    enhanced += `You can see ${canvasContext.connectedNodes.length} connected node(s):\n`
    canvasContext.connectedNodes.forEach((node, i) => {
      enhanced += `${i + 1}. ${node.label} [${node.nodeType}]: ${node.summary}\n`
    })
  }

  // Add RAG content if available
  if (ragContext.hasRAG && ragContext.ragContent) {
    enhanced += '\n\n🎯 RELEVANT CONTENT (Retrieved via Semantic Search):\n'
    enhanced += `The following content was retrieved from "${ragContext.referencedNode?.label || 'the story'}" based on relevance to the user's request:\n\n`
    enhanced += ragContext.ragContent
    enhanced += '\n\n📌 Important: This content is directly from the story document. Reference it when answering the user\'s request.\n'
  } else if (ragContext.fallbackReason) {
    // Optionally mention why RAG wasn't used (for debugging)
    enhanced += `\n\n⚠️ Note: Semantic search unavailable (${ragContext.fallbackReason}). Using standard canvas context only.\n`
  }

  return enhanced
}

/**
 * Check if RAG is available for any connected story nodes
 * Useful for UI indicators ("Semantic search available")
 */
export async function checkRAGAvailability(
  canvasContext: CanvasContext
): Promise<{
  available: boolean
  nodesWithEmbeddings: string[]
  nodesWithoutEmbeddings: string[]
}> {
  // Skip during SSR
  if (typeof window === 'undefined') {
    return {
      available: false,
      nodesWithEmbeddings: [],
      nodesWithoutEmbeddings: [],
    }
  }

  const storyNodes = canvasContext.connectedNodes.filter(
    node => node.nodeType === 'story-structure'
  )

  const nodesWithEmbeddings: string[] = []
  const nodesWithoutEmbeddings: string[] = []

  for (const node of storyNodes) {
    try {
      const statusResponse = await fetch(`/api/embeddings/generate?nodeId=${node.nodeId}`)
      if (statusResponse.ok) {
        const status = await statusResponse.json()
        if (status.exists && (status.queueStatus === 'completed' || status.queueStatus === 'none')) {
          nodesWithEmbeddings.push(node.nodeId)
        } else {
          nodesWithoutEmbeddings.push(node.nodeId)
        }
      } else {
        nodesWithoutEmbeddings.push(node.nodeId)
      }
    } catch (error) {
      console.error('Error checking embedding status for node:', node.nodeId, error)
      nodesWithoutEmbeddings.push(node.nodeId)
    }
  }

  return {
    available: nodesWithEmbeddings.length > 0,
    nodesWithEmbeddings,
    nodesWithoutEmbeddings,
  }
}

/**
 * Generate embeddings for a story node (trigger from UI)
 * This would be called when user clicks "Enable Semantic Search" button
 */
export async function triggerEmbeddingGeneration(nodeId: string): Promise<{
  success: boolean
  message: string
}> {
  // Skip during SSR
  if (typeof window === 'undefined') {
    return {
      success: false,
      message: 'Cannot generate embeddings during server-side rendering',
    }
  }

  try {
    const response = await fetch('/api/embeddings/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'single',
        nodeId,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate embeddings')
    }

    return {
      success: true,
      message: `Successfully generated ${data.chunksCreated} embedding chunks`,
    }
  } catch (error) {
    console.error('Error triggering embedding generation:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

