/**
 * Phase 3: Content Persistence Utility
 * 
 * Saves agent-generated content to Supabase database.
 * Uses the hierarchical document system (DocumentManager).
 */

import { createClient } from '@/lib/supabase/client'
import { DocumentManager } from '@/lib/document/DocumentManager'

export interface SaveContentOptions {
  storyStructureNodeId: string
  sectionId: string
  content: string
  userId: string
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
  const { storyStructureNodeId, sectionId, content, userId } = options
  
  try {
    const supabase = createClient()
    
    // Step 1: Fetch current document_data
    const { data: node, error: fetchError } = await supabase
      .from('nodes')
      .select('document_data')
      .eq('id', storyStructureNodeId)
      .single()
    
    if (fetchError) {
      console.error('❌ [saveAgentContent] Failed to fetch node:', fetchError)
      return { success: false, error: fetchError.message }
    }
    
    if (!node?.document_data) {
      return { success: false, error: 'No document_data found in node' }
    }
    
    // Step 2: Update content in DocumentManager
    const docManager = new DocumentManager(node.document_data)
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

