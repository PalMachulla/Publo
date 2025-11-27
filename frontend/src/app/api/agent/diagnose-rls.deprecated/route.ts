import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Diagnostic endpoint to test if SERVICE_ROLE can read from nodes table
 * 
 * Visit: http://localhost:3002/api/agent/diagnose-rls?nodeId=YOUR_NODE_ID
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const nodeId = searchParams.get('nodeId')

  console.log('🔍 [RLS Diagnostic] Starting diagnosis...')
  console.log('🔍 [RLS Diagnostic] Environment check:', {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceRolePrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) + '...'
  })

  try {
    const adminClient = createAdminClient()

    // Test 1: Can we connect?
    console.log('✅ [RLS Diagnostic] Admin client created successfully')

    // Test 2: Can we query the nodes table at all?
    console.log('🔍 [RLS Diagnostic] Test 2: Listing nodes (limit 5)...')
    const { data: allNodes, error: listError, count } = await adminClient
      .from('nodes')
      .select('id, type, story_id', { count: 'exact' })
      .limit(5)

    console.log('📊 [RLS Diagnostic] List result:', {
      success: !listError,
      count,
      nodeIds: allNodes?.map(n => n.id),
      error: listError
    })

    if (listError) {
      return NextResponse.json({
        success: false,
        test: 'list_nodes',
        error: listError.message,
        diagnosis: 'SERVICE_ROLE cannot even list nodes! RLS is blocking admin client!',
        fix: 'Check RLS policies in Supabase Dashboard'
      }, { status: 500 })
    }

    // Test 3: Can we query a specific node?
    if (nodeId) {
      console.log(`🔍 [RLS Diagnostic] Test 3: Fetching specific node: ${nodeId}...`)
      const { data: specificNode, error: fetchError } = await adminClient
        .from('nodes')
        .select('*')
        .eq('id', nodeId)
        .single()

      console.log('📊 [RLS Diagnostic] Fetch result:', {
        success: !fetchError,
        found: !!specificNode,
        error: fetchError
      })

      if (fetchError) {
        return NextResponse.json({
          success: false,
          test: 'fetch_specific_node',
          nodeId,
          error: fetchError.message,
          errorCode: fetchError.code,
          diagnosis: fetchError.code === 'PGRST116' 
            ? 'Node not found in database (never inserted?) OR RLS blocking admin'
            : 'Unknown error',
          allNodesCount: count
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        test: 'fetch_specific_node',
        nodeId,
        node: specificNode,
        diagnosis: 'SERVICE_ROLE can read specific nodes! RLS is working correctly.'
      })
    }

    // Test 3 skipped (no nodeId provided)
    return NextResponse.json({
      success: true,
      test: 'list_nodes',
      totalNodesCount: count,
      sampleNodes: allNodes,
      diagnosis: 'SERVICE_ROLE can list nodes! Provide ?nodeId=XXX to test specific node fetch.',
      nextStep: 'Add ?nodeId=YOUR_NODE_ID to this URL to test fetching a specific node'
    })

  } catch (error) {
    console.error('❌ [RLS Diagnostic] Fatal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnosis: 'Failed to create admin client or connect to Supabase'
    }, { status: 500 })
  }
}

