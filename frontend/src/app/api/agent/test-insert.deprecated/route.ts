import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Test INSERT with both regular client and admin client
 * 
 * Visit: http://localhost:3002/api/agent/test-insert
 */
export async function GET() {
  console.log('🧪 [Test INSERT] Starting test...')

  try {
    // Test 1: Try INSERT with regular authenticated client
    console.log('🧪 [Test INSERT] Test 1: Regular client INSERT...')
    const regularClient = await createClient()
    
    const testNodeId = `test-insert-${Date.now()}-regular`
    const testStoryId = '3ae7d67a-b53b-4e6e-8c8a-24605764d7c2' // Use existing story from diagnostic
    
    const { data: insertData1, error: insertError1 } = await regularClient
      .from('nodes')
      .insert({
        id: testNodeId,
        story_id: testStoryId,
        type: 'storyNode',
        data: { label: 'Test Node (Regular Client)' },
        document_data: { version: 1, format: 'novel', structure: [], fullDocument: '' },
        position_x: 0,
        position_y: 0
      })
      .select()
    
    console.log('📊 [Test INSERT] Regular client result:', {
      success: !insertError1,
      data: insertData1,
      error: insertError1,
      errorCode: insertError1?.code
    })

    // Test 2: Verify if it exists
    if (!insertError1) {
      console.log('🔍 [Test INSERT] Verifying regular INSERT with SELECT...')
      const { data: verifyData1, error: verifyError1 } = await regularClient
        .from('nodes')
        .select('id, type')
        .eq('id', testNodeId)
        .single()
      
      console.log('📊 [Test INSERT] Regular client verification:', {
        found: !verifyError1 && verifyData1,
        data: verifyData1,
        error: verifyError1
      })
    }

    // Test 3: Try INSERT with admin client
    console.log('🧪 [Test INSERT] Test 2: Admin client INSERT...')
    const adminClient = createAdminClient()
    
    const testNodeId2 = `test-insert-${Date.now()}-admin`
    
    const { data: insertData2, error: insertError2 } = await adminClient
      .from('nodes')
      .insert({
        id: testNodeId2,
        story_id: testStoryId,
        type: 'storyNode',
        data: { label: 'Test Node (Admin Client)' },
        document_data: { version: 1, format: 'novel', structure: [], fullDocument: '' },
        position_x: 0,
        position_y: 0
      })
      .select()
    
    console.log('📊 [Test INSERT] Admin client result:', {
      success: !insertError2,
      data: insertData2,
      error: insertError2,
      errorCode: insertError2?.code
    })

    // Test 4: Verify admin INSERT
    if (!insertError2) {
      console.log('🔍 [Test INSERT] Verifying admin INSERT with SELECT...')
      const { data: verifyData2, error: verifyError2 } = await adminClient
        .from('nodes')
        .select('id, type')
        .eq('id', testNodeId2)
        .single()
      
      console.log('📊 [Test INSERT] Admin client verification:', {
        found: !verifyError2 && verifyData2,
        data: verifyData2,
        error: verifyError2
      })

      // Test 5: Wait 2 seconds and check again
      console.log('⏳ [Test INSERT] Waiting 2 seconds to check if node persists...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const { data: verifyData3, error: verifyError3 } = await adminClient
        .from('nodes')
        .select('id, type')
        .eq('id', testNodeId2)
        .single()
      
      console.log('📊 [Test INSERT] Admin client verification (after 2s):', {
        found: !verifyError3 && verifyData3,
        data: verifyData3,
        error: verifyError3,
        diagnosis: verifyError3 ? 'NODE WAS DELETED/ROLLED BACK!' : 'Node still exists'
      })

      return NextResponse.json({
        success: true,
        tests: {
          regularClientInsert: {
            success: !insertError1,
            error: insertError1?.message,
            testNodeId
          },
          adminClientInsert: {
            success: !insertError2,
            error: insertError2?.message,
            testNodeId: testNodeId2
          },
          persistence: {
            immediately: !verifyError2 && verifyData2,
            after2seconds: !verifyError3 && verifyData3,
            diagnosis: verifyError3 ? 'NODE WAS DELETED/ROLLED BACK!' : 'Node persisted successfully'
          }
        },
        nextStep: 'Check Supabase Dashboard > Table Editor > nodes to see if test nodes exist'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Admin INSERT failed',
      details: insertError2
    }, { status: 500 })

  } catch (error) {
    console.error('❌ [Test INSERT] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

