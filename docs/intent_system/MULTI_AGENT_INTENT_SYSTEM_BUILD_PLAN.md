# Multi-Agent Intent Analysis System - Build Plan

## 🎯 **Executive Summary**

Transform the monolithic Intent Analyzer into a **modular, multi-stage pipeline** that:
- Uses fast triage for simple requests (50-100ms)
- Escalates to deep analysis only when needed
- Supports user-provided API keys
- Integrates with existing model selection system
- Is testable, maintainable, and extensible

---

## 📋 **Table of Contents**

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Core Components](#core-components)
4. [Implementation Phases](#implementation-phases)
5. [Integration Points](#integration-points)
6. [Testing Strategy](#testing-strategy)
7. [Migration Path](#migration-path)

---

## 🏗️ **Architecture Overview**

### Current State (Monolithic)
```
User Message → Intent Analyzer (one LLM call) → Action
                     ↓
            (500-1000ms, expensive)
```

### Target State (Multi-Agent Pipeline)
```
User Message
    ↓
┌───────────────────────────────────────────────────┐
│ Stage 1: Quick Triage (Rules + Fast LLM)          │
│ • Pattern matching for obvious intents            │
│ • Fast classification: simple/complex/ambiguous   │
│ • Cost: <$0.0001, Time: 50-100ms                  │
└───────────────┬───────────────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
    Simple          Complex/Ambiguous
        │               │
        ▼               ▼
    Execute     ┌────────────────────────────┐
                │ Stage 2: Context Resolver  │
                │ • Resolve "it", "that"     │
                │ • Find canvas references   │
                │ • Cost: <$0.001, ~150ms    │
                └───────────┬────────────────┘
                            │
                            ▼
                ┌────────────────────────────┐
                │ Stage 3: Deep Analyzer     │
                │ • Full intent analysis     │
                │ • Chain of thought         │
                │ • Cost: <$0.01, ~300ms     │
                └───────────┬────────────────┘
                            │
                            ▼
                ┌────────────────────────────┐
                │ Stage 4: Validator         │
                │ • Consistency checks       │
                │ • Auto-corrections         │
                │ • Format validation        │
                └───────────┬────────────────┘
                            │
                            ▼
                    Execute or Clarify
```

---



---

## 🔧 **Core Components**

### 1. Intent Pipeline (Orchestrator)

**File:** `lib/intent/pipeline/IntentPipeline.ts`

```typescript
/**
 * Main pipeline orchestrator
 * Coordinates all stages and handles escalation logic
 */

import { TriageAgent } from '../stages/1-triage/TriageAgent'
import { ContextResolver } from '../stages/2-context/ContextResolver'
import { DeepAnalyzer } from '../stages/3-analysis/DeepAnalyzer'
import { Validator } from '../stages/4-validation/Validator'
import { ModelRouter } from '../models/ModelRouter'
import type { PipelineContext, IntentAnalysis, PipelineConfig } from './types'

export class IntentPipeline {
  private triage: TriageAgent
  private contextResolver: ContextResolver
  private deepAnalyzer: DeepAnalyzer
  private validator: Validator
  private modelRouter: ModelRouter

  constructor(config: PipelineConfig) {
    this.modelRouter = new ModelRouter(config.userApiConfig)
    this.triage = new TriageAgent(this.modelRouter)
    this.contextResolver = new ContextResolver(this.modelRouter)
    this.deepAnalyzer = new DeepAnalyzer(this.modelRouter, config.promptModules)
    this.validator = new Validator(config.validationRules)
  }

  /**
   * Main entry point - analyze user message through pipeline
   */
  async analyze(
    message: string, 
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    const startTime = Date.now()
    const metrics = {
      stage1Time: 0,
      stage2Time: 0,
      stage3Time: 0,
      stage4Time: 0,
      totalCost: 0
    }

    try {
      // STAGE 1: Quick Triage
      console.log('🚦 [Pipeline] Stage 1: Triage')
      const stage1Start = Date.now()
      const triageResult = await this.triage.classify(message, context)
      metrics.stage1Time = Date.now() - stage1Start

      // If simple and high confidence, skip to execution
      if (triageResult.classification === 'simple' && triageResult.confidence > 0.9) {
        console.log('✅ [Pipeline] Simple intent detected, skipping deep analysis')
        return {
          ...triageResult.intent,
          pipelineMetrics: metrics,
          totalTime: Date.now() - startTime
        }
      }

      // STAGE 2: Context Resolution (if needed)
      let enrichedContext = context
      if (triageResult.needsContextResolution) {
        console.log('🔍 [Pipeline] Stage 2: Context Resolution')
        const stage2Start = Date.now()
        enrichedContext = await this.contextResolver.resolve(message, context)
        metrics.stage2Time = Date.now() - stage2Start
      }

      // STAGE 3: Deep Analysis
      console.log('🧠 [Pipeline] Stage 3: Deep Analysis')
      const stage3Start = Date.now()
      const analysis = await this.deepAnalyzer.analyze(message, enrichedContext)
      metrics.stage3Time = Date.now() - stage3Start

      // STAGE 4: Validation
      console.log('✔️ [Pipeline] Stage 4: Validation')
      const stage4Start = Date.now()
      const validated = await this.validator.validate(analysis, enrichedContext)
      metrics.stage4Time = Date.now() - stage4Start

      return {
        ...validated,
        pipelineMetrics: metrics,
        totalTime: Date.now() - startTime
      }

    } catch (error) {
      console.error('❌ [Pipeline] Error in pipeline:', error)
      throw error
    }
  }

  /**
   * Batch analysis for testing/debugging
   */
  async analyzeBatch(
    messages: Array<{ message: string; context: PipelineContext }>
  ): Promise<IntentAnalysis[]> {
    return Promise.all(
      messages.map(({ message, context }) => this.analyze(message, context))
    )
  }
}
```

---

### 2. Triage Agent (Stage 1)

**File:** `lib/intent/stages/1-triage/TriageAgent.ts`

```typescript
/**
 * Fast classification agent
 * Uses pattern matching + lightweight LLM for quick triage
 */

import type { ModelRouter } from '../../models/ModelRouter'
import type { PipelineContext, TriageResult } from '../../pipeline/types'
import { SIMPLE_PATTERNS, COMPLEX_PATTERNS } from './patterns'

export class TriageAgent {
  constructor(private modelRouter: ModelRouter) {}

  async classify(
    message: string, 
    context: PipelineContext
  ): Promise<TriageResult> {
    // Step 1: Try pattern matching (instant, free)
    const patternMatch = this.tryPatternMatch(message, context)
    if (patternMatch) {
      return {
        classification: patternMatch.classification,
        confidence: patternMatch.confidence,
        intent: patternMatch.intent,
        needsContextResolution: false
      }
    }

    // Step 2: Use fast LLM (50-100ms, cheap)
    const llmClassification = await this.classifyWithLLM(message, context)
    return llmClassification
  }

  /**
   * Pattern-based classification (instant, free)
   */
  private tryPatternMatch(
    message: string, 
    context: PipelineContext
  ): TriageResult | null {
    const normalized = message.toLowerCase().trim()

    // Simple write intent
    if (SIMPLE_PATTERNS.write.some(p => p.test(normalized))) {
      if (context.documentPanelOpen && context.activeSegment) {
        return {
          classification: 'simple',
          confidence: 0.95,
          intent: {
            intent: 'write_content',
            requiresContext: true,
            confidence: 0.95,
            reasoning: 'Pattern match: write intent with active segment'
          },
          needsContextResolution: false
        }
      }
    }

    // Simple delete intent
    if (SIMPLE_PATTERNS.delete.some(p => p.test(normalized))) {
      return {
        classification: 'simple',
        confidence: 0.9,
        intent: {
          intent: 'delete_node',
          requiresContext: false,
          confidence: 0.9,
          reasoning: 'Pattern match: delete intent'
        },
        needsContextResolution: true // Need to resolve which node
      }
    }

    // Simple answer intent
    if (SIMPLE_PATTERNS.answer.some(p => p.test(normalized))) {
      return {
        classification: 'simple',
        confidence: 0.85,
        intent: {
          intent: 'answer_question',
          requiresContext: false,
          confidence: 0.85,
          reasoning: 'Pattern match: question/answer intent'
        },
        needsContextResolution: false
      }
    }

    // Complex patterns (need deep analysis)
    if (COMPLEX_PATTERNS.some(p => p.test(normalized))) {
      return {
        classification: 'complex',
        confidence: 0.7,
        intent: null,
        needsContextResolution: true
      }
    }

    return null // No pattern match, needs LLM
  }

  /**
   * LLM-based classification (fast model, minimal prompt)
   */
  private async classifyWithLLM(
    message: string,
    context: PipelineContext
  ): Promise<TriageResult> {
    const prompt = this.buildTriagePrompt(message, context)
    
    const response = await this.modelRouter.complete({
      model: 'fast', // Use user's configured fast model (Haiku, Gemini Flash, etc)
      systemPrompt: prompt,
      maxTokens: 100,
      temperature: 0.1
    })

    return this.parseTriageResponse(response)
  }

  private buildTriagePrompt(message: string, context: PipelineContext): string {
    return `You are a FAST intent classifier. Return ONLY JSON.

Context:
- Document panel: ${context.documentPanelOpen ? 'OPEN' : 'CLOSED'}
- Active segment: ${context.activeSegment || 'NONE'}
- Canvas nodes: ${context.canvasNodes?.length || 0} nodes

User message: "${message}"

Classify as:
- "simple": Clear single action (write, delete, open) with high confidence
- "complex": Multi-step, needs deeper analysis
- "ambiguous": Not enough context

Return JSON:
{
  "classification": "simple" | "complex" | "ambiguous",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "needsContextResolution": boolean
}`
  }

  private parseTriageResponse(response: string): TriageResult {
    // Parse LLM response and return structured result
    try {
      const parsed = JSON.parse(response)
      return {
        classification: parsed.classification,
        confidence: parsed.confidence,
        intent: null, // Will be determined in deep analysis
        needsContextResolution: parsed.needsContextResolution
      }
    } catch (error) {
      // Fallback to complex if parsing fails
      return {
        classification: 'complex',
        confidence: 0.5,
        intent: null,
        needsContextResolution: true
      }
    }
  }
}
```

**File:** `lib/intent/stages/1-triage/patterns.ts`

```typescript
/**
 * Pattern matching rules for instant classification
 */

export const SIMPLE_PATTERNS = {
  write: [
    /^write\s+(more|content|text)/i,
    /^(continue|expand|elaborate)/i,
    /^(generate|create)\s+content/i,
  ],
  
  delete: [
    /^(delete|remove|get\s+rid\s+of)/i,
  ],
  
  answer: [
    /^(what|why|how|when|where|who)\s+/i,
    /^(explain|tell\s+me|can\s+you)/i,
  ],
  
  open: [
    /^open\s+(the\s+)?(novel|screenplay|story|document)/i,
    /^(let's\s+)?(work\s+on|edit)/i,
  ],
}

export const COMPLEX_PATTERNS = [
  /based\s+on/i,
  /using\s+the/i,
  /interview.*characters/i,
  /\band\s+(then|also)\b/i, // Multi-step indicators
  /create.*and.*write/i,
]
```

---

### 3. Context Resolver (Stage 2)

**File:** `lib/intent/stages/2-context/ContextResolver.ts`

```typescript
/**
 * Resolves ambiguous references and enriches context
 */

import type { ModelRouter } from '../../models/ModelRouter'
import type { PipelineContext } from '../../pipeline/types'
import { ConversationTracker } from './ConversationTracker'
import { CanvasAnalyzer } from './CanvasAnalyzer'

export class ContextResolver {
  private conversationTracker: ConversationTracker
  private canvasAnalyzer: CanvasAnalyzer

  constructor(private modelRouter: ModelRouter) {
    this.conversationTracker = new ConversationTracker()
    this.canvasAnalyzer = new CanvasAnalyzer()
  }

  async resolve(
    message: string,
    context: PipelineContext
  ): Promise<PipelineContext> {
    console.log('🔍 [ContextResolver] Resolving references...')

    // Step 1: Resolve pronouns (it, that, this, the X)
    const resolvedReferences = await this.resolvePronouns(message, context)

    // Step 2: Match canvas nodes
    const matchedNodes = this.canvasAnalyzer.findMatchingNodes(
      message,
      context.canvasNodes || []
    )

    // Step 3: Track conversation state
    this.conversationTracker.addMessage(message)
    const conversationState = this.conversationTracker.getState()

    return {
      ...context,
      resolvedReferences,
      matchedNodes,
      conversationState
    }
  }

  /**
   * Resolve pronouns using conversation history
   */
  private async resolvePronouns(
    message: string,
    context: PipelineContext
  ): Promise<Record<string, any>> {
    // Check if message has pronouns
    const hasPronouns = /\b(it|that|this|the\s+\w+)\b/i.test(message)
    if (!hasPronouns) {
      return {}
    }

    // Use fast LLM to resolve
    const prompt = `Given conversation history and current message, resolve ambiguous references.

Conversation history:
${context.conversationHistory?.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n') || 'None'}

Canvas nodes:
${context.canvasNodes?.map(n => `- ${n.label} (${n.type})`).join('\n') || 'None'}

Current message: "${message}"

What does "it", "that", "this", or "the X" refer to?

Return JSON:
{
  "references": {
    "it": "what it refers to",
    "that": "what that refers to"
  },
  "confidence": 0.0-1.0
}`

    const response = await this.modelRouter.complete({
      model: 'fast',
      systemPrompt: prompt,
      maxTokens: 150
    })

    try {
      return JSON.parse(response).references || {}
    } catch {
      return {}
    }
  }
}
```

**File:** `lib/intent/stages/2-context/CanvasAnalyzer.ts`

```typescript
/**
 * Analyzes canvas nodes to find matches
 */

import type { CanvasNode } from '../../pipeline/types'

export class CanvasAnalyzer {
  /**
   * Find canvas nodes matching user message
   */
  findMatchingNodes(message: string, nodes: CanvasNode[]): CanvasNode[] {
    const normalized = message.toLowerCase()
    const matches: Array<{ node: CanvasNode; score: number }> = []

    for (const node of nodes) {
      let score = 0

      // Exact label match
      if (normalized.includes(node.label.toLowerCase())) {
        score += 10
      }

      // Type match
      if (normalized.includes(node.type.toLowerCase())) {
        score += 5
      }

      // Fuzzy label match
      const labelWords = node.label.toLowerCase().split(/\s+/)
      const messageWords = normalized.split(/\s+/)
      const commonWords = labelWords.filter(w => messageWords.includes(w))
      score += commonWords.length * 2

      if (score > 0) {
        matches.push({ node, score })
      }
    }

    // Return top 3 matches, sorted by score
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => m.node)
  }

  /**
   * Check if user is referring to existing node vs creating new
   */
  isReferringToExisting(message: string, nodeType: string): boolean {
    const normalized = message.toLowerCase()
    
    // Possessive/definite articles → existing
    const existingIndicators = [
      `my ${nodeType}`,
      `the ${nodeType}`,
      `our ${nodeType}`,
      `that ${nodeType}`,
      `this ${nodeType}`,
    ]

    return existingIndicators.some(indicator => normalized.includes(indicator))
  }
}
```

**File:** `lib/intent/stages/2-context/ConversationTracker.ts`

```typescript
/**
 * Tracks conversation state for follow-up handling
 */

export type ConversationState = 
  | { type: 'initial' }
  | { type: 'awaiting_clarification', question: string, options: string[] }
  | { type: 'awaiting_section_choice', availableSections: string[] }
  | { type: 'format_mismatch_detected', originalRequest: string }

export class ConversationTracker {
  private state: ConversationState = { type: 'initial' }
  private history: Array<{ role: string; content: string }> = []

  addMessage(content: string, role: 'user' | 'assistant' = 'user') {
    this.history.push({ role, content })
    
    // Keep last 10 messages
    if (this.history.length > 10) {
      this.history = this.history.slice(-10)
    }
  }

  setState(state: ConversationState) {
    this.state = state
  }

  getState(): ConversationState {
    return this.state
  }

  getHistory(): Array<{ role: string; content: string }> {
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
}
```

---

### 4. Deep Analyzer (Stage 3)

**File:** `lib/intent/stages/3-analysis/DeepAnalyzer.ts`

```typescript
/**
 * Full intent analysis with chain-of-thought
 */

import type { ModelRouter } from '../../models/ModelRouter'
import type { PipelineContext, IntentAnalysis } from '../../pipeline/types'
import { PromptComposer } from './PromptComposer'

export class DeepAnalyzer {
  private promptComposer: PromptComposer

  constructor(
    private modelRouter: ModelRouter,
    promptModules: any
  ) {
    this.promptComposer = new PromptComposer(promptModules)
  }

  async analyze(
    message: string,
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    console.log('🧠 [DeepAnalyzer] Starting deep analysis...')

    // Build context-aware prompt
    const prompt = this.promptComposer.compose(message, context)

    // Use smart model with chain-of-thought
    const response = await this.modelRouter.complete({
      model: 'smart', // User's configured smart model (Sonnet, GPT-4, etc)
      systemPrompt: prompt,
      maxTokens: 1000,
      temperature: 0.2
    })

    return this.parseAnalysis(response)
  }

  private parseAnalysis(response: string): IntentAnalysis {
    // Extract reasoning and analysis
    const reasoningMatch = response.match(/<reasoning>(.*?)<\/reasoning>/s)
    const analysisMatch = response.match(/<intent_analysis>(.*?)<\/intent_analysis>/s)

    let reasoning = ''
    let analysis: any = {}

    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim()
    }

    if (analysisMatch) {
      try {
        analysis = JSON.parse(analysisMatch[1].trim())
      } catch (error) {
        console.error('❌ [DeepAnalyzer] Failed to parse analysis JSON')
      }
    }

    return {
      ...analysis,
      chainOfThought: reasoning,
      confidence: analysis.confidence || 0.5
    }
  }
}
```

**File:** `lib/intent/stages/3-analysis/PromptComposer.ts`

```typescript
/**
 * Dynamically composes prompts from modular pieces
 */

import type { PipelineContext } from '../../pipeline/types'
import { coreIntentRules } from './prompts/core'
import { canvasAwarenessRules } from './prompts/canvas'
import { followUpRules } from './prompts/followUp'
import { templateRules } from './prompts/templates'

export class PromptComposer {
  constructor(private customModules?: any) {}

  compose(message: string, context: PipelineContext): string {
    const modules: string[] = []

    // Always include core rules
    modules.push(coreIntentRules)

    // Add canvas rules if canvas is visible
    if (context.canvasNodes && context.canvasNodes.length > 0) {
      modules.push(canvasAwarenessRules)
    }

    // Add follow-up rules if in conversation
    if (context.conversationState?.type !== 'initial') {
      modules.push(followUpRules)
    }

    // Add template rules if creating structure
    if (this.isStructureCreation(message)) {
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

## User Message

"${message}"

## Task

Analyze the user's intent using chain-of-thought reasoning.

<reasoning>
1. Context Check:
   - Document panel: ${context.documentPanelOpen ? 'OPEN' : 'CLOSED'}
   - Active segment: ${context.activeSegment || 'NONE'}
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

  private isStructureCreation(message: string): boolean {
    return /\b(create|make|write)\s+(a|an)?\s*(novel|story|screenplay|podcast|report)/i.test(message)
  }

  private buildContextSection(context: PipelineContext): string {
    return `
- Document Panel: ${context.documentPanelOpen ? 'OPEN' : 'CLOSED'}
- Active Segment: ${context.activeSegment || 'NONE'}
- Canvas Nodes: ${context.canvasNodes?.length || 0} nodes
  ${context.canvasNodes?.map(n => `  - ${n.label} (${n.type})`).join('\n') || ''}
- Conversation State: ${context.conversationState?.type || 'initial'}
- Resolved References: ${JSON.stringify(context.resolvedReferences || {}, null, 2)}
- Matched Nodes: ${context.matchedNodes?.map(n => n.label).join(', ') || 'NONE'}
`
  }
}
```

**File:** `lib/intent/stages/3-analysis/prompts/core.ts`

```typescript
/**
 * Core intent analysis rules (always included)
 */

export const coreIntentRules = `
# Core Intent Analysis Rules

You are an intelligent intent analyzer for a creative writing assistant.

## Available Intents

- **write_content**: Generate NEW narrative content for a section
- **answer_question**: Provide information/explanation (respond in chat)
- **improve_content**: Refine/enhance existing content in ONE section
- **rewrite_with_coherence**: GHOSTWRITER-LEVEL rewrite across multiple sections
- **modify_structure**: Change document structure (add/remove sections)
- **create_structure**: Create BRAND NEW story/document
- **navigate_section**: Navigate within currently open document
- **open_and_write**: Open existing canvas node for editing
- **delete_node**: Delete/remove a canvas node
- **clarify_intent**: Ask clarifying question

## Key Guidelines

1. **Document Panel Context**
   - OPEN → User is working INSIDE document (write_content, modify_structure)
   - CLOSED → User is on canvas (create_structure, open_and_write, delete_node)

2. **Confidence Levels**
   - High (>0.85): Execute immediately
   - Medium (0.65-0.85): Confirm with user
   - Low (<0.65): Ask clarifying question

3. **RequiresContext Rules**
   - answer_question → ALWAYS false
   - write_content, improve_content, rewrite_with_coherence → true
   - All others → false

4. **Follow-Up Detection**
   - "first", "second", "1", "2" → Answering section choice
   - "yes", "no" → Answering clarification
   - "as I said" → User is frustrated, re-analyze previous message

5. **Multi-Step Requests**
   - "create X and write Y" → create_structure + autoGenerateSections
   - Be proactive, not error-throwing
`
```

**File:** `lib/intent/stages/3-analysis/prompts/canvas.ts`

```typescript
/**
 * Canvas awareness rules (included when canvas is visible)
 */

export const canvasAwarenessRules = `
# Canvas Awareness Rules

## Canvas Context

The canvas shows ALL nodes connected to the orchestrator. These are resources you can reference.

## Existing vs New Document Detection

- **"MY podcast"** / **"THE screenplay"** → Check canvas context
  - If matching node exists → open_and_write (open existing)
  - If NO matching node → create_structure (create new)

- **Document TYPE matters!**
  - "Write a REPORT" with "Short Story" on canvas → create_structure (NEW report)
  - Report ≠ Short Story ≠ Screenplay
  - User wants the specific type they requested

## Source Document Extraction

When user says "based on X" or "using X":
- Set isExplicitSourceReference: true
- Extract sourceDocument: name from canvas context
- Examples: "Create report based on the screenplay", "using the podcast"

## Canvas Node Matching

- Pattern: "interview characters in [X]" + X on canvas → create_structure with reference
- Pattern: "open the novel" + Novel on canvas → open_and_write
- Pattern: "delete the screenplay" + Screenplay on canvas → delete_node
- Even with MULTIPLE matches → use open_and_write/delete_node (system handles ambiguity)
`
```

**File:** `lib/intent/stages/3-analysis/prompts/followUp.ts`

```typescript
/**
 * Follow-up conversation rules (included when in conversation)
 */

export const followUpRules = `
# Follow-Up Conversation Rules

## Detecting Follow-Ups

User is responding to a previous question when:
- Short responses: "first", "yes", "no", "the second one"
- Confirmation: "yes scene 2", "yes section 2"
- Frustration: "as I said", "like I told you"

## Handling Follow-Ups

1. **Section Choice Response**
   - Orchestrator asked: "Which section?"
   - User responds: "first", "second", "1", "2"
   - Intent: write_content (NOT navigate_section!)
   - Extract section reference and set targetSegment

2. **Clarification Confirmation**
   - Orchestrator asked: "Did you mean Scene 2?"
   - User responds: "Yes, scene 2 I mean"
   - Intent: create_structure (NOT write_content!)
   - Look back 2-3 messages for ORIGINAL request
   - Extract format from original (e.g., "report", "screenplay")
   - Set autoGenerateSections to confirmed section

3. **Frustrated Repeat**
   - User says: "chapter 2 as I said"
   - Re-analyze PREVIOUS message
   - Keep same intent type
   - Extract section reference

## Context Maintenance

- ALWAYS look at conversation history (2-4 messages back)
- Understand what question was asked
- MAINTAIN ORIGINAL CONTEXT (user wants what they asked for!)
- Don't let canvas distract from original intent
`
```

**File:** `lib/intent/stages/3-analysis/prompts/templates.ts`

```typescript
/**
 * Template matching rules (included when creating structure)
 */

export const templateRules = `
# Template Matching Rules

## Template Detection

Only suggest templates for EXPLICIT keywords, NOT format names alone!

### ✅ Suggest Template When:
- "podcast interview" → suggestedTemplate: "interview"
- "hero's journey novel" → suggestedTemplate: "heros-journey"
- "feature film screenplay" → suggestedTemplate: "feature"
- "three act structure" → suggestedTemplate: "three-act"
- "save the cat" → suggestedTemplate: "save-the-cat"

### ❌ DO NOT Suggest When:
- "Create a podcast" → suggestedTemplate: undefined (no keyword!)
- "Write a novel" → suggestedTemplate: undefined (no keyword!)
- "Make a screenplay" → suggestedTemplate: undefined (no keyword!)

Format name ≠ Template keyword!

## When User Is Vague

- Leave suggestedTemplate: undefined
- Set needsClarification: false
- System will show TemplateSelector UI
- Better to show options than guess wrong!
`
```

---

### 5. Validator (Stage 4)

**File:** `lib/intent/stages/4-validation/Validator.ts`

```typescript
/**
 * Validates intent analysis for consistency and auto-corrects common issues
 */

import type { IntentAnalysis, PipelineContext } from '../../pipeline/types'
import { validationRules } from './rules'
import { autoCorrect } from './autoCorrect'

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  correctedAnalysis: IntentAnalysis
}

export class Validator {
  constructor(private customRules?: any[]) {}

  async validate(
    analysis: IntentAnalysis,
    context: PipelineContext
  ): Promise<IntentAnalysis> {
    console.log('✔️ [Validator] Validating analysis...')

    const errors: string[] = []
    const warnings: string[] = []
    let corrected = { ...analysis }

    // Run all validation rules
    for (const rule of [...validationRules, ...(this.customRules || [])]) {
      const result = rule(corrected, context)
      
      if (!result.valid) {
        errors.push(result.error)
        
        // Try auto-correction
        if (result.autoCorrect) {
          const correction = autoCorrect(result.error, corrected, context)
          if (correction) {
            corrected = correction
            warnings.push(`Auto-corrected: ${result.error}`)
            console.log(`⚠️ [Validator] ${result.error} → Auto-corrected`)
          }
        } else {
          // Mark as needs clarification
          corrected.needsClarification = true
          corrected.clarifyingQuestion = result.error
        }
      }
    }

    if (errors.length > 0) {
      console.warn(`⚠️ [Validator] Found ${errors.length} issues:`, errors)
    }

    return corrected
  }
}
```

**File:** `lib/intent/stages/4-validation/rules.ts`

```typescript
/**
 * Validation rules
 */

import type { IntentAnalysis, PipelineContext } from '../../pipeline/types'

export interface ValidationRule {
  (analysis: IntentAnalysis, context: PipelineContext): {
    valid: boolean
    error?: string
    autoCorrect?: boolean
  }
}

export const validationRules: ValidationRule[] = [
  // Rule 1: Can't create_structure if document panel is open
  (analysis, context) => {
    if (analysis.intent === 'create_structure' && context.documentPanelOpen) {
      return {
        valid: false,
        error: 'Cannot create new structure while document panel is open. User likely wants write_content.',
        autoCorrect: true
      }
    }
    return { valid: true }
  },

  // Rule 2: write_content requires active segment
  (analysis, context) => {
    if (analysis.requiresContext && !context.activeSegment && !context.documentPanelOpen) {
      return {
        valid: false,
        error: 'Intent requires active segment but none selected. Need to open document first.',
        autoCorrect: false
      }
    }
    return { valid: true }
  },

  // Rule 3: Format mismatch detection
  (analysis, context) => {
    const format = analysis.extractedEntities?.documentFormat
    const targetSegment = analysis.extractedEntities?.targetSegment

    if (!format || !targetSegment) {
      return { valid: true }
    }

    const mismatches = [
      { format: 'short-story', wrongTerm: 'chapter', correctTerm: 'scene' },
      { format: 'screenplay', wrongTerm: 'chapter', correctTerm: 'act or scene' },
      { format: 'novel', wrongTerm: 'scene', correctTerm: 'chapter' },
    ]

    for (const mismatch of mismatches) {
      if (format.includes(mismatch.format) && targetSegment.toLowerCase().includes(mismatch.wrongTerm)) {
        return {
          valid: false,
          error: `Format mismatch: ${format} typically uses ${mismatch.correctTerm}, not ${mismatch.wrongTerm}. Did you mean ${mismatch.correctTerm}?`,
          autoCorrect: false // Ask user, don't auto-correct
        }
      }
    }

    return { valid: true }
  },

  // Rule 4: Confidence check
  (analysis, context) => {
    if (analysis.confidence < 0.5) {
      return {
        valid: false,
        error: 'Low confidence analysis. Need clarification from user.',
        autoCorrect: false
      }
    }
    return { valid: true }
  },

  // Rule 5: Template suggestion validation
  (analysis, context) => {
    const template = analysis.extractedEntities?.suggestedTemplate
    const format = analysis.extractedEntities?.documentFormat

    // If template is suggested, make sure it matches format
    if (template && format) {
      const validPairs = [
        { template: 'interview', format: 'podcast' },
        { template: 'heros-journey', format: 'novel' },
        { template: 'feature', format: 'screenplay' },
        { template: 'three-act', format: 'novel' },
      ]

      const isValid = validPairs.some(
        pair => template.includes(pair.template) && format.includes(pair.format)
      )

      if (!isValid) {
        return {
          valid: false,
          error: `Template "${template}" doesn't match format "${format}"`,
          autoCorrect: true // Clear the template
        }
      }
    }

    return { valid: true }
  },
]
```

**File:** `lib/intent/stages/4-validation/autoCorrect.ts`

```typescript
/**
 * Auto-correction logic for common issues
 */

import type { IntentAnalysis, PipelineContext } from '../../pipeline/types'

export function autoCorrect(
  error: string,
  analysis: IntentAnalysis,
  context: PipelineContext
): IntentAnalysis | null {
  
  // Auto-correct: create_structure → write_content when panel is open
  if (error.includes('Cannot create new structure while document panel is open')) {
    return {
      ...analysis,
      intent: 'write_content',
      requiresContext: true,
      reasoning: 'Auto-corrected from create_structure to write_content (document panel is open)'
    }
  }

  // Auto-correct: Clear invalid template suggestion
  if (error.includes("Template") && error.includes("doesn't match format")) {
    return {
      ...analysis,
      extractedEntities: {
        ...analysis.extractedEntities,
        suggestedTemplate: undefined
      },
      reasoning: 'Auto-corrected: Cleared invalid template suggestion'
    }
  }

  return null
}
```

---



---

### 7. Types

**File:** `lib/intent/pipeline/types.ts`

```typescript
/**
 * Shared types for intent pipeline
 */

export interface PipelineConfig {
  userApiConfig: UserApiConfig
  promptModules?: any[]
  validationRules?: any[]
}

export interface UserApiConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'custom'
  apiKey: string
  models: {
    fast: string
    smart: string
  }
  customEndpoint?: string
}

