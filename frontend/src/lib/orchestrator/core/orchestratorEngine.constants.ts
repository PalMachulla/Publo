/**
 * Orchestrator Engine - Constants
 * 
 * PHASE 2: Extracted constants from orchestratorEngine.ts
 * for better maintainability and configuration.
 */

// ============================================================
// STRUCTURE GENERATION CONFIG
// ============================================================

export const STRUCTURE_GENERATION_CONFIG = {
  MAX_COMPLETION_TOKENS: 2000, // Reduced from 4000 for faster generation
  TIMEOUT_MS: 60000, // 60 seconds for structure generation (complex task)
  HEARTBEAT_INTERVAL_MS: 5000, // Show "still waiting..." every 5 seconds
  MAX_RETRIES: 3 // Maximum number of model retries for structure generation
} as const

// ============================================================
// CANVAS CHANGE DETECTION
// ============================================================

export const CANVAS_CHANGE_WINDOW_MS = 5000 // Check for canvas changes in last 5 seconds

// ============================================================
// CLARIFICATION MATCH STRATEGIES
// ============================================================

export const CLARIFICATION_MATCH_STRATEGIES = {
  EXACT_LABEL: 'exact_label',
  NUMBER: 'number',
  PARTIAL_LABEL: 'partial_label',
  LLM_FALLBACK: 'llm_fallback'
} as const

// ============================================================
// CONFIRMATION RESPONSE PATTERNS
// ============================================================

export const CONFIRMATION_PATTERNS = {
  CONFIRMED: ['yes', 'y', 'confirm', 'ok'],
  CANCELLED: ['no', 'n', 'cancel']
} as const

