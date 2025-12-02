/**
 * useCanvasState - ReactFlow canvas state management hook
 * 
 * Manages ReactFlow nodes and edges state, selected node, panel visibility,
 * and node/edge change handlers with cluster node dragging support.
 * 
 * Architecture Notes:
 * - ReactFlow state is the source of truth for canvas UI (required by library)
 * - WorldState is derived from ReactFlow state (see useWorldStateSync)
 * - One-way flow: ReactFlow → WorldState (no conflicts)
 * 
 * Features:
 * - Context node deletion protection
 * - Cluster node dragging with connected resource movement
 * - Resource node filtering for cluster nodes
 * - Unsaved changes tracking (via optional callbacks)
 * 
 * @see useWorldStateSync for WorldState synchronization
 * @see canvas/page.tsx for original implementation
 */

import { useState, useCallback, useMemo, useRef } from 'react'
import { Node, Edge, useNodesState, useEdgesState } from 'reactflow'

// Initial nodes for fresh canvas
const initialNodes: Node[] = [
  {
    id: 'context',
    type: 'orchestratorNode',
    position: { x: 250, y: 500 },
    data: {
      label: 'Orchestrator',
      comments: [],
      nodeType: 'create-story',
      onCreateStory: (format: any) => {
        // This will be replaced by the ref during render
        console.warn('onCreateStory called before ref was set')
      }
    },
  },
]

// No edges on fresh canvas
const initialEdges: Edge[] = []

export interface UseCanvasStateOptions {
  /**
   * Callback to track unsaved changes
   * Called when nodes/edges are modified
   */
  onUnsavedChange?: () => void
  
  /**
   * Ref to check if canvas is currently loading
   * Used to prevent marking changes during initial load
   */
  isLoadingRef?: React.MutableRefObject<boolean>
}

export interface UseCanvasStateReturn {
  // ReactFlow state
  nodes: Node[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  
  // Handlers (with cluster node dragging support)
  handleNodesChange: (changes: any) => void
  handleEdgesChange: (changes: any) => void
  
  // Selected node state
  selectedNode: Node | null
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>
  
  // Panel state
  isPanelOpen: boolean
  setIsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  
  // Filtered nodes/edges (for cluster node resource hiding)
  filteredNodes: Node[]
  filteredEdges: Edge[]
}

/**
 * Hook for managing ReactFlow canvas state
 */
export function useCanvasState(
  options: UseCanvasStateOptions = {}
): UseCanvasStateReturn {
  const { onUnsavedChange, isLoadingRef } = options
  
  // ReactFlow state management
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  
  // Selected node state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  
  // Panel visibility state
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  
  /**
   * Handle node changes with context node protection and cluster node dragging
   * 
   * Features:
   * - Prevents deletion of context node (orchestrator node)
   * - Moves connected resource nodes when cluster nodes are dragged
   * - Tracks unsaved changes (if callback provided)
   */
  const handleNodesChange = useCallback((changes: any) => {
    // Filter out any removal of the context node
    const safeChanges = changes.filter((change: any) => {
      if (change.type === 'remove' && change.id === 'context') {
        return false // Block deletion of context node
      }
      return true
    })
    
    // Mark as having unsaved changes if there are actual changes
    if (safeChanges.length > 0 && (!isLoadingRef || !isLoadingRef.current)) {
      onUnsavedChange?.()
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
  }, [onNodesChange, nodes, edges, onUnsavedChange, isLoadingRef])
  
  /**
   * Handle edge changes with unsaved changes tracking
   */
  const handleEdgesChange = useCallback((changes: any) => {
    // Mark as having unsaved changes if there are actual changes
    if (changes.length > 0 && (!isLoadingRef || !isLoadingRef.current)) {
      onUnsavedChange?.()
    }
    
    onEdgesChange(changes)
  }, [onEdgesChange, onUnsavedChange, isLoadingRef])
  
  /**
   * Filtered nodes - hide resource nodes connected to cluster nodes with showConnectedResources: false
   * 
   * This allows cluster nodes to "contain" resource nodes visually while keeping
   * them in the data model for connections and operations.
   */
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
  
  /**
   * Filtered edges - hide edges to/from hidden resource nodes
   */
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
  
  return {
    // ReactFlow state
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    
    // Handlers
    handleNodesChange,
    handleEdgesChange,
    
    // Selected node state
    selectedNode,
    setSelectedNode,
    
    // Panel state
    isPanelOpen,
    setIsPanelOpen,
    
    // Filtered nodes/edges
    filteredNodes,
    filteredEdges,
  }
}

