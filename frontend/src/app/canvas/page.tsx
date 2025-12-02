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

import React, { useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { Node, Edge, Connection, addEdge } from 'reactflow'
import type { StoryFormat, StoryStructureNodeData, NodeType } from '@/types/nodes'
import { createStory, deleteStory } from '@/lib/stories'

// Hooks
import { useCanvasState } from '@/hooks/canvas/useCanvasState'
import { useWorldStateSync } from '@/hooks/canvas/useWorldStateSync'
import { useDocumentState } from '@/hooks/canvas/useDocumentState'
import { useCanvasData } from '@/hooks/canvas/useCanvasData'
import { useCanvasSharing } from '@/hooks/canvas/useCanvasSharing'

// Services
import { createStoryStructureNode, updateNodeData, deleteNode, addNewNode } from '@/services/canvas/canvasService'
import { updateStructureItems, switchDocument, writeContent, answerQuestion } from '@/services/canvas/documentService'
import { triggerOrchestratedGeneration } from '@/services/canvas/orchestrationService'

// Components
import CanvasHeader from '@/components/canvas/CanvasHeader'
import CanvasViewport from '@/components/canvas/CanvasViewport'
import CanvasPanels from '@/components/canvas/CanvasPanels'

// Node types
import UniversalNode from '@/components/canvas/UniversalNode'
import OrchestratorNode from '@/components/nodes/OrchestratorNode'
import StoryDraftNode from '@/components/nodes/StoryDraftNode'
import StoryStructureNode from '@/components/nodes/StoryStructureNode'
import ClusterNode from '@/components/nodes/ClusterNode'
import TestNode from '@/components/nodes/TestNode'
import AIPromptNode from '@/components/nodes/AIPromptNode'

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
      // Will be updated after canvasData is initialized
    },
    isLoadingRef: undefined // Will use canvasData.isLoadingRef after initialization
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
  
  // WorldState sync
  const { worldStateRef, worldStateInstance } = useWorldStateSync({
    nodes: canvasState.nodes,
    edges: canvasState.edges,
    currentStoryStructureNodeId: documentState.currentStoryStructureNodeId,
    isAIDocPanelOpen: documentState.isAIDocPanelOpen,
    userId: canvasData.userId || '',
    availableProviders: [],
    availableModels: [],
    modelPreferences: {
      modelMode: 'automatic',
      fixedModelId: null,
      fixedModeStrategy: 'loose'
    }
  })
  
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
      isLoadingRef: canvasData.isLoadingRef,
      worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData, worldStateRef])
  
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
      isLoadingRef: canvasData.isLoadingRef,
      worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData, worldStateRef])
  
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
      isLoadingRef: canvasData.isLoadingRef,
      worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData, worldStateRef])
  
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
      isLoadingRef: canvasData.isLoadingRef,
      worldStateRef
    })
  }, [canvasState.setNodes, documentState, handleStructureItemClick, canvasData, worldStateRef])
  
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
  }, [canvasState])
  
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
      triggerOrchestratedGeneration: async (structureNodeId, format, options) => {
        await triggerOrchestratedGeneration(structureNodeId, format, {
          setNodes: canvasState.setNodes,
          setEdges: canvasState.setEdges,
          setCurrentStoryStructureNodeId: documentState.setCurrentStoryStructureNodeId,
          setCurrentStructureItems: documentState.setCurrentStructureItems,
          setCurrentStructureFormat: documentState.setCurrentStructureFormat,
          setCurrentContentMap: documentState.setCurrentContentMap,
          setIsAIDocPanelOpen: documentState.setIsAIDocPanelOpen,
          worldStateRef,
          hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
          isInferencingRef: canvasData.isInferencingRef,
          user,
          nodes: canvasState.nodes,
          edges: canvasState.edges,
          storyId,
          supabaseClient,
          handleSave: canvasData.handleSave
        }, options)
      },
      hasUnsavedChangesRef: canvasData.hasUnsavedChangesRef,
      isLoadingRef: canvasData.isLoadingRef,
      storyId,
      nodes: canvasState.nodes,
      edges: canvasState.edges,
      availableAgents,
      userId: canvasData.userId,
      selectedNode: canvasState.selectedNode
    }, { template, userPromptDirect, plan })
  }, [canvasState, documentState, handleStructureItemClick, handleStructureItemsUpdate, handleAgentAssign, availableAgents, canvasData, user, storyId, supabaseClient, worldStateRef])
  
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
    (params: Connection) => canvasState.setEdges((eds) => addEdge({ 
      ...params, 
      animated: false, 
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      type: 'default'
    }, eds)),
    [canvasState.setEdges]
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
      
      // Clear chat history when switching canvases
      if (worldStateRef.current) {
        worldStateRef.current.clearConversation()
        console.log('🗑️ Chat history cleared for new canvas')
      }
      
      canvasData.isLoadingRef.current = true
      canvasData.currentStoryIdRef.current = storyId
      canvasData.lastLoadedStoryIdRef.current = storyId
      
      canvasData.loadStoryData(storyId)
    }
  }, [user, loading, storyId, canvasData, worldStateRef])
  
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
          worldState={worldStateInstance || undefined}
        />

        {/* Panels */}
        <CanvasPanels
          selectedNode={canvasState.selectedNode}
          isPanelOpen={canvasState.isPanelOpen}
          onClosePanel={() => canvasState.setIsPanelOpen(false)}
          onNodeUpdate={handleNodeUpdate}
          onNodeDelete={handleNodeDelete}
          onCreateStory={handleCreateStory}
          onAddNode={(newNode) => canvasState.setNodes((nds) => [...nds, newNode])}
          onAddEdge={(newEdge) => canvasState.setEdges((eds) => [...eds, newEdge])}
          edges={canvasState.edges}
          nodes={canvasState.nodes}
          worldState={worldStateInstance || undefined}
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
          onAddChatMessage={(message, role, type) => {
            if (worldStateRef.current) {
              worldStateRef.current.addMessage({
                content: message,
                type: type || 'user',
                role: role || 'user'
              })
            }
          }}
          onClearChat={() => {
            if (confirm('Clear all chat history? This cannot be undone.')) {
              if (worldStateRef.current) {
                worldStateRef.current.clearConversation()
              }
            }
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
        />
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2">
        <p className="text-gray-400 text-sm">Intelligence Engineered by</p>
        <img src="/aiakaki_logo.svg" alt="AIAKAKI" className="h-3.5" />
      </div>
    </div>
  )
}

