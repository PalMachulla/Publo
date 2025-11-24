/**
 * Model Router - Intelligent Model Selection
 * 
 * Inspired by Agentic Flow's Model Router:
 * - Auto-select best model based on task complexity and priority
 * - Cost optimization (cheapest model that can handle the task)
 * - Performance optimization (fastest model for simple tasks)
 * - Quality optimization (best model for complex tasks)
 * 
 * @see https://github.com/ruvnet/agentic-flow
 */

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

// Model database (inspired by Agentic Flow's model registry)
const MODEL_REGISTRY: ModelCapability[] = [
  // OpenAI - Frontier Models
  {
    modelId: 'gpt-5.1',
    provider: 'openai',
    displayName: 'GPT-5.1',
    costPer1kTokens: 0.10, // Estimated
    speedTokensPerSec: 30,
    contextWindow: 128000,
    capabilities: {
      reasoning: true,
      streaming: true,
      functionCalling: true,
      vision: false
    },
    bestFor: ['reasoning', 'complex']
  },
  {
    modelId: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    costPer1kTokens: 0.005,
    speedTokensPerSec: 50,
    contextWindow: 128000,
    capabilities: {
      reasoning: false,
      streaming: true,
      functionCalling: true,
      vision: true
    },
    bestFor: ['complex', 'moderate']
  },
  {
    modelId: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    costPer1kTokens: 0.00015,
    speedTokensPerSec: 80,
    contextWindow: 128000,
    capabilities: {
      reasoning: false,
      streaming: true,
      functionCalling: true,
      vision: true
    },
    bestFor: ['moderate', 'simple']
  },
  
  // Groq - Speed Champions
  {
    modelId: 'llama-3.3-70b-versatile',
    provider: 'groq',
    displayName: 'Llama 3.3 70B',
    costPer1kTokens: 0.00059,
    speedTokensPerSec: 300,
    contextWindow: 32768,
    capabilities: {
      reasoning: false,
      streaming: true,
      functionCalling: true,
      vision: false
    },
    bestFor: ['moderate', 'simple']
  },
  {
    modelId: 'llama-3.1-8b-instant',
    provider: 'groq',
    displayName: 'Llama 3.1 8B',
    costPer1kTokens: 0.00005,
    speedTokensPerSec: 500,
    contextWindow: 8192,
    capabilities: {
      reasoning: false,
      streaming: true,
      functionCalling: false,
      vision: false
    },
    bestFor: ['simple']
  },
  
  // Anthropic - Quality Leaders
  {
    modelId: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    costPer1kTokens: 0.003,
    speedTokensPerSec: 40,
    contextWindow: 200000,
    capabilities: {
      reasoning: false,
      streaming: true,
      functionCalling: true,
      vision: true
    },
    bestFor: ['complex', 'moderate']
  },
  {
    modelId: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    displayName: 'Claude 3 Haiku',
    costPer1kTokens: 0.00025,
    speedTokensPerSec: 100,
    contextWindow: 200000,
    capabilities: {
      reasoning: false,
      streaming: true,
      functionCalling: true,
      vision: false
    },
    bestFor: ['simple', 'moderate']
  },
  
  // Google - Balanced Options
  {
    modelId: 'gemini-2.0-flash-exp',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    costPer1kTokens: 0.0001,
    speedTokensPerSec: 150,
    contextWindow: 1000000,
    capabilities: {
      reasoning: false,
      streaming: true,
      functionCalling: true,
      vision: true
    },
    bestFor: ['moderate', 'simple']
  }
]

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

