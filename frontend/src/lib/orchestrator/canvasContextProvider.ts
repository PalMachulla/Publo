/**
 * Canvas Context Provider
 * 
 * Allows the orchestrator to query connected nodes for their context.
 * Each node type exposes relevant information that helps the orchestrator
 * make intelligent decisions.
 * 
 * This gives the orchestrator "eyes" to see what's on the canvas.
 */

import { Node, Edge } from 'reactflow'

export interface NodeContext {
  nodeId: string
  nodeType: string
  label: string
  summary: string
  detailedContext?: any
}

export interface CanvasContext {
  connectedNodes: NodeContext[]
  totalNodes: number
  orchestratorId: string
  reasoning: string
}

/**
 * Extract context from a Story Structure node
 * NOTE: This is synchronous - it only uses the node's in-memory data
 * For Supabase content, use fetchStoryStructureContent() separately
 */
function extractStoryStructureContext(node: Node, externalContent?: Record<string, string>): NodeContext {
  const data = node.data as any
  const items = data.items || []
  const format = data.format || 'unknown'
  // Use external content if provided (from Supabase), otherwise use node's contentMap
  const contentMap = externalContent || data.contentMap || {}
  
  console.log('📦 [extractStoryStructureContext]', {
    nodeId: node.id,
    label: data.label,
    itemsCount: items.length,
    contentMapKeys: Object.keys(contentMap),
    hasContentMap: Object.keys(contentMap).length > 0,
    usingExternalContent: !!externalContent
  })
  
  // Build a summary of the story structure
  const acts = items.filter((i: any) => i.level === 1)
  const totalSections = items.length
  const wordsWritten = Object.values(contentMap).reduce((sum: number, content: any) => {
    return sum + (typeof content === 'string' ? content.split(/\s+/).length : 0)
  }, 0)
  
  let summary = `${format.toUpperCase()} document with ${totalSections} sections`
  if (wordsWritten > 0) {
    summary += ` (${wordsWritten} words written)`
  }
  
  // Extract key plot points or sections
  const topLevelSummaries = acts
    .slice(0, 3)
    .map((act: any) => `- ${act.name}: ${act.summary || 'No summary'}`)
    .join('\n')
  
  return {
    nodeId: node.id,
    nodeType: 'story-structure',
    label: data.label || 'Untitled Story',
    summary: summary,
    detailedContext: {
      format,
      totalSections,
      wordsWritten,
      structure: topLevelSummaries,
      allSections: items.map((i: any) => ({
        id: i.id,
        level: i.level,
        name: i.name,
        summary: i.summary,
        hasContent: !!contentMap[i.id]
      })),
      contentMap
    }
  }
}

/**
 * Extract context from a Test node (contains markdown)
 */
