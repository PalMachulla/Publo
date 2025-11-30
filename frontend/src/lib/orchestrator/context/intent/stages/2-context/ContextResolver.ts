/**
 * Context Resolver - Stage 2
 * 
 * Resolves ambiguous references and enriches context:
 * - Pronoun resolution ("it", "that", "this")
 * - Canvas node matching
 * - Conversation state tracking
 */

import type { PipelineContext } from '../../pipeline/types'
import { ModelRouterAdapter } from '../../utils/modelRouterAdapter'
import { ConversationTracker } from './ConversationTracker'
import { CanvasAnalyzer } from './CanvasAnalyzer'

export class ContextResolver {
  private conversationTracker: ConversationTracker
  private canvasAnalyzer: CanvasAnalyzer
  
  constructor(private modelRouter: ModelRouterAdapter) {
    this.conversationTracker = new ConversationTracker()
    this.canvasAnalyzer = new CanvasAnalyzer()
  }
  
  /**
   * Resolve references and enrich context
   */
  async resolve(
    message: string,
    context: PipelineContext
  ): Promise<PipelineContext> {
    console.log('🔍 [ContextResolver] Resolving references...')
    
    // Initialize conversation tracker from history
    if (context.conversationHistory) {
      this.conversationTracker.initializeFromHistory(context.conversationHistory)
    }
    
    // Step 1: Resolve pronouns (it, that, this, the X)
    const resolvedReferences = await this.resolvePronouns(message, context)
    
    // Step 2: Match canvas nodes
    const matchedNodes = this.canvasAnalyzer.findMatchingNodes(
      message,
      context.canvasNodes || []
    )
    
    // Step 3: Track conversation state
    this.conversationTracker.addMessage(message)
    const conversationState = this.conversationTracker.getState()
    
    // Check if this is a follow-up response
    const isFollowUp = this.conversationTracker.isFollowUpResponse(message)
    
    return {
      ...context,
      resolvedReferences,
      matchedNodes,
      conversationState,
      // Add follow-up flag for deep analysis
      ...(isFollowUp && { isFollowUpResponse: true })
    }
  }
  
  /**
   * Resolve pronouns using conversation history
   */
  private async resolvePronouns(
    message: string,
    context: PipelineContext
  ): Promise<Record<string, any>> {
    // Check if message has pronouns
    const hasPronouns = /\b(it|that|this|the\s+\w+)\b/i.test(message)
    if (!hasPronouns) {
      return {}
    }
    
    // Use fast LLM to resolve
    const prompt = `Given conversation history and current message, resolve ambiguous references.

Conversation history:
${context.conversationHistory?.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n') || 'None'}

Canvas nodes:
${context.canvasNodes?.map(n => `- ${n.label} (${n.type})`).join('\n') || 'None'}

Current message: "${message}"

What does "it", "that", "this", or "the X" refer to?

Return JSON:
{
  "references": {
    "it": "what it refers to",
    "that": "what that refers to"
  },
  "confidence": 0.0-1.0
}`

    try {
      const response = await this.modelRouter.complete({
        model: 'fast',
        systemPrompt: prompt,
        userPrompt: `Current message: "${message}"\n\nResolve the pronouns and references.`,
        maxTokens: 150,
        temperature: 0.1
      })
      
      // Parse response
      let content = response.trim()
      content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        content = jsonMatch[0]
      }
      
      const parsed = JSON.parse(content)
      return parsed.references || {}
    } catch (error) {
      console.error('❌ [ContextResolver] Failed to resolve pronouns:', error)
      return {}
    }
  }
}

