/**
 * LLM-Based Node Resolver
 * 
 * Uses the orchestrator LLM to intelligently determine which canvas node
 * the user is referring to based on conversation history and canvas state.
 * 
 * This replaces brittle keyword matching with actual reasoning.
 */

import { CanvasContext, NodeContext } from './canvasContextProvider'

interface NodeResolutionResult {
  nodeId: string | null
  nodeName: string | null
  confidence: number
  reasoning: string
}

/**
 * Use LLM to determine which node the user is referring to
 */
export async function resolveNodeWithLLM(
  userMessage: string,
  canvasContext: CanvasContext,
  conversationHistory: Array<{ role: string, content: string }>
): Promise<NodeContext | null> {
  try {
    // Build a prompt for the LLM to reason about node references
    const availableNodes = canvasContext.connectedNodes
      .map(node => `- "${node.label}" (${node.detailedContext?.format || node.nodeType}): ${node.summary}`)
      .join('\n')

    const recentConversation = conversationHistory
      .slice(-5)
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n')

    const systemPrompt = `You are a context-aware assistant helping determine which document/node a user is referring to.

Your task is to analyze the user's message and conversation history to identify which node they're talking about.

Consider:
- Direct references: "the screenplay", "the report", "the novel"
- Pronouns: "it", "this", "that"
- Contextual references: "the plot", "the story", "the characters"
- Recent conversation context

OUTPUT FORMAT (JSON only, no markdown):
{
  "nodeId": "node-id-here or null",
  "nodeName": "Node Label or null",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this node was chosen"
}

If no clear reference exists, return nodeId: null with low confidence.`

    const userPrompt = `AVAILABLE NODES ON CANVAS:
${availableNodes}

RECENT CONVERSATION:
${recentConversation}

CURRENT USER MESSAGE:
"${userMessage}"

Which node (if any) is the user referring to?`

    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        conversation_history: recentConversation.map(m => ({
          role: m.role === 'orchestrator' ? 'assistant' : m.role,
          content: m.content
        })),
        temperature: 0.1 // Low temperature for more deterministic node resolution
      })
    })

    if (!response.ok) {
      console.error('[LLM Node Resolver] API call failed:', response.statusText)
      return null
    }

    const result = await response.json()
    
    // Parse the LLM's response
    let resolution: NodeResolutionResult
    try {
      // The LLM might return the JSON directly or wrapped in markdown
      const jsonMatch = result.analysis?.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        resolution = JSON.parse(jsonMatch[0])
      } else {
        resolution = JSON.parse(result.analysis)
      }
    } catch (parseError) {
      console.error('[LLM Node Resolver] Failed to parse LLM response:', result)
      return null
    }

    console.log('🧠 [LLM Node Resolver] Result:', resolution)

    // If confidence is too low or no node identified, return null
    if (!resolution.nodeId || resolution.confidence < 0.5) {
      console.log('[LLM Node Resolver] Low confidence or no node identified')
      return null
    }

    // Find the node in canvas context by matching the node name
    const resolvedNode = canvasContext.connectedNodes.find(
      node => node.label.toLowerCase() === resolution.nodeName?.toLowerCase() ||
              node.nodeId === resolution.nodeId
    )

    if (resolvedNode) {
      console.log(`✅ [LLM Node Resolver] Resolved to: "${resolvedNode.label}" (confidence: ${resolution.confidence})`)
      console.log(`   Reasoning: ${resolution.reasoning}`)
    }

    return resolvedNode || null

  } catch (error) {
    console.error('[LLM Node Resolver] Error:', error)
    return null
  }
}

