/**
 * Retrieval Service
 * Handles semantic search and retrieval of document chunks using vector similarity
 */

import { generateEmbedding } from './embeddingService'
import { ChunkMetadata } from './chunkingService'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface RetrievalConfig {
  matchThreshold: number // Minimum similarity score (0-1)
  matchCount: number // Number of results to return
  filterNodeId?: string // Optional: filter by story structure node
  includeMetadata: boolean // Include chunk metadata in results
}

export interface RetrievalResult {
  id: string
  documentSectionId: string
  chunkText: string
  chunkIndex: number
  similarity: number
  metadata?: ChunkMetadata
}

export interface RetrievalStats {
  queryTokens: number
  resultsFound: number
  searchTimeMs: number
  averageSimilarity: number
}

const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  matchThreshold: 0.7, // 70% similarity minimum
  matchCount: 10,
  includeMetadata: true,
}

/**
 * Search for relevant document chunks using semantic similarity
 */
export async function searchDocumentChunks(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  config: RetrievalConfig = DEFAULT_RETRIEVAL_CONFIG
): Promise<{
  results: RetrievalResult[]
  stats: RetrievalStats
}> {
  const startTime = Date.now()

  // Step 1: Generate embedding for the query
  const { embedding, usage } = await generateEmbedding(supabase, userId, query)

  // Step 2: Call Supabase RPC function for vector search
  const { data, error } = await supabase.rpc('search_document_embeddings', {
    query_embedding: embedding,
    match_threshold: config.matchThreshold,
    match_count: config.matchCount,
    filter_node_id: config.filterNodeId || null,
  })

  if (error) {
    console.error('Vector search error:', error)
    throw new Error(`Vector search failed: ${error.message}`)
  }

  const results: RetrievalResult[] = (data || []).map((row: {
    id: string
    document_section_id: string
    chunk_text: string
    chunk_index: number
    metadata: ChunkMetadata
    similarity: number
  }) => ({
    id: row.id,
    documentSectionId: row.document_section_id,
    chunkText: row.chunk_text,
    chunkIndex: row.chunk_index,
    similarity: row.similarity,
    metadata: config.includeMetadata ? row.metadata : undefined,
  }))

  const searchTimeMs = Date.now() - startTime
  const averageSimilarity =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
      : 0

  return {
    results,
    stats: {
      queryTokens: usage.prompt_tokens,
      resultsFound: results.length,
      searchTimeMs,
      averageSimilarity,
    },
  }
}

/**
 * Build context string from retrieval results for LLM prompt
 */
export function buildContextFromResults(
  results: RetrievalResult[],
  options: {
    includeMetadata?: boolean
    includeSimilarity?: boolean
    maxTotalTokens?: number
  } = {}
): string {
  const {
    includeMetadata = true,
    includeSimilarity = false,
    maxTotalTokens = 5000,
  } = options

  let context = ''
  let currentTokens = 0

  for (const result of results) {
    // Build chunk header
    let chunkHeader = `\n--- Relevant Content`
    
    if (includeMetadata && result.metadata) {
      chunkHeader += ` (${result.metadata.hierarchy_path})`
    }
    
    if (includeSimilarity) {
      chunkHeader += ` [Similarity: ${(result.similarity * 100).toFixed(1)}%]`
    }
    
    chunkHeader += ' ---\n'

    // Estimate tokens for this chunk (rough)
    const chunkTokens = Math.ceil((chunkHeader.length + result.chunkText.length) / 4)
    
    // Stop if we exceed token limit
    if (currentTokens + chunkTokens > maxTotalTokens) {
      context += '\n\n[Additional relevant content omitted due to length...]'
      break
    }

    context += chunkHeader + result.chunkText + '\n'
    currentTokens += chunkTokens
  }

  return context
}

/**
 * Re-rank results using LLM (optional enhancement)
 * This can improve relevance by having an LLM judge which chunks are most relevant
 */
export async function reRankResults(
  query: string,
  results: RetrievalResult[],
  topK: number = 5
): Promise<RetrievalResult[]> {
  // TODO: Implement LLM-based re-ranking
  // For now, just return top K by similarity
  return results.slice(0, topK)
}

/**
 * Hybrid search: Combine vector similarity with keyword matching
 */
