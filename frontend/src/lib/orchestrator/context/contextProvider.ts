/**
 * Unified Context Provider
 * 
 * Merges:
 * - canvasContextProvider.ts (canvas state extraction)
 * - llmNodeResolver.ts (LLM-based node resolution)
 * 
 * Provides a single, intelligent interface for the orchestrator to:
 * 1. See what's on the canvas
 * 2. Extract context from nodes
 * 3. Resolve references (using LLM + keyword fallback)
 * 4. Build context for LLM prompts
 */

import { Node, Edge } from 'reactflow'
import { Blackboard } from '../core/blackboard'
import { DocumentManager } from '@/lib/document/DocumentManager'
import type { DocumentData } from '@/types/document-hierarchy'

// ============================================================
// TYPES
// ============================================================

export interface NodeContext {
  nodeId: string
  nodeType: string
  label: string
  summary: string
  detailedContext?: {
    format?: string
    totalSections?: number
    wordsWritten?: number
    structure?: string
    allSections?: any[]
    contentMap?: Record<string, string>
    documentData?: DocumentData // ✅ Add hierarchical document data
  }
}

export interface CanvasContext {
  connectedNodes: NodeContext[]
  allNodes: NodeContext[] // All nodes on canvas (for deletion, opening, etc.)
  totalNodes: number
  orchestratorId: string
  reasoning: string
}

// ============================================================
// CONTEXT EXTRACTION
// ============================================================

/**
 * Extract context from a Story Structure node
 * 
 * Now uses hierarchical document_data if available (new system)
 * Falls back to legacy items array (old system)
 */
function extractStoryStructureContext(
  node: Node,
  externalContent?: Record<string, string>
): NodeContext {
  const data = node.data as any
  
  // NEW SYSTEM: Check for document_data (hierarchical)
  if (data.document_data) {
    try {
      const documentData = data.document_data as DocumentData
      const manager = new DocumentManager(documentData)
      
      const format = documentData.format || 'unknown'
      const totalSections = documentData.structure.length
      const wordsWritten = documentData.totalWordCount || 0
      
      // Get all summaries for top-level sections
      const allSummaries = manager.getAllSummaries()
      const topLevelSummaries = allSummaries
        .filter(s => s.level === 1)
        .slice(0, 3)
        .map(s => `- ${s.name}: ${s.summary || 'No summary'}`)
        .join('\n')
      
      let summary = `${format.toUpperCase()} document with ${totalSections} sections`
      if (wordsWritten > 0) {
        summary += ` (${wordsWritten} words written)`
      }
      
      // Build contentMap from hierarchical data
      const flatSections = manager.getFlatStructure()
      const contentMap: Record<string, string> = {}
      for (const section of flatSections) {
        if (section.content && section.content.trim()) {
          contentMap[section.id] = section.content
        }
      }
      
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
          allSections: flatSections.map(s => ({
            id: s.id,
            level: s.level,
            name: s.name,
            summary: s.summary,
            hasContent: !!s.content && s.content.trim().length > 0
          })),
          contentMap,
          documentData // ✅ Include full hierarchical document data
        }
      }
    } catch (error) {
      console.error('[Context Provider] Error reading document_data, falling back to legacy:', error)
      // Fall through to legacy system
    }
  }
  
  // LEGACY SYSTEM: Use items array (old system)
  const items = data.items || []
  const format = data.format || 'unknown'
  const contentMap = externalContent || data.contentMap || {}
  
  const acts = items.filter((i: any) => i.level === 1)
  const totalSections = items.length
  const wordsWritten = Object.values(contentMap).reduce((sum: number, content: any) => {
    return sum + (typeof content === 'string' ? content.split(/\s+/).length : 0)
  }, 0)
  
  let summary = `${format.toUpperCase()} document with ${totalSections} sections`
  if (wordsWritten > 0) {
    summary += ` (${wordsWritten} words written)`
  }
  
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
 * Extract context from a Test node
 */
function extractTestNodeContext(node: Node): NodeContext {
  const data = node.data as any
  const markdown = data.markdown || ''
  
  let title = 'Test Content'
  const titleMatch = markdown.match(/title:\s*"([^"]+)"/)
  if (titleMatch) {
    title = titleMatch[1]
  }
  
  const wordCount = markdown.split(/\s+/).length
  
  return {
    nodeId: node.id,
    nodeType: 'test',
    label: data.label || title,
    summary: `Test document with ${wordCount} words`,
    detailedContext: {
      contentMap: { 'test': markdown },
      wordsWritten: wordCount
    }
  }
}

/**
 * Build canvas context for orchestrator
 */
