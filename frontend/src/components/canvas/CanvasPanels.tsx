/**
 * CanvasPanels - Canvas panel components wrapper
 * 
 * This component coordinates the side panels for the canvas:
 * - NodeDetailsPanel: Shows node properties and the orchestrator chat
 * - AIDocumentPanel: Full document editing experience
 * 
 * =============================================================================
 * ARCHITECTURE DECISION: Direct Node Creation vs Hook
 * =============================================================================
 * 
 * We implement story node creation DIRECTLY here instead of using the 
 * `useCreateStoryNode` hook because:
 * 
 * 1. CanvasPanels is rendered as a SIBLING to CanvasViewport, not inside it
 * 2. ReactFlowProvider wraps CanvasViewport, not CanvasPanels
 * 3. Therefore, useReactFlow() hooks don't work here (zustand provider error)
 * 
 * Solution: We receive `onAddNode` and `onAddEdge` as props from page.tsx,
 * which has access to `canvasState.setNodes` and `canvasState.setEdges`.
 * 
 * =============================================================================
 * DATA FLOW: Orchestrator → Story Node → Document Panel
 * =============================================================================
 * 
 * 1. User types "Create a screenplay about X" in OrchestratorPanel
 * 2. Python backend generates structure with chapters/sections
 * 3. OrchestratorPanel receives structure → calls onCreateStoryNode(data)
 * 4. handleCreateStoryNode (this file):
 *    - Creates a new storyStructureNode with the structure data
 *    - Wires up onItemClick to enable the edit button
 *    - Adds node and edge to canvas via onAddNode/onAddEdge
 *    - Calls onStoryNodeCreated to notify parent
 * 5. page.tsx receives onStoryNodeCreated:
 *    - Sets documentState with the new node's data
 *    - Opens AIDocumentPanel automatically
 * 6. User can now edit the document or click the edit icon later to reopen
 * 
 * =============================================================================
 * COMPONENT HIERARCHY
 * =============================================================================
 * 
 * page.tsx (has canvasState with nodes/edges)
 *   ├── CanvasViewport (wrapped in ReactFlowProvider internally)
 *   │     └── ReactFlow canvas with nodes
 *   │
 *   └── CanvasPanels (this file - NOT inside ReactFlowProvider)
 *         ├── NodeDetailsPanel
 *         │     └── OrchestratorPanel (when orchestrator node selected)
 *         │           └── Calls handleCreateStoryNode when structure generated
 *         │
 *         └── AIDocumentPanel (document editing)
 * 
 * @see NodeDetailsPanel for node details UI and orchestrator integration
 * @see AIDocumentPanel for document editing UI
 * @see useCreateStoryNode for the hook version (only works inside ReactFlowProvider)
 * @see canvas/page.tsx for the parent component and state management
 */

