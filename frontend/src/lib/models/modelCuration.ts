/**
 * Model Curation System
 * 
 * Smart filtering of vendor models to only show relevant, high-quality models
 * Prevents UI clutter and ensures users only see models suitable for creative writing
 */

import type { NormalizedModel } from '../providers/types'

/**
 * Check if a model is suitable for creative writing tasks
 */
export function isCreativeWritingModel(modelId: string, modelName?: string): boolean {
  const id = modelId.toLowerCase()
  const name = (modelName || modelId).toLowerCase()
  
  // ❌ EXCLUDE: Non-text generation models
  if (id.includes('embedding')) return false
  if (id.includes('whisper')) return false
  if (id.includes('tts')) return false
  if (id.includes('dall-e')) return false
  if (id.includes('moderation')) return false
  if (id.includes('audio')) return false
  
  // ❌ EXCLUDE: Legacy/deprecated models
  if (id.includes('davinci-002')) return false
  if (id.includes('babbage-002')) return false
  if (id.includes('curie')) return false
  if (id.includes('ada')) return false
  if (id.includes('text-davinci')) return false
  if (id.includes('text-curie')) return false
  
  // ❌ EXCLUDE: Very old GPT-3.5 base models (keep turbo variants)
  if (id.includes('gpt-3.5') && !id.includes('turbo')) return false
  
  // ❌ EXCLUDE: Code-specific models (unless explicitly marked for creative use)
  if (id.includes('code-davinci')) return false
  if (id.includes('code-cushman')) return false
  
  // ✅ INCLUDE: Modern chat models
  if (id.startsWith('gpt-')) return true
  if (id.startsWith('o1-') || id.startsWith('o1')) return true
  if (id.startsWith('claude-')) return true
  if (id.startsWith('gemini-')) return true
  if (id.startsWith('llama-')) return true
  if (id.startsWith('mixtral-')) return true
  if (id.startsWith('deepseek-')) return true
  if (id.startsWith('qwen-')) return true
  if (id.startsWith('mistral-')) return true
  
  // ✅ INCLUDE: Known creative writing models
  if (name.includes('chat')) return true
  if (name.includes('instruct')) return true
  if (name.includes('reasoning')) return true
  
  // Default: exclude if unsure
  return false
}

/**
 * Get model quality tier based on naming patterns
 */
export function getModelQualityTier(modelId: string): 'frontier' | 'premium' | 'standard' | 'fast' | 'unknown' {
  const id = modelId.toLowerCase()
  
  // Frontier models
  if (id.includes('gpt-5')) return 'frontier'
  if (id.includes('claude-4')) return 'frontier'
  if (id.includes('claude-sonnet-4')) return 'frontier'
  if (id.includes('o1-preview')) return 'frontier'
  if (id.includes('gemini-3')) return 'frontier'
  if (id.includes('gemini-ultra')) return 'frontier'
  
  // Premium models
  if (id.includes('gpt-4o') && !id.includes('mini')) return 'premium'
  if (id.includes('gpt-4-turbo')) return 'premium'
  if (id.includes('claude-3-5-sonnet')) return 'premium'
  if (id.includes('claude-3-opus')) return 'premium'
  if (id.includes('claude-opus')) return 'premium'
  if (id.includes('gemini-2.0')) return 'premium'
  if (id.includes('gemini-1.5-pro')) return 'premium'
  if (id.includes('o1-mini')) return 'premium'
  
  // Standard models
  if (id.includes('gpt-4o-mini')) return 'standard'
  if (id.includes('gpt-3.5-turbo')) return 'standard'
  if (id.includes('claude-3-sonnet')) return 'standard'
  if (id.includes('claude-sonnet')) return 'standard'
  if (id.includes('llama-3.3')) return 'standard'
  if (id.includes('llama-3.1-70b')) return 'standard'
  if (id.includes('mixtral')) return 'standard'
  if (id.includes('gemini-1.5-flash')) return 'standard'
  
  // Fast models
  if (id.includes('llama-3.1-8b')) return 'fast'
  if (id.includes('llama-3.2')) return 'fast'
  if (id.includes('claude-3-haiku')) return 'fast'
  if (id.includes('claude-haiku')) return 'fast'
  if (id.includes('gemini-flash')) return 'fast'
  if (id.includes('qwen')) return 'fast'
  
  return 'unknown'
}

