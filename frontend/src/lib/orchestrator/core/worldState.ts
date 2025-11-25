/**
 * WorldState - Unified representation of application state
 * 
 * The orchestrator owns this state and all tools operate on it.
 * This replaces the scattered 15+ props in OrchestratorRequest.
 * 
 * Benefits:
 * - Single source of truth
 * - Observable for reactive UI updates
 * - Versioned for time-travel debugging
 * - Efficient queries with Map data structures
 */

import { Node, Edge } from 'reactflow'
import type { TieredModel } from './modelRouter'

// ============================================================
// TYPES
// ============================================================

export interface WorldState {
  // Canvas Layer - All nodes and edges on the visual canvas
  canvas: {
    nodes: Map<string, CanvasNode>
    edges: Map<string, CanvasEdge>
    selectedNodeId: string | null
  }
  
  // Document Layer - Currently open document (if any)
  activeDocument: {
    nodeId: string | null
    format: string | null // 'novel', 'screenplay', 'report', etc.
    structure: DocumentStructure | null
    content: Map<string, string> // sectionId -> content
    selectedSectionId: string | null
  }
  
  // UI Layer - Current UI state
  ui: {
    documentPanelOpen: boolean
    orchestratorPanelOpen: boolean
    lastUserAction: string | null
    timestamp: number
  }
  
  // User Context - User preferences and capabilities
  user: {
    id: string
    availableProviders: string[]
    availableModels: TieredModel[]
    preferences: {
      modelMode: 'automatic' | 'fixed'
      fixedModelId: string | null
      fixedModeStrategy?: 'consistent' | 'loose'
    }
    apiKeys: {
      orchestratorKeyId?: string // For structure generation
    }
  }
  
  // Metadata - State versioning and tracking
  meta: {
    version: number
    lastUpdated: number
    isDirty: boolean
  }
}

export interface CanvasNode {
  id: string
  type: string
  label: string
  format?: string
  position: { x: number; y: number }
  data: any // Original ReactFlow node data
  
  // Cached context for quick access (populated from data)
  summary?: string
  wordCount?: number
  hasContent?: boolean
  structure?: any // Document structure if story node
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  type?: string
  data?: any
}

export interface DocumentStructure {
  items: Array<{
    id: string
    name: string
    level: number
    parentId: string | null
    order: number
    wordCount?: number
  }>
  hierarchy: string // 'novel', 'screenplay', 'report', etc.
}

// ============================================================
// WORLD STATE MANAGER
// ============================================================

export class WorldStateManager {
  private state: WorldState
  private observers: Set<(state: WorldState) => void> = new Set()
  
  constructor(initialState?: Partial<WorldState>) {
    this.state = this.normalize(initialState || {})
  }
  
  /**
   * Get entire state (read-only)
   * Returns a frozen deep clone to prevent accidental mutations
   */
  getState(): Readonly<WorldState> {
    return Object.freeze(this.deepClone(this.state))
  }
  
  /**
   * Update state transactionally
   * 
   * Usage:
   * worldState.update(draft => {
   *   draft.canvas.selectedNodeId = 'node-123'
   *   draft.ui.documentPanelOpen = true
   * })
   */
  update(updater: (draft: WorldState) => void): void {
    // Apply updates to mutable draft
    updater(this.state)
    
    // Update metadata
    this.state.meta.version += 1
    this.state.meta.lastUpdated = Date.now()
    this.state.meta.isDirty = true
    
    // Notify observers
    this.notifyObservers()
  }
  
  /**
   * Reset dirty flag (e.g., after saving to database)
   */
  markClean(): void {
    this.state.meta.isDirty = false
  }
  
  // ============================================================
  // QUERY HELPERS
  // ============================================================
  
  /**
   * Get a specific canvas node by ID
   */
  getNode(nodeId: string): CanvasNode | null {
    return this.state.canvas.nodes.get(nodeId) || null
  }
  
  /**
   * Get all canvas nodes as array
   */
  getAllNodes(): CanvasNode[] {
    return Array.from(this.state.canvas.nodes.values())
  }
  
  /**
   * Get all edges as array
   */
  getAllEdges(): CanvasEdge[] {
    return Array.from(this.state.canvas.edges.values())
  }
  
