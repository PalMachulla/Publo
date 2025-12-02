import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/models
 * Fetch all model metadata (admin only)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('model_metadata')
      .select('*')
      .order('provider', { ascending: true })
      .order('model_id', { ascending: true })

    if (error) {
      console.error('❌ [Admin Models API] Error fetching models:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, models: data || [] })
  } catch (error: any) {
    console.error('❌ [Admin Models API] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/models
 * Create or update model metadata (admin only)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { model_id, provider, ...metadata } = body

    if (!model_id || !provider) {
      return NextResponse.json({ error: 'model_id and provider are required' }, { status: 400 })
    }

    // Validate best_for is an array if provided
    if (metadata.best_for && !Array.isArray(metadata.best_for)) {
      return NextResponse.json({ error: 'best_for must be an array' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('model_metadata')
      .upsert({
        model_id,
        provider,
        ...metadata,
        created_by: user.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'model_id,provider'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [Admin Models API] Error upserting model:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [Admin Models API] Model metadata saved:', { model_id, provider })
    return NextResponse.json({ success: true, model: data })
  } catch (error: any) {
    console.error('❌ [Admin Models API] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

