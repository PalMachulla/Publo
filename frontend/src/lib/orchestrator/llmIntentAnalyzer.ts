/**
 * LLM-Based Intent Analyzer
 * 
 * Uses the orchestrator model to reason about user intent instead of pattern matching.
 * This enables:
 * - Understanding pronouns and references ("it", "this", "that")
 * - Multi-turn conversation awareness
 * - Asking clarifying questions when unsure
 * - Context-aware reasoning
 */

import type { IntentAnalysis, UserIntent } from './intentRouter'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface LLMIntentContext {
  currentMessage: string
  conversationHistory: ConversationMessage[]
  activeSegment?: {
    id: string
    name: string
    title?: string
    hasContent: boolean
  }
  documentStructure?: Array<{
    id: string
    name: string
    level: number
  }>
  isDocumentViewOpen: boolean // Is user working inside a document?
  documentFormat?: string // Novel, Report, Screenplay, etc.
  availableActions: UserIntent[]
  canvasContext?: string // CANVAS VISIBILITY: Connected nodes visible to orchestrator
}

export interface LLMIntentResult extends IntentAnalysis {
  needsClarification: boolean
  clarifyingQuestion?: string
  extractedEntities?: {
    targetSegment?: string
    referenceContent?: string
  }
}

/**
 * System prompt for intent analysis
 */
const INTENT_ANALYSIS_SYSTEM_PROMPT = `You are an intelligent intent analyzer for a creative writing assistant.

Your job is to analyze user messages and determine their intent, considering:
1. Canvas context - WHAT NODES ARE VISIBLE to the orchestrator (stories, documents, research, etc.)
2. The current message
3. Recent conversation history (to understand "it", "this", "that")
4. The active segment/section in the document
5. Whether the document panel is open (CRITICAL FOR INTENT!)
6. Available actions the system can perform

CANVAS AWARENESS (CRITICAL!):
- When user says "our other story", "that screenplay", "the characters", look at the canvas context to identify it
- If user wants to "base this on X", "interview characters in X", "adapt X", use the canvas context to find node X
- Canvas context shows ALL nodes connected to the orchestrator - these are resources you can reference
- If canvas shows a screenplay/story node AND user says "make interview" or "interview the characters", this is create_structure (NOT general_chat!)
- Pattern: "Make an interview with characters in [screenplay]" → create_structure intent using screenplay as reference

Available intents:
- write_content: User wants to generate NEW narrative content for a section
- answer_question: User wants information, explanation, or discussion (respond in chat)
- improve_content: User wants to refine/enhance existing content IN ONE SECTION ONLY
- rewrite_with_coherence: User wants GHOSTWRITER-LEVEL rewrite - modify section AND update related sections for narrative consistency/coherence
- modify_structure: User wants to change document structure (add/remove sections)
- create_structure: User wants to create a BRAND NEW story/document (only when document panel is CLOSED)
- clarify_intent: You're unsure and need to ask a clarifying question

CRITICAL CONTEXT RULES:
- If document panel is OPEN → User is working INSIDE that document
  * "write more" → write_content (for current section)
  * "add X to Y" → modify_structure (within this document)
  * NEVER create_structure (don't make new documents)
  
- If document panel is CLOSED → User is on the canvas
  * "create a novel" → create_structure (new document node)
  * "write about X" → create_structure (needs new document first)

Guidelines:
- If user says "write more", "expand", "continue" → write_content (requiresContext: true)
- If user says "explain", "what is", "tell me about" → answer_question (requiresContext: false - can answer from canvas context or general knowledge)
- If user says "improve", "make it better", "polish" (ONE section) → improve_content (requiresContext: true)
- If user says "rewrite X and update other sections", "keep it coherent", "maintain consistency", "fix earlier parts too" → rewrite_with_coherence (GHOSTWRITER MODE, requiresContext: true)
- If user references previous chat ("add it", "put that") → check conversation history
- If ambiguous or unclear → clarify_intent (ask a question)

IMPORTANT - requiresContext Rules:
- answer_question → ALWAYS requiresContext: false (can answer from canvas, conversation, or general knowledge)
- write_content, improve_content, rewrite_with_coherence → requiresContext: true (needs selected segment)
- create_structure, general_chat, clarify_intent → requiresContext: false

GHOSTWRITER MODE INDICATORS:
- "and update related/earlier/other sections"
- "keep the story coherent/consistent"
- "make sure everything makes sense"
- "fix continuity"
- Any request that implies MULTIPLE sections need updating for coherence

Be context-aware:
- "it" or "this" usually refers to the most recent explanation or the selected segment
- "add X to Y" means modify the Y section with content X
- Conversational follow-ups relate to the previous exchange
- Document panel open = work WITHIN document, not create new ones!

Return your analysis as JSON with this structure:
{
  "intent": "write_content" | "answer_question" | "improve_content" | "rewrite_with_coherence" | "modify_structure" | "clarify_intent",
  "confidence": 0.0-1.0,
  "reasoning": "Explain your thought process",
  "suggestedAction": "What the system should do",
  "requiresContext": boolean,
  "suggestedModel": "orchestrator" | "writer" | "editor",
  "needsClarification": boolean,
  "clarifyingQuestion": "Question to ask user if needsClarification is true",
  "extractedEntities": {
    "targetSegment": "Which section to act on",
    "referenceContent": "Content being referenced from conversation"
  }
}

Be smart, conversational, and helpful. When in doubt, ask!`

