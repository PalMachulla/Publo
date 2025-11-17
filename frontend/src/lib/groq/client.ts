/**
 * Groq API Client
 * Server-side only - uses API key from environment
 */

import { GroqModelsResponse, GroqModelWithPricing, enrichModelWithPricing } from './types'

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'

export class GroqClient {
  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GROQ_PUBLO_KEY || ''
    
    if (!this.apiKey) {
      throw new Error('GROQ_PUBLO_KEY environment variable is not set')
    }
  }

  /**
   * Fetch all available models from Groq API
   * https://console.groq.com/docs/models
   */
  async getModels(): Promise<GroqModelWithPricing[]> {
    try {
      const response = await fetch(`${GROQ_API_BASE}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Always fetch fresh data
      })

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`)
      }

      const data: GroqModelsResponse = await response.json()
      
      // Enrich models with pricing information
      const enrichedModels = data.data
        .filter(model => model.active) // Only return active models
        .map(model => enrichModelWithPricing(model))
        .sort((a, b) => {
          // Sort by category: production first, then preview, then others
          const categoryOrder = { production: 0, preview: 1, deprecated: 2 }
          const aOrder = categoryOrder[a.category || 'deprecated'] ?? 3
          const bOrder = categoryOrder[b.category || 'deprecated'] ?? 3
          
          if (aOrder !== bOrder) return aOrder - bOrder
          
          // Within same category, sort by price (cheapest input first)
          if (a.price_per_1m_input && b.price_per_1m_input) {
            return a.price_per_1m_input - b.price_per_1m_input
          }
          
          // Fallback to alphabetical
          return a.id.localeCompare(b.id)
        })

      return enrichedModels
    } catch (error) {
      console.error('Error fetching Groq models:', error)
      throw error
    }
  }

  /**
   * Get a specific model by ID
   */
  async getModel(modelId: string): Promise<GroqModelWithPricing> {
    const models = await this.getModels()
    const model = models.find(m => m.id === modelId)
    
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }
    
    return model
  }
}

// Export singleton instance for server-side use
export const groqClient = new GroqClient()

