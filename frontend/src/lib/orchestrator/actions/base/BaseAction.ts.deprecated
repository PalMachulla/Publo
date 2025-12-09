/**
 * Base class for all action generators
 * 
 * Responsibilities:
 * - Define common interface for action generation
 * - Provide utility methods for success/error responses
 * - Enforce consistent structure across all actions
 * 
 * Usage:
 * ```typescript
 * export class MyAction extends BaseAction {
 *   get actionType() { return 'my_action_type' }
 *   async generate(intent, request, context) {
 *     // Implementation
 *     return [this.success(payload)]
 *   }
 * }
 * ```
 * 
 * @module orchestrator/actions/base
 */

import type { IntentAnalysis } from '../../context/intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../context/contextProvider'

export abstract class BaseAction {
  /**
   * Generate actions based on intent
   * 
   * This is the main method that each action must implement.
   * It receives the analyzed intent, original request, and canvas context,
   * and returns an array of actions to execute.
   * 
   * @param intent - Analyzed user intent from LLM
   * @param request - Original orchestrator request with message and state
   * @param context - Canvas context (nodes, edges, selected items)
   * @param additionalContext - Optional additional context (RAG, model selection, etc.)
   * @returns Array of actions to execute
   */
  abstract generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext,
    additionalContext?: {
      ragContext?: any
      modelSelection?: any
      availableModels?: any[]
    }
  ): Promise<OrchestratorAction[]>
  
  /**
   * Action type identifier
   * 
   * This should match the action type used in the orchestrator response.
   * Examples: 'generate_content', 'generate_structure', 'open_document'
   */
  abstract get actionType(): OrchestratorAction['type']
  
  /**
   * Create a success action
   * 
   * Helper method to create an action with 'completed' status.
   * Use this when the action can be executed immediately.
   * 
   * @param payload - Action payload data
   * @returns OrchestratorAction with completed status
   */
  protected success(payload: any): OrchestratorAction {
    return {
      type: this.actionType,
      status: 'completed',
      payload
    }
  }
  
  /**
   * Create a pending action
   * 
   * Helper method to create an action with 'pending' status.
   * Use this when the action needs to be executed later (e.g., by agents).
   * 
   * @param payload - Action payload data
   * @returns OrchestratorAction with pending status
   */
  protected pending(payload: any): OrchestratorAction {
    return {
      type: this.actionType,
      status: 'pending',
      payload
    }
  }
  
  /**
   * Create an error action
   * 
   * Helper method to create an action with 'failed' status.
   * Use this when validation fails or an error occurs.
   * 
   * @param message - Error message to display
   * @returns OrchestratorAction with failed status
   */
  protected error(message: string): OrchestratorAction {
    return {
      type: this.actionType,
      status: 'failed',
      error: message,
      payload: { error: message }
    }
  }
  
  /**
   * Create a message action
   * 
   * Helper method to create a message action for user communication.
   * Use this for clarifications, confirmations, or informational messages.
   * 
   * @param content - Message content
   * @param type - Message type (result, error, etc.)
   * @returns OrchestratorAction with message
   */
  protected message(content: string, type: 'result' | 'error' | 'info' = 'result'): OrchestratorAction {
    return {
      type: 'message',
      status: 'completed',
      payload: {
        type,
        content
      }
    }
  }
}

