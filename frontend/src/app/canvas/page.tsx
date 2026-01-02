/**
 * Canvas Page - Refactored Version
 * 
 * This is the refactored canvas page using extracted hooks, services, and components.
 * 
 * Architecture:
 * - Hooks: State management (useCanvasState, useWorldStateSync, useDocumentState, useCanvasData, useCanvasSharing)
 * - Services: Business logic (canvasService, documentService, orchestrationService)
 * - Components: UI presentation (CanvasHeader, CanvasViewport, CanvasPanels)
 * 
 * @see hooks/canvas/ for state management hooks
 * @see services/canvas/ for business logic services
 * @see components/canvas/ for UI components
 */

'use client'

import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { Node, Edge, Connection, addEdge } from 'reactflow'
import type { StoryFormat, StoryStructureNodeData, NodeType } from '@/types/nodes'
import { createStory, deleteStory } from '@/lib/stories'
import { isOrchestratorNode } from '@/data/stories'

// Hooks
import { useCanvasState } from '@/hooks/canvas/useCanvasState'
// 2024-12-11: Removed useWorldStateSync - was legacy frontend orchestration
import { useDocumentState } from '@/hooks/canvas/useDocumentState'
import { useCanvasData } from '@/hooks/canvas/useCanvasData'
import { useCanvasSharing } from '@/hooks/canvas/useCanvasSharing'

// Services
import { createStoryStructureNode, updateNodeData, deleteNode, addNewNode } from '@/services/canvas/canvasService'
import { updateStructureItems, switchDocument, writeContent, answerQuestion } from '@/services/canvas/documentService'
// DEPRECATED: Legacy orchestration moved to Python backend
// The new flow uses OrchestratorPanel → backendClient.ts → Python API
// import { triggerOrchestratedGeneration } from '@/services/canvas/orchestrationService'

// Components
import CanvasHeader from '@/components/canvas/CanvasHeader'
import CanvasViewport from '@/components/canvas/CanvasViewport'
import CanvasPanels from '@/components/canvas/CanvasPanels'
import type { CreateStoryNodeData } from '@/lib/orchestrator/components/OrchestratorPanel/types'

// Node types
import UniversalNode from '@/components/canvas/UniversalNode'
import OrchestratorNode from '@/components/nodes/OrchestratorNode'
import StoryDraftNode from '@/components/nodes/StoryDraftNode'
import StoryStructureNode from '@/components/nodes/StoryStructureNode'
import ClusterNode from '@/components/nodes/ClusterNode'
import TestNode from '@/components/nodes/TestNode'
import AIPromptNode from '@/components/nodes/AIPromptNode'

// nodeTypes - Defined outside component to prevent React Flow warning
// about recreating on each render. Since it's outside the component,
// the object reference is stable and React Flow won't complain.
const nodeTypes = {
  storyNode: UniversalNode,
  createStoryNode: OrchestratorNode, // Legacy support
  orchestratorNode: OrchestratorNode,
  storyDraftNode: StoryDraftNode,
  storyStructureNode: StoryStructureNode,
  clusterNode: ClusterNode,
  testNode: TestNode,
  aiPromptNode: AIPromptNode,
}

// Initial nodes for fresh canvas
const initialNodes: Node[] = [
  {
    id: 'context',
    type: 'orchestratorNode',
    position: { x: 250, y: 500 },
    data: {
      label: 'Orchestrator',
      comments: [],
      nodeType: 'create-story' as NodeType,
      onCreateStory: (format: StoryFormat) => {
        console.warn('onCreateStory called before ref was set')
      }
    },
  },
]

const initialEdges: Edge[] = []

