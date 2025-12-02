/**
 * Intent Router
 * 
 * HYBRID APPROACH:
 * 1. Fast pattern matching for obvious intents (write, explain, etc.)
 * 2. LLM-based reasoning for complex cases (pronouns, context, ambiguity)
 * 
 * This makes the orchestrator as intelligent as an AI assistant while staying fast.
 */

// ✅ DEPRECATED: Legacy LLM analyzer imports removed (legacy system commented out)
// import { analyzeLLMIntent, shouldUseLLMAnalysis } from './llmIntentAnalyzer'
import type { ConversationMessage } from '../core/blackboard'
import type { WorldStateManager } from '../core/worldState'
import type { Blackboard } from '../core/blackboard'
import { Node } from 'reactflow'
import { IntentPipeline } from './intent/pipeline/IntentPipeline'
import { intentContextToPipelineContext, pipelineAnalysisToIntentAnalysis } from './intent/utils/adapter'

export type UserIntent = 
  | 'write_content'        // User wants to write/expand content for a specific section
  | 'answer_question'      // User is asking a question about the story/content
  | 'create_structure'     // User wants to create new story structure
  | 'improve_content'      // User wants to refine/edit existing content
  | 'modify_structure'     // User wants to change the story structure
  | 'rewrite_with_coherence' // User wants to rewrite section(s) AND update related sections for consistency
  | 'navigate_section'     // User wants to navigate/jump to a specific section within open document
  | 'open_and_write'       // User wants to write in an existing canvas node (auto-open document)
  | 'delete_node'          // User wants to delete/remove a canvas node
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
  extractedEntities?: {
    targetSegment?: string
    referenceContent?: string
    sourceDocument?: string // Name or ID of source document (e.g., "Screenplay", "Podcast")
    isExplicitSourceReference?: boolean // True if user explicitly said "based on X", "using X"
    suggestedTemplate?: string // Template ID matched from keywords (e.g., "interview", "heros-journey", "feature")
  }
  // Pipeline-specific metrics (optional, stripped by adapter)
  pipelineMetrics?: any
  totalTime?: number
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
  canvasContext?: string // CANVAS VISIBILITY: Formatted canvas context for LLM
  availableModels?: any[] // Available models from user's API keys (for model router)
  corrections?: any[] // NEW: Learned correction patterns for intent classification
}

/**
 * Analyzes user message and determines intent
 * HYBRID: Pattern matching for obvious cases, LLM for complex cases
 * 
 * Feature flag: USE_NEW_INTENT_PIPELINE
 * When enabled, uses the new 4-stage pipeline instead of the hybrid approach.
 */
