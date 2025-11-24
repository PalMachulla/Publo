/**
 * Orchestrator Engine - Main Orchestration Logic
 * 
 * Unified orchestration system that:
 * 1. Analyzes user intent (via intentRouter)
 * 2. Resolves context (via contextProvider + blackboard)
 * 3. Selects optimal model (via modelRouter)
 * 4. Executes actions (via capabilities)
 * 5. Learns from patterns (via blackboard)
 * 
 * Inspired by Agentic Flow's swarm coordination and model routing
 * @see https://github.com/ruvnet/agentic-flow
 */

import { Blackboard } from './blackboard'
import { buildCanvasContext, resolveNode, formatCanvasContextForLLM, type CanvasContext } from './contextProvider'
import { selectModel, assessTaskComplexity, type ModelPriority } from './modelRouter'
import { analyzeIntent, type IntentAnalysis, type UserIntent } from '../intentRouter'
import { enhanceContextWithRAG } from '../ragIntegration'
import { Node, Edge } from 'reactflow'

// ============================================================
// TYPES
// ============================================================

export interface OrchestratorConfig {
  userId: string
  modelPriority?: ModelPriority
  enableRAG?: boolean
  enablePatternLearning?: boolean
  maxConversationDepth?: number
}

export interface OrchestratorRequest {
  message: string
  canvasNodes: Node[]
  canvasEdges: Edge[]
  activeContext?: {
    id: string
    name: string
  }
  isDocumentViewOpen?: boolean
  documentFormat?: string
  structureItems?: any[]
  contentMap?: Record<string, string>
  currentStoryStructureNodeId?: string | null
}

export interface OrchestratorResponse {
  intent: UserIntent
  confidence: number
  reasoning: string
  modelUsed: string
  actions: OrchestratorAction[]
  canvasChanged: boolean
  requiresUserInput: boolean
  estimatedCost: number
}

export interface OrchestratorAction {
  type: 'message' | 'open_document' | 'select_section' | 'generate_content' | 'modify_structure'
  payload: any
  status: 'pending' | 'executing' | 'completed' | 'failed'
  error?: string
}

// ============================================================
// ORCHESTRATOR ENGINE CLASS
// ============================================================

export class OrchestratorEngine {
  private blackboard: Blackboard
  private config: Required<OrchestratorConfig>
  
  constructor(config: OrchestratorConfig) {
    this.blackboard = new Blackboard(config.userId)
    this.config = {
      userId: config.userId,
      modelPriority: config.modelPriority || 'balanced',
      enableRAG: config.enableRAG !== false,
      enablePatternLearning: config.enablePatternLearning !== false,
      maxConversationDepth: config.maxConversationDepth || 50
    }
    
    console.log('🎯 [Orchestrator] Initialized', {
      userId: config.userId,
      priority: this.config.modelPriority,
      rag: this.config.enableRAG,
      learning: this.config.enablePatternLearning
    })
  }
  
  /**
   * Main orchestration method
   */
  async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now()
    
    // Step 1: Update blackboard with current state
    this.blackboard.updateCanvas(request.canvasNodes, request.canvasEdges)
    
    if (request.currentStoryStructureNodeId && request.contentMap) {
      this.blackboard.updateDocument(request.currentStoryStructureNodeId, {
        format: request.documentFormat || 'unknown',
        structureItems: request.structureItems || [],
        contentMap: request.contentMap,
        wordsWritten: Object.values(request.contentMap).reduce(
          (sum, content) => sum + content.split(/\s+/).length,
          0
        )
      })
    }
    
    // Step 2: Add user message to blackboard
    this.blackboard.addMessage({
      role: 'user',
      content: request.message,
      type: 'user'
    })
    
    // Step 3: Build canvas context
    const canvasContext = buildCanvasContext(
      'context',
      request.canvasNodes,
      request.canvasEdges,
      request.currentStoryStructureNodeId && request.contentMap
        ? { [request.currentStoryStructureNodeId]: { contentMap: request.contentMap } }
        : undefined
    )
    
    // Step 4: Check for canvas changes
    const canvasChanged = this.blackboard.hasCanvasChanged(startTime - 5000)
    
