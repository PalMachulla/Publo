/**
 * Triage Agent - Stage 1
 * 
 * Reasoning-first classification agent that:
 * 1. Always uses LLM reasoning (fast model initially)
 * 2. Escalates to smart/reasoning models based on confidence and complexity
 * 
 * Goal: Intelligent classification with automatic escalation when needed
 */

import type { PipelineContext, TriageResult } from '../../pipeline/types'
import type { IntentAnalysis } from '../../../intentRouter'
import { ModelRouterAdapter } from '../../utils/modelRouterAdapter'

export class TriageAgent {
  private escalationConfidenceThreshold: number = 0.7
  private escalationReasoningThreshold: number = 0.8
  
  constructor(
    private modelRouter: ModelRouterAdapter,
    config?: { escalationConfidenceThreshold?: number; escalationReasoningThreshold?: number }
  ) {
    if (config?.escalationConfidenceThreshold) {
      this.escalationConfidenceThreshold = config.escalationConfidenceThreshold
    }
    if (config?.escalationReasoningThreshold) {
      this.escalationReasoningThreshold = config.escalationReasoningThreshold
    }
  }
  
  /**
   * Classify message using reasoning-first approach with automatic escalation
   */
  async classify(
    message: string,
    context: PipelineContext
  ): Promise<TriageResult> {
    // Always start with fast LLM reasoning (no pattern matching)
    const fastResult = await this.classifyWithFastModel(message, context)
    
    // Check if we need to escalate to a smarter model
    const shouldEscalate = 
      fastResult.confidence < this.escalationConfidenceThreshold ||
      (fastResult.needsReasoning && fastResult.confidence < this.escalationReasoningThreshold)
    
    if (shouldEscalate) {
      console.log('🔄 [TriageAgent] Escalating to smart model:', {
        confidence: fastResult.confidence,
        needsReasoning: fastResult.needsReasoning,
        reason: fastResult.escalationReason
      })
      return await this.escalateToSmartModel(message, context, fastResult)
    }
    
    return fastResult
  }
  
  /**
   * Initial classification with fast model (reasoning-first)
   */
  private async classifyWithFastModel(
    message: string,
    context: PipelineContext
  ): Promise<TriageResult> {
    const systemPrompt = this.buildReasoningPrompt(context)
    const userPrompt = `User message: "${message}"`
    
    try {
      const response = await this.modelRouter.complete({
        model: 'fast',
        systemPrompt,
        userPrompt,
        maxTokens: 200,
        temperature: 0.1
      })
      
      return this.parseTriageResponse(response, false)
    } catch (error) {
      console.error('❌ [TriageAgent] Fast model classification failed:', error)
      // Fallback to complex if LLM fails
      return {
        classification: 'complex',
        confidence: 0.5,
        intent: null,
        needsContextResolution: true,
        needsReasoning: true,
        needsMoreContext: true,
        escalationReason: 'Fast model failed, escalating to smart model'
      }
    }
  }
  
  /**
   * Escalate to smart/reasoning model for complex cases
   */
  private async escalateToSmartModel(
    message: string,
    context: PipelineContext,
    fastResult: TriageResult
  ): Promise<TriageResult> {
    const systemPrompt = this.buildReasoningPrompt(context, true) // Enhanced prompt for smart model
    const userPrompt = `User message: "${message}"

Previous analysis (from fast model):
- Classification: ${fastResult.classification}
- Confidence: ${fastResult.confidence}
- Needs reasoning: ${fastResult.needsReasoning || false}
- Reason for escalation: ${fastResult.escalationReason || 'Low confidence'}

Please provide a more thorough analysis with higher confidence.`
    
    try {
      const response = await this.modelRouter.complete({
        model: 'smart', // Use smart model for escalation
        systemPrompt,
        userPrompt,
        maxTokens: 300,
        temperature: 0.1
      })
      
      const smartResult = this.parseTriageResponse(response, true)
      smartResult.wasEscalated = true
      smartResult.escalationReason = fastResult.escalationReason || 'Low confidence or needs reasoning'
      
      return smartResult
    } catch (error) {
      console.error('❌ [TriageAgent] Smart model escalation failed:', error)
      // Return fast result if escalation fails
      return {
        ...fastResult,
        wasEscalated: true,
        escalationReason: 'Escalation failed, using fast model result'
      }
    }
  }
  
