/**
 * Unified Context Provider
 * 
 * This module provides a single, intelligent interface for the orchestrator to understand
 * and interact with the canvas state. It merges functionality from:
 * - canvasContextProvider.ts (canvas state extraction)
 * - llmNodeResolver.ts (LLM-based node resolution)
 * 
 * Main Responsibilities:
 * 1. Extract context from canvas nodes (structure, content, metadata)
 * 2. Build formatted context strings for LLM prompts
 * 3. Resolve user references to nodes (e.g., "the screenplay", "it", "that story")
 *    using a three-tier strategy: LLM reasoning → keyword matching → recent references
 * 
 * Architecture:
 * - Supports both NEW system (hierarchical document_data) and LEGACY system (items array)
 * - Handles story structure nodes, test nodes, and generic nodes
 * - Integrates with Blackboard for conversation history and referenced nodes
 * 
 * @see DocumentManager for hierarchical document data handling
 * @see Blackboard for conversation history and node tracking
 */

import { Node, Edge } from 'reactflow'
import { Blackboard } from '../core/blackboard'
import { DocumentManager } from '@/lib/document/DocumentManager'
import type { DocumentData } from '@/types/document-hierarchy'

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Context information extracted from a single canvas node
 * 
 * Contains both high-level summary and detailed information about the node's
 * structure, content, and metadata. Used by the orchestrator to understand
 * what documents/stories exist on the canvas.
 */
export interface NodeContext {
  nodeId: string              // Unique node identifier
  nodeType: string            // Type of node (e.g., 'story-structure', 'test')
  label: string               // Display name of the node
  summary: string             // Brief summary (e.g., "NOVEL document with 5 sections (3000 words written)")
  detailedContext?: {
    format?: string            // Document format (novel, screenplay, podcast, etc.)
    totalSections?: number     // Total number of sections in the document
    wordsWritten?: number      // Total word count across all sections
    structure?: string         // Formatted structure summary (top-level sections)
    allSections?: any[]        // Complete list of all sections with metadata
    contentMap?: Record<string, string>  // Map of section IDs to their content
    documentData?: DocumentData // ✅ NEW: Full hierarchical document data (preferred over legacy items array)
  }
}

/**
 * Complete canvas context for the orchestrator
 * 
 * Provides a snapshot of the entire canvas state, including:
 * - Nodes connected to the orchestrator (for context extraction)
 * - All nodes on canvas (for deletion, opening operations)
 * - Reasoning about the canvas state (for LLM prompts)
 */
export interface CanvasContext {
  connectedNodes: NodeContext[]  // Nodes directly connected to orchestrator (via edges)
  allNodes: NodeContext[]        // ALL nodes on canvas (excluding orchestrator itself)
  totalNodes: number             // Total node count (including orchestrator)
  orchestratorId: string          // ID of the orchestrator node
  reasoning: string               // Human-readable description of canvas state
}

// ============================================================
// CONTEXT EXTRACTION
// ============================================================

/**
 * Extract context from a Story Structure node
 * 
 * This function extracts comprehensive context from story structure nodes,
 * supporting both the NEW hierarchical system (document_data) and the LEGACY
 * flat items array system for backward compatibility.
 * 
 * Process:
 * 1. Try NEW system first: Use DocumentManager to read hierarchical document_data
 *    - Extracts format, sections, word counts, structure summaries
 *    - Builds contentMap from hierarchical structure
 *    - Provides full documentData for advanced operations
 * 
 * 2. Fallback to LEGACY system: Use flat items array (old format)
 *    - Extracts format, sections, word counts from items array
 *    - Uses contentMap directly from node data
 *    - Maintains compatibility with older documents
 * 
 * @param node - React Flow node containing story structure data
 * @param externalContent - Optional external content map (for content not stored in node)
 * @returns NodeContext with extracted information
 * 
 * @see DocumentManager for hierarchical document data handling
 */