export interface PipelineContext {
  // Document state
  documentPanelOpen: boolean
  activeSegment?: string
  
  // Canvas state
  canvasNodes?: CanvasNode[]
  
  // Conversation state
  conversationHistory?: Array<{ role: string; content: string }>
  conversationState?: ConversationState
  
  // Enriched context (from Stage 2)
  resolvedReferences?: Record<string, any>
  matchedNodes?: CanvasNode[]
}

export interface CanvasNode {
  id: string
  label: string
  type: string
  metadata?: any
}

export type ConversationState = 
  | { type: 'initial' }
  | { type: 'awaiting_clarification', question: string, options: string[] }
  | { type: 'awaiting_section_choice', availableSections: string[] }
  | { type: 'format_mismatch_detected', originalRequest: string }

export interface TriageResult {
  classification: 'simple' | 'complex' | 'ambiguous'
  confidence: number
  intent: IntentAnalysis | null
  needsContextResolution: boolean
}

export interface IntentAnalysis {
  intent: IntentType
  confidence: number
  reasoning: string
  suggestedAction: string
  requiresContext: boolean
  needsClarification: boolean
  clarifyingQuestion?: string
  extractedEntities?: ExtractedEntities
  chainOfThought?: string
  pipelineMetrics?: PipelineMetrics
  totalTime?: number
}