/**
 * Prioritize models for display (higher score = show first)
 */
export function getModelDisplayPriority(modelId: string): number {
  const tier = getModelQualityTier(modelId)
  const id = modelId.toLowerCase()
  
  let priority = 0
  
  // Base priority by tier
  switch (tier) {
    case 'frontier': priority = 1000; break
    case 'premium': priority = 800; break
    case 'standard': priority = 600; break
    case 'fast': priority = 400; break
    default: priority = 200; break
  }
  
  // Boost for reasoning models
  if (id.includes('o1-') || id.includes('reasoning') || id.includes('gpt-5')) {
    priority += 100
  }
  
  // Boost for latest versions
  if (id.includes('2024')) priority += 50
  if (id.includes('2025')) priority += 60
  if (id.includes('-latest')) priority += 40
  
  // Boost for popular models
  if (id.includes('claude-3-5-sonnet')) priority += 30
  if (id.includes('gpt-4o')) priority += 30
  if (id.includes('gemini-2.0')) priority += 30
  if (id.includes('llama-3.3')) priority += 20
  
  // Slight penalty for very old models
  if (id.includes('2021') || id.includes('2022')) priority -= 50
  if (id.includes('gpt-3.5')) priority -= 20
  
  return priority
}

/**
 * Curate and sort models for display
 */
export function curateModels(models: NormalizedModel[]): NormalizedModel[] {
  // Filter to only creative writing models
  const creativeModels = models.filter(m => isCreativeWritingModel(m.id, m.name))
  
  // Sort by display priority (descending)
  creativeModels.sort((a, b) => {
    const priorityA = getModelDisplayPriority(a.id)
    const priorityB = getModelDisplayPriority(b.id)
    return priorityB - priorityA
  })
  
  return creativeModels
}

/**
 * Get recommended orchestrator models from a list
 */
export function getRecommendedOrchestrators(models: NormalizedModel[]): NormalizedModel[] {
  return models.filter(m => {
    const tier = getModelQualityTier(m.id)
    return tier === 'frontier' || tier === 'premium'
  })
}

/**
 * Get recommended writer models from a list
 */
export function getRecommendedWriters(models: NormalizedModel[]): NormalizedModel[] {
  return models.filter(m => {
    const tier = getModelQualityTier(m.id)
    // Writers can be premium, standard, or fast (not frontier - too expensive)
    return tier === 'premium' || tier === 'standard' || tier === 'fast'
  })
}

/**
 * Deduplicate models (e.g., gpt-4o-2024-11-20 and gpt-4o → keep latest)
 */
export function deduplicateModels(models: NormalizedModel[]): NormalizedModel[] {
  const modelFamilies = new Map<string, NormalizedModel[]>()
  
  // Group by base model name
  for (const model of models) {
    const baseName = getBaseModelName(model.id)
    if (!modelFamilies.has(baseName)) {
      modelFamilies.set(baseName, [])
    }
    modelFamilies.get(baseName)!.push(model)
  }
  
  // Keep only the best version of each family
  const deduplicated: NormalizedModel[] = []
  
  for (const [baseName, family] of modelFamilies) {
    if (family.length === 1) {
      deduplicated.push(family[0])
    } else {
      // Sort by priority and keep the best
      family.sort((a, b) => getModelDisplayPriority(b.id) - getModelDisplayPriority(a.id))
      deduplicated.push(family[0])
    }
  }
  
  return deduplicated
}

/**
 * Extract base model name (e.g., gpt-4o-2024-11-20 → gpt-4o)
 */
function getBaseModelName(modelId: string): string {
  const id = modelId.toLowerCase()
  
  // Remove date patterns
  let base = id.replace(/-\d{4}-\d{2}-\d{2}/g, '')
  base = base.replace(/-\d{8}/g, '')
  
  // Remove version suffixes
  base = base.replace(/-v\d+$/g, '')
  base = base.replace(/-latest$/g, '')
  base = base.replace(/-preview$/g, '')
  
  return base
}

