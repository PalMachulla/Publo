/**
 * POST /api/node/save
 * 
 * Unified node persistence endpoint
 * Handles all orchestrator-driven saves with admin client (bypasses RLS)
 * 
 * PHILOSOPHY:
 * - ONE endpoint for all node updates
 * - Partial updates (only update provided fields)
 * - Admin client bypasses RLS issues
 * - Verifies ownership before allowing updates
 * 
 * WHEN CALLED:
 * - After structure creation (update data + document_data)
 * - After content generation (update document_data)
 * - When orchestrator needs to persist state changes
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { nodeId, storyId, updates, userId } = await request.json()

    console.log('📡 [API /api/node/save] Request received:', {
      nodeId,
      storyId,
      fieldsToUpdate: Object.keys(updates || {}),
      userId
    })

    // Validate input
    if (!nodeId || !storyId || !updates || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: nodeId, storyId, updates, userId' },
        { status: 400 }
      )
    }

    // STEP 1: Verify user authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('❌ [API /api/node/save] Unauthorized: No user session')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (user.id !== userId) {
      console.error('❌ [API /api/node/save] Forbidden: User ID mismatch')
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }
    console.log('✅ [API /api/node/save] User authenticated:', user.id)

    // STEP 2: Verify node ownership via story_id
    const adminClient = createAdminClient()
    
    const { data: storyData, error: storyError } = await adminClient
      .from('stories')
      .select('user_id')
      .eq('id', storyId)
      .single()
    
    if (storyError || !storyData) {
      console.error('❌ [API /api/node/save] Story not found:', storyError)
      return NextResponse.json(
        { success: false, error: `Story not found: ${storyError?.message}` },
        { status: 404 }
      )
    }
    
    if (storyData.user_id !== userId) {
      console.error('❌ [API /api/node/save] User does not own this story')
      return NextResponse.json(
        { success: false, error: 'You do not own this story' },
        { status: 403 }
      )
    }
    console.log('✅ [API /api/node/save] Ownership verified')

    // STEP 3: Build update payload (only include provided fields)
    const updatePayload: Record<string, any> = {}
    const fieldsSaved: string[] = []
    
    if (updates.data !== undefined) {
      updatePayload.data = updates.data
      fieldsSaved.push('data')
    }
    if (updates.document_data !== undefined) {
      updatePayload.document_data = updates.document_data
      fieldsSaved.push('document_data')
    }
    if (updates.position_x !== undefined) {
      updatePayload.position_x = updates.position_x
      fieldsSaved.push('position')
    }
    if (updates.position_y !== undefined) {
      updatePayload.position_y = updates.position_y
      // Don't add to fieldsSaved again if position_x already did
      if (!fieldsSaved.includes('position')) {
        fieldsSaved.push('position')
      }
    }
    
    if (Object.keys(updatePayload).length === 0) {
      console.warn('⚠️ [API /api/node/save] No fields to update')
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }
    
    // Always update timestamp
    updatePayload.updated_at = new Date().toISOString()
    
    console.log('📦 [API /api/node/save] Update payload:', {
      nodeId,
      fields: Object.keys(updatePayload),
      payloadSize: JSON.stringify(updatePayload).length
    })

    // STEP 4: Update node with admin client (bypasses RLS)
    const { data: updateData, error: updateError } = await adminClient
      .from('nodes')
      .update(updatePayload)
      .eq('id', nodeId)
      .eq('story_id', storyId) // Extra safety: ensure story_id matches
      .select()
    
    if (updateError) {
      console.error('❌ [API /api/node/save] Update failed:', updateError)
      return NextResponse.json(
        { success: false, error: `Update failed: ${updateError.message}` },
        { status: 500 }
      )
    }
    
    if (!updateData || updateData.length === 0) {
      console.error('❌ [API /api/node/save] Node not found for update')
      return NextResponse.json(
        { success: false, error: `Node ${nodeId} not found` },
        { status: 404 }
      )
    }
    
    console.log('✅ [API /api/node/save] Node updated successfully:', {
      nodeId,
      fieldsSaved,
      timestamp: updatePayload.updated_at
    })

    // STEP 5: Verify update persisted
    const { data: verifyData, error: verifyError } = await adminClient
      .from('nodes')
      .select('id, updated_at')
      .eq('id', nodeId)
      .single()
    
    if (verifyError || !verifyData) {
      console.warn('⚠️ [API /api/node/save] Could not verify update:', verifyError)
      // Don't fail, update likely succeeded
    } else {
      console.log('✅ [API /api/node/save] Update verified:', verifyData.updated_at)
    }

    return NextResponse.json({
      success: true,
      nodeId,
      fieldsSaved,
      timestamp: updatePayload.updated_at
    })

  } catch (error) {
    console.error('❌ [API /api/node/save] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

