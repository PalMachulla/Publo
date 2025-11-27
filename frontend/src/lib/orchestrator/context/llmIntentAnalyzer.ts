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
import { buildFormatDescriptionsForLLM } from '../schemas/documentHierarchy'
import { buildTemplateDescriptionsForLLM } from '../schemas/templateRegistry'

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
    sourceDocument?: string // Name or ID of source document (e.g., "Screenplay", "Podcast")
    isExplicitSourceReference?: boolean // True if user explicitly said "based on X", "using X"
    autoGenerateSections?: string[] // Sections to auto-generate after structure creation (e.g., ["scene2", "act1"])
    documentFormat?: string // Format extracted from message (e.g., "short-story", "novel", "screenplay")
    suggestedTemplate?: string // Template ID matched from keywords (e.g., "interview", "heros-journey", "feature")
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

SOURCE DOCUMENT EXTRACTION (CRITICAL!):
- When user says "Create a report based on the screenplay" or "based upon X" or "using the podcast":
  * Set isExplicitSourceReference: true
  * Extract sourceDocument: the name/label of the document from canvas context (e.g., "Screenplay", "Podcast")
  * The system will use this to extract content from that specific document
- Natural language variations to detect:
  * "based on [X]", "based upon [X]", "using [X]", "from [X]"
  * "about [X]", "analyzing [X]", "covering [X]"
  * "for [X]", "regarding [X]"
- Match against canvas nodes to identify which document the user is referring to

EXISTING vs NEW DOCUMENT (CRITICAL!):
- If user says "MY podcast", "THE podcast", "MY screenplay" → Check canvas context!
  * If canvas shows a matching node (e.g., "Podcast: PODCAST document") → open_and_write (open existing node)
  * If canvas shows NO matching node → create_structure (make new document)
- "get content to MY podcast" with Podcast node visible → open_and_write (NOT create_structure!)
- "help me with THE screenplay" with Screenplay node visible → open_and_write (NOT general_chat!)
- Only use create_structure when creating something BRAND NEW that doesn't exist yet
- CRITICAL: If user says "Write a REPORT" but canvas shows "Short Story" nodes, they want to create a NEW REPORT (NOT open the short story!)
  * The document TYPE matters! Report ≠ Short Story ≠ Screenplay
  * Intent: create_structure (for the NEW document type they requested)

Available intents:
- write_content: User wants to generate NEW narrative content for a section
- answer_question: User wants information, explanation, or discussion (respond in chat)
- improve_content: User wants to refine/enhance existing content IN ONE SECTION ONLY
- rewrite_with_coherence: User wants GHOSTWRITER-LEVEL rewrite - modify section AND update related sections for narrative consistency/coherence
- modify_structure: User wants to change document structure (add/remove sections)
- create_structure: User wants to create a BRAND NEW story/document (only when document panel is CLOSED)
- navigate_section: User wants to navigate/jump to a specific section WITHIN the currently open document (e.g., "go to chapter 1", "jump to the third scene")
  * ONLY use when document panel is OPEN
  * User is trying to navigate within the current document, not open a different one
- open_and_write: User wants to write content IN AN EXISTING canvas node (auto-open document view) (e.g., "open the novel", "let's work on the screenplay")
  * Use this even if multiple nodes match - the system will automatically show options to the user
  * Do NOT use clarify_intent for opening - always use open_and_write
- delete_node: User wants to DELETE/REMOVE a canvas node (e.g., "remove the screenplay", "delete the novel", "delete one of the novels")
  * Use this even if multiple nodes match - the system will automatically show options to the user
  * Do NOT use clarify_intent for deletions - always use delete_node
- clarify_intent: You're unsure and need to ask a clarifying question (NOT for deletions/opening - use delete_node/open_and_write instead)

