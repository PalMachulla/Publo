/**
 * useCanvasData - Canvas data management hook
 * 
 * Manages canvas data operations including:
 * - Access control and authentication
 * - Story loading and saving
 * - Title management
 * - User profile and role management
 * - Loading and saving state
 * 
 * Architecture Notes:
 * - Handles authentication redirects
 * - Manages story lifecycle (load, save, update)
 * - Tracks loading and saving states
 * - Provides refs for unsaved changes tracking
 * 
 * Legacy Code:
 * - Line 272: Force admin check for specific email (temporary, needs proper admin system)
 * 
 * @see canvas/page.tsx for original implementation
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { getStory, saveCanvas, updateStory } from '@/lib/stories'
import { getCanvasShares } from '@/lib/canvas-sharing'
import { Node, Edge } from 'reactflow'
import { NodeType, StoryFormat } from '@/types/nodes'

export interface UseCanvasDataOptions {
  /**
   * Story ID from URL params
   */
  storyId: string | null
  
  /**
   * Current nodes and edges (needed for save operations)
   */
  nodes: Node[]
  edges: Edge[]
  
  /**
   * Callbacks for node/edge updates (needed for loadStoryData)
   */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  
  /**
   * Callbacks for structure operations (needed for loadStoryData)
   * Note: Signature matches StoryStructureNode usage: (item, allItems, format, nodeId)
   */
  handleStructureItemClick?: (item: any, allItems: any[], format: StoryFormat, nodeId: string) => Promise<void>
  handleStructureItemsUpdate?: (nodeId: string, items: any[]) => void
  handleNodeUpdate?: (nodeId: string, newData: any) => void
  handleAgentAssign?: (itemId: string, agentId: string | null) => void
  
  /**
   * Callback to set canvas visibility (needed for loadStoryData)
   */
  setCanvasVisibility?: (visibility: 'private' | 'shared' | 'public') => void
  
  /**
   * Callback to set shared emails (needed for loadStoryData)
   */
  setSharedEmails?: (emails: string[]) => void
}

export interface UseCanvasDataReturn {
  // Access control
  hasAccess: boolean
  checkingAccess: boolean
  
  // Story data
  storyTitle: string
  setStoryTitle: React.Dispatch<React.SetStateAction<string>>
  
  // User profile
  userAvatar: string | null
  userRole: 'prospect' | 'admin' | 'user' | null
  isForceAdmin: boolean // TEMPORARY: Force admin for specific email
  
  // Loading/saving state
  saving: boolean
  isLoadingCanvas: boolean
  isLoadingRef: React.MutableRefObject<boolean>
  hasUnsavedChangesRef: React.MutableRefObject<boolean>
  isInferencingRef: React.MutableRefObject<boolean>
  currentStoryIdRef: React.MutableRefObject<string | null>
  lastLoadedStoryIdRef: React.MutableRefObject<string | null>
  
  // Refs for UI elements
  titleInputRef: React.MutableRefObject<HTMLInputElement | null>
  menuRef: React.MutableRefObject<HTMLDivElement | null>
  profileMenuRef: React.MutableRefObject<HTMLDivElement | null>
  
  // Operations
  loadStoryData: (id: string) => Promise<void>
  handleSave: () => Promise<void>
  handleTitleBlur: () => Promise<void>
  handleLogout: () => Promise<void>
  
  // User ID for other hooks
  userId: string | undefined
}

/**
 * Hook for managing canvas data operations
 */
