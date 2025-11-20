/**
 * Test Node Utilities
 * 
 * Provides utilities for detecting and parsing Test Nodes.
 * Test Nodes are only visible in development mode for testing markdown parsing.
 * 
 * @deprecated Test Nodes are legacy and will be removed in future versions.
 * Use AI Prompt Nodes with real AI generation instead.
 */

import { Node, Edge } from 'reactflow'
import { TestNodeData, StoryStructureItem } from '@/types/nodes'
import { parseMarkdownStructure } from '@/lib/markdownParser'

/**
 * Check if Test Nodes should be available
 * Only enabled in development environment
 */
export function isTestNodeEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Find a Test Node connected to the orchestrator
 * 
 * @param edges - All edges in the canvas
 * @param nodes - All nodes in the canvas
 * @param orchestratorId - ID of the orchestrator node (default: 'context')
 * @returns The connected Test Node or null
 */
export function findConnectedTestNode(
  edges: Edge[],
  nodes: Node[],
  orchestratorId: string = 'context'
): Node<TestNodeData> | null {
  const testEdges = edges.filter(edge => edge.target === orchestratorId)
  
  for (const edge of testEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source)
    if (sourceNode?.data?.nodeType === 'test') {
      return sourceNode as Node<TestNodeData>
    }
  }
  
  return null
}

/**
 * Parse markdown from a Test Node and generate structure
 * 
 * @param testNode - The Test Node to parse
 * @returns Parsed structure items and content map, or null if parsing fails
 */
export function parseTestNodeMarkdown(
  testNode: Node<TestNodeData>
): { items: StoryStructureItem[]; contentMap: Record<string, string> } | null {
  try {
    const markdown = testNode.data.markdown || ''
    
    console.log('🎬 Generating structure from test node markdown:', {
      nodeId: testNode.id,
      markdownLength: markdown.length,
    })
    
    const { items: parsedItems, contentMap } = parseMarkdownStructure(markdown)
    
    // Convert contentMap (Map) to plain object for storage
    const contentMapObject: Record<string, string> = {}
    contentMap.forEach((value, key) => {
      contentMapObject[key] = value
    })
    
    console.log('📝 Content map parsed from test node:', {
      nodeId: testNode.id,
      sections: contentMap.size,
      sectionIds: Array.from(contentMap.keys()),
      contentMapObjectKeys: Object.keys(contentMapObject),
      sampleContent: contentMapObject[Object.keys(contentMapObject)[0]]?.substring(0, 100)
    })
    
    console.log('✅ Structure generated from test markdown:', {
      itemsCount: parsedItems.length,
      levels: [...new Set(parsedItems.map(i => i.level))],
    })
    
    return {
      items: parsedItems,
      contentMap: contentMapObject
    }
  } catch (error) {
    console.error('❌ Failed to parse test node markdown:', error)
    return null
  }
}

/**
 * Generate structure from a Test Node if connected
 * 
 * @param edges - All edges in the canvas
 * @param nodes - All nodes in the canvas
 * @param orchestratorId - ID of the orchestrator node
 * @returns Parsed structure or null if no Test Node or parsing fails
 */
export function generateFromTestNode(
  edges: Edge[],
  nodes: Node[],
  orchestratorId: string = 'context'
): { items: StoryStructureItem[]; contentMap: Record<string, string> } | null {
  const testNode = findConnectedTestNode(edges, nodes, orchestratorId)
  
  if (!testNode) {
    return null
  }
  
  return parseTestNodeMarkdown(testNode)
}

