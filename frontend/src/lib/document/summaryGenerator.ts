/**
 * Summary Generator
 * 
 * Generates and updates summaries for document sections using LLM
 * This helps the orchestrator maintain up-to-date context
 */

import type { DocumentNode } from '@/types/document-hierarchy'

export interface SummaryGenerationOptions {
  sectionId: string
  sectionName: string
  sectionLevel: number
  content: string
  parentSummary?: string
  siblingsSummaries?: Array<{ name: string; summary: string }>
  documentFormat: 'screenplay' | 'novel' | 'report'
}

export interface SummaryResult {
  summary: string
  confidence: number
  wordCount: number
}

/**
 * Generate a summary for a section using LLM
 */
export async function generateSummary(options: SummaryGenerationOptions): Promise<SummaryResult> {
  const {
    sectionName,
    sectionLevel,
    content,
    parentSummary,
    siblingsSummaries = [],
    documentFormat
  } = options

  // Don't summarize empty content
  if (!content || content.trim().length < 10) {
    return {
      summary: 'No content yet',
      confidence: 1.0,
      wordCount: 0
    }
  }

  // For very short content, just use it as-is
  const wordCount = content.split(/\s+/).length
  if (wordCount < 50) {
    return {
      summary: content.trim().substring(0, 150),
      confidence: 0.8,
      wordCount
    }
  }

  try {
    // Build prompt based on document format and section level
    const levelNames: Record<number, string> = {
      1: documentFormat === 'screenplay' ? 'Act' : 'Part',
      2: documentFormat === 'screenplay' ? 'Sequence' : 'Chapter',
      3: documentFormat === 'screenplay' ? 'Scene' : 'Section',
      4: documentFormat === 'screenplay' ? 'Beat' : 'Subsection'
    }
    
    const levelName = levelNames[sectionLevel] || 'Section'
    
    let prompt = `You are a ${documentFormat} writing assistant. Summarize the following ${levelName.toLowerCase()} content concisely.

SECTION: ${sectionName}
LEVEL: ${levelName} (Level ${sectionLevel})
${parentSummary ? `PARENT CONTEXT: ${parentSummary}` : ''}

CONTENT TO SUMMARIZE:
---
${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}
---

TASK:
- Write a ${sectionLevel === 1 ? '2-3 sentence' : '1-2 sentence'} summary
- Focus on key plot points, character development, or main ideas
- Keep it concise and actionable for writers
- Don't include meta-commentary or instructions
- Return ONLY the summary text (no labels, no preamble)

SUMMARY:`

    const response = await fetch('/api/llm/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Fast model for summaries
        prompt,
        temperature: 0.3, // Lower temperature for more consistent summaries
        maxTokens: 150
      })
    })

    if (!response.ok) {
      throw new Error(`Summary API failed: ${response.status}`)
    }

    const result = await response.json()
    const summary = result.text?.trim() || 'Summary generation failed'
    
    // Clean up the summary (remove common artifacts)
    const cleanedSummary = summary
      .replace(/^(Summary:|Here's the summary:|The summary is:)/i, '')
      .replace(/^\s*-\s*/, '') // Remove leading dash
      .trim()
    
    return {
      summary: cleanedSummary,
      confidence: 0.9,
      wordCount
    }

  } catch (error) {
    console.error('[Summary Generator] Error:', error)
    
    // Fallback: Use first few sentences
    const sentences = content.match(/[^.!?]+[.!?]+/g) || []
    const fallbackSummary = sentences.slice(0, 2).join(' ').trim().substring(0, 200)
    
    return {
      summary: fallbackSummary || 'Content summary unavailable',
      confidence: 0.3,
      wordCount
    }
  }
}

/**
 * Batch generate summaries for multiple sections
 */
export async function batchGenerateSummaries(
  sections: Array<{
    id: string
    name: string
    level: number
    content: string
    parentSummary?: string
  }>,
  format: 'screenplay' | 'novel' | 'report',
  onProgress?: (completed: number, total: number) => void
): Promise<Record<string, SummaryResult>> {
  const results: Record<string, SummaryResult> = {}
  
  // Process sections in parallel (but limit concurrency to 3)
  const concurrencyLimit = 3
  let completed = 0
  
  for (let i = 0; i < sections.length; i += concurrencyLimit) {
    const batch = sections.slice(i, i + concurrencyLimit)
    
    const batchResults = await Promise.all(
      batch.map(async section => {
        const result = await generateSummary({
          sectionId: section.id,
          sectionName: section.name,
          sectionLevel: section.level,
          content: section.content,
          parentSummary: section.parentSummary,
          documentFormat: format
        })
        
        return { id: section.id, result }
      })
    )
    
    for (const { id, result } of batchResults) {
      results[id] = result
      completed++
      
      if (onProgress) {
        onProgress(completed, sections.length)
      }
    }
  }
  
  return results
}

/**
 * Check if a section needs a summary update
 */
export function needsSummaryUpdate(node: DocumentNode): boolean {
  // No summary exists
  if (!node.summary || node.summary === 'No content yet') {
    return node.content.trim().length > 10
  }
  
  // Content was updated after summary
  // (In the future, we could track lastSummarizedAt timestamp)
  // For now, check if content is significantly longer than summary
  const contentWords = node.content.split(/\s+/).length
  const summaryWords = node.summary.split(/\s+/).length
  
  // If content is more than 10x the summary length, probably needs update
  if (contentWords > summaryWords * 10 && contentWords > 50) {
    return true
  }
  
  return false
}

/**
 * Auto-generate summaries for a document tree
 * Returns the number of summaries generated
 */
export async function autoGenerateSummariesForDocument(
  documentNodes: DocumentNode[],
  format: 'screenplay' | 'novel' | 'report',
  onProgress?: (message: string) => void
): Promise<number> {
  let generatedCount = 0
  
  const sectionsNeedingSummaries: Array<{
    id: string
    name: string
    level: number
    content: string
    parentSummary?: string
  }> = []
  
  // Traverse tree and collect sections needing summaries
  const traverse = (nodes: DocumentNode[], parentSummary?: string) => {
    for (const node of nodes) {
      if (needsSummaryUpdate(node)) {
        sectionsNeedingSummaries.push({
          id: node.id,
          name: node.title || node.name,
          level: node.level,
          content: node.content,
          parentSummary
        })
      }
      
      // Recursively check children
      traverse(node.children, node.summary)
    }
  }
  
  traverse(documentNodes)
  
  if (sectionsNeedingSummaries.length === 0) {
    if (onProgress) {
      onProgress('All summaries are up to date')
    }
    return 0
  }
  
  if (onProgress) {
    onProgress(`Generating ${sectionsNeedingSummaries.length} summaries...`)
  }
  
  // Generate summaries in batches
  const results = await batchGenerateSummaries(
    sectionsNeedingSummaries,
    format,
    (completed, total) => {
      if (onProgress) {
        onProgress(`Generated ${completed}/${total} summaries...`)
      }
    }
  )
  
  // Update nodes with new summaries
  const updateNode = (nodes: DocumentNode[]) => {
    for (const node of nodes) {
      if (results[node.id]) {
        node.summary = results[node.id].summary
        node.updatedAt = new Date().toISOString()
        generatedCount++
      }
      updateNode(node.children)
    }
  }
  
  updateNode(documentNodes)
  
  if (onProgress) {
    onProgress(`✅ Generated ${generatedCount} summaries`)
  }
  
  return generatedCount
}

