/**
 * Model Router - Intelligent Model Selection
 * 
 * Orchestrator-focused model selection for planning and intent analysis
 * Uses unified MODEL_TIERS from modelTiers.ts
 * 
 * Inspired by Agentic Flow's Model Router:
 * - Auto-select best model based on task complexity and priority
 * - Cost optimization (cheapest model that can handle the task)
 * - Performance optimization (fastest model for simple tasks)
 * - Quality optimization (best model for complex tasks)
 * 
 * @see https://github.com/ruvnet/agentic-flow
 */

import { MODEL_TIERS, type TieredModel } from './modelTiers'

export type ModelPriority = 'cost' | 'speed' | 'quality' | 'balanced'
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'reasoning'

export interface ModelCapability {
  modelId: string
  provider: 'openai' | 'anthropic' | 'groq' | 'google'
  displayName: string
  costPer1kTokens: number // Input + output average
  speedTokensPerSec: number
  contextWindow: number
  capabilities: {
    reasoning: boolean
    streaming: boolean
    functionCalling: boolean
    vision: boolean
  }
  bestFor: TaskComplexity[]
}

export interface ModelSelection {
  modelId: string
  provider: string
  reasoning: string
  estimatedCost: number
  estimatedTime: number
}

/**
 * Convert TieredModel to ModelCapability for backwards compatibility
 */
function convertToModelCapability(tiered: TieredModel): ModelCapability {
  // Map tier-based "bestFor" to complexity-based "bestFor"
  const bestFor: TaskComplexity[] = []
  
  if (tiered.bestFor.includes('orchestration') || tiered.tier === 'frontier') {
    bestFor.push('reasoning', 'complex')
  }
  
  if (tiered.bestFor.includes('complex-writing')) {
    bestFor.push('complex')
  }
  
  if (tiered.bestFor.includes('general-writing')) {
    bestFor.push('moderate')
  }
  
  if (tiered.bestFor.includes('editing') || tiered.bestFor.includes('speed-writing')) {
    bestFor.push('simple')
  }
  
  // Estimate speed in tokens/sec based on speed category
  const speedTokensPerSec = 
    tiered.speed === 'instant' ? 500 :
    tiered.speed === 'fast' ? 150 :
    tiered.speed === 'medium' ? 50 :
    30 // slow
  
  // Estimate cost per 1k tokens based on cost category
  const costPer1kTokens =
    tiered.cost === 'cheap' ? 0.0005 :
    tiered.cost === 'moderate' ? 0.005 :
    0.05 // expensive
  
  return {
    modelId: tiered.id,
    provider: tiered.provider as any,
    displayName: tiered.displayName,
    costPer1kTokens,
    speedTokensPerSec,
    contextWindow: tiered.contextWindow,
    capabilities: {
      reasoning: tiered.reasoning,
      streaming: true, // Assume all models support streaming
      functionCalling: true, // Assume all models support function calling
      vision: tiered.multimodal
    },
    bestFor: bestFor.length > 0 ? bestFor : ['moderate']
  }
}

/**
 * Get MODEL_REGISTRY from unified MODEL_TIERS
 * This ensures we only have ONE source of truth for model definitions
 */
function getModelRegistry(): ModelCapability[] {
  return MODEL_TIERS.map(convertToModelCapability)
}

/**
 * Determine task complexity from intent and context
 */
export function assessTaskComplexity(
  intent: string,
  contextLength: number,
  requiresReasoning: boolean
): TaskComplexity {
  if (requiresReasoning || intent === 'rewrite_with_coherence') {
    return 'reasoning'
  }
  
  if (intent === 'create_structure' || intent === 'modify_structure') {
    return 'complex'
  }
  
  if (intent === 'write_content' && contextLength > 5000) {
    return 'complex'
  }
  
  if (intent === 'write_content' || intent === 'improve_content') {
    return 'moderate'
  }
  
  // answer_question, general_chat, clarify_intent
  return 'simple'
}

/**
 * Select best model based on task and priority
 * 
 * Inspired by Agentic Flow's auto-selection algorithm
 */
export function selectModel(
  taskComplexity: TaskComplexity,
  priority: ModelPriority = 'balanced',
  availableProviders: string[] = ['openai', 'groq', 'anthropic', 'google']
): ModelSelection {
  // Get fresh model registry from unified source
  const MODEL_REGISTRY = getModelRegistry()
  
  // Filter models by availability and capability
  const candidates = MODEL_REGISTRY.filter(model => 
    availableProviders.includes(model.provider) &&
    model.bestFor.includes(taskComplexity)
  )
  
  if (candidates.length === 0) {
    // Fallback to any available model
    const fallback = MODEL_REGISTRY.find(m => availableProviders.includes(m.provider))
    if (!fallback) {
      throw new Error('No available models found')
    }
    
    return {
      modelId: fallback.modelId,
      provider: fallback.provider,
      reasoning: 'Fallback: No models matched criteria',
      estimatedCost: fallback.costPer1kTokens * 2, // Assume 2k tokens
      estimatedTime: 2000 / fallback.speedTokensPerSec
    }
  }
  
  // Score models based on priority
  const scored = candidates.map(model => {
    let score = 0
    
    switch (priority) {
      case 'cost':
        // Lower cost = higher score
        score = 1 / (model.costPer1kTokens + 0.0001)
        break
        
      case 'speed':
        // Higher speed = higher score
        score = model.speedTokensPerSec
        break
        
      case 'quality':
        // Reasoning > complex > moderate > simple
        if (model.capabilities.reasoning) score += 100
        if (model.bestFor.includes('complex')) score += 50
        if (model.bestFor.includes('reasoning')) score += 75
        score += model.contextWindow / 1000
        break
        
      case 'balanced':
        // Balance cost, speed, and quality
        const costScore = 1 / (model.costPer1kTokens + 0.0001)
        const speedScore = model.speedTokensPerSec / 100
        const qualityScore = model.contextWindow / 10000
        score = costScore * 0.4 + speedScore * 0.3 + qualityScore * 0.3
        break
    }
    
    return { model, score }
  })
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score)
  
  const selected = scored[0].model
  
  // Build reasoning string
  let reasoning = `Selected ${selected.displayName} for ${taskComplexity} task (${priority} priority)`
  
  if (priority === 'cost') {
    reasoning += ` - Cheapest option at $${selected.costPer1kTokens}/1k tokens`
  } else if (priority === 'speed') {
    reasoning += ` - Fastest at ${selected.speedTokensPerSec} tokens/sec`
  } else if (priority === 'quality') {
    reasoning += ` - Best quality with ${selected.contextWindow.toLocaleString()} token context`
  }
  
  return {
    modelId: selected.modelId,
    provider: selected.provider,
    reasoning,
    estimatedCost: selected.costPer1kTokens * 2, // Assume 2k tokens average
    estimatedTime: 2000 / selected.speedTokensPerSec
  }
}

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: string): ModelCapability | undefined {
  const MODEL_REGISTRY = getModelRegistry()
  return MODEL_REGISTRY.find(m => m.modelId === modelId)
}

/**
 * Check if a model supports a specific capability
 */
export function supportsCapability(
  modelId: string,
  capability: keyof ModelCapability['capabilities']
): boolean {
  const model = getModelInfo(modelId)
  return model?.capabilities[capability] || false
}

/**
 * Estimate cost for a given model and token count
 */
export function estimateCost(modelId: string, tokenCount: number): number {
  const model = getModelInfo(modelId)
  if (!model) return 0
  
  return (tokenCount / 1000) * model.costPer1kTokens
}

