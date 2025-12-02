/**
 * Model Router - Unified Model Selection & Tier System
 * 
 * SINGLE SOURCE OF TRUTH for all model definitions and selection logic
 * 
 * Two selection approaches:
 * 1. selectModel() - Orchestrator-focused (complexity-based)
 * 2. selectModelForTask() - Writer delegation (tier-based)
 * 
 * Inspired by Agentic Flow's Model Router
 * @see https://github.com/ruvnet/agentic-flow
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type ModelPriority = 'cost' | 'speed' | 'quality' | 'balanced'
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'reasoning'
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
  structuredOutput: 'full' | 'json-mode' | 'none' // NEW: Structured output support
  
  // Performance
  speed: 'instant' | 'fast' | 'medium' | 'slow'
  cost: 'cheap' | 'moderate' | 'expensive'
  
  // Best use cases
  bestFor: Array<'orchestration' | 'complex-writing' | 'general-writing' | 'editing' | 'speed-writing'>
}

export interface ModelCapability {
  modelId: string
  provider: 'openai' | 'anthropic' | 'groq' | 'google'
  displayName: string
  costPer1kTokens: number
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

export interface TaskRequirements {
  type: 'orchestration' | 'complex-scene' | 'simple-scene' | 'dialogue' | 'action' | 'editing'
  wordCount?: number
  contextNeeded?: number
  priority: 'quality' | 'speed' | 'cost' | 'balanced'
}

// ============================================================
// MODEL TIER REGISTRY - SINGLE SOURCE OF TRUTH
// ============================================================

/**
 * STRUCTURED OUTPUT SUPPORT LEVELS:
 * 
 * 'full' - Native structured output with schema validation
 *   - OpenAI: response_format: { type: "json_schema", json_schema: {...} }
 *   - Anthropic: Tool use with forced tool call
 *   - Google: Function calling
 *   - Guarantees valid JSON matching exact schema
 *   - Best for: Critical data extraction, structure generation
 * 
 * 'json-mode' - Basic JSON formatting (no schema validation)
 *   - Groq/Llama: response_format: { type: "json_object" }
 *   - Encourages JSON output but doesn't validate structure
 *   - May produce invalid or non-conformant JSON
 *   - Best for: Simple JSON, with fallback parsing
 * 
 * 'none' - String-based responses only
 *   - DeepSeek and other models without JSON support
 *   - Requires manual prompt engineering + regex parsing
 *   - Highest risk of parsing errors
 *   - Best for: Narrative content, not structured data
 */