function extractTestNodeContext(node: Node): NodeContext {
  const data = node.data as any
  const markdown = data.markdown || ''
  
  // Extract title from frontmatter or first heading
  let title = 'Test Content'
  const titleMatch = markdown.match(/title:\s*"([^"]+)"/)
  if (titleMatch) {
    title = titleMatch[1]
  }
  
  // Count sections
  const headings = (markdown.match(/^#{1,3}\s+.+$/gm) || []).length
  const wordCount = markdown.split(/\s+/).length
  
  return {
    nodeId: node.id,
    nodeType: 'test',
    label: data.label || 'Test Node',
    summary: `${title} - ${headings} sections, ${wordCount} words`,
    detailedContext: {
      markdown,
      wordCount,
      headings,
      preview: markdown.substring(0, 500)
    }
  }
}

/**
 * Extract context from an AI Prompt node
 */
function extractAIPromptContext(node: Node): NodeContext {
  const data = node.data as any
  const prompt = data.prompt || ''
  
  return {
    nodeId: node.id,
    nodeType: 'aiPrompt',
    label: data.label || 'AI Prompt',
    summary: `User prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`,
    detailedContext: {
      prompt,
      model: data.selectedModel,
      provider: data.selectedProvider
    }
  }
}

/**
 * Extract context from a Character node
 */
function extractCharacterContext(node: Node): NodeContext {
  const data = node.data as any
  const name = data.name || 'Unnamed Character'
  const traits = data.traits || []
  const arc = data.arc || ''
  
  return {
    nodeId: node.id,
    nodeType: 'character',
    label: data.label || name,
    summary: `Character: ${name}${traits.length > 0 ? ` (${traits.slice(0, 3).join(', ')})` : ''}`,
    detailedContext: {
      name,
      traits,
      arc,
      description: data.description
    }
  }
}

/**
 * Extract context from a Research node
 */
function extractResearchContext(node: Node): NodeContext {
  const data = node.data as any
  const topic = data.topic || 'Research'
  const notes = data.notes || ''
  
  return {
    nodeId: node.id,
    nodeType: 'research',
    label: data.label || topic,
    summary: `Research on ${topic}`,
    detailedContext: {
      topic,
      notes,
      sources: data.sources || []
    }
  }
}

/**
 * Extract context from any node type
 */
function extractNodeContext(
  node: Node, 
  externalContentMap?: Record<string, { contentMap: Record<string, string> }>
): NodeContext | null {
  const nodeType = node.data?.nodeType || node.type
  
  switch (nodeType) {
    case 'story-structure':
    case 'storyStructureNode':
      // Use external content if available for this node
      const externalContent = externalContentMap?.[node.id]?.contentMap
      return extractStoryStructureContext(node, externalContent)
    
    case 'test':
    case 'testNode':
      return extractTestNodeContext(node)
    
    case 'aiPrompt':
    case 'aiPromptNode':
      return extractAIPromptContext(node)
    
    case 'character':
    case 'characterNode':
      return extractCharacterContext(node)
    
    case 'research':
    case 'researchNode':
      return extractResearchContext(node)
    
    default:
      // Generic fallback for unknown node types
      return {
        nodeId: node.id,
        nodeType: nodeType || 'unknown',
        label: node.data?.label || 'Node',
        summary: `${nodeType || 'Unknown'} node`,
        detailedContext: node.data
      }
  }
}

/**
 * Get all nodes connected to the orchestrator
 */
export function getConnectedNodes(
  orchestratorId: string,
  nodes: Node[],
  edges: Edge[]
): Node[] {
  // Find all edges where orchestrator is either source or target
  const connectedNodeIds = new Set<string>()
  
  edges.forEach(edge => {
    if (edge.source === orchestratorId) {
      connectedNodeIds.add(edge.target)
    } else if (edge.target === orchestratorId) {
      connectedNodeIds.add(edge.source)
    }
  })
  
  return nodes.filter(node => connectedNodeIds.has(node.id))
}

/**
 * Build complete canvas context for the orchestrator
 * 
 * @param externalContentMap - Optional: Content for story structure nodes from Supabase
 *   Format: { [nodeId]: { contentMap: Record<string, string> } }
 */
export function buildCanvasContext(
  orchestratorId: string,
  nodes: Node[],
  edges: Edge[],
  externalContentMap?: Record<string, { contentMap: Record<string, string> }>
): CanvasContext {
  console.log('🏗️ [buildCanvasContext] Building context:', {
    orchestratorId,
    nodesCount: nodes.length,
    edgesCount: edges.length,
    allNodeIds: nodes.map(n => n.id),
    allEdges: edges.map(e => ({ source: e.source, target: e.target }))
  })
  
  const connectedNodes = getConnectedNodes(orchestratorId, nodes, edges)
  
  console.log('🔗 [buildCanvasContext] Connected nodes found:', {
    count: connectedNodes.length,
    nodeIds: connectedNodes.map(n => n.id),
    nodeTypes: connectedNodes.map(n => n.type || n.data?.nodeType)
  })
  
  const nodeContexts: NodeContext[] = connectedNodes
    .map(node => extractNodeContext(node, externalContentMap))
    .filter((ctx): ctx is NodeContext => ctx !== null)
  
  console.log('✅ [buildCanvasContext] Node contexts extracted:', {
    count: nodeContexts.length,
    contexts: nodeContexts.map(ctx => ({ id: ctx.nodeId, type: ctx.nodeType, label: ctx.label })),
    externalContentProvided: !!externalContentMap
  })
  
  // Build reasoning explanation
  let reasoning = `Orchestrator has visibility into ${nodeContexts.length} connected node(s):\n`
  
  nodeContexts.forEach(ctx => {
    reasoning += `\n• ${ctx.label} (${ctx.nodeType}): ${ctx.summary}`
  })
  
  if (nodeContexts.length === 0) {
    reasoning = 'No nodes are currently connected to the orchestrator. Connect nodes to provide context.'
  }
  
  return {
    connectedNodes: nodeContexts,
    totalNodes: nodes.length,
    orchestratorId,
    reasoning
  }
}

/**
 * Format canvas context for LLM consumption
 */
export function formatCanvasContextForLLM(canvasContext: CanvasContext): string {
  if (canvasContext.connectedNodes.length === 0) {
    return 'No canvas context available. User is working on a blank canvas.'
  }
  
  let formatted = '📊 CANVAS CONTEXT (Nodes visible to orchestrator):\n\n'
  
  canvasContext.connectedNodes.forEach((ctx, index) => {
    formatted += `${index + 1}. ${ctx.label} [${ctx.nodeType.toUpperCase()}]\n`
    formatted += `   Summary: ${ctx.summary}\n`
    
    // Add detailed context for story structures
    if (ctx.nodeType === 'story-structure' && ctx.detailedContext) {
      formatted += `   Structure:\n${ctx.detailedContext.structure}\n`
      formatted += `   Format: ${ctx.detailedContext.format}\n`
    }
    
    // Add content preview for test nodes
    if (ctx.nodeType === 'test' && ctx.detailedContext?.preview) {
      formatted += `   Preview: ${ctx.detailedContext.preview}\n`
    }
    
    formatted += '\n'
  })
  
  return formatted
}

/**
 * Find specific node content by reference
 * Handles phrases like "our other story", "the screenplay", "that document"
 * Also infers from context like "interview the characters" when a story node is visible
 */
export function findReferencedNode(
  reference: string,
  canvasContext: CanvasContext
): NodeContext | null {
  const lowerRef = reference.toLowerCase()
  
  // Try to match by label first
  for (const ctx of canvasContext.connectedNodes) {
    if (ctx.label.toLowerCase().includes(lowerRef)) {
      return ctx
    }
  }
  
  // Try to match by node type
  if (lowerRef.includes('screenplay') || lowerRef.includes('script')) {
    const screenplay = canvasContext.connectedNodes.find(
      ctx => ctx.nodeType === 'story-structure' && 
             ctx.detailedContext?.format === 'screenplay'
    )
    if (screenplay) return screenplay
  }
  
  // If asking about characters and we have a story/screenplay, use it
  if (lowerRef.includes('characters') || lowerRef.includes('interview')) {
    // Prioritize screenplay format first (most likely to have clear characters)
    const screenplay = canvasContext.connectedNodes.find(
      ctx => ctx.nodeType === 'story-structure' && 
             ctx.detailedContext?.format === 'screenplay'
    )
    if (screenplay) return screenplay
    
    // Fall back to any story structure node
    const anyStory = canvasContext.connectedNodes.find(
      ctx => ctx.nodeType === 'story-structure'
    )
    if (anyStory) return anyStory
  }
  
  if (lowerRef.includes('story') || lowerRef.includes('document')) {
    // Return first story structure node
    const story = canvasContext.connectedNodes.find(
      ctx => ctx.nodeType === 'story-structure'
    )
    if (story) return story
  }
  
  // If "other" or "that" is mentioned, return the most recently modified node (not implemented yet)
  // For now, return the first story structure node
  if (lowerRef.includes('other') || lowerRef.includes('that') || lowerRef.includes('the')) {
    const story = canvasContext.connectedNodes.find(
      ctx => ctx.nodeType === 'story-structure'
    )
    if (story) return story
  }
  
  // Default: if only one story structure node exists, assume that's the reference
  const storyNodes = canvasContext.connectedNodes.filter(
    ctx => ctx.nodeType === 'story-structure'
  )
  
  if (storyNodes.length === 1) {
    return storyNodes[0]
  }
  
  return null
}

