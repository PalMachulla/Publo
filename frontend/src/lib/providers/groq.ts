/**
 * Groq provider adapter
 * Implements the unified LLMProviderAdapter interface for Groq API
 */

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
import { GroqModelWithPricing, enrichModelWithPricing, isChatModel } from '../groq/types'

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'

export class GroqAdapter implements LLMProviderAdapter {
  readonly name = 'Groq'

  /**
   * Fetch all available models from Groq API
   */
  async fetchModels(apiKey: string): Promise<NormalizedModel[]> {
    try {
      const response = await fetch(`${GROQ_API_BASE}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })

      if (response.status === 401) {
        throw new InvalidAPIKeyError('groq')
      }

      if (response.status === 429) {
        throw new RateLimitError('groq')
      }

      if (!response.ok) {
        throw new ProviderError(
          `Groq API error: ${response.statusText}`,
          'groq',
          response.status
        )
      }

      const data = await response.json()

      // Enrich with pricing data and normalize
      const enrichedModels = data.data
        .filter((model: any) => model.active)
        .map((model: any) => enrichModelWithPricing(model))
        .filter((model: GroqModelWithPricing) => isChatModel(model))

      return enrichedModels.map(model => this.normalizeModel(model))
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error
      }
      throw new ProviderError(
        'Failed to fetch Groq models',
        'groq',
        undefined,
        error
      )
    }
  }

  /**
   * Generate text using Groq API
   */
  async generate(apiKey: string, params: GenerateParams): Promise<ProviderGenerateResponse> {
    try {
      const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: params.model,
          messages: [
            { role: 'system', content: params.system_prompt },
            { role: 'user', content: params.user_prompt },
          ],
          max_tokens: params.max_tokens,
          temperature: params.temperature ?? 0.7,
          top_p: params.top_p ?? 1,
          stream: false,
        }),
      })

      if (response.status === 401) {
        throw new InvalidAPIKeyError('groq')
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        throw new RateLimitError('groq', retryAfter ? parseInt(retryAfter) : undefined)
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ProviderError(
          errorData.error?.message || `Groq API error: ${response.statusText}`,
          'groq',
          response.status
        )
      }

      const data = await response.json()

      return {
        content: data.choices[0]?.message?.content || '',
        usage: {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
        },
        model: data.model,
        finish_reason: data.choices[0]?.finish_reason,
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error
      }
      throw new ProviderError(
        'Failed to generate with Groq',
        'groq',
        undefined,
        error
      )
    }
  }

  /**
   * Validate Groq API key by making a lightweight request
   */
  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${GROQ_API_BASE}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get pricing for a specific Groq model
   */
  async getModelPricing(modelId: string): Promise<ModelPricing | null> {
    // Use static pricing data from enrichModelWithPricing
    // In a real implementation, this could fetch from an API or database
    const models = await this.fetchModels(process.env.GROQ_PUBLO_KEY || '')
    const model = models.find(m => m.id === modelId)

    if (!model || !model.input_price_per_1m || !model.output_price_per_1m) {
      return null
    }

    return {
      input_price_per_1m: model.input_price_per_1m,
      output_price_per_1m: model.output_price_per_1m,
    }
  }

  /**
   * Calculate cost for Groq generation
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
   * Normalize Groq model to unified format
   */
  private normalizeModel(model: GroqModelWithPricing): NormalizedModel {
    return {
      id: model.id,
      name: model.name || model.id,
      provider: 'groq',
      context_window: model.context_window || 0,
      max_output_tokens: model.max_completion_tokens || null,
      input_price_per_1m: model.price_per_1m_input || null,
      output_price_per_1m: model.price_per_1m_output || null,
      speed_tokens_per_sec: model.speed_tokens_per_sec || null,
      category: model.category || 'production',
      supports_system_prompt: true, // Groq supports system prompts
      description: model.description,
    }
  }
}

// Export singleton instance
export const groqAdapter = new GroqAdapter()