    // Step 5: Enhance with RAG if enabled
    let ragContext: any = null
    if (this.config.enableRAG && canvasContext.connectedNodes.length > 0) {
      const conversationHistory = this.blackboard.getRecentMessages(5)
      ragContext = await enhanceContextWithRAG(
        request.message,
        canvasContext,
        undefined,
        conversationHistory.map(m => ({ role: m.role, content: m.content }))
      )
    }
    
    // Step 6: Analyze intent
    const conversationHistory = this.blackboard.getRecentMessages(10)
    const intentAnalysis = await analyzeIntent({
      message: request.message,
      hasActiveSegment: !!request.activeContext,
      activeSegmentName: request.activeContext?.name,
      activeSegmentId: request.activeContext?.id,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role === 'orchestrator' ? 'assistant' : m.role,
        content: m.content,
        timestamp: m.timestamp
      })),
      documentStructure: request.structureItems,
      isDocumentViewOpen: request.isDocumentViewOpen,
      documentFormat: request.documentFormat,
      useLLM: true,
      canvasContext: ragContext?.hasRAG
        ? this.buildRAGEnhancedPrompt(ragContext, canvasContext)
        : formatCanvasContextForLLM(canvasContext)
    })
    
    // Step 7: Record intent in blackboard
    this.blackboard.setIntent(intentAnalysis.intent, intentAnalysis.confidence)
    
    // Step 8: Assess task complexity and select model
    const taskComplexity = assessTaskComplexity(
      intentAnalysis.intent,
      request.message.length + (ragContext?.ragContent?.length || 0),
      intentAnalysis.intent === 'rewrite_with_coherence'
    )
    
    const modelSelection = selectModel(
      taskComplexity,
      this.config.modelPriority,
      ['openai', 'groq', 'anthropic', 'google']
    )
    
    // Step 9: Log reasoning to blackboard
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🧠 ${intentAnalysis.reasoning}`,
      type: 'thinking',
      metadata: {
        intent: intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
        modelUsed: modelSelection.modelId
      }
    })
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🤖 ${modelSelection.reasoning}`,
      type: 'decision'
    })
    
    // Step 10: Generate actions based on intent
    const actions = await this.generateActions(
      intentAnalysis,
      request,
      canvasContext,
      ragContext,
      modelSelection
    )
    
    // Step 11: Build response
    const response: OrchestratorResponse = {
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      reasoning: intentAnalysis.reasoning,
      modelUsed: modelSelection.modelId,
      actions,
      canvasChanged,
      requiresUserInput: intentAnalysis.needsClarification || false,
      estimatedCost: modelSelection.estimatedCost
    }
    
    // Step 11: Learn pattern if enabled
    if (this.config.enablePatternLearning && intentAnalysis.confidence > 0.8) {
      const pattern = this.extractPattern(request.message, intentAnalysis, canvasContext)
      if (pattern) {
        await this.blackboard.storePattern(
          pattern.pattern,
          pattern.action,
          'intent_detection'
        )
      }
    }
    
    // Step 12: Record action
    this.blackboard.recordAction(intentAnalysis.intent, {
      confidence: intentAnalysis.confidence,
      modelUsed: modelSelection.modelId,
      taskComplexity,
      elapsedMs: Date.now() - startTime
    })
    
    console.log('✅ [Orchestrator] Completed', {
      intent: response.intent,
      confidence: response.confidence,
      model: response.modelUsed,
      cost: response.estimatedCost,
      time: Date.now() - startTime
    })
    
    return response
  }
  
  /**
   * Resolve which node the user is referring to
   */
  async resolveNodeReference(
    message: string,
    canvasContext: CanvasContext
  ): Promise<any> {
    return await resolveNode(message, canvasContext, this.blackboard)
  }
  
  /**
   * Get blackboard state
   */
  getBlackboard(): Blackboard {
    return this.blackboard
  }
  
  /**
   * Create temporal snapshot
   */
  async createSnapshot(): Promise<void> {
    await this.blackboard.createSnapshot()
  }
  
  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.blackboard.reset()
    console.log('🔄 [Orchestrator] Reset')
  }
  
  // ============================================================
  // PRIVATE HELPERS
  // ============================================================
  
  /**
   * Generate actions based on intent
   */
  private async generateActions(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    canvasContext: CanvasContext,
    ragContext: any,
    modelSelection: any
  ): Promise<OrchestratorAction[]> {
    const actions: OrchestratorAction[] = []
    
    switch (intent.intent) {
      case 'answer_question': {
        // Build context-aware prompt with ALL canvas nodes
        let enhancedPrompt = `User Question: ${request.message}\n\n`
        
        if (canvasContext.connectedNodes.length > 0) {
          enhancedPrompt += `Available Context from Canvas:\n`
          
          canvasContext.connectedNodes.forEach(node => {
            enhancedPrompt += `\n--- ${node.label} (${node.nodeType}) ---\n`
            enhancedPrompt += `Summary: ${node.summary}\n`
            
            if (node.detailedContext?.structure) {
              enhancedPrompt += `Structure:\n${node.detailedContext.structure}\n`
            }
            
            // Include content if available
            if (node.detailedContext?.contentMap) {
              const contentEntries = Object.entries(node.detailedContext.contentMap)
              if (contentEntries.length > 0) {
                enhancedPrompt += `\nContent (${contentEntries.length} sections):\n`
                contentEntries.slice(0, 5).forEach(([sectionId, content]: [string, any]) => {
                  if (content && typeof content === 'string' && content.trim()) {
                    const truncated = content.length > 500 
                      ? content.substring(0, 500) + '...' 
                      : content
                    enhancedPrompt += `\n${truncated}\n`
                  }
                })
              }
            }
          })
        }
        
        // Add RAG content if available
        if (ragContext?.hasRAG && ragContext.ragContent) {
          enhancedPrompt += `\n\nAdditional Relevant Content (from semantic search):\n${ragContext.ragContent}`
        }
        
        actions.push({
          type: 'generate_content',
          payload: {
            prompt: enhancedPrompt,
            model: modelSelection.modelId,
            isAnswer: true
          },
          status: 'pending'
        })
        break
      }
      
      case 'write_content': {
        if (request.activeContext) {
          actions.push({
            type: 'generate_content',
            payload: {
              sectionId: request.activeContext.id,
              prompt: request.message,
              model: modelSelection.modelId
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'create_structure': {
        actions.push({
          type: 'modify_structure',
          payload: {
            action: 'create',
            format: request.documentFormat || 'novel',
            prompt: request.message
          },
          status: 'pending'
        })
        break
      }
      
      case 'open_and_write': {
        // Resolve which node to open
        const targetNode = await resolveNode(request.message, canvasContext, this.blackboard)
        
        if (targetNode) {
          actions.push({
            type: 'open_document',
            payload: {
              nodeId: targetNode.nodeId,
              sectionId: null
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'general_chat':
      default: {
        // Similar to answer_question but more conversational
        actions.push({
          type: 'message',
          payload: {
            content: `Let me help you with that...`,
            type: 'thinking'
          },
          status: 'pending'
        })
        break
      }
    }
    
    return actions
  }
  
  private extractPattern(
    message: string,
    intent: IntentAnalysis,
    canvasContext: CanvasContext
  ): { pattern: string; action: string } | null {
    // Extract learnable patterns
    const lowerMessage = message.toLowerCase()
    
    // Pattern: User asks about "the plot" after discussing a specific document
    if (lowerMessage.includes('plot') && canvasContext.connectedNodes.length > 0) {
      const recentNodes = this.blackboard.getRecentlyReferencedNodes()
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
  
  private buildRAGEnhancedPrompt(ragContext: any, canvasContext: CanvasContext): string {
    let prompt = formatCanvasContextForLLM(canvasContext)
    
    if (ragContext.hasRAG && ragContext.ragContent) {
      prompt += `\n\nRelevant Content (from semantic search):\n${ragContext.ragContent}`
    }
    
    return prompt
  }
}

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

const orchestrators = new Map<string, OrchestratorEngine>()

export function getOrchestrator(userId: string, config?: Partial<OrchestratorConfig>): OrchestratorEngine {
  if (!orchestrators.has(userId)) {
    orchestrators.set(userId, new OrchestratorEngine({
      userId,
      ...config
    }))
  }
  return orchestrators.get(userId)!
}

export function createOrchestrator(config: OrchestratorConfig): OrchestratorEngine {
  const orchestrator = new OrchestratorEngine(config)
  orchestrators.set(config.userId, orchestrator)
  return orchestrator
}

