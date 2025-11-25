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
  // OpenAI models (native OpenAI API)
  // GPT models: gpt-4, gpt-4o, gpt-5, gpt-5.1, gpt-5.1-2025-11-13, etc.
  // o1 models: o1-preview, o1-mini (OpenAI reasoning models)
  // Snapshots: Any model starting with gpt- or o1- (includes dated snapshots)
  if ((modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.startsWith('o1')) && !modelId.includes('/')) {
    return 'openai'
  }
  
  // Groq models - comprehensive list
  if (
    // Llama models
    modelId.startsWith('llama') ||
    modelId.startsWith('meta-llama/') ||
    // Mixtral models
    modelId.startsWith('mixtral') ||
    // Gemma models
    modelId.startsWith('gemma') ||
    // Groq's OpenAI models (e.g., openai/gpt-oss-120b)
    modelId.startsWith('openai/gpt-oss') ||
    // Groq's Whisper models
    modelId.startsWith('whisper-') ||
    // Groq's Qwen models
    modelId.startsWith('qwen/') ||
    // Groq's Moonshot AI models
    modelId.startsWith('moonshotai/') ||
    // Groq Compound system
    modelId.startsWith('groq/compound')
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

