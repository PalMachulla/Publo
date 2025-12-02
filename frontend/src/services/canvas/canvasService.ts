/**
 * canvasService - Canvas node operations service
 * 
 * Handles canvas node operations including:
 * - Creating new story structure nodes
 * - Updating node data
 * - Deleting nodes
 * - Adding new nodes of various types
 * 
 * Architecture Notes:
 * - Service functions accept dependencies via parameters
 * - Keeps business logic separate from React state management
 * - Handles node type migrations and legacy support
 * 
 * Legacy Code:
 * - Node type migration (createStoryNode/contextCanvas → orchestratorNode)
 * - createStoryNode support in nodeTypes (may be removable after migration)
 * 
 * @see canvas/page.tsx for original implementation
 */

import { Node, Edge } from 'reactflow'
import { StoryFormat, StoryStructureNodeData, NodeType } from '@/types/nodes'
import { saveCanvas } from '@/lib/stories'
import { getFormatLabel } from '@/lib/orchestrator/schemas/formatMetadata'
import { EXAMPLE_SCREENPLAY_MARKDOWN } from '@/components/nodes/TestNode'

export interface CanvasServiceDependencies {
  // State setters
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>
  selectedNode: Node | null // Current selected node (for deleteNode)
  
  // Document state setters (for handleCreateStory)
  setCurrentStoryStructureNodeId: (id: string | null) => void
  setCurrentStructureItems: (items: any[]) => void
  setCurrentStructureFormat: (format: StoryFormat | undefined) => void
  setCurrentContentMap: (map: Record<string, string>) => void
  setIsAIDocPanelOpen: (open: boolean) => void
  
  // Callbacks
  // Note: Signature matches StoryStructureNode usage: (item, allItems, format, nodeId)
  handleStructureItemClick?: (item: any, allItems: any[], format: StoryFormat, nodeId: string) => Promise<void>
  handleStructureItemsUpdate?: (nodeId: string, items: any[]) => void
  handleAgentAssign?: (itemId: string, agentId: string | null) => void
  triggerOrchestratedGeneration?: (
    structureNodeId: string,
    format: StoryFormat,
    options?: {
      aiPromptNode?: Node | null
      orchestratorNodeId?: string
      userPromptDirect?: string
      existingPlan?: any
    }
  ) => Promise<void>
  
  // Refs
  hasUnsavedChangesRef: React.MutableRefObject<boolean>
  isLoadingRef: React.MutableRefObject<boolean>
  
  // Context
  storyId: string | null
  nodes: Node[]
  edges: Edge[]
  availableAgents: Array<{ id: string; agentNumber: number; color: string; label: string }>
  userId: string | undefined
}

/**
 * Create a new story structure node
 * 
 * Features:
 * - Generates unique node ID
 * - Creates node with structure items from plan (if provided)
 * - Creates edge from orchestrator node
 * - Saves node to database immediately
 * - Triggers orchestration if AI Prompt node or chat prompt exists
 * 
 * Legacy Code:
 * - Supports migration from old node types (createStoryNode/contextCanvas)
 */
