/**
 * Groq API Types
 * Based on: https://console.groq.com/docs/models
 */

export interface GroqModel {
  id: string
  object: string
  created: number
  owned_by: string
  active: boolean
  context_window: number
  public_apps: any
}

export interface GroqModelsResponse {
  object: string
  data: GroqModel[]
}

export interface GroqModelWithPricing extends GroqModel {
  // Pricing information (manually maintained from docs)
  speed_tokens_per_sec?: number
  price_per_1m_input?: number
  price_per_1m_output?: number
  rate_limit_tpm?: string
  rate_limit_rpm?: string
  max_completion_tokens?: number
  category?: 'production' | 'preview' | 'deprecated'
  description?: string
}

/**
 * Pricing data from Groq documentation
 * Source: https://console.groq.com/docs/models
 */
export const GROQ_MODEL_PRICING: Record<string, Partial<GroqModelWithPricing>> = {
  // Production Models
  'llama-3.1-8b-instant': {
    speed_tokens_per_sec: 560,
    price_per_1m_input: 0.05,
    price_per_1m_output: 0.08,
    rate_limit_tpm: '250K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 131072,
    category: 'production',
    description: 'Meta Llama 3.1 8B - Fast and efficient'
  },
  'llama-3.3-70b-versatile': {
    speed_tokens_per_sec: 280,
    price_per_1m_input: 0.59,
    price_per_1m_output: 0.79,
    rate_limit_tpm: '300K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 32768,
    category: 'production',
    description: 'Meta Llama 3.3 70B - Versatile and powerful'
  },
  'meta-llama/llama-guard-4-12b': {
    speed_tokens_per_sec: 1200,
    price_per_1m_input: 0.20,
    price_per_1m_output: 0.20,
    rate_limit_tpm: '30K TPM',
    rate_limit_rpm: '100 RPM',
    max_completion_tokens: 1024,
    category: 'production',
    description: 'Meta Llama Guard 4 12B - Safety model'
  },
  'openai/gpt-oss-120b': {
    speed_tokens_per_sec: 500,
    price_per_1m_input: 0.15,
    price_per_1m_output: 0.60,
    rate_limit_tpm: '250K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 65536,
    category: 'production',
    description: 'OpenAI GPT OSS 120B - Flagship open-weight model with reasoning'
  },
  'openai/gpt-oss-20b': {
    speed_tokens_per_sec: 1000,
    price_per_1m_input: 0.075,
    price_per_1m_output: 0.30,
    rate_limit_tpm: '250K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 65536,
    category: 'production',
    description: 'OpenAI GPT OSS 20B - Fast and cost-effective'
  },
  'whisper-large-v3': {
    speed_tokens_per_sec: undefined,
    price_per_1m_input: 0.111, // per hour
    price_per_1m_output: undefined,
    rate_limit_tpm: '200K ASH',
    rate_limit_rpm: '300 RPM',
    category: 'production',
    description: 'OpenAI Whisper - Speech to text'
  },
  'whisper-large-v3-turbo': {
    speed_tokens_per_sec: undefined,
    price_per_1m_input: 0.04, // per hour
    price_per_1m_output: undefined,
    rate_limit_tpm: '400K ASH',
    rate_limit_rpm: '400 RPM',
    category: 'production',
    description: 'OpenAI Whisper Turbo - Faster speech to text'
  },
  // Systems
  'groq/compound': {
    speed_tokens_per_sec: 450,
    rate_limit_tpm: '200K TPM',
    rate_limit_rpm: '200 RPM',
    max_completion_tokens: 8192,
    category: 'production',
    description: 'Groq Compound - AI system with built-in tools'
  },
  'groq/compound-mini': {
    speed_tokens_per_sec: 450,
    rate_limit_tpm: '200K TPM',
    rate_limit_rpm: '200 RPM',
    max_completion_tokens: 8192,
    category: 'production',
    description: 'Groq Compound Mini - Lighter AI system'
  },
  // Preview Models
  'meta-llama/llama-4-maverick-17b-128e-instruct': {
    speed_tokens_per_sec: 600,
    price_per_1m_input: 0.20,
    price_per_1m_output: 0.60,
    rate_limit_tpm: '300K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 8192,
    category: 'preview',
    description: 'Meta Llama 4 Maverick 17B - Preview model'
  },
  'meta-llama/llama-4-scout-17b-16e-instruct': {
    speed_tokens_per_sec: 750,
    price_per_1m_input: 0.11,
    price_per_1m_output: 0.34,
    rate_limit_tpm: '300K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 8192,
    category: 'preview',
    description: 'Meta Llama 4 Scout 17B - Preview model'
  },
  'moonshotai/kimi-k2-instruct-0905': {
    speed_tokens_per_sec: 200,
    price_per_1m_input: 1.00,
    price_per_1m_output: 3.00,
    rate_limit_tpm: '250K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 16384,
    category: 'preview',
    description: 'Moonshot AI Kimi K2 - Large context window'
  },
  'qwen/qwen3-32b': {
    speed_tokens_per_sec: 400,
    price_per_1m_input: 0.29,
    price_per_1m_output: 0.59,
    rate_limit_tpm: '300K TPM',
    rate_limit_rpm: '1K RPM',
    max_completion_tokens: 40960,
    category: 'preview',
    description: 'Alibaba Cloud Qwen3 32B'
  }
}

export function enrichModelWithPricing(model: GroqModel): GroqModelWithPricing {
  const pricing = GROQ_MODEL_PRICING[model.id] || {}
  return {
    ...model,
    ...pricing
  }
}

/**
 * Check if a model supports chat/text generation (not STT, TTS, or moderation)
 */
export function isChatModel(model: GroqModelWithPricing): boolean {
  const modelId = model.id.toLowerCase()
  
  // Exclude speech-to-text models
  if (modelId.includes('whisper')) return false
  
  // Exclude text-to-speech models
  if (modelId.includes('tts') || modelId.includes('playai')) return false
  
  // Exclude moderation/safety models
  if (modelId.includes('guard') || modelId.includes('safeguard')) return false
  
  // Exclude system models without clear pricing (compound models are experimental)
  if (modelId.includes('compound') && !model.price_per_1m_input) return false
  
  // Must have pricing information for input/output
  if (!model.price_per_1m_input || !model.price_per_1m_output) return false
  
  return true
}

