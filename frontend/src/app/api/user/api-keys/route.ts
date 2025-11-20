/**
 * API routes for managing user API keys
 * 
 * GET    /api/user/api-keys - List all user's API keys
 * POST   /api/user/api-keys - Add a new API key
 * PATCH  /api/user/api-keys/[id] - Update an API key (moved to [id]/route.ts)
 * DELETE /api/user/api-keys/[id] - Delete an API key (moved to [id]/route.ts)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptAPIKey, hashAPIKey } from '@/lib/security/encryption'
import { getProviderAdapter } from '@/lib/providers'
import type { UserAPIKey, AddAPIKeyRequest, LLMProvider } from '@/types/api-keys'

/**
 * GET /api/user/api-keys
 * List all API keys for the authenticated user
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user's API keys (without the encrypted_key field for security)
    const { data: keys, error: keysError } = await supabase
      .from('user_api_keys')
      .select('id, provider, nickname, is_active, last_validated_at, validation_status, models_cache, models_cached_at, model_preferences, usage_count, last_used_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (keysError) {
      console.error('Error fetching API keys:', keysError)
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      keys: keys as UserAPIKey[],
    })
  } catch (error) {
    console.error('Error in GET /api/user/api-keys:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/user/api-keys
 * Add a new API key
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body: AddAPIKeyRequest = await request.json()
    const { provider, apiKey, nickname } = body

    // Validate input
    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, apiKey' },
        { status: 400 }
      )
    }

    if (!['groq', 'openai', 'anthropic', 'google'].includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be one of: groq, openai, anthropic, google' },
        { status: 400 }
      )
    }

    // Validate the API key with the provider
    const adapter = getProviderAdapter(provider as LLMProvider)
    const isValid = await adapter.validateKey(apiKey)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check your key and try again.' },
        { status: 400 }
      )
    }

    // Fetch available models to cache
    let modelsCache = null
    try {
      const models = await adapter.fetchModels(apiKey)
      modelsCache = models
    } catch (error) {
      console.warn('Failed to fetch models during key creation:', error)
      // Continue anyway - we'll fetch models later
    }

    // Encrypt and hash the API key
    const encryptedKey = encryptAPIKey(apiKey)
    const keyHash = hashAPIKey(apiKey)

    // Check for duplicate keys
    const { data: existingKey } = await supabase
      .from('user_api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('key_hash', keyHash)
      .single()

    if (existingKey) {
      return NextResponse.json(
        { error: 'This API key has already been added' },
        { status: 409 }
      )
    }

    // Insert the new API key
    const { data: newKey, error: insertError } = await supabase
      .from('user_api_keys')
      .insert({
        user_id: user.id,
        provider,
        nickname,
        encrypted_key: encryptedKey,
        key_hash: keyHash,
        is_active: true,
        validation_status: 'valid',
        last_validated_at: new Date().toISOString(),
        models_cache: modelsCache,
        models_cached_at: modelsCache ? new Date().toISOString() : null,
      })
      .select('id, provider, nickname, is_active, last_validated_at, validation_status, models_cache, models_cached_at, usage_count, last_used_at, created_at, updated_at')
      .single()

    if (insertError) {
      console.error('Error inserting API key:', insertError)
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      key: newKey as UserAPIKey,
      message: 'API key added successfully',
    })
  } catch (error: any) {
    console.error('Error in POST /api/user/api-keys:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