export type IntentType = 
  | 'write_content'
  | 'answer_question'
  | 'improve_content'
  | 'rewrite_with_coherence'
  | 'modify_structure'
  | 'create_structure'
  | 'navigate_section'
  | 'open_and_write'
  | 'delete_node'
  | 'clarify_intent'

export interface ExtractedEntities {
  targetSegment?: string
  referenceContent?: string
  sourceDocument?: string
  isExplicitSourceReference?: boolean
  autoGenerateSections?: string[]
  documentFormat?: string
  suggestedTemplate?: string
}

export interface PipelineMetrics {
  stage1Time: number
  stage2Time: number
  stage3Time: number
  stage4Time: number
  totalCost: number
}
```

---

## 🔄 **Implementation Phases**



---

### Phase 2: Stage 1 - Triage (Week 1-2)

**Goal:** Implement fast classification to handle 80% of simple requests

**Tasks:**
1. Define pattern matching rules in `patterns.ts`
2. Implement `TriageAgent` with pattern matching + LLM fallback
3. Connect to `IntentPipeline`
4. Add metrics tracking
5. Write tests for pattern matching

**Success Criteria:**
- ✅ Simple intents (write, delete, answer) are classified in <100ms
- ✅ Pattern matching has >90% accuracy on simple cases
- ✅ Fallback to LLM works when patterns don't match
- ✅ Pipeline skips deep analysis for high-confidence simple intents

**Files to Create:**
```
lib/intent/stages/1-triage/
├── TriageAgent.ts
├── patterns.ts
└── rules.ts