export const MODEL_TIERS: TieredModel[] = [
  // ============================================================
  // FRONTIER TIER - For Orchestration & Complex Planning
  // ============================================================
  {
    id: 'gpt-5.1-2025-11-13', // Snapshot ID (required by API)
    provider: 'openai',
    displayName: 'GPT-5.1',
    tier: 'frontier',
    contextWindow: 200000,
    reasoning: true,
    multimodal: false,
    structuredOutput: 'full', // OpenAI native JSON schema support
    speed: 'medium',
    cost: 'expensive',
    bestFor: ['orchestration', 'complex-writing']
  },
  {
    id: 'gpt-5.1', // Alias (fallback if snapshot fails)
    provider: 'openai',
    displayName: 'GPT-5.1 (alias)',
    tier: 'frontier',
    contextWindow: 200000,
    reasoning: true,
    multimodal: false,
    structuredOutput: 'full', // OpenAI native JSON schema support
    speed: 'medium',
    cost: 'expensive',
    bestFor: ['orchestration', 'complex-writing']
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    displayName: 'GPT-4.1',
    tier: 'frontier',
    contextWindow: 128000,
    reasoning: true,
    multimodal: true,
    structuredOutput: 'full',
    speed: 'medium',
    cost: 'expensive',
    bestFor: ['orchestration', 'complex-writing']
  },
  {
    id: 'o4',
    provider: 'openai',
    displayName: 'OpenAI o4',
    tier: 'frontier',
    contextWindow: 128000,
    reasoning: true,
    multimodal: false,
    structuredOutput: 'full',
    speed: 'slow',
    cost: 'expensive',
    bestFor: ['orchestration']
  },
  {
    id: 'o3',
    provider: 'openai',
    displayName: 'OpenAI o3',
    tier: 'frontier',
    contextWindow: 128000,
    reasoning: true,
    multimodal: false,
    structuredOutput: 'full',
    speed: 'slow',
    cost: 'expensive',
    bestFor: ['orchestration']
  },
  {
    id: 'claude-sonnet-4.5',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    tier: 'frontier',
    contextWindow: 200000,
    reasoning: true,
    multimodal: true,
    structuredOutput: 'full', // Anthropic tool use (forced tool call)
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
    structuredOutput: 'full', // OpenAI native JSON schema support
    speed: 'slow',
    cost: 'expensive',
    bestFor: ['orchestration']
  },
  
  // ============================================================
  // PREMIUM TIER - High Quality Writers
  // ============================================================
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    displayName: 'GPT-5 Mini',
    tier: 'premium',
    contextWindow: 128000,
    reasoning: true,
    multimodal: true,
    structuredOutput: 'full',
    speed: 'fast',
    cost: 'moderate',
    bestFor: ['complex-writing', 'general-writing']
  },
  {
    id: 'gpt-4.1-mini',
    provider: 'openai',
    displayName: 'GPT-4.1 Mini',
    tier: 'premium',
    contextWindow: 128000,
    reasoning: true,
    multimodal: true,
    structuredOutput: 'full',
    speed: 'fast',
    cost: 'moderate',
    bestFor: ['complex-writing', 'general-writing']
  },
  {
    id: 'o4-mini',
    provider: 'openai',
    displayName: 'OpenAI o4 Mini',
    tier: 'premium',
    contextWindow: 128000,
    reasoning: true,
    multimodal: false,
    structuredOutput: 'full',
    speed: 'medium',
    cost: 'moderate',
    bestFor: ['complex-writing']
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    tier: 'premium',
    contextWindow: 200000,
    reasoning: false,
    multimodal: true,
    structuredOutput: 'full', // Anthropic tool use
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
    structuredOutput: 'full', // OpenAI JSON schema (2024-08-06+)
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
    structuredOutput: 'full', // OpenAI JSON schema
    speed: 'fast',
    cost: 'expensive',
    bestFor: ['complex-writing', 'general-writing']
  },
  {
    id: 'gemini-2.0-flash-exp',
    provider: 'google',
    displayName: 'Gemini 2.0 Flash',
    tier: 'premium',
    contextWindow: 1000000,
    reasoning: false,
    multimodal: true,
    structuredOutput: 'full', // Google function calling
    speed: 'fast',
    cost: 'cheap',
    bestFor: ['complex-writing', 'general-writing']
  },
  
  // ============================================================
  // STANDARD TIER - Balanced Writers
  // ============================================================
  {
    id: 'gpt-5-nano',
    provider: 'openai',
    displayName: 'GPT-5 Nano',
    tier: 'standard',
    contextWindow: 128000,
    reasoning: false,
    multimodal: true,
    structuredOutput: 'full',
    speed: 'instant',
    cost: 'cheap',
    bestFor: ['general-writing', 'editing', 'speed-writing']
  },
  {
    id: 'gpt-4.1-nano',
    provider: 'openai',
    displayName: 'GPT-4.1 Nano',
    tier: 'standard',
    contextWindow: 128000,
    reasoning: false,
    multimodal: true,
    structuredOutput: 'full',
    speed: 'instant',
    cost: 'cheap',
    bestFor: ['general-writing', 'editing', 'speed-writing']
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    displayName: 'Llama 3.3 70B',
    tier: 'standard',
    contextWindow: 128000,
    reasoning: false,
    multimodal: false,
    structuredOutput: 'json-mode', // Groq JSON mode (no schema validation)
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
    structuredOutput: 'full', // OpenAI JSON schema
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
    structuredOutput: 'full', // Anthropic tool use
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
    structuredOutput: 'json-mode', // Groq JSON mode
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
    structuredOutput: 'json-mode', // Groq JSON mode
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
    structuredOutput: 'full', // Google function calling
    speed: 'fast',
    cost: 'cheap',
    bestFor: ['speed-writing', 'general-writing']
  }
]

// ============================================================
// TIER-BASED SELECTION (For Writer Delegation)
// ============================================================

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
 * Get models with structured output support
 * @param level - 'full' for schema validation, 'json-mode' for basic JSON, 'any' for json-mode or better
 */
export function getModelsWithStructuredOutput(
  level: 'full' | 'json-mode' | 'any' = 'full'
): TieredModel[] {
  if (level === 'full') {
    return MODEL_TIERS.filter(m => m.structuredOutput === 'full')
  } else if (level === 'json-mode') {
    return MODEL_TIERS.filter(m => m.structuredOutput === 'json-mode')
  } else {
    return MODEL_TIERS.filter(m => m.structuredOutput !== 'none')
  }
}

/**
 * Check if a model supports structured outputs
 */
