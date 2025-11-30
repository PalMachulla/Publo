/**
 * Validation Rules
 * 
 * Rules for validating intent analysis consistency and correctness.
 */

import type { IntentAnalysis } from '../../../intentRouter'
import type { PipelineContext } from '../../pipeline/types'

export interface ValidationRule {
  (analysis: IntentAnalysis, context: PipelineContext): {
    valid: boolean
    error?: string
    autoCorrect?: boolean
  }
}

/**
 * Validation rules array
 */
export const validationRules: ValidationRule[] = [
  // Rule 1: Can't create_structure if document panel is open
  (analysis, context) => {
    if (analysis.intent === 'create_structure' && context.documentPanelOpen) {
      return {
        valid: false,
        error: 'Cannot create new structure while document panel is open. User likely wants write_content.',
        autoCorrect: true
      }
    }
    return { valid: true }
  },
  
  // Rule 2: write_content requires active segment
  (analysis, context) => {
    if (analysis.requiresContext && !context.activeSegment && !context.documentPanelOpen) {
      return {
        valid: false,
        error: 'Intent requires active segment but none selected. Need to open document first.',
        autoCorrect: false
      }
    }
    return { valid: true }
  },
  
  // Rule 3: Format mismatch detection
  (analysis, context) => {
    const format = analysis.extractedEntities?.documentFormat
    const targetSegment = analysis.extractedEntities?.targetSegment
    
    if (!format || !targetSegment) {
      return { valid: true }
    }
    
    const mismatches = [
      { format: 'short-story', wrongTerm: 'chapter', correctTerm: 'scene' },
      { format: 'screenplay', wrongTerm: 'chapter', correctTerm: 'act or scene' },
      { format: 'novel', wrongTerm: 'scene', correctTerm: 'chapter' },
    ]
    
    for (const mismatch of mismatches) {
      if (format.includes(mismatch.format) && targetSegment.toLowerCase().includes(mismatch.wrongTerm)) {
        return {
          valid: false,
          error: `Format mismatch: ${format} typically uses ${mismatch.correctTerm}, not ${mismatch.wrongTerm}. Did you mean ${mismatch.correctTerm}?`,
          autoCorrect: false // Ask user, don't auto-correct
        }
      }
    }
    
    return { valid: true }
  },
  
  // Rule 4: Confidence check
  (analysis, context) => {
    if (analysis.confidence < 0.5) {
      return {
        valid: false,
        error: 'Low confidence analysis. Need clarification from user.',
        autoCorrect: false
      }
    }
    return { valid: true }
  },
  
  // Rule 5: Template suggestion validation
  (analysis, context) => {
    const template = analysis.extractedEntities?.suggestedTemplate
    const format = analysis.extractedEntities?.documentFormat
    
    // If template is suggested, make sure it matches format
    if (template && format) {
      const validPairs = [
        { template: 'interview', format: 'podcast' },
        { template: 'heros-journey', format: 'novel' },
        { template: 'feature', format: 'screenplay' },
        { template: 'three-act', format: 'novel' },
      ]
      
      const isValid = validPairs.some(
        pair => template.includes(pair.template) && format.includes(pair.format)
      )
      
      if (!isValid) {
        return {
          valid: false,
          error: `Template "${template}" doesn't match format "${format}"`,
          autoCorrect: true // Clear the template
        }
      }
    }
    
    return { valid: true }
  },
  
  // Rule 6: navigate_section only when document is open
  (analysis, context) => {
    if (analysis.intent === 'navigate_section' && !context.documentPanelOpen) {
      return {
        valid: false,
        error: 'Cannot navigate sections when document panel is closed. User likely wants open_and_write.',
        autoCorrect: true
      }
    }
    return { valid: true }
  },
  
  // Rule 7: answer_question should never require context
  (analysis, context) => {
    if (analysis.intent === 'answer_question' && analysis.requiresContext) {
      return {
        valid: false,
        error: 'answer_question should never require context',
        autoCorrect: true
      }
    }
    return { valid: true }
  }
]

