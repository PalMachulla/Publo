import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/user/api-keys/[id]/preferences
 * Update orchestrator and writer model preferences for an API key
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { orchestratorModelId, writerModelIds } = body
    const keyId = params.id

    console.log('[Orchestrator Preferences] Request received:', {
      keyId,
      userId: user.id,
      orchestratorModelId,
      writerModelIds,
      bodyKeys: Object.keys(body)
    })

    // Verify this API key belongs to the user
    const { data: existingKey, error: fetchError } = await supabase
      .from('user_api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      console.error('[Orchestrator Preferences] Fetch error:', fetchError)
    }

    if (!existingKey) {
      console.error('[Orchestrator Preferences] API key not found:', { keyId, userId: user.id })
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      )
    }
    
    console.log('[Orchestrator Preferences] API key verified:', existingKey.id)

    // Update orchestrator and writer preferences
    const updateData = {
      orchestrator_model_id: orchestratorModelId || null,
      writer_model_ids: writerModelIds || [],
      updated_at: new Date().toISOString()
    }
    
    console.log('[Orchestrator Preferences] Updating with data:', updateData)
    
    const { data: updateResult, error: updateError } = await supabase
      .from('user_api_keys')
      .update(updateData)
      .eq('id', keyId)
      .eq('user_id', user.id)
      .select()

    if (updateError) {
      console.error('[Orchestrator Preferences] Update error:', {
        error: updateError,
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      })
      return NextResponse.json(
        { success: false, error: `Failed to update preferences: ${updateError.message}` },
        { status: 500 }
      )
    }
    
    console.log('[Orchestrator Preferences] Update result:', updateResult)

    console.log('[Orchestrator Preferences] Success!')

    return NextResponse.json({
      success: true,
      orchestratorModelId,
      writerModelIds
    })

  } catch (error: any) {
    console.error('[Orchestrator Preferences] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