export function buildCanvasContext(
  orchestratorId: string,
  nodes: Node[],
  edges: Edge[],
  externalContentMap?: Record<string, { contentMap: Record<string, string> }>
): CanvasContext {
  // Helper to extract node context
  const extractNodeContext = (node: Node): NodeContext => {
    const externalContent = externalContentMap?.[node.id]?.contentMap
    
    if (node.type === 'storyStructureNode' || node.data?.nodeType === 'story-structure') {
      return extractStoryStructureContext(node, externalContent)
    } else if (node.type === 'testNode') {
      return extractTestNodeContext(node)
    }
    
    // Generic node
    return {
      nodeId: node.id,
      nodeType: node.type || 'unknown',
      label: node.data?.label || 'Untitled Node',
      summary: 'Generic node'
    }
  }
  
  // Find nodes connected to orchestrator
  const connectedNodeIds = edges
    .filter(e => e.source === orchestratorId || e.target === orchestratorId)
    .map(e => e.source === orchestratorId ? e.target : e.source)
  
  const connectedNodes = nodes
    .filter(n => connectedNodeIds.includes(n.id))
    .map(extractNodeContext)
  
  // Get ALL nodes on canvas (excluding the orchestrator itself)
  const allNodes = nodes
    .filter(n => n.id !== orchestratorId)
    .map(extractNodeContext)
  
  const reasoning = connectedNodes.length > 0
    ? `Connected to ${connectedNodes.length} node(s): ${connectedNodes.map(n => n.label).join(', ')}`
    : 'No connected nodes'
  
  return {
    connectedNodes,
    allNodes,
    totalNodes: nodes.length,
    orchestratorId,
    reasoning
  }
}

/**
 * Format canvas context for LLM prompt
 */
export function formatCanvasContextForLLM(context: CanvasContext): string {
  if (context.connectedNodes.length === 0) {
    return 'No connected nodes on canvas.'
  }
  
  let formatted = `Canvas State:\n`
  formatted += `- Total nodes: ${context.totalNodes}\n`
  formatted += `- Connected nodes: ${context.connectedNodes.length}\n\n`
  
  context.connectedNodes.forEach(node => {
    formatted += `Node: "${node.label}" (${node.nodeType})\n`
    formatted += `  Summary: ${node.summary}\n`
    
    if (node.detailedContext?.structure) {
      formatted += `  Structure:\n${node.detailedContext.structure}\n`
    }
    
    formatted += '\n'
  })
  
  return formatted
}

// ============================================================
// INTELLIGENT NODE RESOLUTION
// ============================================================

/**
 * Resolve which node the user is referring to
 * 
 * Strategy:
 * 1. Use LLM to reason about context (primary)
 * 2. Fall back to keyword matching (secondary)
 * 3. Use blackboard's recently referenced nodes (tertiary)
 */
export async function resolveNode(
  userMessage: string,
  canvasContext: CanvasContext,
  blackboard: Blackboard
): Promise<NodeContext | null> {
  const conversationHistory = blackboard.getRecentMessages(5)
  
  // TIER 1: LLM Reasoning (RE-ENABLED - API endpoint fixed)
  try {
    const llmResult = await resolveNodeWithLLM(
      userMessage,
      canvasContext,
      conversationHistory.map(m => ({ role: m.role, content: m.content }))
    )
    
    if (llmResult) {
      console.log(`✅ [Context Provider] LLM resolved to: "${llmResult.label}"`)
      blackboard.addReferencedNode(llmResult.nodeId)
      return llmResult
    }
  } catch (error) {
    console.warn('[Context Provider] LLM resolution failed, falling back to keywords:', error)
    // Fall through to keyword matching
  }
  
  // TIER 2: Keyword Matching (Fallback)
  const keywordResult = resolveNodeWithKeywords(
    userMessage,
    canvasContext,
    conversationHistory.map(m => ({ role: m.role, content: m.content }))
  )
  
  if (keywordResult) {
    console.log(`🎯 [Context Provider] Keyword matching resolved to: "${keywordResult.label}"`)
    blackboard.addReferencedNode(keywordResult.nodeId)
    return keywordResult
  }
  
  // TIER 3: Recently Referenced Nodes
  const recentlyReferenced = blackboard.getRecentlyReferencedNodes()
  if (recentlyReferenced.length > 0) {
    const recentNode = canvasContext.connectedNodes.find(n => n.nodeId === recentlyReferenced[0])
    if (recentNode) {
      console.log(`🔄 [Context Provider] Using recently referenced node: "${recentNode.label}"`)
      return recentNode
    }
  }
  
  console.log('⚠️ [Context Provider] Could not resolve node reference')
  return null
}

/**
 * LLM-based node resolution
 */
