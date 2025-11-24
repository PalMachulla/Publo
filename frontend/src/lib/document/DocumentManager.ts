/**
 * DocumentManager - Centralized document operations
 * 
 * Handles all CRUD operations on hierarchical document structures
 */

import type { DocumentData, DocumentNode, FlatDocumentSection } from '@/types/document-hierarchy'
import { findNodeById, flattenDocumentStructure, buildFullDocument } from '@/types/document-hierarchy'
import type { StoryStructureItem } from '@/types/nodes'
import { generateSummary, autoGenerateSummariesForDocument, needsSummaryUpdate } from './summaryGenerator'
import type { SummaryGenerationOptions } from './summaryGenerator'

export class DocumentManager {
  private data: DocumentData

  constructor(data: DocumentData) {
    this.data = data
  }

  // Factory: Create from existing StoryStructureItems (migration helper)
  static fromStructureItems(
    items: StoryStructureItem[],
    format: 'screenplay' | 'novel' | 'report' = 'screenplay'
  ): DocumentManager {
    const structure = DocumentManager.buildHierarchy(items, null)
    
    const data: DocumentData = {
      version: 1,
      format,
      structure,
      fullDocument: '',
      fullDocumentUpdatedAt: new Date().toISOString(),
      totalWordCount: 0,
      completionPercentage: 0,
      lastEditedAt: new Date().toISOString()
    }
    
    const manager = new DocumentManager(data)
    manager.rebuildFullDocument()
    manager.recalculateStats()
    
    return manager
  }

  // Build hierarchical structure from flat StoryStructureItems
  private static buildHierarchy(
    items: StoryStructureItem[],
    parentId: string | null
  ): DocumentNode[] {
    return items
      .filter(item => (parentId === null ? !item.parentId : item.parentId === parentId))
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        id: item.id,
        level: item.level,
        order: item.order,
        name: item.name,
        title: item.title,
        content: '', // Empty initially
        summary: item.summary,
        wordCount: item.wordCount || 0,
        status: 'draft',
        children: DocumentManager.buildHierarchy(items, item.id),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
  }

  // Get the data
  getData(): DocumentData {
    return this.data
  }

  // Get flat structure for UI compatibility
  getFlatStructure(): FlatDocumentSection[] {
    return flattenDocumentStructure(this.data.structure)
  }

  // Get full document markdown
  getFullDocument(): string {
    return this.data.fullDocument
  }

  // Find a node by ID
  findNode(nodeId: string): DocumentNode | null {
    return findNodeById(this.data.structure, nodeId)
  }

  // Update node content
  updateContent(nodeId: string, content: string): boolean {
    const node = this.findNode(nodeId)
    if (!node) return false
    
    node.content = content
    node.wordCount = this.calculateWordCount(content)
    node.updatedAt = new Date().toISOString()
    
    // Update status based on content
    if (content.trim().length > 0) {
      if (node.status === 'draft') {
        node.status = 'in_progress'
      }
    }
    
    this.data.lastEditedAt = new Date().toISOString()
    this.rebuildFullDocument()
    this.recalculateStats()
    
    return true
  }

  // Update node summary
  updateSummary(nodeId: string, summary: string): boolean {
    const node = this.findNode(nodeId)
    if (!node) return false
    
    node.summary = summary
    node.updatedAt = new Date().toISOString()
    this.data.lastEditedAt = new Date().toISOString()
    
    return true
  }

  // Update node status
  updateStatus(nodeId: string, status: 'draft' | 'in_progress' | 'completed'): boolean {
    const node = this.findNode(nodeId)
    if (!node) return false
    
    node.status = status
    node.updatedAt = new Date().toISOString()
    this.data.lastEditedAt = new Date().toISOString()
    this.recalculateStats()
    
    return true
  }

  // Update theme color
  updateThemeColor(nodeId: string, color: string): boolean {
    const node = this.findNode(nodeId)
    if (!node) return false
    
    node.themeColor = color
    node.updatedAt = new Date().toISOString()
    
    return true
  }

  // Add a new node
  addNode(
    parentId: string | null,
    level: number,
    name: string,
    title?: string,
    order?: number
  ): DocumentNode {
    const newNode: DocumentNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      order: order ?? 0,
      name,
      title,
      content: '',
      wordCount: 0,
      status: 'draft',
      children: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    if (parentId === null) {
      this.data.structure.push(newNode)
    } else {
      const parent = this.findNode(parentId)
      if (parent) {
        parent.children.push(newNode)
      }
    }
    
    this.data.lastEditedAt = new Date().toISOString()
    this.rebuildFullDocument()
    this.recalculateStats()
    
    return newNode
  }

