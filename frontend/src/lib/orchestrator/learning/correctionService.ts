/**
 * Correction Learning Service
 * 
 * Handles storage and retrieval of user correction patterns using semantic embeddings.
 * Learns from user corrections (e.g., "I wanted open, not create") to improve intent classification.
 */

import { generateEmbedding } from '@/lib/embeddings/embeddingService'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CorrectionPattern {
  id: string
  originalMessage: string
  wrongIntent: string
  correctIntent: string
  correctionMessage?: string
  context: {
    canvasNodes?: string[]
    documentPanelOpen?: boolean
    previousIntent?: string
  }
  successRate: number
  timesApplied: number
  timesSuccessful: number
  similarity?: number // When returned from search
}

export interface CorrectionContext {
  canvasNodes?: string[]
  documentPanelOpen?: boolean
  previousIntent?: string
}

/**
 * Store a correction pattern with embedding
 * Called when user corrects a misclassification
 */
export async function storeCorrectionPattern(
  supabase: SupabaseClient,
  userId: string,
  correction: {
    originalMessage: string
    wrongIntent: string
    correctIntent: string
    correctionMessage?: string
    context?: CorrectionContext
  }
): Promise<string> {
  try {
    // Generate embedding for the original message
    const { embedding } = await generateEmbedding(supabase, userId, correction.originalMessage)
    
    // Store in database
    const { data, error } = await supabase
      .from('correction_patterns')
      .insert({
        user_id: userId,
        original_message: correction.originalMessage,
        original_message_embedding: embedding,
        wrong_intent: correction.wrongIntent,
        correct_intent: correction.correctIntent,
        correction_message: correction.correctionMessage || null,
        canvas_nodes: correction.context?.canvasNodes || null,
        document_panel_open: correction.context?.documentPanelOpen || null,
        previous_intent: correction.context?.previousIntent || null,
        namespace: 'intent_correction',
        success_rate: 1.0, // Start with 100% success (first use)
        times_applied: 0,
        times_successful: 0
      })
      .select('id')
      .single()
    
    if (error) {
      console.error('❌ [CorrectionService] Failed to store correction:', error)
      throw new Error(`Failed to store correction: ${error.message}`)
    }
    
    console.log('✅ [CorrectionService] Stored correction pattern:', {
      id: data.id,
      originalMessage: correction.originalMessage.substring(0, 50),
      wrongIntent: correction.wrongIntent,
      correctIntent: correction.correctIntent
    })
    
    return data.id
  } catch (error) {
    console.error('❌ [CorrectionService] Error storing correction:', error)
    throw error
  }
}

/**
 * Find similar correction patterns using semantic search
 * Returns corrections that match the current user message
 */
export async function findSimilarCorrections(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  options: {
    matchThreshold?: number
    matchCount?: number
    minSuccessRate?: number
  } = {}
): Promise<CorrectionPattern[]> {
  const {
    matchThreshold = 0.75,
    matchCount = 5,
    minSuccessRate = 0.6
  } = options
  
  try {
    // Generate embedding for query
    const { embedding } = await generateEmbedding(supabase, userId, query)
    
    // Semantic search using Supabase RPC
    const { data, error } = await supabase.rpc('search_correction_patterns', {
      query_embedding: embedding,
      user_id: userId,
      match_threshold: matchThreshold,
      match_count: matchCount,
      min_success_rate: minSuccessRate
    })
    
    if (error) {
      console.error('❌ [CorrectionService] Correction search error:', error)
      return []
    }
    
    const corrections: CorrectionPattern[] = (data || []).map((row: any) => ({
      id: row.id,
      originalMessage: row.original_message,
      wrongIntent: row.wrong_intent,
      correctIntent: row.correct_intent,
      correctionMessage: row.correction_message,
      context: {
        canvasNodes: row.canvas_nodes,
        documentPanelOpen: row.document_panel_open,
        previousIntent: row.previous_intent
      },
      successRate: parseFloat(row.success_rate || '0'),
      timesApplied: row.times_applied || 0,
      timesSuccessful: row.times_successful || 0,
      similarity: parseFloat(row.similarity || '0')
    }))
    
    if (corrections.length > 0) {
      console.log(`✅ [CorrectionService] Found ${corrections.length} similar corrections:`, 
        corrections.map(c => ({
          similarity: (c.similarity! * 100).toFixed(1) + '%',
          correctIntent: c.correctIntent,
          successRate: (c.successRate * 100).toFixed(0) + '%'
        }))
      )
    }
    
    return corrections
  } catch (error) {
    console.error('❌ [CorrectionService] Error finding corrections:', error)
    return []
  }
}