function extractStoryStructureContext(
  node: Node,
  externalContent?: Record<string, string>
): NodeContext {
  const data = node.data as any
  
  // ============================================================
  // NEW SYSTEM: Hierarchical document_data (preferred)
  // ============================================================
  // Uses DocumentManager to read structured document data with proper
  // hierarchy (Parts → Chapters → Scenes, etc.)
  if (data.document_data) {
    try {
      const documentData = data.document_data as DocumentData
      const manager = new DocumentManager(documentData)
      
      // Extract basic document information
      const format = documentData.format || 'unknown'
      const totalSections = documentData.structure.length
      const wordsWritten = documentData.totalWordCount || 0
      
      // Build structure summary from top-level sections (for LLM context)
      // Shows first 3 top-level sections with their summaries
      const allSummaries = manager.getAllSummaries()
      const topLevelSummaries = allSummaries
        .filter(s => s.level === 1)  // Only top-level sections
        .slice(0, 3)                   // Limit to first 3
        .map(s => `- ${s.name}: ${s.summary || 'No summary'}`)
        .join('\n')
      
      // Build human-readable summary
      let summary = `${format.toUpperCase()} document with ${totalSections} sections`
      if (wordsWritten > 0) {
        summary += ` (${wordsWritten} words written)`
      }
      
      // Build flat contentMap from hierarchical structure
      // This allows legacy code to access content by section ID
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
          documentData // ✅ Include full hierarchical document data for advanced operations
        }
      }
    } catch (error) {
      console.error('[Context Provider] Error reading document_data, falling back to legacy:', error)
      // Fall through to legacy system below
    }
  }
  
  // ============================================================
  // LEGACY SYSTEM: Flat items array (fallback for old documents)
  // ============================================================
  // This handles documents created before the hierarchical system was introduced
  // Uses a flat array of items with level indicators
  const items = data.items || []
  const format = data.format || 'unknown'
  const contentMap = externalContent || data.contentMap || {}
  
  // Extract top-level items (acts, parts, etc.) for structure summary
  const acts = items.filter((i: any) => i.level === 1)
  const totalSections = items.length
  
  // Calculate word count from content map
  const wordsWritten = Object.values(contentMap).reduce((sum: number, content: any) => {
    return sum + (typeof content === 'string' ? content.split(/\s+/).length : 0)
  }, 0)
  
  // Build human-readable summary
  let summary = `${format.toUpperCase()} document with ${totalSections} sections`
  if (wordsWritten > 0) {
    summary += ` (${wordsWritten} words written)`
  }
  
  // Build structure summary from top-level items
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
 * 
 * Test nodes contain markdown content used for testing purposes.
 * Extracts the title (if present in frontmatter) and word count.
 * 
 * @param node - React Flow node containing test data
 * @returns NodeContext with test node information
 */
function extractTestNodeContext(node: Node): NodeContext {
  const data = node.data as any
  const markdown = data.markdown || ''
  
  // Extract title from markdown frontmatter (if present)
  let title = 'Test Content'
  const titleMatch = markdown.match(/title:\s*"([^"]+)"/)
  if (titleMatch) {
    title = titleMatch[1]
  }
  
  // Calculate word count
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
 * 
 * This is the main entry point for extracting canvas state. It:
 * 1. Identifies nodes connected to the orchestrator (via edges)
 * 2. Extracts context from all nodes on the canvas
 * 3. Builds a reasoning string describing the canvas state
 * 
 * The context is used by the orchestrator to:
 * - Understand what documents exist on the canvas
 * - Extract content for LLM prompts
 * - Resolve user references (e.g., "the screenplay", "that story")
 * - Make decisions about document operations (create, open, delete)
 * 
 * @param orchestratorId - ID of the orchestrator node (excluded from results)
 * @param nodes - All nodes on the canvas
 * @param edges - All edges connecting nodes
 * @param externalContentMap - Optional external content map (for content stored outside nodes)
 * @returns CanvasContext with complete canvas state information
 */
