/**
 * Embedding Service
 * Handles generation of vector embeddings using OpenAI's text-embedding-3-small model
 * 
 * NOTE: This service should ONLY be used server-side (API routes).
 * Client-side code should call API routes instead.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface EmbeddingConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large'
  dimensions?: number // Optional: reduce dimensions for storage optimization
}

export interface EmbeddingResult {
  embedding: number[]
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
  model: string
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
  model: string
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  dimensions: 1536, // Full dimensions
}

/**
 * Generate embedding for a single text using OpenAI API
 */
export async function generateEmbedding(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  config: EmbeddingConfig = DEFAULT_CONFIG
): Promise<EmbeddingResult> {
  // Get user's OpenAI API key
  const { data: apiKeyData, error: apiKeyError } = await supabase
    .from('user_api_keys')
    .select('encrypted_key, is_active, validation_status')
    .eq('provider', 'openai')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('validation_status', 'valid')
    .single()
  
  if (apiKeyError || !apiKeyData) {
    throw new Error('OpenAI API key not found. Please configure your API key in Settings.')
  }

  // Decrypt the API key (only works server-side)
  let openaiApiKey: string
  try {
    // Dynamic import to avoid bundling crypto in client
    const { decryptAPIKey } = await import('@/lib/security/encryption')
    openaiApiKey = decryptAPIKey(apiKeyData.encrypted_key)
  } catch (decryptError) {
    throw new Error(`Failed to decrypt API key: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`)
  }

  // Prepare request
  const requestBody: {
    input: string
    model: string
    dimensions?: number
  } = {
    input: text.trim(),
    model: config.model,
  }

  if (config.dimensions) {
    requestBody.dimensions = config.dimensions
  }

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()

  return {
    embedding: data.data[0].embedding,
    usage: data.usage,
    model: data.model,
  }
}

/**
 * Generate embeddings for multiple texts in a single batch (more efficient)
 */
export async function generateBatchEmbeddings(
  supabase: SupabaseClient,
  userId: string,
  texts: string[],
  config: EmbeddingConfig = DEFAULT_CONFIG
): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    throw new Error('Cannot generate embeddings for empty array')
  }

  if (texts.length > 2048) {
    throw new Error('Batch size too large. Maximum 2048 texts per batch.')
  }
  
  // Get user's OpenAI API key
  const { data: apiKeyData, error: apiKeyError } = await supabase
    .from('user_api_keys')
    .select('encrypted_key, is_active, validation_status')
    .eq('provider', 'openai')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('validation_status', 'valid')
    .single()
  
  if (apiKeyError || !apiKeyData) {
    throw new Error('OpenAI API key not found. Please configure your API key in Settings.')
  }

  // Decrypt the API key (only works server-side)
  let openaiApiKey: string
  try {
    // Dynamic import to avoid bundling crypto in client
    const { decryptAPIKey } = await import('@/lib/security/encryption')
    openaiApiKey = decryptAPIKey(apiKeyData.encrypted_key)
  } catch (decryptError) {
    throw new Error(`Failed to decrypt API key: ${decryptError instanceof Error ? decryptError.message : 'Unknown error'}`)
  }

  // Prepare request
  const requestBody: {
    input: string[]
    model: string
    dimensions?: number
  } = {
    input: texts.map(t => t.trim()),
    model: config.model,
  }

  if (config.dimensions) {
    requestBody.dimensions = config.dimensions
  }

  // Call OpenAI API
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
  }

  const data = await response.json()

  return {
    embeddings: data.data.map((item: { embedding: number[] }) => item.embedding),
    usage: data.usage,
    model: data.model,
  }
}

/**
 * Estimate token count for text (rough approximation)
 * More accurate tokenization would require the tiktoken library
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  // This is a simplification; actual tokenization varies
  return Math.ceil(text.length / 4)
}

/**
 * Validate text before embedding
 */
export function validateEmbeddingInput(text: string): {
  valid: boolean
  error?: string
} {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Text cannot be empty' }
  }

  const tokenCount = estimateTokenCount(text)
  if (tokenCount > 8191) {
    return { 
      valid: false, 
      error: `Text too long: ~${tokenCount} tokens (max 8191 for text-embedding-3-small)` 
    }
  }

  return { valid: true }
}

/**
 * Calculate cost for embedding generation
 */
export function calculateEmbeddingCost(
  tokenCount: number,
  model: string = 'text-embedding-3-small'
): number {
  const costPerMillion = model === 'text-embedding-3-small' ? 0.02 : 0.13
  return (tokenCount / 1_000_000) * costPerMillion
}

