/**
 * Intent Pipeline Configuration
 * 
 * Default configuration for the intent pipeline.
 */

import type { PipelineConfig } from './types'

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  // Model selection (defaults - will be dynamically selected from user's available models via ModelRouterAdapter)
  // The ModelRouterAdapter selects appropriate models from availableModels based on 'fast'/'smart' requests
  // If no availableModels provided, the API endpoint will use the user's configured orchestrator_model_id
  fastModel: undefined, // Auto-selected from availableModels (prefers Haiku, GPT-4o-mini, etc.)
  smartModel: undefined, // Auto-selected from availableModels (prefers Sonnet, GPT-4, etc.)
  reasoningModel: undefined, // Auto-selected from availableModels (prefers reasoning-capable models)
  
  // Performance tuning
  enableTriage: true,
  enableContextResolution: true,
  enableValidation: true,
  
  // Confidence thresholds
  highConfidenceThreshold: 0.85,
  mediumConfidenceThreshold: 0.65,
  lowConfidenceThreshold: 0.45,
  
  // Escalation thresholds
  escalationConfidenceThreshold: 0.7, // Escalate if confidence below this
  escalationReasoningThreshold: 0.8, // Escalate if needsReasoning and confidence below this
  
  // No custom modules by default
  promptModules: [],
  validationRules: []
}