export function useCanvasData(
  options: UseCanvasDataOptions
): UseCanvasDataReturn {
  const {
    storyId,
    nodes,
    edges,
    setNodes,
    setEdges,
    handleStructureItemClick,
    handleStructureItemsUpdate,
    handleNodeUpdate,
    handleAgentAssign,
    setCanvasVisibility,
    setSharedEmails
  } = options
  
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  
  // Access control state
  const [hasAccess, setHasAccess] = useState<boolean>(false)
  const [checkingAccess, setCheckingAccess] = useState(true)
  
  // Story data
  const [storyTitle, setStoryTitle] = useState('Untitled Story')
  
  // User profile
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'prospect' | 'admin' | 'user' | null>(null)
  
  // TEMPORARY: Force admin for specific email while debugging
  // TODO: Replace with proper admin system
  const isForceAdmin = user?.email === 'pal.machulla@gmail.com'
  console.log('🔧 isForceAdmin check:', { email: user?.email, isForceAdmin, userRole })
  
  // Loading/saving state
  const [saving, setSaving] = useState(false)
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(true)
  const isLoadingRef = useRef(true)
  const currentStoryIdRef = useRef<string | null>(null)
  const lastLoadedStoryIdRef = useRef<string | null>(null)
  const hasUnsavedChangesRef = useRef(false) // Track if user made changes
  const isInferencingRef = useRef(false) // Track if AI is currently generating
  
  // Refs for UI elements
  const titleInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  
  /**
   * Check access control
   * 
   * Verifies user has access to the canvas based on:
   * - User profile existence
   * - Access status (granted/waitlist)
   * - User role (admin/user/prospect)
   */
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
          .maybeSingle() // ✅ Use maybeSingle() for graceful handling

        if (error) {
          console.error('Database error checking access:', error)
          setHasAccess(false)
        } else if (!profile) {
          // Profile doesn't exist, create it
          console.log('Creating new user profile...')
          await supabase.from('user_profiles').insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.name,
            role: 'prospect',
            access_status: 'waitlist'
          })
          setHasAccess(false)
        } else {
          // Profile exists, check access and role
          if (profile.access_status === 'granted') {
            setHasAccess(true)
          } else if (profile.role === 'admin' || profile.role === 'user') {
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
  
  /**
   * Handle authentication and routing
   * 
   * Redirects:
   * - No user → /auth
   * - No access → /waitlist
   * - No storyId → /stories
   */
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
          
          // Fetch user profile
          const { data, error } = await supabase
            .from('user_profiles')
            .select('role, access_status, access_tier')
            .eq('id', user.id)
            .maybeSingle() // ✅ Use maybeSingle() for graceful handling
          
          if (error) {
            console.error('❌ Error fetching user role:', error)
            console.error('Error details:', JSON.stringify(error, null, 2))
          } else if (!data) {
            console.warn('⚠️ User profile not found for:', user.id)
          } else {
            console.log('✅ User profile data:', data)
            if (data.role) {
              setUserRole(data.role)
              console.log('✅ User role set to:', data.role)
            } else {
              console.warn('⚠️ No role found in profile')
            }
          }
        } catch (err) {
          console.error('❌ Exception checking user role:', err)
        }
      }
      checkUserRole()
    }
  }, [user, loading, router, storyId, checkingAccess, hasAccess])
  
  /**
   * Load story data from database
   * 
   * Features:
   * - Loads nodes, edges, and story metadata
   * - Ensures orchestrator node exists
   * - Migrates old node types to new types
   * - Loads canvas visibility and shared emails
   * - Injects callbacks into story structure nodes
   */
  const loadStoryData = useCallback(async (id: string) => {
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
      if (setCanvasVisibility) {
        if (story.is_public) {
          setCanvasVisibility('public')
        } else if (story.shared) {
          setCanvasVisibility('shared')
        } else {
          setCanvasVisibility('private')
        }
      }
      
      // Load shared emails from database
      if (setSharedEmails) {
        try {
          const shares = await getCanvasShares(id)
          setSharedEmails(shares.map(share => share.shared_with_email))
        } catch (error) {
          console.error('Failed to load shared users:', error)
          setSharedEmails([])
        }
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
              onItemClick: handleStructureItemClick ? (item: any) => handleStructureItemClick(item, node.id) : undefined,
              onItemsUpdate: handleStructureItemsUpdate ? (items: any[]) => handleStructureItemsUpdate(node.id, items) : undefined,
              onWidthUpdate: handleNodeUpdate ? (width: number) => handleNodeUpdate(node.id, { customNarrationWidth: width }) : undefined,
              availableAgents: loadedAgents,
              onAgentAssign: handleAgentAssign
            }
          }
        }
        // LEGACY: Migrate old createStoryNode and contextCanvas types to orchestratorNode
        // TODO: Remove after migration period (check if any old canvases still exist)
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
  }, [
    setNodes,
    setEdges,
    handleStructureItemClick,
    handleStructureItemsUpdate,
    handleNodeUpdate,
    handleAgentAssign,
    setCanvasVisibility,
    setSharedEmails
  ])
  
  /**
   * Handle title blur - save title on blur
   */
  const handleTitleBlur = useCallback(async () => {
    if (!storyId || !storyTitle.trim()) return
    
    try {
      await updateStory(storyId, { title: storyTitle })
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }, [storyId, storyTitle])
  
  /**
   * Manual save function (user-triggered only)
   * 
   * Features:
   * - Ensures context node exists before saving
   * - Shows orchestrator loading animation
   * - Clears unsaved changes flag after successful save
   */
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
    )
    
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
  
  /**
   * Handle logout
   */
  const handleLogout = useCallback(async () => {
    await signOut()
    router.push('/auth')
  }, [signOut, router])
  
  return {
    // Access control
    hasAccess,
    checkingAccess,
    
    // Story data
    storyTitle,
    setStoryTitle,
    
    // User profile
    userAvatar,
    userRole,
    isForceAdmin,
    
    // Loading/saving state
    saving,
    isLoadingCanvas,
    isLoadingRef,
    hasUnsavedChangesRef,
    isInferencingRef,
    currentStoryIdRef,
    lastLoadedStoryIdRef,
    
    // Refs for UI elements
    titleInputRef,
    menuRef,
    profileMenuRef,
    
    // Operations
    loadStoryData,
    handleSave,
    handleTitleBlur,
    handleLogout,
    
    // User ID
    userId: user?.id
  }
}