async function resolveNodeWithLLM(
  userMessage: string,
  canvasContext: CanvasContext,
  conversationHistory: Array<{ role: string, content: string }>
): Promise<NodeContext | null> {
  try {
    const availableNodes = canvasContext.connectedNodes
      .map(node => `- "${node.label}" (${node.detailedContext?.format || node.nodeType}): ${node.summary}`)
      .join('\n')

    const recentConversation = conversationHistory
      .slice(-5)
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n')

    const prompt = `You are helping determine which document/node a user is referring to.

AVAILABLE NODES ON CANVAS:
${availableNodes}

RECENT CONVERSATION:
${recentConversation}

CURRENT USER MESSAGE:
"${userMessage}"

TASK: Determine which node (if any) the user is referring to in their current message.
- Consider pronouns like "it", "this", "that", "the plot", "the story"
- Look at what was recently discussed in the conversation
- If the user says "the screenplay" after just discussing a screenplay, that's the reference
- If the user says "the plot" or "it" right after discussing a specific document, resolve to that document

OUTPUT FORMAT (JSON only, no markdown):
{
  "nodeId": "node-id-here or null",
  "nodeName": "Node Label or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this node was chosen"
}

If no clear reference exists, return nodeId: null with low confidence.`

    // Build the request in the format expected by /api/intent/analyze
    const systemPrompt = `You are a node resolution assistant. Your job is to identify which canvas node the user is referring to.

Available nodes:
${availableNodes.map(n => `- ${n.label} (${n.nodeType})`).join('\n')}

${recentConversation.length > 0 ? `Recent conversation:\n${recentConversation.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}` : ''}

OUTPUT FORMAT (JSON only, no markdown):
{
  "nodeId": "node-id-here or null",
  "nodeName": "Node Label or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this node was chosen"
}

If no clear reference exists, return nodeId: null with low confidence.`

    const userPrompt = prompt

    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        conversation_history: recentConversation,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[LLM Node Resolver] API error:', errorData)
      return null
    }

    const result = await response.json()
    
    // Parse the LLM's response
    // The API returns { content: "..." } where content is the LLM's response
    let resolution: any
    try {
      let content = result.content || result.analysis || ''
      
      // Remove markdown code blocks if present
      content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
      
      // Extract JSON object if wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        resolution = JSON.parse(jsonMatch[0])
      } else {
        resolution = JSON.parse(content)
      }
    } catch (parseError) {
      console.error('[LLM Node Resolver] Failed to parse response:', parseError)
      return null
    }

    if (!resolution.nodeId || resolution.confidence < 0.5) {
      return null
    }

    // Find the node in canvas context
    const resolvedNode = canvasContext.connectedNodes.find(
      node => node.label.toLowerCase() === resolution.nodeName?.toLowerCase() ||
              node.nodeId === resolution.nodeId
    )

    return resolvedNode || null

  } catch (error) {
    console.error('[LLM Node Resolver] Error:', error)
    return null
  }
}

/**
 * Keyword-based node resolution (fallback)
 */
function resolveNodeWithKeywords(
  reference: string,
  canvasContext: CanvasContext,
  conversationHistory?: Array<{ role: string, content: string }>
): NodeContext | null {
  const lowerRef = reference.toLowerCase()
  
  // Try to match by label
  for (const ctx of canvasContext.connectedNodes) {
    const lowerLabel = ctx.label.toLowerCase()
    if (lowerRef.includes(lowerLabel)) {
      return ctx
    }
  }
  
  // Try to match by format/type
  const formatMap: Record<string, string> = {
    'screenplay': 'screenplay',
    'script': 'screenplay',
    'novel': 'novel',
    'book': 'novel',
    'podcast': 'podcast',
    'report': 'report'
  }
  
  for (const [keyword, format] of Object.entries(formatMap)) {
    if (lowerRef.includes(keyword)) {
      const node = canvasContext.connectedNodes.find(
        ctx => ctx.nodeType === 'story-structure' && 
               ctx.detailedContext?.format === format
      )
      if (node) return node
    }
  }
  
  // Check conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-3).reverse()
    
    for (const msg of recentMessages) {
      const lowerMsg = msg.content.toLowerCase()
      
      for (const ctx of canvasContext.connectedNodes) {
        const lowerLabel = ctx.label.toLowerCase()
        if (lowerMsg.includes(lowerLabel)) {
          return ctx
        }
        
        if (ctx.detailedContext?.format) {
          const format = ctx.detailedContext.format.toLowerCase()
          if (lowerMsg.includes(format)) {
            return ctx
          }
        }
      }
    }
  }
  
  // Generic terms with conversation context
  if (lowerRef.includes('plot') || lowerRef.includes(' it ') || 
      lowerRef.includes('this ') || lowerRef.includes('that ')) {
    
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5).reverse()
      
      for (const msg of recentMessages) {
        const lowerMsg = msg.content.toLowerCase()
        
        for (const ctx of canvasContext.connectedNodes) {
          if (ctx.detailedContext?.format) {
            const format = ctx.detailedContext.format.toLowerCase()
            if (lowerMsg.includes(format)) {
              return ctx
            }
          }
        }
      }
    }
    
    // Default to first story structure node
    const story = canvasContext.connectedNodes.find(
      ctx => ctx.nodeType === 'story-structure'
    )
    if (story) return story
  }
  
  // If only one story structure node exists, assume that's the reference
  const storyNodes = canvasContext.connectedNodes.filter(
    ctx => ctx.nodeType === 'story-structure'
  )
  
  if (storyNodes.length === 1) {
    return storyNodes[0]
  }
  
  return null
}