/**
 * Update correction pattern success rate
 * Called after applying a correction to track if it worked
 */
export async function updateCorrectionSuccess(
  supabase: SupabaseClient,
  correctionId: string,
  success: boolean
): Promise<void> {
  try {
    // Get current stats
    const { data, error: fetchError } = await supabase
      .from('correction_patterns')
      .select('times_applied, times_successful, success_rate')
      .eq('id', correctionId)
      .single()
    
    if (fetchError || !data) {
      console.warn('⚠️ [CorrectionService] Could not find correction to update:', correctionId)
      return
    }
    
    const timesApplied = (data.times_applied || 0) + 1
    const timesSuccessful = (data.times_successful || 0) + (success ? 1 : 0)
    const successRate = timesSuccessful / timesApplied
    
    const { error: updateError } = await supabase
      .from('correction_patterns')
      .update({
        times_applied: timesApplied,
        times_successful: timesSuccessful,
        success_rate: successRate,
        last_applied_at: new Date().toISOString()
      })
      .eq('id', correctionId)
    
    if (updateError) {
      console.error('❌ [CorrectionService] Failed to update correction success:', updateError)
    } else {
      console.log(`✅ [CorrectionService] Updated correction ${correctionId}:`, {
        success,
        newSuccessRate: (successRate * 100).toFixed(1) + '%',
        timesApplied,
        timesSuccessful
      })
    }
  } catch (error) {
    console.error('❌ [CorrectionService] Error updating correction success:', error)
  }
}

/**
 * Format corrections as few-shot examples for LLM prompt
 */
export function formatCorrectionsForPrompt(
  corrections: CorrectionPattern[],
  currentContext?: CorrectionContext
): string {
  if (corrections.length === 0) {
    return ''
  }
  
  let prompt = '\n\nLEARNED CORRECTIONS (Few-Shot Examples - Apply These Patterns!):\n'
  
  corrections.forEach((corr, index) => {
    prompt += `\nExample ${index + 1}:\n`
    prompt += `- User said: "${corr.originalMessage}"\n`
    
    if (corr.context.canvasNodes && corr.context.canvasNodes.length > 0) {
      prompt += `- Canvas had: ${corr.context.canvasNodes.join(', ')}\n`
    }
    if (corr.context.documentPanelOpen !== undefined) {
      prompt += `- Document panel: ${corr.context.documentPanelOpen ? 'OPEN' : 'CLOSED'}\n`
    }
    
    prompt += `- ❌ WRONG: ${corr.wrongIntent}\n`
    prompt += `- ✅ CORRECT: ${corr.correctIntent}\n`
    
    if (corr.correctionMessage) {
      prompt += `- User corrected: "${corr.correctionMessage}"\n`
    }
    
    prompt += `- Success rate: ${(corr.successRate * 100).toFixed(0)}% (applied ${corr.timesApplied} times)\n`
    if (corr.similarity) {
      prompt += `- Similarity to current: ${(corr.similarity * 100).toFixed(1)}%\n`
    }
  })
  
  prompt += `\nIMPORTANT: When you see similar patterns, use the CORRECT intent from these examples!\n`
  prompt += `These corrections have high priority - they represent explicit user feedback.\n`
  
  return prompt
}

