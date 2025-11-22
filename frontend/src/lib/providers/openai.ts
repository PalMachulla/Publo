/**
 * OpenAI provider adapter
 * Implements the unified LLMProviderAdapter interface for OpenAI API
 */

import OpenAI from 'openai'
import {
  LLMProviderAdapter,
  GenerateParams,
  ProviderGenerateResponse,
  ProviderUsage,
  ModelPricing,
  InvalidAPIKeyError,
  RateLimitError,
  ProviderError,
} from './types'
import { NormalizedModel } from '@/types/api-keys'

// Static pricing data for OpenAI models (as of Nov 2024)
// Reference: https://openai.com/api/pricing/
const OPENAI_MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': {
    input_price_per_1m: 2.50,
    output_price_per_1m: 10.00,
  },
  'gpt-4o-2024-11-20': {
    input_price_per_1m: 2.50,
    output_price_per_1m: 10.00,
  },
  'gpt-4o-mini': {
    input_price_per_1m: 0.150,
    output_price_per_1m: 0.600,
  },
  'gpt-4o-mini-2024-07-18': {
    input_price_per_1m: 0.150,
    output_price_per_1m: 0.600,
  },
  'gpt-4-turbo': {
    input_price_per_1m: 10.00,
    output_price_per_1m: 30.00,
  },
  'gpt-4-turbo-2024-04-09': {
    input_price_per_1m: 10.00,
    output_price_per_1m: 30.00,
  },
  'gpt-4': {
    input_price_per_1m: 30.00,
    output_price_per_1m: 60.00,
  },
  'gpt-3.5-turbo': {
    input_price_per_1m: 0.50,
    output_price_per_1m: 1.50,
  },
  'gpt-3.5-turbo-0125': {
    input_price_per_1m: 0.50,
    output_price_per_1m: 1.50,
  },
}

// Known context windows for OpenAI models
const OPENAI_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-2024-11-20': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4o-mini-2024-07-18': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-2024-04-09': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-0125': 16385,
}

export class OpenAIAdapter implements LLMProviderAdapter {
  readonly name = 'OpenAI'

  /**
   * Create OpenAI client instance
   */
  private createClient(apiKey: string): OpenAI {
    return new OpenAI({ apiKey })
  }

  /**
   * Fetch all available models from OpenAI API
   */
  async fetchModels(apiKey: string): Promise<NormalizedModel[]> {
    try {
      const client = this.createClient(apiKey)
      const response = await client.models.list()

      // Filter for chat/text generation models only
      const chatModels = response.data.filter(model => {
        const id = model.id.toLowerCase()
        
        // Exclude non-text models
        if (id.includes('whisper')) return false // Speech-to-text
        if (id.includes('tts')) return false // Text-to-speech
        if (id.includes('dall-e')) return false // Image generation
        if (id.includes('davinci-002')) return false // Legacy completion
        if (id.includes('babbage-002')) return false // Legacy completion
        if (id.includes('embedding')) return false // Embeddings
        if (id.includes('moderation')) return false // Moderation
        if (id.includes('audio')) return false // Audio models
        
        // Only include GPT chat models
        return id.startsWith('gpt-') || id.startsWith('chatgpt')
      })

      return chatModels.map(model => this.normalizeModel(model))
    } catch (error: any) {
      if (error?.status === 401) {
        throw new InvalidAPIKeyError('openai', error)
      }

      if (error?.status === 429) {
        throw new RateLimitError('openai', undefined, error)
      }

      throw new ProviderError(
        'Failed to fetch OpenAI models',
        'openai',
        error?.status,
        error
      )
    }
  }