export async function hybridSearch(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  config: RetrievalConfig = DEFAULT_RETRIEVAL_CONFIG
): Promise<{
  results: RetrievalResult[]
  stats: RetrievalStats
}> {
  // Step 1: Semantic search
  const semanticResults = await searchDocumentChunks(supabase, userId, query, config)

  // Step 2: Keyword search (using full-text search)
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3) // Filter short words

  if (keywords.length === 0) {
    return semanticResults
  }

  const { data: keywordData, error: keywordError } = await supabase
    .from('document_embeddings')
    .select('id, document_section_id, chunk_text, chunk_index, metadata')
    .or(keywords.map(kw => `chunk_text.ilike.%${kw}%`).join(','))
    .limit(config.matchCount)

  if (keywordError) {
    console.error('Keyword search error:', keywordError)
    return semanticResults // Fall back to semantic only
  }

  // Step 3: Merge and deduplicate results
  const mergedIds = new Set(semanticResults.results.map(r => r.id))
  const keywordResults: RetrievalResult[] = (keywordData || [])
    .filter(row => !mergedIds.has(row.id))
    .map(row => ({
      id: row.id,
      documentSectionId: row.document_section_id,
      chunkText: row.chunk_text,
      chunkIndex: row.chunk_index,
      similarity: 0.5, // Default similarity for keyword matches
      metadata: config.includeMetadata ? row.metadata : undefined,
    }))

  // Combine and sort by similarity
  const allResults = [...semanticResults.results, ...keywordResults]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, config.matchCount)

  return {
    results: allResults,
    stats: {
      ...semanticResults.stats,
      resultsFound: allResults.length,
    },
  }
}

/**
 * Get context for a specific story structure node
 * Useful when user is focused on a particular node in canvas view
 */
export async function getNodeContext(
  supabase: SupabaseClient,
  userId: string,
  nodeId: string,
  query?: string,
  config: Partial<RetrievalConfig> = {}
): Promise<{
  results: RetrievalResult[]
  stats: RetrievalStats
}> {
  const finalConfig: RetrievalConfig = {
    ...DEFAULT_RETRIEVAL_CONFIG,
    ...config,
    filterNodeId: nodeId,
  }

  if (query) {
    // Semantic search within this node
    return await searchDocumentChunks(supabase, userId, query, finalConfig)
  } else {
    // Return all chunks for this node (no query)
    
    const { data, error } = await supabase
      .from('document_embeddings')
      .select('id, document_section_id, chunk_text, chunk_index, metadata')
      .eq('story_structure_node_id', nodeId)
      .eq('embedding_status', 'completed')
      .order('chunk_index', { ascending: true })
      .limit(finalConfig.matchCount)

    if (error) {
      throw new Error(`Failed to get node context: ${error.message}`)
    }

    return {
      results: (data || []).map(row => ({
        id: row.id,
        documentSectionId: row.document_section_id,
        chunkText: row.chunk_text,
        chunkIndex: row.chunk_index,
        similarity: 1.0, // No query, so no similarity score
        metadata: finalConfig.includeMetadata ? row.metadata : undefined,
      })),
      stats: {
        queryTokens: 0,
        resultsFound: data?.length || 0,
        searchTimeMs: 0,
        averageSimilarity: 1.0,
      },
    }
  }
}

/**
 * Check if embeddings exist for a story structure node
 */
export async function checkEmbeddingsExist(
  supabase: SupabaseClient,
  nodeId: string
): Promise<{
  exists: boolean
  chunkCount: number
  status: 'completed' | 'pending' | 'processing' | 'failed' | 'none'
}> {

  const { count, error } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true })
    .eq('story_structure_node_id', nodeId)
    .eq('embedding_status', 'completed')

  if (error) {
    console.error('Error checking embeddings:', error)
    return { exists: false, chunkCount: 0, status: 'none' }
  }

  // Check queue status
  const { data: queueData } = await supabase
    .from('embedding_queue')
    .select('status')
    .eq('story_structure_node_id', nodeId)
    .single()

  const status = queueData?.status || (count && count > 0 ? 'completed' : 'none')

  return {
    exists: count !== null && count > 0,
    chunkCount: count || 0,
    status: status as 'completed' | 'pending' | 'processing' | 'failed' | 'none',
  }
}

