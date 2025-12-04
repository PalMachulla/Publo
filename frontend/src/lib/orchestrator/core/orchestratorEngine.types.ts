/**
 * Orchestrator Engine - Type Definitions
 * 
 * PHASE 1: Extracted type definitions from orchestratorEngine.ts
 * for better organization and maintainability.
 */

import type { ModelPriority } from './modelRouter'
import type { TieredModel } from './modelRouter'
import type { UserIntent } from '../context/intentRouter'
import type { ToolRegistry } from '../tools'
import { Node, Edge } from 'reactflow'

// ============================================================
// CONFIGURATION
// ============================================================

export interface OrchestratorConfig {
  userId: string
  modelPriority?: ModelPriority
  enableRAG?: boolean
  enablePatternLearning?: boolean
  maxConversationDepth?: number
  // PHASE 2: Tool system
  toolRegistry?: ToolRegistry
  // PHASE 3: Real-time UI callback for immediate message display
  // ✅ NEW: Added metadata parameter for structured content support
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
// REQUEST & RESPONSE
// ============================================================

export interface OrchestratorRequest {
  message: string
  canvasNodes: Node[]
  canvasEdges: Edge[]
  activeContext?: {
    id: string
    name: string
  }
  isDocumentViewOpen?: boolean
  documentFormat?: string
  structureItems?: any[]
  contentMap?: Record<string, string>
  currentStoryStructureNodeId?: string | null
  // Model selection preferences
  modelMode?: 'automatic' | 'fixed'
  fixedModeStrategy?: 'consistent' | 'loose'
  fixedModelId?: string | null
  // Available providers (from user's API keys)
  availableProviders?: string[]
  // PHASE 1.2: Dynamic model availability
  // Models actually available to the user (from /api/models/available)
  // If provided, orchestrator will use these instead of filtering MODEL_TIERS
  availableModels?: TieredModel[]
  // Structure generation (for create_structure intent)
  userKeyId?: string // API key ID for structure generation
  // Clarification response context (when user is responding to a request_clarification action)
  clarificationContext?: {
    originalAction: string // 'create_structure', 'open_and_write', 'delete_node'
    question: string // The question that was asked
    options: Array<{id: string, label: string, description: string}>
    payload: any // Original action payload (documentFormat, userMessage, existingDocs, etc.)
  }
  // ✅ FIX: Authenticated Supabase client (to avoid RLS issues in agents)
  supabaseClient?: any
}

export interface OrchestratorResponse {
  intent: UserIntent
  confidence: number
  reasoning: string
  modelUsed: string
  actions: OrchestratorAction[]
  canvasChanged: boolean
  requiresUserInput: boolean
  estimatedCost: number
  thinkingSteps?: Array<{ content: string; type: string }> // NEW: Detailed thinking from blackboard
}

// ============================================================
// ACTIONS
// ============================================================

export interface OrchestratorAction {
  type: 'message' | 'open_document' | 'select_section' | 'generate_content' | 'modify_structure' | 'delete_node' | 'request_clarification' | 'generate_structure'
  payload: any
  status: 'pending' | 'executing' | 'completed' | 'failed'
  error?: string
  /**
   * Action dependencies and execution metadata
   * 
   * - dependsOn: Array of action types that must complete before this action can execute
   * - autoExecute: If true, orchestrator will automatically execute this action after dependencies are met
   * - requiresUserInput: If true, action requires user confirmation/interaction before execution
   * 
   * Example: generate_content depends on select_section and should auto-execute:
   *   { dependsOn: ['select_section'], autoExecute: true, requiresUserInput: false }
   */
  dependsOn?: string[] // Action types that must complete first
  autoExecute?: boolean // Should orchestrator execute automatically after dependencies?
  requiresUserInput?: boolean // Does this action need user confirmation?
}

// ============================================================
// STRUCTURE GENERATION
// ============================================================

// Structure generation types (for create_structure intent)
export interface StructurePlan {
  reasoning: string
  structure: Array<{
    id: string
    level: number
    name: string
    parentId: string | null
    wordCount: number
    summary: string
  }>
  tasks: Array<{
    id: string
    type: string
    sectionId: string
    description: string
  }>
  metadata?: {
    totalWordCount: number
    estimatedTime: string
    recommendedModels: string[]
  }
}

