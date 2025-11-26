/**
 * Phase 3: Content Persistence Utility
 * 
 * Saves agent-generated content to Supabase database.
 * Uses the hierarchical document system (DocumentManager).
 */

import { createClient } from '@/lib/supabase/client'
import { DocumentManager } from '@/lib/document/DocumentManager'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface SaveContentOptions {
  storyStructureNodeId: string
  sectionId: string
  content: string
  userId: string
  supabaseClient?: SupabaseClient // ✅ FIX: Accept authenticated client from caller
}

export interface SaveContentResult {
  success: boolean
  error?: string
  wordCount?: number
}

/**
 * Save agent-generated content to Supabase
 * 
 * This replicates the logic from handleWriteContent in canvas/page.tsx
 */
export async function saveAgentContent(options: SaveContentOptions): Promise<SaveContentResult> {
  const { storyStructureNodeId, sectionId, content, userId, supabaseClient } = options
  
  // 🔍 DEBUG: Log save attempt
  console.log('💾 [saveAgentContent] Attempting save:', {
    nodeId: storyStructureNodeId,
    nodeIdType: typeof storyStructureNodeId,
    nodeIdFormat: storyStructureNodeId?.startsWith('structure-') ? '❌ WRONG (structure ID)' : '✅ CORRECT (node ID)',
    sectionId,
    contentLength: content.length,
    contentPreview: content.substring(0, 100) + '...',
    hasProvidedClient: !!supabaseClient // ✅ FIX: Log if client was provided
  })
  
  try {
    // ✅ FIX: Use provided authenticated client, fallback to creating new one
    const supabase = supabaseClient || createClient()
    console.log('🔑 [saveAgentContent] Using Supabase client:', {
      provided: !!supabaseClient,
      source: supabaseClient ? 'authenticated (passed from canvas)' : 'new instance (may lack auth)'
    })
    
    // Step 1: Fetch current document_data (with retry logic for race conditions)
    console.log('📡 [saveAgentContent] Fetching node from Supabase...')
    
    // ✅ FIX: Add retry logic to handle race condition where node was just created
    const maxRetries = 3
    const retryDelays = [500, 1000, 2000] // Exponential backoff
    
    let node: any = null
    let fetchError: any = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      console.log(`🔍 [saveAgentContent] Fetch attempt ${attempt + 1}/${maxRetries + 1}:`, {
        query: 'nodes.select(document_data).eq(id, storyStructureNodeId).single()',
        nodeId: storyStructureNodeId,
        timestamp: new Date().toISOString()
      })
      
      const result = await supabase
        .from('nodes')
        .select('id, document_data') // ✅ FIX: Select id too for debugging
        .eq('id', storyStructureNodeId)
        .single()
      
      console.log(`📡 [saveAgentContent] Fetch attempt ${attempt + 1} result:`, {
        success: !result.error,
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
        errorDetails: result.error?.details,
        errorHint: result.error?.hint
      })
      
      node = result.data
      fetchError = result.error
      
      if (!fetchError || fetchError.code !== 'PGRST116') {
        // Success or non-retryable error
        break
      }
      
      if (attempt < maxRetries) {
        const delay = retryDelays[attempt]
        console.warn(`⚠️ [saveAgentContent] Node not found (PGRST116), retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error(`❌ [saveAgentContent] Max retries reached. Last error:`, {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
          hint: fetchError.hint
        })
      }
    }
    
    if (fetchError) {
      console.error(`❌ [saveAgentContent] Failed to fetch node after ${maxRetries + 1} attempts:`, fetchError)
      return { success: false, error: fetchError.message }
    }
    
    console.log('✅ [saveAgentContent] Node fetched:', {
      hasNode: !!node,
      hasDocumentData: !!node?.document_data,
      documentDataKeys: node?.document_data ? Object.keys(node.document_data) : []
    })
    
    if (!node?.document_data) {
      console.error('❌ [saveAgentContent] No document_data in node')
      return { success: false, error: 'No document_data found in node' }
    }
    
    // Step 2: Update content in DocumentManager
    console.log('📝 [saveAgentContent] Updating content in DocumentManager...')
    const docManager = new DocumentManager(node.document_data)
    
    // 🔍 DEBUG: Log available sections
    const flatSections = docManager.getFlatStructure()
    console.log('📋 [saveAgentContent] Available sections:', {
      count: flatSections.length,
      ids: flatSections.map(s => s.id),
      targetSectionId: sectionId,
      sectionExists: flatSections.some(s => s.id === sectionId)
    })
    
    const updateSuccess = docManager.updateContent(sectionId, content)
    
    if (!updateSuccess) {
      return { success: false, error: `Section ${sectionId} not found in document` }
    }
    
    const updatedData = docManager.getData()
    
    // Step 3: Save back to Supabase
    const { error: updateError } = await supabase
      .from('nodes')
      .update({ document_data: updatedData })
      .eq('id', storyStructureNodeId)
    
    if (updateError) {
      console.error('❌ [saveAgentContent] Failed to save document_data:', updateError)
      return { success: false, error: updateError.message }
    }
    
    const wordCount = content.trim().split(/\s+/).length
    
    console.log('✅ [saveAgentContent] Content saved successfully:', {
      sectionId,
      wordCount,
      totalWordCount: updatedData.totalWordCount
    })
    
    return {
      success: true,
      wordCount: updatedData.totalWordCount
    }
    
  } catch (error) {
    console.error('❌ [saveAgentContent] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Batch save multiple sections (for parallel execution)
 */
export async function batchSaveAgentContent(
  items: Array<{
    storyStructureNodeId: string
    sectionId: string
    content: string
  }>,
  userId: string
): Promise<{
  successful: number
  failed: number
  errors: string[]
}> {
  const results = await Promise.all(
    items.map(item => saveAgentContent({ ...item, userId }))
  )
  
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const errors = results
    .filter(r => !r.success)
    .map(r => r.error || 'Unknown error')
  
  console.log(`📊 [batchSaveAgentContent] Results: ${successful} successful, ${failed} failed`)
  
  return { successful, failed, errors }
}

