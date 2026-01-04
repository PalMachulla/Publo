/**
 * API Route: /api/edge/create
 *
 * Server-side endpoint for creating/upserting edges.
 * Uses admin client to bypass RLS INSERT policy issues (mirrors /api/node/create).
 */
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { edgeId, storyId, source, target, type, animated, style, userId } = await request.json()

    console.log('📥 [API /api/edge/create] Request received:', {
      edgeId,
      storyId,
      source,
      target,
      type,
      userId,
    })

    // Validate input
    if (!edgeId || !storyId || !source || !target || !userId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: edgeId, storyId, source, target, userId' },
        { status: 400 }
      )
    }

    // STEP 1: Verify user authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.id !== userId) {
      console.error('❌ [API /api/edge/create] Unauthorized')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // STEP 2: Verify user owns the story
    const adminClient = createAdminClient()
    const { data: story, error: storyError } = await adminClient
      .from('stories')
      .select('user_id')
      .eq('id', storyId)
      .maybeSingle()

    if (storyError) {
      console.error('❌ [API /api/edge/create] Database error fetching story:', storyError)
      return NextResponse.json(
        { success: false, error: `Database error: ${storyError.message}` },
        { status: 500 }
      )
    }

    if (!story || story.user_id !== userId) {
      console.error('❌ [API /api/edge/create] Story not found or unauthorized')
      return NextResponse.json(
        { success: false, error: 'Story not found or unauthorized' },
        { status: 403 }
      )
    }

    // STEP 3: Upsert edge with admin client
    const edgePayload = {
      id: edgeId,
      story_id: storyId,
      source,
      target,
      type: type ?? 'default',
      animated: animated ?? false,
      style: style ?? null,
    }

    const { data: upsertedEdge, error: upsertError } = await adminClient
      .from('edges')
      .upsert(edgePayload, { onConflict: 'id' })
      .select()
      .maybeSingle()

    if (upsertError) {
      console.error('❌ [API /api/edge/create] UPSERT failed:', upsertError)
      return NextResponse.json(
        { success: false, error: upsertError.message },
        { status: 500 }
      )
    }

    if (!upsertedEdge) {
      console.error('❌ [API /api/edge/create] UPSERT succeeded but returned no data')
      return NextResponse.json(
        { success: false, error: 'Edge creation failed: no data returned' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      edgeId: upsertedEdge.id,
    })
  } catch (error) {
    console.error('❌ [API /api/edge/create] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

