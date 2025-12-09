/**
 * Model Router Adapter
 * 
 * Adapts the existing modelRouter interface for use in the intent pipeline.
 * This allows the pipeline to use fast/smart models without changing the modelRouter.
 */

import type { TieredModel } from '../../../core/modelRouter'
import { selectModelForTask } from '../../../core/modelRouter'

/**
 * Complete a request using a model
 */
export interface ModelCompletionRequest {
  model: 'fast' | 'smart' | string // 'fast' or 'smart' for auto-selection, or specific model ID
  systemPrompt: string
  userPrompt?: string
  maxTokens?: number
  temperature?: number
  conversationHistory?: Array<{ role: string; content: string }>
}

/**
 * Model router adapter for intent pipeline
 */
export class ModelRouterAdapter {
  private availableModels: TieredModel[]
  
  constructor(availableModels: TieredModel[] = []) {
    this.availableModels = availableModels
  }
  
  /**
   * Complete a request using the appropriate model
   */
  async complete(request: ModelCompletionRequest): Promise<string> {
    // Build the API request
    // Note: The API endpoint selects the model from the database (orchestrator_model_id)
    // We don't need to specify model_id here - the API handles model selection
    const apiRequest = {
      system_prompt: request.systemPrompt,
      user_prompt: request.userPrompt || request.systemPrompt, // user_prompt is required, use systemPrompt as fallback
      conversation_history: request.conversationHistory || [],
      temperature: request.temperature || 0.1
      // Note: max_tokens is not used by the API endpoint, so we don't send it
    }
    
    // Ensure user_prompt is provided (required by API)
    if (!apiRequest.user_prompt) {
      throw new Error('user_prompt is required for intent analysis')
    }
    
    // Call the intent analysis API endpoint
    // This reuses the existing /api/intent/analyze endpoint
    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiRequest)
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Model completion failed (${response.status}): ${errorData.error || response.statusText}`)
    }
    
    const data = await response.json()
    return data.content || ''
  }
  
  /**
   * Select a model based on the request type
   */
  private selectModel(requestedModel: 'fast' | 'smart' | string): string | null {
    // If specific model ID provided, use it
    if (requestedModel !== 'fast' && requestedModel !== 'smart') {
      return requestedModel
    }
    
    // Filter available models
    const available = this.availableModels.length > 0 
      ? this.availableModels 
      : [] // Will use default from API if empty
    
    if (requestedModel === 'fast') {
      // Find fast model (Haiku, Gemini Flash, GPT-4o-mini)
      const fastModel = available.find(m => 
        m.tier === 'fast' || 
        m.id.includes('haiku') || 
        m.id.includes('flash') ||
        m.id.includes('gpt-4o-mini')
      )
      return fastModel?.id || null
    }
    
    if (requestedModel === 'smart') {
      // Find smart model (Sonnet, GPT-4, Gemini Pro)
      // Prefer reasoning-capable models if available
      const reasoningModel = available.find(m => 
        (m.tier === 'premium' || m.tier === 'frontier') &&
        (m.id.includes('sonnet') || 
         m.id.includes('gpt-4') ||
         m.id.includes('gemini-pro') ||
         m.id.includes('o1') ||
         m.id.includes('reasoning'))
      )
      
      if (reasoningModel) {
        return reasoningModel.id
      }
      
      // Fallback to any premium/frontier model
      const smartModel = available.find(m => 
        m.tier === 'premium' || 
        m.tier === 'frontier'
      )
      return smartModel?.id || null
    }
    
    return null
  }
  
  /**
   * Update available models
   */
  updateAvailableModels(models: TieredModel[]) {
    this.availableModels = models
  }
}

