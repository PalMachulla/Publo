/**
 * Document Chunking Service
 * Intelligently splits document content into chunks suitable for embedding
 * Preserves story structure boundaries (Acts, Sequences, Scenes, Beats)
 */

import { StoryStructureItem } from '@/types/document'
import { estimateTokenCount } from './embeddingService'

export interface ChunkMetadata {
  act?: string
  sequence?: string
  scene?: string
  beat?: string
  hierarchy_path: string
  section_type: string
  character_mentions?: string[]
  themes?: string[]
}

export interface DocumentChunk {
  text: string
  chunkIndex: number
  tokenCount: number
  metadata: ChunkMetadata
}

export interface ChunkingConfig {
  maxTokensPerChunk: number // Target max tokens per chunk
  minTokensPerChunk: number // Minimum tokens to avoid tiny chunks
  overlapTokens: number // Overlap between chunks for context
  respectBoundaries: boolean // Don't split across structural boundaries
}

const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  maxTokensPerChunk: 800,
  minTokensPerChunk: 100,
  overlapTokens: 50,
  respectBoundaries: true,
}

/**
 * Extract character mentions from text using simple heuristics
 * TODO: Enhance with NER (Named Entity Recognition) for better accuracy
 */
function extractCharacterMentions(text: string): string[] {
  const characters = new Set<string>()
  
  // Look for capitalized words (potential names)
  // This is a simple heuristic; could be improved with character database lookup
  const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\b/g) || []
  
  // Filter common false positives
  const commonWords = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'Of', 'With', 'By'])
  
  capitalizedWords.forEach(word => {
    if (!commonWords.has(word) && word.length > 2) {
      characters.add(word)
    }
  })
  
  return Array.from(characters).slice(0, 10) // Limit to top 10
}

/**
 * Extract themes/topics from text using keyword matching
 * TODO: Enhance with topic modeling or LLM-based classification
 */
function extractThemes(text: string): string[] {
  const themeKeywords = {
    'conflict': /conflict|fight|battle|war|struggle|tension/i,
    'love': /love|romance|affection|passion|heart/i,
    'betrayal': /betray|deceive|backstab|double-cross/i,
    'friendship': /friend|companion|ally|bond/i,
    'mystery': /mystery|clue|investigate|detective|solve/i,
    'fear': /fear|terror|horror|dread|afraid/i,
    'hope': /hope|dream|wish|aspire|optimis/i,
    'revenge': /revenge|vengeance|retribution|payback/i,
  }
  
  const themes: string[] = []
  
  Object.entries(themeKeywords).forEach(([theme, pattern]) => {
    if (pattern.test(text)) {
      themes.push(theme)
    }
  })
  
  return themes
}

/**
 * Build hierarchy path from structure item
 */
function buildHierarchyPath(item: StoryStructureItem): string {
  // Use the item's name as the hierarchy path
  // The name already contains the hierarchical information (e.g., "Act I", "Scene 1")
  return item.name || 'Unknown Section'
}

/**
 * Get section type from structure item
 */
function getSectionType(item: StoryStructureItem): string {
  // Infer type from the item's name
  const name = item.name.toLowerCase()
  if (name.includes('beat')) return 'beat'
  if (name.includes('scene')) return 'scene'
  if (name.includes('sequence')) return 'sequence'
  if (name.includes('act')) return 'act'
  if (name.includes('chapter')) return 'chapter'
  if (name.includes('part')) return 'part'
  return 'section'
}

/**
 * Build metadata for a chunk from structure item
 */
function buildChunkMetadata(
  item: StoryStructureItem,
  text: string
): ChunkMetadata {
  // Extract hierarchy information from the item name
  const sectionType = getSectionType(item)
  
  return {
    act: sectionType === 'act' ? item.name : undefined,
    sequence: sectionType === 'sequence' ? item.name : undefined,
    scene: sectionType === 'scene' ? item.name : undefined,
    beat: sectionType === 'beat' ? item.name : undefined,
    hierarchy_path: buildHierarchyPath(item),
    section_type: sectionType,
    character_mentions: extractCharacterMentions(text),
    themes: extractThemes(text),
  }
}

/**
 * Split a large text into smaller chunks with overlap
 */
