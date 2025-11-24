/**
 * Model Tier Classification System
 * 
 * Defines which models are "frontier" (top-tier) and which are "workers" (fast/cheap)
 * This allows intelligent delegation: orchestrator uses frontier, writers use workers
 */

export type ModelTier = 'frontier' | 'premium' | 'standard' | 'fast'

export interface TieredModel {
  id: string
  provider: string
  displayName: string
  tier: ModelTier
  
  // Capabilities
  contextWindow: number
  reasoning: boolean
  multimodal: boolean
  
  // Performance
  speed: 'instant' | 'fast' | 'medium' | 'slow'
  cost: 'cheap' | 'moderate' | 'expensive'
  
  // Best use cases
  bestFor: Array<'orchestration' | 'complex-writing' | 'general-writing' | 'editing' | 'speed-writing'>
}

/**
 * Model Tier Registry
 * Curated list of models organized by capability tier
 */
export const MODEL_TIERS: TieredModel[] = [
  // ============================================================
  // FRONTIER TIER - For Orchestration & Complex Planning
  // ============================================================
  {
    id: 'gpt-5.1',
    provider: 'openai',
    displayName: 'GPT-5.1',
    tier: 'frontier',
    contextWindow: 200000,
    reasoning: true,
    multimodal: false,
    speed: 'medium',
    cost: 'expensive',
    bestFor: ['orchestration', 'complex-writing']
  },
  {
    id: 'claude-sonnet-4.5',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    tier: 'frontier',
    contextWindow: 200000,
    reasoning: true,
    multimodal: true,
    speed: 'medium',
    cost: 'expensive',
    bestFor: ['orchestration', 'complex-writing']
  },
  {
    id: 'o1-preview',
    provider: 'openai',
    displayName: 'OpenAI o1 Preview',
    tier: 'frontier',
    contextWindow: 128000,
    reasoning: true,
    multimodal: false,
    speed: 'slow',
    cost: 'expensive',
    bestFor: ['orchestration']
  },
  
  // ============================================================
  // PREMIUM TIER - High Quality Writers
  // ============================================================
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    tier: 'premium',
    contextWindow: 200000,
    reasoning: false,
    multimodal: true,
    speed: 'medium',
    cost: 'expensive',
    bestFor: ['complex-writing', 'general-writing']
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    tier: 'premium',
    contextWindow: 128000,
    reasoning: false,
    multimodal: true,
    speed: 'fast',
    cost: 'expensive',
    bestFor: ['complex-writing', 'general-writing']
  },
  {
    id: 'gpt-4o-2024-11-20',
    provider: 'openai',
    displayName: 'GPT-4o (Nov 2024)',
    tier: 'premium',
    contextWindow: 128000,
    reasoning: false,
    multimodal: true,
    speed: 'fast',
    cost: 'expensive',
    bestFor: ['complex-writing', 'general-writing']
  },
  {
    id: 'gemini-2.0-flash-exp',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    tier: 'premium',
    contextWindow: 1000000, // 1M context!
    reasoning: false,
    multimodal: true,
    speed: 'fast',
    cost: 'cheap', // Surprisingly cheap for its capabilities
    bestFor: ['complex-writing', 'general-writing']
  },
  
  // ============================================================
  // STANDARD TIER - Balanced Writers
  // ============================================================
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    displayName: 'Llama 3.3 70B',
    tier: 'standard',
    contextWindow: 128000,
    reasoning: false,
    multimodal: false,
    speed: 'instant',
    cost: 'cheap',
    bestFor: ['general-writing', 'editing']
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    tier: 'standard',
    contextWindow: 128000,
    reasoning: false,
    multimodal: true,
    speed: 'fast',
    cost: 'cheap',
    bestFor: ['general-writing', 'editing']
  },
  {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    displayName: 'Claude 3 Haiku',
    tier: 'standard',
    contextWindow: 200000,
    reasoning: false,
    multimodal: false,
    speed: 'fast',
    cost: 'cheap',
    bestFor: ['general-writing', 'editing', 'speed-writing']
  },
  
  // ============================================================
  // FAST TIER - Speed Writing & Simple Tasks
  // ============================================================
  {
    id: 'llama-3.3-70b-specdec',
    provider: 'groq',
    displayName: 'Llama 3.3 70B SpecDec',
    tier: 'fast',
    contextWindow: 8192,
    reasoning: false,
    multimodal: false,
    speed: 'instant',
    cost: 'cheap',
    bestFor: ['speed-writing', 'editing']
  },
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    displayName: 'Llama 3.1 8B',
    tier: 'fast',
    contextWindow: 8192,
    reasoning: false,
    multimodal: false,
    speed: 'instant',
    cost: 'cheap',
    bestFor: ['speed-writing', 'editing']
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'google',
    displayName: 'Gemini 1.5 Flash',
    tier: 'fast',
    contextWindow: 1000000,
    reasoning: false,
    multimodal: true,
    speed: 'fast',
    cost: 'cheap',
    bestFor: ['speed-writing', 'general-writing']
  }
]

