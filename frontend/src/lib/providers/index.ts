/**
 * Provider registry and factory
 * Central place to access all LLM provider adapters
 */

import { LLMProvider } from '@/types/api-keys'
import { LLMProviderAdapter } from './types'
import { groqAdapter } from './groq'
import { openaiAdapter } from './openai'

/**
 * Registry of all available provider adapters
 */
export const providerRegistry: Record<LLMProvider, LLMProviderAdapter> = {
  groq: groqAdapter,
  openai: openaiAdapter,
  anthropic: groqAdapter, // Placeholder - will implement later
  google: groqAdapter, // Placeholder - will implement later
}

/**
 * Get provider adapter for a given provider
 * 
 * @param provider - The provider name
 * @returns Provider adapter instance
 */
export function getProviderAdapter(provider: LLMProvider): LLMProviderAdapter {
  const adapter = providerRegistry[provider]
  
  if (!adapter) {
    throw new Error(`Unknown provider: ${provider}`)
  }
  
  return adapter
}

/**
 * Detect provider from model ID
 * Useful when you have a model ID but need to know which provider it belongs to
 * 
 * @param modelId - The model ID
 * @returns Detected provider or null if unknown
 */
export function detectProviderFromModel(modelId: string): LLMProvider | null {
  // OpenAI models
  if (modelId.startsWith('gpt-')) {
    return 'openai'
  }
  
  // Groq models (Llama, Mixtral, Gemma)
  if (
    modelId.startsWith('llama') ||
    modelId.startsWith('mixtral') ||
    modelId.startsWith('gemma') ||
    modelId.startsWith('meta-llama')
  ) {
    return 'groq'
  }
  
  // Anthropic models
  if (modelId.startsWith('claude-')) {
    return 'anthropic'
  }
  
  // Google models
  if (modelId.startsWith('gemini-')) {
    return 'google'
  }
  
  return null
}

/**
 * Get all available providers
 * 
 * @returns Array of provider names
 */
export function getAllProviders(): LLMProvider[] {
  return Object.keys(providerRegistry) as LLMProvider[]
}

/**
 * Check if a provider is supported
 * 
 * @param provider - The provider name
 * @returns true if supported
 */
export function isProviderSupported(provider: string): provider is LLMProvider {
  return provider in providerRegistry
}

// Re-export types and adapters
export { groqAdapter } from './groq'
export { openaiAdapter } from './openai'
export type { LLMProviderAdapter, GenerateParams, ProviderGenerateResponse } from './types'