  /**
   * Generate text using OpenAI API
   */
  async generate(apiKey: string, params: GenerateParams): Promise<ProviderGenerateResponse> {
    try {
      const client = this.createClient(apiKey)

      const response = await client.chat.completions.create({
        model: params.model,
        messages: [
          { role: 'system', content: params.system_prompt },
          { role: 'user', content: params.user_prompt },
        ],
        max_completion_tokens: params.max_tokens, // Use new OpenAI parameter name
        // Only include temperature/top_p if explicitly provided (some models don't support them)
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.top_p !== undefined && { top_p: params.top_p }),
      })

      return {
        content: response.choices[0]?.message?.content || '',
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
        finish_reason: response.choices[0]?.finish_reason || undefined,
      }
    } catch (error: any) {
      if (error?.status === 401) {
        throw new InvalidAPIKeyError('openai', error)
      }

      if (error?.status === 429) {
        throw new RateLimitError('openai', undefined, error)
      }

      throw new ProviderError(
        error?.message || 'Failed to generate with OpenAI',
        'openai',
        error?.status,
        error
      )
    }
  }

  /**
   * Validate OpenAI API key
   */
  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const client = this.createClient(apiKey)
      await client.models.list()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get pricing for a specific OpenAI model
   */
  async getModelPricing(modelId: string): Promise<ModelPricing | null> {
    // Check direct match first
    if (OPENAI_MODEL_PRICING[modelId]) {
      return OPENAI_MODEL_PRICING[modelId]
    }

    // Check for base model (e.g., "gpt-4o" for "gpt-4o-2024-11-20")
    for (const [baseModel, pricing] of Object.entries(OPENAI_MODEL_PRICING)) {
      if (modelId.startsWith(baseModel)) {
        return pricing
      }
    }

    return null
  }

  /**
   * Calculate cost for OpenAI generation
   */
  async calculateCost(
    modelId: string,
    usage: ProviderUsage
  ): Promise<{ input_cost: number; output_cost: number; total_cost: number }> {
    const pricing = await this.getModelPricing(modelId)

    if (!pricing) {
      return { input_cost: 0, output_cost: 0, total_cost: 0 }
    }

    const input_cost = (usage.prompt_tokens / 1_000_000) * pricing.input_price_per_1m
    const output_cost = (usage.completion_tokens / 1_000_000) * pricing.output_price_per_1m
    const total_cost = input_cost + output_cost

    return { input_cost, output_cost, total_cost }
  }

  /**
   * Normalize OpenAI model to unified format
   */
  private normalizeModel(model: OpenAI.Models.Model): NormalizedModel {
    const pricing = OPENAI_MODEL_PRICING[model.id]
    const contextWindow = OPENAI_CONTEXT_WINDOWS[model.id] || 0

    // Determine category based on model ID
    let category: 'production' | 'preview' | 'deprecated' = 'production'
    if (model.id.includes('preview')) {
      category = 'preview'
    } else if (model.id.includes('0301') || model.id.includes('0314')) {
      category = 'deprecated'
    }

    return {
      id: model.id,
      name: this.getModelDisplayName(model.id),
      provider: 'openai',
      context_window: contextWindow,
      max_output_tokens: contextWindow > 0 ? Math.floor(contextWindow * 0.75) : null,
      input_price_per_1m: pricing?.input_price_per_1m || null,
      output_price_per_1m: pricing?.output_price_per_1m || null,
      speed_tokens_per_sec: null, // OpenAI doesn't publish speed metrics
      category,
      supports_system_prompt: true,
      supports_chat: true, // All OpenAI chat models support chat completions
      description: this.getModelDescription(model.id),
    }
  }

  /**
   * Get human-readable display name for model
   */
  private getModelDisplayName(modelId: string): string {
    if (modelId.startsWith('gpt-4o-mini')) return 'GPT-4o Mini'
    if (modelId.startsWith('gpt-4o')) return 'GPT-4o'
    if (modelId.startsWith('gpt-4-turbo')) return 'GPT-4 Turbo'
    if (modelId.startsWith('gpt-4')) return 'GPT-4'
    if (modelId.startsWith('gpt-3.5-turbo')) return 'GPT-3.5 Turbo'
    return modelId
  }

  /**
   * Get model description
   */
  private getModelDescription(modelId: string): string {
    if (modelId.startsWith('gpt-4o')) {
      return 'Most advanced multimodal model, optimized for speed and cost'
    }
    if (modelId.startsWith('gpt-4-turbo')) {
      return 'Powerful model for complex tasks with large context window'
    }
    if (modelId.startsWith('gpt-4')) {
      return 'High-intelligence model for complex reasoning'
    }
    if (modelId.startsWith('gpt-3.5')) {
      return 'Fast and efficient for simpler tasks'
    }
    return 'OpenAI language model'
  }
}

// Export singleton instance
export const openaiAdapter = new OpenAIAdapter()