/**
 * Analyze intent using LLM reasoning
 */
export async function analyzeLLMIntent(
  context: LLMIntentContext
): Promise<LLMIntentResult> {
  
  // Build the analysis prompt
  const contextString = buildContextString(context)
  
  const analysisPrompt = `${contextString}

Current user message: "${context.currentMessage}"

Analyze this message and determine the user's intent. Consider the conversation history and current context.

Return ONLY valid JSON with your analysis.`

  try {
    // Call the orchestrator via our API
    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: INTENT_ANALYSIS_SYSTEM_PROMPT,
        user_prompt: analysisPrompt,
        conversation_history: context.conversationHistory.slice(-5), // Last 5 messages
        temperature: 0.3 // Lower temp for more consistent intent detection
      })
    })

    if (!response.ok) {
      console.error('[LLM Intent] API error:', response.statusText)
      throw new Error(`Intent analysis failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Parse the LLM's JSON response
    let analysis: LLMIntentResult
    try {
      // The LLM should return JSON, but might wrap it in markdown
      const jsonMatch = data.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        analysis = JSON.parse(data.content)
      }
    } catch (parseError) {
      console.error('[LLM Intent] Failed to parse JSON:', data.content)
      // Fallback to conservative intent
      return createFallbackIntent(context.currentMessage)
    }

    console.log('[LLM Intent] Analysis:', {
      intent: analysis.intent,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      needsClarification: analysis.needsClarification
    })

    return analysis

  } catch (error) {
    console.error('[LLM Intent] Error:', error)
    return createFallbackIntent(context.currentMessage)
  }
}

/**
 * Build context string for the LLM
 */
function buildContextString(context: LLMIntentContext): string {
  let str = 'Context:\n\n'

  // CANVAS VISIBILITY - MOST IMPORTANT!
  if (context.canvasContext) {
    str += context.canvasContext
    str += '\n'
  } else {
    str += '👁️ Canvas: No nodes visible to orchestrator (nothing connected)\n\n'
  }

  // Document panel state
  str += `**Document Panel Status: ${context.isDocumentViewOpen ? 'OPEN (user is working inside a document)' : 'CLOSED (user is on canvas)'}**\n`
  if (context.isDocumentViewOpen && context.documentFormat) {
    str += `Document Type: ${context.documentFormat}\n`
  }
  str += '\n'

  // Active segment
  if (context.activeSegment) {
    str += `Selected segment: "${context.activeSegment.name}"`
    if (context.activeSegment.title) {
      str += ` - ${context.activeSegment.title}`
    }
    str += `\nSegment has content: ${context.activeSegment.hasContent ? 'Yes' : 'No'}\n\n`
  } else if (context.isDocumentViewOpen) {
    str += 'Document is open but no segment selected\n\n'
  } else {
    str += 'No segment selected\n\n'
  }

  // Document structure
  if (context.documentStructure && context.documentStructure.length > 0) {
    str += `Document structure (${context.documentStructure.length} sections):\n`
    context.documentStructure.slice(0, 10).forEach(item => {
      str += `  ${'  '.repeat(item.level - 1)}- ${item.name}\n`
    })
    str += '\n'
  }

  // Conversation history
  if (context.conversationHistory.length > 0) {
    str += 'Recent conversation:\n'
    context.conversationHistory.slice(-5).forEach(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant'
      const preview = msg.content.length > 100 
        ? msg.content.substring(0, 100) + '...'
        : msg.content
      str += `  ${role}: ${preview}\n`
    })
    str += '\n'
  }

  return str
}

/**
 * Create fallback intent when LLM analysis fails
 */
function createFallbackIntent(message: string): LLMIntentResult {
  return {
    intent: 'general_chat',
    confidence: 0.3,
    reasoning: 'LLM intent analysis failed, defaulting to conversation',
    suggestedAction: 'Respond conversationally and ask for clarification',
    requiresContext: false,
    suggestedModel: 'orchestrator',
    needsClarification: true,
    clarifyingQuestion: `I'm not sure I understood your request: "${message}". Could you please clarify what you'd like me to do?`
  }
}

/**
 * Check if a message is likely to need LLM analysis
 * (vs simple pattern matching)
 */
export function shouldUseLLMAnalysis(message: string, hasConversationHistory: boolean): boolean {
  const lowerMessage = message.toLowerCase().trim()
  
  // Pronouns and references need LLM
  const hasPronouns = /\b(it|this|that|these|those)\b/i.test(message)
  
  // Follow-up phrases need context
  const hasFollowUp = /\b(also|too|as well|and|but)\b/i.test(message)
  
  // Ambiguous imperatives
  const isAmbiguous = lowerMessage.split(/\s+/).length < 5 && 
                      !(/^(write|explain|improve|create|expand|tell)/.test(lowerMessage))
  
  // Conversational flow
  const needsContext = hasConversationHistory && (hasPronouns || hasFollowUp || isAmbiguous)
  
  return needsContext || hasPronouns || (isAmbiguous && hasConversationHistory)
}

