/**
 * GET /api/user/api-keys/debug
 * Debug endpoint to see raw model preferences
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: keys, error } = await supabase
      .from('user_api_keys')
      .select('id, provider, nickname, model_preferences, models_cache')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Format for readability
    const debug = keys?.map(key => ({
      id: key.id,
      provider: key.provider,
      nickname: key.nickname,
      model_preferences: key.model_preferences,
      total_models: key.models_cache?.length || 0,
      models_list: key.models_cache?.map((m: any) => ({
        id: m.id,
        name: m.name,
        supports_chat: m.supports_chat,
        preference: key.model_preferences?.[m.id]
      }))
    }))

    return NextResponse.json({
      success: true,
      debug
    }, { status: 200 })
  } catch (error) {
    console.error('[Debug] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

