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
  MiniMap,
} from 'reactflow'
import 'reactflow/dist/style.css'

import StoryNode from '@/components/StoryNode'
import ContextCanvas from '@/components/ContextCanvas'
import NodeDetailsPanel from '@/components/NodeDetailsPanel'
import { getStory, getStories, saveCanvas, updateStory, createStory, deleteStory } from '@/lib/stories'
import type { Story } from '@/types/nodes'

const nodeTypes = {
  storyNode: StoryNode,
  contextCanvas: ContextCanvas,
}

const initialNodes: Node[] = [
  {
    id: 'hero',
    type: 'storyNode',
    position: { x: 100, y: 50 },
    data: { label: 'THE HERO', description: 'Main character', comments: [] },
  },
  {
    id: 'nemesis',
    type: 'storyNode',
    position: { x: 300, y: 50 },
    data: { label: 'THE NEMESIS', description: 'The antagonist', comments: [] },
  },
  {
    id: 'place',
    type: 'storyNode',
    position: { x: 500, y: 50 },
    data: { label: 'THE PLACE', description: 'Setting', comments: [] },
  },
  {
    id: 'storyline',
    type: 'storyNode',
    position: { x: 700, y: 50 },
    data: { label: 'THE STORYLINE', description: 'Plot arc', comments: [] },
  },
  {
    id: 'context',
    type: 'contextCanvas',
    position: { x: 200, y: 350 },
    data: { placeholder: "What's your story, Morning Glory?", comments: [] },
  },
]

const initialEdges: Edge[] = [
  { id: 'hero-context', source: 'hero', target: 'context', animated: false, style: { stroke: '#d1d5db', strokeWidth: 2 }, type: 'default' },
  { id: 'nemesis-context', source: 'nemesis', target: 'context', animated: false, style: { stroke: '#d1d5db', strokeWidth: 2 }, type: 'default' },
  { id: 'place-context', source: 'place', target: 'context', animated: false, style: { stroke: '#d1d5db', strokeWidth: 2 }, type: 'default' },
  { id: 'storyline-context', source: 'storyline', target: 'context', animated: false, style: { stroke: '#d1d5db', strokeWidth: 2 }, type: 'default' },
]

export default function CanvasPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const storyId = searchParams.get('id')
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [storyTitle, setStoryTitle] = useState('Untitled Story')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [allStories, setAllStories] = useState<Story[]>([])
  const [saving, setSaving] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    } else if (!loading && user && !storyId) {
      // Redirect to stories page if no story ID
      router.push('/stories')
    }
  }, [user, loading, router, storyId])

  // Load story on mount
  useEffect(() => {
    if (!loading && user && storyId) {
      loadStoryData(storyId)
    }
  }, [user, loading, storyId])

  // Load all stories for the menu
  useEffect(() => {
    if (!loading && user) {
      loadAllStories()
    }
  }, [user, loading])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadStoryData = async (id: string) => {
    try {
      const { story, nodes: loadedNodes, edges: loadedEdges } = await getStory(id)
      setNodes(loadedNodes)
      setEdges(loadedEdges)
      setStoryTitle(story.title)
    } catch (error) {
      console.error('Failed to load story:', error)
    }
  }

  const loadAllStories = async () => {
    try {
      const stories = await getStories()
      setAllStories(stories)
    } catch (error) {
      console.error('Failed to load stories:', error)
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
    if (!storyId) return
    
    setSaving(true)
    try {
      await saveCanvas(storyId, nodes, edges)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }, [storyId, nodes, edges])

  // Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodes.length > 0) {
        handleSave()
      }
    }, 2000) // Save 2 seconds after last change

    return () => clearTimeout(timer)
  }, [nodes, edges, handleSave])

  const handleLogout = async () => {
    await signOut()
    router.push('/auth')
  }

  const handleNewCanvas = async () => {
    try {
      const newStory = await createStory()
      router.push(`/canvas?id=${newStory.id}`)
      setIsMenuOpen(false)
    } catch (error) {
      console.error('Failed to create new canvas:', error)
    }
  }

  const handleOpenCanvas = (id: string) => {
    router.push(`/canvas?id=${id}`)
    setIsMenuOpen(false)
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

  const addNewNode = () => {
    const newNodeId = `node-${nodes.length + 1}`
    const newNode: Node = {
      id: newNodeId,
      type: 'storyNode',
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 100 },
      data: { label: 'NEW ELEMENT', description: 'Click to edit', comments: [] },
    }
    setNodes((nds) => [...nds, newNode])
    
    // Automatically connect new node to the context canvas
    const newEdge: Edge = {
      id: `${newNodeId}-context`,
      source: newNodeId,
      target: 'context',
      animated: false,
      style: { stroke: '#d1d5db', strokeWidth: 2 },
      type: 'default',
    }
    setEdges((eds) => [...eds, newEdge])
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
          <div className="flex items-center gap-3">
            <img src="/publo_logo.svg" alt="PUBLO" className="h-6" />
            <span className="text-gray-300">|</span>
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
          <div className="flex items-center gap-4 relative" ref={menuRef}>
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
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
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

                {/* Open Canvas - with submenu */}
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Open Canvas</div>
                  {allStories.length === 0 ? (
                    <div className="text-sm text-gray-400 italic py-2">No saved canvases</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {allStories.map((story) => (
                        <button
                          key={story.id}
                          onClick={() => handleOpenCanvas(story.id)}
                          className={`w-full text-left px-3 py-2 text-sm rounded transition-colors ${
                            story.id === storyId
                              ? 'bg-yellow-50 text-yellow-900'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium truncate">{story.title}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(story.updated_at).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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

                <div className="border-t border-gray-200 my-2"></div>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content with Sidebar and Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-40 bg-white border-r border-gray-200 p-4 flex flex-col gap-8">
          {/* Context Canvas Section */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 -rotate-90 origin-left translate-x-3 translate-y-16 whitespace-nowrap">
              Context Canvas
            </div>
            <button 
              onClick={addNewNode}
              className="w-16 h-16 rounded-full border-2 border-yellow-400 flex items-center justify-center hover:bg-yellow-50 transition-colors ml-4"
            >
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Step Section */}
          <div className="mt-auto">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 -rotate-90 origin-left translate-x-3 translate-y-16 whitespace-nowrap">
              Publish Flow
            </div>
            <button className="w-16 h-16 rounded-full border-2 border-yellow-400 flex items-center justify-center hover:bg-yellow-50 transition-colors ml-4">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas Area with React Flow */}
        <div className="flex-1 relative bg-gray-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
            defaultEdgeOptions={{
              type: 'default',
              animated: false,
              style: { stroke: '#d1d5db', strokeWidth: 2 },
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
            <MiniMap 
              className="!bg-white !border-gray-200"
              maskColor="rgba(243, 244, 246, 0.6)"
              nodeColor="#e5e7eb"
            />
          </ReactFlow>
        </div>

        {/* Right Panel */}
        <NodeDetailsPanel
          node={selectedNode}
          isOpen={isPanelOpen}
          onClose={() => setIsPanelOpen(false)}
          onUpdate={handleNodeUpdate}
        />
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-200 bg-white py-2">
        <div className="text-center">
          <div className="text-2xl font-light tracking-widest text-gray-300">
            AIAKAKI
          </div>
        </div>
      </div>
    </div>
  )
}