export async function analyzeIntent(
  context: IntentContext,
  canvasNodes?: Node[],  // ✅ ADD: Accept canvasNodes parameter
  worldState?: WorldStateManager,  // ✅ ADD: Accept worldState for better context
  blackboard?: Blackboard  // ✅ ADD: Accept blackboard for better context
): Promise<IntentAnalysis> {
  // ✅ NEW PIPELINE ONLY: Legacy system has been deprecated
  // The new 4-stage IntentPipeline is now the only path for intent analysis.
  // If the pipeline fails, we return a fallback intent rather than using legacy code.
  
  console.log('🚀 [Intent] Using new intent pipeline...')
  try {
    // Convert IntentContext to PipelineContext
    // ✅ FIX: Pass canvasNodes, worldState, and blackboard to adapter
    const pipelineContext = intentContextToPipelineContext(
      context,
      worldState,
      blackboard,
      canvasNodes  // ✅ Pass actual nodes array
    )
    
    // Create pipeline instance
    const pipeline = new IntentPipeline()
    
    // ✅ NEW: Update pipeline with available models from user's API keys
    if (context.availableModels && context.availableModels.length > 0) {
      console.log('📦 [Intent] Updating pipeline with', context.availableModels.length, 'available models')
      pipeline.updateAvailableModels(context.availableModels)
    } else {
      console.warn('⚠️ [Intent] No available models provided - pipeline will use API defaults')
    }
    
    // ✅ NEW: Update pipeline with learned corrections
    if (context.corrections && context.corrections.length > 0) {
      console.log('📚 [Intent] Updating pipeline with', context.corrections.length, 'learned corrections')
      pipeline.updateCorrections(context.corrections)
    }
    
    // Analyze through pipeline
    const pipelineResult = await pipeline.analyze(context.message, pipelineContext)
    
    // Convert back to IntentAnalysis format
    return pipelineAnalysisToIntentAnalysis(pipelineResult)
  } catch (error) {
    console.error('❌ [Intent] New pipeline failed:', error)
    console.warn('⚠️ [Intent] Pipeline error details:', error instanceof Error ? error.message : String(error))
    // ✅ DEPRECATED: Legacy system removed - new pipeline is the only path
    // If pipeline fails, return a fallback intent rather than using legacy code
    return {
      intent: 'general_chat',
      confidence: 0.3,
      reasoning: 'Intent pipeline failed - unable to analyze user message',
      suggestedAction: 'Please try rephrasing your request',
      requiresContext: false,
      suggestedModel: 'orchestrator',
      usedLLM: false
    }
  }
  
  // ============================================================
  // ✅ DEPRECATED: LEGACY SYSTEM (commented out)
  // ============================================================
  // The legacy hybrid approach (pattern matching + LLM fallback) has been
  // replaced by the new 4-stage IntentPipeline system.
  // 
  // Reasons for deprecation:
  // 1. New pipeline is more modular and maintainable
  // 2. Better performance with staged analysis (Triage → Context → Deep Analysis → Validation)
  // 3. Modular prompts (core.ts, canvas.ts, followUp.ts, templates.ts) are easier to update
  // 4. Better error handling and validation
  // 5. Supports learned corrections and model routing
  //
  // If you need to restore legacy behavior, uncomment the code below.
  // However, the new pipeline should be preferred and any issues should be fixed in the pipeline.
  // ============================================================
  
  /*
  // LEGACY SYSTEM (original hybrid approach)
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
        availableActions: ['write_content', 'answer_question', 'improve_content', 'modify_structure', 'general_chat'],
        canvasContext: context.canvasContext // CANVAS VISIBILITY
      })
      
      return {
        ...llmResult,
        usedLLM: true
      }
    } catch (error) {
      console.error('🔄 [Intent] LLM analysis failed, falling back to patterns:', error)
      console.log('📍 [Intent] Will use pattern-based detection as fallback')
      // Fall through to pattern matching
    }
  }
  
  // FAST PATH: Pattern-based analysis (original logic)
  console.log('⚡ Using pattern matching for intent analysis...')
  
  // PRIORITY 0: Navigation within open document (CRITICAL: must come before other intents)
  if (context.isDocumentViewOpen) {
    const navigationPatterns = [
      // Generic navigation
      /^(go to|jump to|navigate to|show me|open|scroll to|take me to)\s+(the\s+)?(chapter|section|scene|act|part|sequence|beat)/i,
      /^(go to|jump to|navigate to|show me)\s+(chapter|section|scene|act|part|beat)\s+\d+/i,
      
      // Screenplay-specific (scenes and beats)
      /^(scene|beat)\s+\d+/i,
      /^(open|show|go to)\s+(scene|beat)/i,
      
      // Short forms like "scene 1" or "beat 2"
      /^(chapter|section|scene|act|part|sequence|beat)\s+\d+/i,
    ]
    
    if (navigationPatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'navigate_section',
        confidence: 0.95,
        reasoning: `User wants to navigate to a specific section within the currently open ${context.documentFormat || 'document'}`,
        suggestedAction: `Find and select the requested section: "${message}"`,
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
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
    
    // Coherence-aware rewriting and Multi-section generation
    const coherencePatterns = [
      /keep (it |the story |everything )?coherent/i,
      /maintain consistency/i,
      /(update|fix|adjust|revise) (earlier|previous|other|related) (sections?|parts?|chapters?)/i,
      /and (also )?(update|change|fix|adjust|rewrite) (earlier|previous|related)/i,
      /make sure (it |everything )?makes sense/i,
      /(rewrite|change).*(and|then) (update|fix|adjust)/i,
      /fix (any )?continuity/i,
      /keep (the )?story consistent/i,
      // Multi-section generation patterns
      /(write|generate|create|fill).*(all|every|multiple).*(scenes?|chapters?|sections?)/i,
      /(write|generate|create|fill).*(scene|chapter|section).*(after|following).*(scene|chapter|section)/i,
      /start with.*and (write|continue|finish).*(rest|all|others)/i,
    ]
    
    if (coherencePatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'rewrite_with_coherence',
        confidence: 0.95,
        reasoning: `User wants multi-section operation: modify "${activeSegmentName}" and/or other sections (coherence/batch generation)`,
        suggestedAction: `Analyze dependencies, write/rewrite sections, and ensure story consistency`,
        requiresContext: true,
        suggestedModel: 'orchestrator' // Orchestrator plans, then delegates to writers
      }
    }
    
    // Improvement indicators (single-section only)
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
  
  // PRIORITY 2: Delete/Remove Node (canvas operations)
  const deletePatterns = [
    /^(remove|delete|get rid of|discard|trash|eliminate).*(the |this |that )?(novel|screenplay|report|podcast|story|node)/i,
    /(remove|delete).*(node|document|story)/i,
    /^(remove|delete)/i,
  ]
  
  if (deletePatterns.some(pattern => pattern.test(message))) {
    return {
      intent: 'delete_node',
      confidence: 0.9,
      reasoning: `User wants to delete/remove a canvas node`,
      suggestedAction: `Identify which node to delete and confirm with user`,
      requiresContext: false,
      suggestedModel: 'orchestrator'
    }
  }
  
  // PRIORITY 3: Questions and Explanations (regardless of context)
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
    /^help me (figure out|understand|with)/i,
    /what (is|are|does|was|were)/i,
    /what.*all about/i,
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
  
  // PRIORITY 3: Write in existing node (user references a canvas node)
  // HELPFUL MODE: Auto-open the document when user wants to write in a node
  if (!context.isDocumentViewOpen && !hasActiveSegment && context.canvasContext) {
    const writeInNodePatterns = [
      // "Open" commands - CRITICAL for "open the novel", "let's open the screenplay"
      /^(open|show|display|view).*(the|that|this|my|our) (novel|screenplay|report|podcast|document|node)/i,
      /^let'?s (open|work on|edit).*(the|that|this|my|our) (novel|screenplay|report|podcast|document)/i,
      
      // Direct "write in" phrases - CRITICAL for "write [sections] in [our/the/my] [document]"
      /(write|craft|fill|expand|develop).*(the|first|second|third|three|two|1|2|3).*(chapter|act|scene|section|episode).*(in |to |for )(our|the|that|this|my) (novel|screenplay|report|podcast|document)/i,
      /(write|craft|fill|expand|develop).*(in |to )(that|the|this|my|our) (node|document|podcast|screenplay|novel|report)/i,
      /(add|put|insert|write|get).*(content|text|words).*(in |to |for )(that|the|this|my|our)/i,
      /(work on|edit|improve).*(that|the|this|my|our) (node|document|podcast|screenplay|novel|report)/i,
      /help (me )?(craft|write|fill|expand).*(node|document|podcast|screenplay|novel|report)/i,
      
      // "Get/add content to/for my X" - CRITICAL for "get some content to my podcast"
      /(get|add|create|generate).*(content|text|words).*(to|for|in) (my|the|that|this|our) (podcast|screenplay|novel|report|document)/i,
      /help (me )?(get|add|create).*(my|the|that|our) (podcast|screenplay|novel|report|document)/i,
      
      // "Help me with X" when X is an existing node
      /help (me )?with (the|my|that|this|our) (podcast|screenplay|novel|report|document)/i,
    ]
    
    if (writeInNodePatterns.some(pattern => pattern.test(message))) {
      return {
        intent: 'open_and_write',
        confidence: 0.95,
        reasoning: 'User wants to write content in an existing canvas node - will auto-open document',
        suggestedAction: 'Open the referenced document and prepare for content writing',
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
  // PRIORITY 4: Structure creation (ONLY when document panel is CLOSED)
  if (!context.isDocumentViewOpen && !hasActiveSegment) {
    const structurePatterns = [
      /create (a |an )?story/i,
      /create (a |an )?(novel|screenplay|article|report|podcast|interview)/i,
      /generate (a )?structure/i,
      /plan (a )?story/i,
      /outline/i,
      /^i want to (write|create)/i,
      /make (a |an )?interview/i,
      /interview (the )?characters/i,
      /base(d)? (this|it) on/i,
      /using (the |our )?screenplay/i,
      /adapt (the |our )?(screenplay|story|novel)/i,
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
  
  // PRIORITY 5: Structure modification
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
  */
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
    case 'rewrite_with_coherence':
      return '🎭 Ghostwriter mode: Analyzing dependencies and planning coherent rewrites'
    case 'navigate_section':
      return '🧭 Navigating to section'
    case 'open_and_write':
      return '📂 Opening document to write content'
    case 'delete_node':
      return '🗑️ Deleting node'
    case 'clarify_intent':
      return '❓ Need clarification'
    case 'general_chat':
      return '💭 Chatting'
    default:
      return '🤔 Processing...'
  }
}

