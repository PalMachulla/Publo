/**
 * OrchestratorEngine Action Processing
 * 
 * Handles action generation, dependency processing, and direct execution.
 * 
 * Architecture:
 * - These are helper functions that take dependencies as parameters
 * - The main OrchestratorEngine class wraps these with protected methods
 * - This separation allows for better testing and organization
 * 
 * Key Features:
 * - Modular action generation via action generators
 * - Dependency resolution and topological sorting
 * - Automatic execution of auto-executable actions
 * - Direct action execution for simple actions
 */

import type { OrchestratorRequest, OrchestratorAction } from './orchestratorEngine.types'
import type { IntentAnalysis } from '../context/intentRouter'
import type { CanvasContext } from '../context/contextProvider'
import type { TieredModel } from './modelRouter'
import type { BaseAction } from '../actions/base/BaseAction'

/**
 * Generate actions based on intent analysis
 * Uses modular action generators when available, falls back to default handling
 */
export async function generateActionsHelper(
  intent: IntentAnalysis,
  request: OrchestratorRequest,
  canvasContext: CanvasContext,
  ragContext: any,
  modelSelection: any,
  validatedFixedModelId: string | null,
  availableModels: TieredModel[] | undefined,
  actionGenerators: Map<string, BaseAction>
): Promise<OrchestratorAction[]> {
  const actions: OrchestratorAction[] = []
  
  // PHASE 1 REFACTORING: Try modular action generator first
  const generator = actionGenerators.get(intent.intent)
  if (generator) {
    console.log(`✅ [Orchestrator] Using modular action generator for: ${intent.intent}`)
    return generator.generate(intent, request, canvasContext, {
      ragContext,
      modelSelection,
      availableModels
    })
  }
  
  // FALLBACK: Handle any intents not covered by modular actions
  // Note: All major intents (answer_question, write_content, create_structure, etc.)
  // are now handled by modular action generators above.
  // This fallback only handles general_chat and unknown intents.
  switch (intent.intent) {
    case 'general_chat':
    default: {
      // Similar to answer_question but more conversational
      actions.push({
        type: 'message',
        payload: {
          content: `Let me help you with that...`,
          type: 'thinking'
        },
        status: 'pending'
      })
      break
    }
  }
  
  // 🔍 DEBUG: Log final actions before returning
  console.log('🔍 [generateActions] Returning actions:', {
    count: actions.length,
    types: actions.map(a => a.type),
    details: actions.map(a => ({
      type: a.type,
      sectionId: a.payload?.sectionId,
      sectionName: a.payload?.sectionName
    }))
  })
  
  return actions
}

/**
 * Execute a single action directly (used by action sequencer)
 * 
 * This handles actions that can be executed automatically without UI interaction.
 * Currently supports: select_section, generate_content (via tools), message
 * 
 * Note: generate_content execution is actually handled by MultiAgentOrchestrator,
 * so this method just marks it for agent execution.
 */
export async function executeActionDirectlyHelper(
  action: OrchestratorAction,
  request: OrchestratorRequest,
  onMessage?: (content: string, role?: 'user' | 'orchestrator', type?: 'user' | 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'progress' | 'model') => void
): Promise<void> {
  switch (action.type) {
    case 'select_section':
      // Navigation is handled by UI, but we mark it as complete
      // The actual navigation happens when UI receives the action
      console.log(`📍 [ActionSequencer] Section selection: ${action.payload?.sectionId}`)
      break
      
    case 'generate_content':
      // ✅ FIX: This should never be reached - generate_content actions are excluded
      // from auto-execution in processActionDependencies and sent to MultiAgentOrchestrator
      // If we reach here, it's a bug in the logic above
      console.warn(`⚠️ [ActionSequencer] generate_content should not be executed here - this indicates a bug`)
      console.log(`✍️ [ActionSequencer] Content generation will be handled by agent system`)
      break
      
    case 'message':
      // Display message to user
      if (onMessage) {
        onMessage(
          action.payload?.content || '',
          'orchestrator',
          action.payload?.type || 'result'
        )
      }
      break
      
    default:
      console.log(`ℹ️ [ActionSequencer] Action ${action.type} requires UI handling`)
      // Other actions require UI interaction
  }
}

