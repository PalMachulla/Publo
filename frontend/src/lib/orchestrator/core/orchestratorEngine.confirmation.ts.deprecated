/**
 * OrchestratorEngine Confirmation Handling
 * 
 * Handles user responses to confirmation requests (request_confirmation actions).
 * 
 * Architecture:
 * - These are helper functions that take dependencies as parameters
 * - The main OrchestratorEngine class wraps these with protected methods
 * - This separation allows for better testing and organization
 * 
 * Key Features:
 * - Yes/no confirmation parsing (destructive actions, permissions)
 * - Multiple choice confirmation handling (option selection)
 * - Fuzzy matching for natural language responses
 * - Action building based on original action type
 */

import type { Blackboard } from './blackboard'
import type { OrchestratorRequest, OrchestratorResponse, OrchestratorAction } from './orchestratorEngine.types'
import type { UserIntent } from '../context/intentRouter'
import type { Node, Edge } from 'reactflow'
import type { WorldStateManager } from './worldState'

/**
 * Parse yes/no confirmation response
 * Returns true for confirmed, false for cancelled, null for unclear
 */
export function parseConfirmationResponse(
  response: string | { id: string }
): { confirmed: boolean; cancelled: boolean; unclear: boolean } {
  const lowerResponse = typeof response === 'string' ? response.toLowerCase().trim() : ''
  const confirmed = lowerResponse === 'yes' || lowerResponse === 'y' || 
                   lowerResponse === 'confirm' || lowerResponse === 'ok'
  const cancelled = lowerResponse === 'no' || lowerResponse === 'n' || 
                    lowerResponse === 'cancel'
  const unclear = !confirmed && !cancelled
  
  return { confirmed, cancelled, unclear }
}

/**
 * Find selected option from confirmation response
 * Returns matched option or null if no match found
 */
export function findConfirmationOption(
  response: string | { id: string },
  options: Array<{id: string, label: string, description?: string}>
): {id: string, label: string, description?: string} | null {
  const responseText = typeof response === 'string' ? response : response.id
  
  // Try exact ID match first
  let selectedOption = options.find(opt => opt.id === responseText)
  
  if (!selectedOption && typeof response === 'string') {
    // Try fuzzy matching
    const lowerResponse = response.toLowerCase()
    selectedOption = options.find(opt => 
      lowerResponse.includes(opt.id.toLowerCase()) ||
      lowerResponse.includes(opt.label.toLowerCase()) ||
      (opt.description && lowerResponse.includes(opt.description.toLowerCase()))
    )
  }
  
  return selectedOption || null
}

/**
 * Build action from confirmation selection
 * The orchestrator knows what action to build based on the original action type
 * and the selected option. This keeps the logic in the orchestrator layer.
 */
export function buildActionFromConfirmationHelper(
  actionType: string,
  originalPayload: any,
  selectedOption: {id: string, label: string, description?: string}
): OrchestratorAction {
  if (actionType === 'delete_node') {
    // For delete_node, we need nodeId and nodeName from selected option
    return {
      type: 'delete_node',
      payload: {
        nodeId: selectedOption.id,
        nodeName: selectedOption.label
      },
      status: 'pending'
    }
  } else if (actionType === 'open_and_write') {
    // For open_and_write, we need nodeId from selected option
    // sectionId comes from original payload if it was specified
    return {
      type: 'open_document',
      payload: {
        nodeId: selectedOption.id,
        sectionId: originalPayload.sectionId || null
      },
      status: 'pending'
    }
  } else {
    // Generic fallback: merge selected option ID into original payload
    return {
      type: actionType as OrchestratorAction['type'],
      payload: {
        ...originalPayload,
        selectedOptionId: selectedOption.id
      },
      status: 'pending'
    }
  }
}

/**
 * Continue from a confirmation response
 * 
 * This processes confirmation responses (yes/no or option selection)
 * and returns the action to execute. The orchestrator knows what action
 * needs confirmation, so it also knows what to execute after confirmation.
 * 
 * This is more efficient than having the UI build actions because:
 * 1. Logic stays in orchestrator (maintains architectural separation)
 * 2. Single source of truth for action building
 * 3. Easier to test and maintain
 * 4. Consistent with continueClarification() pattern
 */
