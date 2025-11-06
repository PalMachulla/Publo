'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
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

import StoryNode from '@/components/StoryNode'
import ContextCanvas from '@/components/ContextCanvas'
import NodeDetailsPanel from '@/components/NodeDetailsPanel'
import NodeTypeMenu from '@/components/NodeTypeMenu'
import { getStory, saveCanvas, updateStory, createStory, deleteStory } from '@/lib/stories'
import { NodeType } from '@/types/nodes'

const nodeTypes = {
  storyNode: StoryNode,
  contextCanvas: ContextCanvas,
}

// Only context node on fresh canvas
const initialNodes: Node[] = [
  {
    id: 'context',
    type: 'contextCanvas',
    position: { x: 200, y: 350 },
    data: { placeholder: "What's your story, Morning Glory?", comments: [] },
  },
]

// No edges on fresh canvas
const initialEdges: Edge[] = []

export default function CanvasPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storyId = searchParams.get('id')
  
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
    onNodesChange(safeChanges)
  }, [onNodesChange])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [storyTitle, setStoryTitle] = useState('Untitled Story')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(true)
  const isLoadingRef = useRef(true)
  const currentStoryIdRef = useRef<string | null>(null)
  const lastLoadedStoryIdRef = useRef<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    } else if (!loading && user && !storyId) {
      // Redirect to stories page if no story ID
      router.push('/stories')
    } else if (user) {
      // Get user avatar from metadata (social login)
      const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      setUserAvatar(avatar)
    }
  }, [user, loading, router, storyId])

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
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadStoryData = async (id: string) => {
    try {
      console.log(`Loading story: ${id}`)
      const { story, nodes: loadedNodes, edges: loadedEdges } = await getStory(id)
      
      // Ensure context canvas always exists and is unique
      const hasContextCanvas = loadedNodes.some(node => node.id === 'context')
      let finalNodes = loadedNodes
      
      if (!hasContextCanvas) {
        // Add context canvas if it doesn't exist
        const contextNode: Node = {
          id: 'context',
          type: 'contextCanvas',
          position: { x: 200, y: 350 },
          data: { placeholder: "What's your story, Morning Glory?", comments: [] },
        }
        finalNodes = [...loadedNodes, contextNode]
      }
      
      console.log(`Loaded ${finalNodes.length} nodes, ${loadedEdges.length} edges for story: ${id}`)
      
      setNodes(finalNodes)
      setEdges(loadedEdges)
      setStoryTitle(story.title)
      
      // Use setTimeout to ensure state updates are applied
      setTimeout(() => {
        setIsLoadingCanvas(false)
        isLoadingRef.current = false
        console.log(`Story ${id} fully loaded and ready for edits`)
      }, 500)
    } catch (error) {
      console.error('Failed to load story:', error)
      setIsLoadingCanvas(false)
      isLoadingRef.current = false
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

  // Auto-save canvas on changes (debounced)
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
        type: 'contextCanvas',
        position: { x: 200, y: 350 },
        data: { placeholder: "What's your story, Morning Glory?", comments: [] },
      }
      nodesToSave = [...nodes, contextNode]
      setNodes(nodesToSave)
    }
    
    setSaving(true)
    try {
      // Add timeout to prevent hanging requests
      await Promise.race([
        saveCanvas(storyId, nodesToSave, edges),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save operation timed out')), 30000)
        )
      ])
      console.log('Canvas saved successfully')
    } catch (error) {
      // Log error but don't disrupt user experience
      console.error('Failed to save canvas:', error)
    } finally {
      setSaving(false)
    }
  }, [storyId, nodes, edges, setNodes, saving])

  // Debounced auto-save with longer delay to prevent overwhelming database
  useEffect(() => {
    // Don't auto-save while loading initial data
    if (isLoadingCanvas) return
    
    // Don't auto-save if we only have the context node
    if (nodes.length <= 1) return
    
    // Don't auto-save if already saving
    if (saving) return

    const timer = setTimeout(() => {
      if (nodes.length > 0 && storyId && !saving) {
        console.log('Auto-saving canvas with', nodes.length, 'nodes')
        handleSave()
      }
    }, 10000) // Increased to 10 seconds to reduce database load

    return () => clearTimeout(timer)
  }, [nodes, edges, handleSave, storyId, isLoadingCanvas, saving])

  // Save before unmounting or navigating away
  useEffect(() => {
    // Capture current values in refs for the cleanup function
    const savedStoryId = currentStoryIdRef.current
    const savedNodes = nodes
    const savedEdges = edges
    const savedIsLoading = isLoadingRef.current
    
    return () => {
      // Only save if we have actual content (more than just context node)
      const hasRealNodes = savedNodes.length > 1 || 
        (savedNodes.length === 1 && savedNodes[0]?.id !== 'context')
      
      if (savedStoryId && hasRealNodes) {
        console.log('Saving on unmount:', { 
          storyId: savedStoryId, 
          nodes: savedNodes.length, 
          edges: savedEdges.length,
          isLoading: savedIsLoading 
        })
        saveCanvas(savedStoryId, savedNodes, savedEdges).catch(err => {
          console.error('Failed to save on unmount:', err)
        })
      } else {
        console.log('Skipping save on unmount:', { 
          hasStoryId: !!savedStoryId, 
          nodeCount: savedNodes.length, 
          hasRealNodes,
          isLoading: savedIsLoading
        })
      }
    }
  }, [nodes, edges])

  const handleLogout = async () => {
    await signOut()
    router.push('/auth')
  }

  const handleNewCanvas = async () => {
    try {
      // Save current canvas before creating new one
      const hasRealNodes = nodes.length > 1 || (nodes.length === 1 && nodes[0].id !== 'context')
      
      if (storyId && hasRealNodes && currentStoryIdRef.current === storyId) {
        try {
          console.log('Saving before creating new canvas...')
          await Promise.race([
            saveCanvas(storyId, nodes, edges),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 3000))
          ])
        } catch (err) {
          console.error('Failed to save before creating new canvas:', err)
        }
      }
      
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
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: false, style: { stroke: '#d1d5db', strokeWidth: 2 }, type: 'default' }, eds)),
    [setEdges]
  )

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Don't open panel for context canvas - it has its own input behavior
    if (node.id === 'context') {
      return
    }
    setSelectedNode(node)
    setIsPanelOpen(true)
  }, [])

  // Handle node update from panel
  const handleNodeUpdate = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: newData }
          : node
      )
    )
    // Update selected node to reflect changes in panel
    setSelectedNode((prev) => 
      prev?.id === nodeId ? { ...prev, data: newData } : prev
    )
  }, [setNodes])

  // Handle node deletion
  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setIsPanelOpen(false)
    setSelectedNode(null)
  }, [setNodes, setEdges])

  const addNewNode = (nodeType: NodeType) => {
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
      case 'link':
        nodeData.label = 'LINKS'
        nodeData.description = 'Add URLs'
        nodeData.links = []
        break
    }
    
    const newNode: Node = {
      id: newNodeId,
      type: 'storyNode',
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 100 },
      data: nodeData,
    }
    
    // Automatically connect new node to the context canvas
    const newEdge: Edge = {
      id: `${newNodeId}-context`,
      source: newNodeId,
      target: 'context',
      animated: false,
      style: { stroke: '#d1d5db', strokeWidth: 2 },
      type: 'default',
    }
    
    // Prepare updated arrays BEFORE setState
    const updatedNodes = [...nodes, newNode]
    const updatedEdges = [...edges, newEdge]
    
    // Update both nodes and edges
    setNodes(updatedNodes)
    setEdges(updatedEdges)
    
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl font-mono">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white z-10 shadow-sm">
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
            {saving && (
              <span className="text-xs text-gray-400">Saving...</span>
            )}
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

                {/* My Stories */}
                <button
                  onClick={async () => {
                    // Save current canvas before navigating away
                    const hasRealNodes = nodes.length > 1 || (nodes.length === 1 && nodes[0].id !== 'context')
                    
                    if (storyId && hasRealNodes && currentStoryIdRef.current === storyId) {
                      try {
                        console.log('Saving before navigating to stories...')
                        await Promise.race([
                          saveCanvas(storyId, nodes, edges),
                          new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 3000))
                        ])
                      } catch (error) {
                        console.error('Failed to save before navigation:', error)
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
                  My Stories
                </button>

                {/* My Characters */}
                <button
                  onClick={async () => {
                    // Save current canvas before navigating away
                    const hasRealNodes = nodes.length > 1 || (nodes.length === 1 && nodes[0].id !== 'context')
                    
                    if (storyId && hasRealNodes && currentStoryIdRef.current === storyId) {
                      try {
                        console.log('Saving before navigating to characters...')
                        await Promise.race([
                          saveCanvas(storyId, nodes, edges),
                          new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 3000))
                        ])
                      } catch (error) {
                        console.error('Failed to save before navigation:', error)
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
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 0.75 }}
            fitViewOptions={{ padding: 0.2, maxZoom: 0.75 }}
            className="bg-gray-50"
            defaultEdgeOptions={{
              type: 'default',
              animated: false,
              style: { stroke: '#d1d5db', strokeWidth: 2 },
            }}
            nodesDraggable={true}
            nodesConnectable={true}
            elementsSelectable={true}
            onNodesDelete={(deleted) => {
              // Prevent deletion of context canvas node
              const hasContext = deleted.some(node => node.id === 'context')
              if (hasContext) {
                alert('The context canvas cannot be deleted - it is a core part of every story!')
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

        {/* Right Panel */}
        <NodeDetailsPanel
          node={selectedNode}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          onUpdate={handleNodeUpdate}
          onDelete={handleNodeDelete}
        />

        {/* Loading Indicator */}
        {isLoadingCanvas && (
          <div className="fixed bottom-40 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 border-2 border-gray-300 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-gray-400 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <p className="text-gray-400 text-sm">Loading Canvas...</p>
            </div>
          </div>
        )}

        {/* Fixed Footer - Intelligence Engineered by AIAKAKI */}
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2">
          <p className="text-gray-400 text-sm">Intelligence Engineered by</p>
          <img src="/aiakaki_logo.svg" alt="AIAKAKI" className="h-3.5" />
        </div>
      </div>
    </div>
  )
}
