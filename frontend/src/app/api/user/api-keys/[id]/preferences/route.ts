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
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { orchestratorModelId, writerModelIds } = await request.json()
    const keyId = params.id

    console.log('[Orchestrator Preferences] Updating:', {
      keyId,
      orchestratorModelId,
      writerModelIds
    })

    // Verify this API key belongs to the user
    const { data: existingKey } = await supabase
      .from('user_api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('user_id', user.id)
      .single()

    if (!existingKey) {
      return NextResponse.json(
        { success: false, error: 'API key not found' },
        { status: 404 }
      )
    }

    // Update orchestrator and writer preferences
    const { error: updateError } = await supabase
      .from('user_api_keys')
      .update({
        orchestrator_model_id: orchestratorModelId || null,
        writer_model_ids: writerModelIds || [],
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[Orchestrator Preferences] Update error:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update preferences' },
        { status: 500 }
      )
    }

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