__tests__/intent/
└── triage.test.ts
```

---

### Phase 3: Stage 2 - Context Resolution (Week 2)

**Goal:** Resolve ambiguous references and enrich context

**Tasks:**
1. Implement `ContextResolver`
2. Build `CanvasAnalyzer` for node matching
3. Create `ConversationTracker` for state management
4. Connect to pipeline
5. Write integration tests

**Success Criteria:**
- ✅ Pronouns ("it", "that") are resolved correctly
- ✅ Canvas nodes are matched with 85%+ accuracy
- ✅ Conversation state is tracked properly
- ✅ Follow-up responses are detected

**Files to Create:**
```
lib/intent/stages/2-context/
├── ContextResolver.ts
├── CanvasAnalyzer.ts
└── ConversationTracker.ts

__tests__/intent/
└── contextResolver.test.ts
```

---

### Phase 4: Stage 3 - Deep Analysis (Week 3)

**Goal:** Implement full intent analysis with modular prompts

**Tasks:**
1. Break existing mega-prompt into modular pieces (`prompts/`)
2. Implement `PromptComposer` for dynamic composition
3. Create `DeepAnalyzer` with chain-of-thought parsing
4. Connect to pipeline
5. Write tests for prompt composition

**Success Criteria:**
- ✅ Prompts are composed dynamically based on context
- ✅ Chain-of-thought reasoning is captured
- ✅ Analysis accuracy matches or exceeds current system
- ✅ Prompts are shorter and more focused

**Files to Create:**
```
lib/intent/stages/3-analysis/
├── DeepAnalyzer.ts
├── PromptComposer.ts
└── prompts/
    ├── core.ts
    ├── canvas.ts
    ├── followUp.ts
    └── templates.ts

