/**
 * PATCH /api/user/api-keys/[id]/models
 * Update model preferences for a specific API key
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: {
    id: string
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const keyId = params.id

    console.log('[PATCH /api/user/api-keys/[id]/models] keyId:', keyId)

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { modelId, enabled } = body

    console.log('[PATCH] modelId:', modelId, 'enabled:', enabled)

    if (!modelId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Fetch the current key to get existing model_preferences
    const { data: key, error: fetchError } = await supabase
      .from('user_api_keys')
      .select('model_preferences')
      .eq('id', keyId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !key) {
      console.error('[PATCH] Key not found:', fetchError)
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    // Update model preferences
    const currentPrefs = key.model_preferences || {}
    const updatedPrefs = {
      ...currentPrefs,
      [modelId]: enabled,
    }

    console.log('[PATCH] Updating preferences:', updatedPrefs)

    // Update the key with new preferences
    const { error: updateError } = await supabase
      .from('user_api_keys')
      .update({ model_preferences: updatedPrefs })
      .eq('id', keyId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating model preferences:', updateError)
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
    }

    console.log('[PATCH] Successfully updated model preferences')

    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
    })
  } catch (error) {
    console.error('Error in PATCH /api/user/api-keys/[id]/models:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

