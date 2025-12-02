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
  getMultiAgentOrchestrator, // PHASE 3: Multi-agent support
  createOrchestrator,
  type OrchestratorConfig,
  type OrchestratorRequest,
  type OrchestratorResponse,
  type OrchestratorAction
} from './core/orchestratorEngine'

// ✅ FIX: Import functions for local use, then re-export
import { getBlackboard as _getBlackboard } from './core/blackboard'
import { getMultiAgentOrchestrator as _getMultiAgentOrchestrator } from './core/orchestratorEngine'

export {
  Blackboard,
  getBlackboard,
  createBlackboard,
  type BlackboardState,
  type ConversationMessage,
  // NOTE: CanvasState and DocumentState removed - WorldState is now the single source of truth
  type OrchestratorContext,
  type PatternMemory
} from './core/blackboard'

export {
  buildCanvasContext,
  resolveNode,
  formatCanvasContextForLLM,
  type NodeContext,
  type CanvasContext
} from './context/contextProvider'

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
} from './context/intentRouter'

// Capabilities exports (for direct access)
export {
  enhanceContextWithRAG,
  buildRAGEnhancedPrompt,
  type RAGEnhancedContext
} from './context/ragIntegration'

// Temporal memory exports
export {
  TemporalMemory,
  createTemporalMemory,
  type EventDelta,
  type TimelineSnapshot,
  type RouterScore
} from './context/temporalMemory'

// Tool system exports (PHASE 2)
export {
  createDefaultToolRegistry,
  type Tool,
  type ToolRegistry,
  type ToolContext,
  type ToolResult
} from './tools'

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Quick start: Create and orchestrate in one call
 * @deprecated Consider using MultiAgentOrchestrator directly for Phase 3 multi-agent features
 */
export async function orchestrate(
  userId: string,
  request: import('./core/orchestratorEngine').OrchestratorRequest,
  config?: Partial<import('./core/orchestratorEngine').OrchestratorConfig>
) {
  // ✅ FIX: Import and instantiate MultiAgentOrchestrator
  const { MultiAgentOrchestrator } = await import('./agents/MultiAgentOrchestrator')
  const orchestrator = new MultiAgentOrchestrator({ userId, ...config })
  return await orchestrator.orchestrate(request)
}

/**
 * Get conversation history for a user
 */
export function getConversationHistory(userId: string, count: number = 10) {
  const blackboard = _getBlackboard(userId) // Use imported version
  return blackboard.getRecentMessages(count)
}

/**
 * Clear conversation history for a user
 */
export function clearConversation(userId: string) {
  const orchestrator = _getMultiAgentOrchestrator(userId) // Use imported version
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
  const blackboard = _getBlackboard(userId) // Use imported version
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
  const blackboard = _getBlackboard(userId) // Use imported version
  return await blackboard.queryPatterns(query, namespace)
}