/**
 * @updated 2024-12-11 - Removed WorldState (legacy frontend orchestration)
 * Deep agent architecture uses SSE streaming, not frontend WorldState
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Node, Edge } from 'reactflow'
import NodeDetailsPanel from '@/components/panels/NodeDetailsPanel'
import AIDocumentPanel from '@/components/panels/AIDocumentPanel'
import ProjectContentPanel from '@/components/panels/ProjectContentPanel'
import { StoryFormat, CharacterRole } from '@/types/nodes'
import { getOrchestratorNodeId, isOrchestratorNode } from '@/data/stories'
import type { CreateStoryNodeData } from '@/lib/orchestrator/components/OrchestratorPanel/types'
import type { CharacterCreatedEvent, CharacterUpdatedEvent, NodesArrangedEvent } from '@/types/orchestrator-streaming-types'
import type { FocusedContent } from '@/types/focused-content'
import { createClient } from '@/lib/supabase/client'

// Feature flag for new ProjectContentPanel
const USE_PROJECT_PANEL = process.env.NEXT_PUBLIC_USE_PROJECT_PANEL === 'true'

// =============================================================================
// PROPS INTERFACE
// =============================================================================

export interface CanvasPanelsProps {
  // ─────────────────────────────────────────────────────────────────────────
  // Story/Canvas Context
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 
   * The story ID from URL params. Used to:
   * - Compute orchestratorNodeId (context_${storyId})
   * - Scope chat history to this canvas
   */
  storyId: string
  
  /** User ID for saving nodes to database */
  userId?: string
  
  // ─────────────────────────────────────────────────────────────────────────
  // Node Selection & Panel State
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Currently selected node (for NodeDetailsPanel) */
  selectedNode: Node | null
  
  /** Whether NodeDetailsPanel is open */
  isPanelOpen: boolean
  
  /** Close NodeDetailsPanel */
  onClosePanel: () => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // Canvas Operations (passed from page.tsx which has canvasState)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Update a node's data */
  onNodeUpdate: (nodeId: string, newData: any) => void
  
  /** Delete a node */
  onNodeDelete: (nodeId: string) => void
  
  /** Legacy story creation (format-based) */
  onCreateStory: (format: StoryFormat, template?: string, userPromptDirect?: string, plan?: any) => Promise<void>
  
  /** 
   * Add a node to the canvas.
   * This is how we add nodes without useReactFlow() - page.tsx passes
   * a function that calls canvasState.setNodes()
   */
  onAddNode: (newNode: Node) => void
  
  /** 
   * Add an edge to the canvas.
   * Same pattern as onAddNode for edges.
   */
  onAddEdge: (newEdge: Edge) => void
  
  /**
   * Update multiple nodes at once (for batch operations like arrangement).
   * Pass a function that receives current nodes and returns updated nodes.
   */
  onSetNodes?: (updater: (nodes: Node[]) => Node[]) => void
  
  /** Current edges (for rendering and querying connections) */
  edges: Edge[]
  
  /** Current nodes (for finding orchestrator position, etc.) */
  nodes: Node[]
  
  // 2024-12-11: Removed worldState - was legacy frontend orchestration
  
  // ─────────────────────────────────────────────────────────────────────────
  // Document Selection & Navigation
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 
   * Select a node and optionally navigate to a section.
   * Called when user clicks edit button on story node.
   * Opens AIDocumentPanel with the document loaded.
   */
  onSelectNode: (nodeId: string, sectionId?: string) => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // Chat Operations (for OrchestratorPanel)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Add a message to the chat history */
  onAddChatMessage: (
    message: string, 
    role?: 'user' | 'orchestrator', 
    type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress',
    metadata?: {
      structured?: boolean
      format?: 'progress_list' | 'simple_list' | 'steps'
    }
  ) => void
  
  /** Clear chat history */
  onClearChat: () => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // Document Panel State
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Whether document view toggle is on (in NodeDetailsPanel) */
  isDocumentViewOpen: boolean
  
  /** Toggle document view */
  onToggleDocumentView: () => void
  
  /** Notify when panel width changes (for layout calculations) */
  onPanelWidthChange: (width: number) => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // Active Context (for contextual writing)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Currently active section/segment for contextual operations */
  activeContext: { type: 'section' | 'segment'; id: string; name: string } | null
  
  /** Clear the active context */
  onClearContext: () => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // Document Operations
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Write content to a specific segment */
  onWriteContent: (segmentId: string, prompt: string) => Promise<void>
  
  /** Answer a question about the content */
  onAnswerQuestion: (question: string) => Promise<string>
  
  /** Current structure items (chapters, sections, etc.) */
  structureItems: any[]
  
  /** Map of section ID to content */
  contentMap: Record<string, string>
  
  /** Currently loaded story structure node ID */
  currentStoryStructureNodeId: string | null
  
  /** Callback when section content is generated by orchestrator */
  onSectionComplete?: (sectionId: string, content: string) => void
  
  /** Streaming content - real-time content being written */
  streamingContent?: Record<string, { sectionId: string; content: string; isComplete: boolean }>
  
  /** Callback when a content chunk is received */
  onContentChunk?: (sectionId: string, chunk: string, accumulated: string) => void
  
  // ─────────────────────────────────────────────────────────────────────────
  // AIDocumentPanel State
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Whether AIDocumentPanel is open */
  isAIDocPanelOpen: boolean
  
  /** Close AIDocumentPanel */
  onCloseDocumentPanel: () => void
  
  /** Initial section to scroll to when opening */
  initialSectionId: string | null
  
  /** Character selection trigger (for opening character from canvas double-click) */
  selectedCharacterTrigger?: { nodeId: string; timestamp: number } | null
  
  /** Clear the character selection trigger after processing */
  onClearCharacterTrigger?: () => void
  
  /** Set character selection trigger (for orchestrator character view requests) */
  onSetCharacterTrigger?: (trigger: { nodeId: string; timestamp: number }) => void
  
  /** Update structure items for a node */
  onUpdateStructure: (nodeId: string, items: any[]) => void
  
  /** Width of orchestrator panel (for layout) */
  orchestratorPanelWidth: number
  
  /** Switch to a different document */
  onSwitchDocument: (nodeId: string) => void
  
  /** Set the active context */
  onSetContext: (context: { type: 'section' | 'segment'; id: string; name: string } | null) => void
  
  /** Callback when sections are loaded from database */
  onSectionsLoaded: (sections: Array<{ id: string; structure_item_id: string; content: string }>) => void
  
  /** Register a refresh function for sections */
  onRefreshSections: (refreshFn: () => Promise<void>) => void
  
  /** Ref to the refresh function (for triggering refresh from orchestrator) */
  refreshSectionsRef?: React.MutableRefObject<(() => Promise<void>) | null>
  
  // ─────────────────────────────────────────────────────────────────────────
  // Story Node Creation Callback
  // ─────────────────────────────────────────────────────────────────────────
  
  /** 
   * Called when a new story structure node is created.
   * 
   * @param nodeId - The ID of the newly created node
   * @param data - The structure data (format, items, label, logline, etc.)
   * 
   * page.tsx uses this to:
   * - Set documentState with the new structure
   * - Open AIDocumentPanel automatically
   * - Save the canvas
   */
  onStoryNodeCreated?: (nodeId: string, data: CreateStoryNodeData) => void
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Canvas panels component - coordinates NodeDetailsPanel and AIDocumentPanel
 */
