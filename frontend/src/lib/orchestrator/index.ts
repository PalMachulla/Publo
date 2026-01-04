/**
 * Orchestrator - Public API
 * 
 * =============================================================================
 * POST-PYTHON MIGRATION
 * =============================================================================
 * 
 * Most orchestration logic has moved to the Python backend (FastAPI + LangGraph).
 * This index now only exports:
 * - Backend client (for calling Python API)
 * - State client (for session persistence)
 * - Blackboard/WorldState (for frontend state management)
 * - UI components (OrchestratorPanel)
 * 
 * The following have been DEPRECATED (moved to Python):
 * - OrchestratorEngine → Python LangGraph workflow
 * - IntentRouter/IntentPipeline → Python intent analysis
 * - Actions/Tools → Python action execution
 * - Multi-agent orchestration → Python agents
 * 
 * @see /api/orchestrator/orchestrate/route.ts for the API endpoint
 * @see Python backend: orchestrator/graph/nodes.py
 */

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND CLIENT - Calls Python orchestrator API
// ─────────────────────────────────────────────────────────────────────────────
export {
  orchestrate as orchestrateViaBackend,
  type OrchestrateRequest,
  type OrchestrateResponse,
  type OrchestratorAction as BackendAction
} from './backendClient'

// ─────────────────────────────────────────────────────────────────────────────
// STATE CLIENT - Session persistence with Supabase
// ─────────────────────────────────────────────────────────────────────────────
export {
  getOrCreateSession,
  addMessage as addStateMessage,
  loadMessages,
  type Session as OrchestratorSession,
  type Message as OrchestratorMessage
} from './stateClient'

// ─────────────────────────────────────────────────────────────────────────────
// BLACKBOARD - Frontend conversation state
// ─────────────────────────────────────────────────────────────────────────────
export {
  Blackboard,
  getBlackboard,
  createBlackboard,
  type BlackboardState,
  type ConversationMessage,
  type OrchestratorContext,
  type PatternMemory
} from './core/blackboard'

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// WORLD STATE - DEPRECATED 2024-12-11 (moved to ./core/worldState.ts.deprecated)
// Deep agent architecture uses SSE streaming, not frontend WorldState
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TYPES - Keep types that are still referenced
// ─────────────────────────────────────────────────────────────────────────────
export type {
  OrchestratorConfig,
  OrchestratorRequest,
  OrchestratorResponse,
  OrchestratorAction
} from './core/orchestratorEngine.types'

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────
export { useOrchestratorSession } from './hooks/useOrchestratorSession'

// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED - Tools moved to Python backend
// ─────────────────────────────────────────────────────────────────────────────
// The tool system (ToolRegistry, BaseTool, etc.) has been deprecated.
// Python backend now handles all tool execution via LangGraph.