/**
 * Hierarchical Document Schema
 * 
 * This replaces the flat document_sections table with a tree structure
 * stored as JSONB on the node itself.
 */

export interface DocumentNode {
  id: string // Structure item ID
  level: number // 1=Act, 2=Sequence, 3=Scene, 4=Beat
  order: number // Position among siblings
  name: string // "Act I", "Sequence 1", etc.
  title?: string // "Setup", "The Catalyst", etc.
  
  // Content & Metadata
  content: string // Actual written content (markdown)
  summary?: string // AI-generated summary (always kept current)
  wordCount: number
  status: 'draft' | 'in_progress' | 'completed'
  
  // Hierarchy
  children: DocumentNode[]
  
  // Timestamps
  createdAt: string
  updatedAt: string
  
  // Future: Sub-agents, themes, notes
  themeColor?: string
  notes?: string
  subAgentId?: string
}

export interface DocumentData {
  version: number // Schema version for migrations
  format: 'screenplay' | 'novel' | 'report' // Document type
  
  // The hierarchical structure
  structure: DocumentNode[]
  
  // Cached data for performance
  fullDocument: string // Full markdown with all sections
  fullDocumentUpdatedAt: string
  
  // Embedding for semantic search (future)
  embedding?: number[]
  embeddingUpdatedAt?: string
  
  // Statistics
  totalWordCount: number
  completionPercentage: number // % of sections with content
  
  // Metadata
  lastEditedBy?: string
  lastEditedAt: string
}

// Helper type for flattening hierarchy (for UI compatibility)
export interface FlatDocumentSection {
  id: string
  parentId: string | null
  level: number
  order: number
  name: string
  title?: string
  content: string
  summary?: string
  wordCount: number
  status: 'draft' | 'in_progress' | 'completed'
  // ✅ FIX: Add timestamp fields
  createdAt?: string
  updatedAt?: string
  themeColor?: string
}

// Update operations
export interface DocumentUpdateOperation {
  type: 'update_content' | 'update_summary' | 'update_status' | 'add_node' | 'delete_node' | 'reorder_nodes'
  nodeId: string
  data?: any
}

// Validation schema
export function validateDocumentData(data: any): data is DocumentData {
  return (
    typeof data === 'object' &&
    typeof data.version === 'number' &&
    typeof data.format === 'string' &&
    Array.isArray(data.structure) &&
    typeof data.fullDocument === 'string' &&
    typeof data.totalWordCount === 'number'
  )
}

// Helper to find a node by ID in the tree
export function findNodeById(nodes: DocumentNode[], id: string): DocumentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNodeById(node.children, id)
    if (found) return found
  }
  return null
}

// Helper to flatten hierarchy for UI
export function flattenDocumentStructure(nodes: DocumentNode[], parentId: string | null = null): FlatDocumentSection[] {
  const flat: FlatDocumentSection[] = []
  
  for (const node of nodes) {
    flat.push({
      id: node.id,
      parentId,
      level: node.level,
      order: node.order,
      name: node.name,
      title: node.title,
      content: node.content,
      summary: node.summary,
      wordCount: node.wordCount,
      status: node.status,
      themeColor: node.themeColor
    })
    
    // Recursively flatten children
    flat.push(...flattenDocumentStructure(node.children, node.id))
  }
  
  return flat
}

// Helper to build full document markdown
export function buildFullDocument(nodes: DocumentNode[], includeHeaders: boolean = true): string {
  const parts: string[] = []
  
  for (const node of nodes) {
    if (includeHeaders) {
      const headerLevel = Math.min(node.level, 6)
      const headerTag = `h${headerLevel}`
      const headerText = node.title || node.name
      
      // HTML heading with ID for anchor scrolling
      parts.push(`<${headerTag} id="section-${node.id}" style="scroll-margin-top: 20px;">${headerText}</${headerTag}>`)
      parts.push('') // Blank line
    }
    
    // Add content if exists
    if (node.content && node.content.trim()) {
      parts.push(node.content)
    } else {
      parts.push('*[No content yet - Click here to start writing]*')
    }
    parts.push('') // Blank line
    
    // Recursively add children
    if (node.children.length > 0) {
      parts.push(buildFullDocument(node.children, includeHeaders))
    }
  }
  
  return parts.join('\n\n')
}

