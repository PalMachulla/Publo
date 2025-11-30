/**
 * Validator - Stage 4
 * 
 * Validates intent analysis for consistency and auto-corrects common issues.
 */

import type { IntentAnalysis } from '../../../intentRouter'
import type { PipelineContext, ValidationResult } from '../../pipeline/types'
import { validationRules } from './rules'
import { autoCorrect } from './autoCorrect'

export class Validator {
  private customRules: Array<(analysis: IntentAnalysis, context: PipelineContext) => {
    valid: boolean
    error?: string
    autoCorrect?: boolean
  }>
  
  constructor(customRules?: Array<(analysis: IntentAnalysis, context: PipelineContext) => {
    valid: boolean
    error?: string
    autoCorrect?: boolean
  }>) {
    this.customRules = customRules || []
  }
  
  /**
   * Validate intent analysis
   */
  async validate(
    analysis: IntentAnalysis,
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    console.log('✔️ [Validator] Validating analysis...')
    
    const errors: string[] = []
    const warnings: string[] = []
    let corrected = { ...analysis }
    
    // Run all validation rules
    const allRules = [...validationRules, ...this.customRules]
    for (const rule of allRules) {
      const result = rule(corrected, context)
      
      if (!result.valid) {
        errors.push(result.error || 'Validation failed')
        
        // Try auto-correction
        if (result.autoCorrect && result.error) {
          const correction = autoCorrect(result.error, corrected, context)
          if (correction) {
            corrected = correction
            warnings.push(`Auto-corrected: ${result.error}`)
            console.log(`⚠️ [Validator] ${result.error} → Auto-corrected`)
          }
        } else if (result.error) {
          // Mark as needs clarification
          corrected.needsClarification = true
          corrected.clarifyingQuestion = result.error
          console.log(`⚠️ [Validator] ${result.error} → Needs clarification`)
        }
      }
    }
    
    if (errors.length > 0) {
      console.warn(`⚠️ [Validator] Found ${errors.length} issues:`, errors)
    }
    
    if (warnings.length > 0) {
      console.log(`ℹ️ [Validator] Auto-corrected ${warnings.length} issues:`, warnings)
    }
    
    return corrected
  }
}

