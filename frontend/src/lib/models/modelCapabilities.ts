/**
 * Model Capabilities Catalog
 * 
 * Central registry of all supported models with their capabilities,
 * roles, strengths, and metadata for intelligent task assignment.
 */

export type ModelRole = 'orchestrator' | 'writer' | 'editor' | 'researcher'
export type ModelSpeed = 'instant' | 'fast' | 'medium' | 'slow'
export type ModelCost = 'cheap' | 'moderate' | 'expensive'

export interface ModelCapabilities {
  /** Unique model identifier (matches API model name) */
  id: string
  
  /** Provider name (groq, openai, anthropic, google, deepseek) */
  provider: string
  
  /** Internal display name */
  name: string
  
  /** User-facing display name */
  displayName: string
  
  /** Roles this model can perform */
  roles: ModelRole[]
  
  /** Key strengths/features of this model */
  strengths: string[]
  
  /** Generation speed category */
  speed: ModelSpeed
  
  /** Cost category relative to other models */
  cost: ModelCost
  
  /** Maximum context window in tokens */
  contextWindow: number
  
  /** Maximum output tokens */
  maxOutputTokens: number
  
  /** Whether model supports system prompts */
  supportsSystemPrompt: boolean
  
  /** Whether model supports JSON mode */
  supportsJSONMode?: boolean
  
  /** Specialized capabilities (e.g., 'dialogue', 'action', 'technical') */
  specializations?: string[]
  
  /** Additional notes about the model */
  notes?: string
}

/**
 * Complete model catalog
 * Models are organized by provider and role for easy discovery
 */
