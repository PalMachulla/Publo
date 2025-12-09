/**
 * OrchestratorEngine Pattern Learning
 * 
 * Handles pattern extraction and correction detection for learning from user interactions.
 * 
 * Architecture:
 * - These are helper functions that take dependencies as parameters
 * - The main OrchestratorEngine class wraps these with protected methods
 * - This separation allows for better testing and organization
 * 
 * Key Features:
 * - Pattern extraction from user interactions
 * - Correction detection from user feedback
 * - Intent mapping for common variations
 */

import type { IntentAnalysis } from '../context/intentRouter'
import type { CanvasContext } from '../context/contextProvider'
import type { ConversationMessage } from './blackboard'
import type { Blackboard } from './blackboard'

/**
 * Extract learnable patterns from user interactions
 * 
 * Identifies patterns like:
 * - User asks about "the plot" after discussing a document
 * - User uses pronouns ("it", "this") referring to previous context
 * - User wants to write in existing node
 */
export function extractPatternHelper(
  message: string,
  intent: IntentAnalysis,
  canvasContext: CanvasContext,
  blackboard: Blackboard
): { pattern: string; action: string } | null {
  // Extract learnable patterns
  const lowerMessage = message.toLowerCase()
  
  // Pattern: User asks about "the plot" after discussing a specific document
  if (lowerMessage.includes('plot') && canvasContext.connectedNodes.length > 0) {
    const recentNodes = blackboard.getRecentlyReferencedNodes()
    if (recentNodes.length > 0) {
      return {
        pattern: 'user asks about "the plot" after discussing a document',
        action: `resolve to recently discussed node: ${recentNodes[0]}`
      }
    }
  }
  
  // Pattern: User says "it" or "this" referring to previous context
  if ((lowerMessage.includes(' it ') || lowerMessage.includes('this ')) && 
      intent.intent === 'answer_question') {
    return {
      pattern: 'user uses pronoun "it" or "this" in question',
      action: 'resolve to most recently discussed node'
    }
  }
  
  // Pattern: User wants to write in existing node
  if (intent.intent === 'open_and_write') {
    return {
      pattern: `user says "${message.substring(0, 30)}..." to write in existing node`,
      action: 'open_and_write intent detected'
    }
  }
  
  return null
}

/**
 * Detect if user message is correcting a previous misclassification
 * Returns correction info if detected, null otherwise
 * 
 * Handles patterns like:
 * - "I wanted X, not Y"
 * - "I meant X, not Y"
 * - "No, I wanted X"
 * - "That's wrong, I wanted X"
 */
export function detectCorrectionFromMessageHelper(
  message: string,
  conversationHistory: ConversationMessage[]
): { wrongIntent: string; correctIntent: string; originalMessage: string } | null {
  const lowerMessage = message.toLowerCase()
  
  // Pattern: "I wanted X, not Y" or "I meant X, not Y" or "No, I wanted X"
  const correctionPatterns = [
    /i (wanted|meant|asked for) (?:you to )?(\w+)(?:,| )+not (\w+)/i,
    /no,? i (wanted|meant) (\w+)/i,
    /that'?s wrong,? i (wanted|meant) (\w+)/i,
    /(?:actually|correctly),? i (wanted|meant) (\w+)/i,
    /i (wanted|meant) (?:you to )?(\w+),? not (\w+)/i
  ]
  
  for (const pattern of correctionPatterns) {
    const match = message.match(pattern)
    if (match) {
      // Find previous orchestrator action
      const previousAction = conversationHistory
        .slice(-5)
        .reverse()
        .find((m: ConversationMessage) => m.role === 'orchestrator' && m.metadata?.intent)
      
      if (previousAction && previousAction.metadata?.intent) {
        const wrongIntent = previousAction.metadata.intent
        
        // Extract correct intent from correction message
        // Pattern groups: [full match, verb, correct intent, wrong intent]
        let correctIntent = match[2] || match[3] // Depending on pattern
        
        // Map common variations to actual intent types
        const intentMap: Record<string, string> = {
          'open': 'open_and_write',
          'open_and_write': 'open_and_write',
          'create': 'create_structure',
          'create_structure': 'create_structure',
          'write': 'write_content',
          'write_content': 'write_content',
          'navigate': 'navigate_section',
          'navigate_section': 'navigate_section',
          'delete': 'delete_node',
          'delete_node': 'delete_node'
        }
        
        correctIntent = intentMap[correctIntent.toLowerCase()] || correctIntent
        
        // Find original user message (2-3 messages back)
        const originalMessage = conversationHistory
          .slice(-5)
          .reverse()
          .find((m: ConversationMessage) => m.role === 'user')?.content || message
        
        return {
          wrongIntent,
          correctIntent,
          originalMessage
        }
      }
    }
  }
  
  return null
}

