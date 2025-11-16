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
} from 'reactflow'
import 'reactflow/dist/style.css'

import UniversalNode from '@/components/canvas/UniversalNode'
import OrchestratorNode from '@/components/nodes/OrchestratorNode'
import StoryDraftNode from '@/components/nodes/StoryDraftNode'
import StoryStructureNode from '@/components/nodes/StoryStructureNode'
import ClusterNode from '@/components/nodes/ClusterNode'
import TestNode, { EXAMPLE_SCREENPLAY_MARKDOWN } from '@/components/nodes/TestNode'
import NodeDetailsPanel from '@/components/panels/NodeDetailsPanel'
import NodeTypeMenu from '@/components/menus/NodeTypeMenu'
import AIDocumentPanel from '@/components/panels/AIDocumentPanel'
import { CanvasProvider } from '@/contexts/CanvasContext'
import { getStory, saveCanvas, updateStory, createStory, deleteStory } from '@/lib/stories'
import { getCanvasShares, shareCanvas, removeCanvasShare } from '@/lib/canvas-sharing'
import { NodeType, StoryFormat, StoryStructureNodeData } from '@/types/nodes'

// Node types for React Flow
const nodeTypes = {
  storyNode: UniversalNode,
  createStoryNode: OrchestratorNode, // Legacy support
  orchestratorNode: OrchestratorNode, // New type
  storyDraftNode: StoryDraftNode,
  storyStructureNode: StoryStructureNode,
  clusterNode: ClusterNode,
  testNode: TestNode,
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
  
  const [hasAccess, setHasAccess] = useState<boolean>(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Wrapper to prevent context node deletion
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
    
    onNodesChange(safeChanges)
  }, [onNodesChange])

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
  const [initialPrompt, setInitialPrompt] = useState('')
  const [currentStoryDraftId, setCurrentStoryDraftId] = useState<string | null>(null)
  const [initialDocumentContent, setInitialDocumentContent] = useState('')
  const [currentStoryStructureNodeId, setCurrentStoryStructureNodeId] = useState<string | null>(null)
  const [currentStructureItems, setCurrentStructureItems] = useState<any[]>([])
  const [currentStructureFormat, setCurrentStructureFormat] = useState<StoryFormat | undefined>(undefined)
  const [currentContentMap, setCurrentContentMap] = useState<Record<string, string>>({})
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null)
  
  // TEMPORARY: Force admin for your email while debugging
  const isForceAdmin = user?.email === 'pal.machulla@gmail.com'
  console.log('🔧 isForceAdmin check:', { email: user?.email, isForceAdmin, userRole })
  const [saving, setSaving] = useState(false)
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(true)
  const isLoadingRef = useRef(true)
  const currentStoryIdRef = useRef<string | null>(null)
  const lastLoadedStoryIdRef = useRef<string | null>(null)
  const hasUnsavedChangesRef = useRef(false) // Track if user made changes
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

  // Load story on mount or when storyId changes
  useEffect(() => {
    if (!loading && user && storyId && storyId !== lastLoadedStoryIdRef.current) {
      console.log('Loading story:', storyId, '(previously loaded:', lastLoadedStoryIdRef.current, ')')
      
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
    
    setNodes((currentNodes) => {
      const structureNode = currentNodes.find(n => n.id === nodeId)
      
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

  // Get available agent nodes for assignment
  const availableAgents = useMemo(() => {
    return nodes
      .filter(n => n.type === 'clusterNode')
      .map(n => ({
        id: n.id,
        agentNumber: n.data.agentNumber || 0,
        color: n.data.color || '#9ca3af',
        label: n.data.label || 'Agent',
        isActive: n.data.isActive ?? true
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
  useEffect(() => {
    if (isLoadingRef.current) return // Don't run during initial load
    
    // Check if cluster count changed OR agent data changed (e.g., color, isActive)
    const countChanged = prevClusterCountRef.current !== clusterCount
    const agentsChanged = JSON.stringify(prevAvailableAgentsRef.current) !== JSON.stringify(availableAgents)
    
    if (!countChanged && !agentsChanged) return
    
    prevClusterCountRef.current = clusterCount
    prevAvailableAgentsRef.current = availableAgents
    
    if (clusterCount === 0) return
    
    console.log('Cluster data changed, updating structure nodes with', availableAgents.length, 'agents')
    
    // Update structure nodes with current agents
    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        if (node.type === 'storyStructureNode') {
          return {
            ...node,
            data: {
              ...node.data,
              availableAgents: availableAgents,
              onAgentAssign: handleAgentAssign
            }
          }
        }
        return node
      })
    })
  }, [clusterCount, availableAgents]) // When cluster count or data changes

  // Handle Create Story node click - spawn new story structure node
  const handleCreateStory = useCallback((format: StoryFormat, template?: string) => {
    console.log('handleCreateStory called with format:', format, 'template:', template)
    
    // Generate unique ID for the story structure
    const structureId = `structure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Get formatted title based on format
    const formatLabels: Record<StoryFormat, string> = {
      'novel': 'Novel',
      'report': 'Report',
      'short-story': 'Short Story',
      'article': 'Article',
      'screenplay': 'Screenplay',
      'essay': 'Essay',
      'podcast': 'Podcast'
    }
    const title = formatLabels[format] || 'Story'
    
    // Create new story structure node - positioned below the Ghostwriter node
    // No default items - let user create structure from scratch
    const nodeData: StoryStructureNodeData = {
      label: title,
      comments: [],
      nodeType: 'story-structure' as const,
      format: format,
      items: [], // Start empty - user will add items via panel
      activeLevel: 1,
      template: template,
      isLoading: true, // Start as loading
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
      await handleSave()
      
      // Remove loading state after save completes
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === structureId
            ? { ...node, data: { ...node.data, isLoading: false } }
            : node
        )
      )
    }
    
    saveAndFinalize()
  }, [nodes, edges, setNodes, setEdges, handleSave])
  
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
    setIsPanelOpen(false)
    setSelectedNode(null)
  }, [setNodes, setEdges])

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
    }
    
    // Determine the node type for rendering
    const nodeRenderType = nodeType === 'cluster' ? 'clusterNode' : nodeType === 'test' ? 'testNode' : 'storyNode'
    
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
      <header className="border-b border-gray-200 bg-white z-10 shadow-sm relative">
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
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
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
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
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
                      // TODO: Navigate to profile page when implemented
                      alert('Profile page coming soon!')
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
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
            fitViewOptions={{ padding: 0.2, maxZoom: 0.75 }}
            className="bg-gray-50"
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
          edges={edges}
          nodes={nodes}
        />

        {/* Loading indicator now integrated into Orchestrator node */}

        {/* Fixed Footer - Intelligence Engineered by AIAKAKI */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2">
          <p className="text-gray-400 text-sm">Intelligence Engineered by</p>
          <img src="/aiakaki_logo.svg" alt="AIAKAKI" className="h-3.5" />
        </div>

        {/* AI Document Panel */}
        <AIDocumentPanel 
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
            setInitialSectionId(null)
          }}
          initialPrompt={initialPrompt}
          storyStructureNodeId={currentStoryStructureNodeId}
          structureItems={currentStructureItems}
          contentMap={currentContentMap}
          initialSectionId={initialSectionId}
          onUpdateStructure={handleStructureItemsUpdate}
          canvasEdges={edges}
          canvasNodes={nodes}
        />
      </div>
    </div>
  )
}
