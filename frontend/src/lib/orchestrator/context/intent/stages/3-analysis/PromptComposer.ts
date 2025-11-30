/**
 * Prompt Composer
 * 
 * Dynamically composes prompts from modular pieces based on context.
 * Only includes relevant modules to keep prompts shorter and more focused.
 */

import type { PipelineContext } from '../../pipeline/types'
import { coreIntentRules } from './prompts/core'
import { canvasAwarenessRules } from './prompts/canvas'
import { followUpRules } from './prompts/followUp'
import { templateRules } from './prompts/templates'

export class PromptComposer {
  constructor(private customModules?: string[]) {}
  
  /**
   * Compose prompt from modules based on context
   */
  compose(message: string, context: PipelineContext): string {
    const modules: string[] = []
    
    // Always include core rules
    modules.push(coreIntentRules)
    
    // Add canvas rules if canvas is visible
    if (context.canvasNodes && context.canvasNodes.length > 0) {
      modules.push(canvasAwarenessRules)
    }
    
    // Add follow-up rules if in conversation or follow-up detected
    if (
      context.conversationState?.type !== 'initial' ||
      context.isFollowUpResponse ||
      (context.conversationHistory && context.conversationHistory.length > 0)
    ) {
      modules.push(followUpRules)
    }
    
    // Add template rules if creating structure
    if (this.isStructureCreation(message, context)) {
      modules.push(templateRules)
    }
    
    // Add custom modules if provided
    if (this.customModules) {
      modules.push(...this.customModules)
    }
    
    // Compose final prompt
    return `${modules.join('\n\n---\n\n')}

## Current Context

${this.buildContextSection(context)}

${context.documentFormat ? `\n**IMPORTANT: Current document format is "${context.documentFormat}". Use format-appropriate terminology when extracting section names.**\n` : ''}

## User Message

"${message}"

## Task

Analyze the user's intent using chain-of-thought reasoning. ${context.documentFormat ? `Remember: This is a ${context.documentFormat} document, so use the correct section terminology (e.g., ${this.getFormatTerminology(context.documentFormat)}).` : ''}

<reasoning>
1. Context Check:
   - Document panel: ${context.documentPanelOpen ? 'OPEN' : 'CLOSED'}
   - Active segment: ${context.activeSegment?.name || 'NONE'}
   - Canvas nodes: ${context.canvasNodes?.map(n => n.label).join(', ') || 'NONE'}
   - Conversation state: ${context.conversationState?.type || 'initial'}

2. Reference Resolution:
   - Resolved references: ${JSON.stringify(context.resolvedReferences || {})}
   - Matched nodes: ${context.matchedNodes?.map(n => n.label).join(', ') || 'NONE'}

3. Intent Classification:
   - Primary intent: [classify]
   - Confidence: [0-1]
   - Why: [explain]

4. Validation:
   - Does this make sense given context? [yes/no]
   - Any format mismatches? [check]
   - Multi-step request? [identify steps]
</reasoning>

<intent_analysis>
{
  "intent": "...",
  "confidence": 0.0-1.0,
  "reasoning": "...",
  "suggestedAction": "...",
  "requiresContext": boolean,
  "needsClarification": boolean,
  "extractedEntities": { ... }
}
</intent_analysis>`
  }
  
  /**
   * Check if message is about creating structure
   */
  private isStructureCreation(message: string, context: PipelineContext): boolean {
    const normalized = message.toLowerCase()
    const structureKeywords = /\b(create|make|write|build|generate|start)\b.*\b(novel|story|screenplay|podcast|interview|article|report|essay|blog|guide)\b/i
    
    // Only if document panel is closed
    if (context.documentPanelOpen) {
      return false
    }
    
    return structureKeywords.test(normalized)
  }
  
  /**
   * Get format-specific terminology for the prompt
   */
  private getFormatTerminology(format: string): string {
    const formatMap: Record<string, string> = {
      'novel': 'Chapters, not Scenes',
      'short-story': 'Scenes, not Chapters',
      'screenplay': 'Acts and Scenes, not Chapters',
      'podcast': 'Episodes and Segments',
      'report': 'Sections (numbered like 1.0, 2.0)',
      'article': 'Sections (H2, H3 headings)',
      'essay': 'Body Paragraphs',
    }
    
    return formatMap[format] || 'standard sections'
  }
  
  /**
   * Build context section for the prompt
   */
  private buildContextSection(context: PipelineContext): string {
    let section = `- Document Panel: ${context.documentPanelOpen ? 'OPEN' : 'CLOSED'}`
    
    if (context.documentFormat) {
      section += `\n- Document Type: ${context.documentFormat}`
    }
    
    if (context.activeSegment) {
      section += `\n- Active Segment: "${context.activeSegment.name}"`
      section += `\n- Segment has content: ${context.activeSegment.hasContent ? 'Yes' : 'No'}`
    } else if (context.documentPanelOpen) {
      section += `\n- Document is open but no segment selected`
    }
    
    if (context.canvasNodes && context.canvasNodes.length > 0) {
      section += `\n- Canvas Nodes (${context.canvasNodes.length}):`
      context.canvasNodes.forEach(node => {
        section += `\n  - ${node.label} (${node.type})`
      })
    }
    
    if (context.canvasContext) {
      section += `\n\nCanvas Context:\n${context.canvasContext}`
    }
    
    if (context.conversationState && context.conversationState.type !== 'initial') {
      section += `\n- Conversation State: ${context.conversationState.type}`
      if (context.conversationState.type === 'awaiting_clarification') {
        section += `\n  - Question: ${context.conversationState.question}`
      }
    }
    
    if (context.resolvedReferences && Object.keys(context.resolvedReferences).length > 0) {
      section += `\n- Resolved References: ${JSON.stringify(context.resolvedReferences, null, 2)}`
    }
    
    if (context.matchedNodes && context.matchedNodes.length > 0) {
      section += `\n- Matched Nodes: ${context.matchedNodes.map(n => n.label).join(', ')}`
    }
    
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      section += `\n\nRecent Conversation:`
      context.conversationHistory.slice(-5).forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant'
        const preview = msg.content.length > 100 
          ? msg.content.substring(0, 100) + '...'
          : msg.content
        section += `\n  ${role}: ${preview}`
      })
    }
    
    return section
  }
}