__tests__/intent/
└── deepAnalyzer.test.ts
```

---

### Phase 5: Stage 4 - Validation (Week 3-4)

**Goal:** Add consistency checks and auto-corrections

**Tasks:**
1. Define validation rules in `rules.ts`
2. Implement auto-correction logic
3. Create `Validator` class
4. Connect to pipeline
5. Write regression tests

**Success Criteria:**
- ✅ Common mistakes are auto-corrected
- ✅ Format mismatches are detected
- ✅ Confidence thresholds are enforced
- ✅ All validation rules have tests

**Files to Create:**
```
lib/intent/stages/4-validation/
├── Validator.ts
├── rules.ts
└── autoCorrect.ts

__tests__/intent/
└── validator.test.ts
```

---



---





### Unit Tests

```typescript
// __tests__/intent/triage.test.ts

describe('TriageAgent', () => {
  test('classifies simple write intent', async () => {
    const triage = new TriageAgent(mockModelRouter)
    const result = await triage.classify('write more', {
      documentPanelOpen: true,
      activeSegment: 'chapter-1'
    })

    expect(result.classification).toBe('simple')
    expect(result.confidence).toBeGreaterThan(0.9)
    expect(result.intent?.intent).toBe('write_content')
  })

  test('detects complex multi-step request', async () => {
    const result = await triage.classify(
      'create a novel and write chapter 2',
      { documentPanelOpen: false }
    )

    expect(result.classification).toBe('complex')
    expect(result.needsContextResolution).toBe(true)
  })
})
```

### Integration Tests

```typescript
// __tests__/intent/pipeline.test.ts