export const MODEL_CATALOG: ModelCapabilities[] = [
  // ============================================================
  // GROQ MODELS
  // ============================================================
  
  // Groq Orchestrators
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B Versatile',
    displayName: 'Llama 3.3 70B Versatile',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Fast reasoning', 'Balanced quality', 'Versatile'],
    speed: 'instant',
    cost: 'cheap',
    contextWindow: 128000,
    maxOutputTokens: 32768,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['planning', 'analysis', 'structure'],
    notes: 'Excellent all-rounder for orchestration and writing'
  },
  {
    id: 'llama-3.1-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.1 70B Versatile',
    displayName: 'Llama 3.1 70B Versatile',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Stable', 'Reliable', 'Good reasoning'],
    speed: 'instant',
    cost: 'cheap',
    contextWindow: 128000,
    maxOutputTokens: 32768,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['planning', 'consistent-output'],
    notes: 'Stable predecessor to 3.3, very reliable'
  },
  
  // Groq Writers
  {
    id: 'llama-3.1-8b-instant',
    provider: 'groq',
    name: 'Llama 3.1 8B Instant',
    displayName: 'Llama 3.1 8B Instant',
    roles: ['writer'],
    strengths: ['Ultra fast', 'Simple tasks', 'Low cost'],
    speed: 'instant',
    cost: 'cheap',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['short-form', 'simple-prose', 'transitions'],
    notes: 'Best for simple, short writing tasks (< 500 words)'
  },
  {
    id: 'mixtral-8x7b-32768',
    provider: 'groq',
    name: 'Mixtral 8x7B',
    displayName: 'Mixtral 8x7B',
    roles: ['writer', 'editor'],
    strengths: ['Creative', 'Detailed', 'Multilingual'],
    speed: 'fast',
    cost: 'cheap',
    contextWindow: 32768,
    maxOutputTokens: 32768,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['creative-writing', 'descriptions', 'world-building'],
    notes: 'Great for creative, detailed prose'
  },
  {
    id: 'llama-3.2-90b-text-preview',
    provider: 'groq',
    name: 'Llama 3.2 90B',
    displayName: 'Llama 3.2 90B Preview',
    roles: ['orchestrator', 'writer'],
    strengths: ['Large context', 'Complex reasoning', 'Preview access'],
    speed: 'fast',
    cost: 'moderate',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['long-context', 'complex-planning'],
    notes: 'Preview model with enhanced capabilities'
  },
  
  // ============================================================
  // OPENAI MODELS
  // ============================================================
  
  // OpenAI Orchestrators
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    displayName: 'GPT-4o',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Best reasoning', 'Complex tasks', 'Most reliable'],
    speed: 'medium',
    cost: 'expensive',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['planning', 'complex-reasoning', 'structure', 'analysis'],
    notes: 'Best overall orchestrator - highest quality reasoning'
  },
  {
    id: 'gpt-4o-2024-11-20',
    provider: 'openai',
    name: 'GPT-4o (Latest)',
    displayName: 'GPT-4o (Nov 2024)',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Latest improvements', 'Best reasoning', 'Reliable'],
    speed: 'medium',
    cost: 'expensive',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['planning', 'complex-reasoning', 'structure'],
    notes: 'Latest GPT-4o with improvements'
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    name: 'GPT-4 Turbo',
    displayName: 'GPT-4 Turbo',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Fast GPT-4', 'Large context', 'Reliable'],
    speed: 'medium',
    cost: 'expensive',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['planning', 'long-context', 'reasoning'],
    notes: 'Faster variant of GPT-4 with large context'
  },
  
  // OpenAI Writers
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o Mini',
    displayName: 'GPT-4o Mini',
    roles: ['writer', 'editor'],
    strengths: ['Good balance', 'Reliable', 'Fast'],
    speed: 'fast',
    cost: 'cheap',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['general-writing', 'editing', 'consistent-style'],
    notes: 'Excellent cost/quality balance for writing tasks'
  },
  {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    name: 'GPT-3.5 Turbo',
    displayName: 'GPT-3.5 Turbo',
    roles: ['writer'],
    strengths: ['Very fast', 'Cheap', 'Simple tasks'],
    speed: 'fast',
    cost: 'cheap',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['simple-prose', 'dialogue', 'short-form'],
    notes: 'Legacy model, still useful for simple writing'
  },
  
  // ============================================================
  // ANTHROPIC MODELS
  // ============================================================
  
  // Anthropic Orchestrators
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    displayName: 'Claude 3.5 Sonnet',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Creative reasoning', 'Long-form', 'Nuanced', 'Thoughtful'],
    speed: 'medium',
    cost: 'expensive',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['creative-planning', 'character-depth', 'thematic-analysis'],
    notes: 'Best for creative, character-driven stories'
  },
  {
    id: 'claude-3-5-sonnet-20240620',
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet (Legacy)',
    displayName: 'Claude 3.5 Sonnet (Jun 2024)',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Creative', 'Thoughtful', 'Long context'],
    speed: 'medium',
    cost: 'expensive',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['creative-writing', 'analysis'],
    notes: 'Previous Sonnet version'
  },
  
  // Anthropic Writers
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    name: 'Claude 3.5 Haiku',
    displayName: 'Claude 3.5 Haiku',
    roles: ['writer', 'editor'],
    strengths: ['Fast', 'Creative', 'Good quality'],
    speed: 'fast',
    cost: 'cheap',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['creative-prose', 'dialogue', 'descriptions'],
    notes: 'Fast, creative writing for most tasks'
  },
  {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    displayName: 'Claude 3 Opus',
    roles: ['orchestrator', 'writer', 'editor'],
    strengths: ['Highest quality', 'Complex reasoning', 'Deep analysis'],
    speed: 'slow',
    cost: 'expensive',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['complex-planning', 'literary-quality', 'depth'],
    notes: 'Most capable Claude model, but slower and expensive'
  },
  
  // ============================================================
  // GOOGLE MODELS
  // ============================================================
  
  {
    id: 'gemini-2.0-flash-thinking-exp',
    provider: 'google',
    name: 'Gemini 2.0 Flash Thinking',
    displayName: 'Gemini 2.0 Flash Thinking',
    roles: ['orchestrator'],
    strengths: ['Fast reasoning', 'Chain-of-thought', 'Experimental'],
    speed: 'fast',
    cost: 'moderate',
    contextWindow: 32000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['reasoning', 'planning', 'analysis'],
    notes: 'Experimental reasoning model with visible thought process'
  },
  {
    id: 'gemini-1.5-pro',
    provider: 'google',
    name: 'Gemini 1.5 Pro',
    displayName: 'Gemini 1.5 Pro',
    roles: ['orchestrator', 'writer'],
    strengths: ['Huge context', 'Multimodal', 'Long documents'],
    speed: 'medium',
    cost: 'expensive',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['long-context', 'research', 'analysis'],
    notes: '2M token context - best for very long documents'
  },
  {
    id: 'gemini-1.5-flash',
    provider: 'google',
    name: 'Gemini 1.5 Flash',
    displayName: 'Gemini 1.5 Flash',
    roles: ['writer'],
    strengths: ['Fast', 'Large context', 'Good quality'],
    speed: 'fast',
    cost: 'cheap',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['general-writing', 'speed'],
    notes: 'Fast with 1M context, great for quick writing'
  },
  
  // ============================================================
  // DEEPSEEK MODELS
  // ============================================================
  
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    name: 'DeepSeek R1',
    displayName: 'DeepSeek R1 (Reasoner)',
    roles: ['orchestrator'],
    strengths: ['Chain-of-thought', 'Math', 'Logic', 'Structured reasoning'],
    speed: 'slow',
    cost: 'moderate',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    supportsSystemPrompt: true,
    supportsJSONMode: true,
    specializations: ['reasoning', 'planning', 'logic', 'structure'],
    notes: 'Built for reasoning - shows explicit thinking process'
  },
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    name: 'DeepSeek Chat',
    displayName: 'DeepSeek Chat',
    roles: ['writer', 'editor'],
    strengths: ['Good quality', 'Affordable', 'Long context'],
    speed: 'fast',
    cost: 'cheap',
    contextWindow: 64000,
    maxOutputTokens: 4096,
    supportsSystemPrompt: true,
    supportsJSONMode: false,
    specializations: ['general-writing', 'technical-content'],
    notes: 'Solid writing model at low cost'
  }
]

