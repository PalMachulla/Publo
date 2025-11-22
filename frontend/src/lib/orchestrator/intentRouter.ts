/**
 * Intent Router
 * 
 * Classifies user messages into actionable intents using keyword analysis and context.
 * This is the "reasoning brain" that decides what action the orchestrator should take.
 */

export type UserIntent = 
  | 'write_content'        // User wants to write/expand content for a specific section
  | 'answer_question'      // User is asking a question about the story/content
  | 'create_structure'     // User wants to create new story structure
  | 'improve_content'      // User wants to refine/edit existing content
  | 'modify_structure'     // User wants to change the story structure
  | 'general_chat'         // General conversation/unclear intent

export interface IntentAnalysis {
  intent: UserIntent
  confidence: number // 0-1
  reasoning: string  // Explain why this intent was chosen
  suggestedAction: string // What the orchestrator should do
  requiresContext: boolean // Does this need a selected segment?
  suggestedModel: 'orchestrator' | 'writer' | 'editor' // Which model type to use
}

export interface IntentContext {
  message: string
  hasActiveSegment: boolean
  activeSegmentName?: string
  conversationHistory?: Array<{ role: string; content: string }>
}

/**
 * Analyzes user message and determines intent
 */
export function analyzeIntent(context: IntentContext): IntentAnalysis {
  const { message, hasActiveSegment, activeSegmentName } = context
  const lowerMessage = message.toLowerCase().trim()
  
  // PRIORITY 1: Content writing/expansion (when segment is selected)
  if (hasActiveSegment) {
    // Strong write indicators
    const writePatterns = [
      /^write/i,
      /^expand/i,
      /^continue/i,
      /^add (more|content)/i,
      /^fill in/i,
      /^develop/i,
      /more (content|writing|text)/i,
      /^extend/i,
      /^flesh out/i,
    ]
    
    if (writePatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'write_content',
        confidence: 0.95,
        reasoning: `User explicitly requested content generation for "${activeSegmentName}" with keywords like "write", "expand", or "continue"`,
        suggestedAction: `Generate content for the selected section: "${activeSegmentName}"`,
        requiresContext: true,
        suggestedModel: 'writer'
      }
    }
    
    // Improvement indicators
    const improvePatterns = [
      /^improve/i,
      /^refine/i,
      /^polish/i,
      /^edit/i,
      /^revise/i,
      /^enhance/i,
      /make (it )?better/i,
      /more (vivid|descriptive|engaging)/i,
    ]
    
    if (improvePatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'improve_content',
        confidence: 0.9,
        reasoning: `User wants to improve existing content in "${activeSegmentName}"`,
        suggestedAction: `Refine and enhance the content in: "${activeSegmentName}"`,
        requiresContext: true,
        suggestedModel: 'editor'
      }
    }
    
    // Ambiguous - user might be asking to write OR asking a question
    // Default to writing if segment is selected and message is brief
    if (lowerMessage.length < 50 && !lowerMessage.includes('?')) {
      return {
        intent: 'write_content',
        confidence: 0.7,
        reasoning: `Segment "${activeSegmentName}" is selected and user message appears to be a writing instruction`,
        suggestedAction: `Generate content for "${activeSegmentName}" based on the user's guidance: "${message}"`,
        requiresContext: true,
        suggestedModel: 'writer'
      }
    }
  }
  
  // PRIORITY 2: Questions (regardless of context)
  const questionPatterns = [
    /^what/i,
    /^why/i,
    /^how/i,
    /^when/i,
    /^who/i,
    /^where/i,
    /^can you (tell|explain)/i,
    /\?$/,
  ]
  
  if (questionPatterns.some(pattern => pattern.test(message))) {
    return {
      intent: 'answer_question',
      confidence: 0.85,
      reasoning: 'User is asking a question based on interrogative patterns',
      suggestedAction: 'Answer the user\'s question using orchestrator model',
      requiresContext: false,
      suggestedModel: 'orchestrator'
    }
  }
  
  // PRIORITY 3: Structure creation (no segment selected, creation keywords)
  if (!hasActiveSegment) {
    const structurePatterns = [
      /create (a |an )?story/i,
      /create (a |an )?(novel|screenplay|article|report)/i,
      /generate (a )?structure/i,
      /plan (a )?story/i,
      /outline/i,
      /^i want to (write|create)/i,
    ]
    
    if (structurePatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'create_structure',
        confidence: 0.9,
        reasoning: 'User wants to create a new story structure from scratch',
        suggestedAction: 'Generate a complete story structure using orchestrator model',
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
  // PRIORITY 4: Structure modification
  const modifyStructurePatterns = [
    /add (a |an )?(chapter|section|act|scene)/i,
    /remove (this |the )?(chapter|section|act|scene)/i,
    /rename/i,
    /reorder/i,
    /move (this |the )?section/i,
  ]
  
  if (modifyStructurePatterns.some(pattern => pattern.test(message))) {
    return {
      intent: 'modify_structure',
      confidence: 0.85,
      reasoning: 'User wants to modify the existing story structure',
      suggestedAction: 'Update the story structure based on user request',
      requiresContext: false,
      suggestedModel: 'orchestrator'
    }
  }
  
  // DEFAULT: General chat or unclear intent
  return {
    intent: 'general_chat',
    confidence: 0.5,
    reasoning: 'Unable to determine specific intent - treating as general conversation',
    suggestedAction: hasActiveSegment 
      ? `Respond conversationally about "${activeSegmentName}"`
      : 'Respond conversationally and ask for clarification if needed',
    requiresContext: false,
    suggestedModel: 'orchestrator'
  }
}

/**
 * Validates if the detected intent can be executed given the current context
 */
export function validateIntent(analysis: IntentAnalysis, hasActiveSegment: boolean): {
  canExecute: boolean
  errorMessage?: string
  suggestion?: string
} {
  // Check if intent requires context but none is selected
  if (analysis.requiresContext && !hasActiveSegment) {
    return {
      canExecute: false,
      errorMessage: `Action "${analysis.intent}" requires a selected segment`,
      suggestion: 'Please click on a section in the document view to select it first'
    }
  }
  
  // All validations passed
  return {
    canExecute: true
  }
}

/**
 * Helper to explain the intent to the user in natural language
 */
export function explainIntent(analysis: IntentAnalysis): string {
  switch (analysis.intent) {
    case 'write_content':
      return '✍️ Writing content for selected section'
    case 'answer_question':
      return '💬 Answering your question'
    case 'create_structure':
      return '🏗️ Creating story structure'
    case 'improve_content':
      return '✨ Improving existing content'
    case 'modify_structure':
      return '🔧 Modifying story structure'
    case 'general_chat':
      return '💭 Chatting'
    default:
      return '🤔 Processing...'
  }
}

