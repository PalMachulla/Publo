/**
 * Canvas Analyzer
 * 
 * Analyzes canvas nodes to find matches with user message.
 * Uses fuzzy matching and scoring to rank node matches.
 */

import type { CanvasNode } from '../../pipeline/types'

export class CanvasAnalyzer {
  /**
   * Find canvas nodes matching user message
   */
  findMatchingNodes(message: string, nodes: CanvasNode[]): CanvasNode[] {
    if (!nodes || nodes.length === 0) {
      return []
    }
    
    const normalized = message.toLowerCase()
    const matches: Array<{ node: CanvasNode; score: number }> = []
    
    for (const node of nodes) {
      let score = 0
      const nodeLabel = node.label.toLowerCase()
      const nodeType = node.type.toLowerCase()
      
      // Exact label match
      if (normalized.includes(nodeLabel)) {
        score += 10
      }
      
      // Type match
      if (normalized.includes(nodeType)) {
        score += 5
      }
      
      // Fuzzy label match (word overlap)
      const labelWords = nodeLabel.split(/\s+/)
      const messageWords = normalized.split(/\s+/)
      const commonWords = labelWords.filter(w => messageWords.includes(w))
      score += commonWords.length * 2
      
      // Partial label match (substring)
      if (nodeLabel.length > 0 && normalized.includes(nodeLabel.substring(0, Math.min(5, nodeLabel.length)))) {
        score += 3
      }
      
      if (score > 0) {
        matches.push({ node, score })
      }
    }
    
    // Return top 3 matches, sorted by score
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => m.node)
  }
  
  /**
   * Check if user is referring to existing node vs creating new
   */
  isReferringToExisting(message: string, nodeType: string): boolean {
    const normalized = message.toLowerCase()
    
    // Possessive/definite articles → existing
    const existingIndicators = [
      `my ${nodeType}`,
      `the ${nodeType}`,
      `our ${nodeType}`,
      `that ${nodeType}`,
      `this ${nodeType}`,
    ]
    
    return existingIndicators.some(indicator => normalized.includes(indicator))
  }
  
  /**
   * Extract document type from message (novel, screenplay, etc.)
   */
  extractDocumentType(message: string): string | null {
    const normalized = message.toLowerCase()
    
    const documentTypes = [
      'novel',
      'screenplay',
      'podcast',
      'report',
      'article',
      'short story',
      'essay',
      'blog',
      'interview'
    ]
    
    for (const type of documentTypes) {
      if (normalized.includes(type)) {
        return type
      }
    }
    
    return null
  }
}

