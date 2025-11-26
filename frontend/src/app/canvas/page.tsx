'use client'

import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  ConnectionMode,
} from 'reactflow'
import 'reactflow/dist/style.css'

import UniversalNode from '@/components/canvas/UniversalNode'
import OrchestratorNode from '@/components/nodes/OrchestratorNode'
import StoryDraftNode from '@/components/nodes/StoryDraftNode'
import StoryStructureNode from '@/components/nodes/StoryStructureNode'
import ClusterNode from '@/components/nodes/ClusterNode'
import TestNode, { EXAMPLE_SCREENPLAY_MARKDOWN } from '@/components/nodes/TestNode'
import AIPromptNode from '@/components/nodes/AIPromptNode'
import NodeDetailsPanel from '@/components/panels/NodeDetailsPanel'
import NodeTypeMenu from '@/components/menus/NodeTypeMenu'
import AIDocumentPanel from '@/components/panels/AIDocumentPanel'
import { CanvasProvider } from '@/contexts/CanvasContext'
import { getStory, saveCanvas, updateStory, createStory, deleteStory } from '@/lib/stories'
import { getCanvasShares, shareCanvas, removeCanvasShare } from '@/lib/canvas-sharing'
import { NodeType, StoryFormat, StoryStructureNodeData } from '@/types/nodes'
import { MODEL_TIERS } from '@/lib/orchestrator/core/modelRouter'

// Node types for React Flow
const nodeTypes = {
  storyNode: UniversalNode,
  createStoryNode: OrchestratorNode, // Legacy support
  orchestratorNode: OrchestratorNode, // New type
  storyDraftNode: StoryDraftNode,
  storyStructureNode: StoryStructureNode,
  clusterNode: ClusterNode,
  testNode: TestNode,
  aiPromptNode: AIPromptNode,
}

// Only Orchestrator node on fresh canvas
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
        // This will be replaced by the ref during render
        console.warn('onCreateStory called before ref was set')
      }
    },
  },
]

// No edges on fresh canvas
const initialEdges: Edge[] = []

