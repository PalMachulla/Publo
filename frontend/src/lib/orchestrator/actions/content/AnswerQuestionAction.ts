/**
 * AnswerQuestionAction
 * 
 * Purpose: Handle 'answer_question' intent by building context-aware prompts
 * 
 * Flow:
 * 1. Receives user question from intent
 * 2. Builds enhanced prompt with ALL canvas nodes context
 * 3. Includes node summaries, structure, and content:
 *    - If RAG/embeddings available: Uses semantic search (relevant chunks only)
 *    - If RAG unavailable: Includes ALL content from text (entire novel, not truncated)
 * 4. Adds RAG content if available (from semantic search)
 * 5. Returns generate_content action with enhanced prompt (isAnswer: true)
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
import type { IntentAnalysis } from '../../context/intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../context/contextProvider'

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
   * - Node content:
   *   * If embeddings available: Uses semantic search (relevant chunks only)
   *   * If embeddings unavailable: Includes ALL content from text (entire novel, not truncated)
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
        
        // Add content if available
        if (node.detailedContext?.contentMap) {
          const contentEntries = Object.entries(node.detailedContext.contentMap)
          if (contentEntries.length > 0) {
            // ✅ FIX: Check if RAG is available
            // If RAG is available, we'll use semantic search results (added in STEP 4)
            // If RAG is NOT available, include ALL content from text (not truncated)
            const useRAG = ragContext?.hasRAG === true
            
            if (!useRAG) {
              // No embeddings → include ALL content from text (entire novel)
              enhancedPrompt += `\nFull Content (${contentEntries.length} sections - embeddings not available, using full text):\n`
              
              contentEntries.forEach(([sectionId, content]: [string, any]) => {
                if (content && typeof content === 'string' && content.trim()) {
                  // ✅ Include full content (not truncated) when RAG unavailable
                  enhancedPrompt += `\n--- Section: ${sectionId} ---\n${content}\n`
                }
              })
              
              console.log(`✅ [AnswerQuestionAction] Added full content from ${contentEntries.length} section(s) (RAG unavailable)`)
            } else {
              // RAG is available → only include summary (RAG content will be added in STEP 4)
              enhancedPrompt += `\nContent Summary: ${contentEntries.length} sections available (using semantic search for relevant content)\n`
              console.log(`✅ [AnswerQuestionAction] RAG available - will use semantic search (${contentEntries.length} sections in document)`)
            }
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
      enhancedPrompt += `\n\n🎯 Relevant Content (from semantic search):\n${ragContext.ragContent}`
      console.log(`✅ [AnswerQuestionAction] Added RAG content from embeddings`)
    } else if (ragContext?.fallbackReason) {
      // Log why RAG wasn't used (for debugging)
      console.log(`ℹ️ [AnswerQuestionAction] RAG unavailable: ${ragContext.fallbackReason}`)
      // Note: Full content was already included in STEP 3 above
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