  /**
   * Get currently active document context
   */
  getActiveDocument(): WorldState['activeDocument'] {
    return this.state.activeDocument
  }
  
  /**
   * Get canvas context (nodes + edges) - useful for contextProvider
   */
  getCanvasContext(): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges()
    }
  }
  
  /**
   * Get nodes connected to a specific node via edges
   */
  getConnectedNodes(nodeId: string): CanvasNode[] {
    const connectedIds = new Set<string>()
    
    for (const edge of this.state.canvas.edges.values()) {
      if (edge.source === nodeId) {
        connectedIds.add(edge.target)
      }
      if (edge.target === nodeId) {
        connectedIds.add(edge.source)
      }
    }
    
    return Array.from(connectedIds)
      .map(id => this.getNode(id))
      .filter((node): node is CanvasNode => node !== null)
  }
  
  /**
   * Get user preferences
   */
  getUserPreferences(): WorldState['user']['preferences'] {
    return this.state.user.preferences
  }
  
  /**
   * Check if document panel is open
   */
  isDocumentPanelOpen(): boolean {
    return this.state.ui.documentPanelOpen
  }
  
  /**
   * Get active section ID (if any)
   */
  getActiveSectionId(): string | null {
    return this.state.activeDocument.selectedSectionId
  }
  
  // ============================================================
  // OBSERVABLE PATTERN
  // ============================================================
  
  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   * 
   * Usage:
   * const unsubscribe = worldState.subscribe(newState => {
   *   console.log('State updated:', newState)
   * })
   * // Later: unsubscribe()
   */
  subscribe(callback: (state: WorldState) => void): () => void {
    this.observers.add(callback)
    return () => this.observers.delete(callback)
  }
  
  private notifyObservers(): void {
    const frozenState = this.getState()
    this.observers.forEach(callback => {
      try {
        callback(frozenState)
      } catch (error) {
        console.error('[WorldState] Observer callback error:', error)
      }
    })
  }
  
  // ============================================================
  // INTERNAL HELPERS
  // ============================================================
  
  /**
   * Normalize partial state into complete WorldState
   */
  private normalize(partial: Partial<WorldState>): WorldState {
    return {
      canvas: {
        nodes: new Map(partial.canvas?.nodes || []),
        edges: new Map(partial.canvas?.edges || []),
        selectedNodeId: partial.canvas?.selectedNodeId || null
      },
      activeDocument: {
        nodeId: partial.activeDocument?.nodeId || null,
        format: partial.activeDocument?.format || null,
        structure: partial.activeDocument?.structure || null,
        content: new Map(partial.activeDocument?.content || []),
        selectedSectionId: partial.activeDocument?.selectedSectionId || null
      },
      ui: {
        documentPanelOpen: partial.ui?.documentPanelOpen || false,
        orchestratorPanelOpen: partial.ui?.orchestratorPanelOpen !== undefined 
          ? partial.ui.orchestratorPanelOpen 
          : true,
        lastUserAction: partial.ui?.lastUserAction || null,
        timestamp: partial.ui?.timestamp || Date.now()
      },
      user: {
        id: partial.user?.id || '',
        availableProviders: partial.user?.availableProviders || [],
        availableModels: partial.user?.availableModels || [],
        preferences: {
          modelMode: partial.user?.preferences?.modelMode || 'automatic',
          fixedModelId: partial.user?.preferences?.fixedModelId || null,
          fixedModeStrategy: partial.user?.preferences?.fixedModeStrategy
        },
        apiKeys: {
          orchestratorKeyId: partial.user?.apiKeys?.orchestratorKeyId
        }
      },
      meta: {
        version: partial.meta?.version || 1,
        lastUpdated: partial.meta?.lastUpdated || Date.now(),
        isDirty: partial.meta?.isDirty || false
      }
    }
  }
  
  /**
   * Deep clone with support for Map objects
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    
    if (obj instanceof Map) {
      return new Map(Array.from(obj.entries()).map(([k, v]) => [k, this.deepClone(v)]))
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item))
    }
    
    const cloned: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key])
      }
    }
    return cloned
  }
  
  // ============================================================
  // DEBUG HELPERS
  // ============================================================
  
  /**
   * Log current state to console (dev only)
   */
  debug(): void {
    console.log('[WorldState] Debug snapshot:', {
      version: this.state.meta.version,
      canvasNodes: this.state.canvas.nodes.size,
      canvasEdges: this.state.canvas.edges.size,
      activeDocumentId: this.state.activeDocument.nodeId,
      selectedSectionId: this.state.activeDocument.selectedSectionId,
      documentPanelOpen: this.state.ui.documentPanelOpen,
      userId: this.state.user.id,
      isDirty: this.state.meta.isDirty
    })
  }
  
  /**
   * Export state as plain object (for serialization)
   */
  toJSON(): any {
    return {
      canvas: {
        nodes: Array.from(this.state.canvas.nodes.entries()),
        edges: Array.from(this.state.canvas.edges.entries()),
        selectedNodeId: this.state.canvas.selectedNodeId
      },
      activeDocument: {
        ...this.state.activeDocument,
        content: Array.from(this.state.activeDocument.content.entries())
      },
      ui: this.state.ui,
      user: this.state.user,
      meta: this.state.meta
    }
  }
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build WorldState from ReactFlow nodes and edges (for migration)
 */