function splitTextIntoChunks(
  text: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const chunks: string[] = []
  
  // Split by paragraphs first (preserve natural boundaries)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0)
  
  let currentChunk = ''
  let currentTokens = 0
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokenCount(paragraph)
    
    // If single paragraph exceeds maxTokens, split by sentences
    if (paragraphTokens > maxTokens) {
      // Flush current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
        currentTokens = 0
      }
      
      // Split large paragraph by sentences
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph]
      
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokenCount(sentence)
        
        if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
          chunks.push(currentChunk.trim())
          
          // Add overlap from end of previous chunk
          const words = currentChunk.split(/\s+/)
          const overlapWords = Math.floor(words.length * (overlapTokens / maxTokens))
          currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence
          currentTokens = estimateTokenCount(currentChunk)
        } else {
          currentChunk += ' ' + sentence
          currentTokens += sentenceTokens
        }
      }
    } else {
      // Normal paragraph processing
      if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk.trim())
        
        // Add overlap
        const words = currentChunk.split(/\s+/)
        const overlapWords = Math.floor(words.length * (overlapTokens / maxTokens))
        currentChunk = words.slice(-overlapWords).join(' ') + '\n\n' + paragraph
        currentTokens = estimateTokenCount(currentChunk)
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
        currentTokens += paragraphTokens
      }
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

/**
 * Chunk a single document section with structure metadata
 */
export function chunkDocumentSection(
  content: string,
  structureItem: StoryStructureItem,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  
  // If content is small enough, create single chunk
  const totalTokens = estimateTokenCount(content)
  
  if (totalTokens <= config.maxTokensPerChunk) {
    // Single chunk
    chunks.push({
      text: content,
      chunkIndex: 0,
      tokenCount: totalTokens,
      metadata: buildChunkMetadata(structureItem, content),
    })
  } else {
    // Split into multiple chunks
    const textChunks = splitTextIntoChunks(
      content,
      config.maxTokensPerChunk,
      config.overlapTokens
    )
    
    textChunks.forEach((chunkText, index) => {
      chunks.push({
        text: chunkText,
        chunkIndex: index,
        tokenCount: estimateTokenCount(chunkText),
        metadata: buildChunkMetadata(structureItem, chunkText),
      })
    })
  }
  
  return chunks
}

/**
 * Chunk multiple document sections (entire story structure)
 */
export function chunkStoryStructure(
  sections: Array<{ content: string; structureItem: StoryStructureItem }>,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): Map<string, DocumentChunk[]> {
  const chunkMap = new Map<string, DocumentChunk[]>()
  
  sections.forEach(({ content, structureItem }) => {
    if (content && content.trim().length > 0) {
      const chunks = chunkDocumentSection(content, structureItem, config)
      chunkMap.set(structureItem.id, chunks)
    }
  })
  
  return chunkMap
}

/**
 * Calculate statistics for chunked content
 */
export interface ChunkingStats {
  totalSections: number
  totalChunks: number
  totalTokens: number
  averageChunksPerSection: number
  averageTokensPerChunk: number
  estimatedCost: number
}

export function calculateChunkingStats(
  chunkMap: Map<string, DocumentChunk[]>
): ChunkingStats {
  let totalChunks = 0
  let totalTokens = 0
  
  chunkMap.forEach(chunks => {
    totalChunks += chunks.length
    chunks.forEach(chunk => {
      totalTokens += chunk.tokenCount
    })
  })
  
  const totalSections = chunkMap.size
  
  return {
    totalSections,
    totalChunks,
    totalTokens,
    averageChunksPerSection: totalChunks / totalSections,
    averageTokensPerChunk: totalTokens / totalChunks,
    estimatedCost: (totalTokens / 1_000_000) * 0.02, // $0.02 per 1M tokens
  }
}

/**
 * Preview chunking without actually creating chunks (for UI preview)
 */
export function previewChunking(
  content: string,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG
): {
  estimatedChunks: number
  estimatedTokens: number
  estimatedCost: number
} {
  const totalTokens = estimateTokenCount(content)
  const estimatedChunks = Math.ceil(totalTokens / config.maxTokensPerChunk)
  
  return {
    estimatedChunks,
    estimatedTokens: totalTokens,
    estimatedCost: (totalTokens / 1_000_000) * 0.02,
  }
}