describe('IntentPipeline', () => {
  test('handles simple request in <100ms', async () => {
    const start = Date.now()
    const result = await pipeline.analyze('write more', context)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(100)
    expect(result.intent).toBe('write_content')
  })

  test('escalates complex request through all stages', async () => {
    const result = await pipeline.analyze(
      'create a hero\'s journey novel and write chapter 2',
      context
    )

    expect(result.pipelineMetrics?.stage1Time).toBeGreaterThan(0)
    expect(result.pipelineMetrics?.stage2Time).toBeGreaterThan(0)
    expect(result.pipelineMetrics?.stage3Time).toBeGreaterThan(0)
    expect(result.pipelineMetrics?.stage4Time).toBeGreaterThan(0)
  })
})
```

### Regression Tests

```typescript
// __tests__/intent/testCases.ts

export const testCases = [
  {
    name: 'write_content_with_active_segment',
    message: 'write more',
    context: { documentPanelOpen: true, activeSegment: 'ch1' },
    expected: { intent: 'write_content', confidence: '>0.9' }
  },
  {
    name: 'create_structure_with_template',
    message: 'create a podcast interview about AI',
    context: { documentPanelOpen: false },
    expected: { 
      intent: 'create_structure', 
      suggestedTemplate: 'interview' 
    }
  },
  // ... 50+ test cases
]

