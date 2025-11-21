/**
 * Types for BYOAPI (Bring Your Own API) feature
 */

export type LLMProvider = 'groq' | 'openai' | 'anthropic' | 'google'

// Alias for convenience
export type Provider = LLMProvider

export type KeyValidationStatus = 'pending' | 'valid' | 'invalid' | 'expired'

/**
 * User's stored API key (as returned from database)
 * Never includes the actual decrypted key in client responses
 */
export interface UserAPIKey {
  id: string
  user_id: string
  provider: LLMProvider
  nickname: string | null
  is_active: boolean
  last_validated_at: string | null
  validation_status: KeyValidationStatus
  models_cache: NormalizedModel[] | null
  models_cached_at: string | null
  model_preferences?: Record<string, boolean> | null  // model_id -> enabled (requires migration)
  orchestrator_model_id?: string | null  // Preferred orchestrator model (null = auto-select)
  writer_model_ids?: string[] | null  // Enabled writer models (empty = single-model mode)
  usage_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Request body for adding a new API key
 */
export interface AddAPIKeyRequest {
  provider: LLMProvider
  apiKey: string // Plaintext, will be encrypted server-side
  nickname?: string
}

/**
 * Request body for updating an API key
 */
export interface UpdateAPIKeyRequest {
  nickname?: string
  is_active?: boolean
}

/**
 * Response from API key validation
 */
export interface ValidateKeyResponse {
  success: boolean
  valid: boolean
  error?: string
  models?: NormalizedModel[]
  provider_info?: {
    name: string
    models_count: number
    rate_limit?: string
  }
}

/**
 * Normalized model format across all providers
 */
export interface NormalizedModel {
  id: string
  name: string
  provider: LLMProvider
  context_window: number
  max_output_tokens: number | null
  input_price_per_1m: number | null
  output_price_per_1m: number | null
  speed_tokens_per_sec: number | null
  category: 'production' | 'preview' | 'deprecated'
  supports_system_prompt: boolean
  supports_chat: boolean  // true = v1/chat/completions, false = v1/completions only
  description?: string
  user_enabled?: boolean  // User preference for showing this model
}

/**
 * Generation request parameters
 */
export interface GenerateRequest {
  model: string
  provider: LLMProvider
  system_prompt: string
  user_prompt: string
  max_tokens: number
  user_key_id?: string // If provided, use user's key; otherwise use Publo's default
  temperature?: number
  top_p?: number
  mode?: 'orchestrator' | 'writer' | 'legacy' // NEW: Generation mode
  stream?: boolean // NEW: Enable streaming responses (SSE)
}

/**
 * Generation response
 */
export interface GenerateResponse {
  success: boolean
  markdown?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  cost?: {
    input_cost: number
    output_cost: number
    total_cost: number
  }
  model: string
  provider: LLMProvider
  timestamp: string
  error?: string
}

/**
 * Usage statistics for a user's API key
 */
export interface KeyUsageStats {
  key_id: string
  provider: LLMProvider
  nickname: string | null
  today: {
    tokens: number
    cost: number
    generations: number
  }
  this_month: {
    tokens: number
    cost: number
    generations: number
  }
  all_time: {
    tokens: number
    cost: number
    generations: number
  }
}

/**
 * Usage history entry
 */
export interface UsageHistoryEntry {
  id: string
  user_id: string
  key_id: string | null // null if using Publo's default key
  provider: LLMProvider
  model: string
  format: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  input_cost: number
  output_cost: number
  total_cost: number
  created_at: string
}

