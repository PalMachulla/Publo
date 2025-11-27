/**
 * Provider adapter types for unified LLM provider interface
 */

import { NormalizedModel, GenerateRequest, GenerateResponse } from '@/types/api-keys'

// ✅ FIX: Re-export NormalizedModel so it can be imported from this module
export type { NormalizedModel, GenerateRequest, GenerateResponse }

/**
 * Parameters for text generation
 */
export interface GenerateParams {
  model: string
  system_prompt: string
  user_prompt: string
  max_tokens: number
  temperature?: number
  top_p?: number
  // Structured output support (Phase 3)
  response_format?: any // OpenAI/Groq: JSON schema or json_object
  tools?: any[] // Anthropic: Tool definitions
  tool_choice?: any // Anthropic: Force tool use
  use_function_calling?: boolean // Google: Function calling
}

/**
 * Raw usage data from provider
 */
export interface ProviderUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

/**
 * Raw response from provider before normalization
 */
export interface ProviderGenerateResponse {
  content: string
  usage: ProviderUsage
  model: string
  finish_reason?: string
  structured_output?: any // Phase 3: Parsed structured output (when response_format is used)
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  input_price_per_1m: number
  output_price_per_1m: number
}

/**
 * Unified interface that all LLM provider adapters must implement
 */
export interface LLMProviderAdapter {
  /**
   * Provider name
   */
  readonly name: string

  /**
   * Fetch all available models from this provider
   * 
   * @param apiKey - The API key to use
   * @returns Array of normalized models
   */
  fetchModels(apiKey: string): Promise<NormalizedModel[]>

  /**
   * Generate text using this provider's API
   * 
   * @param apiKey - The API key to use
   * @param params - Generation parameters
   * @returns Provider-specific response
   */
  generate(apiKey: string, params: GenerateParams): Promise<ProviderGenerateResponse>

  /**
   * Generate text using streaming (optional)
   * 
   * @param apiKey - The API key to use
   * @param params - Generation parameters
   * @returns AsyncGenerator yielding content chunks and final usage
   */
  generateStream?(apiKey: string, params: GenerateParams): AsyncGenerator<
    { 
      type: 'content' | 'reasoning' | 'done' | 'error'
      content?: string
      usage?: ProviderUsage
      model?: string
      done?: boolean
      error?: string
    },
    void,
    unknown
  >

  /**
   * Validate that an API key is valid
   * 
   * @param apiKey - The API key to validate
   * @returns true if valid, false otherwise
   */
  validateKey(apiKey: string): Promise<boolean>

  /**
   * Get pricing information for a specific model
   * 
   * @param modelId - The model ID
   * @returns Pricing information
   */
  getModelPricing(modelId: string): Promise<ModelPricing | null>

  /**
   * Calculate cost for a given usage
   * 
   * @param modelId - The model ID
   * @param usage - Token usage data
   * @returns Cost breakdown
   */
  calculateCost(modelId: string, usage: ProviderUsage): Promise<{
    input_cost: number
    output_cost: number
    total_cost: number
  }>
}

/**
 * Registry of all provider adapters
 */
export type ProviderRegistry = {
  groq: LLMProviderAdapter
  openai: LLMProviderAdapter
  anthropic: LLMProviderAdapter
  google: LLMProviderAdapter
}

/**
 * Provider error types for better error handling
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export class InvalidAPIKeyError extends ProviderError {
  constructor(provider: string, originalError?: unknown) {
    super('Invalid or expired API key', provider, 401, originalError)
    this.name = 'InvalidAPIKeyError'
  }
}

export class RateLimitError extends ProviderError {
  constructor(provider: string, retryAfter?: number, originalError?: unknown) {
    super(
      `Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      provider,
      429,
      originalError
    )
    this.name = 'RateLimitError'
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(provider: string, modelId: string, originalError?: unknown) {
    super(`Model ${modelId} not found`, provider, 404, originalError)
    this.name = 'ModelNotFoundError'
  }
}

