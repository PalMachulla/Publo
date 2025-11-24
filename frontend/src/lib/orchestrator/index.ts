/**
 * Orchestrator - Public API
 * 
 * Clean, single entry point for all orchestrator functionality.
 * Inspired by Agentic Flow's clean API design.
 * 
 * Usage:
 * ```typescript
 * import { createOrchestrator } from '@/lib/orchestrator'
 * 
 * const orchestrator = createOrchestrator({ userId: 'user-123' })
 * const response = await orchestrator.orchestrate({
 *   message: 'Tell me about the screenplay',
 *   canvasNodes: nodes,
 *   canvasEdges: edges
 * })
 * ```
 */

// Core exports
export {
  OrchestratorEngine,
  getOrchestrator,
  createOrchestrator,
  type OrchestratorConfig,
  type OrchestratorRequest,
  type OrchestratorResponse,
  type OrchestratorAction
} from './core/orchestratorEngine'

export {
  Blackboard,
  getBlackboard,
  createBlackboard,
  type BlackboardState,
  type ConversationMessage,
  type CanvasState,
  type DocumentState,
  type OrchestratorContext,
  type PatternMemory
} from './core/blackboard'

export {
  buildCanvasContext,
  resolveNode,
  formatCanvasContextForLLM,
  type NodeContext,
  type CanvasContext
} from './core/contextProvider'

export {
  selectModel,
  assessTaskComplexity,
  getModelInfo,
  supportsCapability,
  estimateCost,
  type ModelPriority,
  type TaskComplexity,
  type ModelCapability,
  type ModelSelection
} from './core/modelRouter'

// Intent system exports (for advanced usage)
export {
  analyzeIntent,
  validateIntent,
  explainIntent,
  type UserIntent,
  type IntentAnalysis,
  type IntentContext
} from './intentRouter'

// Capabilities exports (for direct access)
export {
  enhanceContextWithRAG,
  buildRAGEnhancedPrompt,
  type RAGEnhancedContext
} from './ragIntegration'

// Temporal memory exports
export {
  TemporalMemory,
  createTemporalMemory,
  type EventDelta,
  type TimelineSnapshot,
  type RouterScore
} from './temporalMemory'

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Quick start: Create and orchestrate in one call
 */
export async function orchestrate(
  userId: string,
  request: import('./core/orchestratorEngine').OrchestratorRequest,
  config?: Partial<import('./core/orchestratorEngine').OrchestratorConfig>
) {
  const orchestrator = getOrchestrator(userId, config)
  return await orchestrator.orchestrate(request)
}

/**
 * Get conversation history for a user
 */
export function getConversationHistory(userId: string, count: number = 10) {
  const blackboard = getBlackboard(userId)
  return blackboard.getRecentMessages(count)
}

/**
 * Clear conversation history for a user
 */
export function clearConversation(userId: string) {
  const orchestrator = getOrchestrator(userId)
  orchestrator.reset()
}

/**
 * Learn from a successful pattern
 */
export async function learnPattern(
  userId: string,
  pattern: string,
  action: string,
  namespace: string = 'general'
) {
  const blackboard = getBlackboard(userId)
  await blackboard.storePattern(pattern, action, namespace)
}

/**
 * Query learned patterns
 */
export async function queryPatterns(
  userId: string,
  query: string,
  namespace?: string
) {
  const blackboard = getBlackboard(userId)
  return await blackboard.queryPatterns(query, namespace)
}

