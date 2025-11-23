/**
 * Embedding Pipeline
 * Orchestrates the end-to-end process of chunking, embedding, and storing document content
 */

import { StoryStructureItem } from '@/types/document'
import { chunkDocumentSection, DocumentChunk } from './chunkingService'
import { generateBatchEmbeddings, estimateTokenCount } from './embeddingService'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface EmbeddingPipelineConfig {
  batchSize: number // Number of chunks to embed in parallel
  maxRetries: number // Retry failed embeddings
  onProgress?: (progress: EmbeddingProgress) => void
}

export interface EmbeddingProgress {
  phase: 'chunking' | 'embedding' | 'storing' | 'completed' | 'error'
  current: number
  total: number
  message: string
}

const DEFAULT_PIPELINE_CONFIG: EmbeddingPipelineConfig = {
  batchSize: 100, // OpenAI allows up to 2048, but we'll be conservative
  maxRetries: 3,
}

/**
 * Process a single document section: chunk, embed, and store
 */
export async function processSingleSection(
  supabase: SupabaseClient,
  userId: string,
  documentSectionId: string,
  content: string,
  structureItem: StoryStructureItem,
  nodeId: string,
  config: EmbeddingPipelineConfig = DEFAULT_PIPELINE_CONFIG
): Promise<{
  success: boolean
  chunksCreated: number
  totalTokens: number
  error?: string
}> {
  try {

    // Phase 1: Chunking
    config.onProgress?.({
      phase: 'chunking',
      current: 0,
      total: 1,
      message: 'Splitting content into chunks...',
    })

    const chunks = chunkDocumentSection(content, structureItem)
    
    if (chunks.length === 0) {
      return { success: true, chunksCreated: 0, totalTokens: 0 }
    }

    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

    // Phase 2: Embedding
    config.onProgress?.({
      phase: 'embedding',
      current: 0,
      total: chunks.length,
      message: `Generating embeddings for ${chunks.length} chunks...`,
    })

    // Process in batches
    const embeddings: number[][] = []
    for (let i = 0; i < chunks.length; i += config.batchSize) {
      const batch = chunks.slice(i, i + config.batchSize)
      const batchTexts = batch.map(chunk => chunk.text)
      
      const { embeddings: batchEmbeddings } = await generateBatchEmbeddings(batchTexts)
      embeddings.push(...batchEmbeddings)

      config.onProgress?.({
        phase: 'embedding',
        current: Math.min(i + config.batchSize, chunks.length),
        total: chunks.length,
        message: `Embedded ${Math.min(i + config.batchSize, chunks.length)} / ${chunks.length} chunks`,
      })
    }

    // Phase 3: Storing
    config.onProgress?.({
      phase: 'storing',
      current: 0,
      total: chunks.length,
      message: 'Storing embeddings in database...',
    })

    // Delete existing embeddings for this section
    await supabase
      .from('document_embeddings')
      .delete()
      .eq('document_section_id', documentSectionId)

    // Insert new embeddings
    const embeddingRecords = chunks.map((chunk, index) => ({
      document_section_id: documentSectionId,
      story_structure_node_id: nodeId,
      user_id: userId,
      chunk_text: chunk.text,
      chunk_index: chunk.chunkIndex,
      token_count: chunk.tokenCount,
      embedding: embeddings[index],
      metadata: chunk.metadata,
      embedding_status: 'completed',
      embedding_model: 'text-embedding-3-small',
    }))

    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert(embeddingRecords)

    if (insertError) {
      throw new Error(`Failed to store embeddings: ${insertError.message}`)
    }

    // Update queue status
    await supabase
      .from('embedding_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('document_section_id', documentSectionId)

    config.onProgress?.({
      phase: 'completed',
      current: chunks.length,
      total: chunks.length,
      message: `Successfully embedded ${chunks.length} chunks`,
    })

    return {
      success: true,
      chunksCreated: chunks.length,
      totalTokens,
    }
  } catch (error) {
    console.error('Embedding pipeline error:', error)

    // Update queue with error
    await supabase
      .from('embedding_queue')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        retry_count: supabase.from('embedding_queue').select('retry_count').single().then(
          ({ data }) => (data?.retry_count || 0) + 1
        ),
      })
      .eq('document_section_id', documentSectionId)

    config.onProgress?.({
      phase: 'error',
      current: 0,
      total: 0,
      message: error instanceof Error ? error.message : 'Unknown error',
    })

    return {
      success: false,
      chunksCreated: 0,
      totalTokens: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process an entire story structure node (all sections)
 */
export async function processStoryStructureNode(
  supabase: SupabaseClient,
  userId: string,
  nodeId: string,
  sections: Array<{
    documentSectionId: string
    content: string
    structureItem: StoryStructureItem
  }>,
  config: EmbeddingPipelineConfig = DEFAULT_PIPELINE_CONFIG
): Promise<{
  success: boolean
  totalSections: number
  successfulSections: number
  totalChunks: number
  totalTokens: number
  errors: string[]
}> {
  const results = {
    success: true,
    totalSections: sections.length,
    successfulSections: 0,
    totalChunks: 0,
    totalTokens: 0,
    errors: [] as string[],
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]

    const onProgress = (progress: EmbeddingProgress) => {
      config.onProgress?.({
        ...progress,
        message: `[Section ${i + 1}/${sections.length}] ${progress.message}`,
      })
    }

    const result = await processSingleSection(
      supabase,
      userId,
      section.documentSectionId,
      section.content,
      section.structureItem,
      nodeId,
      { ...config, onProgress }
    )

    if (result.success) {
      results.successfulSections++
      results.totalChunks += result.chunksCreated
      results.totalTokens += result.totalTokens
    } else {
      results.success = false
      results.errors.push(
        `Section ${section.structureItem.id}: ${result.error || 'Unknown error'}`
      )
    }
  }

  return results
}

/**
 * Process the embedding queue (background job)
 */
export async function processEmbeddingQueue(
  config: EmbeddingPipelineConfig = DEFAULT_PIPELINE_CONFIG
): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  const supabase = createClient()

  // Get pending items from queue
  const { data: queueItems, error: queueError } = await supabase
    .from('embedding_queue')
    .select(`
      id,
      document_section_id,
      story_structure_node_id,
      retry_count
    `)
    .eq('status', 'pending')
    .lt('retry_count', config.maxRetries)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10) // Process 10 at a time

  if (queueError || !queueItems || queueItems.length === 0) {
    return { processed: 0, successful: 0, failed: 0 }
  }

  let successful = 0
  let failed = 0

  for (const item of queueItems) {
    // Mark as processing
    await supabase
      .from('embedding_queue')
      .update({ status: 'processing' })
      .eq('id', item.id)

    // Get document section content
    const { data: sectionData, error: sectionError } = await supabase
      .from('document_sections')
      .select('content, structure_item_id')
      .eq('id', item.document_section_id)
      .single()

    if (sectionError || !sectionData) {
      await supabase
        .from('embedding_queue')
        .update({
          status: 'failed',
          error_message: 'Document section not found',
        })
        .eq('id', item.id)
      failed++
      continue
    }

    // Get structure item (we need to parse this from the node's data)
    // For now, create a minimal structure item
    const structureItem: StoryStructureItem = {
      id: sectionData.structure_item_id,
      level: 0,
      type: 'scene',
      content: sectionData.content,
    }

    const result = await processSingleSection(
      item.document_section_id,
      sectionData.content,
      structureItem,
      item.story_structure_node_id,
      config
    )

    if (result.success) {
      successful++
    } else {
      failed++
    }
  }

  return {
    processed: queueItems.length,
    successful,
    failed,
  }
}

/**
 * Estimate cost and time for embedding a document
 */
export async function estimateEmbeddingCost(
  sections: Array<{ content: string }>
): Promise<{
  totalTokens: number
  estimatedCost: number
  estimatedTimeSeconds: number
}> {
  let totalTokens = 0

  for (const section of sections) {
    totalTokens += estimateTokenCount(section.content)
  }

  // Cost: $0.02 per 1M tokens
  const estimatedCost = (totalTokens / 1_000_000) * 0.02

  // Time: Roughly 1 second per 1000 tokens (conservative estimate)
  const estimatedTimeSeconds = Math.ceil(totalTokens / 1000)

  return {
    totalTokens,
    estimatedCost,
    estimatedTimeSeconds,
  }
}

