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

import React, { useCallback, useMemo } from 'react'
import { Node, Edge } from 'reactflow'
import NodeDetailsPanel from '@/components/panels/NodeDetailsPanel'
import AIDocumentPanel from '@/components/panels/AIDocumentPanel'
import { StoryFormat } from '@/types/nodes'
import { getOrchestratorNodeId, isOrchestratorNode } from '@/data/stories'
import type { CreateStoryNodeData } from '@/lib/orchestrator/components/OrchestratorPanel/types'

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
    onUpdateStructure,
    orchestratorPanelWidth,
    onSwitchDocument,
    onSetContext,
    onSectionsLoaded,
    onRefreshSections,
    refreshSectionsRef,
    onStoryNodeCreated
  } = props
  
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
      type: 'smoothstep' // Curved connector line
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
        // New props for orchestrator integration
        storyId={storyId}
        orchestratorNodeId={orchestratorNodeId}
        onCreateStoryNode={handleCreateStoryNode}
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
        AIDocumentPanel - Full document editing experience.
        Opens when user:
        - Creates a new story (via onStoryNodeCreated callback)
        - Clicks edit button on a story node (via onItemClick → onSelectNode)
        
        Key prop: currentStoryStructureNodeId determines which document to show.
        Force re-mount when document changes using key prop.
      */}
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
    </>
  )
}