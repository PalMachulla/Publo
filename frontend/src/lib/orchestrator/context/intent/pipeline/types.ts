/**
 * Intent Pipeline Types
 * 
 * Types for the multi-stage intent analysis pipeline.
 * These types align with the existing IntentAnalysis interface from intentRouter.ts
 * to ensure backward compatibility with action generators.
 */

import type { UserIntent, IntentAnalysis } from '../../intentRouter'
import type { ConversationMessage } from '../../llmIntentAnalyzer'

// ============================================================
// CORE TYPES (aligned with existing IntentAnalysis)
// ============================================================

/**
 * Pipeline's IntentAnalysis - extends existing interface with pipeline-specific fields
 */
export interface PipelineIntentAnalysis extends IntentAnalysis {
  // Pipeline-specific metrics
  pipelineMetrics?: PipelineMetrics
  totalTime?: number
  chainOfThought?: string
}

// ============================================================
// PIPELINE CONTEXT
// ============================================================

/**
 * Context passed through the pipeline stages
 */
export interface PipelineContext {
  // Document state
  documentPanelOpen: boolean
  activeSegment?: {
    id: string
    name: string
    title?: string
    hasContent: boolean
  }
  documentFormat?: string // Novel, Report, Screenplay, etc.
  
  // Canvas state
  canvasNodes?: CanvasNode[]
  canvasContext?: string // Formatted canvas context for LLM
  
  // Conversation state
  conversationHistory?: ConversationMessage[]
  conversationState?: ConversationState
  
  // Enriched context (from Stage 2)
  resolvedReferences?: Record<string, any>
  matchedNodes?: CanvasNode[]
  isFollowUpResponse?: boolean
}

/**
 * Canvas node representation for pipeline
 */
export interface CanvasNode {
  id: string
  label: string
  type: string
  metadata?: any
}

/**
 * Conversation state tracking
 */
export type ConversationState = 
  | { type: 'initial' }
  | { type: 'awaiting_clarification', question: string, options: string[] }
  | { type: 'awaiting_section_choice', availableSections: string[] }
  | { type: 'format_mismatch_detected', originalRequest: string }

// ============================================================
// STAGE 1: TRIAGE
// ============================================================

/**
 * Result from triage stage
 */
export interface TriageResult {
  classification: 'simple' | 'complex' | 'ambiguous'
  confidence: number
  intent: IntentAnalysis | null // If simple and high confidence, this is populated
  needsContextResolution: boolean
  needsReasoning?: boolean // NEW: Does this need deeper reasoning capabilities?
  needsMoreContext?: boolean // NEW: Does this need additional context resolution?
  escalationReason?: string // NEW: Why this was escalated (if applicable)
  wasEscalated?: boolean // NEW: Whether this was escalated to a smarter model
}

// ============================================================
// STAGE 2: CONTEXT RESOLUTION
// ============================================================

/**
 * Resolved references from context resolution
 */
export interface ResolvedReferences {
  [key: string]: any // e.g., "it" -> { type: "node", id: "123", label: "Novel" }
}

// ============================================================
// STAGE 3: DEEP ANALYSIS
// ============================================================

/**
 * Deep analysis result with chain-of-thought
 */
export interface DeepAnalysisResult extends IntentAnalysis {
  chainOfThought?: string
}

// ============================================================
// STAGE 4: VALIDATION
// ============================================================

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  correctedAnalysis: IntentAnalysis
}

// ============================================================
// PIPELINE METRICS
// ============================================================

/**
 * Performance and cost metrics for the pipeline
 */
export interface PipelineMetrics {
  stage1Time: number // Triage time (ms)
  stage2Time: number // Context resolution time (ms)
  stage3Time: number // Deep analysis time (ms)
  stage4Time: number // Validation time (ms)
  totalCost: number // Estimated cost in USD
}

// ============================================================
// PIPELINE CONFIGURATION
// ============================================================

/**
 * Configuration for the intent pipeline
 */
export interface PipelineConfig {
  // Model selection
  fastModel?: string // For triage and context (e.g., 'claude-haiku', 'gpt-4o-mini')
  smartModel?: string // For deep analysis (e.g., 'claude-sonnet', 'gpt-4')
  reasoningModel?: string // For complex reasoning tasks (e.g., 'claude-sonnet', 'gpt-4-turbo')
  
  // Escalation thresholds
  escalationConfidenceThreshold?: number // Default: 0.7 - escalate if confidence below this
  escalationReasoningThreshold?: number // Default: 0.8 - escalate if needsReasoning and confidence below this
  
  // Performance tuning
  enableTriage: boolean
  enableContextResolution: boolean
  enableValidation: boolean
  
  // Confidence thresholds
  highConfidenceThreshold: number // Default: 0.85
  mediumConfidenceThreshold: number // Default: 0.65
  lowConfidenceThreshold: number // Default: 0.45
  
  // Custom prompt modules (optional)
  promptModules?: any[]
  
  // Custom validation rules (optional)
  validationRules?: any[]
}