export async function createStoryStructureNode(
  format: StoryFormat,
  dependencies: CanvasServiceDependencies,
  options?: {
    template?: string
    userPromptDirect?: string
    plan?: any
  }
): Promise<void> {
  const {
    setNodes,
    setEdges,
    setCurrentStoryStructureNodeId,
    setCurrentStructureItems,
    setCurrentStructureFormat,
    setCurrentContentMap,
    setIsAIDocPanelOpen,
    handleStructureItemClick,
    handleStructureItemsUpdate,
    handleAgentAssign,
    triggerOrchestratedGeneration,
    hasUnsavedChangesRef,
    storyId,
    nodes,
    edges,
    availableAgents,
    userId
  } = dependencies
  
  const { template, userPromptDirect, plan } = options || {}
  
  console.log('handleCreateStory called with format:', format, 'template:', template, 'userPromptDirect:', userPromptDirect, 'plan:', plan)
  
  // 🔧 FIX: Generate proper UUID for node ID (not "structure-..." prefix!)
  // Structure items inside will have "structure-..." IDs, but the NODE itself needs a UUID
  const structureId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  console.log('✅ [handleCreateStory] Generated node ID:', {
    nodeId: structureId,
    format: structureId.startsWith('structure-') ? '❌ WRONG' : '✅ CORRECT'
  })
  
  // Get formatted title based on format (using centralized format metadata)
  const title = getFormatLabel(format) || 'Document'
  
  // If plan is provided, convert it to items array
  const initialItems = plan?.structure?.map((item: any, index: number) => ({
    id: item.id,
    level: item.level,
    name: item.name,
    summary: item.summary || '',
    wordCount: item.wordCount || 0,
    parentId: item.parentId || null,
    order: item.order !== undefined ? item.order : index // Use array index as fallback order
  })) || []
  
  console.log('📝 Creating node with items:', initialItems.length, 'items from plan')
  
  // Create new story structure node - positioned below the Ghostwriter node
  const nodeData: StoryStructureNodeData = {
    label: title,
    comments: [],
    nodeType: 'story-structure' as const,
    format: format,
    items: initialItems, // Use items from plan if available, otherwise start empty
    activeLevel: 1,
    template: template,
    isLoading: !plan, // If plan provided, not loading. Otherwise, start as loading
    onItemClick: handleStructureItemClick,
    onItemsUpdate: (items: any[]) => handleStructureItemsUpdate?.(structureId, items),
    availableAgents: availableAgents, // Inject available agents
    onAgentAssign: handleAgentAssign // Inject agent assignment callback
  }
  
  const newStructureNode: Node<StoryStructureNodeData> = {
    id: structureId,
    type: 'storyStructureNode',
    position: { 
      x: 140, // Center position (200px node width, so 140 = (460-200)/2 for alignment with 160px Ghostwriter)
      y: 650 // Below Ghostwriter node
    },
    data: nodeData,
  }
  
  // Create edge from Ghostwriter node to new structure with smooth curved lines
  const newEdge: Edge = {
    id: `context-${structureId}`,
    source: 'context',
    target: structureId,
    animated: false,
    style: { stroke: '#9ca3af', strokeWidth: 2 },
    type: 'default' // Smooth bezier curves
  }
  
  console.log('Creating story structure node with data:', {
    id: structureId,
    type: 'storyStructureNode',
    nodeData: nodeData,
    fullNode: newStructureNode
  })
  
  // ✅ CRITICAL FIX: Use functional updates to avoid race conditions
  // This ensures we're working with the latest state, not stale closure values
  setNodes((currentNodes) => [...currentNodes, newStructureNode])
  setEdges((currentEdges) => [...currentEdges, newEdge])
  hasUnsavedChangesRef.current = true

  // Save immediately to database so node exists for when items are clicked
  const saveAndFinalize = async () => {
    try {
      console.log('💾 [saveAndFinalize] Starting save for node:', structureId, {
        storyId,
        userId: userId,
        hasNodes: nodes.length > 0,
        nodeDataKeys: Object.keys(newStructureNode.data),
        itemsCount: newStructureNode.data.items?.length || 0
      })
      
      console.log('🔧 [saveAndFinalize] Creating node via server-side API (bypasses RLS)...')
      
      // ✅ FIX: Initialize document_data so agents can save content immediately
      const { DocumentManager } = await import('@/lib/document/DocumentManager')
      const docManager = DocumentManager.fromStructureItems(
        newStructureNode.data.items || [],
        (newStructureNode.data.format as 'novel' | 'screenplay' | 'report') || 'novel'
      )

      console.log('📄 [handleCreateStory] DocumentManager created:', {
        format: newStructureNode.data.format,
        structureItemsCount: newStructureNode.data.items?.length || 0,
        documentDataSize: JSON.stringify(docManager.getData()).length,
        documentDataKeys: Object.keys(docManager.getData())
      })
      
      // ✅ NEW: Use server-side API to create node (uses admin client, bypasses RLS INSERT policy)
      const createNodeResponse = await fetch('/api/node/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: structureId,
          storyId,
          nodeType: 'storyStructure',
          data: newStructureNode.data,
          documentData: docManager.getData(),
          positionX: newStructureNode.position.x,
          positionY: newStructureNode.position.y,
          userId: userId
        })
      })
      
      const createNodeResult = await createNodeResponse.json()
      
      console.log('📡 [saveAndFinalize] Node creation API response:', {
        status: createNodeResponse.status,
        success: createNodeResult.success,
        nodeId: createNodeResult.nodeId,
        error: createNodeResult.error
      })
      
      if (!createNodeResponse.ok || !createNodeResult.success) {
        console.error('❌ [saveAndFinalize] Node creation failed:', createNodeResult.error)
        throw new Error(`Failed to create node: ${createNodeResult.error}`)
      }
      
      console.log('✅ [saveAndFinalize] Node created successfully via API:', createNodeResult.nodeId)
      console.log('   Node is now persistently saved to Supabase!')
      console.log('   Both user and admin clients can now query this node!')
      console.log('   Agents can now save content to this node!')
      console.log('   Format:', newStructureNode.data.format)
      console.log('   Sections:', newStructureNode.data.items?.length || 0)
      
      // ✅ CRITICAL FIX: Save edges immediately so node is connected on canvas
      console.log('🔗 [saveAndFinalize] Saving edges to connect new node...')
      if (storyId) {
        try {
          // Get the updated edges that include the new edge
          const updatedEdges = [...edges, newEdge]
          
          // Save edges to database
          await saveCanvas(storyId, [...nodes, newStructureNode], updatedEdges)
          console.log('✅ [saveAndFinalize] Edges saved - node is now connected on canvas')
        } catch (edgeError) {
          console.error('❌ [saveAndFinalize] Failed to save edges:', edgeError)
          console.warn('⚠️ Node created but edges not saved - node may appear disconnected')
        }
      }
      
      console.log('')
      console.log('📊 [saveAndFinalize] Document State Summary:')
      console.log('   - Node ID:', createNodeResult.nodeId)
      console.log('   - Format:', newStructureNode.data.format)
      console.log('   - Structure Items:', newStructureNode.data.items?.length || 0)
      console.log('   - Ready for agent content generation: ✅')
      console.log('')
    } catch (error: any) {
      console.error('❌ [saveAndFinalize] Save error:', error)
      throw error
    }
    
    // Remove loading state after save completes
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === structureId
          ? { ...node, data: { ...node.data, isLoading: false } }
          : node
      )
    )
  }
  
  // ✅ FIX: Declare aiPromptNode and hasChatPrompt BEFORE using them
  // AUTO-GENERATE: Check if AI Prompt node is connected OR chat prompt exists
  const aiPromptNode = nodes.find(n => 
    n.data?.nodeType === 'aiPrompt' && 
    edges.some(e => e.source === n.id && e.target === 'context')
  )
  
  // Check if chat prompt exists (direct parameter OR orchestrator node data)
  const orchestratorNode = nodes.find(n => n.id === 'context')
  const hasChatPrompt = !!userPromptDirect || !!(orchestratorNode?.data as any)?.chatPrompt
  
  // If plan is already provided, save the node and check if content generation is needed
  // ✅ FIX: Await the save to prevent race condition when opening document immediately after creation
  if (plan) {
    console.log('✅ Plan already provided by orchestrator, saving synchronously to prevent race condition')
    try {
      await saveAndFinalize()
      console.log('✅ Node saved to database successfully')
      
      // ✅ FIX: Update WorldState immediately with the plan
      // Note: WorldState will be updated in triggerOrchestratedGeneration
      const structureItems = plan.structure || []
      
      // ✅ CRITICAL FIX: Check if content generation was requested in the plan
      // The plan has a 'tasks' array that indicates if content should be generated
      if (plan.tasks && plan.tasks.length > 0 && (aiPromptNode || hasChatPrompt)) {
        console.log('🎯 [handleCreateStory] Plan has tasks, triggering content generation only (structure already exists)')
        console.log('   Tasks:', plan.tasks.map((t: any) => ({ id: t.id, type: t.type, sectionId: t.sectionId })))
        
        // ✅ FIX: Call triggerOrchestratedGeneration with plan to skip structure generation
        triggerOrchestratedGeneration?.(structureId, format, aiPromptNode || null, 'context', userPromptDirect, plan)
        return // Exit early - structure is done, only content generation needed
      } else {
        console.log('ℹ️ [handleCreateStory] No tasks in plan, structure-only creation - opening document panel')
        // ✅ FIX: Open document panel immediately since structure is ready
        setCurrentStoryStructureNodeId(structureId)
        setCurrentStructureItems(structureItems)
        setCurrentStructureFormat(format)
        setCurrentContentMap({})
        setIsAIDocPanelOpen(true)
        return // Exit early - no orchestration needed
      }
    } catch (err) {
      console.error('❌ Failed to save new structure node:', err)
      // Continue anyway to try orchestration
    }
  }
  
  if (aiPromptNode || hasChatPrompt) {
    console.log('🚀 Auto-generating structure with orchestrator after node creation', {
      hasAIPromptNode: !!aiPromptNode,
      hasChatPrompt,
      userPromptDirect: userPromptDirect || 'none',
      source: userPromptDirect ? 'Chat Input (Direct)' : (orchestratorNode?.data as any)?.chatPrompt ? 'Chat Input (Node Data)' : aiPromptNode ? 'AI Prompt Node' : 'None'
    })
    
    // 🔧 FIX: AWAIT save node to Supabase FIRST, then start orchestration
    // Otherwise, the node doesn't exist when orchestration tries to update document_data
    console.log('💾 [handleCreateStory] Saving node to Supabase first...')
    console.log('   Node ID to save:', structureId)
    console.log('   Node ID format check:', {
      length: structureId.length,
      format: structureId.match(/^[0-9]+-[a-z0-9]+$/) ? 'VALID (timestamp-random)' : 'UNKNOWN FORMAT',
      sample: structureId
    })
    try {
      await saveAndFinalize() // ✅ CRITICAL: Must await to prevent race condition
      console.log('✅ [handleCreateStory] Node saved successfully, ID:', structureId)
      console.log('🎬 [handleCreateStory] Now triggering orchestration with same ID:', structureId)
      
      // Note: WorldState will be created and updated inside triggerOrchestratedGeneration
      // after the structure is generated and saved
      triggerOrchestratedGeneration?.(structureId, format, aiPromptNode || null, 'context', userPromptDirect)
    } catch (err) {
      console.error('❌ [handleCreateStory] Failed to save node before orchestration:', err)
      // Still try to orchestrate even if save failed (might be duplicate key error)
      triggerOrchestratedGeneration?.(structureId, format, aiPromptNode || null, 'context', userPromptDirect)
    }
  } else {
    console.warn('⚠️ No AI Prompt node or chat prompt found, skipping auto-generation')
    // Still save the node even if not auto-generating
    try {
      await saveAndFinalize() // ✅ CRITICAL: Must await to ensure node exists before user can interact
      console.log('✅ [handleCreateStory] Node saved (no orchestration)')
    } catch (err) {
      console.error('❌ [handleCreateStory] Background save failed:', err)
    }
  }
}