export function buildWorldStateFromReactFlow(
  nodes: Node[],
  edges: Edge[],
  userId: string,
  additionalContext?: {
    activeDocumentNodeId?: string | null
    selectedSectionId?: string | null
    isDocumentPanelOpen?: boolean
    availableProviders?: string[]
    availableModels?: TieredModel[]
    modelPreferences?: {
      modelMode?: 'automatic' | 'fixed'
      fixedModelId?: string | null
      fixedModeStrategy?: 'consistent' | 'loose'
    }
    orchestratorKeyId?: string
  }
): WorldStateManager {
  // Convert ReactFlow nodes to CanvasNodes
  const canvasNodes = new Map<string, CanvasNode>(
    nodes.map(node => [
      node.id,
      {
        id: node.id,
        type: node.type || 'default',
        label: node.data?.label || node.data?.name || 'Untitled',
        format: node.data?.format,
        position: node.position,
        data: node.data,
        summary: node.data?.summary,
        wordCount: node.data?.document_data?.totalWordCount || node.data?.wordCount,
        hasContent: !!node.data?.document_data || !!node.data?.contentMap,
        structure: node.data?.document_data?.structure || node.data?.items
      }
    ])
  )
  
  // Convert ReactFlow edges to CanvasEdges
  const canvasEdges = new Map<string, CanvasEdge>(
    edges.map(edge => [
      edge.id,
      {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        data: edge.data
      }
    ])
  )
  
  // Build active document context if provided
  let activeDocument: WorldState['activeDocument'] = {
    nodeId: null,
    format: null,
    structure: null,
    content: new Map(),
    selectedSectionId: null
  }
  
  if (additionalContext?.activeDocumentNodeId) {
    const activeNode = canvasNodes.get(additionalContext.activeDocumentNodeId)
    if (activeNode) {
      activeDocument = {
        nodeId: activeNode.id,
        format: activeNode.format || null,
        structure: activeNode.structure ? {
          items: Array.isArray(activeNode.structure) ? activeNode.structure : [],
          hierarchy: activeNode.format || 'unknown'
        } : null,
        content: new Map(), // Content will be loaded separately
        selectedSectionId: additionalContext?.selectedSectionId || null
      }
    }
  }
  
  return new WorldStateManager({
    canvas: {
      nodes: canvasNodes,
      edges: canvasEdges,
      selectedNodeId: null
    },
    activeDocument,
    ui: {
      documentPanelOpen: additionalContext?.isDocumentPanelOpen || false,
      orchestratorPanelOpen: true,
      lastUserAction: null,
      timestamp: Date.now()
    },
    user: {
      id: userId,
      availableProviders: additionalContext?.availableProviders || [],
      availableModels: additionalContext?.availableModels || [],
      preferences: {
        modelMode: additionalContext?.modelPreferences?.modelMode || 'automatic',
        fixedModelId: additionalContext?.modelPreferences?.fixedModelId || null,
        fixedModeStrategy: additionalContext?.modelPreferences?.fixedModeStrategy
      },
      apiKeys: {
        orchestratorKeyId: additionalContext?.orchestratorKeyId
      }
    },
    meta: {
      version: 1,
      lastUpdated: Date.now(),
      isDirty: false
    }
  })
}

