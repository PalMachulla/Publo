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
  
  // Rule 3: Format mismatch detection (comprehensive)
  (analysis, context) => {
    // Get format from context (documentFormat is in PipelineContext, not extractedEntities)
    const format = context.documentFormat
    const targetSegment = analysis.extractedEntities?.targetSegment
    const userMessage = context.conversationHistory?.[context.conversationHistory.length - 1]?.content || ''
    
    if (!format) {
      return { valid: true }
    }
    
    const normalizedFormat = format.toLowerCase().replace(/-/g, '_')
    const lowerMessage = userMessage.toLowerCase()
    const lowerSegment = targetSegment?.toLowerCase() || ''
    
    // Comprehensive format mismatch rules
    const mismatches = [
      // Short story: Should use SCENES, not chapters
      { 
        format: 'short_story', 
        wrongTerm: 'chapter', 
        correctTerm: 'scene',
        checkMessage: true // Check both message and segment
      },
      // Screenplay: Should use ACTS and SCENES, not chapters
      { 
        format: 'screenplay', 
        wrongTerm: 'chapter', 
        correctTerm: 'act or scene',
        checkMessage: true
      },
      // Report: Should use SECTIONS, not chapters
      { 
        format: 'report', 
        wrongTerm: 'chapter', 
        correctTerm: 'section',
        checkMessage: true
      },
      // Podcast: Should use EPISODES and SEGMENTS, not chapters
      { 
        format: 'podcast', 
        wrongTerm: 'chapter', 
        correctTerm: 'episode or segment',
        checkMessage: true
      },
      // Article/Essay: Should use SECTIONS, not chapters
      { 
        format: 'article', 
        wrongTerm: 'chapter', 
        correctTerm: 'section',
        checkMessage: true
      },
      { 
        format: 'essay', 
        wrongTerm: 'chapter', 
        correctTerm: 'section',
        checkMessage: true
      },
      // Novel: Chapters are correct, but scenes might be wrong (optional)
      { 
        format: 'novel', 
        wrongTerm: 'scene', 
        correctTerm: 'chapter',
        checkMessage: false, // Only check segment, not message (scenes can exist in novels)
        optional: true // This is a soft warning, not a hard error
      },
    ]
    
    for (const mismatch of mismatches) {
      // Check if format matches (with prefix matching for report variants)
      const formatMatches = normalizedFormat === mismatch.format || 
                           (mismatch.format === 'report' && normalizedFormat.startsWith('report'))
      
      if (!formatMatches) continue
      
      // Check for wrong term in message or segment
      const hasWrongTerm = (mismatch.checkMessage && lowerMessage.includes(mismatch.wrongTerm)) ||
                          lowerSegment.includes(mismatch.wrongTerm)
      
      if (hasWrongTerm) {
        return {
          valid: mismatch.optional !== true, // Soft warning for optional mismatches
          error: `${format} typically uses ${mismatch.correctTerm}, not ${mismatch.wrongTerm}. Did you mean ${mismatch.correctTerm}?`,
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
    const format = context.documentFormat
    
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

