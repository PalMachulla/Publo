import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProviderAdapter } from '@/lib/providers'
import { decryptAPIKey } from '@/lib/security/encryption'
import type { LLMProvider, NormalizedModel } from '@/types/api-keys'

/**
 * POST /api/admin/models/sync-vendor-data
 * Syncs vendor-controlled data from APIs to model_metadata
 * - Updates existing models with latest pricing, context window, etc.
 * - Creates new models that exist in vendor API but not in metadata
 * - Preserves all admin-configured fields (tier, supports_structured_output, etc.)
 * - Auto-disables deprecated models
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
      .maybeSingle()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch admin's active API keys
    const { data: adminKeys, error: keysError } = await supabase
      .from('user_api_keys')
      .select('id, provider, encrypted_key')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (keysError) {
      console.error('❌ [Sync Vendor Data] Error fetching admin keys:', keysError)
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    if (!adminKeys || adminKeys.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No API keys found',
        message: 'Please add API keys in your Profile settings first, then try again.'
      }, { status: 400 })
    }

    // Fetch all existing models from metadata
    const { data: allModels, error: modelsError } = await supabase
      .from('model_metadata')
      .select('id, model_id, provider, is_active')

    if (modelsError) {
      console.error('❌ [Sync Vendor Data] Error fetching models:', modelsError)
      return NextResponse.json({ error: 'Failed to fetch existing models' }, { status: 500 })
    }

    const updates = {
      pricing: 0,
      contextWindow: 0,
      maxOutputTokens: 0,
      speed: 0,
      deprecated: 0,
      reactivated: 0,
      created: 0,
      updated: 0
    }

    const errors: string[] = []

    // Sync models for each provider the admin has keys for
    for (const key of adminKeys) {
      try {
        const adapter = getProviderAdapter(key.provider as LLMProvider)
        const decryptedKey = decryptAPIKey(key.encrypted_key)
        
        console.log(`🔍 [Sync Vendor Data] Fetching models from ${key.provider}...`)
        const vendorModels = await adapter.fetchModels(decryptedKey)
        console.log(`✅ [Sync Vendor Data] Found ${vendorModels.length} models from ${key.provider}`)

        // Create map for quick lookup
        const vendorMap = new Map<string, NormalizedModel>()
        for (const vm of vendorModels) {
          vendorMap.set(vm.id, vm)
        }

        // Process each model from vendor API
        for (const vendorModel of vendorModels) {
          // Find existing model in metadata
          const existingModel = allModels?.find(
            m => m.model_id === vendorModel.id && m.provider === vendorModel.provider
          )

          // Prepare vendor-controlled fields
          const vendorFields: any = {
            cost_per_1k_tokens_input: vendorModel.input_price_per_1m 
              ? vendorModel.input_price_per_1m / 1000 
              : null,
            cost_per_1k_tokens_output: vendorModel.output_price_per_1m 
              ? vendorModel.output_price_per_1m / 1000 
              : null,
            context_window: vendorModel.context_window || null,
            max_output_tokens: vendorModel.max_output_tokens || null,
            speed_tokens_per_sec: vendorModel.speed_tokens_per_sec || null,
            vendor_category: vendorModel.category,
            vendor_name: vendorModel.name,
            vendor_description: vendorModel.description || null,
            vendor_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          // Handle deprecated models
          if (vendorModel.category === 'deprecated') {
            if (existingModel?.is_active) {
              vendorFields.is_active = false
              vendorFields.notes = `[Auto-updated ${new Date().toISOString()}] Model deprecated by vendor. Auto-disabled.`
              updates.deprecated++
            }
          }

          if (existingModel) {
            // ✅ UPDATE existing model (only vendor-controlled fields)
            const { error: updateError } = await supabase
              .from('model_metadata')
              .update(vendorFields)
              .eq('id', existingModel.id)

            if (updateError) {
              console.error(`❌ [Sync Vendor Data] Failed to update ${vendorModel.provider}:${vendorModel.id}:`, updateError)
              errors.push(`${vendorModel.provider}:${vendorModel.id}: ${updateError.message}`)
            } else {
              updates.updated++
              if (vendorFields.cost_per_1k_tokens_input !== null) updates.pricing++
              if (vendorFields.context_window) updates.contextWindow++
              if (vendorFields.max_output_tokens) updates.maxOutputTokens++
              if (vendorFields.speed_tokens_per_sec) updates.speed++
            }
          } else {
            // ✅ CREATE new model (minimal fields, admin can configure rest)
            const { error: insertError } = await supabase
              .from('model_metadata')
              .insert({
                model_id: vendorModel.id,
                provider: vendorModel.provider,
                ...vendorFields,
                // Defaults (admin can configure later)
                is_active: vendorModel.category === 'deprecated' ? false : true,
                supports_structured_output: null, // Admin configures
                supports_reasoning: false, // Admin configures
                supports_streaming: true, // Default
                supports_function_calling: false, // Admin configures
                supports_vision: false, // Admin configures
                tier: null, // Admin configures
                speed: null, // Admin configures enum
                cost: null, // Admin configures enum
                best_for: [],
                notes: `Auto-created from vendor sync. Category: ${vendorModel.category}`,
                admin_verified: false,
                created_by: user.id
              })
              .select()
              .maybeSingle() // ✅ Use maybeSingle() - insert might fail due to race condition

            if (insertError) {
              // Handle unique constraint violation (another admin created it)
              if (insertError.code === '23505') {
                // Model was created by another admin, try update instead
                console.log(`⚠️ [Sync Vendor Data] Race condition: ${vendorModel.provider}:${vendorModel.id} already exists, updating instead`)
                
                const { error: updateError } = await supabase
                  .from('model_metadata')
                  .update(vendorFields)
                  .eq('model_id', vendorModel.id)
                  .eq('provider', vendorModel.provider)
                
                if (updateError) {
                  errors.push(`${vendorModel.provider}:${vendorModel.id}: ${updateError.message}`)
                } else {
                  updates.updated++
                  if (vendorFields.cost_per_1k_tokens_input !== null) updates.pricing++
                }
              } else {
                console.error(`❌ [Sync Vendor Data] Failed to create ${vendorModel.provider}:${vendorModel.id}:`, insertError)
                errors.push(`${vendorModel.provider}:${vendorModel.id}: ${insertError.message}`)
              }
            } else {
              updates.created++
              if (vendorFields.cost_per_1k_tokens_input !== null) updates.pricing++
              if (vendorFields.context_window) updates.contextWindow++
              if (vendorFields.max_output_tokens) updates.maxOutputTokens++
              if (vendorFields.speed_tokens_per_sec) updates.speed++
            }
          }
        }
      } catch (error: any) {
        const errorMsg = `Failed to sync ${key.provider} models: ${error.message || 'Unknown error'}`
        console.error(`❌ [Sync Vendor Data] ${errorMsg}`)
        errors.push(errorMsg)
        // Continue with other providers
      }
    }

    return NextResponse.json({
      success: true,
      updates,
      totalProcessed: updates.created + updates.updated,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('❌ [Sync Vendor Data] Unexpected error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