export function buildCanvasContext(
  orchestratorId: string,
  nodes: Node[],
  edges: Edge[],
  externalContentMap?: Record<string, { contentMap: Record<string, string> }>
): CanvasContext {
  /**
   * Helper: Extract context from a single node based on its type
   * 
   * Routes to appropriate extraction function based on node type:
   * - storyStructureNode → extractStoryStructureContext (supports new + legacy systems)
   * - testNode → extractTestNodeContext
   * - Other → Generic node context
   */
  const extractNodeContext = (node: Node): NodeContext => {
    const externalContent = externalContentMap?.[node.id]?.contentMap
    
    if (node.type === 'storyStructureNode' || node.data?.nodeType === 'story-structure') {
      return extractStoryStructureContext(node, externalContent)
    } else if (node.type === 'testNode') {
      return extractTestNodeContext(node)
    }
    
    // Generic node (fallback for unknown node types)
    return {
      nodeId: node.id,
      nodeType: node.type || 'unknown',
      label: node.data?.label || 'Untitled Node',
      summary: 'Generic node'
    }
  }
  
  // ============================================================
  // STEP 1: Find nodes connected to orchestrator
  // ============================================================
  // Connected nodes are those that have an edge to/from the orchestrator.
  // These are the nodes the orchestrator can "see" and interact with.
  const connectedNodeIds = edges
    .filter(e => e.source === orchestratorId || e.target === orchestratorId)
    .map(e => e.source === orchestratorId ? e.target : e.source)
  
  const connectedNodes = nodes
    .filter(n => connectedNodeIds.includes(n.id))
    .map(extractNodeContext)
  
  // ============================================================
  // STEP 2: Get ALL nodes on canvas (for operations like deletion)
  // ============================================================
  // All nodes are needed for operations that don't require a connection,
  // such as opening a document or deleting a node.
  const allNodes = nodes
    .filter(n => n.id !== orchestratorId)  // Exclude orchestrator itself
    .map(extractNodeContext)
  
  // ============================================================
  // STEP 3: Build human-readable reasoning string
  // ============================================================
  // This reasoning is included in LLM prompts to help the model understand
  // the current canvas state and what documents are available.
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
 * 
 * Converts CanvasContext into a human-readable string that can be included
 * in LLM prompts to help the model understand what documents exist on the canvas.
 * 
 * Format:
 * ```
 * Canvas State:
 * - Total nodes: X
 * - Connected nodes: Y
 * 
 * Node: "Document Name" (story-structure)
 *   Summary: NOVEL document with 5 sections (3000 words written)
 *   Structure:
 *   - Chapter 1: Introduction...
 *   - Chapter 2: Rising action...
 * ```
 * 
 * @param context - Canvas context to format
 * @returns Formatted string ready for LLM prompt inclusion
 */
export function formatCanvasContextForLLM(context: CanvasContext): string {
  if (context.connectedNodes.length === 0) {
    return 'No connected nodes on canvas.'
  }
  
  let formatted = `Canvas State:\n`
  formatted += `- Total nodes: ${context.totalNodes}\n`
  formatted += `- Connected nodes: ${context.connectedNodes.length}\n\n`
  
  // Format each connected node with its summary and structure
  context.connectedNodes.forEach(node => {
    formatted += `Node: "${node.label}" (${node.nodeType})\n`
    formatted += `  Summary: ${node.summary}\n`
    
    // Include structure summary if available (top-level sections)
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
 * Resolve which node the user is referring to in their message
 * 
 * This function implements a three-tier resolution strategy to handle
 * ambiguous references like "the screenplay", "it", "that story", etc.
 * 
 * Resolution Strategy (in order):
 * 
 * TIER 1: LLM Reasoning (Primary)
 *   - Uses LLM to analyze user message + conversation history + canvas context
 *   - Best for complex references, pronouns, and context-dependent phrases
 *   - Example: "What's in it?" → LLM understands "it" refers to recently discussed document
 * 
 * TIER 2: Keyword Matching (Fallback)
 *   - Pattern matching on document names, formats, and conversation history
 *   - Faster than LLM, works for explicit references
 *   - Example: "the screenplay" → Matches node with format "screenplay"
 * 
 * TIER 3: Recently Referenced Nodes (Last Resort)
 *   - Uses Blackboard's tracking of recently discussed nodes
 *   - Assumes user is continuing discussion about most recent node
 *   - Example: User says "it" after discussing a novel → Returns that novel
 * 
 * @param userMessage - User's message containing the reference
 * @param canvasContext - Current canvas state with all nodes
 * @param blackboard - Blackboard for conversation history and node tracking
 * @returns Resolved NodeContext or null if no match found
 * 
 * @see resolveNodeWithLLM for LLM-based resolution
 * @see resolveNodeWithKeywords for keyword-based resolution
 */
export async function resolveNode(
  userMessage: string,
  canvasContext: CanvasContext,
  blackboard: Blackboard
): Promise<NodeContext | null> {
  const conversationHistory = blackboard.getRecentMessages(5)
  
  // ============================================================
  // TIER 1: LLM Reasoning (Primary - Most Intelligent)
  // ============================================================
  // Uses LLM to understand context and resolve ambiguous references.
  // Best for pronouns, complex phrases, and context-dependent references.
  try {
    const llmResult = await resolveNodeWithLLM(
      userMessage,
      canvasContext,
      conversationHistory.map(m => ({ role: m.role, content: m.content }))
    )
    
    if (llmResult) {
      console.log(`✅ [Context Provider] LLM resolved to: "${llmResult.label}"`)
      blackboard.addReferencedNode(llmResult.nodeId)  // Track for future reference
      return llmResult
    }
  } catch (error) {
    console.warn('[Context Provider] LLM resolution failed, falling back to keywords:', error)
    // Fall through to keyword matching below
  }
  
  // ============================================================
  // TIER 2: Keyword Matching (Fallback - Fast Pattern Matching)
  // ============================================================
  // Pattern matching for explicit references like "the screenplay", "my novel".
  // Faster than LLM but less intelligent - can't handle pronouns well.
  const keywordResult = resolveNodeWithKeywords(
    userMessage,
    canvasContext,
    conversationHistory.map(m => ({ role: m.role, content: m.content }))
  )
  
  if (keywordResult) {
    console.log(`🎯 [Context Provider] Keyword matching resolved to: "${keywordResult.label}"`)
    blackboard.addReferencedNode(keywordResult.nodeId)  // Track for future reference
    return keywordResult
  }
  
  // ============================================================
  // TIER 3: Recently Referenced Nodes (Last Resort)
  // ============================================================
  // If user says "it" or "that" and we can't resolve via LLM/keywords,
  // assume they're referring to the most recently discussed node.
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
 * LLM-based node resolution (TIER 1)
 * 
 * Uses an LLM to intelligently resolve node references by analyzing:
 * - User's current message
 * - Available nodes on canvas
 * - Recent conversation history
 * 
 * This is the most powerful resolution method because it can:
 * - Understand pronouns ("it", "this", "that")
 * - Use conversation context to disambiguate
 * - Handle complex phrases ("the plot of the screenplay we discussed")
 * 
 * Process:
 * 1. Format available nodes and conversation history into prompt
 * 2. Call /api/intent/analyze with resolution task
 * 3. Parse LLM's JSON response
 * 4. Match resolved nodeId/nodeName to actual node in canvas context
 * 5. Return NodeContext if confidence is high enough (≥0.5)
 * 
 * @param userMessage - User's message containing the reference
 * @param canvasContext - Current canvas state
 * @param conversationHistory - Recent conversation messages
 * @returns Resolved NodeContext or null if resolution fails or confidence is low
 */
async function resolveNodeWithLLM(
  userMessage: string,
  canvasContext: CanvasContext,
  conversationHistory: Array<{ role: string, content: string }>
): Promise<NodeContext | null> {
  try {
    // Format available nodes as a list for the LLM prompt
    const availableNodesString = canvasContext.connectedNodes
      .map(node => `- "${node.label}" (${node.detailedContext?.format || node.nodeType}): ${node.summary}`)
      .join('\n')

    // Format recent conversation history (last 5 messages)
    const recentConversation = conversationHistory
      .slice(-5)
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n')

    // Build system prompt explaining the task
    const systemPrompt = `You are a node resolution assistant. Your job is to identify which canvas node the user is referring to.

Available nodes:
${availableNodesString}

${recentConversation ? `Recent conversation:\n${recentConversation}` : ''}

OUTPUT FORMAT (JSON only, no markdown):
{
  "nodeId": "node-id-here or null",
  "nodeName": "Node Label or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this node was chosen"
}

If no clear reference exists, return nodeId: null with low confidence.`

    // Build user prompt with the specific message to analyze
    const userPrompt = `CURRENT USER MESSAGE:
"${userMessage}"

TASK: Determine which node (if any) the user is referring to in their current message.
- Consider pronouns like "it", "this", "that", "the plot", "the story"
- Look at what was recently discussed in the conversation
- If the user says "the screenplay" after just discussing a screenplay, that's the reference
- If the user says "the plot" or "it" right after discussing a specific document, resolve to that document`

    // Call the intent analysis API (same endpoint used for intent detection)
    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        conversation_history: recentConversation,
        temperature: 0.1  // Low temperature for consistent, focused responses
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[LLM Node Resolver] API error:', errorData)
      return null
    }

    const result = await response.json()
    
    // ============================================================
    // Parse LLM's JSON response
    // ============================================================
    // The API returns { content: "..." } where content is the LLM's response.
    // The response may be:
    // - Plain JSON: { "nodeId": "...", ... }
    // - Markdown code block: ```json { ... } ```
    // - JSON wrapped in text: "Here's the result: { ... }"
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

    // Only accept resolutions with high confidence (≥0.5)
    if (!resolution.nodeId || resolution.confidence < 0.5) {
      return null
    }

    // Find the actual node in canvas context by matching nodeId or nodeName
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
 * Keyword-based node resolution (TIER 2 - Fallback)
 * 
 * Fast pattern matching for explicit node references. This is faster than LLM
 * but less intelligent - it can't handle pronouns or complex context well.
 * 
 * Matching Strategy (in order):
 * 1. Exact label match: "My Novel" → matches node with label "My Novel"
 * 2. Format keyword match: "the screenplay" → matches node with format "screenplay"
 * 3. Conversation history scan: Look for node mentions in recent messages
 * 4. Generic term + context: "it", "this", "that" → use conversation history
 * 5. Single node fallback: If only one story structure node exists, use it
 * 
 * @param reference - User's message containing the reference
 * @param canvasContext - Current canvas state
 * @param conversationHistory - Recent conversation messages (optional)
 * @returns Resolved NodeContext or null if no match found
 */
function resolveNodeWithKeywords(
  reference: string,
  canvasContext: CanvasContext,
  conversationHistory?: Array<{ role: string, content: string }>
): NodeContext | null {
  const lowerRef = reference.toLowerCase()
  
  // ============================================================
  // STRATEGY 1: Match by exact node label
  // ============================================================
  // Example: "My Novel" → matches node with label "My Novel"
  for (const ctx of canvasContext.connectedNodes) {
    const lowerLabel = ctx.label.toLowerCase()
    if (lowerRef.includes(lowerLabel)) {
      return ctx
    }
  }
  
  // ============================================================
  // STRATEGY 2: Match by document format keywords
  // ============================================================
  // Example: "the screenplay" → matches node with format "screenplay"
  // Maps common keywords to document formats
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
  
  // ============================================================
  // STRATEGY 3: Scan conversation history for node mentions
  // ============================================================
  // If user says "it" or "that", look back through recent messages
  // to find which node was discussed.
  if (conversationHistory && conversationHistory.length > 0) {
    const recentMessages = conversationHistory.slice(-3).reverse()  // Last 3, most recent first
    
    for (const msg of recentMessages) {
      const lowerMsg = msg.content.toLowerCase()
      
      // Check if message mentions a node label
      for (const ctx of canvasContext.connectedNodes) {
        const lowerLabel = ctx.label.toLowerCase()
        if (lowerMsg.includes(lowerLabel)) {
          return ctx
        }
        
        // Check if message mentions a document format
        if (ctx.detailedContext?.format) {
          const format = ctx.detailedContext.format.toLowerCase()
          if (lowerMsg.includes(format)) {
            return ctx
          }
        }
      }
    }
  }
  
  // ============================================================
  // STRATEGY 4: Generic terms (pronouns) with conversation context
  // ============================================================
  // If user says "it", "this", "that", "the plot", look deeper
  // into conversation history to find the referenced document.
  if (lowerRef.includes('plot') || lowerRef.includes(' it ') || 
      lowerRef.includes('this ') || lowerRef.includes('that ')) {
    
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-5).reverse()  // Last 5, most recent first
      
      for (const msg of recentMessages) {
        const lowerMsg = msg.content.toLowerCase()
        
        // Find any mention of a document format in recent messages
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
    
    // Default: If user says "it" and there's only one story structure node, use it
    const story = canvasContext.connectedNodes.find(
      ctx => ctx.nodeType === 'story-structure'
    )
    if (story) return story
  }
  
  // ============================================================
  // STRATEGY 5: Single node fallback
  // ============================================================
  // If there's only one story structure node on the canvas,
  // assume that's what the user is referring to (reasonable default).
  const storyNodes = canvasContext.connectedNodes.filter(
    ctx => ctx.nodeType === 'story-structure'
  )
  
  if (storyNodes.length === 1) {
    return storyNodes[0]
  }
  
  // No match found
  return null
}

