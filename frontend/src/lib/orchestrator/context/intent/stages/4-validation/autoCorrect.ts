/**
 * Auto-Correction Logic
 * 
 * Automatically corrects common mistakes in intent analysis.
 */

import type { IntentAnalysis } from '../../../intentRouter'
import type { PipelineContext } from '../../pipeline/types'

/**
 * Auto-correct analysis based on error
 */
export function autoCorrect(
  error: string,
  analysis: IntentAnalysis,
  context: PipelineContext
): IntentAnalysis | null {
  
  // Auto-correct: create_structure → write_content when panel is open
  if (error.includes('Cannot create new structure while document panel is open')) {
    return {
      ...analysis,
      intent: 'write_content',
      requiresContext: true,
      reasoning: 'Auto-corrected from create_structure to write_content (document panel is open)',
      confidence: Math.max(0.7, analysis.confidence * 0.9) // Slightly lower confidence
    }
  }
  
  // Auto-correct: Clear invalid template suggestion
  if (error.includes("Template") && error.includes("doesn't match format")) {
    return {
      ...analysis,
      extractedEntities: {
        ...analysis.extractedEntities,
        suggestedTemplate: undefined
      },
      reasoning: 'Auto-corrected: Cleared invalid template suggestion'
    }
  }
  
  // Auto-correct: navigate_section → open_and_write when panel is closed
  if (error.includes('Cannot navigate sections when document panel is closed')) {
    return {
      ...analysis,
      intent: 'open_and_write',
      reasoning: 'Auto-corrected from navigate_section to open_and_write (document panel is closed)',
      confidence: Math.max(0.7, analysis.confidence * 0.9)
    }
  }
  
  // Auto-correct: answer_question requiresContext should be false
  if (error.includes('answer_question should never require context')) {
    return {
      ...analysis,
      requiresContext: false,
      reasoning: 'Auto-corrected: answer_question does not require context'
    }
  }
  
  return null
}