/**
 * Process action dependencies and automatically execute actions in the correct order
 * 
 * This method handles:
 * 1. Topological sorting of actions based on dependencies
 * 2. Automatic execution of actions with autoExecute: true
 * 3. Returning only actions that require user input to the UI
 * 
 * @param actions - Array of actions to process
 * @param request - Original orchestrator request (for context)
 * @param executeActionDirectly - Function to execute a single action
 * @returns Object with executedActions (auto-executed) and remainingActions (for UI)
 */
export async function processActionDependenciesHelper(
  actions: OrchestratorAction[],
  request: OrchestratorRequest,
  executeActionDirectly: (action: OrchestratorAction, request: OrchestratorRequest) => Promise<void>
): Promise<{
  executedActions: OrchestratorAction[]
  remainingActions: OrchestratorAction[]
}> {
  const executedActions: OrchestratorAction[] = []
  const remainingActions: OrchestratorAction[] = []
  const completedActionTypes = new Set<string>()
  
  // Separate actions into auto-executable and UI-required
  const autoExecutableActions: OrchestratorAction[] = []
  const uiRequiredActions: OrchestratorAction[] = []
  
  for (const action of actions) {
    // Actions that require user input always go to UI
    if (action.requiresUserInput === true) {
      uiRequiredActions.push(action)
      continue
    }
    
    // ✅ FIX: generate_content actions should NOT be auto-executed by base orchestrator
    // They need to be handled by MultiAgentOrchestrator's executeActionsWithAgents method
    // Even if they have autoExecute: true, they should be passed to MultiAgentOrchestrator
    if (action.type === 'generate_content') {
      uiRequiredActions.push(action) // Send to MultiAgentOrchestrator via remainingActions
      continue
    }
    
    // Actions with autoExecute: true and no dependencies can execute immediately
    if (action.autoExecute === true && (!action.dependsOn || action.dependsOn.length === 0)) {
      autoExecutableActions.push(action)
      continue
    }
    
    // Actions with dependencies need to wait
    if (action.autoExecute === true && action.dependsOn && action.dependsOn.length > 0) {
      autoExecutableActions.push(action)
      continue
    }
    
    // Default: send to UI
    uiRequiredActions.push(action)
  }
  
  // Execute actions in dependency order
  // Build dependency graph
  const actionMap = new Map<string, OrchestratorAction[]>()
  for (const action of autoExecutableActions) {
    const key = action.type
    if (!actionMap.has(key)) {
      actionMap.set(key, [])
    }
    actionMap.get(key)!.push(action)
  }
  
  // Execute actions topologically (dependencies first)
  const executeQueue = [...autoExecutableActions]
  const executed = new Set<string>()
  
  while (executeQueue.length > 0) {
    let progressMade = false
    
    for (let i = executeQueue.length - 1; i >= 0; i--) {
      const action = executeQueue[i]
      const actionKey = `${action.type}_${i}`
      
      // Check if dependencies are satisfied
      const dependenciesSatisfied = !action.dependsOn || action.dependsOn.every(
        depType => completedActionTypes.has(depType)
      )
      
      if (dependenciesSatisfied && !executed.has(actionKey)) {
        // Execute this action
        try {
          await executeActionDirectly(action, request)
          executed.add(actionKey)
          completedActionTypes.add(action.type)
          executedActions.push({ ...action, status: 'completed' })
          executeQueue.splice(i, 1)
          progressMade = true
          
          console.log(`✅ [ActionSequencer] Executed: ${action.type}`)
        } catch (error) {
          console.error(`❌ [ActionSequencer] Failed to execute ${action.type}:`, error)
          executed.add(actionKey)
          completedActionTypes.add(action.type)
          executedActions.push({ ...action, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
          executeQueue.splice(i, 1)
          progressMade = true
        }
      }
    }
    
    // Prevent infinite loops
    if (!progressMade) {
      console.warn('⚠️ [ActionSequencer] Circular dependency or missing dependency detected')
      // Move remaining actions to UI
      for (const action of executeQueue) {
        uiRequiredActions.push(action)
      }
      break
    }
  }
  
  // All remaining actions go to UI
  remainingActions.push(...uiRequiredActions)
  
  return { executedActions, remainingActions }
}