/**
 * Get models by tier
 */
export function getModelsByTier(tier: ModelTier): TieredModel[] {
  return MODEL_TIERS.filter(m => m.tier === tier)
}

/**
 * Get frontier models (for orchestration)
 */
export function getFrontierModels(): TieredModel[] {
  return getModelsByTier('frontier')
}

/**
 * Get worker models (for delegation)
 */
export function getWorkerModels(): TieredModel[] {
  return MODEL_TIERS.filter(m => m.tier === 'standard' || m.tier === 'fast')
}

/**
 * Check if a model is frontier-tier
 */
export function isFrontierModel(modelId: string): boolean {
  const model = MODEL_TIERS.find(m => m.id === modelId || modelId.startsWith(m.id))
  return model?.tier === 'frontier'
}

/**
 * Find best model for a specific task
 */
export interface TaskRequirements {
  type: 'orchestration' | 'complex-scene' | 'simple-scene' | 'dialogue' | 'action' | 'editing'
  wordCount?: number
  contextNeeded?: number
  priority: 'quality' | 'speed' | 'cost' | 'balanced'
}

export function selectModelForTask(
  task: TaskRequirements,
  availableModels: TieredModel[]
): TieredModel | null {
  if (availableModels.length === 0) return null

  // Filter by capability
  let candidates = availableModels

  switch (task.type) {
    case 'orchestration':
      // MUST be frontier or premium tier
      candidates = candidates.filter(m => m.tier === 'frontier' || m.tier === 'premium')
      break
      
    case 'complex-scene':
      // Act climaxes, emotional scenes, complex character moments
      // Use premium tier (Claude 3.5 Sonnet, GPT-4o)
      candidates = candidates.filter(m => m.tier === 'premium' || m.tier === 'frontier')
      break
      
    case 'simple-scene':
      // Transition scenes, simple dialogue
      // Standard tier is fine
      candidates = candidates.filter(m => m.tier === 'standard' || m.tier === 'premium')
      break
      
    case 'dialogue':
      // Fast models can handle dialogue well
      candidates = candidates.filter(m => 
        m.tier === 'fast' || m.tier === 'standard'
      )
      break
      
    case 'action':
      // Action scenes - standard tier
      candidates = candidates.filter(m => m.tier === 'standard' || m.tier === 'premium')
      break
      
    case 'editing':
      // Fast tier is perfect
      candidates = candidates.filter(m => m.tier === 'fast' || m.tier === 'standard')
      break
  }

  // Filter by context window if needed
  if (task.contextNeeded) {
    candidates = candidates.filter(m => m.contextWindow >= task.contextNeeded)
  }

  // Score and rank by priority
  const scored = candidates.map(model => {
    let score = 0

    switch (task.priority) {
      case 'quality':
        // Prefer expensive, reasoning models
        if (model.tier === 'frontier') score += 100
        if (model.tier === 'premium') score += 80
        if (model.reasoning) score += 20
        if (model.contextWindow > 100000) score += 10
        break

      case 'speed':
        // Prefer fast models
        if (model.speed === 'instant') score += 100
        if (model.speed === 'fast') score += 80
        if (model.cost === 'cheap') score += 20
        break

      case 'cost':
        // Prefer cheap models
        if (model.cost === 'cheap') score += 100
        if (model.cost === 'moderate') score += 50
        if (model.speed === 'instant' || model.speed === 'fast') score += 20
        break

      case 'balanced':
        // Balance all factors
        if (model.tier === 'standard') score += 100 // Sweet spot
        if (model.tier === 'premium') score += 80
        if (model.speed === 'fast' || model.speed === 'instant') score += 30
        if (model.cost === 'cheap') score += 30
        if (model.reasoning) score += 20
        break
    }

    return { model, score }
  })

  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score)

  return scored.length > 0 ? scored[0].model : null
}

/**
 * Get recommended orchestrator model from user's available models
 */
export function getRecommendedOrchestrator(availableModelIds: string[]): TieredModel | null {
  // Find all available models that are frontier tier
  const availableFrontier = MODEL_TIERS.filter(m => 
    m.tier === 'frontier' && 
    availableModelIds.some(id => id.includes(m.id) || m.id.includes(id))
  )

  if (availableFrontier.length > 0) {
    // Sort by reasoning capability and context window
    availableFrontier.sort((a, b) => {
      if (a.reasoning && !b.reasoning) return -1
      if (!a.reasoning && b.reasoning) return 1
      return b.contextWindow - a.contextWindow
    })
    return availableFrontier[0]
  }

  // Fallback to premium tier
  const availablePremium = MODEL_TIERS.filter(m => 
    m.tier === 'premium' &&
    availableModelIds.some(id => id.includes(m.id) || m.id.includes(id))
  )

  return availablePremium.length > 0 ? availablePremium[0] : null
}

