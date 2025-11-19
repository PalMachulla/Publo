/**
 * API routes for managing individual API keys
 * 
 * PATCH  /api/user/api-keys/[id] - Update an API key (nickname, active status)
 * DELETE /api/user/api-keys/[id] - Delete an API key
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UpdateAPIKeyRequest } from '@/types/api-keys'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * PATCH /api/user/api-keys/[id]
 * Update an API key's nickname or active status
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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

    const { id } = params

    // Parse request body
    const body: UpdateAPIKeyRequest = await request.json()
    const { nickname, is_active } = body

    if (nickname === undefined && is_active === undefined) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (nickname !== undefined) {
      updates.nickname = nickname
    }

    if (is_active !== undefined) {
      updates.is_active = is_active
    }

    // Update the key (RLS will ensure user owns it)
    const { data: updatedKey, error: updateError } = await supabase
      .from('user_api_keys')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, provider, nickname, is_active, last_validated_at, validation_status, models_cache, models_cached_at, usage_count, last_used_at, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('Error updating API key:', updateError)
      
      if (updateError.code === 'PGRST116') {
        return NextResponse.json({ error: 'API key not found' }, { status: 404 })
      }
      
      return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      key: updatedKey,
      message: 'API key updated successfully',
    })
  } catch (error: any) {
    console.error('Error in PATCH /api/user/api-keys/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/api-keys/[id]
 * Delete an API key
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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

    const { id } = params

    // Delete the key (RLS will ensure user owns it)
    const { error: deleteError } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting API key:', deleteError)
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/user/api-keys/[id]:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