export default function CanvasPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storyId = searchParams.get('id')
  
  // ✅ FIX: Create Supabase client ONCE at component level (maintains auth session)
  const supabaseClient = useMemo(() => createClient(), [])
  
  // ============================================================
  // REFS: Callback Storage (to break circular dependencies)
  // ============================================================
  
  // Store callbacks in refs so they can be updated after hooks are initialized
  const callbacksRef = useRef<{
    handleStructureItemClick?: (item: any, allItems: any[], format: StoryFormat, nodeId: string) => Promise<void>
    handleStructureItemsUpdate?: (nodeId: string, items: any[]) => void
    handleNodeUpdate?: (nodeId: string, newData: any) => void
    handleAgentAssign?: (itemId: string, agentId: string | null) => void
    setCanvasVisibility?: (visibility: 'private' | 'shared' | 'public') => void
    setSharedEmails?: (emails: string[]) => void
  }>({})
  
  // ============================================================
  // HOOKS: State Management
  // ============================================================
  
  // Document state (no dependencies)
  const documentState = useDocumentState()
  
  // Streaming content state - tracks real-time content being written by orchestrator
  const [streamingContent, setStreamingContent] = useState<Record<string, { sectionId: string; content: string; isComplete: boolean }>>({})
  
  // Handle streaming content chunks from orchestrator
  const handleContentChunk = useCallback((sectionId: string, chunk: string, accumulated: string) => {
    setStreamingContent(prev => ({
      ...prev,
      [sectionId]: {
        sectionId,
        content: accumulated,
        isComplete: false,
      }
    }))
  }, [])
  
  // Sharing state (no dependencies)
  const sharing = useCanvasSharing({
    storyId
  })
  
  // Update callbacks ref with sharing setters
  callbacksRef.current.setCanvasVisibility = sharing.setCanvasVisibility
  callbacksRef.current.setSharedEmails = sharing.setSharedEmails
  
  // Canvas state (ReactFlow nodes/edges)
  // Note: We'll use canvasData refs after it's initialized
  const canvasState = useCanvasState({
    onUnsavedChange: () => {
      // Mark unsaved changes; persistence is handled via targeted endpoints + explicit saves.
      // (We don't auto-save the whole canvas on every change.)
      if (canvasData?.hasUnsavedChangesRef) {
        canvasData.hasUnsavedChangesRef.current = true
      }
    },
    isLoadingRef: undefined, // Will use canvasData.isLoadingRef after initialization
    onPositionsCommitted: (positions) => {
      // Best-effort persistence of node positions on drag end.
      // This prevents "positions jump on refresh" without requiring a full canvas save.
      try {
        const storyIdLocal = storyId
        const userIdLocal = canvasData?.userId
        if (!storyIdLocal || !userIdLocal) return

        // Fire-and-forget: update nodes individually
        positions.forEach((p) => {
          fetch('/api/node/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeId: p.id,
              storyId: storyIdLocal,
              userId: userIdLocal,
              updates: { position_x: p.x, position_y: p.y },
            }),
          }).catch(() => {})
        })
      } catch {
        // Non-fatal
      }
    }
  })
  
  // Canvas data (story loading, access control, user profile)
  // Note: Callbacks will be updated after they're defined below
  const canvasData = useCanvasData({
    storyId,
    nodes: canvasState.nodes,
    edges: canvasState.edges,
    setNodes: canvasState.setNodes,
    setEdges: canvasState.setEdges,
    handleStructureItemClick: callbacksRef.current.handleStructureItemClick,
    handleStructureItemsUpdate: callbacksRef.current.handleStructureItemsUpdate,
    handleNodeUpdate: callbacksRef.current.handleNodeUpdate,
    handleAgentAssign: callbacksRef.current.handleAgentAssign,
    setCanvasVisibility: callbacksRef.current.setCanvasVisibility,
    setSharedEmails: callbacksRef.current.setSharedEmails
  })
  
  // Update canvasState's onUnsavedChange to use canvasData refs
  // Note: This is a limitation - ideally hooks would share refs
  // For now, we'll handle unsaved changes in the callbacks directly
  
  // 2024-12-11: Removed useWorldStateSync - was legacy frontend orchestration
  // Deep agent architecture uses SSE streaming for state, not WorldState
  
  // ============================================================
  // CALLBACKS: Document Operations
  // ============================================================
  
  // Handle structure item click
  const handleStructureItemClick = useCallback(async (
    clickedItem: any,
    allItems: any[],
    format: StoryFormat,
    nodeId: string
  ) => {
    console.log('🎯 Structure item clicked:', { clickedItem, allItems, format, nodeId })
    
    // Get latest content map from node
    let latestContentMap: Record<string, string> = {}
    let isNodeLoading = false
    
    canvasState.setNodes((currentNodes) => {
      const structureNode = currentNodes.find(n => n.id === nodeId)
      
      if (structureNode?.data?.isLoading) {
        isNodeLoading = true
        console.warn('⏳ [handleStructureItemClick] Node is still loading')
        return currentNodes
      }
      
      latestContentMap = (structureNode?.data as StoryStructureNodeData)?.contentMap || {}
      return currentNodes
    })
    
    if (isNodeLoading) {
      alert('⏳ Document is still being generated. Please wait a moment and try again.')
      return
    }
    
    // Set document state
    documentState.setInitialPrompt(`Write content for ${clickedItem.name}${clickedItem.title ? `: ${clickedItem.title}` : ''}`)
    documentState.setCurrentStoryStructureNodeId(nodeId)
    documentState.setCurrentStructureItems(allItems)
    documentState.setCurrentStructureFormat(format)
    documentState.setCurrentContentMap(latestContentMap)
    documentState.setInitialSectionId(clickedItem.id)
    documentState.setIsAIDocPanelOpen(true)
  }, [canvasState.setNodes, documentState])
  
  // Update callback ref
  callbacksRef.current.handleStructureItemClick = handleStructureItemClick
  
  // Handle structure items update
  const handleStructureItemsUpdate = useCallback((nodeId: string, updatedItems: any[]) => {
    updateStructureItems(nodeId, updatedItems, {
      setNodes: canvasState.setNodes,
      setCurrentStructureItems: documentState.setCurrentStructureItems,
      setCurrentStructureFormat: documentState.setCurrentStructureFormat,
      setCurrentContentMap: documentState.setCurrentContentMap,
      setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
      currentStoryStructureNodeId: documentState.currentStoryStructureNodeId,
      currentStructureItems: documentState.currentStructureItems,
      currentStructureFormat: documentState.currentStructureFormat,
      currentContentMap: documentState.currentContentMap,
      currentSections: documentState.currentSections,
      activeContext: documentState.activeContext,
      handleStructureItemClick: handleStructureItemClick || undefined,
      refreshSectionsRef: documentState.refreshSectionsRef,
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef
      // 2024-12-11: Removed worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData])
  
  // Update callback ref
  callbacksRef.current.handleStructureItemsUpdate = handleStructureItemsUpdate
  
  // Handle document switch
  const handleSwitchDocument = useCallback((nodeId: string) => {
    switchDocument(nodeId, {
      setNodes: canvasState.setNodes,
      setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
      setCurrentStructureItems: documentState.setCurrentStructureItems,
      setCurrentStructureFormat: documentState.setCurrentStructureFormat,
      setCurrentContentMap: documentState.setCurrentContentMap,
      setInitialSectionId: documentState.setInitialSectionId,
      currentStoryStructureNodeId: documentState.currentStoryStructureNodeId,
      currentStructureItems: documentState.currentStructureItems,
      currentStructureFormat: documentState.currentStructureFormat,
      currentContentMap: documentState.currentContentMap,
      currentSections: documentState.currentSections,
      activeContext: documentState.activeContext,
      handleStructureItemClick: handleStructureItemClick || undefined,
      refreshSectionsRef: documentState.refreshSectionsRef,
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef
      // 2024-12-11: Removed worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData])
  
  // Handle write content
  const handleWriteContent = useCallback(async (segmentId: string, prompt: string) => {
    await writeContent(segmentId, prompt, {
      setNodes: canvasState.setNodes,
      setCurrentStructureItems: documentState.setCurrentStructureItems,
      setCurrentStructureFormat: documentState.setCurrentStructureFormat,
      setCurrentContentMap: documentState.setCurrentContentMap,
      setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
      currentStoryStructureNodeId: documentState.currentStoryStructureNodeId,
      currentStructureItems: documentState.currentStructureItems,
      currentStructureFormat: documentState.currentStructureFormat,
      currentContentMap: documentState.currentContentMap,
      currentSections: documentState.currentSections,
      activeContext: documentState.activeContext,
      handleStructureItemClick: handleStructureItemClick || undefined,
      refreshSectionsRef: documentState.refreshSectionsRef,
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef
      // 2024-12-11: Removed worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData])
  
  // Handle answer question
  const handleAnswerQuestion = useCallback(async (question: string): Promise<string> => {
    return await answerQuestion(question, {
      setNodes: canvasState.setNodes,
      setCurrentStructureItems: documentState.setCurrentStructureItems,
      setCurrentStructureFormat: documentState.setCurrentStructureFormat,
      setCurrentContentMap: documentState.setCurrentContentMap,
      setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
      currentStoryStructureNodeId: documentState.currentStoryStructureNodeId,
      currentStructureItems: documentState.currentStructureItems,
      currentStructureFormat: documentState.currentStructureFormat,
      currentContentMap: documentState.currentContentMap,
      currentSections: documentState.currentSections,
      activeContext: documentState.activeContext,
      handleStructureItemClick,
      refreshSectionsRef: documentState.refreshSectionsRef,
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef
      // 2024-12-11: Removed worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData])
  
  // ============================================================
  // CALLBACKS: Node Operations
  // ============================================================
  
  // Get available agents
  const availableAgents = useMemo(() => {
    return canvasState.nodes
      .filter(n => n.type === 'clusterNode')
      .map(n => ({
        id: n.id,
        agentNumber: n.data.agentNumber || 0,
        color: n.data.color || '#9ca3af',
        label: n.data.label || 'Agent',
        isActive: n.data.isActive ?? true,
        assignmentMode: n.data.assignmentMode || 'manual'
      }))
      .sort((a, b) => a.agentNumber - b.agentNumber)
  }, [canvasState.nodes])
  
  // Handle agent assignment
  const handleAgentAssign = useCallback((itemId: string, agentId: string | null) => {
    console.log('Agent assignment:', { itemId, agentId })
    
    canvasState.setNodes((currentNodes) => {
      let updatedNodes = currentNodes
      
      // Update structure node
      updatedNodes = updatedNodes.map((node) => {
        if (node.type === 'storyStructureNode' && node.data.items) {
          const hasThisItem = node.data.items.some((item: any) => item.id === itemId)
          if (!hasThisItem) return node
          
          const updatedItems = node.data.items.map((item: any) => {
            if (item.id === itemId) {
              if (agentId) {
                const agent = availableAgents.find(a => a.id === agentId)
                if (agent) {
                  return {
                    ...item,
                    assignedAgentId: agentId,
                    assignedAgentNumber: agent.agentNumber,
                    assignedAgentColor: agent.color
                  }
                }
              } else {
                return {
                  ...item,
                  assignedAgentId: undefined,
                  assignedAgentNumber: undefined,
                  assignedAgentColor: undefined
                }
              }
            }
            return item
          })
          
          return { ...node, data: { ...node.data, items: updatedItems } }
        }
        return node
      })
      
      // Update agent active/passive status
      updatedNodes = updatedNodes.map((node) => {
        if (node.type === 'clusterNode') {
          const isAssigned = updatedNodes.some((n) => 
            n.type === 'storyStructureNode' && 
            n.data.items?.some((item: any) => item.assignedAgentId === node.id)
          )
          
          if (node.data.isActive !== isAssigned) {
            return { ...node, data: { ...node.data, isActive: isAssigned } }
          }
        }
        return node
      })
      
      return updatedNodes
    })
    
    canvasData.hasUnsavedChangesRef.current = true
    canvasData.handleSave()
  }, [availableAgents, canvasState.setNodes, canvasData])
  
  // Update callback ref
  callbacksRef.current.handleAgentAssign = handleAgentAssign
  
  // Handle node update
  const handleNodeUpdate = useCallback((nodeId: string, newData: any) => {
    updateNodeData(nodeId, newData, {
      setNodes: canvasState.setNodes,
      setEdges: canvasState.setEdges,
      setSelectedNode: canvasState.setSelectedNode,
      setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
      setCurrentStructureItems: documentState.setCurrentStructureItems,
      setCurrentStructureFormat: documentState.setCurrentStructureFormat,
      setCurrentContentMap: documentState.setCurrentContentMap,
      setIsAIDocPanelOpen: documentState.setIsAIDocPanelOpen,
      handleStructureItemClick: handleStructureItemClick || undefined,
      handleStructureItemsUpdate: handleStructureItemsUpdate || undefined,
      handleAgentAssign: handleAgentAssign || undefined,
      availableAgents,
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef,
      storyId,
      nodes: canvasState.nodes,
      edges: canvasState.edges,
      selectedNode: canvasState.selectedNode,
      userId: canvasData.userId
    })
  }, [canvasState, documentState, handleStructureItemClick, handleStructureItemsUpdate, handleAgentAssign, availableAgents, canvasData, storyId])
  
  // Update callback ref
  callbacksRef.current.handleNodeUpdate = handleNodeUpdate
  
  // Handle node delete
  const handleNodeDelete = useCallback((nodeId: string) => {
    deleteNode(nodeId, {
      setNodes: canvasState.setNodes,
      setEdges: canvasState.setEdges,
      setSelectedNode: canvasState.setSelectedNode,
      selectedNode: canvasState.selectedNode
    })
    
    // Persist deletion to database
    // Use setTimeout to allow React state to update first
    setTimeout(() => {
      canvasData.handleSave()
    }, 100)
  }, [canvasState, canvasData])
  
  // Handle create story
  const handleCreateStory = useCallback(async (format: StoryFormat, template?: string, userPromptDirect?: string, plan?: any) => {
    await createStoryStructureNode(format, {
      setNodes: canvasState.setNodes,
      setEdges: canvasState.setEdges,
      setSelectedNode: canvasState.setSelectedNode,
      setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
      setCurrentStructureItems: documentState.setCurrentStructureItems,
      setCurrentStructureFormat: documentState.setCurrentStructureFormat,
      setCurrentContentMap: documentState.setCurrentContentMap,
      setIsAIDocPanelOpen: documentState.setIsAIDocPanelOpen,
      handleStructureItemClick: handleStructureItemClick || undefined,
      handleStructureItemsUpdate: handleStructureItemsUpdate || undefined,
      handleAgentAssign: handleAgentAssign || undefined,
      // DEPRECATED: Legacy orchestration moved to Python backend
      // The new flow uses OrchestratorPanel → backendClient.ts → Python API → onCreateStoryNode
      triggerOrchestratedGeneration: undefined,
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef,
      storyId,
      nodes: canvasState.nodes,
      edges: canvasState.edges,
      availableAgents,
      userId: canvasData.userId,
      selectedNode: canvasState.selectedNode
    }, { template, userPromptDirect, plan })
  }, [canvasState, documentState, handleStructureItemClick, handleStructureItemsUpdate, handleAgentAssign, availableAgents, canvasData, storyId])
  
  // Handle add new node
  const handleAddNewNode = useCallback((nodeType: NodeType) => {
    addNewNode(nodeType, {
      setNodes: canvasState.setNodes,
      setEdges: canvasState.setEdges,
      setSelectedNode: canvasState.setSelectedNode,
      setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
      setCurrentStructureItems: documentState.setCurrentStructureItems,
      setCurrentStructureFormat: documentState.setCurrentStructureFormat,
      setCurrentContentMap: documentState.setCurrentContentMap,
      setIsAIDocPanelOpen: documentState.setIsAIDocPanelOpen,
      handleStructureItemClick: handleStructureItemClick || undefined,
      handleStructureItemsUpdate: handleStructureItemsUpdate || undefined,
      handleAgentAssign: handleAgentAssign || undefined,
      triggerOrchestratedGeneration: undefined, // Not needed for addNewNode
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef,
      storyId,
      nodes: canvasState.nodes,
      edges: canvasState.edges,
      availableAgents,
      userId: canvasData.userId,
      selectedNode: canvasState.selectedNode
    })
  }, [canvasState, documentState, handleStructureItemClick, handleStructureItemsUpdate, handleAgentAssign, availableAgents, storyId, canvasData])
  
  // ============================================================
  // CALLBACKS: Canvas Operations
  // ============================================================
  
  // Handle connect
  const onConnect = useCallback(
    (params: Connection) => {
      // Create deterministic edge id (prevents duplicates and ensures persistence uses same id)
      const source = params.source
      const target = params.target
      if (!source || !target) return

      const edgeId = `edge-${source}-${target}`
      const edge: any = {
        id: edgeId,
        ...params,
        animated: false,
        style: { stroke: '#9ca3af', strokeWidth: 2 },
        type: 'default',
      }

      canvasState.setEdges((eds) => addEdge(edge, eds))

      // Persist immediately so refresh keeps the connector.
      // (Mirrors character-edge persistence in CanvasPanels.)
      const storyIdLocal = storyId
      const userIdLocal = canvasData?.userId
      console.log('🔗 [Canvas] Creating edge:', { edgeId, storyIdLocal, userIdLocal, source, target })
      
      if (storyIdLocal && userIdLocal) {
        fetch('/api/edge/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            edgeId,
            storyId: storyIdLocal,
            source,
            target,
            type: 'default',
            animated: false,
            style: { stroke: '#9ca3af', strokeWidth: 2 },
            userId: userIdLocal,
          }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              console.log('✅ [Canvas] Edge persisted:', edgeId)
            } else {
              console.error('❌ [Canvas] Edge persist failed:', data.error)
            }
          })
          .catch(err => {
            console.error('❌ [Canvas] Edge persist error:', err)
          })
      } else {
        console.warn('⚠️ [Canvas] Cannot persist edge - missing storyId or userId:', { storyIdLocal, userIdLocal })
      }
    },
    [canvasState.setEdges, storyId, canvasData?.userId]
  )
  
  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', { id: node.id, type: node.type, nodeType: node.data?.nodeType })
    
    // Handle Story Draft node - open in AI Document Panel
    if (node.type === 'storyDraftNode') {
      console.log('Story Draft node clicked - opening in AI panel')
      event.stopPropagation()
      const storyData = node.data as any
      documentState.setCurrentStoryDraftId(node.id)
      documentState.setInitialPrompt(storyData.content || storyData.title || 'Continue this story')
      documentState.setIsAIDocPanelOpen(true)
      return
    }
    
    // For all other node types, open details panel
    console.log('Node clicked - opening details panel')
    canvasState.setSelectedNode(node)
    canvasState.setIsPanelOpen(true)
  }, [canvasState, documentState])
  
  // Handle prompt submit
  const handlePromptSubmit = useCallback((prompt: string) => {
    console.log('🚀 handlePromptSubmit called with:', prompt)
    documentState.setInitialPrompt(prompt)
    documentState.setIsAIDocPanelOpen(true)
  }, [documentState])
  
  // Handle new canvas
  const handleNewCanvas = useCallback(async () => {
    try {
      if (canvasData.hasUnsavedChangesRef.current) {
        if (!window.confirm('You have unsaved changes. Continue without saving?')) {
          return
        }
      }
      
      const newStory = await createStory()
      router.push(`/canvas?id=${newStory.id}`)
    } catch (error) {
      console.error('Failed to create new canvas:', error)
    }
  }, [canvasData, router])
  
  // Handle delete canvas
  const handleDeleteCanvas = useCallback(async () => {
    if (!storyId) return
    
    const confirmed = window.confirm('Are you sure you want to delete this canvas? This action cannot be undone.')
    if (!confirmed) return

    try {
      await deleteStory(storyId)
      router.push('/stories')
    } catch (error) {
      console.error('Failed to delete canvas:', error)
    }
  }, [storyId, router])
  
  // ============================================================
  // EFFECTS: Story Loading
  // ============================================================
  
  // Load story on mount or when storyId changes
  useEffect(() => {
    if (!loading && user && storyId && storyId !== canvasData.lastLoadedStoryIdRef.current) {
      console.log('Loading story:', storyId)
      
      // 2024-12-11: Removed WorldState chat clearing
      // Chat history is now persisted per session via useOrchestratorSession (Supabase)
      
      canvasData.isLoadingRef.current = true
      canvasData.currentStoryIdRef.current = storyId
      canvasData.lastLoadedStoryIdRef.current = storyId
      
      canvasData.loadStoryData(storyId)
    }
  }, [user, loading, storyId, canvasData])

  // Default: auto-select orchestrator node and keep panel open.
  // NodeDetailsPanel renders nothing when `selectedNode` is null.
  useEffect(() => {
    if (canvasState.selectedNode) return
    const orchestrator = canvasState.nodes.find(n => isOrchestratorNode(n.id))
    if (!orchestrator) return
    canvasState.setSelectedNode(orchestrator)
    canvasState.setIsPanelOpen(true)
  }, [canvasState.nodes, canvasState.selectedNode, canvasState.setSelectedNode, canvasState.setIsPanelOpen])
  
  // ============================================================
  // RENDER
  // ============================================================
  
  if (loading || canvasData.checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
        <div className="text-gray-900 text-xl font-mono relative z-10">
          {loading ? 'Loading...' : 'Checking access...'}
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <CanvasHeader
        storyTitle={canvasData.storyTitle}
        setStoryTitle={canvasData.setStoryTitle}
        titleInputRef={canvasData.titleInputRef}
        onTitleBlur={canvasData.handleTitleBlur}
        saving={canvasData.saving}
        hasUnsavedChanges={canvasData.hasUnsavedChangesRef.current}
        onSave={canvasData.handleSave}
        canvasVisibility={sharing.canvasVisibility}
        onVisibilityChange={sharing.handleVisibilityChange}
        sharedEmails={sharing.sharedEmails}
        emailInput={sharing.emailInput}
        setEmailInput={sharing.setEmailInput}
        sendingInvite={sharing.sendingInvite}
        onAddSharedEmail={sharing.handleAddSharedEmail}
        onRemoveSharedEmail={sharing.handleRemoveSharedEmail}
        onNewCanvas={handleNewCanvas}
        onDeleteCanvas={handleDeleteCanvas}
        storyId={storyId}
        userAvatar={canvasData.userAvatar}
        userEmail={user?.email}
        userRole={canvasData.userRole}
        isForceAdmin={canvasData.isForceAdmin}
        onLogout={canvasData.handleLogout}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Viewport */}
        <CanvasViewport
          filteredNodes={canvasState.filteredNodes}
          filteredEdges={canvasState.filteredEdges}
          onNodesChange={canvasState.handleNodesChange}
          onEdgesChange={canvasState.handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onAddNode={handleAddNewNode}
          onPromptSubmit={handlePromptSubmit}
          // 2024-12-11: Removed worldState
        />

        {/* Panels */}
        <CanvasPanels
          storyId={storyId || ''}
          userId={canvasData.userId || ''}  // ✅ FIX: Pass userId for node saving
          /**
           * onStoryNodeCreated - Called when orchestrator creates a new story structure node
           * 
           * This callback is triggered by CanvasPanels.handleCreateStoryNode after:
           * 1. User requests story creation via orchestrator chat
           * 2. Python backend generates structure (chapters, scenes, etc.)
           * 3. CanvasPanels creates the storyStructureNode and adds it to canvas
           * 
           * Here we:
           * 1. Set document state so AIDocumentPanel knows what to display
           * 2. Open AIDocumentPanel automatically for immediate editing
           * 3. Save canvas with delay (React state needs time to update)
           * 
           * WHY SETTIMEOUT FOR SAVE:
           * React's setState is async. When CanvasPanels calls onAddNode/onAddEdge,
           * the nodes/edges arrays don't update immediately. If we call handleSave()
           * right away, it saves the OLD state without the new node.
           * The 500ms delay gives React time to process the state updates.
           */
          onStoryNodeCreated={(nodeId: string, structureData: CreateStoryNodeData) => {
            console.log('🎉 [page.tsx] Story node created:', nodeId, structureData)
            
            // ─────────────────────────────────────────────────────────────
            // Step 1: Set document state for AIDocumentPanel
            // ─────────────────────────────────────────────────────────────
            documentState.setCurrentStoryStructureNodeId(nodeId)
            documentState.setCurrentStructureItems(structureData.items || [])
            documentState.setCurrentStructureFormat(structureData.format as StoryFormat)
            documentState.setCurrentContentMap({}) // No content yet - fresh document
            
            // ─────────────────────────────────────────────────────────────
            // Step 2: Open the document panel automatically
            // ─────────────────────────────────────────────────────────────
            documentState.setIsAIDocPanelOpen(true)
            
            // ─────────────────────────────────────────────────────────────
            // Step 3: Save canvas with delay to ensure node is in state
            // ─────────────────────────────────────────────────────────────
            // NOTE: Node is already saved to DB by CanvasPanels.handleCreateStoryNode.
            // We just need to save the canvas state (edges, etc.) to ensure consistency.
            // The delay gives React time to process the state updates.
            setTimeout(() => {
              console.log('💾 [page.tsx] Saving canvas state (node already in DB)...')
              canvasData.handleSave()
            }, 500)
          }}
          selectedNode={canvasState.selectedNode}
          isPanelOpen={canvasState.isPanelOpen}
          onClosePanel={() => canvasState.setIsPanelOpen(false)}
          onNodeUpdate={handleNodeUpdate}
          onNodeDelete={handleNodeDelete}
          onCreateStory={handleCreateStory}
          onAddNode={(newNode) =>
            canvasState.setNodes((nds) => (nds.some((n) => n.id === newNode.id) ? nds : [...nds, newNode]))
          }
          onAddEdge={(newEdge) =>
            canvasState.setEdges((eds) => (eds.some((e) => e.id === newEdge.id) ? eds : [...eds, newEdge]))
          }
          edges={canvasState.edges}
          nodes={canvasState.nodes}
          // 2024-12-11: Removed worldState
          onSelectNode={(nodeId: string, sectionId?: string) => {
            const node = canvasState.nodes.find(n => n.id === nodeId)
            if (!node) {
              console.error('[onSelectNode] Node not found:', nodeId)
              return
            }
            
            const nodeData = node.data as StoryStructureNodeData
            const structureItems = nodeData.items
            if (!structureItems || !nodeData.format) {
              console.error('[onSelectNode] Node missing structure data')
              return
            }
            
            const latestContentMap = nodeData.contentMap || {}
            documentState.setCurrentStoryStructureNodeId(nodeId)
            documentState.setCurrentStructureItems(structureItems)
            documentState.setCurrentStructureFormat(nodeData.format)
            documentState.setCurrentContentMap(latestContentMap)
            
            if (sectionId) {
              documentState.setInitialSectionId(sectionId)
            }
            
            documentState.setIsAIDocPanelOpen(true)
          }}
          onAddChatMessage={(
            message: string, 
            role?: 'user' | 'orchestrator', 
            type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress',
            metadata?: {
              structured?: boolean
              format?: 'progress_list' | 'simple_list' | 'steps'
            }
          ) => {
            // 2024-12-11: Removed WorldState message handling
            // Chat history is now managed by useOrchestratorSession (Supabase persistence)
            // and OrchestratorPanelStreaming (SSE streaming UI)
            console.log('📨 [CanvasPanels] Chat message (legacy callback):', { message, type, role })
          }}
          onClearChat={() => {
            // 2024-12-11: Removed WorldState conversation clearing
            // Chat is now persisted per session via useOrchestratorSession
            console.log('🗑️ [CanvasPanels] Clear chat requested (legacy callback)')
          }}
          isDocumentViewOpen={documentState.isAIDocPanelOpen}
          onToggleDocumentView={() => documentState.setIsAIDocPanelOpen(!documentState.isAIDocPanelOpen)}
          onPanelWidthChange={documentState.setOrchestratorPanelWidth}
          activeContext={documentState.activeContext}
          onClearContext={() => documentState.setActiveContext(null)}
          onWriteContent={handleWriteContent}
          onAnswerQuestion={handleAnswerQuestion}
          structureItems={documentState.currentStructureItems}
          contentMap={documentState.currentContentMap}
          streamingContent={streamingContent}
          onContentChunk={handleContentChunk}
          currentStoryStructureNodeId={documentState.currentStoryStructureNodeId}
          isAIDocPanelOpen={documentState.isAIDocPanelOpen}
          onCloseDocumentPanel={() => {
            documentState.setIsAIDocPanelOpen(false)
            documentState.setInitialPrompt('')
            documentState.setCurrentStoryDraftId(null)
            documentState.setInitialDocumentContent('')
            documentState.setCurrentStoryStructureNodeId(null)
            documentState.setCurrentStructureItems([])
            documentState.setCurrentStructureFormat(undefined)
            documentState.setCurrentContentMap({})
            documentState.setCurrentSections([])
            documentState.setInitialSectionId(null)
            documentState.setActiveContext(null)
          }}
          initialSectionId={documentState.initialSectionId}
          onUpdateStructure={handleStructureItemsUpdate}
          orchestratorPanelWidth={documentState.orchestratorPanelWidth}
          onSwitchDocument={handleSwitchDocument}
          onSetContext={documentState.setActiveContext}
          onSectionsLoaded={documentState.handleSectionsLoaded}
          onRefreshSections={documentState.handleRefreshSectionsCallback}
          refreshSectionsRef={documentState.refreshSectionsRef}
          // Handle content generated by orchestrator for a specific section
          onSectionComplete={(sectionId: string, content: string) => {
            console.log(`✅ [page.tsx] Section ${sectionId} content received (${content.length} chars)`)
            
            // Clear streaming content for this section (it's now saved)
            setStreamingContent(prev => {
              const { [sectionId]: _, ...rest } = prev
              return rest
            })
            
            // Update the content map with new content
            documentState.setCurrentContentMap((prev: Record<string, string>) => ({
              ...prev,
              [sectionId]: content
            }))
            
            // Also update the node's contentMap if we have a current structure node
            if (documentState.currentStoryStructureNodeId) {
              const nodeId = documentState.currentStoryStructureNodeId
              canvasState.setNodes((nodes) => 
                nodes.map((n) => {
                  if (n.id === nodeId) {
                    const nodeData = n.data as StoryStructureNodeData
                    return {
                      ...n,
                      data: {
                        ...nodeData,
                        contentMap: {
                          ...(nodeData.contentMap || {}),
                          [sectionId]: content
                        }
                      }
                    }
                  }
                  return n
                })
              )
            }
          }}
        />
      </div>


    </div>
  )
}