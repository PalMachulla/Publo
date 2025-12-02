import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PUT /api/admin/models/[id]
 * Update model metadata (admin only)
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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
    const { id } = params

    // Validate best_for is an array if provided
    if (body.best_for && !Array.isArray(body.best_for)) {
      return NextResponse.json({ error: 'best_for must be an array' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('model_metadata')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('❌ [Admin Models API] Error updating model:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Model not found' }, { status: 404 })
    }

    console.log('✅ [Admin Models API] Model metadata updated:', id)
    return NextResponse.json({ success: true, model: data })
  } catch (error: any) {
    console.error('❌ [Admin Models API] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/models/[id]
 * Delete model metadata (admin only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const { id } = params

    const { error } = await supabase
      .from('model_metadata')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ [Admin Models API] Error deleting model:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [Admin Models API] Model metadata deleted:', id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ [Admin Models API] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