  // Delete a node
  deleteNode(nodeId: string): boolean {
    const deleteFromArray = (nodes: DocumentNode[]): boolean => {
      const index = nodes.findIndex(n => n.id === nodeId)
      if (index !== -1) {
        nodes.splice(index, 1)
        return true
      }
      
      for (const node of nodes) {
        if (deleteFromArray(node.children)) {
          return true
        }
      }
      
      return false
    }
    
    const deleted = deleteFromArray(this.data.structure)
    if (deleted) {
      this.data.lastEditedAt = new Date().toISOString()
      this.rebuildFullDocument()
      this.recalculateStats()
    }
    
    return deleted
  }

  // Rebuild full document from structure
  rebuildFullDocument(): void {
    this.data.fullDocument = buildFullDocument(this.data.structure, true)
    this.data.fullDocumentUpdatedAt = new Date().toISOString()
  }

  // Recalculate statistics
  private recalculateStats(): void {
    let totalWords = 0
    let totalSections = 0
    let completedSections = 0
    
    const traverse = (nodes: DocumentNode[]) => {
      for (const node of nodes) {
        totalSections++
        totalWords += node.wordCount
        
        if (node.status === 'completed' || (node.content && node.content.trim().length > 100)) {
          completedSections++
        }
        
        traverse(node.children)
      }
    }
    
    traverse(this.data.structure)
    
    this.data.totalWordCount = totalWords
    this.data.completionPercentage = totalSections > 0 ? (completedSections / totalSections) * 100 : 0
  }

  // Calculate word count from markdown
  private calculateWordCount(content: string): number {
    // Remove markdown syntax and count words
    const text = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/[#*_\[\]()]/g, '') // Remove markdown symbols
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim()
    
    if (!text) return 0
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  // Get all summaries (for orchestrator context)
  getAllSummaries(): Array<{ id: string; name: string; level: number; summary: string }> {
    const summaries: Array<{ id: string; name: string; level: number; summary: string }> = []
    
    const traverse = (nodes: DocumentNode[]) => {
      for (const node of nodes) {
        if (node.summary) {
          summaries.push({
            id: node.id,
            name: node.title || node.name,
            level: node.level,
            summary: node.summary
          })
        }
        traverse(node.children)
      }
    }
    
    traverse(this.data.structure)
    return summaries
  }

  // Generate summary for a specific node
  async generateSummaryForNode(nodeId: string): Promise<boolean> {
    const node = this.findNode(nodeId)
    if (!node) return false
    
    // Find parent for context
    const findParent = (nodes: DocumentNode[], targetId: string, parent: DocumentNode | null = null): DocumentNode | null => {
      for (const n of nodes) {
        if (n.id === targetId) return parent
        const found = findParent(n.children, targetId, n)
        if (found !== null) return found
      }
      return null
    }
    
    const parentNode = findParent(this.data.structure, nodeId)
    
    try {
      const result = await generateSummary({
        sectionId: node.id,
        sectionName: node.title || node.name,
        sectionLevel: node.level,
        content: node.content,
        parentSummary: parentNode?.summary,
        documentFormat: this.data.format
      })
      
      node.summary = result.summary
      node.updatedAt = new Date().toISOString()
      this.data.lastEditedAt = new Date().toISOString()
      
      return true
    } catch (error) {
      console.error('[DocumentManager] Failed to generate summary:', error)
      return false
    }
  }

  // Auto-generate all missing summaries
  async autoGenerateAllSummaries(onProgress?: (message: string) => void): Promise<number> {
    const count = await autoGenerateSummariesForDocument(
      this.data.structure,
      this.data.format,
      onProgress
    )
    
    if (count > 0) {
      this.data.lastEditedAt = new Date().toISOString()
    }
    
    return count
  }

  // Check which nodes need summary updates
  getNodesNeedingSummaries(): DocumentNode[] {
    const needsUpdate: DocumentNode[] = []
    
    const traverse = (nodes: DocumentNode[]) => {
      for (const node of nodes) {
        if (needsSummaryUpdate(node)) {
          needsUpdate.push(node)
        }
        traverse(node.children)
      }
    }
    
    traverse(this.data.structure)
    return needsUpdate
  }

  // Export as JSON
  toJSON(): string {
    return JSON.stringify(this.data, null, 2)
  }

  // Import from JSON
  static fromJSON(json: string): DocumentManager {
    const data = JSON.parse(json) as DocumentData
    return new DocumentManager(data)
  }
}

