/**
 * Deep Analyzer - Stage 3
 * 
 * Full intent analysis with chain-of-thought reasoning.
 * Uses modular prompt composition for efficiency.
 */

import type { PipelineContext } from '../../pipeline/types'
import type { IntentAnalysis } from '../../../intentRouter'
import { ModelRouterAdapter } from '../../utils/modelRouterAdapter'
import { PromptComposer } from './PromptComposer'
import type { CorrectionPattern } from '../../../learning/correctionService'

export class DeepAnalyzer {
  private promptComposer: PromptComposer
  
  constructor(
    private modelRouter: ModelRouterAdapter,
    customPromptModules?: string[],
    corrections?: CorrectionPattern[] // NEW: Learned corrections
  ) {
    this.promptComposer = new PromptComposer(customPromptModules, corrections)
  }
  
  /**
   * Perform deep intent analysis
   */
  async analyze(
    message: string,
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    console.log('🧠 [DeepAnalyzer] Starting deep analysis...')
    
    // Build context-aware prompt
    const systemPrompt = this.promptComposer.compose(message, context)
    
    // Build user prompt
    const userPrompt = `Current user message: "${message}"

Analyze this message and determine the user's intent. Consider the conversation history and current context.

Return ONLY valid JSON with your analysis. Do not include markdown formatting. Just the raw JSON object.`
    
    try {
      // Use smart model with chain-of-thought
      // Note: The API endpoint will use the orchestrator model from the database
      const response = await this.modelRouter.complete({
        model: 'smart', // This is informational only - API selects actual model
        systemPrompt,
        userPrompt,
        temperature: 0.2,
        conversationHistory: context.conversationHistory?.slice(-5) || []
      })
      
      return this.parseAnalysis(response)
    } catch (error) {
      console.error('❌ [DeepAnalyzer] Analysis failed:', error)
      // Return fallback intent
      return this.createFallbackIntent(message)
    }
  }
  
  /**
   * Parse LLM response into IntentAnalysis
   */
  private parseAnalysis(response: string): IntentAnalysis {
    try {
      let content = response.trim()
      
      // Remove markdown code blocks if present
      content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
      
      // Extract JSON from intent_analysis tags if present
      const intentMatch = content.match(/<intent_analysis>([\s\S]*?)<\/intent_analysis>/)
      if (intentMatch) {
        content = intentMatch[1].trim()
      }
      
      // Extract JSON object if wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        content = jsonMatch[0]
      }
      
      const analysis = JSON.parse(content)
      
      // Validate required fields
      if (!analysis.intent) {
        throw new Error('Missing intent field')
      }
      
      // Ensure confidence is a number
      if (typeof analysis.confidence !== 'number') {
        analysis.confidence = 0.5
      }
      
      // Ensure extractedEntities exists
      if (!analysis.extractedEntities) {
        analysis.extractedEntities = {}
      }
      
      return {
        intent: analysis.intent,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning || 'Deep analysis completed',
        suggestedAction: analysis.suggestedAction || 'Process the request',
        requiresContext: analysis.requiresContext !== false, // Default to true if not specified
        suggestedModel: analysis.suggestedModel || 'orchestrator',
        needsClarification: analysis.needsClarification || false,
        clarifyingQuestion: analysis.clarifyingQuestion,
        extractedEntities: analysis.extractedEntities,
        usedLLM: true
      }
    } catch (error) {
      console.error('❌ [DeepAnalyzer] Failed to parse analysis JSON:', error)
      console.error('Response content:', response.substring(0, 500))
      return this.createFallbackIntent('')
    }
  }
  
  /**
   * Create fallback intent when analysis fails
   */
  private createFallbackIntent(message: string): IntentAnalysis {
    return {
      intent: 'general_chat',
      confidence: 0.3,
      reasoning: 'Deep analysis failed, defaulting to conversation',
      suggestedAction: 'Respond conversationally and ask for clarification',
      requiresContext: false,
      suggestedModel: 'orchestrator',
      needsClarification: true,
      clarifyingQuestion: `I'm not sure I understood your request: "${message}". Could you please clarify what you'd like me to do?`,
      usedLLM: true
    }
  }
}