/**
 * Update node data
 * 
 * Features:
 * - Merges new data with existing node data
 * - Injects callbacks for story structure nodes
 * - Syncs agent color to assigned segments
 * - Saves contentMap immediately if updated
 */
export function updateNodeData(
  nodeId: string,
  newData: any,
  dependencies: CanvasServiceDependencies
): void {
  const {
    setNodes,
    setSelectedNode,
    handleStructureItemClick,
    handleStructureItemsUpdate,
    handleAgentAssign,
    availableAgents,
    hasUnsavedChangesRef,
    isLoadingRef,
    storyId,
    nodes,
    edges
  } = dependencies
  
  console.log('🔄 handleNodeUpdate called:', { 
    nodeId, 
    newDataKeys: Object.keys(newData),
    hasContentMap: 'contentMap' in newData,
    contentMapKeys: newData.contentMap ? Object.keys(newData.contentMap).length : 0
  })
  
  setNodes((nds) => {
    // First pass: check if this is an agent color update
    const updatingNode = nds.find(n => n.id === nodeId)
    const isAgentColorUpdate = updatingNode?.type === 'clusterNode' && 
                                newData.color && 
                                newData.color !== updatingNode.data.color
    
    const updatedNodes = nds.map((node) => {
      if (node.id === nodeId) {
        const mergedData = { ...node.data, ...newData }
        
        console.log('✏️ Merging data for node:', {
          nodeId,
          oldDataKeys: Object.keys(node.data),
          newDataKeys: Object.keys(newData),
          mergedDataKeys: Object.keys(mergedData),
          hasContentMapInOld: 'contentMap' in node.data,
          hasContentMapInNew: 'contentMap' in newData,
          hasContentMapInMerged: 'contentMap' in mergedData,
          contentMapKeysInMerged: mergedData.contentMap ? Object.keys(mergedData.contentMap).length : 0
        })
        
        // Inject callbacks for story structure nodes
        if (mergedData.nodeType === 'story-structure' || node.type === 'storyStructureNode') {
          mergedData.onItemClick = handleStructureItemClick
          mergedData.onItemsUpdate = (items: any[]) => handleStructureItemsUpdate?.(nodeId, items)
          mergedData.onWidthUpdate = (width: number) => updateNodeData(nodeId, { customNarrationWidth: width }, dependencies)
          mergedData.availableAgents = availableAgents
          mergedData.onAgentAssign = handleAgentAssign
        }
        
        const updatedNode = { ...node, data: mergedData }
        console.log('✅ Node updated successfully:', {
          nodeId,
          hasContentMap: 'contentMap' in updatedNode.data,
          contentMapKeys: updatedNode.data.contentMap ? Object.keys(updatedNode.data.contentMap).length : 0
        })
        return updatedNode
      }
      
      // Sync agent color to all assigned segments
      if (isAgentColorUpdate && node.type === 'storyStructureNode' && node.data.items) {
        const hasAssignedItems = node.data.items.some((item: any) => item.assignedAgentId === nodeId)
        
        if (hasAssignedItems) {
          const updatedItems = node.data.items.map((item: any) => {
            if (item.assignedAgentId === nodeId) {
              console.log(`Syncing color for item ${item.name}: ${item.assignedAgentColor} → ${newData.color}`)
              return {
                ...item,
                assignedAgentColor: newData.color
              }
            }
            return item
          })
          
          return { 
            ...node, 
            data: { 
              ...node.data, 
              items: updatedItems 
            } 
          }
        }
      }
      
      return node
    })
    
    return updatedNodes
  })
  
  // Update selected node to reflect changes in panel
  setSelectedNode((prev) => {
    if (prev?.id === nodeId) {
      const mergedData = { ...prev.data, ...newData }
      
      // Inject callbacks for story structure nodes
      if (mergedData.nodeType === 'story-structure' || prev.type === 'storyStructureNode') {
        mergedData.onItemClick = handleStructureItemClick
        mergedData.onItemsUpdate = (items: any[]) => handleStructureItemsUpdate?.(nodeId, items)
        mergedData.onWidthUpdate = (width: number) => updateNodeData(nodeId, { customNarrationWidth: width }, dependencies)
        mergedData.availableAgents = availableAgents
        mergedData.onAgentAssign = handleAgentAssign
      }
      
      return { ...prev, data: mergedData }
    }
    return prev
  })
  
  // Mark as having unsaved changes
  if (!isLoadingRef.current) {
    hasUnsavedChangesRef.current = true
    
    // CRITICAL: If contentMap was updated, save immediately to persist it
    if (newData.contentMap && storyId) {
      console.log('💾 Triggering immediate save for contentMap update')
      // Use setTimeout to ensure the state has updated before saving
      setTimeout(() => {
        setNodes((currentNodes) => {
          console.log('📤 Saving nodes with updated contentMap to database')
          saveCanvas(storyId, currentNodes, edges).then(() => {
            console.log('✅ ContentMap saved to database successfully')
          }).catch(err => {
            console.error('❌ Failed to save contentMap to database:', err)
          })
          return currentNodes // Don't modify nodes, just trigger save
        })
      }, 100)
    }
  }
}

