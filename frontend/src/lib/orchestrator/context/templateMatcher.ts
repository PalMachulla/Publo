/**
 * Template Matcher Post-Processor
 * 
 * Enhances LLM intent analysis with fallback template matching
 * using the template registry's keyword matching.
 * 
 * This acts as a safety net when the LLM misses template keywords.
 */

import { findTemplateByKeywords } from '../schemas/templateRegistry'
import type { LLMIntentResult } from './llmIntentAnalyzer'

/**
 * Enhance intent analysis with template matching
 * 
 * Flow:
 * 1. If LLM already suggested a template, keep it (trust the LLM)
 * 2. If no template suggested, try keyword matching as fallback
 * 3. If match found, add to extractedEntities
 * 
 * @param intent - LLM intent analysis result
 * @param userMessage - Original user message
 * @param format - Document format (if known)
 * @returns Enhanced intent with template suggestion
 */
export function enhanceIntentWithTemplateMatch(
  intent: LLMIntentResult,
  userMessage: string,
  format?: string
): LLMIntentResult {
  // If LLM already suggested a template, trust it
  if (intent.extractedEntities?.suggestedTemplate) {
    console.log('[TemplateMatcher] LLM suggested template:', intent.extractedEntities.suggestedTemplate)
    return intent
  }
  
  // If no format, can't match templates
  if (!format) {
    console.log('[TemplateMatcher] No format provided, skipping template matching')
    return intent
  }
  
  // Try to find template by keywords in user message
  const template = findTemplateByKeywords(format, userMessage)
  
  if (template) {
    console.log('[TemplateMatcher] Fallback match found:', {
      format,
      template: template.id,
      message: userMessage.substring(0, 50)
    })
    
    return {
      ...intent,
      extractedEntities: {
        ...intent.extractedEntities,
        suggestedTemplate: template.id,
        documentFormat: format
      },
      reasoning: `${intent.reasoning}\n\n[Template Matcher] Detected "${template.name}" template from keywords in user message.`
    }
  }
  
  console.log('[TemplateMatcher] No template match found for format:', format)
  return intent
}

/**
 * Extract format from intent analysis
 * 
 * Tries multiple sources:
 * 1. extractedEntities.documentFormat
 * 2. Reasoning text (look for format mentions)
 * 3. Intent type (if create_structure)
 * 
 * @param intent - LLM intent analysis result
 * @returns Detected format or undefined
 */
export function extractFormatFromIntent(intent: LLMIntentResult): string | undefined {
  // Check extractedEntities first
  if (intent.extractedEntities?.documentFormat) {
    return intent.extractedEntities.documentFormat
  }
  
  // Check reasoning for format mentions
  const reasoning = intent.reasoning.toLowerCase()
  const formats = [
    'novel', 'short-story', 'short story',
    'screenplay', 'script',
    'report', 'article', 'essay',
    'podcast', 'blog'
  ]
  
  for (const format of formats) {
    if (reasoning.includes(format)) {
      // Normalize format (e.g., "short story" → "short-story")
      return format.replace(/\s+/g, '-')
    }
  }
  
  return undefined
}

/**
 * Check if user message contains template keywords
 * 
 * @param message - User message
 * @returns True if message likely contains template keywords
 */
export function hasTemplateKeywords(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  
  // Common template keywords
  const keywords = [
    'interview', 'hero', 'journey', 'three act', 'save the cat',
    'feature', 'pilot', 'short film',
    'how-to', 'how to', 'listicle', 'opinion',
    'business', 'research', 'technical',
    'argumentative', 'narrative', 'compare',
    'co-hosted', 'storytelling', 'blank'
  ]
  
  return keywords.some(keyword => lowerMessage.includes(keyword))
}