/**
 * Get models suitable for orchestrator role
 */
export const ORCHESTRATOR_MODELS = MODEL_CATALOG.filter(model =>
  model.roles.includes('orchestrator')
)

/**
 * Get models suitable for writer role
 */
export const WRITER_MODELS = MODEL_CATALOG.filter(model =>
  model.roles.includes('writer')
)

/**
 * Get models suitable for editor role
 */
export const EDITOR_MODELS = MODEL_CATALOG.filter(model =>
  model.roles.includes('editor')
)

/**
 * Get model by ID
 */
export function getModelById(modelId: string): ModelCapabilities | undefined {
  return MODEL_CATALOG.find(model => model.id === modelId)
}

/**
 * Get all models for a specific role
 */
export function getModelsForRole(role: ModelRole): ModelCapabilities[] {
  return MODEL_CATALOG.filter(model => model.roles.includes(role))
}

/**
 * Get all models for a specific provider
 */
export function getModelsForProvider(provider: string): ModelCapabilities[] {
  return MODEL_CATALOG.filter(model => model.provider === provider)
}

/**
 * Get all models for a specific provider and role
 */
export function getModelsForProviderAndRole(
  provider: string,
  role: ModelRole
): ModelCapabilities[] {
  return MODEL_CATALOG.filter(
    model => model.provider === provider && model.roles.includes(role)
  )
}

/**
 * Check if a model supports a specific role
 */
export function modelSupportsRole(modelId: string, role: ModelRole): boolean {
  const model = getModelById(modelId)
  return model?.roles.includes(role) ?? false
}

/**
 * Get default orchestrator for a provider
 * Returns the best orchestrator model for the given provider
 */
export function getDefaultOrchestrator(provider: string): ModelCapabilities | undefined {
  const orchestrators = getModelsForProviderAndRole(provider, 'orchestrator')
  
  // Prioritize by quality (expensive models first)
  const sorted = orchestrators.sort((a, b) => {
    if (a.cost === 'expensive' && b.cost !== 'expensive') return -1
    if (b.cost === 'expensive' && a.cost !== 'expensive') return 1
    return 0
  })
  
  return sorted[0]
}

/**
 * Get default writers for a provider
 * Returns recommended writer models (usually 2-3 with different speeds)
 */
export function getDefaultWriters(provider: string): ModelCapabilities[] {
  const writers = getModelsForProviderAndRole(provider, 'writer')
  
  // Try to get a mix: one fast, one balanced
  const fast = writers.find(m => m.speed === 'instant' || m.speed === 'fast')
  const balanced = writers.find(m => 
    m.speed === 'medium' || 
    (m.cost === 'cheap' && m.speed === 'fast')
  )
  
  const result: ModelCapabilities[] = []
  if (fast) result.push(fast)
  if (balanced && balanced.id !== fast?.id) result.push(balanced)
  
  // If we don't have 2, just return first 2 writers
  if (result.length < 2) {
    return writers.slice(0, 2)
  }
  
  return result
}