describe('Regression Tests', () => {
  testCases.forEach(testCase => {
    test(testCase.name, async () => {
      const result = await pipeline.analyze(testCase.message, testCase.context)
      // Assert expectations
    })
  })
})
```

---

## 📊 **Success Metrics**

Track these metrics to validate improvement:

```typescript
interface PipelineMetrics {
  // Performance
  averageLatency: number      // Target: <200ms (vs 500ms+ now)
  p95Latency: number         // Target: <500ms
  p99Latency: number         // Target: <1000ms
  
  // Cost
  averageCostPerRequest: number  // Target: <$0.002 (vs $0.005+ now)
  
  // Accuracy
  intentAccuracy: number      // Target: >95% (match or exceed current)
  confidenceCalibration: number // Target: >0.9
  
  // Efficiency
  triageBypassRate: number   // Target: >80% skip deep analysis
  autoCorrectRate: number    // Target: >30% auto-fix issues
}
```

---

## 🚀 **Migration Path**

### Step 1: Feature Flag (Week 4)

```typescript
// lib/intent/IntentRouter.ts

const USE_NEW_PIPELINE = process.env.NEXT_PUBLIC_USE_NEW_INTENT_PIPELINE === 'true'

export async function analyzeIntent(message: string, context: any) {
  if (USE_NEW_PIPELINE) {
    return await newPipeline.analyze(message, context)
  } else {
    return await legacyAnalyzer.analyze(message, context)
  }
}
```

### Step 2: A/B Testing (Week 5)

```typescript
// Randomly assign users to old vs new system
const useNewPipeline = Math.random() > 0.5

// Track metrics for comparison
trackMetrics({
  version: useNewPipeline ? 'new' : 'old',
  latency,
  accuracy,
  cost
})
```

### Step 3: Gradual Rollout (Week 6)

```typescript
// Roll out to increasing percentage of users
const rolloutPercentage = 0.25 // 25% of users

const useNewPipeline = Math.random() < rolloutPercentage
```

### Step 4: Full Replacement (Week 7)

```typescript
// Remove feature flag and old code
export async function analyzeIntent(message: string, context: any) {
  return await pipeline.analyze(message, context)
}
```

---

## 💡 **Additional Enhancements**

### Semantic Template Matching (Optional)

Replace keyword matching with embeddings:

```typescript
// lib/intent/matchers/TemplateMatcher.ts

export class TemplateMatcher {
  private templateEmbeddings: Map<string, number[]>

