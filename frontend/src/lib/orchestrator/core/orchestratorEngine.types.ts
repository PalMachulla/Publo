/**
 * Orchestrator Engine - Type Definitions
 * 
 * =============================================================================
 * POST-PYTHON MIGRATION
 * =============================================================================
 * 
 * These types are kept for frontend compatibility. The actual orchestration
 * logic is now in the Python backend. These types match the API contract
 * between frontend and Python backend.
 * 
 * @see Python backend: orchestrator/models.py for equivalent Python types
 * @see backendClient.ts for how these are used in API calls
 */

import { Node, Edge } from 'reactflow'

// ============================================================
// CONFIGURATION
// ============================================================

export interface OrchestratorConfig {
  userId: string
  modelPriority?: 'quality' | 'speed' | 'cost'
  enableRAG?: boolean
  enablePatternLearning?: boolean
  maxConversationDepth?: number
  
  /**
   * Real-time UI callback for immediate message display
   * Used by frontend to show messages as they arrive
   */
  onMessage?: (
    content: string, 
    role?: 'user' | 'orchestrator', 
    type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress',
    metadata?: {
      structured?: boolean
      format?: 'progress_list' | 'simple_list' | 'steps'
    }
  ) => void
}

// ============================================================
// REQUEST / RESPONSE
// ============================================================

export interface OrchestratorRequest {
  /** User's message */
  message: string
  
  /** Current canvas nodes */
  canvasNodes?: Node[]
  
  /** Current canvas edges */
  canvasEdges?: Edge[]
  
  /** Currently selected node ID */
  selectedNodeId?: string | null
  
  /** Current story structure node ID (if in document view) */
  currentStoryStructureNodeId?: string | null
  
  /** Whether document panel is open */
  isDocumentViewOpen?: boolean
  
  /** Active document context */
  activeContext?: {
    type: 'section' | 'segment'
    id: string
    name: string
  } | null
  
  /** Story ID for persistence */
  storyId?: string
  
  /** Clarification response (when answering template selection, etc.) */
  clarificationResponse?: {
    optionId: string
    originalAction: string
  }
}

export interface OrchestratorResponse {
  /** Whether the request was successful */
  success: boolean
  
  /** Human-readable message to display */
  message: string
  
  /** Actions to execute */
  actions: OrchestratorAction[]
  
  /** Detected intent (for debugging/display) */
  intent?: string
  
  /** Confidence score 0-1 */
  confidence?: number
  
  /** Options for user to choose from (clarification UI) */
  options?: ClarificationOption[]
  
  /** Requires clarification before proceeding */
  requiresClarification?: boolean
  
  /** Error details if success=false */
  error?: string
}

// ============================================================
// ACTIONS
// ============================================================

export interface OrchestratorAction {
  /** Action type identifier */
  type: 'message' | 'create_structure' | 'write_content' | 'navigate' | 'open_document' | 'delete_node' | 'clarify'
  
  /** Action parameters */
  payload: Record<string, unknown>
  
  /** Human-readable description */
  description?: string
  
  /** Whether action completed successfully */
  success?: boolean
  
  /** Error message if action failed */
  error?: string
}

// ============================================================
// CLARIFICATION
// ============================================================

export interface ClarificationOption {
  id: string
  label: string
  description?: string
  icon?: string
}

// ============================================================
// INTENT (matches Python IntentAnalysis)
// ============================================================

export interface UserIntent {
  /** Primary intent category */
  intent: string
  
  /** Confidence 0-1 */
  confidence: number
  
  /** Extracted entities */
  entities?: Record<string, string | string[]>
  
  /** Detected document format */
  documentFormat?: string
  
  /** Detected template */
  template?: string
  
  /** Whether requires template selection */
  requiresTemplateSelection?: boolean
}

// ============================================================
// LEGACY TYPES (kept for backwards compatibility)
// ============================================================

/** @deprecated Use OrchestratorConfig instead */
export type EngineConfig = OrchestratorConfig

/** @deprecated Use OrchestratorRequest instead */
export type EngineRequest = OrchestratorRequest

/** @deprecated Use OrchestratorResponse instead */
export type EngineResponse = OrchestratorResponse