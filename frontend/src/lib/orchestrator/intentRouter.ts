/**
 * Intent Router
 * 
 * HYBRID APPROACH:
 * 1. Fast pattern matching for obvious intents (write, explain, etc.)
 * 2. LLM-based reasoning for complex cases (pronouns, context, ambiguity)
 * 
 * This makes the orchestrator as intelligent as an AI assistant while staying fast.
 */

import { analyzeLLMIntent, shouldUseLLMAnalysis, type ConversationMessage } from './llmIntentAnalyzer'

export type UserIntent = 
  | 'write_content'        // User wants to write/expand content for a specific section
  | 'answer_question'      // User is asking a question about the story/content
  | 'create_structure'     // User wants to create new story structure
  | 'improve_content'      // User wants to refine/edit existing content
  | 'modify_structure'     // User wants to change the story structure
  | 'clarify_intent'       // Orchestrator needs clarification
  | 'general_chat'         // General conversation/unclear intent

export interface IntentAnalysis {
  intent: UserIntent
  confidence: number // 0-1
  reasoning: string  // Explain why this intent was chosen
  suggestedAction: string // What the orchestrator should do
  requiresContext: boolean // Does this need a selected segment?
  suggestedModel: 'orchestrator' | 'writer' | 'editor' // Which model type to use
  needsClarification?: boolean // True if orchestrator should ask a question
  clarifyingQuestion?: string // Question to ask the user
  usedLLM?: boolean // True if LLM reasoning was used
}

export interface IntentContext {
  message: string
  hasActiveSegment: boolean
  activeSegmentName?: string
  activeSegmentId?: string
  activeSegmentHasContent?: boolean
  conversationHistory?: ConversationMessage[]
  documentStructure?: Array<{ id: string; name: string; level: number }>
  isDocumentViewOpen?: boolean // CRITICAL: Is user working in a document?
  documentFormat?: string // Novel, Report, Screenplay, etc.
  useLLM?: boolean // Force LLM analysis (for testing or complex cases)
}

/**
 * Analyzes user message and determines intent
 * HYBRID: Pattern matching for obvious cases, LLM for complex cases
 */
export async function analyzeIntent(context: IntentContext): Promise<IntentAnalysis> {
  const { message, hasActiveSegment, activeSegmentName, conversationHistory = [] } = context
  const lowerMessage = message.toLowerCase().trim()
  
  // Check if we should use LLM analysis
  const needsLLM = context.useLLM || shouldUseLLMAnalysis(message, conversationHistory.length > 0)
  
  if (needsLLM) {
    console.log('🧠 Using LLM for intent analysis (complex case)...')
    try {
      const llmResult = await analyzeLLMIntent({
        currentMessage: message,
        conversationHistory,
        activeSegment: hasActiveSegment ? {
          id: context.activeSegmentId || '',
          name: activeSegmentName || '',
          title: context.activeSegmentName,
          hasContent: context.activeSegmentHasContent || false
        } : undefined,
        documentStructure: context.documentStructure,
        isDocumentViewOpen: context.isDocumentViewOpen || false, // CRITICAL
        documentFormat: context.documentFormat,
        availableActions: ['write_content', 'answer_question', 'improve_content', 'modify_structure', 'general_chat']
      })
      
      return {
        ...llmResult,
        usedLLM: true
      }
    } catch (error) {
      console.error('LLM intent analysis failed, falling back to patterns:', error)
      // Fall through to pattern matching
    }
  }
  
  // FAST PATH: Pattern-based analysis (original logic)
  console.log('⚡ Using pattern matching for intent analysis...')
  
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
    
    // Ambiguous - user might be asking to write OR having a conversation
    // Only default to writing if it sounds imperative (commands, not questions)
    const imperativePatterns = [
      /^(make|create|add|generate|produce)/i,
      /^(insert|include|put)/i,
    ]
    
    if (lowerMessage.length < 50 && 
        !lowerMessage.includes('?') &&
        imperativePatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'write_content',
        confidence: 0.6,
        reasoning: `Segment "${activeSegmentName}" is selected and user message appears to be an imperative writing instruction`,
        suggestedAction: `Generate content for "${activeSegmentName}" based on the user's guidance: "${message}"`,
        requiresContext: true,
        suggestedModel: 'writer'
      }
    }
    
    // If still ambiguous and segment is selected, lean towards conversation
    // Users often want to discuss content, not always generate it
    if (lowerMessage.length < 30) {
      return {
        intent: 'general_chat',
        confidence: 0.5,
        reasoning: `Ambiguous short message with segment selected - defaulting to conversation rather than assuming writing intent`,
        suggestedAction: `Respond conversationally about "${activeSegmentName}"`,
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
  // PRIORITY 2: Questions and Explanations (regardless of context)
  // These should NEVER trigger content generation, only conversation
  const questionPatterns = [
    /^what/i,
    /^why/i,
    /^how/i,
    /^when/i,
    /^who/i,
    /^where/i,
    /^explain/i,
    /^describe/i,
    /^tell me (about|why|how|what)/i,
    /^can you (tell|explain|describe)/i,
    /what (is|are|does)/i,
    /\?$/,
  ]
  
  if (questionPatterns.some(pattern => pattern.test(message))) {
    return {
      intent: 'answer_question',
      confidence: 0.9,
      reasoning: 'User is asking for explanation or information based on interrogative patterns',
      suggestedAction: 'Answer the user\'s question using orchestrator model in chat',
      requiresContext: false,
      suggestedModel: 'orchestrator'
    }
  }
  
  // PRIORITY 3: Structure creation (ONLY when document panel is CLOSED)
  if (!context.isDocumentViewOpen && !hasActiveSegment) {
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
        reasoning: 'User wants to create a new story structure from scratch (document panel is closed)',
        suggestedAction: 'Generate a complete story structure using orchestrator model',
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
  // If document panel is OPEN and user says "create", they probably mean "write content"
  if (context.isDocumentViewOpen && hasActiveSegment) {
    const createInDocPatterns = [
      /create (a |an )?(scene|chapter|section)/i,
      /^write (a |an )?(scene|chapter|paragraph)/i,
    ]
    
    if (createInDocPatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'write_content',
        confidence: 0.85,
        reasoning: 'User wants to create content within the open document',
        suggestedAction: `Write content for "${activeSegmentName}"`,
        requiresContext: true,
        suggestedModel: 'writer'
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
    case 'clarify_intent':
      return '❓ Need clarification'
    case 'general_chat':
      return '💭 Chatting'
    default:
      return '🤔 Processing...'
  }
}

