'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
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

const nodeTypes = {
  storyNode: StoryNode,
  contextCanvas: ContextCanvas,
}

const initialNodes: Node[] = [
  {
    id: 'hero',
    type: 'storyNode',
    position: { x: 100, y: 50 },
    data: { label: 'THE HERO', description: 'Main character' },
  },
  {
    id: 'nemesis',
    type: 'storyNode',
    position: { x: 300, y: 50 },
    data: { label: 'THE NEMESIS', description: 'The antagonist' },
  },
  {
    id: 'place',
    type: 'storyNode',
    position: { x: 500, y: 50 },
    data: { label: 'THE PLACE', description: 'Setting' },
  },
  {
    id: 'storyline',
    type: 'storyNode',
    position: { x: 700, y: 50 },
    data: { label: 'THE STORYLINE', description: 'Plot arc' },
  },
  {
    id: 'context',
    type: 'contextCanvas',
    position: { x: 200, y: 350 },
    data: { placeholder: "What's your story, Morning Glory?" },
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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    await signOut()
    router.push('/auth')
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: false, style: { stroke: '#d1d5db', strokeWidth: 2 }, type: 'default' }, eds)),
    [setEdges]
  )

  const addNewNode = () => {
    const newNodeId = `node-${nodes.length + 1}`
    const newNode: Node = {
      id: newNodeId,
      type: 'storyNode',
      position: { x: Math.random() * 500 + 100, y: Math.random() * 300 + 100 },
      data: { label: 'NEW ELEMENT', description: 'Click to edit' },
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
            <span className="text-sm text-gray-600">Untitled Story</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Logout"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
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
