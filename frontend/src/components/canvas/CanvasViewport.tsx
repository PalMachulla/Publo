/**
 * CanvasViewport - ReactFlow canvas viewport component
 * 
 * Displays the ReactFlow canvas with:
 * - Node and edge rendering
 * - Background and controls
 * - Node/edge event handlers
 * - Connection handlers
 * - Node deletion protection
 * 
 * Architecture Notes:
 * - Pure presentation component
 * - Receives filtered nodes/edges and handlers via props
 * - Handles ReactFlow-specific configuration
 * 
 * @see ReactFlow for canvas library
 * @see canvas/page.tsx for original implementation
 */

import React from 'react'
import ReactFlow, {
  Background,
  Controls,
  BackgroundVariant,
  ConnectionMode,
  Connection,
  addEdge,
  Node,
  Edge
} from 'reactflow'
import 'reactflow/dist/style.css'
import { CanvasProvider } from '@/contexts/CanvasContext'
import NodeTypeMenu from '@/components/menus/NodeTypeMenu'
import { nodeTypes } from '@/components/nodes'
import type { WorldStateManager } from '@/lib/orchestrator/core/worldState'

export interface CanvasViewportProps {
  // Filtered nodes and edges (for cluster node resource hiding)
  filteredNodes: Node[]
  filteredEdges: Edge[]
  
  // Event handlers
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (connection: Connection) => void
  onNodeClick: (event: React.MouseEvent, node: Node) => void
  
  // Node operations
  onAddNode: (nodeType: any) => void
  
  // Canvas context
  onPromptSubmit?: (prompt: string) => void
  worldState?: WorldStateManager
}

/**
 * Canvas viewport component
 */
export default function CanvasViewport(props: CanvasViewportProps) {
  const {
    filteredNodes,
    filteredEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onAddNode,
    onPromptSubmit,
    worldState
  } = props
  
  return (
    <CanvasProvider value={{ 
      onPromptSubmit,
      worldState
    }}>
      {/* Canvas Area with React Flow */}
      <div className="flex-1 relative bg-gray-50">
        {/* Floating Add Node Menu */}
        <div className="absolute top-6 left-6 z-10">
          <NodeTypeMenu onSelectNodeType={onAddNode} />
        </div>
        
        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
  )
}