export async function continueConfirmationHelper(
  response: string | { id: string },
  confirmationContext: {
    actionId: string
    actionType: string
    actionPayload: any
    confirmationType: 'destructive' | 'permission' | 'info' | 'clarification'
    options?: Array<{id: string, label: string, description?: string}>
  },
  request: {
    canvasNodes?: Node[]
    canvasEdges?: Edge[]
    structureItems?: any[]
    contentMap?: Record<string, string>
    currentStoryStructureNodeId?: string | null
  },
  blackboard: Blackboard,
  worldState: WorldStateManager | undefined,
  buildActionFromConfirmation: (
    actionType: string,
    originalPayload: any,
    selectedOption: {id: string, label: string, description?: string}
  ) => OrchestratorAction
): Promise<OrchestratorResponse> {
  const startTime = Date.now()
  
  // Update WorldState: Processing confirmation response
  worldState?.update(draft => {
    draft.orchestrator.status = 'thinking'
    draft.orchestrator.currentTask = {
      type: 'analyze_intent', // Use existing task type
      startedAt: Date.now(),
      description: 'Processing confirmation response'
    }
  })
  
  // Add user response to blackboard
  const responseText = typeof response === 'string' ? response : response.id
  blackboard.addMessage({
    role: 'user',
    content: responseText,
    type: 'user'
  })
  
  blackboard.addMessage({
    role: 'orchestrator',
    content: `🔍 Processing your confirmation...`,
    type: 'thinking'
  })
  
  // Handle different confirmation types
  if (confirmationContext.confirmationType === 'clarification' && confirmationContext.options) {
    // Multiple choice confirmation - find selected option
    const selectedOption = findConfirmationOption(response, confirmationContext.options)
    
    if (!selectedOption) {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❓ I didn't understand which option you meant. Please try again or click one of the buttons.`,
        type: 'error'
      })
      
      // Update WorldState: Confirmation failed
      worldState?.update(draft => {
        draft.orchestrator.status = 'idle'
        draft.orchestrator.currentTask = {
          type: null,
          startedAt: null
        }
      })
      
      return {
        intent: 'general_chat',
        confidence: 0.3,
        reasoning: 'Failed to interpret confirmation response',
        modelUsed: 'none',
        actions: [],
        canvasChanged: false,
        requiresUserInput: true,
        estimatedCost: 0
      }
    }
    
    // Build action based on original action type and selected option
    // The orchestrator knows what action to build based on the original action
    const action = buildActionFromConfirmation(
      confirmationContext.actionType,
      confirmationContext.actionPayload,
      selectedOption
    )
    
    blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Proceeding with: ${selectedOption.label}`,
      type: 'decision'
    })
    
    // Update WorldState: Confirmation processed
    worldState?.update(draft => {
      draft.orchestrator.status = 'idle'
      draft.orchestrator.currentTask = {
        type: null,
        startedAt: null
      }
    })
    
    return {
      intent: confirmationContext.actionType as UserIntent,
      confidence: 0.95,
      reasoning: `User confirmed: ${selectedOption.label}`,
      modelUsed: 'none',
      actions: [action],
      canvasChanged: false,
      requiresUserInput: false,
      estimatedCost: 0
    }
  } else {
    // Yes/no confirmation (destructive or permission)
    const { confirmed, cancelled, unclear } = parseConfirmationResponse(response)
    
    if (confirmed) {
      // Build action from confirmation context
      const action: OrchestratorAction = {
        type: confirmationContext.actionType as OrchestratorAction['type'],
        payload: confirmationContext.actionPayload,
        status: 'pending'
      }
      
      blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Confirmed. Proceeding...`,
        type: 'decision'
      })
      
      // Update WorldState: Confirmation processed
      worldState?.update(draft => {
        draft.orchestrator.status = 'idle'
        draft.orchestrator.currentTask = {
          type: null,
          startedAt: null
        }
      })
      
      return {
        intent: confirmationContext.actionType as UserIntent,
        confidence: 0.95,
        reasoning: 'User confirmed action',
        modelUsed: 'none',
        actions: [action],
        canvasChanged: false,
        requiresUserInput: false,
        estimatedCost: 0
      }
    } else if (cancelled) {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Action cancelled.`,
        type: 'result'
      })
      
      // Update WorldState: Confirmation cancelled
      worldState?.update(draft => {
        draft.orchestrator.status = 'idle'
        draft.orchestrator.currentTask = {
          type: null,
          startedAt: null
        }
      })
      
      return {
        intent: 'general_chat',
        confidence: 0.95,
        reasoning: 'User cancelled action',
        modelUsed: 'none',
        actions: [],
        canvasChanged: false,
        requiresUserInput: false,
        estimatedCost: 0
      }
    } else {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❓ Please reply "yes" to confirm or "no" to cancel.`,
        type: 'error'
      })
      
      // Update WorldState: Unclear response
      worldState?.update(draft => {
        draft.orchestrator.status = 'idle'
        draft.orchestrator.currentTask = {
          type: null,
          startedAt: null
        }
      })
      
      return {
        intent: 'general_chat',
        confidence: 0.3,
        reasoning: 'Unclear confirmation response',
        modelUsed: 'none',
        actions: [],
        canvasChanged: false,
        requiresUserInput: true,
        estimatedCost: 0
      }
    }
  }
}