/**
 * Delete a node
 * 
 * Removes node and all connected edges
 */
export function deleteNode(
  nodeId: string,
  dependencies: Pick<CanvasServiceDependencies, 'setNodes' | 'setEdges' | 'setSelectedNode' | 'selectedNode'>
): void {
  const {
    setNodes,
    setEdges,
    setSelectedNode,
    selectedNode
  } = dependencies
  
  setNodes((nds) => nds.filter((node) => node.id !== nodeId))
  setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
  // Don't close panel - let user continue working with orchestrator
  // Only clear selection if the deleted node was selected
  if (selectedNode?.id === nodeId) {
    setSelectedNode(null)
  }
}

/**
 * Add a new node of the specified type
 * 
 * Features:
 * - Generates unique node ID
 * - Initializes node data based on type
 * - Saves node immediately to database
 * 
 * Node Types:
 * - story: Story book node
 * - docs: Documents node
 * - character: Character node
 * - location: Location node
 * - research: Research node
 * - cluster: Agent/cluster node
 * - test: Test content node
 * - aiPrompt: AI Prompt node
 * 
 * Note: create-story and story-draft nodes cannot be manually created
 */
export function addNewNode(
  nodeType: NodeType,
  dependencies: CanvasServiceDependencies
): void {
  const {
    setNodes,
    nodes,
    edges,
    storyId,
    isLoadingRef
  } = dependencies
  
  // Don't allow manual creation of create-story or story-draft nodes
  if (nodeType === 'create-story' || nodeType === 'story-draft') {
    console.warn('Cannot manually create', nodeType, 'nodes')
    return
  }
  
  // Generate unique ID using timestamp + random string to avoid conflicts
  const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // Initialize node data based on type
  let nodeData: any = {
    label: 'NEW NODE',
    description: 'Click to edit',
    comments: [],
    nodeType: nodeType,
  }
  
  // Customize label based on node type
  switch (nodeType) {
    case 'story':
      nodeData.label = 'STORY BOOK'
      nodeData.description = 'Select a book'
      break
    case 'docs':
      nodeData.label = 'DOCUMENTS'
      nodeData.description = 'Upload files'
      nodeData.documents = []
      break
    case 'character':
      nodeData.label = 'CHARACTER'
      nodeData.description = 'Create a persona'
      break
    case 'location':
      nodeData.label = 'LOCATION'
      nodeData.description = 'Set a place'
      break
    case 'research':
      nodeData.label = 'RESEARCH'
      nodeData.description = 'AI-powered research'
      nodeData.status = 'idle'
      nodeData.queries = []
      nodeData.results = []
      break
    case 'cluster':
      // Count existing cluster nodes to assign next agent number
      const existingClusterCount = nodes.filter(n => n.data?.nodeType === 'cluster').length
      const nextAgentNumber = existingClusterCount + 1
      nodeData.label = 'AGENT NODE'
      nodeData.description = 'Agent node'
      nodeData.clusterNodes = []
      nodeData.color = '#9ca3af'
      nodeData.isActive = true
      nodeData.agentNumber = nextAgentNumber
      break
    case 'test':
      nodeData.label = 'TEST CONTENT'
      nodeData.description = 'Example markdown for testing'
      nodeData.markdown = EXAMPLE_SCREENPLAY_MARKDOWN
      nodeData.format = 'screenplay'
      break
    case 'aiPrompt':
      nodeData.label = 'AI PROMPT'
      nodeData.description = 'Generate structure with AI'
      nodeData.userPrompt = ''
      nodeData.maxTokens = 2000
      nodeData.isActive = true
      break
  }
  
  // Determine the node type for rendering
  const nodeRenderType = nodeType === 'cluster' ? 'clusterNode' : nodeType === 'test' ? 'testNode' : nodeType === 'aiPrompt' ? 'aiPromptNode' : 'storyNode'
  
  const newNode: Node = {
    id: newNodeId,
    type: nodeRenderType,
    position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 100 },
    data: nodeData,
  }
  
  // Don't automatically connect new nodes - let user choose connections manually
  
  // Prepare updated arrays BEFORE setState
  const updatedNodes = [...nodes, newNode]
  const updatedEdges = edges // No new edges, keep existing edges
  
  // Update nodes only
  setNodes(updatedNodes)
  
  // Immediate save after adding node with correct values
  if (storyId) {
    console.log('Immediately saving new node:', { 
      storyId, 
      nodeCount: updatedNodes.length, 
      edgeCount: updatedEdges.length,
      isLoading: isLoadingRef.current 
    })
    
    // Temporarily mark as not loading to allow save
    const wasLoading = isLoadingRef.current
    isLoadingRef.current = false
    
    // Save synchronously with the updated arrays
    saveCanvas(storyId, updatedNodes, updatedEdges).then(() => {
      console.log('New node saved successfully to database')
    }).catch(err => {
      console.error('Failed to immediately save new node:', err)
    }).finally(() => {
      // Restore loading state
      isLoadingRef.current = wasLoading
    })
  }
}