  async initialize() {
    // Pre-compute embeddings for all templates
    for (const template of templates) {
      const embedding = await this.getEmbedding(
        template.description + ' ' + template.keywords.join(' ')
      )
      this.templateEmbeddings.set(template.id, embedding)
    }
  }

  async match(userMessage: string): Promise<string | null> {
    const messageEmbedding = await this.getEmbedding(userMessage)
    
    let bestMatch: string | null = null
    let bestSimilarity = 0

    for (const [templateId, embedding] of this.templateEmbeddings) {
      const similarity = cosineSimilarity(messageEmbedding, embedding)
      
      if (similarity > bestSimilarity && similarity > 0.85) {
        bestMatch = templateId
        bestSimilarity = similarity
      }
    }

    return bestMatch
  }

  private async getEmbedding(text: string): Promise<number[]> {
    // Use user's embedding model (OpenAI, Cohere, etc.)
    // Or use free sentence transformers via API
  }
}
```

### Caching for Performance

```typescript
// lib/intent/utils/cache.ts

import { LRUCache } from 'lru-cache'

const intentCache = new LRUCache<string, IntentAnalysis>({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
})

export function getCachedIntent(message: string, context: PipelineContext): IntentAnalysis | null {
  const cacheKey = hashMessageAndContext(message, context)
  return intentCache.get(cacheKey) || null
}

export function cacheIntent(message: string, context: PipelineContext, analysis: IntentAnalysis) {
  const cacheKey = hashMessageAndContext(message, context)
  intentCache.set(cacheKey, analysis)
}
```

### Real-time Feedback Loop

```typescript
// Track when user corrections indicate wrong intent

export function recordIntentCorrection(
  originalIntent: string,
  correctedIntent: string,
  message: string,
  context: PipelineContext
) {
  // Log for future model fine-tuning
  logIntentCorrection({
    timestamp: Date.now(),
    message,
    context,
    originalIntent,
    correctedIntent
  })
}
```

---

## 📝 **Configuration Example**

```typescript
// app/config/intentPipeline.ts

export const intentPipelineConfig = {
  userApiConfig: {
    provider: 'anthropic',
    apiKey: process.env.USER_ANTHROPIC_KEY!,
    models: {
      fast: 'claude-haiku-4-5-20251001',
      smart: 'claude-sonnet-4-5-20250929'
    }
  },
  
  // Optional: Add custom prompt modules
  promptModules: [
    customDomainRules,
    brandVoiceGuidelines
  ],
  
  // Optional: Add custom validation rules
  validationRules: [
    customFormatValidator,
    brandComplianceChecker
  ],
  
  // Performance tuning
  performance: {
    enableTriage: true,
    enableContextResolution: true,
    enableValidation: true,
    enableCaching: true
  },
  
  // Confidence thresholds
  confidence: {
    high: 0.85,
    medium: 0.65,
    low: 0.45
  }
}
```

---

## 🎯 **Expected Outcomes**

After full implementation:

1. **Performance**: 2-3x faster (50-200ms vs 500ms+)
2. **Cost**: 50% reduction (skip expensive calls for simple intents)
3. **Accuracy**: Match or exceed current system (>95%)
4. **Maintainability**: Modular, testable, extensible
5. **User Experience**: Faster, more accurate, better error handling

---

## 📚 **Resources**

- [Anthropic API Docs](https://docs.anthropic.com)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Google AI API Docs](https://ai.google.dev/docs)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [Chain-of-Thought Prompting](https://arxiv.org/abs/2201.11903)

---

## ✅ **Checklist for Cursor**

Use this checklist to track progress:

### Phase 1: Foundation
- [ ] Create file structure
- [ ] Define types in `types.ts`
- [ ] Implement `ModelRouter`
- [ ] Write tests for `ModelRouter`
- [ ] Verify API integration works

### Phase 2: Stage 1 - Triage
- [ ] Define patterns in `patterns.ts`
- [ ] Implement `TriageAgent`
- [ ] Connect to `IntentPipeline`
- [ ] Write tests for pattern matching
- [ ] Benchmark performance (<100ms)

### Phase 3: Stage 2 - Context
- [ ] Implement `ContextResolver`
- [ ] Build `CanvasAnalyzer`
- [ ] Create `ConversationTracker`
- [ ] Write integration tests
- [ ] Verify reference resolution works

### Phase 4: Stage 3 - Analysis
- [ ] Break prompt into modules
- [ ] Implement `PromptComposer`
- [ ] Create `DeepAnalyzer`
- [ ] Parse chain-of-thought
- [ ] Write prompt composition tests

### Phase 5: Stage 4 - Validation
- [ ] Define validation rules
- [ ] Implement auto-correction
- [ ] Create `Validator`
- [ ] Write regression tests
- [ ] Verify auto-corrections work

### Phase 6: Integration
- [ ] Create adapter layer
- [ ] Update Intent Router
- [ ] Add feature flag
- [ ] Run full test suite
- [ ] Performance benchmarking
- [ ] Gradual rollout

---

## 🚦 **Getting Started**

**Recommended order:**

1. Start with `types.ts` - get all interfaces defined
2. Build `ModelRouter` - this is foundation for everything
3. Create shell `IntentPipeline` with basic flow
4. Implement Stage 1 (Triage) - immediate performance wins
5. Add Stage 2 (Context) - better accuracy
6. Port existing prompts to Stage 3 (Analysis) - modular prompts
7. Add Stage 4 (Validation) - consistency checks
8. Integration and testing

**First commit:** Types + ModelRouter (Foundation)
**Second commit:** Triage Agent (Stage 1)
**Third commit:** Context Resolver (Stage 2)
...and so on.

---

## 🎉 **Success Definition**

You'll know the system is working when:

1. ✅ 80% of simple intents complete in <100ms
2. ✅ Complex intents complete in <500ms
3. ✅ Cost per request is <$0.002
4. ✅ Intent accuracy is >95%
5. ✅ All tests pass
6. ✅ User feedback is positive
7. ✅ System is maintainable and extensible