export function supportsStructuredOutput(modelId: string, requireFull: boolean = true): boolean {
  const model = MODEL_TIERS.find(m => m.id === modelId)
  if (!model) return false
  
  if (requireFull) {
    return model.structuredOutput === 'full'
  } else {
    return model.structuredOutput === 'full' || model.structuredOutput === 'json-mode'
  }
}

/**
 * Check if a model is frontier-tier
 */
export function isFrontierModel(modelId: string): boolean {
  const model = MODEL_TIERS.find(m => m.id === modelId || modelId.startsWith(m.id))
  return model?.tier === 'frontier'
}

/**
 * Select best model for a writing task (TIER-BASED)
 * Used by orchestrator when delegating to writers
 */
export function selectModelForTask(
  task: TaskRequirements,
  availableModels: TieredModel[]
): TieredModel | null {
  if (availableModels.length === 0) return null

  // Filter by capability
  let candidates = availableModels

  switch (task.type) {
    case 'orchestration':
      candidates = candidates.filter(m => m.tier === 'frontier' || m.tier === 'premium')
      break
      
    case 'complex-scene':
      candidates = candidates.filter(m => m.tier === 'premium' || m.tier === 'frontier')
      break
      
    case 'simple-scene':
      candidates = candidates.filter(m => m.tier === 'standard' || m.tier === 'premium')
      break
      
    case 'dialogue':
      candidates = candidates.filter(m => m.tier === 'fast' || m.tier === 'standard')
      break
      
    case 'action':
      candidates = candidates.filter(m => m.tier === 'standard' || m.tier === 'premium')
      break
      
    case 'editing':
      candidates = candidates.filter(m => m.tier === 'fast' || m.tier === 'standard')
      break
  }

  // Filter by context window if needed
  if (task.contextNeeded && task.contextNeeded > 0) {
    candidates = candidates.filter(m => m.contextWindow >= (task.contextNeeded || 0))
  }

  // Score and rank by priority
  const scored = candidates.map(model => {
    let score = 0

    switch (task.priority) {
      case 'quality':
        if (model.tier === 'frontier') score += 100
        if (model.tier === 'premium') score += 80
        if (model.reasoning) score += 20
        if (model.contextWindow > 100000) score += 10
        break

      case 'speed':
        if (model.speed === 'instant') score += 100
        if (model.speed === 'fast') score += 80
        if (model.cost === 'cheap') score += 20
        break

      case 'cost':
        if (model.cost === 'cheap') score += 100
        if (model.cost === 'moderate') score += 50
        if (model.speed === 'instant' || model.speed === 'fast') score += 20
        break

      case 'balanced':
        if (model.tier === 'standard') score += 100
        if (model.tier === 'premium') score += 80
        if (model.speed === 'fast' || model.speed === 'instant') score += 30
        if (model.cost === 'cheap') score += 30
        if (model.reasoning) score += 20
        break
    }

    return { model, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.length > 0 ? scored[0].model : null
}

/**
 * Get recommended orchestrator model from user's available models
 */
export function getRecommendedOrchestrator(availableModelIds: string[]): TieredModel | null {
  const availableFrontier = MODEL_TIERS.filter(m => 
    m.tier === 'frontier' && 
    availableModelIds.some(id => id.includes(m.id) || m.id.includes(id))
  )

  if (availableFrontier.length > 0) {
    availableFrontier.sort((a, b) => {
      if (a.reasoning && !b.reasoning) return -1
      if (!a.reasoning && b.reasoning) return 1
      return b.contextWindow - a.contextWindow
    })
    return availableFrontier[0]
  }

  const availablePremium = MODEL_TIERS.filter(m => 
    m.tier === 'premium' &&
    availableModelIds.some(id => id.includes(m.id) || m.id.includes(id))
  )

  return availablePremium.length > 0 ? availablePremium[0] : null
}

// ============================================================
// COMPLEXITY-BASED SELECTION (For Orchestrator)
// ============================================================

/**
 * Convert TieredModel to ModelCapability for backwards compatibility
 */
function convertToModelCapability(tiered: TieredModel): ModelCapability {
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
  
  const speedTokensPerSec = 
    tiered.speed === 'instant' ? 500 :
    tiered.speed === 'fast' ? 150 :
    tiered.speed === 'medium' ? 50 : 30
  
  const costPer1kTokens =
    tiered.cost === 'cheap' ? 0.0005 :
    tiered.cost === 'moderate' ? 0.005 : 0.05
  
  return {
    modelId: tiered.id,
    provider: tiered.provider as any,
    displayName: tiered.displayName,
    costPer1kTokens,
    speedTokensPerSec,
    contextWindow: tiered.contextWindow,
    capabilities: {
      reasoning: tiered.reasoning,
      streaming: true,
      functionCalling: true,
      vision: tiered.multimodal
    },
    bestFor: bestFor.length > 0 ? bestFor : ['moderate']
  }
}

/**
 * Get MODEL_REGISTRY from unified MODEL_TIERS
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
  
  return 'simple'
}

/**
 * PHASE 1.2: Convert TieredModel to ModelCapability for selectModel() scoring
 * This allows us to use both static MODEL_TIERS and dynamic available models
 * 
 * ✅ STEP 3: Now uses actual pricing and speed from database metadata when available
 */
function convertTieredToCapability(tiered: TieredModel): ModelCapability {
  // ✅ STEP 3: Check for actual pricing from database metadata (enriched in /api/models/available)
  const enrichedModel = tiered as any // Type assertion to access enriched fields
  const actualCostPer1kInput = enrichedModel.cost_per_1k_tokens_input
  const actualSpeedTokensPerSec = enrichedModel.speed_tokens_per_sec
  
  // Fallback to estimated cost if actual pricing not available
  const costMap: Record<string, number> = {
    'cheap': 0.2,
    'moderate': 1.5,
    'expensive': 10.0
  }
  
  // Fallback to estimated speed if actual speed not available
  const speedMap: Record<string, number> = {
    'instant': 500,
    'fast': 200,
    'medium': 100,
    'slow': 50
  }
  
  // ✅ Use actual pricing from metadata if available, otherwise estimate
  const costPer1kTokens = actualCostPer1kInput !== null && actualCostPer1kInput !== undefined
    ? actualCostPer1kInput
    : (costMap[tiered.cost] || 1.0)
  
  // ✅ Use actual speed from metadata if available, otherwise estimate
  const speedTokensPerSec = actualSpeedTokensPerSec !== null && actualSpeedTokensPerSec !== undefined
    ? actualSpeedTokensPerSec
    : (speedMap[tiered.speed] || 100)
  
  // Map bestFor from TieredModel to TaskComplexity for ModelCapability
  const bestForMap: Record<string, TaskComplexity[]> = {
    'orchestration': ['reasoning', 'complex'],
    'complex-writing': ['complex', 'moderate'],
    'general-writing': ['moderate', 'simple'],
    'editing': ['simple', 'moderate'],
    'speed-writing': ['simple']
  }
  
  const bestFor: TaskComplexity[] = []
  tiered.bestFor.forEach(use => {
    const mapped = bestForMap[use]
    if (mapped) bestFor.push(...mapped)
  })
  
  // Deduplicate
  const uniqueBestFor = [...new Set(bestFor)]
  
  // Log if using actual vs estimated values (for debugging)
  if (actualCostPer1kInput !== null && actualCostPer1kInput !== undefined) {
    console.log(`💰 [Model Router] Using actual pricing for ${tiered.id}: $${actualCostPer1kInput}/1k tokens`)
  }
  if (actualSpeedTokensPerSec !== null && actualSpeedTokensPerSec !== undefined) {
    console.log(`⚡ [Model Router] Using actual speed for ${tiered.id}: ${actualSpeedTokensPerSec} tokens/sec`)
  }
  
  return {
    modelId: tiered.id,
    provider: tiered.provider as 'openai' | 'anthropic' | 'groq' | 'google',
    displayName: tiered.displayName,
    costPer1kTokens: costPer1kTokens,
    speedTokensPerSec: speedTokensPerSec,
    contextWindow: tiered.contextWindow,
    capabilities: {
      reasoning: tiered.reasoning,
      streaming: true, // Assume all models support streaming
      functionCalling: tiered.structuredOutput !== 'none',
      vision: tiered.multimodal
    },
    bestFor: uniqueBestFor.length > 0 ? uniqueBestFor : ['moderate']
  }
}

/**
 * Select best model based on complexity (COMPLEXITY-BASED)
 * Used by orchestrator for its own operations
 * 
 * PHASE 1.2: Now accepts optional availableModels parameter
 * If provided, uses those models instead of MODEL_REGISTRY
 * 
 * PHASE 2: Now accepts optional requireReasoning parameter
 * If true, only reasoning-capable models are considered
 */
export function selectModel(
  taskComplexity: TaskComplexity,
  priority: ModelPriority = 'balanced',
  availableProviders: string[] = ['openai', 'groq', 'anthropic', 'google'],
  availableModels?: TieredModel[], // PHASE 1.2: Optional dynamic models
  requireReasoning: boolean = false // PHASE 2: Filter for reasoning models only
): ModelSelection {
  // PHASE 1.2: Use provided models or fall back to MODEL_REGISTRY
  const MODEL_REGISTRY = availableModels ? 
    // Convert TieredModel[] to ModelCapability[] for scoring
    availableModels.map(convertTieredToCapability) :
    getModelRegistry()
  
  console.log(`🔍 [selectModel] Selecting from ${MODEL_REGISTRY.length} models (${availableModels ? 'dynamic' : 'static'}) for ${taskComplexity} task (reasoning=${requireReasoning})`)
  
  // PHASE 2: Filter by reasoning capability if required
  let candidates = MODEL_REGISTRY.filter(model => 
    availableProviders.includes(model.provider) &&
    model.bestFor.includes(taskComplexity)
  )
  
  console.log(`🔍 [selectModel] After complexity filter: ${candidates.length} candidates`)
  
  if (requireReasoning) {
    const reasoningCandidates = candidates.filter(m => m.capabilities.reasoning)
    
    if (reasoningCandidates.length > 0) {
      candidates = reasoningCandidates
      console.log(`🧠 [Model Router] Filtered to ${candidates.length} reasoning models`)
    } else {
      console.warn('⚠️ [Model Router] No reasoning models available, using all candidates')
    }
  }
  
  if (candidates.length === 0) {
    // ✅ FIX: Search ONLY in MODEL_REGISTRY (which is already filtered to availableModels if provided)
    // Don't search the global MODEL_TIERS - only search what the user has access to
    const fallback = MODEL_REGISTRY.find(m => availableProviders.includes(m.provider))
    if (!fallback) {
      throw new Error(`No available models found for providers: ${availableProviders.join(', ')}. Please check your API keys.`)
    }
    
    console.warn(`⚠️ [Model Router] No models matched ${taskComplexity} + reasoning=${requireReasoning}. Falling back to ${fallback.displayName}`)
    
    return {
      modelId: fallback.modelId,
      provider: fallback.provider,
      reasoning: `Using ${fallback.displayName} (best available model for your API keys)`,
      estimatedCost: fallback.costPer1kTokens * 2,
      estimatedTime: 2000 / fallback.speedTokensPerSec
    }
  }
  
  const scored = candidates.map(model => {
    let score = 0
    
    switch (priority) {
      case 'cost':
        score = 1 / (model.costPer1kTokens + 0.0001)
        break
        
      case 'speed':
        score = model.speedTokensPerSec
        break
        
      case 'quality':
        if (model.capabilities.reasoning) score += 100
        if (model.bestFor.includes('complex')) score += 50
        if (model.bestFor.includes('reasoning')) score += 75
        score += model.contextWindow / 1000
        break
        
      case 'balanced':
        const costScore = 1 / (model.costPer1kTokens + 0.0001)
        const speedScore = model.speedTokensPerSec / 100
        const qualityScore = model.contextWindow / 10000
        score = costScore * 0.4 + speedScore * 0.3 + qualityScore * 0.3
        break
    }
    
    return { model, score }
  })
  
  scored.sort((a, b) => b.score - a.score)
  const selected = scored[0].model
  
  let reasoning = `Selected ${selected.displayName} for ${taskComplexity} task (${priority} priority)`
  
  // ✅ STEP 3: Show actual pricing/speed in reasoning when available
  if (priority === 'cost') {
    const costDisplay = selected.costPer1kTokens < 1 
      ? `$${selected.costPer1kTokens.toFixed(4)}` 
      : `$${selected.costPer1kTokens.toFixed(2)}`
    reasoning += ` - Cheapest option at ${costDisplay}/1k tokens`
  } else if (priority === 'speed') {
    reasoning += ` - Fastest at ${selected.speedTokensPerSec} tokens/sec`
  } else if (priority === 'quality') {
    reasoning += ` - Best quality with ${selected.contextWindow.toLocaleString()} token context`
  }
  
  console.log(`✅ [selectModel] ${reasoning}`)
  
  // ✅ STEP 3: Use actual pricing for cost estimation (more accurate)
  const estimatedCost = selected.costPer1kTokens * 2 // Assume ~2k tokens for typical request
  const estimatedTime = 2000 / selected.speedTokensPerSec // Assume ~2k tokens output
  
  return {
    modelId: selected.modelId,
    provider: selected.provider,
    reasoning,
    estimatedCost,
    estimatedTime
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get model info by ID
 */
export function getModelInfo(modelId: string): ModelCapability | undefined {
  const MODEL_REGISTRY = getModelRegistry()
  return MODEL_REGISTRY.find(m => m.modelId === modelId)
}

/**
 * Get TieredModel by ID
 */
export function getTieredModelInfo(modelId: string): TieredModel | undefined {
  return MODEL_TIERS.find(m => m.id === modelId)
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