export default function CanvasPanels(props: CanvasPanelsProps) {
  const {
    storyId,
    userId,  // ✅ FIX: Add userId to destructuring
    selectedNode,
    isPanelOpen,
    onClosePanel,
    onNodeUpdate,
    onNodeDelete,
    onCreateStory,
    onAddNode,
    onAddEdge,
    onSetNodes,
    edges,
    nodes,
    // 2024-12-11: Removed worldState
    onSelectNode,
    onAddChatMessage,
    onClearChat,
    isDocumentViewOpen,
    onToggleDocumentView,
    onPanelWidthChange,
    activeContext,
    onClearContext,
    onWriteContent,
    onAnswerQuestion,
    structureItems,
    contentMap,
    currentStoryStructureNodeId,
    onSectionComplete,
    streamingContent,
    onContentChunk,
    isAIDocPanelOpen,
    onCloseDocumentPanel,
    initialSectionId,
    selectedCharacterTrigger,
    onClearCharacterTrigger,
    onSetCharacterTrigger,
    onUpdateStructure,
    orchestratorPanelWidth,
    onSwitchDocument,
    onSetContext,
    onSectionsLoaded,
    onRefreshSections,
    refreshSectionsRef,
    onStoryNodeCreated
  } = props

  // Stable placement counter for AI-created character nodes.
  // Using `nodes` length directly can cause overlap when multiple CHARACTER_CREATED
  // events arrive before React state updates flush.
  const nextCharacterIndexRef = useRef<number>(0)
  const nodesRef = useRef<Node[]>(nodes)

  // Keep latest nodes for polling without recreating timers
  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  
  // ─────────────────────────────────────────────────────────────────────────
  // Computed Values
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Compute orchestrator node ID from story ID.
   * Format: "context_${storyId}" (e.g., "context_abc-123")
   * 
   * This ensures each canvas has a unique orchestrator node ID,
   * preventing primary key conflicts in the database.
   */
  const orchestratorNodeId = getOrchestratorNodeId(storyId)
  
  /**
   * Compute the active section card from the active context.
   * This provides the Librarian context to the orchestrator chat.
   */
  const activeSectionCard = useMemo(() => {
    if (!activeContext || activeContext.type !== 'section') {
      return null
    }
    
    // Find the structure item for the active section
    const item = structureItems.find(i => i.id === activeContext.id)
    if (!item) {
      return null
    }
    
    // Construct a section card object from the structure item
    // This matches the SectionCardDisplay type expected by the backend
    return {
      sectionId: item.id,
      sectionName: item.name || item.title || 'Section',
      summary: item.description || null,  // From structure generation
      wordCount: item.wordCount || 0,
      mood: null,  // Will be populated by Librarian after analysis
      characters: [],  // Will be populated by Librarian  
      keyMoments: [],  // Will be populated by Librarian
      dependencies: [],  // Will be populated by Librarian
      issues: [],  // Will be populated by Librarian
      analyzed: false,  // Not yet analyzed
    }
  }, [activeContext, structureItems])
  
  // ─────────────────────────────────────────────────────────────────────────
  // Focused Content State (for ProjectContentPanel)
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Track currently focused content in the ProjectContentPanel.
   * This is passed to the orchestrator for contextual commands like
   * "give this person another name" when viewing a character.
   */
  const [focusedContent, setFocusedContent] = useState<FocusedContent | null>(null)
  
  // ─────────────────────────────────────────────────────────────────────────
  // Story Node Creation
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Creates a story structure node on the canvas.
   * 
   * WHY WE DO THIS HERE:
   * We can't use the useCreateStoryNode hook because CanvasPanels is outside
   * ReactFlowProvider. Instead, we use onAddNode/onAddEdge props from page.tsx.
   * 
   * WHAT THIS DOES:
   * 1. Finds the orchestrator node to position the new node below it
   * 2. Creates a storyStructureNode with the generated structure
   * 3. Wires up onItemClick so the edit button opens AIDocumentPanel
   * 4. Creates an edge connecting orchestrator → story node
   * 5. Notifies page.tsx via onStoryNodeCreated
   * 
   * @param data - Structure data from the orchestrator:
   *   - format: 'novel' | 'screenplay' | 'podcast' | etc.
   *   - label: Story title (e.g., "The Last Lighthouse Keeper")
   *   - items: Array of structure items (chapters, scenes, etc.)
   *   - template: Template used (e.g., "heros-journey")
   *   - logline: Story summary
   */
  const handleCreateStoryNode = useCallback(async (data: CreateStoryNodeData) => {
    console.log('📐 [CanvasPanels] Creating story node:', data)
    
    // ─────────────────────────────────────────────────────────────────────
    // Step 1: Find orchestrator node for positioning
    // ─────────────────────────────────────────────────────────────────────
    
    let orchestratorNode = nodes.find(n => n.id === orchestratorNodeId)
    
    if (!orchestratorNode) {
      // Fallback: find any orchestrator node (for backwards compatibility)
      orchestratorNode = nodes.find(n => isOrchestratorNode(n.id))
    }
    
    if (!orchestratorNode) {
      console.error('❌ [CanvasPanels] Orchestrator node not found')
      return
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Step 2: Generate unique ID and position
    // Use backend-provided nodeId if available (ensures content storage alignment)
    // ─────────────────────────────────────────────────────────────────────
    
    const newNodeId = data.nodeId || `story-structure-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    console.log('📌 [CanvasPanels] Using node ID:', newNodeId, data.nodeId ? '(from backend)' : '(generated)')

    // Guard: If this node ID already exists on canvas, do NOT create a duplicate.
    // This can happen if the backend emits STRUCTURE_CREATED twice or the UI retries.
    if (nodes.some(n => n.id === newNodeId)) {
      console.warn('⚠️ [CanvasPanels] Story node already exists, skipping duplicate add:', newNodeId)

      // Ensure the orchestrator→story edge exists (safe to add if missing)
      const edgeId = `edge-${orchestratorNode.id}-${newNodeId}`
      if (!edges.some(e => e.id === edgeId)) {
        const dedupedEdge: Edge = {
          id: edgeId,
          source: orchestratorNode.id,
          target: newNodeId,
          type: 'default', // Smooth bezier curve
        }
        onAddEdge(dedupedEdge)
      }

      return newNodeId
    }
    
    // Position below and slightly left of orchestrator
    const newPosition = {
      x: orchestratorNode.position.x - 50,
      y: orchestratorNode.position.y + 400
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Step 3: Create the story structure node
    // ─────────────────────────────────────────────────────────────────────
    
    const newNode: Node = {
      id: newNodeId,
      type: 'storyStructureNode',
      position: newPosition,
      data: {
        nodeType: 'story-structure',
        label: data.label || 'Story Structure',
        format: data.format,
        template: data.template,
        logline: data.logline,
        items: data.items,
        comments: [],
        
        /**
         * onItemClick - Called when user clicks the edit button on the node.
         * 
         * This is what makes the pencil icon work! StoryStructureNode.tsx
         * has an edit button that calls this when clicked:
         * 
         *   if (onItemClick && items.length > 0) {
         *     const firstItem = items.find(item => item.level === 1) || items[0]
         *     onItemClick(firstItem, items, format, id)
         *   }
         * 
         * We forward this to onSelectNode which opens AIDocumentPanel.
         */
        onItemClick: (item: any, allItems: any[], format: string, nodeId: string) => {
          console.log('📝 [StoryStructureNode] Edit button clicked:', { nodeId, itemId: item?.id })
          onSelectNode(nodeId, item?.id)
        },
        
        /**
         * onItemsUpdate - Called when structure items are reordered/modified.
         * Forwards to page.tsx's onUpdateStructure to persist changes.
         */
        onItemsUpdate: (newItems: any[]) => {
          console.log('📝 [StoryStructureNode] Items updated:', newItems.length)
          onUpdateStructure(newNodeId, newItems)
        }
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────
    // Step 4: Create edge from orchestrator to story node
    // ─────────────────────────────────────────────────────────────────────
    
    const newEdge: Edge = {
      id: `edge-${orchestratorNode.id}-${newNodeId}`,
      source: orchestratorNode.id,
      target: newNodeId,
      type: 'default' // Smooth bezier curve
    }
    
    console.log('✅ [CanvasPanels] Adding node and edge:', { newNodeId, edgeId: newEdge.id })
    
    // ─────────────────────────────────────────────────────────────────────
    // Step 5: Add to canvas (React state)
    // ─────────────────────────────────────────────────────────────────────
    
    // These call canvasState.setNodes/setEdges in page.tsx
    onAddNode(newNode)
    onAddEdge(newEdge)
    
    // ─────────────────────────────────────────────────────────────────────
    // Step 6: Save node to database IMMEDIATELY (before opening document panel)
    // ─────────────────────────────────────────────────────────────────────
    // This ensures the node exists when useHierarchicalDocument tries to fetch it
    
    if (userId && storyId) {
      // Use async IIFE to handle the async save without blocking
      ;(async () => {
        try {
          console.log('💾 [CanvasPanels] Saving node to database immediately...')
          
          // Initialize document_data for the node
          const { DocumentManager } = await import('@/lib/document/DocumentManager')
          // Cast to any[] because CreateStoryNodeData uses a simpler StoryStructureItem type
          // that doesn't include 'order' field, but DocumentManager only needs id/name/level
          const docManager = DocumentManager.fromStructureItems(
            (data.items || []) as any[],
            (data.format as 'novel' | 'screenplay' | 'report') || 'novel'
          )
          
          // Save via API endpoint (bypasses RLS)
          const response = await fetch('/api/node/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeId: newNodeId,
              storyId,
              nodeType: 'storyStructure',
              data: newNode.data,
              documentData: docManager.getData(),
              positionX: newPosition.x,
              positionY: newPosition.y,
              userId
            })
          })
          
          const result = await response.json()
          
          if (!response.ok || !result.success) {
            console.error('❌ [CanvasPanels] Failed to save node:', result.error)
            throw new Error(`Failed to save node: ${result.error}`)
          }
          
          console.log('✅ [CanvasPanels] Node saved to database:', newNodeId)
          
          // ─────────────────────────────────────────────────────────────────────
          // Step 7: Notify parent (opens document panel AFTER node is saved)
          // ─────────────────────────────────────────────────────────────────────
          
          // Notify page.tsx so it can open AIDocumentPanel with the new document
          // Node is now in database, so useHierarchicalDocument can fetch it
          onStoryNodeCreated?.(newNodeId, data)
        } catch (error) {
          console.error('❌ [CanvasPanels] Error saving node:', error)
          // Continue anyway - node is in React state, will be saved on next canvas save
          // Still notify parent so UI can update
          onStoryNodeCreated?.(newNodeId, data)
        }
      })()
    } else {
      console.warn('⚠️ [CanvasPanels] userId or storyId missing - node not saved to DB yet')
      // Still notify parent even if we can't save yet
      onStoryNodeCreated?.(newNodeId, data)
    }
    
    return newNodeId
  }, [nodes, orchestratorNodeId, onAddNode, onAddEdge, onStoryNodeCreated, onSelectNode, onUpdateStructure, userId, storyId])
  
  // ─────────────────────────────────────────────────────────────────────────
  // handleCreateCharacterNode - Creates character node when AI creates/loads a character
  // ─────────────────────────────────────────────────────────────────────────
  
  /**
   * Creates a character node on the canvas when the AI creates or loads a character.
   * Characters are positioned ABOVE the orchestrator (as inputs/context sources).
   * 
   * @param data - CharacterCreatedEvent from the SSE stream
   */
  const handleCreateCharacterNode = useCallback((data: CharacterCreatedEvent) => {
    console.log('🎭 [CanvasPanels] Creating character node:', data.name)
    
    // Find orchestrator node for positioning
    let orchestratorNode = nodes.find(n => n.id === orchestratorNodeId)
    if (!orchestratorNode) {
      orchestratorNode = nodes.find(n => isOrchestratorNode(n.id))
    }
    if (!orchestratorNode) {
      console.error('❌ [CanvasPanels] Orchestrator node not found for character placement')
      return
    }
    
    // Check for duplicate
    if (nodes.some(n => n.id === data.node_id)) {
      console.warn('⚠️ [CanvasPanels] Character node already exists:', data.node_id)
      return
    }
    
    // Count existing character nodes above orchestrator for positioning
    const existingCharNodes = nodes.filter(n => {
      const nodeType = (n.data as any)?.nodeType
      return nodeType === 'character' && n.position.y < orchestratorNode!.position.y
    })
    
    // Position above orchestrator, spread horizontally in a stable grid.
    // Use a ref-based index so rapid multi-character creation doesn't overlap
    // when React state hasn't applied previous node additions yet.
    //
    // Layout:
    // - Up to MAX_PER_ROW characters per row
    // - Each row is centered over the orchestrator
    // - Additional characters wrap to the next row above
    const SPACING_X = 220
    const SPACING_Y = 220
    const MAX_PER_ROW = 5

    // Ensure counter starts at least at current existing count (covers refresh + pre-existing chars)
    if (nextCharacterIndexRef.current < existingCharNodes.length) {
      nextCharacterIndexRef.current = existingCharNodes.length
    }
    const index = nextCharacterIndexRef.current++
    const row = Math.floor(index / MAX_PER_ROW)
    const col = index % MAX_PER_ROW

    // Center the row over the orchestrator using fixed width (prevents drift)
    const rowStartX = orchestratorNode.position.x - ((MAX_PER_ROW - 1) / 2) * SPACING_X
    const newPosition = {
      x: rowStartX + col * SPACING_X,
      y: orchestratorNode.position.y - (row + 1) * SPACING_Y,
    }
    
    // Create character node
    // Use 'storyNode' type (renders via UniversalNode) with nodeType: 'character'
    // This matches how existing character nodes (Jonas, Leif, etc.) are created
    const newNode: Node = {
      id: data.node_id,
      type: 'storyNode',  // UniversalNode handles this based on nodeType
      position: newPosition,
      data: {
        nodeType: 'character',
        label: data.name,
        characterId: data.character_id,
        characterName: data.name,
        bio: data.bio || '',
        role: (data.role as CharacterRole) || 'Active',
        image: data.photo_url || undefined,  // UniversalNode uses 'image' for photos
        photoUrl: data.photo_url || undefined, // CharacterPanel expects photoUrl
        // Async portrait generation: pulse until photo arrives
        isGeneratingImage: !data.photo_url,
        visibility: data.visibility || 'private',
        attributes: data.attributes || {},
        profilerChat: data.profilerChat || [],
        comments: [],
      },
    }
    
    // Create edge FROM character TO orchestrator (character feeds context to orchestrator)
    const newEdge: Edge = {
      id: `edge-${data.node_id}-${orchestratorNode.id}`,
      source: data.node_id,
      target: orchestratorNode.id,
      // Use bezier curve (not elbow). CanvasViewport also defaults to 'default'.
      type: 'default',
    }
    
    console.log('✅ [CanvasPanels] Adding character node and edge:', data.node_id)
    onAddNode(newNode)
    onAddEdge(newEdge)

    // Persist immediately so refresh keeps the node/edge.
    // Mirrors handleCreateStoryNode's immediate persistence.
    if (userId && storyId) {
      ;(async () => {
        try {
          // 1) Save node (admin-backed endpoint bypasses RLS)
          const nodeRes = await fetch('/api/node/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeId: data.node_id,
              storyId,
              nodeType: 'storyNode',
              data: newNode.data,
              documentData: null,
              positionX: newPosition.x,
              positionY: newPosition.y,
              userId
            })
          })
          const nodeJson = await nodeRes.json()
          if (!nodeRes.ok || !nodeJson?.success) {
            console.error('❌ [CanvasPanels] Failed to persist character node:', nodeJson?.error)
          } else {
            console.log('✅ [CanvasPanels] Character node persisted:', data.node_id)
          }

          // 2) Save edge (admin-backed endpoint bypasses RLS)
          const edgeRes = await fetch('/api/edge/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              edgeId: newEdge.id,
              storyId,
              source: newEdge.source,
              target: newEdge.target,
              type: newEdge.type,
              animated: newEdge.animated ?? false,
              style: newEdge.style ?? null,
              userId
            })
          })
          const edgeJson = await edgeRes.json()
          if (!edgeRes.ok || !edgeJson?.success) {
            console.error('❌ [CanvasPanels] Failed to persist character edge:', edgeJson?.error)
          } else {
            console.log('✅ [CanvasPanels] Character edge persisted:', newEdge.id)
          }
        } catch (e) {
          console.error('❌ [CanvasPanels] Immediate character persistence failed:', e)
        }
      })()
    } else {
      console.warn('⚠️ [CanvasPanels] userId or storyId missing - character node not persisted yet')
    }
  }, [nodes, orchestratorNodeId, onAddNode, onAddEdge, userId, storyId])

  /**
   * Handler for CHARACTER_UPDATED SSE event.
   * Updates an existing character node's data on the canvas.
   * 
   * @param data - CharacterUpdatedEvent from the SSE stream
   */
  const handleUpdateCharacterNode = useCallback((data: CharacterUpdatedEvent) => {
    console.log('✏️ [CanvasPanels] Updating character node:', data.name, 'node_id:', data.node_id)
    
    // Find the existing node
    const existingNode = nodes.find(n => n.id === data.node_id)
    if (!existingNode) {
      console.warn('⚠️ [CanvasPanels] Character node not found for update:', data.node_id)
      return
    }
    
    // Merge the updates into existing data
    const updatedFields: Record<string, any> = {}
    if (data.name) updatedFields.name = data.name
    if (data.bio) updatedFields.bio = data.bio
    if (data.role) updatedFields.role = data.role
    if (data.attributes) {
      updatedFields.attributes = {
        ...(existingNode.data as any).attributes,
        ...data.attributes,
      }
    }
    
    // Update in React Flow using the existing onNodeUpdate
    onNodeUpdate?.(data.node_id, updatedFields)
    console.log('✅ [CanvasPanels] Character node updated in React Flow:', data.node_id, updatedFields)
  }, [nodes, onNodeUpdate])

  /**
   * Handler for NODES_ARRANGED SSE event.
   * Rearranges nodes on the canvas based on the specified layout and sort criteria.
   * 
   * Characters are positioned ABOVE the orchestrator (as inputs/context).
   * Stories are positioned BELOW the orchestrator (as outputs).
   * 
   * @param data - NodesArrangedEvent from the SSE stream
   */
  const handleArrangeNodes = useCallback((data: NodesArrangedEvent) => {
    console.log('📐 [CanvasPanels] Arranging nodes:', data)
    
    // Find orchestrator node as the anchor point
    const orchestratorNode = nodes.find(n => n.id === orchestratorNodeId)
    if (!orchestratorNode) {
      console.warn('⚠️ [CanvasPanels] Orchestrator node not found for arrangement')
      return
    }
    
    const orchestratorPos = orchestratorNode.position
    const nodeWidth = 120
    const nodeHeight = 150
    const horizontalGap = 40
    const verticalGap = 60
    
    // Collect nodes to arrange based on node_type
    let characterNodes = nodes.filter(n => 
      n.type === 'universalNode' && n.data?.nodeType === 'character'
    )
    let storyNodes = nodes.filter(n => 
      n.type === 'storyStructureNode' || n.data?.nodeType === 'story-structure'
    )
    
    // Sort function for nodes
    const sortNodes = (nodesToSort: typeof nodes, sortBy: string | undefined, ascending: boolean) => {
      if (!sortBy) return nodesToSort
      
      return [...nodesToSort].sort((a, b) => {
        let aVal: any
        let bVal: any
        
        // Get value based on sort_by field
        const getData = (n: typeof a) => n.data as any
        
        switch (sortBy.toLowerCase()) {
          case 'gender':
            aVal = getData(a)?.attributes?.gender || getData(a)?.gender || ''
            bVal = getData(b)?.attributes?.gender || getData(b)?.gender || ''
            break
          case 'role':
            aVal = getData(a)?.role || ''
            bVal = getData(b)?.role || ''
            break
          case 'age':
            aVal = parseInt(getData(a)?.attributes?.age || '0') || 0
            bVal = parseInt(getData(b)?.attributes?.age || '0') || 0
            break
          case 'openness':
          case 'conscientiousness':
          case 'extraversion':
          case 'agreeableness':
          case 'neuroticism':
            aVal = getData(a)?.attributes?.emotionalTraits?.[sortBy] || 50
            bVal = getData(b)?.attributes?.emotionalTraits?.[sortBy] || 50
            break
          case 'personality_type':
          case 'personalitytype':
            aVal = getData(a)?.attributes?.personalityType || ''
            bVal = getData(b)?.attributes?.personalityType || ''
            break
          case 'format':
            aVal = getData(a)?.format || ''
            bVal = getData(b)?.format || ''
            break
          case 'name':
          default:
            aVal = getData(a)?.name || getData(a)?.label || ''
            bVal = getData(b)?.name || getData(b)?.label || ''
        }
        
        // Compare values
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return ascending ? aVal - bVal : bVal - aVal
        }
        const cmp = String(aVal).localeCompare(String(bVal))
        return ascending ? cmp : -cmp
      })
    }
    
    // Group nodes by attribute value for clustering
    const groupNodes = (nodesToGroup: typeof nodes, groupBy: string) => {
      const groups: Record<string, typeof nodes> = {}
      
      nodesToGroup.forEach(n => {
        const data = n.data as any
        let value: string
        
        switch (groupBy.toLowerCase()) {
          case 'gender':
            value = data?.attributes?.gender || data?.gender || 'Unknown'
            break
          case 'role':
            value = data?.role || 'Unknown'
            break
          case 'format':
            value = data?.format || 'Unknown'
            break
          default:
            value = 'All'
        }
        
        if (!groups[value]) groups[value] = []
        groups[value].push(n)
      })
      
      return groups
    }
    
    // Calculate positions based on layout
    const newPositions: Record<string, { x: number; y: number }> = {}
    
    // Position CHARACTERS (above orchestrator)
    if (data.node_type === 'character' || data.node_type === 'all') {
      if (data.sort_by) {
        characterNodes = sortNodes(characterNodes, data.sort_by, data.ascending)
      }
      
      if (data.layout === 'clusters' && data.sort_by) {
        // Cluster layout - group by attribute
        const groups = groupNodes(characterNodes, data.sort_by)
        const groupNames = Object.keys(groups).sort()
        
        let clusterStartX = orchestratorPos.x - ((groupNames.length - 1) * (nodeWidth * 2 + horizontalGap * 2)) / 2
        
        groupNames.forEach((groupName, groupIndex) => {
          const groupNodes = groups[groupName]
          const nodesPerRow = Math.ceil(Math.sqrt(groupNodes.length))
          
          groupNodes.forEach((node, index) => {
            const row = Math.floor(index / nodesPerRow)
            const col = index % nodesPerRow
            
            newPositions[node.id] = {
              x: clusterStartX + groupIndex * (nodeWidth * 2 + horizontalGap * 2) + col * (nodeWidth + horizontalGap),
              y: orchestratorPos.y - 250 - row * (nodeHeight + verticalGap)
            }
          })
        })
      } else if (data.layout === 'horizontal') {
        // Horizontal line layout
        const startX = orchestratorPos.x - ((characterNodes.length - 1) * (nodeWidth + horizontalGap)) / 2
        
        characterNodes.forEach((node, index) => {
          newPositions[node.id] = {
            x: startX + index * (nodeWidth + horizontalGap),
            y: orchestratorPos.y - 200
          }
        })
      } else {
        // Grid layout (default)
        const nodesPerRow = Math.max(3, Math.ceil(Math.sqrt(characterNodes.length)))
        const startX = orchestratorPos.x - ((nodesPerRow - 1) * (nodeWidth + horizontalGap)) / 2
        
        characterNodes.forEach((node, index) => {
          const row = Math.floor(index / nodesPerRow)
          const col = index % nodesPerRow
          
          newPositions[node.id] = {
            x: startX + col * (nodeWidth + horizontalGap),
            y: orchestratorPos.y - 250 - row * (nodeHeight + verticalGap)
          }
        })
      }
    }
    
    // Position STORIES (below orchestrator)
    if (data.node_type === 'story' || data.node_type === 'all') {
      if (data.sort_by) {
        storyNodes = sortNodes(storyNodes, data.sort_by, data.ascending)
      }
      
      const nodesPerRow = Math.max(3, Math.ceil(Math.sqrt(storyNodes.length)))
      const startX = orchestratorPos.x - ((Math.min(nodesPerRow, storyNodes.length) - 1) * (nodeWidth + horizontalGap)) / 2
      
      storyNodes.forEach((node, index) => {
        const row = Math.floor(index / nodesPerRow)
        const col = index % nodesPerRow
        
        newPositions[node.id] = {
          x: startX + col * (nodeWidth + horizontalGap),
          y: orchestratorPos.y + 200 + row * (nodeHeight + verticalGap)
        }
      })
    }
    
    // Apply new positions to nodes
    console.log('📐 [CanvasPanels] New positions:', newPositions)
    
    if (onSetNodes) {
      onSetNodes(currentNodes => 
        currentNodes.map(node => {
          if (newPositions[node.id]) {
            return {
              ...node,
              position: newPositions[node.id]
            }
          }
          return node
        })
      )
      console.log('✅ [CanvasPanels] Nodes arranged successfully')
    } else {
      console.warn('⚠️ [CanvasPanels] onSetNodes not provided, cannot arrange nodes')
    }
  }, [nodes, orchestratorNodeId, onSetNodes])

  // ─────────────────────────────────────────────────────────────────────────
  // Async portrait polling (client-side)
  // ─────────────────────────────────────────────────────────────────────────
  // Backend generates photo_url asynchronously after create_character.
  // We poll the characters table for pending characterIds and update the node
  // + persist node.data.image once the portrait is ready.
  useEffect(() => {
    if (!userId || !storyId) return

    const supabase = createClient()
    let cancelled = false

    const tick = async () => {
      if (cancelled) return

      const pendingNodes = (nodesRef.current || []).filter((n: any) => {
        const d = n?.data || {}
        return (
          d?.nodeType === 'character' &&
          !!d?.characterId &&
          !d?.image &&
          d?.isGeneratingImage === true
        )
      })

      if (pendingNodes.length === 0) return

      const ids = Array.from(new Set(pendingNodes.map((n: any) => n.data.characterId).filter(Boolean)))
      if (ids.length === 0) return

      try {
        // First: check if backend has marked failure on node.data (stops infinite pulsing)
        try {
          const nodeIds = pendingNodes.map((n: any) => n.id)
          const { data: nodeRows, error: nodeErr } = await supabase
            .from('nodes')
            .select('id, data')
            .eq('story_id', storyId)
            .in('id', nodeIds)

          if (!nodeErr && Array.isArray(nodeRows)) {
            for (const row of nodeRows) {
              const d = (row as any)?.data
              const isGen = d?.isGeneratingImage
              const errCode = d?.imageGenerationError
              if (isGen === false && errCode) {
                onNodeUpdate?.(row.id, {
                  isGeneratingImage: false,
                  imageGenerationError: errCode,
                })
              }
            }
          }
        } catch {
          // Non-fatal; we'll still check characters.photo_url below
        }

        const { data, error } = await supabase
          .from('characters')
          .select('id, photo_url')
          .in('id', ids)

        if (error) {
          console.warn('⚠️ [CanvasPanels] Portrait poll failed:', error)
          return
        }

        const ready = (data || []).filter((c: any) => !!c?.photo_url)
        if (ready.length === 0) return

        for (const c of ready) {
          const url = c.photo_url as string
          const affected = pendingNodes.filter((n: any) => n.data.characterId === c.id)
          for (const n of affected) {
            // Update local state
            onNodeUpdate?.(n.id, {
              image: url,
              photoUrl: url,
              isGeneratingImage: false,
            })

            // Persist node data immediately (so refresh shows portrait even if user doesn't save)
            try {
              const merged = { ...(n.data || {}), image: url, photoUrl: url, isGeneratingImage: false }
              await fetch('/api/node/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nodeId: n.id,
                  storyId,
                  userId,
                  updates: { data: merged },
                }),
              })
            } catch (e) {
              console.warn('⚠️ [CanvasPanels] Failed to persist portrait node update:', e)
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ [CanvasPanels] Portrait poll tick error:', e)
      }
    }

    // Poll every ~2.5s while there are pending nodes
    const interval = setInterval(() => {
      tick()
    }, 2500)

    // Kick once immediately
    tick()

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [userId, storyId, onNodeUpdate])
  
  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  
  return (
    <>
      {/* 
        NodeDetailsPanel - Right side panel showing node properties.
        When an orchestrator node is selected, this renders OrchestratorPanel
        which handles the chat interface and story generation.
      */}
      <NodeDetailsPanel
        node={selectedNode}
        isOpen={isPanelOpen}
        onClose={onClosePanel}
        onUpdate={onNodeUpdate}
        onDelete={onNodeDelete}
        onCreateStory={onCreateStory}
        onAddNode={onAddNode}
        onAddEdge={onAddEdge}
        edges={edges}
        nodes={nodes}
        // 2024-12-11: Removed worldState
        onSelectNode={onSelectNode}
        onAddChatMessage={onAddChatMessage}
        onClearChat={onClearChat}
        onToggleDocumentView={onToggleDocumentView}
        isDocumentViewOpen={isDocumentViewOpen}
        onPanelWidthChange={onPanelWidthChange}
        activeContext={activeContext}
        onClearContext={onClearContext}
        onWriteContent={onWriteContent}
        onAnswerQuestion={onAnswerQuestion}
        structureItems={structureItems}
        contentMap={contentMap}
        currentStoryStructureNodeId={currentStoryStructureNodeId}
        activeSectionCard={activeSectionCard}
        focusedContent={focusedContent}
        // New props for orchestrator integration
        storyId={storyId}
        orchestratorNodeId={orchestratorNodeId}
        onCreateStoryNode={handleCreateStoryNode}
        onCreateCharacterNode={handleCreateCharacterNode}
        onUpdateCharacterNode={handleUpdateCharacterNode}
        onArrangeNodes={handleArrangeNodes}
        onSelectCharacter={(characterName: string) => {
          // Find character node by name and trigger selection
          const charNode = nodes.find(n => {
            if (n.data?.nodeType !== 'character') return false
            const nodeName = (n.data?.label || n.data?.characterName || n.data?.name || '').toLowerCase()
            return nodeName.toLowerCase() === characterName.toLowerCase()
          })
          if (charNode && onSetCharacterTrigger) {
            console.log('📂 [CanvasPanels] Selecting character from orchestrator:', characterName, charNode.id)
            // Set the character trigger to open the character in ProjectContentPanel
            onSetCharacterTrigger({ nodeId: charNode.id, timestamp: Date.now() })
          }
        }}
        onSectionComplete={onSectionComplete}
        onContentChunk={onContentChunk}
        onContentComplete={async (sectionId: string, wordCount: number) => {
          console.log('🔄 [CanvasPanels] Content complete, triggering document refresh for:', sectionId, wordCount, 'words')
          // Trigger document refresh via the ref
          if (refreshSectionsRef?.current) {
            console.log('🔄 [CanvasPanels] Calling refreshSectionsRef.current()')
            await refreshSectionsRef.current()
            console.log('✅ [CanvasPanels] Document refreshed')
          } else {
            console.warn('⚠️ [CanvasPanels] refreshSectionsRef not available')
          }
        }}
      />

      {/* 
        Document Panel - Full document editing experience.
        Opens when user:
        - Creates a new story (via onStoryNodeCreated callback)
        - Clicks edit button on a story node (via onItemClick → onSelectNode)
        
        Key prop: currentStoryStructureNodeId determines which document to show.
        Force re-mount when document changes using key prop.
        
        Feature flag USE_PROJECT_PANEL switches between:
        - AIDocumentPanel (legacy): Document-focused with Tree/Cards toggle
        - ProjectContentPanel (new): Project-centric with unified tree for stories/characters/research
      */}
      {USE_PROJECT_PANEL ? (
        <ProjectContentPanel
          key={currentStoryStructureNodeId || 'no-document'}
          isOpen={isAIDocPanelOpen}
          onClose={onCloseDocumentPanel}
          storyStructureNodeId={currentStoryStructureNodeId}
          structureItems={structureItems}
          contentMap={contentMap}
          streamingContent={streamingContent}
          initialSectionId={initialSectionId}
          selectedCharacterTrigger={selectedCharacterTrigger}
          onClearCharacterTrigger={onClearCharacterTrigger}
          onUpdateStructure={onUpdateStructure}
          canvasEdges={edges}
          canvasNodes={nodes}
          orchestratorPanelWidth={orchestratorPanelWidth}
          onSwitchDocument={onSwitchDocument}
          onSetContext={onSetContext}
          onSectionsLoaded={onSectionsLoaded}
          onRefreshSections={onRefreshSections}
          onFocusedContentChange={setFocusedContent}
          userId={userId}
          storyId={storyId}
          onNodeUpdate={onNodeUpdate}
          onNodeDelete={onNodeDelete}
        />
      ) : (
        <AIDocumentPanel
          key={currentStoryStructureNodeId || 'no-document'}
          isOpen={isAIDocPanelOpen}
          onClose={onCloseDocumentPanel}
          storyStructureNodeId={currentStoryStructureNodeId}
          structureItems={structureItems}
          contentMap={contentMap}
          streamingContent={streamingContent}
          initialSectionId={initialSectionId}
          onUpdateStructure={onUpdateStructure}
          canvasEdges={edges}
          canvasNodes={nodes}
          orchestratorPanelWidth={orchestratorPanelWidth}
          onSwitchDocument={onSwitchDocument}
          onSetContext={onSetContext}
          onSectionsLoaded={onSectionsLoaded}
          onRefreshSections={onRefreshSections}
        />
      )}
    </>
  )
}