export default function CanvasPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storyId = searchParams.get('id')
  
  // ✅ FIX: Create Supabase client ONCE at component level (maintains auth session)
  const supabaseClient = useMemo(() => createClient(), [])
  
  const [hasAccess, setHasAccess] = useState<boolean>(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  
  // Canvas-level chat history (persistent across all generations)
  const [canvasChatHistory, setCanvasChatHistory] = useState<Array<{
    id: string
    timestamp: string
    content: string
    type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress'
    role?: 'user' | 'orchestrator'
  }>>([])

  // Wrapper to prevent context node deletion and handle cluster node dragging
  const handleNodesChange = useCallback((changes: any) => {
    // Filter out any removal of the context node
    const safeChanges = changes.filter((change: any) => {
      if (change.type === 'remove' && change.id === 'context') {
        return false // Block deletion of context node
      }
      return true
    })
    
    // Mark as having unsaved changes if there are actual changes
    if (safeChanges.length > 0 && !isLoadingRef.current) {
      hasUnsavedChangesRef.current = true
    }
    
    // Handle cluster node position changes - move connected resources with it
    const positionChanges = safeChanges.filter((change: any) => change.type === 'position')
    const clusterPositionChanges = positionChanges.filter((change: any) => {
      const node = nodes.find(n => n.id === change.id)
      return node?.type === 'clusterNode' && change.dragging
    })
    
    if (clusterPositionChanges.length > 0) {
      // Calculate position deltas for each moving cluster
      const deltas = clusterPositionChanges.map((change: any) => {
        const node = nodes.find(n => n.id === change.id)
        if (!node || !change.position) return null
        
        return {
          clusterId: change.id,
          deltaX: change.position.x - node.position.x,
          deltaY: change.position.y - node.position.y
        }
      }).filter(Boolean)
      
      // Find connected resource nodes and create position updates for them
      const additionalChanges: any[] = []
      deltas.forEach((delta: any) => {
        if (!delta) return
        
        // Find resources connected to this cluster
        const connectedResourceIds = edges
          .filter(e => 
            e.target === delta.clusterId && 
            e.source !== 'orchestrator' &&
            e.source !== 'context'
          )
          .map(e => e.source)
        
        // Create position updates for connected resources
        connectedResourceIds.forEach(resourceId => {
          const resourceNode = nodes.find(n => n.id === resourceId)
          if (resourceNode) {
            additionalChanges.push({
              id: resourceId,
              type: 'position',
              position: {
                x: resourceNode.position.x + delta.deltaX,
                y: resourceNode.position.y + delta.deltaY
              },
              dragging: false
            })
          }
        })
      })
      
      // Add the additional changes
      if (additionalChanges.length > 0) {
        safeChanges.push(...additionalChanges)
      }
    }
    
    onNodesChange(safeChanges)
  }, [onNodesChange, nodes, edges])

  // Wrapper for edges to track changes
  const handleEdgesChange = useCallback((changes: any) => {
    // Mark as having unsaved changes if there are actual changes
    if (changes.length > 0 && !isLoadingRef.current) {
      hasUnsavedChangesRef.current = true
    }
    
    onEdgesChange(changes)
  }, [onEdgesChange])

  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [storyTitle, setStoryTitle] = useState('Untitled Story')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'prospect' | 'admin' | 'user' | null>(null)
  const [isAIDocPanelOpen, setIsAIDocPanelOpen] = useState(false)
  const [orchestratorPanelWidth, setOrchestratorPanelWidth] = useState(384) // Track orchestrator panel width
  const [initialPrompt, setInitialPrompt] = useState('')
  const [currentStoryDraftId, setCurrentStoryDraftId] = useState<string | null>(null)
  const [initialDocumentContent, setInitialDocumentContent] = useState('')
  const [currentStoryStructureNodeId, setCurrentStoryStructureNodeId] = useState<string | null>(null)
  const [currentStructureItems, setCurrentStructureItems] = useState<any[]>([])
  const [currentStructureFormat, setCurrentStructureFormat] = useState<StoryFormat | undefined>(undefined)
  const [currentContentMap, setCurrentContentMap] = useState<Record<string, string>>({})
  const [currentSections, setCurrentSections] = useState<Array<{ id: string; structure_item_id: string; content: string }>>([])
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null)
  
  // Store refresh function from document panel
  const refreshSectionsRef = useRef<(() => Promise<void>) | null>(null)
  
  // Active context for orchestrator (when clicking segments/sections)
  const [activeContext, setActiveContext] = useState<{
    type: 'section' | 'segment'
    id: string
    name: string
    title?: string
    level?: number
    description?: string
  } | null>(null)
  
  // TEMPORARY: Force admin for your email while debugging
  const isForceAdmin = user?.email === 'pal.machulla@gmail.com'
  console.log('🔧 isForceAdmin check:', { email: user?.email, isForceAdmin, userRole })
  const [saving, setSaving] = useState(false)
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(true)
  const isLoadingRef = useRef(true)
  const currentStoryIdRef = useRef<string | null>(null)
  const lastLoadedStoryIdRef = useRef<string | null>(null)
  const hasUnsavedChangesRef = useRef(false) // Track if user made changes
  const isInferencingRef = useRef(false) // Track if AI is currently generating
  const titleInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  
  // Sharing state
  const [sharingDropdownOpen, setSharingDropdownOpen] = useState(false)
  const [canvasVisibility, setCanvasVisibility] = useState<'private' | 'shared' | 'public'>('private')
  const [sharedEmails, setSharedEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const sharingDropdownRef = useRef<HTMLDivElement>(null)

  // Check access control
  useEffect(() => {
    async function checkAccess() {
      if (!user) return

      setCheckingAccess(true)
      const supabase = createClient()
      
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('role, access_status')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error checking access:', error)
          // If profile doesn't exist, create it
          if (error.code === 'PGRST116') {
            await supabase.from('user_profiles').insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.name,
              role: 'prospect',
              access_status: 'waitlist'
            })
            setHasAccess(false)
          } else {
            setHasAccess(false)
          }
        } else {
          // Check if user has proper role (admin or user)
          // Prospects must go to waitlist
          if (profile.role === 'admin' || profile.role === 'user') {
            setHasAccess(true)
          } else if (profile.role === 'prospect') {
            setHasAccess(false)
          } else {
            setHasAccess(false)
          }
        }
      } catch (error) {
        console.error('Access check failed:', error)
        setHasAccess(false)
      } finally {
        setCheckingAccess(false)
      }
    }

    if (!loading && user) {
      checkAccess()
    }
  }, [user, loading])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    } else if (!checkingAccess && hasAccess === false && user) {
      router.push('/waitlist')
    } else if (!loading && user && hasAccess && !storyId) {
      // Redirect to stories page if no story ID
      router.push('/stories')
    } else if (user) {
      // Get user avatar from metadata (social login)
      const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      setUserAvatar(avatar)
      
      // Check user role for admin access
      const checkUserRole = async () => {
        try {
          const supabase = createClient()
          console.log('🔍 Checking user role for:', user.id, user.email)
          
          const { data, error } = await supabase
            .from('user_profiles')
            .select('role, access_status, access_tier')
            .eq('id', user.id)
            .single()
          
          if (error) {
            console.error('❌ Error fetching user role:', error)
            console.error('Error details:', JSON.stringify(error, null, 2))
          } else {
            console.log('✅ User profile data:', data)
            if (data && data.role) {
              setUserRole(data.role)
              console.log('✅ User role set to:', data.role)
            } else {
              console.warn('⚠️ No role found in data:', data)
            }
          }
        } catch (err) {
          console.error('❌ Exception checking user role:', err)
        }
      }
      checkUserRole()
    }
  }, [user, loading, router, storyId, checkingAccess, hasAccess])

  // Maintain inference loading state on orchestrator node
  useEffect(() => {
    if (isInferencingRef.current) {
      // Ensure orchestrator node keeps showing inference state
      setNodes((currentNodes) => {
        const orchestratorNode = currentNodes.find(n => n.id === 'context')
        if (!orchestratorNode) return currentNodes
        
        const nodeData = orchestratorNode.data as any
        if (!nodeData.isOrchestrating || nodeData.loadingText !== 'Inference') {
          console.log('🔄 Re-applying inference loading state (was cleared by another update)')
          return currentNodes.map(n =>
            n.id === 'context'
              ? { ...n, data: { ...n.data, isOrchestrating: true, loadingText: 'Inference' } }
              : n
          )
        }
        return currentNodes
      })
    }
  }, [nodes, setNodes])

  // Load story on mount or when storyId changes
  useEffect(() => {
    if (!loading && user && storyId && storyId !== lastLoadedStoryIdRef.current) {
      console.log('Loading story:', storyId, '(previously loaded:', lastLoadedStoryIdRef.current, ')')
      
      // Clear chat history when switching canvases (fresh start for each canvas)
      setCanvasChatHistory([])
      console.log('🗑️ Chat history cleared for new canvas')
      
      // Set loading flags before loading
      setIsLoadingCanvas(true)
      isLoadingRef.current = true
      currentStoryIdRef.current = storyId
      lastLoadedStoryIdRef.current = storyId
      
      // Load data directly without resetting state
      // (loadStoryData will set the correct nodes/edges)
      loadStoryData(storyId)
    }
  }, [user, loading, storyId])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        setIsMenuOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as HTMLElement)) {
        setIsProfileMenuOpen(false)
      }
      if (sharingDropdownRef.current && !sharingDropdownRef.current.contains(event.target as HTMLElement)) {
        setSharingDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadStoryData = async (id: string) => {
    // Activate orchestrator on existing nodes FIRST
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === 'context'
          ? { ...node, data: { ...node.data, isOrchestrating: true, loadingText: 'Loading Canvas' } }
          : node
      )
    )

    try {
      console.log(`Loading story: ${id}`)
      const { story, nodes: loadedNodes, edges: loadedEdges } = await getStory(id)
      
      // Load canvas visibility and shared emails
      if (story.is_public) {
        setCanvasVisibility('public')
      } else if (story.shared) {
        setCanvasVisibility('shared')
      } else {
        setCanvasVisibility('private')
      }
      
      // Load shared emails from database
      try {
        const shares = await getCanvasShares(id)
        setSharedEmails(shares.map(share => share.shared_with_email))
      } catch (error) {
        console.error('Failed to load shared users:', error)
        setSharedEmails([])
      }
      
      // Ensure orchestrator node always exists
      const hasContextCanvas = loadedNodes.some(node => node.id === 'context')
      let finalNodes = loadedNodes
      
      if (!hasContextCanvas) {
        // Add Orchestrator node if it doesn't exist
        const contextNode: Node = {
          id: 'context',
          type: 'orchestratorNode',
          position: { x: 250, y: 500 },
          data: { 
            label: 'Orchestrator',
            comments: [],
            nodeType: 'create-story' as NodeType
          },
        }
        finalNodes = [...loadedNodes, contextNode]
      }
      
      // Get available agents from loaded nodes
      const loadedAgents = finalNodes
        .filter(n => n.type === 'clusterNode')
        .map(n => ({
          id: n.id,
          agentNumber: n.data.agentNumber || 0,
          color: n.data.color || '#9ca3af',
          label: n.data.label || 'Agent'
        }))
        .sort((a, b) => a.agentNumber - b.agentNumber)
      
      // Inject callbacks and agents into story structure nodes
      finalNodes = finalNodes.map(node => {
        if (node.type === 'storyStructureNode' || node.data?.nodeType === 'story-structure') {
          return {
            ...node,
            data: {
              ...node.data,
              onItemClick: handleStructureItemClick,
              onItemsUpdate: (items: any[]) => handleStructureItemsUpdate(node.id, items),
              onWidthUpdate: (width: number) => handleNodeUpdate(node.id, { customNarrationWidth: width }),
              availableAgents: loadedAgents,
              onAgentAssign: handleAgentAssign
            }
          }
        }
        // Migrate old createStoryNode and contextCanvas types to orchestratorNode
        if (node.id === 'context' && (node.type === 'createStoryNode' || node.type === 'contextCanvas')) {
          console.log(`Migrating old ${node.type} to orchestratorNode`)
          return {
            ...node,
            type: 'orchestratorNode',
            data: {
              ...node.data,
              label: node.data.label || 'Orchestrator',
              nodeType: 'create-story'
            }
          }
        }
        return node
      })
      
      // Upgrade all edges to use bezier for smooth curved lines
      const upgradedEdges = loadedEdges.map((edge: Edge) => ({
        ...edge,
        type: 'default', // Default type uses smooth bezier curves
        style: { 
          ...edge.style,
          stroke: edge.style?.stroke || '#9ca3af', 
          strokeWidth: edge.style?.strokeWidth || 2 
        }
      }))
      
      console.log(`Loaded ${finalNodes.length} nodes, ${loadedEdges.length} edges for story: ${id}`)
      
      setNodes(finalNodes)
      setEdges(upgradedEdges)
      setStoryTitle(story.title)
      
      // Use setTimeout to ensure state updates are applied
      setTimeout(() => {
        setIsLoadingCanvas(false)
        isLoadingRef.current = false
        hasUnsavedChangesRef.current = false // Clear unsaved changes flag after loading
        
        // Hide orchestrator indicator after a moment
        setTimeout(() => {
          setNodes((currentNodes) =>
            currentNodes.map((node) =>
              node.id === 'context'
                ? { ...node, data: { ...node.data, isOrchestrating: false, loadingText: '' } }
                : node
            )
          )
        }, 500)
        
        console.log(`Story ${id} fully loaded and ready for edits`)
      }, 500)
    } catch (error) {
      console.error('Failed to load story:', error)
      setIsLoadingCanvas(false)
      isLoadingRef.current = false
      
      // Hide orchestrator indicator on error
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === 'context'
            ? { ...node, data: { ...node.data, isOrchestrating: false, loadingText: '' } }
            : node
        )
      )
    }
  }

  const handleTitleBlur = async () => {
    if (!storyId || !storyTitle.trim()) return
    
    try {
      await updateStory(storyId, { title: storyTitle })
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }

  // Manual save function (user-triggered only)
  const handleSave = useCallback(async () => {
    // Don't save if we're loading or if storyId doesn't match or already saving
    if (!storyId || isLoadingRef.current || currentStoryIdRef.current !== storyId || saving) {
      console.log('Skipping save: loading, storyId mismatch, or already saving')
      return
    }
    
    // Ensure context node is always present before saving
    const hasContext = nodes.some(node => node.id === 'context')
    let nodesToSave = nodes
    
    if (!hasContext) {
      const contextNode: Node = {
        id: 'context',
        type: 'orchestratorNode',
        position: { x: 250, y: 500 },
        data: { 
          label: 'Orchestrator',
          comments: [],
          nodeType: 'create-story' as NodeType
        },
      }
      nodesToSave = [...nodes, contextNode]
      setNodes(nodesToSave)
    }
    
    // Activate orchestrator continuous animation
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === 'context'
          ? { ...node, data: { ...node.data, isOrchestrating: true, loadingText: 'Saving Canvas' } }
          : node
      )
    ) // Update every 50ms for smooth animation
    
    setSaving(true)
    try {
      await saveCanvas(storyId, nodesToSave, edges)
      // Clear the unsaved changes flag after successful save
      hasUnsavedChangesRef.current = false
      
      // Wait a moment to show completion, then hide
      setTimeout(() => {
        setNodes((currentNodes) =>
          currentNodes.map((node) =>
            node.id === 'context'
              ? { ...node, data: { ...node.data, isOrchestrating: false, loadingText: '' } }
              : node
          )
        )
      }, 500)
    } catch (error) {
      console.error('Failed to save canvas:', error)
      alert('Failed to save canvas. Please try again.')
      // Hide animation on error
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === 'context'
            ? { ...node, data: { ...node.data, isOrchestrating: false, loadingText: '' } }
            : node
        )
      )
    } finally {
      setSaving(false)
    }
  }, [storyId, nodes, edges, setNodes, saving])

  // No auto-save - user controls when to save via manual button

  const handleLogout = async () => {
    await signOut()
    router.push('/auth')
  }

  const handlePromptSubmit = useCallback((prompt: string) => {
    console.log('🚀 handlePromptSubmit called with:', prompt)
    setInitialPrompt(prompt)
    setIsAIDocPanelOpen(true)
  }, [])

  // Handle story structure item click - open AI Document Panel with structure context
  const handleStructureItemClick = useCallback(async (
    clickedItem: any,
    allItems: any[],
    format: StoryFormat,
    nodeId: string
  ) => {
    console.log('🎯 Structure item clicked:', { clickedItem, allItems, format, nodeId })
    
    // CRITICAL: Use setNodes to get the LATEST nodes (not stale closure)
    let latestContentMap: Record<string, string> = {}
    let isNodeLoading = false
    
    setNodes((currentNodes) => {
      const structureNode = currentNodes.find(n => n.id === nodeId)
      
      // ✅ CHECK: Prevent opening document panel if node is still being initialized
      if (structureNode?.data?.isLoading) {
        isNodeLoading = true
        console.warn('⏳ [handleStructureItemClick] Node is still loading, cannot open document panel yet')
        return currentNodes
      }
      
      console.log('🔍 Looking for structure node in LATEST state:', {
        searchingForNodeId: nodeId,
        availableNodes: currentNodes.map(n => ({ id: n.id, type: n.type })),
        foundNode: structureNode ? 'YES' : 'NO'
      })
      
      latestContentMap = (structureNode?.data as StoryStructureNodeData)?.contentMap || {}
      
      console.log('📦 ContentMap from LATEST node state:', {
        nodeId,
        structureNode: structureNode ? 'found' : 'not found',
        structureNodeType: structureNode?.type,
        dataKeys: structureNode?.data ? Object.keys(structureNode.data) : [],
        hasContentMapProperty: structureNode?.data ? 'contentMap' in structureNode.data : false,
        contentMapType: typeof latestContentMap,
        hasContentMap: Object.keys(latestContentMap).length > 0,
        contentMapKeys: Object.keys(latestContentMap),
        firstContentKey: Object.keys(latestContentMap)[0],
        firstContentPreview: latestContentMap[Object.keys(latestContentMap)[0]]?.substring(0, 100)
      })
      
      return currentNodes // Don't modify nodes, just read from them
    })
    
    // ✅ GUARD: Don't open document panel if node is still loading
    if (isNodeLoading) {
      alert('⏳ Document is still being generated. Please wait a moment and try again.')
      return
    }
    
    // Set initial prompt
    setInitialPrompt(`Write content for ${clickedItem.name}${clickedItem.title ? `: ${clickedItem.title}` : ''}`)
    
    // Store the structure details for AI Document Panel
    console.log('💾 Setting state for AI Document Panel:', {
      nodeId,
      itemsCount: allItems.length,
      format,
      contentMapKeys: Object.keys(latestContentMap).length
    })
    
    setCurrentStoryStructureNodeId(nodeId)
    setCurrentStructureItems(allItems)
    setCurrentStructureFormat(format)
    setCurrentContentMap(latestContentMap)
    
    console.log('✅ State set complete')
    setInitialSectionId(clickedItem.id)
    
    // Open AI Document Panel
    setIsAIDocPanelOpen(true)
    
    console.log('Opening AI Document Panel with nodeId:', nodeId, 'clickedItem:', clickedItem.id)
  }, [setNodes])
  
  // Handle story structure items update (e.g., expanded state changes)
  const handleStructureItemsUpdate = useCallback((nodeId: string, updatedItems: any[]) => {
    console.log('Structure items updated:', { nodeId, updatedItems })
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              items: updatedItems,
              onItemClick: handleStructureItemClick,
              onItemsUpdate: (items: any[]) => handleStructureItemsUpdate(nodeId, items)
            }
          }
        }
        return node
      })
    )
    
    // Update current structure items if this is the currently open node
    if (nodeId === currentStoryStructureNodeId) {
      setCurrentStructureItems(updatedItems)
    }
    
    // Mark as having unsaved changes
    if (!isLoadingRef.current) {
      hasUnsavedChangesRef.current = true
    }
  }, [handleStructureItemClick, currentStoryStructureNodeId])

  // Handle switching between documents
  const handleSwitchDocument = useCallback((nodeId: string) => {
    console.log('Switching to document:', nodeId)
    
    // Use setNodes to get LATEST state
    let latestContentMap: Record<string, string> = {}
    let allItems: any[] = []
    let format: StoryFormat | undefined
    
    setNodes((currentNodes) => {
      const targetNode = currentNodes.find(n => n.id === nodeId && n.type === 'storyStructureNode')
      if (!targetNode) {
        console.error('Story structure node not found:', nodeId)
        return currentNodes
      }
      
      const nodeData = targetNode.data as StoryStructureNodeData
      allItems = nodeData.items || []
      format = nodeData.format
      latestContentMap = nodeData.contentMap || {}
      
      return currentNodes // Don't modify nodes, just read from them
    })
    
    // Update state
    setCurrentStoryStructureNodeId(nodeId)
    setCurrentStructureItems(allItems)
    setCurrentStructureFormat(format)
    setCurrentContentMap(latestContentMap)
    setInitialSectionId(null) // Reset to first section
  }, [])


  // Get available agent nodes for assignment
  const availableAgents = useMemo(() => {
    return nodes
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
  }, [nodes])

  // Handle agent assignment to structure items (defined BEFORE useEffect that uses it)
  const handleAgentAssign = useCallback((itemId: string, agentId: string | null) => {
    console.log('Agent assignment:', { itemId, agentId })
    
    setNodes((currentNodes) => {
      let previousAgentId: string | null = null
      let updatedNodes = currentNodes
      
      // First pass: Update structure node and track previous agent
      updatedNodes = updatedNodes.map((node) => {
        if (node.type === 'storyStructureNode' && node.data.items) {
          const hasThisItem = node.data.items.some((item: any) => item.id === itemId)
          if (!hasThisItem) return node
          
          const updatedItems = node.data.items.map((item: any) => {
            if (item.id === itemId) {
              previousAgentId = item.assignedAgentId || null
              
              if (agentId) {
                // Assign agent
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
                // Unassign agent
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
      
      // Second pass: Update agent active/passive status
      updatedNodes = updatedNodes.map((node) => {
        if (node.type === 'clusterNode') {
          // Check if this agent is assigned to any items across all structure nodes
          const isAssigned = updatedNodes.some((n) => 
            n.type === 'storyStructureNode' && 
            n.data.items?.some((item: any) => item.assignedAgentId === node.id)
          )
          
          // Set active if assigned, passive if not
          if (node.data.isActive !== isAssigned) {
            console.log(`Agent ${node.id} isActive: ${node.data.isActive} → ${isAssigned}`)
            return { ...node, data: { ...node.data, isActive: isAssigned } }
          }
        }
        return node
      })
      
      return updatedNodes
    })
    
    // Mark as having unsaved changes
    if (!isLoadingRef.current) {
      hasUnsavedChangesRef.current = true
    }
    
    // Trigger save
    handleSave()
  }, [availableAgents, handleSave])

  // Track cluster count and agent data to detect when agents change
  const clusterCount = useMemo(() => nodes.filter(n => n.type === 'clusterNode').length, [nodes])
  const prevClusterCountRef = useRef(clusterCount)
  const prevAvailableAgentsRef = useRef(availableAgents)
  
  // Update structure nodes with latest agents when cluster nodes change
  // ❌ TEMPORARILY DISABLED: This useEffect was causing infinite loops
  // TODO: Re-enable and fix properly after debugging
  // The issue is that updating structure nodes with availableAgents triggers
  // ReactFlow/Zustand state changes that cascade into an infinite loop
  /*
  useEffect(() => {
    if (isLoadingRef.current) return // Don't run during initial load
    
    // ✅ FIX: Only depend on clusterCount to avoid dependency loops
    // Check if cluster count actually changed
    const countChanged = prevClusterCountRef.current !== clusterCount
    
    if (!countChanged) return // Exit early if count hasn't changed
    
    prevClusterCountRef.current = clusterCount
    
    if (clusterCount === 0) return
    
    console.log('Cluster count changed to', clusterCount, '- updating structure nodes')
    
    // Compute agents from current nodes state
    setNodes((currentNodes) => {
      // Compute fresh agents from the current nodes
      const currentAvailableAgents = currentNodes
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
      
      // Update structure nodes with fresh agent list
      return currentNodes.map((node) => {
        if (node.type === 'storyStructureNode') {
          return {
            ...node,
            data: {
              ...node.data,
              availableAgents: currentAvailableAgents,
              // ✅ onAgentAssign is already set when node is created, don't update it
            }
          }
        }
        return node
      })
    })
  }, [clusterCount]) // ✅ FIX: ONLY depend on clusterCount, not nodes or availableAgents
  */

  // Handle Create Story node click - spawn new story structure node
  const handleCreateStory = useCallback(async (format: StoryFormat, template?: string, userPromptDirect?: string, plan?: any) => {
    console.log('handleCreateStory called with format:', format, 'template:', template, 'userPromptDirect:', userPromptDirect, 'plan:', plan)
    
    // 🔧 FIX: Generate proper UUID for node ID (not "structure-..." prefix!)
    // Structure items inside will have "structure-..." IDs, but the NODE itself needs a UUID
    const structureId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    console.log('✅ [handleCreateStory] Generated node ID:', {
      nodeId: structureId,
      format: structureId.startsWith('structure-') ? '❌ WRONG' : '✅ CORRECT'
    })
    
    // Get formatted title based on format (including report subtypes)
    const formatLabels: Record<string, string> = {
      'novel': 'Novel',
      'report': 'Report',
      'report_script_coverage': 'Script Coverage Report',
      'report_business': 'Business Report',
      'report_content_analysis': 'Content Analysis Report',
      'short-story': 'Short Story',
      'article': 'Article',
      'screenplay': 'Screenplay',
      'essay': 'Essay',
      'podcast': 'Podcast'
    }
    const title = formatLabels[format] || 'Document'
    
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
      onItemsUpdate: (items: any[]) => handleStructureItemsUpdate(structureId, items),
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
    
    setNodes([...nodes, newStructureNode])
    setEdges([...edges, newEdge])
    hasUnsavedChangesRef.current = true

    // Save immediately to database so node exists for when items are clicked
    const saveAndFinalize = async () => {
      try {
        console.log('💾 [saveAndFinalize] Starting save for node:', structureId, {
          storyId,
          userId: user?.id,
          hasNodes: nodes.length > 0,
          saving,
          nodeDataKeys: Object.keys(newStructureNode.data),
          itemsCount: newStructureNode.data.items?.length || 0
        })
        
        // ✅ FIX: Use component-level Supabase client (same auth session everywhere)
        const supabase = supabaseClient
        
        console.log('🔧 [saveAndFinalize] Attempting INSERT into Supabase...')
        
        // ✅ FIX: Initialize document_data so agents can save content immediately
        // Import DocumentManager dynamically to avoid circular dependency
        const { DocumentManager } = await import('@/lib/document/DocumentManager')
        const docManager = DocumentManager.fromStructureItems(
          newStructureNode.data.items || [],
          (newStructureNode.data.format as 'novel' | 'screenplay' | 'report') || 'novel'
        )
        
        const insertPayload = {
          id: structureId,
          story_id: storyId,
          type: 'storyStructure',
          data: newStructureNode.data,
          document_data: docManager.getData(), // ✅ FIX: Initialize with empty hierarchical document
          position_x: newStructureNode.position.x,
          position_y: newStructureNode.position.y
          // ✅ FIX: No user_id column in nodes table (tracked via story_id → stories.user_id)
        }
        console.log('📦 [saveAndFinalize] INSERT payload:', JSON.stringify(insertPayload, null, 2).substring(0, 500))
        
        const { data: insertData, error: insertError } = await supabase
          .from('nodes')
          .insert(insertPayload)
          .select()
        
        console.log('📡 [saveAndFinalize] INSERT response:', {
          success: !insertError,
          insertedData: insertData,
          error: insertError,
          errorCode: insertError?.code,
          errorMessage: insertError?.message,
          errorDetails: insertError?.details
        })
        
        // ✅ FIX: Add verification query to confirm node exists
        if (!insertError && insertData) {
          console.log('🔍 [saveAndFinalize] Verifying node exists with SELECT query...')
          const { data: verifyData, error: verifyError } = await supabase
            .from('nodes')
            .select('id, type, story_id')
            .eq('id', structureId)
            .single()
          
          console.log('📡 [saveAndFinalize] Verification SELECT response:', {
            found: !verifyError && verifyData,
            verifyData,
            verifyError,
            note: 'If this fails, RLS is blocking even the user who just inserted!'
          })
        }
        
        if (insertError) {
          // Ignore duplicate key errors (node already exists)
          if (insertError.code !== '23505') {
            console.error('❌ [saveAndFinalize] Node insert error:', {
              code: insertError.code,
              message: insertError.message,
              details: insertError.details,
              hint: insertError.hint
            })
            throw insertError
          } else {
            console.log('⚠️ [saveAndFinalize] Node already exists in database, updating instead...')
            // Update existing node (including document_data)
            const { error: updateError } = await supabase
              .from('nodes')
              .update({
                data: newStructureNode.data,
                document_data: docManager.getData(), // ✅ FIX: Ensure document_data is initialized
                position_x: newStructureNode.position.x, // ✅ FIX: Use position_x/position_y columns
                position_y: newStructureNode.position.y
              })
              .eq('id', structureId)
            
            if (updateError) {
              console.error('❌ [saveAndFinalize] Node update error:', updateError)
              throw updateError
            }
            console.log('✅ [saveAndFinalize] Node updated successfully')
          }
        } else {
          console.log('✅ [saveAndFinalize] Node inserted successfully:', insertData)
        }
        
        console.log('✅ [saveAndFinalize] Node explicitly saved to Supabase:', structureId)
        
        // 🔍 VERIFICATION: Immediately query the node to confirm it's readable
        console.log('🔍 [saveAndFinalize] VERIFICATION: Re-querying node to confirm it exists...')
        
        // 🔍 DEBUG: Check auth session before verification
        const { data: sessionData } = await supabase.auth.getSession()
        console.log('🔐 [saveAndFinalize] Auth session check:', {
          hasSession: !!sessionData?.session,
          userId: sessionData?.session?.user?.id || 'NONE',
          sessionExpiry: sessionData?.session?.expires_at || 'NONE'
        })
        
        const { data: verifyData, error: verifyError } = await supabase
          .from('nodes')
          .select('id, document_data')
          .eq('id', structureId)
          .single()
        
        if (verifyError) {
          console.error('❌ [saveAndFinalize] VERIFICATION FAILED: Node not immediately queryable!', {
            nodeId: structureId,
            errorCode: verifyError.code,
            errorMessage: verifyError.message,
            errorDetails: verifyError.details,
            errorHint: verifyError.hint
          })
        } else {
          console.log('✅ [saveAndFinalize] VERIFICATION SUCCESS: Node is immediately queryable', {
            nodeId: verifyData.id,
            hasDocumentData: !!verifyData.document_data
          })
        }
        
        // Now call handleSave() for edges and other nodes
        await handleSave()
        console.log('✅ [saveAndFinalize] Full save completed')
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
    
    // If plan is already provided, skip orchestration and just save
    // ✅ FIX: Await the save to prevent race condition when opening document immediately after creation
    if (plan) {
      console.log('✅ Plan already provided by orchestrator, saving synchronously to prevent race condition')
      try {
        await saveAndFinalize()
        console.log('✅ Node saved to database successfully')
      } catch (err) {
        console.error('❌ Failed to save new structure node:', err)
      }
      return // Exit early - no need to orchestrate again
    }
    
    // AUTO-GENERATE: Check if AI Prompt node is connected OR chat prompt exists
    const aiPromptNode = nodes.find(n => 
      n.data?.nodeType === 'aiPrompt' && 
      edges.some(e => e.source === n.id && e.target === 'context')
    )
    
    // Check if chat prompt exists (direct parameter OR orchestrator node data)
    const orchestratorNode = nodes.find(n => n.id === 'context')
    const hasChatPrompt = !!userPromptDirect || !!(orchestratorNode?.data as any)?.chatPrompt
    
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
      try {
        await saveAndFinalize() // ✅ CRITICAL: Must await to prevent race condition
        console.log('✅ [handleCreateStory] Node saved, now triggering orchestration')
        triggerOrchestratedGeneration(structureId, format, aiPromptNode || null, 'context', userPromptDirect)
      } catch (err) {
        console.error('❌ [handleCreateStory] Failed to save node before orchestration:', err)
        // Still try to orchestrate even if save failed (might be duplicate key error)
        triggerOrchestratedGeneration(structureId, format, aiPromptNode || null, 'context', userPromptDirect)
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
  }, [nodes, edges, setNodes, setEdges, handleSave])
  
  // NEW: Orchestrator-based generation using agentic system
  const triggerOrchestratedGeneration = async (
    structureNodeId: string,
    format: StoryFormat,
    aiPromptNode: Node | null, // Now optional
    orchestratorNodeId: string,
    userPromptDirect?: string // Direct chat prompt (bypasses node data)
  ) => {
    console.log('═══════════════════════════════════════════════')
    console.log('🎬 ORCHESTRATION STARTED')
    console.log('═══════════════════════════════════════════════')
    console.log('Structure ID:', structureNodeId)
    console.log('Format:', format)
    console.log('Has AI Prompt Node:', !!aiPromptNode)
    console.log('Orchestrator ID:', orchestratorNodeId)
    console.log('═══════════════════════════════════════════════')
    
    // Check authentication
    if (!user) {
      isInferencingRef.current = false
      alert('❌ You must be logged in to generate content.')
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === structureNodeId) {
            return { ...n, data: { ...n.data, isLoading: false } }
          } else if (n.id === orchestratorNodeId) {
            return { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
          }
          return n
        })
      )
      return
    }
    
    // Determine user prompt source (priority: direct > AI Prompt node)
    let userPrompt = ''
    
    if (userPromptDirect) {
      // Priority 1: Direct chat input
      userPrompt = userPromptDirect
      console.log('✅ Using direct chat prompt:', userPrompt)
    } else if (aiPromptNode) {
      // Priority 2: AI Prompt node
      const isActive = (aiPromptNode.data as any).isActive !== false
      userPrompt = (aiPromptNode.data as any).userPrompt || ''
      
      if (isActive && !userPrompt.trim()) {
        alert('Please enter a prompt in the AI Prompt node first, or set it to Passive mode.')
        return
      }
      console.log('✅ Using AI Prompt node:', userPrompt)
    } else {
      alert('Please use the chat input in the panel or connect an AI Prompt node.')
      return
    }
    
    if (!userPrompt.trim()) {
      alert('Please enter a prompt first.')
      return
    }
    
    try {
      // Set inference flag
      isInferencingRef.current = true
      
      // Use unified orchestrator for structure generation
      
      // Get orchestrator node
      const orchestratorNode = nodes.find(n => n.id === orchestratorNodeId)
      
      console.log('🔍 Fetching user preferences...')
      
      // Fetch user's orchestrator/writer preferences
      let orchestratorModelId: string | null = null
      let writerModelIds: string[] = []
      let userKeyId: string | null = null
      
      // Fetch ALL API keys and find first configured orchestrator
      const prefsResponse = await fetch('/api/user/api-keys')
      const prefsData = await prefsResponse.json()
      
      console.log('📦 API keys response:', {
        success: prefsData.success,
        keyCount: prefsData.keys?.length,
        keys: prefsData.keys?.map((k: any) => ({
          id: k.id,
          provider: k.provider,
          orchestrator: k.orchestrator_model_id,
          writers: k.writer_model_ids
        }))
      })
      
      if (prefsData.success && prefsData.keys?.length > 0) {
        // Find first key with orchestrator configured
        const configuredKey = prefsData.keys.find((k: any) => k.orchestrator_model_id)
        
        if (configuredKey) {
          orchestratorModelId = configuredKey.orchestrator_model_id
          writerModelIds = configuredKey.writer_model_ids || []
          userKeyId = configuredKey.id
          console.log('✅ Found configured orchestrator:', {
            orchestrator: orchestratorModelId,
            writers: writerModelIds.length,
            keyId: userKeyId,
            provider: configuredKey.provider
          })
        } else {
          // No explicit orchestrator configured (Auto-select mode)
          // Use first available API key for authentication
          const firstKey = prefsData.keys[0]
          userKeyId = firstKey.id
          writerModelIds = firstKey.writer_model_ids || []
          console.log('⚡ Auto-select mode: Using first API key:', {
            keyId: userKeyId,
            provider: firstKey.provider,
            writers: writerModelIds.length
          })
        }
      } else {
        console.log('❌ No API keys found')
      }
      
      console.log('📋 User preferences:', {
        orchestratorModelId,
        writerModelIds,
        userKeyId
      })
      
      // Initialize reasoning messages array
      const reasoningMessages: Array<{
        timestamp: string
        content: string
        type: 'thinking' | 'decision' | 'task' | 'result' | 'error'
      }> = []
      
      // Reasoning callback to update CANVAS-LEVEL chat history
      const onReasoning = (message: string, type: any) => {
        const msg = {
          id: `reasoning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          content: message,
          type,
          role: 'orchestrator' as const
        }
        reasoningMessages.push(msg)
        
        // Append to canvas-level chat history (persistent)
        setCanvasChatHistory(prev => [...prev, msg])
        
        // Also update orchestrator node for backward compatibility
        setNodes((nds) =>
          nds.map((n) =>
            n.id === orchestratorNodeId
              ? { ...n, data: { ...n.data, reasoningMessages: [...reasoningMessages] } }
              : n
          )
        )
      }
      
      // Update orchestrator to show it's working and clear chat prompt for next generation
      setNodes((nds) =>
        nds.map((n) =>
          n.id === orchestratorNodeId
            ? { ...n, data: { ...n.data, isOrchestrating: true, loadingText: 'Orchestrating', reasoningMessages: [], chatPrompt: undefined } }
            : n
        )
      )
      
      onReasoning('🚀 Initializing orchestrator engine...', 'thinking')
      
      // Announce the format selected by user
      const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/-/g, ' ')
      onReasoning(`📖 User selected format: ${formatLabel}`, 'decision')
      onReasoning(`💭 Analyzing prompt for ${formatLabel} structure...`, 'thinking')
      
      // Streaming callback for real-time model reasoning
      let modelReasoningBuffer = ''
      let currentModelMessage: {
        id: string
        timestamp: string
        content: string
        type: 'thinking' | 'decision' | 'task' | 'result' | 'error'
      } | null = null
      
      const onModelStream = (content: string, type: 'reasoning' | 'content') => {
        console.log('[Canvas] Model stream:', { type, contentLength: content.length, preview: content.substring(0, 50) })
        
        if (type === 'reasoning') {
          // Accumulate reasoning tokens
          modelReasoningBuffer += content
          
          // Create or update a "model thinking" message
          if (!currentModelMessage) {
            currentModelMessage = {
              id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              content: '',
              type: 'thinking'
            }
            reasoningMessages.push(currentModelMessage)
            console.log('[Canvas] Created MODEL reasoning message')
          }
          
          // Update the message content with accumulated reasoning
          currentModelMessage.content = `🤖 Model reasoning:\n${modelReasoningBuffer}`
          
          // Update canvas-level chat history (persistent)
          setCanvasChatHistory(prev => {
            const existingIndex = prev.findIndex(m => m.id === currentModelMessage!.id)
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = { ...currentModelMessage!, role: 'orchestrator' as const }
              return updated
            }
            return [...prev, { ...currentModelMessage!, role: 'orchestrator' as const }]
          })
          
          // Update orchestrator node with the new messages
          setNodes((nds) =>
            nds.map((n) =>
              n.id === orchestratorNodeId
                ? { ...n, data: { ...n.data, reasoningMessages: [...reasoningMessages] } }
                : n
            )
          )
        } else if (type === 'content') {
          // DEBUG: Also show content streaming (the JSON plan being built)
          // This lets us see that streaming IS working, even without <think> tags
          if (!currentModelMessage) {
            currentModelMessage = {
              id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              content: '',
              type: 'thinking'
            }
            reasoningMessages.push(currentModelMessage)
            console.log('[Canvas] Created MODEL content stream message')
          }
          
          // Show first 200 chars of the JSON being built
          modelReasoningBuffer += content
          const preview = modelReasoningBuffer.length > 200 
            ? modelReasoningBuffer.substring(0, 200) + '...' 
            : modelReasoningBuffer
          currentModelMessage.content = `🤖 Model streaming plan (JSON):\n${preview}`
          
          // Update canvas-level chat history (persistent)
          setCanvasChatHistory(prev => {
            const existingIndex = prev.findIndex(m => m.id === currentModelMessage!.id)
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = { ...currentModelMessage!, role: 'orchestrator' as const }
              return updated
            }
            return [...prev, { ...currentModelMessage!, role: 'orchestrator' as const }]
          })
          
          setNodes((nds) =>
            nds.map((n) =>
              n.id === orchestratorNodeId
                ? { ...n, data: { ...n.data, reasoningMessages: [...reasoningMessages] } }
                : n
            )
          )
        }
      }
      
      // Get unified orchestrator instance (PHASE 3: Use multi-agent orchestrator!)
      const { getMultiAgentOrchestrator, createDefaultToolRegistry } = await import('@/lib/orchestrator')
      
      // ✅ FIX: Create and pass toolRegistry for content generation
      const toolRegistry = createDefaultToolRegistry()
      
      const orchestrator = getMultiAgentOrchestrator(user.id, {
        modelPriority: 'balanced',
        enableRAG: false, // Canvas doesn't need RAG for structure generation
        enablePatternLearning: true,
        toolRegistry // ✅ FIX: Pass toolRegistry for parallel/cluster execution
      })
      console.log('🤖 [triggerOrchestratedGeneration] Using MultiAgentOrchestrator with', toolRegistry.getStats().totalTools, 'tools')
      
      // Determine available models
      let availableModels: string[] = []
      let finalOrchestratorModel: string | null = null
      
      // Priority 1: Use configured orchestrator model from Profile (with validation)
      if (orchestratorModelId) {
        // ✅ FIX: Validate configured model exists in MODEL_TIERS
        const isValidModel = MODEL_TIERS.some(m => m.id === orchestratorModelId)
        
        if (isValidModel) {
          finalOrchestratorModel = orchestratorModelId
          availableModels = [orchestratorModelId]
          onReasoning(`✓ Using configured orchestrator: ${orchestratorModelId}`, 'decision')
          console.log('[Canvas] Using Profile orchestrator:', orchestratorModelId)
        } else {
          // Invalid model in database - fall back to auto-select
          onReasoning(`⚠️ Configured model "${orchestratorModelId}" is no longer available. Auto-selecting...`, 'decision')
          console.warn('[Canvas] Invalid orchestrator model in database:', orchestratorModelId)
          orchestratorModelId = null // Trigger auto-select below
        }
      } 
      // Priority 2: Fetch from API as fallback
      else {
        onReasoning('🔍 No model configured, fetching available models...', 'thinking')
        
        try {
          const modelsResponse = await fetch('/api/models')
          const modelsData = await modelsResponse.json()
          
          console.log('[Canvas] Models API response:', modelsData)
          
          // API returns 'grouped' not 'groups'
          const groups = modelsData.grouped || modelsData.groups || []
          
          if (modelsData.success && Array.isArray(groups) && groups.length > 0) {
            // Get first orchestrator-capable model from first provider
            const firstGroup = groups[0]
            
            if (firstGroup.models && Array.isArray(firstGroup.models) && firstGroup.models.length > 0) {
              // VALIDATE: Only use models that exist in MODEL_TIERS
              const validModelIds = MODEL_TIERS.map(m => m.id)
              const validModels = firstGroup.models.filter((m: any) => 
                m.id && validModelIds.includes(m.id)
              )
              
              console.log('[Canvas] Model validation:', {
                total: firstGroup.models.length,
                valid: validModels.length,
                validModelIds,
                firstGroupModels: firstGroup.models.map((m: any) => m.id)
              })
              
              if (validModels.length === 0) {
                onReasoning(`⚠️ No valid models found in your preferences. Using default...`, 'decision')
                // Use the first frontier or premium model from MODEL_TIERS that user has access to
                const defaultModel = MODEL_TIERS.find(m => 
                  (m.tier === 'frontier' || m.tier === 'premium') && 
                  firstGroup.provider === m.provider
                )
                if (defaultModel) {
                  finalOrchestratorModel = defaultModel.id
                  availableModels = [defaultModel.id]
                  onReasoning(`✓ Using default: ${defaultModel.displayName}`, 'decision')
                } else {
                  throw new Error(`No valid models available for ${firstGroup.provider}. Please update your model preferences.`)
                }
              } else {
                // Prefer frontier/premium models from validated list
                const orchestratorModels = validModels.filter((m: any) => {
                  const tierModel = MODEL_TIERS.find(tm => tm.id === m.id)
                  return tierModel && (tierModel.tier === 'frontier' || tierModel.tier === 'premium')
                })
                
                if (orchestratorModels.length > 0) {
                  finalOrchestratorModel = orchestratorModels[0].id
                  availableModels = [orchestratorModels[0].id]
                  onReasoning(`✓ Auto-selected: ${orchestratorModels[0].name || orchestratorModels[0].id}`, 'decision')
                  console.log('[Canvas] Auto-selected orchestrator:', finalOrchestratorModel)
                } else {
                  // Fallback to any valid model
                  finalOrchestratorModel = validModels[0].id
                  availableModels = [validModels[0].id]
                  onReasoning(`✓ Using: ${validModels[0].name || validModels[0].id}`, 'decision')
                  console.log('[Canvas] Fallback orchestrator:', finalOrchestratorModel)
                }
              }
            }
          } else {
            console.warn('[Canvas] Invalid models API response:', modelsData)
          }
        } catch (error) {
          console.error('[Canvas] Error fetching models:', error)
          onReasoning(`⚠️ Could not fetch models from API`, 'error')
        }
      }
      
      // Add writer models if configured
      if (writerModelIds.length > 0) {
        availableModels.push(...writerModelIds)
        onReasoning(`✓ Writer models: ${writerModelIds.length}`, 'decision')
      }
      
      console.log('🎯 Available models:', availableModels)
      console.log('🎯 Final orchestrator:', finalOrchestratorModel)
      
      // Log to UI for visibility
      onReasoning(`🎯 Selected model: ${finalOrchestratorModel}`, 'decision')
      onReasoning(`🎯 Available models: ${availableModels.join(', ')}`, 'thinking')
      
      // Validate we have at least one model
      if (availableModels.length === 0 || !finalOrchestratorModel) {
        const errorMsg = 'No models available. Please:\n\n1. Go to Profile page\n2. Add an API key (Groq, OpenAI, or Anthropic)\n3. Click "Model Configuration"\n4. Select an orchestrator model\n5. Save your preferences\n6. Try generating again'
        onReasoning(`❌ ${errorMsg}`, 'error')
        throw new Error(errorMsg)
      }
      
      // Build effective prompt (already validated above)
      const effectivePrompt = userPrompt
      
      onReasoning(`📝 Analyzing prompt: "${effectivePrompt.substring(0, 100)}..."`, 'thinking')
      
      // Get available providers from API keys
      const availableProviders = prefsData.keys
        ?.map((k: any) => k.provider)
        .filter(Boolean) || []
      
      onReasoning(`🔑 Available providers: ${availableProviders.join(', ')}`, 'thinking')
      
      // 🔧 FIX: Use component-level Supabase client (same instance throughout lifecycle)
      // This ensures the SAME authenticated session is used for node creation AND agent writes
      const supabase = supabaseClient
      
      // Call unified orchestrator to create structure
      const response = await orchestrator.orchestrate({
        message: effectivePrompt,
        canvasNodes: nodes,
        canvasEdges: edges,
        documentFormat: format,
        currentStoryStructureNodeId: structureNodeId, // ✅ FIX: Pass node ID so agents can save content
        userKeyId: userKeyId || undefined,
        fixedModelId: finalOrchestratorModel || undefined,
        availableProviders,
        modelMode: finalOrchestratorModel ? 'fixed' : 'automatic',
        supabaseClient: supabase // ✅ FIX: Pass SAME authenticated client instance
      })
      
      // Extract plan from generate_structure action
      console.log('🔍 [triggerOrchestratedGeneration] Response actions:', response.actions.map(a => ({ type: a.type, status: a.status })))
      
      const structureAction = response.actions.find(a => a.type === 'generate_structure')
      
      if (!structureAction) {
        console.error('❌ [triggerOrchestratedGeneration] No generate_structure action found')
        console.log('Available actions:', response.actions)
        
        // Check if there's an error message action instead
        const errorAction = response.actions.find(a => a.type === 'message' && a.status === 'failed')
        if (errorAction) {
          onReasoning(`❌ ${errorAction.payload.content}`, 'error')
          throw new Error(errorAction.payload.content)
        }
        
        throw new Error(`Orchestrator did not return a structure plan. Intent was: ${response.intent}. Actions: ${response.actions.map(a => a.type).join(', ')}`)
      }
      
      if (!structureAction.payload?.plan) {
        console.error('❌ [triggerOrchestratedGeneration] Structure action found but no plan in payload:', structureAction)
        throw new Error('Structure action found but plan is missing from payload')
      }
      
      const plan = structureAction.payload.plan
      console.log('✅ [triggerOrchestratedGeneration] Plan extracted successfully')
      
      // Display orchestrator's thinking steps
      if (response.thinkingSteps && response.thinkingSteps.length > 0) {
        response.thinkingSteps.forEach(step => {
          onReasoning(step.content, step.type as any)
        })
      }
      
      onReasoning(`✅ Plan created: ${plan.structure.length} sections, ${plan.tasks.length} tasks`, 'result')
      
      // Convert plan to structure items
      const structureItems = plan.structure.map((section: any) => ({
        id: section.id,
        level: section.level,
        name: section.name,
        parentId: section.parentId,
        wordCount: section.wordCount,
        summary: section.summary || ''
      }))
      
      // Update structure node with initial structure
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === structureNodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                items: structureItems,
                contentMap: {},
                format,
                isLoading: false
              }
            }
          }
          return n
        })
      )
      
      onReasoning(`📊 Structure initialized with ${structureItems.length} sections`, 'result')
      
      // ✅ CRITICAL: Initialize document_data in database for hierarchical system
      try {
        onReasoning('💾 Initializing hierarchical document system...', 'progress')
        
        const { DocumentManager } = await import('@/lib/document/DocumentManager')
        const supabase = createClient()
        
        // Map StoryFormat to DocumentManager format (only supports subset)
        let docManagerFormat: 'novel' | 'screenplay' | 'report'
        if (format === 'short-story') {
          docManagerFormat = 'novel'
        } else if (format === 'novel' || format === 'screenplay' || format === 'report') {
          docManagerFormat = format
        } else {
          // podcast, essay, article, custom → default to report
          docManagerFormat = 'report'
        }
        
        // Create document_data from structure items
        const docManager = DocumentManager.fromStructureItems(structureItems, docManagerFormat)
        const documentData = docManager.getData()
        
        // Save to database
        const { error: saveError } = await supabase
          .from('nodes')
          .update({ document_data: documentData })
          .eq('id', structureNodeId)
        
        if (saveError) {
          console.error('❌ Failed to initialize document_data:', saveError)
          onReasoning('⚠️ Warning: Document structure saved to canvas but not to database', 'error')
        } else {
          console.log('✅ document_data initialized successfully')
          onReasoning('✅ Hierarchical document system initialized', 'result')
        }
      } catch (initError) {
        console.error('❌ Error initializing document_data:', initError)
        onReasoning('⚠️ Warning: Could not initialize hierarchical document', 'error')
      }
      
      // Save canvas with structure
      hasUnsavedChangesRef.current = true
      await handleSave()
      
      // Clear inference flag
      isInferencingRef.current = false
      
      // Update orchestrator to clear loading
      setNodes((nds) =>
        nds.map((n) =>
          n.id === orchestratorNodeId
            ? { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
            : n
        )
      )
      
      onReasoning('✅ Orchestration complete!', 'result')
      
      alert(`✅ ${format.charAt(0).toUpperCase() + format.slice(1)} structure generated with orchestrator!`)
      
    } catch (error: any) {
      console.error('❌ Orchestrated generation failed:', error)
      
      isInferencingRef.current = false
      
      alert(`Failed to generate structure:\n\n${error.message}`)
      
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === structureNodeId) {
            return { ...n, data: { ...n.data, isLoading: false } }
          } else if (n.id === orchestratorNodeId) {
            return { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
          }
          return n
        })
      )
    }
  }
  
  // LEGACY: Original generation function (kept for backward compatibility)
  const triggerAIGeneration = async (
    structureNodeId: string,
    format: StoryFormat,
    aiPromptNode: Node,
    orchestratorNodeId: string
  ) => {
    // Check authentication first
    if (!user) {
      // Clear inference flag
      isInferencingRef.current = false
      
      alert('❌ You must be logged in to generate content.\n\nPlease log in at http://localhost:3002/auth and try again.')
      
      // Remove loading state from both structure node and orchestrator
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === structureNodeId) {
            return { ...n, data: { ...n.data, isLoading: false } }
          } else if (n.id === orchestratorNodeId) {
            return { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
          }
          return n
        })
      )
      return
    }
    
    // PRIORITY: Chat prompt takes precedence over AI Prompt node
    const orchestratorNode = nodes.find(n => n.id === orchestratorNodeId)
    const chatPrompt = (orchestratorNode?.data as any)?.chatPrompt
    const aiPromptNodePrompt = aiPromptNode ? (aiPromptNode.data as any).userPrompt : null
    
    // Use chat prompt first, fallback to AI Prompt node
    const userPrompt = chatPrompt || aiPromptNodePrompt || ''
    const isActive = aiPromptNode ? (aiPromptNode.data as any).isActive !== false : true
    const maxTokens = aiPromptNode ? (aiPromptNode.data as any).maxTokens || 2000 : 2000
    
    console.log('🎬 Starting orchestrator-based generation...', {
      hasChatPrompt: !!chatPrompt,
      hasAIPromptNodePrompt: !!aiPromptNodePrompt,
      usingPrompt: userPrompt,
      source: chatPrompt ? 'Chat Input (Priority)' : 'AI Prompt Node (Fallback)'
    })
    
    // Determine the actual prompt to send based on active/passive mode
    const effectiveUserPrompt = isActive ? userPrompt : ''
    
    // Only validate prompt if in active mode
    if (isActive && (!userPrompt || userPrompt.trim() === '')) {
      alert('Please enter a prompt using the chat input.')
      return
    }
    
    // TODO: Replace this entire function with orchestrator-based generation
    // For now, keep legacy behavior to avoid breaking existing functionality
    
    // Import system prompt and token calculation dynamically
    const { getFormatSystemPrompt, getRecommendedTokens } = await import('@/lib/groq/formatPrompts')
    const systemPrompt = getFormatSystemPrompt(format)
    const recommendedTokens = getRecommendedTokens(format)
    
    // Import markdown parser
    const { parseMarkdownStructure } = await import('@/lib/markdownParser')
    
    try {
      // Set inference flag
      isInferencingRef.current = true
      
      // Get orchestrator node data and set inference loading state
      let selectedModel = 'llama-3.1-8b-instant'
      let selectedKeyId: string | null = null
      
      setNodes((currentNodes) => {
        const orchestratorNode = currentNodes.find(n => n.id === orchestratorNodeId)
        selectedModel = (orchestratorNode?.data as any)?.selectedModel || 'llama-3.1-8b-instant'
        selectedKeyId = (orchestratorNode?.data as any)?.selectedKeyId || null

        console.log('🤖 Calling Generate API for auto-generation', {
          isActive,
          mode: isActive ? 'Active (with user prompt)' : 'Passive (system prompt only)',
          userPromptLength: effectiveUserPrompt.length,
          model: selectedModel,
          keyId: selectedKeyId || 'No key - will try user keys',
          orchestratorFound: !!orchestratorNode,
          orchestratorId: orchestratorNode?.id,
          selectedModelInData: (orchestratorNode?.data as any)?.selectedModel,
          selectedKeyIdInData: (orchestratorNode?.data as any)?.selectedKeyId
        })
        
        // Update orchestrator node to show inference loading state
        return currentNodes.map(n => 
          n.id === orchestratorNodeId
            ? { ...n, data: { ...n.data, isOrchestrating: true, loadingText: 'Inference' } }
            : n
        )
      })
      
      console.log('[Canvas] Calling /api/generate with:', {
        model: selectedModel,
        user_key_id: selectedKeyId,
        format,
        hasSystemPrompt: !!systemPrompt,
        hasUserPrompt: !!effectiveUserPrompt
      })
      
      // Use user's custom maxTokens if set, otherwise use recommended based on format
      const effectiveMaxTokens = maxTokens && maxTokens !== 2000 ? maxTokens : recommendedTokens
      
      console.log('🎨 Inference loading state SET - pink spinner should be visible')
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          system_prompt: systemPrompt,
          user_prompt: effectiveUserPrompt,
          max_tokens: effectiveMaxTokens,
          user_key_id: selectedKeyId,
          format
        })
      })
      
      console.log('📡 API response received, parsing...')
      const data = await response.json()
      console.log('✅ Data parsed:', {
        success: data.success,
        hasMarkdown: !!data.markdown,
        markdownLength: data.markdown?.length,
        error: data.error
      })
      
      // Log the actual markdown for debugging (first 2000 chars)
      if (data.markdown) {
        console.log('📝 Generated markdown (first 2000 chars):\n', data.markdown.substring(0, 2000))
      }
      
      if (data.success && data.markdown) {
        console.log('🔍 Parsing markdown structure...')
        
        let parsedItems, contentMap
        try {
          const parseResult = parseMarkdownStructure(data.markdown)
          parsedItems = parseResult.items
          contentMap = parseResult.contentMap
          
          console.log('📊 Parsed structure:', {
            itemCount: parsedItems.length,
            contentMapSize: contentMap.size,
            firstItem: parsedItems[0]
          })
        } catch (parseError: any) {
          console.error('❌ Markdown parsing failed:', parseError)
          throw new Error(`Failed to parse markdown structure: ${parseError.message}`)
        }
        
        // Convert contentMap to plain object
        const contentMapObject: Record<string, string> = {}
        contentMap.forEach((value, key) => {
          contentMapObject[key] = value
        })
        
        // Clear inference flag
        isInferencingRef.current = false
        
        console.log('📝 Updating structure node with parsed data...')
        
        // Update structure node and clear orchestrator loading state
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === structureNodeId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  items: parsedItems,
                  contentMap: contentMapObject,
                  format: format,
                  isLoading: false
                }
              }
            } else if (n.id === orchestratorNodeId) {
              // Clear inference loading state
              return { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
            }
            return n
          })
        )
        
        console.log('✅ Auto-generation complete:', {
          structureNodeId,
          itemsCount: parsedItems.length
        })
        
        console.log('💾 Triggering auto-save...')
        // Trigger save
        hasUnsavedChangesRef.current = true
        await handleSave()
        console.log('💾 Auto-save complete')
        
        alert(`✅ ${format.charAt(0).toUpperCase() + format.slice(1)} structure generated successfully!`)
      } else {
        throw new Error(data.error || 'Failed to generate structure')
      }
    } catch (error: any) {
      console.error('❌ Auto-generation failed:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
      
      // Clear inference flag on error
      isInferencingRef.current = false
      
      // Provide helpful error message
      let errorMessage = error.message || 'Unknown error'
      
      // Add more specific error context
      if (errorMessage === 'Failed to generate structure') {
        errorMessage = 'Failed to generate structure. The AI response may be incomplete or in an unexpected format. Please try again.'
      } else if (errorMessage.includes('Failed to parse markdown')) {
        errorMessage = `${errorMessage}\n\nThe AI generated content but it wasn't in the expected format. Try:\n- Using a different model\n- Simplifying your prompt\n- Choosing a different format`
      } else if (errorMessage.includes('No API key available') || errorMessage.includes('No') && errorMessage.includes('API key')) {
        errorMessage = `❌ ${errorMessage}\n\n💡 To fix this:\n1. Go to your Profile page\n2. Add your API key for this provider\n3. Enable the model you want to use\n4. Try generating again`
      }
      
      alert(`Failed to generate structure:\n\n${errorMessage}`)
      
      // Remove loading state on error (both structure node and orchestrator)
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === structureNodeId) {
            return { ...n, data: { ...n.data, isLoading: false } }
          } else if (n.id === orchestratorNodeId) {
            return { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
          }
          return n
        })
      )
    }
  }
  
  // Handle Story Draft node click - open in AI Document Panel
  const handleStoryDraftClick = useCallback((node: Node) => {
    const storyData = node.data as any
    console.log('Opening story draft:', storyData.title)
    
    // Set the current story draft for editing
    setCurrentStoryDraftId(node.id)
    
    // Load story content into AI Document Panel
    setInitialPrompt(storyData.content || storyData.title || 'Continue this story')
    setIsAIDocPanelOpen(true)
  }, [])
  
  // Handle saving story draft content
  const handleSaveStoryDraft = useCallback((nodeId: string, content: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const now = new Date().toISOString()
          const preview = content.substring(0, 100) + (content.length > 100 ? '...' : '')
          return {
            ...node,
            data: {
              ...node.data,
              content,
              preview,
              updatedAt: now,
            }
          }
        }
        return node
      })
    )
    hasUnsavedChangesRef.current = true
    console.log('Updated story draft:', nodeId)
  }, [setNodes])

  /**
   * Agentic Handler: Write Content
   * Generates content for a specific segment in the document
   */
  const handleWriteContent = useCallback(async (segmentId: string, prompt: string) => {
    console.log('📝 handleWriteContent:', { segmentId, prompt })
    
    // BUILD STRATEGIC CONTEXT (orchestrator's job!)
    // Get full hierarchy, previous content, future summaries
    let effectiveContentMap: Record<string, string> = { ...currentContentMap }
    
    // Build contentMap with smart fallback (same logic as handleAnswerQuestion)
    if (Object.keys(effectiveContentMap).length === 0) {
      const sectionByItemId = new Map(currentSections.map(s => [s.structure_item_id, s]))
      currentStructureItems.forEach((item: any) => {
        const section = sectionByItemId.get(item.id)
        if (section?.content && section.content.trim() && !section.content.includes('<p></p>')) {
          effectiveContentMap[item.id] = section.content
        } else if (item.summary && item.summary.trim()) {
          effectiveContentMap[item.id] = item.summary
        }
      })
    }
    
    console.log('🧠 Orchestrator context:', {
      targetSegment: segmentId,
      totalStructureItems: currentStructureItems.length,
      contentMapSize: Object.keys(effectiveContentMap).length,
      hasPreviousContent: currentStructureItems.findIndex((item: any) => item.id === segmentId) > 0
    })
    
    // Add reasoning message
    setCanvasChatHistory(prev => [...prev, {
      id: `write_${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: `📝 Orchestrator delegating to writer model with full story context...`,
      type: 'task' as const,
      role: 'orchestrator' as const
    }])
    
    try {
      // Call API with FULL orchestrator context
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId,
          prompt,
          storyStructureNodeId: currentStoryStructureNodeId,
          // STRATEGIC CONTEXT from orchestrator
          structureItems: currentStructureItems, // Full hierarchy
          contentMap: effectiveContentMap, // All content/summaries
          format: currentStructureFormat, // Story format
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        // Show the actual error message from the API
        const errorMsg = data.error || response.statusText
        const errorDetails = data.details ? `\nDetails: ${data.details}` : ''
        throw new Error(`Failed to generate content: ${errorMsg}${errorDetails}`)
      }
      
      // Update the content map with new content (local state)
      setCurrentContentMap(prev => ({
        ...prev,
        [segmentId]: data.content
      }))
      
      // ✅ NEW HIERARCHICAL SYSTEM: Save content to document_data JSONB
      console.log('💾 Saving generated content to hierarchical document:', {
        segmentId,
        contentLength: data.content.length,
        nodeId: currentStoryStructureNodeId
      })
      
      try {
        const supabase = createClient()
        
        // Fetch current document_data
        const { data: nodeData, error: fetchError } = await supabase
          .from('nodes')
          .select('document_data')
          .eq('id', currentStoryStructureNodeId)
          .single()
        
        if (fetchError) {
          console.error('❌ Failed to fetch document_data:', fetchError)
        } else if (nodeData?.document_data) {
          // Import DocumentManager dynamically
          const { DocumentManager } = await import('@/lib/document/DocumentManager')
          
          // Load existing document
          const docManager = new DocumentManager(nodeData.document_data)
          
          // Update the segment content
          const success = docManager.updateContent(segmentId, data.content)
          
          if (success) {
            // Save back to database
            const { error: updateError } = await supabase
              .from('nodes')
              .update({ document_data: docManager.getData() })
              .eq('id', currentStoryStructureNodeId)
            
            if (updateError) {
              console.error('❌ Failed to save document_data:', updateError)
            } else {
              console.log('✅ Content saved to hierarchical document')
              
              // ✅ Update canvas node with new document_data (includes updated word count)
              const updatedDocumentData = docManager.getData()
              setNodes((nds) => nds.map((n) => 
                n.id === currentStoryStructureNodeId
                  ? { ...n, data: { ...n.data, document_data: updatedDocumentData } }
                  : n
              ))
              
              console.log('🔄 Canvas node updated with new word count:', updatedDocumentData.totalWordCount)
              
              // Refresh document panel to show new content
              if (refreshSectionsRef.current) {
                console.log('🔄 Refreshing document view...')
                await refreshSectionsRef.current()
              }
            }
          } else {
            console.error('❌ Failed to update segment in DocumentManager')
          }
        } else {
          console.warn('⚠️ No document_data found - content only in local state')
        }
      } catch (saveError) {
        console.error('❌ Error saving to hierarchical document:', saveError)
        // Don't throw - content is still in local contentMap
      }
      
      // Add success message
      setCanvasChatHistory(prev => [...prev, {
        id: `write_success_${Date.now()}`,
        timestamp: new Date().toISOString(),
        content: `✅ Content generated and saved for segment: ${segmentId}`,
        type: 'result' as const,
        role: 'orchestrator' as const
      }])
      
    } catch (error) {
      console.error('Failed to write content:', error)
      setCanvasChatHistory(prev => [...prev, {
        id: `write_error_${Date.now()}`,
        timestamp: new Date().toISOString(),
        content: `❌ Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error' as const,
        role: 'orchestrator' as const
      }])
    }
  }, [currentStoryStructureNodeId, currentStructureItems, currentSections, currentContentMap, currentStructureFormat])

  /**
   * Handle sections loaded from AIDocumentPanel (Supabase)
   * This is the ACTUAL content source - not node contentMap
   */
  const handleSectionsLoaded = useCallback((sections: Array<{ id: string; structure_item_id: string; content: string }>) => {
    console.log('📚 [CANVAS] handleSectionsLoaded called:', {
      count: sections.length,
      sampleIds: sections.slice(0, 3).map(s => ({ 
        id: s.id, 
        structureItemId: s.structure_item_id, 
        contentLength: s.content?.length || 0,
        contentPreview: s.content?.substring(0, 50)
      }))
    })
    setCurrentSections(sections)
    console.log('✅ [CANVAS] currentSections state updated')
  }, [])
  
  /**
   * Receive refresh function from document panel
   */
  const handleRefreshSectionsCallback = useCallback((refreshFn: () => Promise<void>) => {
    console.log('🔗 [CANVAS] Received refreshSections function from document panel')
    refreshSectionsRef.current = refreshFn
  }, [])

  /**
   * Agentic Handler: Answer Question
   * Uses orchestrator model to answer questions about the story/content
   */
  const handleAnswerQuestion = useCallback(async (question: string): Promise<string> => {
    console.log('💬 handleAnswerQuestion:', question)
    
    // BUILD contentMap with SMART FALLBACK CHAIN:
    // 1. Node contentMap (from test markdown)
    // 2. Section content (user-written full story from Supabase)
    // 3. Structure item summary (AI-generated overview)
    let effectiveContentMap = { ...currentContentMap }
    
    if (Object.keys(effectiveContentMap).length === 0) {
      console.log('📦 Building contentMap with smart fallback chain...')
      
      // Create a map from structure_item_id to section for quick lookup
      const sectionByItemId = new Map(
        currentSections.map(s => [s.structure_item_id, s])
      )
      
      currentStructureItems.forEach((item: any) => {
        const section = sectionByItemId.get(item.id)
        
        // Priority 1: Section content (user-written full story)
        if (section?.content && section.content.trim() && !section.content.includes('<p></p>')) {
          effectiveContentMap[item.id] = section.content
          console.log(`  ✅ [${item.name}] Using section.content (full story)`)
        }
        // Priority 2: Structure item summary (AI-generated overview)
        else if (item.summary && item.summary.trim()) {
          effectiveContentMap[item.id] = item.summary
          console.log(`  📝 [${item.name}] Using item.summary (AI overview): "${item.summary.substring(0, 60)}..."`)
        }
      })
      
      console.log('✅ Built contentMap:', {
        structureItemsCount: currentStructureItems.length,
        sectionsCount: currentSections.length,
        contentMapSize: Object.keys(effectiveContentMap).length,
        sampleKeys: Object.keys(effectiveContentMap).slice(0, 3)
      })
    }
    
    console.log('📊 Context being sent:', {
      storyStructureNodeId: currentStoryStructureNodeId,
      structureItemsCount: currentStructureItems.length,
      sectionsCount: currentSections.length,
      contentMapKeys: Object.keys(effectiveContentMap),
      contentMapSize: Object.keys(effectiveContentMap).length,
      hasActiveContext: !!activeContext,
      contentMapSample: Object.keys(effectiveContentMap).slice(0, 3).map(key => ({
        id: key,
        length: effectiveContentMap[key]?.length,
        preview: effectiveContentMap[key]?.substring(0, 100)
      }))
    })
    
    try {
      // Call API to answer question using orchestrator model
      const response = await fetch('/api/content/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: {
            storyStructureNodeId: currentStoryStructureNodeId,
            structureItems: currentStructureItems,
            contentMap: effectiveContentMap, // ← Use built contentMap from sections!
            activeContext
          }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to answer question: ${response.statusText}`)
      }
      
      // The API now returns a streaming text response, not JSON
      const answer = await response.text()
      return answer
      
    } catch (error) {
      console.error('Failed to answer question:', error)
      return `I apologize, but I encountered an error trying to answer your question: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }, [currentStoryStructureNodeId, currentStructureItems, currentContentMap, currentSections, activeContext])

  const handleVisibilityChange = async (newVisibility: 'private' | 'shared' | 'public') => {
    if (!storyId) return
    
    try {
      setCanvasVisibility(newVisibility)
      
      // Update the story in the database
      await updateStory(storyId, {
        is_public: newVisibility === 'public',
        shared: newVisibility === 'shared' || newVisibility === 'public',
      })
      
      // If changing to private, clear shared emails
      if (newVisibility === 'private' && sharedEmails.length > 0) {
        // Remove all shares from database
        const removePromises = sharedEmails.map(email => removeCanvasShare(storyId, email))
        await Promise.all(removePromises)
        setSharedEmails([])
      }
    } catch (error) {
      console.error('Failed to update visibility:', error)
      alert('Failed to update canvas visibility')
    }
  }

  const handleAddSharedEmail = async () => {
    if (!emailInput.trim() || !storyId) return
    
    const email = emailInput.trim().toLowerCase()
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address')
      return
    }
    
    // Check if already shared
    if (sharedEmails.includes(email)) {
      alert('This email is already added')
      setEmailInput('')
      return
    }
    
    try {
      setSendingInvite(true)
      
      const result = await shareCanvas(storyId, email, 'view')
      
      if (result.success) {
        setSharedEmails([...sharedEmails, email])
        alert(result.message)
        setEmailInput('')
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error('Failed to share canvas:', error)
      alert('Failed to share canvas. Please try again.')
    } finally {
      setSendingInvite(false)
    }
  }

  const handleRemoveSharedEmail = async (email: string) => {
    if (!storyId) return
    
    try {
      const success = await removeCanvasShare(storyId, email)
      if (success) {
        setSharedEmails(sharedEmails.filter(e => e !== email))
        console.log('Removed access for:', email)
      } else {
        alert('Failed to remove access')
      }
    } catch (error) {
      console.error('Failed to remove shared access:', error)
      alert('Failed to remove access')
    }
  }

  const handleNewCanvas = async () => {
    try {
      // Warn if there are unsaved changes
      if (hasUnsavedChangesRef.current) {
        if (!window.confirm('You have unsaved changes. Continue without saving?')) {
          return
        }
      }
      
      // Create and navigate
      const newStory = await createStory()
      router.push(`/canvas?id=${newStory.id}`)
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Failed to create new canvas:', error)
    }
  }

  const handleDeleteCanvas = async () => {
    if (!storyId) return
    
    const confirmed = window.confirm('Are you sure you want to delete this canvas? This action cannot be undone.')
    if (!confirmed) return

    try {
      await deleteStory(storyId)
      router.push('/stories')
    } catch (error) {
      console.error('Failed to delete canvas:', error)
    }
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: false, 
      style: { stroke: '#9ca3af', strokeWidth: 2 }, // Subtle edge thickness
      type: 'default' // Default type uses smooth bezier curves
    }, eds)),
    [setEdges]
  )

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', { id: node.id, type: node.type, nodeType: node.data?.nodeType })
    
    // Handle Story Draft node - open in AI Document Panel
    if (node.type === 'storyDraftNode') {
      console.log('Story Draft node clicked - opening in AI panel')
      event.stopPropagation()
      handleStoryDraftClick(node)
      return
    }
    
    // For all other node types (including Create Story), open details panel
    console.log('Node clicked - opening details panel')
    setSelectedNode(node)
    setIsPanelOpen(true)
  }, [handleStoryDraftClick])

  // Handle node update from panel
  const handleNodeUpdate = useCallback((nodeId: string, newData: any) => {
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
            mergedData.onItemsUpdate = (items: any[]) => handleStructureItemsUpdate(nodeId, items)
            mergedData.onWidthUpdate = (width: number) => handleNodeUpdate(nodeId, { customNarrationWidth: width })
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
          mergedData.onItemsUpdate = (items: any[]) => handleStructureItemsUpdate(nodeId, items)
          mergedData.onWidthUpdate = (width: number) => handleNodeUpdate(nodeId, { customNarrationWidth: width })
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
  }, [setNodes, handleStructureItemClick, handleStructureItemsUpdate, availableAgents, handleAgentAssign, storyId, edges])

  // Handle node deletion
  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    // Don't close panel - let user continue working with orchestrator
    // Only clear selection if the deleted node was selected
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null)
    }
  }, [setNodes, setEdges, selectedNode])

  const addNewNode = (nodeType: NodeType) => {
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

  // Filter nodes and edges to hide resources when showConnectedResources is false
  const filteredNodes = useMemo(() => {
    // Hide resource nodes that are connected to cluster nodes with showConnectedResources: false
    const clusterNodesWithHiddenResources = nodes
      .filter(n => n.type === 'clusterNode' && n.data.showConnectedResources === false)
      .map(n => n.id)
    
    if (clusterNodesWithHiddenResources.length === 0) return nodes
    
    // Calculate hidden resource counts for each cluster
    const hiddenResourceCounts = new Map<string, number>()
    clusterNodesWithHiddenResources.forEach(clusterId => {
      const count = edges.filter(e => 
        e.target === clusterId && 
        e.source !== 'orchestrator' &&
        e.source !== 'context'
      ).length
      hiddenResourceCounts.set(clusterId, count)
    })
    
    // Get IDs of resource nodes to hide
    const resourceNodesToHide = new Set(
      edges
        .filter(e => 
          clusterNodesWithHiddenResources.includes(e.target) && 
          e.source !== 'orchestrator' &&
          e.source !== 'context'
        )
        .map(e => e.source)
    )
    
    // Filter out hidden resource nodes and add count to cluster nodes
    return nodes.map(n => {
      if (n.type === 'clusterNode' && hiddenResourceCounts.has(n.id)) {
        return {
          ...n,
          data: {
            ...n.data,
            hiddenResourceCount: hiddenResourceCounts.get(n.id)
          }
        }
      }
      return n
    }).filter(n => !resourceNodesToHide.has(n.id))
  }, [nodes, edges])

  const filteredEdges = useMemo(() => {
    // Hide edges to resource nodes that are hidden
    const clusterNodesWithHiddenResources = nodes
      .filter(n => n.type === 'clusterNode' && n.data.showConnectedResources === false)
      .map(n => n.id)
    
    if (clusterNodesWithHiddenResources.length === 0) return edges
    
    // Get IDs of resource nodes to hide
    const resourceNodesToHide = new Set(
      edges
        .filter(e => 
          clusterNodesWithHiddenResources.includes(e.target) && 
          e.source !== 'orchestrator' &&
          e.source !== 'context'
        )
        .map(e => e.source)
    )
    
    // Filter out all edges to/from hidden resource nodes
    return edges.filter(e => 
      !resourceNodesToHide.has(e.source) && 
      !resourceNodesToHide.has(e.target)
    )
  }, [nodes, edges])

  if (loading || checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        {/* Grid background */}
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
      <header className="border-b border-gray-200 bg-white z-[60] shadow-sm relative">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <img src="/publo_logo.svg" alt="PUBLO" className="h-6" />
            <input
              ref={titleInputRef}
              type="text"
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-gray-50 rounded px-2 py-1 transition-all"
              placeholder="Untitled Story"
            />
          </div>
          
          {/* Center Save Button + Sharing Dropdown */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            {/* Save Button - expands left */}
            {saving ? (
              <div className="flex items-center gap-2 px-5 py-2 h-[38px] bg-gray-100 rounded-l-full transition-all">
                <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm text-gray-600">Saving...</span>
              </div>
            ) : hasUnsavedChangesRef.current ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 h-[38px] bg-gray-100 hover:bg-gray-200 rounded-l-full transition-all"
                title="Save changes"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-600">Save Changes</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-5 py-2 h-[38px] bg-gray-100 rounded-l-full transition-all">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-600">All changes saved</span>
              </div>
            )}

            {/* Sharing Dropdown Button - fixed to right of Save */}
            <div className="relative" ref={sharingDropdownRef}>
              <button
                onClick={() => setSharingDropdownOpen(!sharingDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-2 h-[38px] bg-gray-100 hover:bg-gray-200 rounded-r-full border-l border-gray-200 transition-all"
                title="Canvas visibility"
              >
                {canvasVisibility === 'public' ? (
                  <>
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-600 font-medium">Public</span>
                  </>
                ) : canvasVisibility === 'shared' ? (
                  <>
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span className="text-sm text-gray-600 font-medium">Shared</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm text-gray-600 font-medium">Private</span>
                  </>
                )}
                <svg className={`w-3 h-3 text-gray-600 transition-transform ${sharingDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Sharing Dropdown Menu */}
              {sharingDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[100]">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Canvas Visibility</h3>
                  </div>
                  
                  {/* Visibility Options */}
                  <div className="p-2">
                    <button
                      onClick={() => handleVisibilityChange('private')}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors ${canvasVisibility === 'private' ? 'bg-gray-100' : ''}`}
                    >
                      <svg className="w-5 h-5 text-gray-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm text-gray-900">Private</div>
                        <div className="text-xs text-gray-500">Only you can access this canvas</div>
                      </div>
                      {canvasVisibility === 'private' && (
                        <svg className="w-4 h-4 text-blue-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleVisibilityChange('shared')}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors ${canvasVisibility === 'shared' ? 'bg-gray-100' : ''}`}
                    >
                      <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm text-gray-900">Shared</div>
                        <div className="text-xs text-gray-500">Share with specific people</div>
                      </div>
                      {canvasVisibility === 'shared' && (
                        <svg className="w-4 h-4 text-blue-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleVisibilityChange('public')}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors ${canvasVisibility === 'public' ? 'bg-gray-100' : ''}`}
                    >
                      <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm text-gray-900">Public</div>
                        <div className="text-xs text-gray-500">Anyone with the link can view</div>
                      </div>
                      {canvasVisibility === 'public' && (
                        <svg className="w-4 h-4 text-blue-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Email Input for Shared */}
                  {canvasVisibility === 'shared' && (
                    <>
                      <div className="border-t border-gray-100 px-4 py-3">
                        <label className="text-xs font-medium text-gray-700 mb-2 block">Share with email</label>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddSharedEmail()}
                            placeholder="email@example.com"
                            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            disabled={sendingInvite}
                          />
                          <button
                            onClick={handleAddSharedEmail}
                            disabled={sendingInvite || !emailInput.trim()}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {sendingInvite ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                      </div>

                      {/* Shared Emails List */}
                      {sharedEmails.length > 0 && (
                        <div className="border-t border-gray-100 px-4 py-2 max-h-40 overflow-y-auto">
                          <div className="text-xs font-medium text-gray-700 mb-2">Shared with ({sharedEmails.length})</div>
                          {sharedEmails.map((email) => (
                            <div key={email} className="flex items-center justify-between py-1.5 group">
                              <span className="text-sm text-gray-700">{email}</span>
                              <button
                                onClick={() => handleRemoveSharedEmail(email)}
                                className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove access"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Burger Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                title="Menu"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[100]">
                {/* New Canvas */}
                <button
                  onClick={handleNewCanvas}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Canvas
                </button>

                {/* My Canvases */}
                <button
                  onClick={() => {
                    // Warn if there are unsaved changes
                    if (hasUnsavedChangesRef.current) {
                      if (!window.confirm('You have unsaved changes. Continue without saving?')) {
                        return
                      }
                    }
                    router.push('/stories')
                    setIsMenuOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  My Canvases
                </button>

                {/* My Characters */}
                <button
                  onClick={() => {
                    // Warn if there are unsaved changes
                    if (hasUnsavedChangesRef.current) {
                      if (!window.confirm('You have unsaved changes. Continue without saving?')) {
                        return
                      }
                    }
                    router.push('/characters')
                    setIsMenuOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  My Characters
                </button>

                <div className="border-t border-gray-200 my-2"></div>

                {/* Delete Canvas */}
                {storyId && (
                  <button
                    onClick={handleDeleteCanvas}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Canvas
                  </button>
                )}
              </div>
            )}
            </div>

            {/* Profile Picture Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold hover:shadow-lg transition-shadow overflow-hidden"
                title="Profile"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.email?.[0].toUpperCase() || 'U'
                )}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                  {/* Profile */}
                  <button
                    onClick={() => {
                      router.push('/profile')
                      setIsProfileMenuOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </button>

                  {/* Admin Panel - Only show for admins */}
                  {(userRole === 'admin' || isForceAdmin) && (
                    <button
                      onClick={() => {
                        router.push('/admin')
                        setIsProfileMenuOpen(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Admin Panel
                    </button>
                  )}

                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Logout */}
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <CanvasProvider value={{ onPromptSubmit: handlePromptSubmit }}>
          {/* Canvas Area with React Flow */}
          <div className="flex-1 relative bg-gray-50">
            {/* Floating Add Node Menu */}
            <div className="absolute top-6 left-6 z-10">
              <NodeTypeMenu onSelectNodeType={addNewNode} />
            </div>
            
            <ReactFlow
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
            fitViewOptions={{ padding: 0.2, maxZoom: 0.75 }}
            className="bg-gray-50"
            connectionMode={ConnectionMode.Strict}
            defaultEdgeOptions={{
              type: 'default', // Default type uses smooth bezier curves
              animated: false,
              style: { stroke: '#9ca3af', strokeWidth: 2 } // Subtle edge thickness
            }}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            panOnDrag={true} // Allow normal canvas panning (timeline isolation handled by nodrag classes)
            zoomOnDoubleClick={false} // Prevent accidental zoom conflicts with timeline
            onNodesDelete={(deleted) => {
              // Prevent deletion of context canvas node
              const hasContext = deleted.some(node => node.id === 'context')
              if (hasContext) {
                alert('The Create Story node cannot be deleted - it is a core part of your canvas!')
                return false
              }
            }}
          >
            <Background 
              variant={BackgroundVariant.Lines} 
              gap={24} 
              size={1} 
              color="rgba(0, 0, 0, 0.08)"
              style={{ opacity: 0.5 }}
            />
            <Controls className="!bg-white !border-gray-200 [&>button]:!bg-white [&>button]:!border-gray-200 [&>button:hover]:!bg-gray-50 [&>button]:!fill-gray-600" />
          </ReactFlow>
          </div>
        </CanvasProvider>

        {/* Right Panel */}
        <NodeDetailsPanel
          node={selectedNode}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          onUpdate={handleNodeUpdate}
          onDelete={handleNodeDelete}
          onCreateStory={handleCreateStory}
          onAddNode={(newNode) => setNodes((nds) => [...nds, newNode])}
          onAddEdge={(newEdge) => setEdges((eds) => [...eds, newEdge])}
          edges={edges}
          nodes={nodes}
          onSelectNode={(nodeId: string, sectionId?: string) => {
            // Load document for writing WITHOUT switching away from orchestrator panel
            const node = nodes.find(n => n.id === nodeId)
            if (!node) {
              console.error('[onSelectNode] Node not found:', nodeId)
              return
            }
            
            // Extract node data
            const nodeData = node.data as StoryStructureNodeData
            // Get structure items
            const structureItems = nodeData.items
            if (!structureItems || !nodeData.format) {
              console.error('[onSelectNode] Node missing structure data:', {
                nodeId,
                hasItems: !!nodeData.items,
                hasFormat: !!nodeData.format,
                nodeData
              })
              
              // Notify user via orchestrator chat
              const nodeName = nodeData.label || 'document'
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('orchestratorMessage', {
                  detail: {
                    message: `⚠️ Cannot open "${nodeName}": Document structure not loaded. Try clicking the node directly to reload it.`,
                    role: 'orchestrator',
                    type: 'error'
                  }
                }))
              }
              return
            }
            
            // Load the document's structure and content
            const latestContentMap = nodeData.contentMap || {}
            setCurrentStoryStructureNodeId(nodeId)
            setCurrentStructureItems(structureItems) // Use the resolved structureItems
            setCurrentStructureFormat(nodeData.format)
            setCurrentContentMap(latestContentMap)
            
            // Set initial section if provided (for auto-selecting a specific section)
            if (sectionId) {
              setInitialSectionId(sectionId)
            }
            
            // Open document panel (but keep orchestrator selected!)
            setIsAIDocPanelOpen(true)
            
            console.log('📂 [open_and_write] Loaded document for writing:', {
              nodeId,
              format: nodeData.format,
              sections: structureItems?.length || 0,
              contentKeys: Object.keys(latestContentMap).length,
              autoSelectSection: sectionId || 'none'
            })
          }}
          canvasChatHistory={canvasChatHistory}
          onAddChatMessage={(message: string, role?: 'user' | 'orchestrator', type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress') => {
            // Auto-detect type from message content if not provided
            const actualRole = role || 'orchestrator'
            let messageType: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress' = type || 'user'
            
            if (!type && actualRole === 'orchestrator') {
              // Auto-detect based on message prefix emojis
              if (message.startsWith('🧠') || message.startsWith('💭') || message.startsWith('🔍')) {
                messageType = 'thinking'
              } else if (message.startsWith('⚡') || message.startsWith('✓') || message.startsWith('📌')) {
                messageType = 'decision'
              } else if (message.startsWith('🚀') || message.startsWith('📝') || message.startsWith('✨')) {
                messageType = 'task'
              } else if (message.startsWith('✅') || message.startsWith('📊') || message.startsWith('🎉')) {
                messageType = 'result'
              } else if (message.startsWith('❌') || message.startsWith('⚠️')) {
                messageType = 'error'
              }
            }
            
            const msg = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date().toISOString(),
              content: message,
              type: messageType,
              role: actualRole
            }
            setCanvasChatHistory(prev => [...prev, msg])
          }}
          onClearChat={() => {
            if (confirm('Clear all chat history? This cannot be undone.')) {
              setCanvasChatHistory([])
            }
          }}
          onToggleDocumentView={() => setIsAIDocPanelOpen(!isAIDocPanelOpen)}
          isDocumentViewOpen={isAIDocPanelOpen}
          onPanelWidthChange={setOrchestratorPanelWidth}
          activeContext={activeContext}
          onClearContext={() => setActiveContext(null)}
          onWriteContent={handleWriteContent}
          onAnswerQuestion={handleAnswerQuestion}
          structureItems={currentStructureItems}
          contentMap={currentContentMap}
          currentStoryStructureNodeId={currentStoryStructureNodeId}
        />

        {/* Loading indicator now integrated into Orchestrator node */}

        {/* Fixed Footer - Intelligence Engineered by AIAKAKI */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2">
          <p className="text-gray-400 text-sm">Intelligence Engineered by</p>
          <img src="/aiakaki_logo.svg" alt="AIAKAKI" className="h-3.5" />
        </div>

        {/* AI Document Panel */}
        <AIDocumentPanel 
          key={currentStoryStructureNodeId || 'no-document'} // Force re-mount when document changes
          isOpen={isAIDocPanelOpen} 
          onClose={() => {
            setIsAIDocPanelOpen(false)
            setInitialPrompt('')
            setCurrentStoryDraftId(null)
            setInitialDocumentContent('')
            setCurrentStoryStructureNodeId(null)
            setCurrentStructureItems([])
            setCurrentStructureFormat(undefined)
            setCurrentContentMap({})
            setCurrentSections([]) // Also clear sections
            setInitialSectionId(null)
            setActiveContext(null) // Clear context when closing document panel
          }}
          storyStructureNodeId={currentStoryStructureNodeId}
          structureItems={currentStructureItems}
          contentMap={currentContentMap}
          initialSectionId={initialSectionId}
          onUpdateStructure={handleStructureItemsUpdate}
          canvasEdges={edges}
          canvasNodes={nodes}
          orchestratorPanelWidth={orchestratorPanelWidth}
          onSwitchDocument={handleSwitchDocument}
          onSetContext={setActiveContext}
          onSectionsLoaded={handleSectionsLoaded}
          onRefreshSections={handleRefreshSectionsCallback}
        />
      </div>
    </div>
  )
}