CRITICAL CONTEXT RULES:
- If document panel is OPEN → User is working INSIDE that document
  * "write more" → write_content (for current section)
  * "add X to Y" → modify_structure (within this document)
  * NEVER create_structure (don't make new documents)
  
- If document panel is CLOSED → User is on the canvas
  * "get content to MY podcast" + Podcast exists → open_and_write (HELPFUL: open existing node)
  * "help me with THE screenplay" + Screenplay exists → open_and_write (HELPFUL: open existing node)
  * "craft/write in that node" → open_and_write (HELPFUL MODE: open existing node for writing)
  * "create a novel" + NO Novel on canvas → create_structure (new document node)
  * "write about X" + NO matching node → create_structure (needs new document first)

Guidelines:
- If user says "write more", "expand", "continue" → write_content (requiresContext: true)
- If user says "explain", "what is", "tell me about" → answer_question (requiresContext: false - can answer from canvas context or general knowledge)
- If user says "improve", "make it better", "polish" (ONE section) → improve_content (requiresContext: true)
- If user says "rewrite X and update other sections", "keep it coherent", "maintain consistency", "fix earlier parts too" → rewrite_with_coherence (GHOSTWRITER MODE, requiresContext: true)
- If user says "go to chapter X", "jump to section Y", "navigate to scene Z" WHILE document is open → navigate_section (navigate within current document)
  * CRITICAL: Only use when document panel is OPEN
  * This is for navigation WITHIN the current document, not opening a different document
- If user says "craft/write/fill in that node", "help me write the podcast", "get content to MY podcast" → open_and_write (HELPFUL: auto-open document for them)
- If user says "open the X", "let's open X", "open X" → open_and_write (open existing node for editing)
  * IMPORTANT: Even if there are MULTIPLE matching nodes, still use open_and_write intent (the system will handle asking which one)
  * Do NOT use clarify_intent for opening - always use open_and_write and let the system handle ambiguity
- If user says "remove", "delete", "get rid of" a node/document → delete_node (requiresContext: false - operates on canvas nodes)
  * IMPORTANT: Even if there are MULTIPLE matching nodes, still use delete_node intent (the system will handle asking which one)
  * Do NOT use clarify_intent for deletion - always use delete_node and let the system handle ambiguity
- CRITICAL: "MY podcast" / "THE screenplay" when canvas shows matching node → open_and_write (NOT create_structure!)
- If user references previous chat ("add it", "put that") → check conversation history
- If ambiguous or unclear → clarify_intent (ask a question)

IMPORTANT - requiresContext Rules:
- answer_question → ALWAYS requiresContext: false (can answer from canvas, conversation, or general knowledge)
- write_content, improve_content, rewrite_with_coherence → requiresContext: true (needs selected segment)
- create_structure, navigate_section, open_and_write, delete_node, general_chat, clarify_intent → requiresContext: false

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

FOLLOW-UP RESPONSES (CRITICAL):
- If the orchestrator just asked "Which section would you like me to write in?" and user responds with "first", "second", "the first one", "1", "2", etc.:
  * Intent: write_content
  * Extract the section reference (first, second, 1, 2, etc.)
  * Set targetSegment to the ordinal/numeric reference
  * The system will resolve this to the actual section ID
- If orchestrator asked a clarification question about format (e.g., "Did you mean Scene 2?" or "Did you mean Section 2?"), and user responds with "Yes, scene 2 I mean" or "Yes, section 2 I meant":
  * THIS IS CRITICAL: The user is CONFIRMING they want to CREATE A NEW DOCUMENT
  * Look at the ORIGINAL request in conversation history (2-3 messages back) to find what they wanted to create
  * Intent: create_structure (NOT write_content, NOT open_and_write!)
  * Extract the document format from the ORIGINAL request (e.g., "report", "short story", "screenplay", "novel")
  * Extract the CORRECTED section type from their response (e.g., "section 2" not "chapter 2", "scene 2" not "chapter 2")
  * Set autoGenerateSections to the section they want to write (e.g., ["section2"], ["scene2"])
  * Set documentFormat to the format from the original request (e.g., "report", "short-story", "screenplay")
  * This is a multi-step request: create structure + generate content
  * DO NOT confuse this with opening an existing document on the canvas!
- If orchestrator asked a clarification question, the user's response is answering that question
- Short responses like "first", "yes", "no", "the second one", "yes scene 2", "yes section 2" are usually follow-ups to orchestrator questions
- ALWAYS look at conversation history (go back 2-4 messages) to understand what question was asked and what the user is responding to
- MAINTAIN ORIGINAL CONTEXT: If user originally said "Write a REPORT" and then clarifies "section 2", they still want a REPORT (not a short story from canvas!)
- DO NOT let canvas nodes distract you from the user's original intent - they want to create what they asked for!

FRUSTRATED FOLLOW-UPS (CRITICAL):
- If user says "as I said", "like I told you", "I already said", "chapter 2 as I said":
  * User is frustrated because their request wasn't understood
  * Re-analyze their PREVIOUS message (look at conversation history)
  * Keep the same intent type they originally wanted
  * Extract the section reference they mentioned ("chapter 2", "act 1", etc.)
  * Intent: write_content (they want to write, not navigate!)

MULTI-STEP REQUESTS (CRITICAL):
- If user says "create X and write Y" or "write Y straight away/immediately/right away/right now":
  * Intent: create_structure
  * This is a COMBINED request: create structure + generate content
  * Extract which sections to auto-generate (e.g., "chapter 2", "act 1")
  * Set needsClarification: false (user was explicit)
  * Example: "Write a story about X and write chapter 2 straight away" → create_structure + auto-generate chapter 2

HELPFUL REASONING (CRITICAL):
- If user mentions a section that doesn't exist yet (e.g., "chapter 2" but no structure exists):
  * Don't say "I couldn't find that section" - that's unhelpful!
  * Reason: "User wants chapter 2, but no structure exists yet. I should create the structure first, then write chapter 2."
  * Intent: create_structure (with auto-generation for chapter 2)
  * Be proactive and helpful, not just error-throwing

- If user says "write chapter 2" and document panel is closed:
  * Reason: "Short story typically has chapters. User wants chapter 2. I should create a short story structure with chapters, then generate chapter 2."
  * Intent: create_structure
  * Extract format from context ("short story" → format: "short-story")
  * Extract target section ("chapter 2")

CONVERSATIONAL TONE:
- Be helpful and collaborative, not robotic
- Instead of "Error: section not found" → "Let me create that structure for you"
- Instead of "I need more information" → "I'd be happy to help! Just to clarify..."
- Try to figure out what the user wants before asking questions

Return your analysis as JSON with this structure:
{
  "intent": "write_content" | "answer_question" | "improve_content" | "rewrite_with_coherence" | "modify_structure" | "create_structure" | "navigate_section" | "open_and_write" | "delete_node" | "clarify_intent" | "general_chat",
  "confidence": 0.0-1.0,
  "reasoning": "Explain your thought process - be helpful and show you understand the user's goal",
  "suggestedAction": "What the system should do - be specific and proactive",
  "requiresContext": boolean,
  "suggestedModel": "orchestrator" | "writer" | "editor",
  "needsClarification": boolean,
  "clarifyingQuestion": "Helpful, polite question if needsClarification is true (e.g., 'I'd be happy to help! Just to clarify, did you mean...')",
  "extractedEntities": {
    "targetSegment": "Which section to act on (e.g., 'chapter 2', 'act 1', 'first scene')",
    "referenceContent": "Content being referenced from conversation",
    "sourceDocument": "When user says 'based on X' or 'using X', extract the name/ID of the source document from canvas context",
    "isExplicitSourceReference": "Boolean - true if user explicitly mentioned a specific document to base new content on (e.g., 'based on the screenplay', 'using the podcast')",
    "autoGenerateSections": "Array of section references to auto-generate (e.g., ['chapter 2'] when user says 'write chapter 2 straight away')",
    "documentFormat": "Format extracted from user's message (e.g., 'short story' → 'short-story', 'screenplay' → 'screenplay')",
    "suggestedTemplate": "Template ID if user mentioned specific template keywords (e.g., 'interview' → 'interview', 'hero's journey' → 'heros-journey', 'feature film' → 'feature')"
  }
}

${buildFormatDescriptionsForLLM()}

${buildTemplateDescriptionsForLLM()}

EDUCATIONAL CLARIFICATION (CRITICAL):
When user mentions a section that doesn't match the format conventions:
- DON'T just create what they asked for
- DON'T silently change their request
- DO educate them conversationally about the format
- DO ask if they meant something else OR if they want a different format

Examples:
- User: "Write a short story, chapter 2"
  * Short stories typically use SCENES, not chapters
  * Intent: clarify_intent
  * clarifyingQuestion: "I'd love to help! Just to clarify - short stories typically use scenes rather than chapters. Did you mean Scene 2? Or are you planning a longer novel with chapters?"
  
- User: "Write a screenplay, chapter 1"
  * Screenplays use ACTS and SCENES, not chapters
  * Intent: clarify_intent
  * clarifyingQuestion: "Great idea! Just so you know, screenplays typically use acts and scenes rather than chapters. Did you mean Act 1, or perhaps Scene 1?"

- User: "Write a novel, scene 5"
  * Novels typically use CHAPTERS, scenes are optional subdivisions
  * Intent: clarify_intent
  * clarifyingQuestion: "Wonderful! Novels typically use chapters as their main structure. Did you mean Chapter 5? Or do you want to write a specific scene within a chapter?"

BE CONVERSATIONAL AND ENCOURAGING:
- Acknowledge their creative idea ("I'd love to help!", "Great theme!", "Wonderful idea!")
- Gently educate about format conventions
- Offer alternatives
- Let them decide (maybe they DO want chapters in a short story - that's okay!)
- Be enthusiastic and supportive, not pedantic

WHEN USER MIXES FORMATS:
If user says "short story chapter 2" or "screenplay chapter 1":
1. Recognize the mismatch
2. Intent: clarify_intent (NOT create_structure!)
3. Educate them conversationally
4. Ask what they meant OR if they want a different format
5. Be encouraging and supportive

HELPFUL AND COLLABORATIVE:
- Be conversational and friendly
- Show that you understand the user's goal
- Gently educate about format conventions
- Offer to help proactively
- Don't just say "error" - suggest solutions
- Be enthusiastic about their creative idea
- Example: "I'd love to help! Just to clarify, short stories typically use scenes rather than chapters. Did you mean Scene 2? Or are you planning a longer novel?"

Be smart, conversational, educational, and helpful. When in doubt, ask politely and explain why!`

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

Return ONLY valid JSON with your analysis. Do not include markdown formatting. Just the raw JSON object.`

  try {
    const requestBody = {
      system_prompt: INTENT_ANALYSIS_SYSTEM_PROMPT,
      user_prompt: analysisPrompt,
      conversation_history: context.conversationHistory.slice(-5), // Last 5 messages
      temperature: 0.1 // Lower temp for consistent JSON
    }
    
    console.log('[LLM Intent] Sending request to /api/intent/analyze:', {
      systemPromptLength: requestBody.system_prompt.length,
      userPromptLength: requestBody.user_prompt.length,
      conversationHistoryLength: requestBody.conversation_history.length
    })
    
    // Call the orchestrator via our API
    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('[LLM Intent] API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      })
      throw new Error(`Intent analysis failed (${response.status}): ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    
    // Parse the LLM's JSON response
    let analysis: LLMIntentResult
    try {
      let content = data.content.trim()
      
      // Remove markdown code blocks if present
      content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
      
      // Extract JSON object if wrapped in text
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        content = jsonMatch[0]
      }
      
      analysis = JSON.parse(content)
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

