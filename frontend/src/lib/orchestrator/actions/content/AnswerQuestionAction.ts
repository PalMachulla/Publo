/**
 * AnswerQuestionAction
 * 
 * Purpose: Handle 'answer_question' intent by building context-aware prompts
 * 
 * Flow:
 * 1. Receives user question from intent
 * 2. Builds enhanced prompt with ALL canvas nodes context
 * 3. Includes node summaries, structure, and content (first 5 sections)
 * 4. Adds RAG content if available
 * 5. Returns generate_content action with enhanced prompt
 * 
 * Dependencies:
 * - canvasContext: Canvas nodes and edges for context building
 * - ragContext: RAG search results (optional)
 * - modelSelection: Selected LLM model
 * 
 * Source: orchestratorEngine.ts lines 691-738
 * 
 * Example Usage:
 * ```typescript
 * const action = new AnswerQuestionAction()
 * const result = await action.generate(intent, request, context, {
 *   ragContext,
 *   modelSelection
 * })
 * ```
 * 
 * @module orchestrator/actions/content
 */

import { BaseAction } from '../base/BaseAction'
import type { IntentAnalysis } from '../../intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../core/contextProvider'

export class AnswerQuestionAction extends BaseAction {
  /**
   * Action type identifier
   */
  get actionType(): OrchestratorAction['type'] {
    return 'generate_content'
  }
  
  /**
   * Generate actions for answer_question intent
   * 
   * Builds a context-aware prompt that includes:
   * - User's original question
   * - All canvas nodes with their context (label, type, summary)
   * - Node structure (if available)
   * - Node content (first 5 sections, truncated to 500 chars each)
   * - RAG content (if available from semantic search)
   * 
   * @param intent - Analyzed intent from LLM
   * @param request - Original request with user message
   * @param context - Canvas context (nodes, edges)
   * @param additionalContext - RAG context and model selection
   * @returns Array with single generate_content action
   */
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext,
    additionalContext?: {
      ragContext?: any
      modelSelection?: any
      availableModels?: any[]
    }
  ): Promise<OrchestratorAction[]> {
    console.log(`🎯 [AnswerQuestionAction] Generating action for question: "${request.message}"`)
    
    // ============================================================
    // STEP 1: Validate required dependencies
    // ============================================================
    
    const modelSelection = additionalContext?.modelSelection
    if (!modelSelection) {
      console.error('❌ [AnswerQuestionAction] Model selection required')
      return [this.error('Model selection required')]
    }
    
    const ragContext = additionalContext?.ragContext
    
    // ============================================================
    // STEP 2: Build enhanced prompt with user question
    // ============================================================
    
    let enhancedPrompt = `User Question: ${request.message}\n\n`
    
    // ============================================================
    // STEP 3: Add context from ALL canvas nodes
    // ============================================================
    
    if (context.connectedNodes.length > 0) {
      enhancedPrompt += `Available Context from Canvas:\n`
      
      context.connectedNodes.forEach(node => {
        // Add node header with label and type
        enhancedPrompt += `\n--- ${node.label} (${node.nodeType}) ---\n`
        enhancedPrompt += `Summary: ${node.summary}\n`
        
        // Add structure if available
        if (node.detailedContext?.structure) {
          enhancedPrompt += `Structure:\n${node.detailedContext.structure}\n`
        }
        
        // Add content if available (first 5 sections, truncated)
        if (node.detailedContext?.contentMap) {
          const contentEntries = Object.entries(node.detailedContext.contentMap)
          if (contentEntries.length > 0) {
            enhancedPrompt += `\nContent (${contentEntries.length} sections):\n`
            
            // Include first 5 sections only
            contentEntries.slice(0, 5).forEach(([sectionId, content]: [string, any]) => {
              if (content && typeof content === 'string' && content.trim()) {
                // Truncate long content to 500 characters
                const truncated = content.length > 500 
                  ? content.substring(0, 500) + '...' 
                  : content
                enhancedPrompt += `\n${truncated}\n`
              }
            })
          }
        }
      })
      
      console.log(`✅ [AnswerQuestionAction] Added context from ${context.connectedNodes.length} node(s)`)
    } else {
      console.log(`ℹ️ [AnswerQuestionAction] No canvas nodes available for context`)
    }
    
    // ============================================================
    // STEP 4: Add RAG content if available
    // ============================================================
    
    if (ragContext?.hasRAG && ragContext.ragContent) {
      enhancedPrompt += `\n\nAdditional Relevant Content (from semantic search):\n${ragContext.ragContent}`
      console.log(`✅ [AnswerQuestionAction] Added RAG content`)
    }
    
    // ============================================================
    // STEP 5: Return generate_content action
    // ============================================================
    
    console.log(`✅ [AnswerQuestionAction] Action generated successfully`)
    
    return [
      this.pending({
        prompt: enhancedPrompt,
        model: modelSelection.modelId,
        isAnswer: true
      })
    ]
  }
}