  /**
   * Build reasoning-first prompt for intent classification
   */
  private buildReasoningPrompt(context: PipelineContext, enhanced: boolean = false): string {
    const basePrompt = `You are an intelligent intent classifier. Analyze the user's message and classify their intent using reasoning.

Context:
- Document panel: ${context.documentPanelOpen ? 'OPEN' : 'CLOSED'}
- Active segment: ${context.activeSegment?.name || 'NONE'}
- Canvas nodes: ${context.canvasNodes?.length || 0} nodes
${context.documentFormat ? `- Document format: ${context.documentFormat}` : ''}

Available intents:
- write_content: Generate new content for a section
- answer_question: Answer a question or provide explanation (respond in chat)
- improve_content: Refine/enhance existing content in one section
- rewrite_with_coherence: Rewrite section AND update related sections for consistency
- modify_structure: Change document structure (add/remove sections)
- create_structure: Create a new story/document (only when document panel is CLOSED)
- navigate_section: Navigate to a section within the current document
- open_and_write: Open an existing canvas node for writing
- delete_node: Delete/remove a canvas node
- clarify_intent: Ask a clarifying question

${enhanced ? `
ENHANCED ANALYSIS MODE:
You are using a more powerful model. Provide deeper reasoning and higher confidence.
Consider:
- Subtle linguistic cues (questions that don't start with question words)
- Contextual implications (statements followed by questions)
- Multi-step requests that might be packed into one message
- Ambiguous references that need resolution
` : ''}

CRITICAL - Question Detection:
- Questions asking "why", "how", "what", "when", "where", "who" → answer_question
- Questions that don't start with question words but contain them → answer_question
- Examples: "Right now X is Y. Why did you put that there?" → answer_question
- Examples: "The content in X is Y. How did that happen?" → answer_question
- Questions asking for explanations about past actions or system behavior → answer_question
- Questions ending with "?" → answer_question

Return JSON:
{
  "intent": "write_content" | "answer_question" | "improve_content" | "rewrite_with_coherence" | "modify_structure" | "create_structure" | "navigate_section" | "open_and_write" | "delete_node" | "clarify_intent" | "general_chat",
  "classification": "simple" | "complex" | "ambiguous",
  "confidence": 0.0-1.0,
  "reasoning": "Your thought process - explain why you classified this way",
  "needsContextResolution": boolean,
  "needsReasoning": boolean,
  "needsMoreContext": boolean,
  "escalationReason": "Why this might need a smarter model (if confidence < 0.7 or needsReasoning)"
}

Be honest about your confidence. If you're uncertain or this needs deeper reasoning, set needsReasoning: true and lower confidence.`

    return basePrompt
  }
  
  /**
   * Parse LLM response into TriageResult
   */
  private parseTriageResponse(response: string, wasEscalated: boolean = false): TriageResult {
    try {
      // Remove markdown code blocks if present
      let content = response.trim()
      content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
      
      // Extract JSON object if wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        content = jsonMatch[0]
      }
      
      const parsed = JSON.parse(content)
      
      // Build basic intent analysis if we have enough info
      let intent: IntentAnalysis | null = null
      if (parsed.intent && parsed.confidence > 0.85) {
        intent = {
          intent: parsed.intent as any,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning || '',
          suggestedAction: '',
          requiresContext: parsed.intent === 'write_content' || parsed.intent === 'improve_content',
          suggestedModel: 'orchestrator',
          needsClarification: parsed.intent === 'clarify_intent',
          clarifyingQuestion: parsed.intent === 'clarify_intent' ? parsed.reasoning : undefined,
          extractedEntities: {}
        }
      }
      
      return {
        classification: parsed.classification || 'complex',
        confidence: parsed.confidence || 0.5,
        intent,
        needsContextResolution: parsed.needsContextResolution !== false, // Default to true
        needsReasoning: parsed.needsReasoning || false,
        needsMoreContext: parsed.needsMoreContext || false,
        escalationReason: parsed.escalationReason,
        wasEscalated
      }
    } catch (error) {
      console.error('❌ [TriageAgent] Failed to parse LLM response:', error)
      console.error('Response was:', response.substring(0, 200))
      // Fallback to complex if parsing fails
      return {
        classification: 'complex',
        confidence: 0.5,
        intent: null,
        needsContextResolution: true,
        needsReasoning: true,
        needsMoreContext: true,
        escalationReason: 'Failed to parse response',
        wasEscalated
      }
    }
  }
}

