/**
 * Conversation Tracker
 * 
 * Tracks conversation state for follow-up handling.
 * Detects when user is responding to previous questions.
 */

import type { ConversationState } from '../../pipeline/types'
import type { ConversationMessage } from '../../../llmIntentAnalyzer'

export class ConversationTracker {
  private state: ConversationState = { type: 'initial' }
  private history: ConversationMessage[] = []
  
  /**
   * Add a message to conversation history
   */
  addMessage(content: string, role: 'user' | 'assistant' = 'user') {
    this.history.push({
      role,
      content,
      timestamp: new Date().toISOString()
    })
    
    // Keep last 10 messages
    if (this.history.length > 10) {
      this.history = this.history.slice(-10)
    }
  }
  
  /**
   * Set conversation state
   */
  setState(state: ConversationState) {
    this.state = state
  }
  
  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return this.state
  }
  
  /**
   * Get conversation history
   */
  getHistory(): ConversationMessage[] {
    return this.history
  }
  
  /**
   * Check if current message is answering a previous question
   */
  isFollowUpResponse(message: string): boolean {
    if (this.state.type === 'initial') {
      return false
    }
    
    const normalized = message.toLowerCase().trim()
    
    // Common follow-up patterns
    const followUpPatterns = [
      /^(yes|yeah|yep|sure|ok)/i,
      /^(no|nope|nah)/i,
      /^(first|second|third|1|2|3)/i,
      /^(the\s+)?(first|second|third)\s+one/i,
      /^(chapter|section|scene|act)\s+\d+/i,
    ]
    
    return followUpPatterns.some(p => p.test(normalized))
  }
  
  /**
   * Get the original request from history
   */
  getOriginalRequest(): string | null {
    // Look back 2-4 messages for original request
    const relevantHistory = this.history.slice(-4, -1)
    const userMessages = relevantHistory.filter(m => m.role === 'user')
    
    return userMessages[0]?.content || null
  }
  
  /**
   * Initialize from existing conversation history
   */
  initializeFromHistory(history: ConversationMessage[]) {
    this.history = history.slice(-10) // Keep last 10
  }
}

