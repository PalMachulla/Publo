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
import { 
  selectModel, 
  assessTaskComplexity, 
  selectModelForTask,
  isFrontierModel,
  MODEL_TIERS,
  type ModelPriority, 
  type ModelSelection,
  type TaskRequirements,
  type TieredModel
} from './modelRouter'
import { analyzeIntent, type IntentAnalysis, type UserIntent } from '../intentRouter'
import { enhanceContextWithRAG } from '../ragIntegration'
import { Node, Edge } from 'reactflow'
import { getDocumentHierarchy, DOCUMENT_HIERARCHY } from '@/lib/documentHierarchy'
// PHASE 1: WorldState - Unified state management
import type { WorldStateManager } from './worldState'
// PHASE 2: Tool System - Executable tools
import type { ToolRegistry } from '../tools'

// ============================================================
// TYPES
// ============================================================

export interface OrchestratorConfig {
  userId: string
  modelPriority?: ModelPriority
  enableRAG?: boolean
  enablePatternLearning?: boolean
  maxConversationDepth?: number
  // PHASE 2: Tool system
  toolRegistry?: ToolRegistry
  // PHASE 3: Real-time UI callback for immediate message display
  onMessage?: (content: string, role?: 'user' | 'orchestrator', type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress') => void
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
  // Model selection preferences
  modelMode?: 'automatic' | 'fixed'
  fixedModeStrategy?: 'consistent' | 'loose'
  fixedModelId?: string | null
  // Available providers (from user's API keys)
  availableProviders?: string[]
  // PHASE 1.2: Dynamic model availability
  // Models actually available to the user (from /api/models/available)
  // If provided, orchestrator will use these instead of filtering MODEL_TIERS
  availableModels?: TieredModel[]
  // Structure generation (for create_structure intent)
  userKeyId?: string // API key ID for structure generation
  // Clarification response context (when user is responding to a request_clarification action)
  clarificationContext?: {
    originalAction: string // 'create_structure', 'open_and_write', 'delete_node'
    question: string // The question that was asked
    options: Array<{id: string, label: string, description: string}>
    payload: any // Original action payload (documentFormat, userMessage, existingDocs, etc.)
  }
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
  thinkingSteps?: Array<{ content: string; type: string }> // NEW: Detailed thinking from blackboard
}

export interface OrchestratorAction {
  type: 'message' | 'open_document' | 'select_section' | 'generate_content' | 'modify_structure' | 'delete_node' | 'request_clarification' | 'generate_structure'
  payload: any
  status: 'pending' | 'executing' | 'completed' | 'failed'
  error?: string
}

// Structure generation types (for create_structure intent)
export interface StructurePlan {
  reasoning: string
  structure: Array<{
    id: string
    level: number
    name: string
    parentId: string | null
    wordCount: number
    summary: string
  }>
  tasks: Array<{
    id: string
    type: string
    sectionId: string
    description: string
  }>
  metadata?: {
    totalWordCount: number
    estimatedTime: string
    recommendedModels: string[]
  }
}

// ============================================================
// ORCHESTRATOR ENGINE CLASS
// ============================================================

export class OrchestratorEngine {
  private blackboard: Blackboard
  private config: Omit<Required<OrchestratorConfig>, 'toolRegistry' | 'onMessage'> & { toolRegistry?: ToolRegistry; onMessage?: OrchestratorConfig['onMessage'] }
  private worldState?: WorldStateManager // PHASE 1: Optional for gradual migration
  private toolRegistry?: ToolRegistry // PHASE 2: Optional tool system
  
  constructor(config: OrchestratorConfig, worldState?: WorldStateManager) {
    // PHASE 3: Pass real-time message callback to Blackboard
    const messageCallback = config.onMessage ? (msg: any) => {
      config.onMessage!(msg.content, msg.role, msg.type)
    } : undefined
    
    this.blackboard = new Blackboard(config.userId, messageCallback)
    this.worldState = worldState // PHASE 1: Store WorldState if provided
    this.toolRegistry = config.toolRegistry // PHASE 2: Store ToolRegistry if provided
    this.config = {
      userId: config.userId,
      modelPriority: config.modelPriority || 'balanced',
      enableRAG: config.enableRAG !== false,
      enablePatternLearning: config.enablePatternLearning !== false,
      maxConversationDepth: config.maxConversationDepth || 50,
      toolRegistry: config.toolRegistry, // PHASE 2: Include in config (optional)
      ...(config.onMessage && { onMessage: config.onMessage }) // PHASE 3: Real-time message callback (optional)
    }
    
    console.log('🎯 [Orchestrator] Initialized', {
      userId: config.userId,
      priority: this.config.modelPriority,
      rag: this.config.enableRAG,
      learning: this.config.enablePatternLearning,
      hasWorldState: !!worldState, // PHASE 1: Log if using WorldState
      hasToolRegistry: !!config.toolRegistry, // PHASE 2: Log if using tools
      toolCount: config.toolRegistry?.getAll().length || 0
    })
  }
  
  /**
   * Main orchestration method
   */
  async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now()
    
    // NEW: Handle clarification responses (user responding to request_clarification)
    if (request.clarificationContext) {
      return await this.handleClarificationResponse(request)
    }
    
    // PHASE 1: Use helper methods to read from WorldState or Request
    // Extract state early for backward compatibility
    const _canvasNodes = this.getCanvasNodes(request)
    const _canvasEdges = this.getCanvasEdges(request)
    const _activeContext = this.getActiveContext(request)
    const _isDocViewOpen = this.isDocumentViewOpen(request)
    const _documentFormat = this.getDocumentFormat(request)
    const _structureItems = this.getStructureItems(request)
    const _contentMap = this.getContentMap(request)
    const _availableProviders = this.getAvailableProviders(request)
    const _availableModels = this.getAvailableModels(request)
    const _modelPrefs = this.getModelPreferences(request)
    
    // Step 1: Update blackboard with current state
    this.blackboard.updateCanvas(_canvasNodes, _canvasEdges)
    
    if (request.currentStoryStructureNodeId && _contentMap) {
      this.blackboard.updateDocument(request.currentStoryStructureNodeId, {
        format: _documentFormat || 'unknown',
        structureItems: _structureItems || [],
        contentMap: _contentMap,
        wordsWritten: Object.values(_contentMap).reduce(
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
      _canvasNodes,
      _canvasEdges,
      request.currentStoryStructureNodeId && request.contentMap
        ? { [request.currentStoryStructureNodeId]: { contentMap: request.contentMap } }
        : undefined
    )
    
    // Step 4: Check for canvas changes
    const canvasChanged = this.blackboard.hasCanvasChanged(startTime - 5000)
    
    // Step 5: Analyze intent (MOVED UP - need to know intent before RAG)
    const conversationHistory = this.blackboard.getRecentMessages(10)
    
    // First pass: Quick intent analysis without RAG
    const intentAnalysis = await analyzeIntent({
      message: request.message,
      hasActiveSegment: !!request.activeContext,
      activeSegmentName: request.activeContext?.name,
      activeSegmentId: request.activeContext?.id,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role === 'orchestrator' ? 'assistant' : (m.role === 'system' ? 'assistant' : m.role),
        content: m.content,
        timestamp: m.timestamp
      })),
      documentStructure: request.structureItems,
      isDocumentViewOpen: request.isDocumentViewOpen,
      documentFormat: request.documentFormat,
      useLLM: true,
      canvasContext: formatCanvasContextForLLM(canvasContext)
    })
    
    // Step 6: Enhance with RAG if enabled (AFTER intent analysis)
    // SKIP RAG for structure generation - we'll handle it separately with summaries fallback
    let ragContext: any = null
    if (this.config.enableRAG && 
        canvasContext.connectedNodes.length > 0 &&
        intentAnalysis.intent !== 'create_structure' &&
        intentAnalysis.intent !== 'clarify_intent') {
      
      ragContext = await enhanceContextWithRAG(
        request.message,
        canvasContext,
        undefined,
        conversationHistory.map(m => ({ role: m.role, content: m.content }))
      )
    }
    
    // Step 7: Record intent in blackboard
    this.blackboard.setIntent(intentAnalysis.intent, intentAnalysis.confidence)
    
    // Step 8: Assess task complexity and select model
    const taskComplexity = assessTaskComplexity(
      intentAnalysis.intent,
      request.message.length + (ragContext?.ragContent?.length || 0),
      intentAnalysis.intent === 'rewrite_with_coherence'
    )
    
    // Use user's available providers (from API keys) or fallback to common ones
    const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
    
    // PHASE 1.2: Determine which models to use
    // Prefer availableModels from /api/models/available (actual models user has access to)
    // Fallback to MODEL_TIERS filtered by provider ONLY if we have no models at all
    const modelsToUse: TieredModel[] = request.availableModels && request.availableModels.length > 0
      ? request.availableModels
      : MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
    
    console.log(`🎯 [Orchestrator] Using ${request.availableModels && request.availableModels.length > 0 ? 'dynamic' : 'static'} model list: ${modelsToUse.length} models available`)
    
    // ✅ CRITICAL: If using static fallback, warn user
    if (!request.availableModels || request.availableModels.length === 0) {
      console.warn('⚠️ [Orchestrator] Using static MODEL_TIERS fallback - models may not be available to user!')
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `⚠️ Unable to fetch your available models. Using default list (some models may fail).`,
        type: 'warning'
      })
    }
    
    // VALIDATE fixedModelId against available models
    let validatedFixedModelId: string | null = null
    if (request.modelMode === 'fixed' && request.fixedModelId) {
      const isValidModel = modelsToUse.some(m => m.id === request.fixedModelId)
      
      if (isValidModel) {
        validatedFixedModelId = request.fixedModelId
        console.log('✅ [Orchestrator] Fixed model is valid:', validatedFixedModelId)
      } else {
        console.warn(`⚠️ [Orchestrator] Configured model "${request.fixedModelId}" not found in available models. Auto-selecting...`)
        
        // Add message to blackboard to inform user
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `⚠️ Configured model "${request.fixedModelId}" is no longer available. Auto-selecting the best model for this task instead.`,
          type: 'decision'
        })
        
        validatedFixedModelId = null
      }
    }
    
    // PHASE 2: Determine if this task requires reasoning
    // Orchestrator's own operations (planning, analysis, coordination) need reasoning
    // Content generation will be delegated to writer models later
    const requiresReasoning = 
      intentAnalysis.intent === 'create_structure' || // Structure planning needs reasoning
      intentAnalysis.intent === 'rewrite_with_coherence' || // Complex editing needs reasoning
      taskComplexity === 'reasoning' || // Complex reasoning tasks
      taskComplexity === 'complex' // Complex orchestration tasks
    
    const modelSelection = selectModel(
      taskComplexity,
      this.config.modelPriority,
      availableProviders,
      modelsToUse, // PHASE 1.2: Pass actual available models
      requiresReasoning // PHASE 2: Require reasoning for orchestrator operations
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
      modelSelection,
      validatedFixedModelId,
      modelsToUse // PHASE 2: Pass available models for writer delegation
    )
    
    // Step 11: Build response
    // Extract thinking steps from blackboard (last 10 orchestrator messages)
    const recentMessages = this.blackboard.getRecentMessages(10)
    const thinkingSteps = recentMessages
      .filter(m => m.role === 'orchestrator' && (m.type === 'thinking' || m.type === 'decision'))
      .map(m => ({ content: m.content, type: m.type || 'thinking' }))
    
    const response: OrchestratorResponse = {
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      reasoning: intentAnalysis.reasoning,
      modelUsed: modelSelection.modelId,
      actions,
      canvasChanged,
      requiresUserInput: intentAnalysis.needsClarification || false,
      estimatedCost: modelSelection.estimatedCost,
      thinkingSteps // Include detailed thinking from blackboard
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
  // PHASE 2: TOOL EXECUTION
  // ============================================================
  
  /**
   * Execute tools in parallel with traditional action plan
   * Tools execute immediately and update WorldState
   * Actions are still returned for UI backward compatibility
   */
  private async executeToolsIfAvailable(
    actions: OrchestratorAction[],
    request: OrchestratorRequest
  ): Promise<{
    actions: OrchestratorAction[]
    toolResults: Array<{ action: OrchestratorAction, result: any }>
  }> {
    // If no tool registry, return actions as-is
    if (!this.toolRegistry || !this.worldState) {
      return { actions, toolResults: [] }
    }

    const toolResults: Array<{ action: OrchestratorAction, result: any }> = []
    const updatedActions: OrchestratorAction[] = []

    for (const action of actions) {
      // Try to execute action as tool
      const toolName = this.mapActionTypeToToolName(action.type)
      
      if (toolName && this.toolRegistry.has(toolName)) {
        console.log(`[Orchestrator] Executing tool: ${toolName}`)
        
        try {
          const result = await this.toolRegistry.execute(
            toolName,
            action.payload,
            {
              worldState: this.worldState,
              userId: this.config.userId,
              userKeyId: request.userKeyId
            }
          )
          
          toolResults.push({ action, result })
          
          // Update action status based on tool result
          updatedActions.push({
            ...action,
            status: result.success ? 'completed' : 'failed',
            error: result.error
          })
          
          console.log(`[Orchestrator] Tool ${toolName} ${result.success ? 'succeeded' : 'failed'}`)
        } catch (error) {
          console.error(`[Orchestrator] Tool ${toolName} threw error:`, error)
          updatedActions.push({
            ...action,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      } else {
        // No tool available, keep action as-is
        updatedActions.push(action)
      }
    }

    return { actions: updatedActions, toolResults }
  }

  /**
   * Map action types to tool names
   */
  private mapActionTypeToToolName(actionType: OrchestratorAction['type']): string | null {
    const mapping: Record<string, string> = {
      'generate_content': 'write_content',
      'generate_structure': 'create_structure',
      'open_document': 'open_document',
      'select_section': 'select_section',
      'delete_node': 'delete_node',
      'message': 'send_message',
      // Note: 'request_clarification' and 'modify_structure' don't map to tools yet
      // They require special handling in the orchestrator
    }
    return mapping[actionType] || null
  }
  
  // ============================================================
  // PHASE 1: WORLDSTATE HELPERS
  // ============================================================
  // These methods provide backward-compatible state access
  // Priority: WorldState > Request Props
  
  private getCanvasNodes(request: OrchestratorRequest): Node[] {
    if (this.worldState) {
      return this.worldState.getAllNodes().map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data
      }))
    }
    return request.canvasNodes
  }
  
  private getCanvasEdges(request: OrchestratorRequest): Edge[] {
    if (this.worldState) {
      return this.worldState.getAllEdges().map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        data: e.data
      }))
    }
    return request.canvasEdges
  }
  
  private getActiveContext(request: OrchestratorRequest): {id: string, name: string} | undefined {
    if (this.worldState) {
      const sectionId = this.worldState.getActiveSectionId()
      const doc = this.worldState.getActiveDocument()
      if (sectionId && doc.structure) {
        const section = doc.structure.items.find(item => item.id === sectionId)
        if (section) {
          return { id: section.id, name: section.name }
        }
      }
      return undefined
    }
    return request.activeContext
  }
  
  private isDocumentViewOpen(request: OrchestratorRequest): boolean {
    if (this.worldState) {
      return this.worldState.isDocumentPanelOpen()
    }
    return request.isDocumentViewOpen || false
  }
  
  private getDocumentFormat(request: OrchestratorRequest): string | undefined {
    if (this.worldState) {
      return this.worldState.getActiveDocument().format || undefined
    }
    return request.documentFormat
  }
  
  private getStructureItems(request: OrchestratorRequest): any[] | undefined {
    if (this.worldState) {
      return this.worldState.getActiveDocument().structure?.items
    }
    return request.structureItems
  }
  
  private getContentMap(request: OrchestratorRequest): Record<string, string> | undefined {
    if (this.worldState) {
      const contentMap: Record<string, string> = {}
      this.worldState.getActiveDocument().content.forEach((content, id) => {
        contentMap[id] = content
      })
      return contentMap
    }
    return request.contentMap
  }
  
  private getAvailableProviders(request: OrchestratorRequest): string[] | undefined {
    if (this.worldState) {
      return this.worldState.getState().user.availableProviders
    }
    return request.availableProviders
  }
  
  private getAvailableModels(request: OrchestratorRequest): TieredModel[] | undefined {
    if (this.worldState) {
      return this.worldState.getState().user.availableModels
    }
    return request.availableModels
  }
  
  private getModelPreferences(request: OrchestratorRequest): {
    modelMode?: 'automatic' | 'fixed'
    fixedModelId?: string | null
    fixedModeStrategy?: 'consistent' | 'loose'
  } {
    if (this.worldState) {
      return this.worldState.getUserPreferences()
    }
    return {
      modelMode: request.modelMode,
      fixedModelId: request.fixedModelId,
      fixedModeStrategy: request.fixedModeStrategy
    }
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
    modelSelection: any,
    validatedFixedModelId: string | null = null,
    availableModels?: TieredModel[] // PHASE 2: Available models for writer delegation
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
        console.log('📝 [generateActions] write_content:', {
          hasActiveContext: !!request.activeContext,
          activeContextId: request.activeContext?.id,
          message: request.message,
          selectedModel: modelSelection.modelId,
          modelMode: request.modelMode,
          fixedModeStrategy: request.fixedModeStrategy,
          hasStructureItems: !!request.structureItems?.length
        })
        
        let targetSectionId = request.activeContext?.id
        
        // If no active context, try to detect section from message
        if (!targetSectionId && request.structureItems && request.structureItems.length > 0) {
          const lowerMessage = request.message.toLowerCase()
          
          // Helper to find section by name (case-insensitive, fuzzy match)
          const findSectionByName = (items: any[], searchTerm: string): any => {
            // Normalize search term: remove numbers, punctuation, convert & to "and"
            const normalizeText = (text: string) => 
              text
                .toLowerCase()
                .replace(/^\d+\.?\d*\s*/, '') // Remove leading numbers like "1.0 ", "2. "
                .replace(/&/g, 'and')          // Convert & to "and"
                .replace(/[^\w\s]/g, ' ')      // Remove punctuation
                .replace(/\s+/g, ' ')          // Collapse whitespace
                .trim()
            
            const normalizedSearch = normalizeText(searchTerm)
            
            for (const item of items) {
              const normalizedName = normalizeText(item.name || '')
              
              // Try exact match first
              if (normalizedName === normalizedSearch) {
                return item
              }
              
              // Try partial match (allows "intro" to match "introduction")
              if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
                return item
              }
              
              // Check children recursively
              if (item.children) {
                const found = findSectionByName(item.children, searchTerm)
                if (found) return found
              }
            }
            return null
          }
          
          // ✅ NEW: Handle ordinal/positional references (first scene, second act, etc.)
          const ordinalPattern = /(?:start with|write|begin with)?\s*(?:the\s+)?(first|second|third|1st|2nd|3rd|opening|initial)\s+(scene|act|sequence|chapter|section|beat)/i
          const ordinalMatch = request.message.match(ordinalPattern)
          
          if (ordinalMatch) {
            const position = ordinalMatch[1].toLowerCase()
            const type = ordinalMatch[2].toLowerCase()
            
            // Map ordinals to numbers
            const ordinalMap: Record<string, number> = {
              'first': 0, '1st': 0, 'opening': 0, 'initial': 0,
              'second': 1, '2nd': 1,
              'third': 2, '3rd': 2
            }
            
            const targetIndex = ordinalMap[position] ?? 0
            
            // ✅ FIX: StoryStructureItems are a FLAT array (no children field)
            // Search by name pattern - scenes have "SCENE:" prefix, acts have "Act", etc.
            const matchingSections = request.structureItems.filter((item: any) => {
              const itemName = item.name?.toLowerCase() || ''
              
              // Match by type keyword in the name
              if (type === 'scene') {
                // Scenes typically start with "SCENE:" or contain "scene" at word boundary
                return itemName.startsWith('scene:') || /\bscene\b/i.test(item.name || '')
              } else if (type === 'act') {
                // Acts typically start with "Act " or "ACT "
                return /^act\s+/i.test(item.name || '')
              } else if (type === 'sequence') {
                // Sequences typically start with "Sequence " or contain "sequence"
                return /^sequence\s+/i.test(item.name || '') || itemName.includes('sequence')
              } else if (type === 'beat') {
                // Beats contain the word "beat"
                return itemName.includes('beat')
              } else {
                // Generic fallback: just check if name includes the type
                return itemName.includes(type)
              }
            }).sort((a: any, b: any) => a.order - b.order) // Sort by order to ensure first=first
            
            console.log('🔍 [Ordinal Detection] Debug:', {
              searchType: type,
              position,
              targetIndex,
              totalStructureItems: request.structureItems.length,
              matchingSectionsCount: matchingSections.length,
              matchedNames: matchingSections.map((s: any) => s.name).slice(0, 5), // Show first 5
              allItemNames: request.structureItems.map((s: any) => s.name).slice(0, 10) // Show first 10 items
            })
            
            if (matchingSections[targetIndex]) {
              targetSectionId = matchingSections[targetIndex].id
              console.log('🎯 [Ordinal Detection] Found section:', {
                position,
                type,
                targetIndex,
                foundSection: matchingSections[targetIndex].name,
                sectionId: targetSectionId
              })
            } else {
              console.warn('⚠️ [Ordinal Detection] No match found at index', targetIndex, 'for type', type)
            }
          }
          
          // Try to extract section name from message (if ordinal didn't match)
          if (!targetSectionId) {
            // Patterns: "add to X", "write in X", "add text to X", "write X"
            const patterns = [
              /(?:add|write|put|insert).*(?:to|in|into)\s+(?:the\s+)?(.+?)(?:\s+(?:section|part|chapter|scene|act|sequence))?$/i,
              /(?:add|write|put|insert)\s+(?:some\s+)?(?:text|content|words).*?(?:to|in|into)\s+(?:the\s+)?(.+?)$/i,
            ]
            
            let sectionName: string | null = null
            for (const pattern of patterns) {
              const match = request.message.match(pattern)
              if (match && match[1]) {
                sectionName = match[1].trim().toLowerCase()
                console.log('📝 [Pattern Match] Extracted section name:', {
                  pattern: pattern.source,
                  fullMatch: match[0],
                  captured: match[1],
                  normalized: sectionName
                })
                break
              }
            }
            
            console.log('🔍 [Section Search] Looking for section:', {
              sectionName,
              hasStructureItems: !!request.structureItems,
              structureItemsCount: request.structureItems?.length || 0,
              structureItemNames: request.structureItems?.map(s => s.name).slice(0, 5)
            })
            
            if (sectionName) {
              const foundSection = findSectionByName(request.structureItems, sectionName)
              if (foundSection) {
                targetSectionId = foundSection.id
                console.log('🎯 [Smart Section Detection] Found section:', {
                  searchTerm: sectionName,
                  foundSection: foundSection.name,
                  sectionId: targetSectionId
                })
              } else {
                console.warn('⚠️ [Smart Section Detection] No match found for:', sectionName)
              }
            } else {
              console.warn('⚠️ [Pattern Match] No section name extracted from message:', request.message)
            }
          }
        }
        
        if (targetSectionId) {
          // If we detected a section from the message (not already selected), auto-select it first
          if (!request.activeContext?.id || request.activeContext.id !== targetSectionId) {
            actions.push({
              type: 'select_section',
              payload: {
                sectionId: targetSectionId
              },
              status: 'pending'
            })
            console.log('🎯 [Auto-Select] Selecting section:', targetSectionId)
          }
          
          // Determine which model to use based on mode and strategy
          let writerModel: any
          
          if (request.modelMode === 'fixed' && request.fixedModeStrategy === 'consistent' && validatedFixedModelId) {
            // CONSISTENT: Use the fixed model for writing too (expensive but uniform)
            // ONLY if it's a valid model from MODEL_TIERS
            const fixedModel = MODEL_TIERS.find(m => m.id === validatedFixedModelId)
            writerModel = {
              modelId: validatedFixedModelId,
              provider: fixedModel?.provider || modelSelection.provider,
              reasoning: `Fixed mode (Consistent): Using ${fixedModel?.displayName || validatedFixedModelId} for all tasks`
            }
            console.log('🎯 [Consistent Strategy] Using validated fixed model for writing:', writerModel.modelId)
          } else {
            // AUTOMATIC or LOOSE: Intelligently select writer based on scene complexity
            const activeStructureItem = request.structureItems?.find(item => item.id === targetSectionId)
            const sectionLevel = activeStructureItem?.level || 3
            const sectionName = activeStructureItem?.name?.toLowerCase() || ''
            const sectionWordCount = activeStructureItem?.wordCount || 0
            
            // Determine task complexity based on section characteristics
            let taskType: TaskRequirements['type'] = 'simple-scene'
            
            // Level 1 (Acts) or Level 2 (Sequences) = Complex scenes
            if (sectionLevel <= 2) {
              taskType = 'complex-scene'
            }
            // Keywords indicating complexity
            else if (sectionName.includes('climax') || 
                     sectionName.includes('confrontation') ||
                     sectionName.includes('revelation') ||
                     sectionName.includes('finale')) {
              taskType = 'complex-scene'
            }
            // High word count target
            else if (sectionWordCount > 1000) {
              taskType = 'complex-scene'
            }
            // Dialogue-heavy scenes
            else if (sectionName.includes('dialogue') || 
                     sectionName.includes('conversation') ||
                     sectionName.includes('talk')) {
              taskType = 'dialogue'
            }
            // Action scenes
            else if (sectionName.includes('action') || 
                     sectionName.includes('fight') ||
                     sectionName.includes('chase') ||
                     sectionName.includes('battle')) {
              taskType = 'action'
            }
            
            // PHASE 2: Use available models passed from orchestrate() or filter MODEL_TIERS
            const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
            const modelsForWriter = availableModels || MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
            
            // Select best model for this task from AVAILABLE models only
            // Note: selectModelForTask does NOT require reasoning (writer models can be smaller/faster)
            const selectedModel = selectModelForTask(
              {
                type: taskType,
                wordCount: sectionWordCount,
                contextNeeded: 8000, // Typical scene context
                priority: 'balanced' // Balance quality, speed, and cost
              },
              modelsForWriter // Only models user has API keys for!
            )
            
            writerModel = {
              modelId: selectedModel?.id || 'llama-3.3-70b-versatile', // Fallback
              provider: selectedModel?.provider || 'groq',
              reasoning: `Intelligent delegation: ${taskType} task → ${selectedModel?.displayName || 'Llama 3.3 70B'}`
            }
            
            console.log('💡 [Intelligent Delegation]', {
              section: activeStructureItem?.name,
              level: sectionLevel,
              taskType,
              selectedModel: writerModel.modelId,
              reasoning: writerModel.reasoning
            })
          }
          
          actions.push({
            type: 'generate_content',
            payload: {
              sectionId: targetSectionId,
              prompt: request.message,
              model: writerModel.modelId,
              provider: writerModel.provider
            },
            status: 'pending'
          })
          console.log('✅ [generateActions] Created write_content action:', {
            section: targetSectionId,
            model: writerModel.modelId,
            provider: writerModel.provider,
            strategy: request.modelMode === 'fixed' ? request.fixedModeStrategy : 'automatic'
          })
        } else {
          console.warn('⚠️ [generateActions] No section found for write_content! Message:', request.message)
          // Return a helpful message instead of failing silently
          actions.push({
            type: 'message',
            payload: {
              content: `I want to add content, but I need you to select a section first. Which section would you like me to write in?`,
              type: 'result'
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'create_structure': {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '🏗️ Generating story structure plan...',
          type: 'thinking'
        })
        
        // Validate required fields
        if (!request.documentFormat) {
          throw new Error('documentFormat is required for create_structure intent')
        }
        if (!request.userKeyId) {
          throw new Error('userKeyId is required for create_structure intent')
        }
        
        // ✅ PROACTIVE CANVAS AWARENESS: Check for existing documents
        console.log('🔍 [Canvas Awareness] Raw canvasNodes:', request.canvasNodes?.length || 0)
        
        const existingDocs = (request.canvasNodes || [])
          .filter((node: any) => 
            node.type === 'storyStructureNode' && 
            node.data?.format &&
            node.data?.items?.length > 0
          )
          .map((node: any) => {
            const allDataKeys = Object.keys(node.data || {})
            console.log(`🔍 [Canvas Awareness] Checking node "${node.data?.label}":`)
            console.log(`  type: ${node.type}`)
            console.log(`  dataKeys (${allDataKeys.length}):`, allDataKeys.join(', '))
            console.log(`  itemsCount: ${node.data?.items?.length || 0}`)
            console.log(`  format: ${node.data?.format}`)
            console.log(`  hasContentMapKey: ${allDataKeys.includes('contentMap')}`)
            
            // ✅ FIX: Check BOTH legacy contentMap AND new document_data for content
            const contentMapKeys = Object.keys(node.data?.contentMap || {})
            console.log(`  contentMapKeys (${contentMapKeys.length}):`, contentMapKeys.slice(0, 5).join(', '))
            
            const hasLegacyContent = contentMapKeys.length > 0 && 
              contentMapKeys.some(key => {
                const content = node.data.contentMap[key]
                return content && typeof content === 'string' && content.trim().length > 0
              })
            
            // ✅ FIX: Ensure boolean result (not undefined)
            let hasHierarchicalContent = false
            if (node.data.document_data?.structure && Array.isArray(node.data.document_data.structure)) {
              hasHierarchicalContent = node.data.document_data.structure.some((seg: any) => {
                // Check if segment has content (recursively check children too)
                const hasDirectContent = seg.content && seg.content.length > 0
                const hasChildContent = seg.children && Array.isArray(seg.children) && 
                  seg.children.some((child: any) => child.content && child.content.length > 0)
                return hasDirectContent || hasChildContent
              })
            }
            
            // Debug: Log what we found for this node
            console.log(`🔍 [Canvas Awareness] Content check for "${node.data.label}":`, {
              hasLegacy: hasLegacyContent,
              hasHierarchical: hasHierarchicalContent,
              hasDocData: !!node.data.document_data,
              hasStructure: !!node.data.document_data?.structure,
              structureLength: node.data.document_data?.structure?.length || 0,
              contentMapKeys: contentMapKeys.length,
              contentMapSample: contentMapKeys.length > 0 ? {
                key: contentMapKeys[0],
                hasValue: !!node.data.contentMap[contentMapKeys[0]],
                valueLength: node.data.contentMap[contentMapKeys[0]]?.length || 0
              } : null
            })
            
            return {
              id: node.id,
              name: node.data.label || node.data.name || 'Untitled',
              format: node.data.format,
              hasContent: hasLegacyContent || hasHierarchicalContent // ✅ Now always boolean
            }
          })
        
        // ✅ LLM-BASED: Use intent analysis to detect if user explicitly referenced a source document
        // Instead of brittle pattern matching, trust the LLM's reasoning
        const hasExplicitSource = intent.extractedEntities?.isExplicitSourceReference === true
        const sourceDocName = intent.extractedEntities?.sourceDocument
        
        if (existingDocs.length > 0 && !hasExplicitSource && !request.message.toLowerCase().includes('from scratch')) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `📋 I notice you have ${existingDocs.length} other document(s) on the canvas: ${existingDocs.map(d => `"${d.name}" (${d.format})`).join(', ')}`,
            type: 'thinking'
          })
          
          console.log('🔍 [Canvas Awareness] Existing docs:', existingDocs)
          
          // ✅ SIMPLIFIED: Don't check for content (nodes don't have it loaded)
          // Just ask when creating a DIFFERENT format than what exists
          const differentFormats = existingDocs.filter(d => d.format !== request.documentFormat)
          
          console.log('🔍 [Canvas Awareness] Different format docs:', differentFormats)
          
          if (differentFormats.length > 0) {
            const docNames = differentFormats.map(d => `"${d.name}" (${d.format})`).join(', ')
            
            console.log('✅ [Canvas Awareness] Requesting clarification - different formats exist!')
            
            // Build options: one for each existing format + "create new"
            const options = [
              ...differentFormats.map((doc, idx) => ({
                id: `use_${doc.id}`,
                label: `Base it on ${doc.format}`,
                description: `Use "${doc.name}" as inspiration`
              })),
              { 
                id: 'create_new', 
                label: 'Create something new', 
                description: 'Start from scratch' 
              }
            ]
            
            // Build message with numbered list
            const optionsList = options.map((opt, idx) => `${idx + 1}. ${opt.label} - ${opt.description}`).join('\n')
            
            actions.push({
              type: 'request_clarification',
              payload: {
                originalAction: 'create_structure',
                message: `I see you already have ${differentFormats.map(d => d.format).join(' and ')} on the canvas (${docNames}).\n\nWould you like me to:\n\n${optionsList}\n\nWhat's your preference?`,
                options,
                documentFormat: request.documentFormat,
                userMessage: request.message,
                existingDocs: differentFormats
              },
              status: 'pending'
            })
            
            this.blackboard.addMessage({
              role: 'orchestrator',
              content: '❓ Requesting user clarification before proceeding...',
              type: 'decision'
            })
            
            console.log('🔙 [Canvas Awareness] Returning early with clarification action')
            console.log('   Actions count:', actions.length)
            console.log('   Actions types:', actions.map(a => a.type))
            
            // ✅ CRITICAL: Return early to prevent further action generation
            return actions
          } else {
            console.log('⚠️ [Canvas Awareness] Same format or no conflicts, continuing with generation')
          }
        }
        
        // Import structured output helper
        const { getModelsWithStructuredOutput, supportsStructuredOutput } = await import('./modelRouter')
        
        // PREFER models with full structured output support
        let availableModels = MODEL_TIERS.filter(m => 
          request.availableProviders?.includes(m.provider) && 
          m.tier === 'frontier' &&
          m.structuredOutput === 'full' // Prioritize full structured output
        )
        
        // Fallback: If no frontier models with full support, allow json-mode
        if (availableModels.length === 0) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: '⚠️ No frontier models with full structured output, trying json-mode...',
            type: 'thinking'
          })
          
          availableModels = MODEL_TIERS.filter(m => 
            request.availableProviders?.includes(m.provider) && 
            m.tier === 'frontier' &&
            m.structuredOutput !== 'none'
          )
        }
        
        // Third fallback: Any frontier model
        if (availableModels.length === 0) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: '⚠️ Falling back to any available frontier model',
            type: 'thinking'
          })
          
          availableModels = MODEL_TIERS.filter(m => 
            request.availableProviders?.includes(m.provider) && 
            m.tier === 'frontier'
          )
        }
        
        // ✅ FINAL FALLBACK: Accept premium/standard models with reasoning + structured output
        // This handles cases where user only has premium models (e.g., gpt-4o)
        if (availableModels.length === 0) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: '⚠️ No frontier models - using best available premium/standard model',
            type: 'thinking'
          })
          
          availableModels = MODEL_TIERS.filter(m => 
            request.availableProviders?.includes(m.provider) && 
            m.reasoning && 
            m.structuredOutput !== 'none'
          ).sort((a, b) => {
            // Sort by tier: frontier > premium > standard > fast
            const tierOrder: Record<string, number> = { frontier: 4, premium: 3, standard: 2, fast: 1 }
            return (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0)
          })
        }
        
        if (availableModels.length === 0) {
          throw new Error('No reasoning models with structured output available for structure generation')
        }
        
        const selectedModel = availableModels[0]
        const structuredSupportLabel = selectedModel.structuredOutput === 'full' 
          ? '✅ Full structured output' 
          : selectedModel.structuredOutput === 'json-mode'
          ? '⚠️ JSON mode (basic)'
          : '❌ No structured output'
        
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `🎯 Using ${selectedModel.displayName} (${structuredSupportLabel})`,
          type: 'decision'
        })
        
        // PHASE 3: Extract content from referenced document (if "based on X")
        // ✅ LLM-BASED: Use intent analysis to determine if user wants to base new content on existing
        let enhancedPrompt = request.message
        
        if (hasExplicitSource && sourceDocName) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `📚 LLM detected explicit source reference: "${sourceDocName}"`,
            type: 'thinking'
          })
          
          // Find the referenced document using LLM's extracted entity
          // The LLM should have identified which document the user is referring to
          const referencedDoc = canvasContext.allNodes.find(n => {
            const labelMatch = n.label.toLowerCase().includes(sourceDocName.toLowerCase()) ||
                              sourceDocName.toLowerCase().includes(n.label.toLowerCase())
            const isStoryNode = n.nodeType === 'story-structure' || n.nodeType === 'storyStructureNode'
            return labelMatch && isStoryNode
          })
          
          if (referencedDoc) {
            console.log('🔍 [Structure Generation] Found referenced document:', referencedDoc.label)
            
            // ✅ NEW: For REPORTS, ask what KIND of report before proceeding
            if (request.documentFormat === 'report' || request.documentFormat?.startsWith('report_')) {
              const sourceFormat = referencedDoc.detailedContext?.format
              
              // Only ask if we haven't already selected a specific report subtype
              if (request.documentFormat === 'report' && sourceFormat) {
                console.log('📋 [Structure Generation] Recommending report types for source:', sourceFormat)
                
                // Import helper
                const { recommendReportType } = await import('@/lib/documentHierarchy')
                const recommendations = recommendReportType(sourceFormat)
                
                this.blackboard.addMessage({
                  role: 'orchestrator',
                  content: `📊 I found "${referencedDoc.label}" (${sourceFormat}). I can create several types of reports based on this content.`,
                  type: 'thinking'
                })
                
                this.blackboard.addMessage({
                  role: 'orchestrator',
                  content: `🎯 Recommending: ${recommendations[0].label}`,
                  type: 'decision'
                })
                
                // Return clarification to ask user which report type
                return [{
                  type: 'request_clarification',
                  payload: {
                    message: `I can create several types of reports based on the ${sourceFormat}.\n\nWhich would you prefer?`,
                    options: recommendations.map(rec => ({
                      id: rec.id,
                      label: rec.label,
                      description: rec.description
                    })),
                    originalAction: 'create_structure',
                    documentFormat: request.documentFormat, // Store original format
                    sourceDocumentId: referencedDoc.nodeId,
                    sourceDocumentLabel: referencedDoc.label,
                    sourceDocumentFormat: sourceFormat,
                    reportTypeRecommendations: recommendations // Store for later use
                  },
                  status: 'pending'
                }]
              }
            }
            
            // Strategy 1: Try RAG if embeddings exist
            try {
              const statusResponse = await fetch(`/api/embeddings/generate?nodeId=${referencedDoc.nodeId}`)
              if (statusResponse.ok) {
                const embeddingStatus = await statusResponse.json()
                
                if (embeddingStatus.exists && embeddingStatus.queueStatus === 'completed') {
                  console.log('✅ [Structure Generation] Embeddings found, using RAG')
                  this.blackboard.addMessage({
                    role: 'orchestrator',
                    content: '🔍 Using semantic search to extract relevant content...',
                    type: 'progress'
                  })
                  
                  // Perform semantic search
                  const searchResponse = await fetch('/api/embeddings/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      query: request.message,
                      matchThreshold: 0.3,
                      matchCount: 15,
                      nodeId: referencedDoc.nodeId,
                      includeMetadata: true,
                    })
                  })
                  
                  if (searchResponse.ok) {
                    const searchResult = await searchResponse.json()
                    const { buildContextFromResults } = await import('@/lib/embeddings/retrievalService')
                    const ragContent = buildContextFromResults(searchResult.results, {
                      includeMetadata: true,
                      includeSimilarity: false,
                      maxTotalTokens: 6000
                    })
                    
                    enhancedPrompt = `${request.message}

**Source Material (from "${referencedDoc.label}"):**

${ragContent}

Use this content to inform the ${request.documentFormat} structure and analysis.`
                    
                    this.blackboard.addMessage({
                      role: 'orchestrator',
                      content: `✅ Retrieved ${searchResult.results.length} relevant sections via semantic search`,
                      type: 'result'
                    })
                  }
                } else {
                  console.log('⚠️ [Structure Generation] No embeddings, falling back to summaries')
                  throw new Error('No embeddings - use summaries')
                }
              } else {
                throw new Error('Embedding status check failed')
              }
            } catch (ragError) {
              // Strategy 2: Fall back to summaries from document_data
              console.log('📝 [Structure Generation] Using summaries as fallback')
              this.blackboard.addMessage({
                role: 'orchestrator',
                content: '📝 Using document summaries (no embeddings yet)...',
                type: 'progress'
              })
              
              if (referencedDoc.detailedContext?.documentData?.structure) {
                const summaries = this.extractAllSummaries(referencedDoc.detailedContext.documentData)
                
                if (summaries.length > 0) {
                  const summaryText = summaries.map(s => `**${s.name}**: ${s.summary}`).join('\n\n')
                  
                  enhancedPrompt = `${request.message}

**Source Material Overview (from "${referencedDoc.label}"):**

${summaryText}

Use this content overview to inform the ${request.documentFormat} structure and analysis.`
                  
                  this.blackboard.addMessage({
                    role: 'orchestrator',
                    content: `✅ Extracted ${summaries.length} section summaries`,
                    type: 'result'
                  })
                } else {
                  this.blackboard.addMessage({
                    role: 'orchestrator',
                    content: '⚠️ Source document has no summaries or content yet',
                    type: 'warning'
                  })
                }
              }
            }
          }
        }
        
        // PHASE 4: Generate structure plan with automatic fallback
        // ✅ FIX: Use the full availableModels list from request (models user actually has)
        // Filter to reasoning models with structured output for fallback attempts
        const allAvailableModels = (request.availableModels || MODEL_TIERS).filter(m => 
          request.availableProviders?.includes(m.provider) &&
          m.reasoning &&
          m.structuredOutput !== 'none'
        )
        
        let plan
        try {
          plan = await this.createStructurePlanWithFallback(
            enhancedPrompt, // Use enhanced prompt with content!
            request.documentFormat,
            selectedModel.id,
            request.userKeyId,
            allAvailableModels, // Pass ALL models for fallback (not just frontier)
            3 // Max retries
          )
          
          console.log('✅ [create_structure] Plan generated successfully:', {
            structureCount: plan.structure.length,
            tasksCount: plan.tasks.length,
            totalWordCount: plan.metadata?.totalWordCount
          })
        } catch (planError) {
          console.error('❌ [create_structure] Failed to generate plan:', planError)
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `❌ Failed to generate structure: ${planError instanceof Error ? planError.message : 'Unknown error'}`,
            type: 'error'
          })
          
          // Return error action instead of throwing
          actions.push({
            type: 'message',
            payload: {
              content: `I encountered an error while generating the structure: ${planError instanceof Error ? planError.message : 'Unknown error'}. Please try again.`,
              type: 'error'
            },
            status: 'failed'
          })
          break
        }
        
        // Return as action
        actions.push({
          type: 'generate_structure',
          payload: {
            plan,
            format: request.documentFormat,
            prompt: request.message
          },
          status: 'completed'
        })
        
        console.log('✅ [create_structure] Action pushed to actions array')
        
        // 🚀 PHASE 3: LLM-POWERED MULTI-STEP TASK DETECTION
        // Use reasoning instead of hard-coded patterns
        const taskAnalysis = await this.analyzeTaskComplexity(
          request.message,
          plan.structure,
          intent,
          this.blackboard
        )
        
        if (taskAnalysis.requiresMultipleSteps && taskAnalysis.targetSections.length > 0) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `🎯 Multi-step task detected: ${taskAnalysis.reasoning}`,
            type: 'decision'
          })
          
          console.log('✅ [create_structure] LLM detected multi-step task:', taskAnalysis.reasoning)
          console.log('   Target sections:', taskAnalysis.targetSections.map(s => s.name))
          
          // Add generate_content actions for each target section
          for (const section of taskAnalysis.targetSections) {
            const contentAction: OrchestratorAction = {
              type: 'generate_content',
              payload: {
                sectionId: section.id,
                sectionName: section.name,
                prompt: `Write engaging content for "${section.name}" based on the user's request: ${request.message}`,
                autoStart: true
              },
              status: 'pending'
            }
            
            actions.push(contentAction)
            console.log(`✅ [create_structure] Added content generation for: ${section.name}`)
          }
        } else {
          console.log('ℹ️ [create_structure] Single-step task (structure only):', taskAnalysis.reasoning)
        }
        
        break
      }
      
      case 'open_and_write': {
        // Try to detect the node type from the message
        const lowerMessage = request.message.toLowerCase()
        let targetType: string | null = null
        
        // Extract node type from message
        if (lowerMessage.includes('novel')) targetType = 'novel'
        else if (lowerMessage.includes('screenplay')) targetType = 'screenplay'
        else if (lowerMessage.includes('report')) targetType = 'report'
        else if (lowerMessage.includes('podcast')) targetType = 'podcast'
        
        // Resolve which specific node to open
        const targetNode = await resolveNode(request.message, canvasContext, this.blackboard)
        
        // Search ALL nodes on canvas (not just connected ones)
        let candidateNodes = canvasContext.allNodes
        if (targetType) {
          // For story-structure nodes, check the format field (novel, screenplay, etc.)
          // For other nodes, check the nodeType directly
          candidateNodes = candidateNodes.filter(n => {
            if (n.nodeType === 'story-structure') {
              return n.detailedContext?.format?.toLowerCase() === targetType
            }
            return n.nodeType.toLowerCase() === targetType
          })
        } else if (targetNode) {
          // Fall back to using the resolved node's type
          candidateNodes = candidateNodes.filter(n => n.nodeType.toLowerCase() === targetNode.nodeType.toLowerCase())
        }
        
        console.log('📂 [open_and_write] Search results:', {
          targetType,
          allNodesCount: canvasContext.allNodes.length,
          candidatesCount: candidateNodes.length,
          candidates: candidateNodes.map(n => ({ 
            label: n.label, 
            type: n.nodeType, 
            format: n.detailedContext?.format 
          }))
        })
        
        if (candidateNodes.length === 0) {
          // No matching nodes found
          actions.push({
            type: 'message',
            payload: {
              content: `I couldn't find any ${targetType || 'matching'} nodes. Could you be more specific?`,
              type: 'error'
            },
            status: 'pending'
          })
        } else if (candidateNodes.length === 1) {
          // Single match - proceed with opening
          actions.push({
            type: 'open_document',
            payload: {
              nodeId: candidateNodes[0].nodeId,
              sectionId: null
            },
            status: 'pending'
          })
        } else {
          // Multiple matches - request clarification with options
          const options = candidateNodes.map(n => {
            const wordCount = n.detailedContext?.wordsWritten || 0
            return {
              id: n.nodeId,
              label: n.label,
              description: `${wordCount.toLocaleString()} words`
            }
          })
          
          actions.push({
            type: 'request_clarification',
            payload: {
              message: `🤔 I found ${candidateNodes.length} ${targetType || candidateNodes[0].nodeType} node(s). Which one would you like to open?`,
              originalAction: 'open_and_write',
              options
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'delete_node': {
        // Try to detect the node type from the message
        const lowerMessage = request.message.toLowerCase()
        let targetType: string | null = null
        
        // Extract node type from message
        if (lowerMessage.includes('novel')) targetType = 'novel'
        else if (lowerMessage.includes('screenplay')) targetType = 'screenplay'
        else if (lowerMessage.includes('report')) targetType = 'report'
        else if (lowerMessage.includes('podcast')) targetType = 'podcast'
        
        // Resolve which specific node to delete
        const targetNode = await resolveNode(request.message, canvasContext, this.blackboard)
        
        // Search ALL nodes on canvas (not just connected ones)
        let candidateNodes = canvasContext.allNodes
        if (targetType) {
          // For story-structure nodes, check the format field (novel, screenplay, etc.)
          // For other nodes, check the nodeType directly
          candidateNodes = candidateNodes.filter(n => {
            if (n.nodeType === 'story-structure') {
              return n.detailedContext?.format?.toLowerCase() === targetType
            }
            return n.nodeType.toLowerCase() === targetType
          })
        } else if (targetNode) {
          // Fall back to using the resolved node's type
          candidateNodes = candidateNodes.filter(n => n.nodeType.toLowerCase() === targetNode.nodeType.toLowerCase())
        }
        
        console.log('🗑️ [delete_node] Search results:', {
          targetType,
          allNodesCount: canvasContext.allNodes.length,
          candidatesCount: candidateNodes.length,
          candidates: candidateNodes.map(n => ({ 
            label: n.label, 
            type: n.nodeType, 
            format: n.detailedContext?.format 
          }))
        })
        
        if (candidateNodes.length === 0) {
          // No matching nodes found
          actions.push({
            type: 'message',
            payload: {
              content: `I couldn't find any ${targetType || 'matching'} nodes. Could you be more specific?`,
              type: 'error'
            },
            status: 'pending'
          })
        } else if (candidateNodes.length === 1) {
          // Single match - proceed with deletion
          actions.push({
            type: 'delete_node',
            payload: {
              nodeId: candidateNodes[0].nodeId,
              nodeName: candidateNodes[0].label
            },
            status: 'pending'
          })
        } else {
          // Multiple matches - request clarification with options
          const options = candidateNodes.map(n => {
            const wordCount = n.detailedContext?.wordsWritten || 0
            return {
              id: n.nodeId,
              label: n.label,
              description: `${wordCount.toLocaleString()} words`
            }
          })
          
          actions.push({
            type: 'request_clarification',
            payload: {
              message: `🤔 I found ${candidateNodes.length} ${targetType || candidateNodes[0].nodeType} node(s). Which one would you like to remove?`,
              originalAction: 'delete_node',
              options
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'navigate_section': {
        // User wants to navigate to a section within the current open document
        const lowerMessage = request.message.toLowerCase()
        
        // Extract section identifier (chapter number, section name, etc.)
        let targetSectionId: string | null = null
        let targetSectionName: string | null = null
        
        if (request.structureItems && request.structureItems.length > 0) {
          // Try to match by chapter/section/scene/beat number
          const numberMatch = lowerMessage.match(/(chapter|section|scene|act|part|sequence|beat)\s+(\d+)/i)
          if (numberMatch) {
            const sectionType = numberMatch[1].toLowerCase()
            const sectionNumber = parseInt(numberMatch[2])
            
            console.log('🔍 [navigate_section] Searching for:', { sectionType, sectionNumber })
            
            // Find section by number and type
            const findByNumber = (items: any[], type: string, num: number, count: { value: number }): any => {
              for (const item of items) {
                const itemName = item.name?.toLowerCase() || ''
                // Match by type keyword in name
                if (itemName.includes(type)) {
                  count.value++
                  console.log(`  Checking: "${item.name}" (count: ${count.value}, target: ${num})`)
                  if (count.value === num) {
                    return item
                  }
                }
                if (item.children) {
                  const found = findByNumber(item.children, type, num, count)
                  if (found) return found
                }
              }
              return null
            }
            
            const counter = { value: 0 }
            const foundSection = findByNumber(request.structureItems, sectionType, sectionNumber, counter)
            if (foundSection) {
              targetSectionId = foundSection.id
              targetSectionName = foundSection.name
              console.log('✅ [navigate_section] Found by number:', foundSection.name)
            }
          }
          
          // If number matching failed, try short forms with optional prefix ("scene 1", "go to scene 1", "open beat 2")
          if (!targetSectionId) {
            const shortMatch = lowerMessage.match(/(?:go to |jump to |open |show |navigate to )?(scene|beat|chapter|section)\s+(\d+)/i)
            if (shortMatch) {
              const type = shortMatch[1].toLowerCase()
              const num = parseInt(shortMatch[2])
              
              console.log('🔍 [navigate_section] Short form search:', { type, num })
              
              const findByType = (items: any[]): any => {
                let count = 0
                for (const item of items) {
                  const itemName = item.name?.toLowerCase() || ''
                  if (itemName.includes(type)) {
                    count++
                    console.log(`  Checking: "${item.name}" (count: ${count}, target: ${num})`)
                    if (count === num) return item
                  }
                  if (item.children) {
                    const found = findByType(item.children)
                    if (found) return found
                  }
                }
                return null
              }
              
              const foundSection = findByType(request.structureItems)
              if (foundSection) {
                targetSectionId = foundSection.id
                targetSectionName = foundSection.name
                console.log('✅ [navigate_section] Found by short form:', foundSection.name)
              }
            }
          }
          
          // If number matching failed, try name matching
          if (!targetSectionId) {
            const namePattern = /(chapter|section|scene|act|part|sequence|beat)\s+\d+:?\s*(.+?)$/i
            const nameMatch = lowerMessage.match(namePattern)
            
            if (nameMatch && nameMatch[2]) {
              const searchTerm = nameMatch[2].trim().toLowerCase()
              
              // Use same fuzzy matching as write_content
              const normalizeText = (text: string) => 
                text
                  .toLowerCase()
                  .replace(/^\d+\.?\d*\s*/, '')
                  .replace(/&/g, 'and')
                  .replace(/[^\w\s]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
              
              const normalizedSearch = normalizeText(searchTerm)
              
              const findByName = (items: any[], term: string): any => {
                for (const item of items) {
                  const normalizedName = normalizeText(item.name || '')
                  
                  if (normalizedName === normalizedSearch || 
                      normalizedName.includes(normalizedSearch) || 
                      normalizedSearch.includes(normalizedName)) {
                    return item
                  }
                  if (item.children) {
                    const found = findByName(item.children, term)
                    if (found) return found
                  }
                }
                return null
              }
              
              const foundSection = findByName(request.structureItems, searchTerm)
              if (foundSection) {
                targetSectionId = foundSection.id
                targetSectionName = foundSection.name
              }
            }
          }
        }
        
        console.log('🧭 [navigate_section] Search results:', {
          message: request.message,
          targetSectionId,
          targetSectionName,
          hasStructure: !!request.structureItems?.length
        })
        
        if (targetSectionId) {
          // Found the section - navigate to it
          actions.push({
            type: 'select_section',
            payload: {
              sectionId: targetSectionId,
              sectionName: targetSectionName
            },
            status: 'pending'
          })
        } else {
          // Could not find the section
          actions.push({
            type: 'message',
            payload: {
              content: `I couldn't find that section. Could you be more specific about which section you want to navigate to?`,
              type: 'error'
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
    
    // 🔍 DEBUG: Log final actions before returning
    console.log('🔍 [generateActions] Returning actions:', {
      count: actions.length,
      types: actions.map(a => a.type),
      details: actions.map(a => ({
        type: a.type,
        sectionId: a.payload?.sectionId,
        sectionName: a.payload?.sectionName
      }))
    })
    
    return actions
  }
  
  /**
   * PHASE 3: LLM-powered task complexity analysis
   * Replaces hard-coded regex patterns with reasoning
   */
  private async analyzeTaskComplexity(
    userMessage: string,
    structure: any[],
    intent: IntentAnalysis,
    blackboard: Blackboard
  ): Promise<{
    requiresMultipleSteps: boolean
    targetSections: Array<{ id: string; name: string }>
    reasoning: string
  }> {
    const systemPrompt = `You are an intelligent task analyzer. Analyze user requests to determine if they want multiple steps completed.

Context:
- Primary intent: ${intent.intent}
- User's request: "${userMessage}"
- Available structure sections: ${structure.map(s => `"${s.name}"`).join(', ')}

Determine:
1. Does the user want BOTH structure creation AND content writing?
2. If so, which section(s) should have content generated?

Examples:
- "Create a story about X" → Single step (structure only)
- "Create a story and write the first chapter" → Multi-step (structure + Chapter 1 content)
- "Write the first two chapters" → Multi-step (structure + Chapters 1 & 2)
- "Create outline with content in introduction" → Multi-step (structure + Introduction content)

Respond in JSON format:
{
  "requiresMultipleSteps": boolean,
  "targetSectionNames": string[], // Section names to generate content for
  "reasoning": "Brief explanation of your analysis"
}`

    try {
      const response = await fetch('/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: userMessage,
          temperature: 0.2 // Low temp for consistent analysis
        })
      })

      if (!response.ok) {
        throw new Error(`Task analysis failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Parse JSON with better error handling
      let analysis: any
      try {
        // Try to parse content directly
        if (typeof data.content === 'object') {
          analysis = data.content
        } else if (typeof data.content === 'string') {
          // Extract JSON from markdown code blocks if present
          let jsonContent = data.content.trim()
          const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
          if (jsonMatch) {
            jsonContent = jsonMatch[1].trim()
          }
          
          // Remove any leading/trailing non-JSON content
          const jsonStart = jsonContent.indexOf('{')
          const jsonEnd = jsonContent.lastIndexOf('}')
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
          }
          
          analysis = JSON.parse(jsonContent)
        } else {
          throw new Error('Invalid response format')
        }
      } catch (parseError: any) {
        console.error('❌ [Task Analysis] JSON parse error:', parseError.message)
        console.error('   Content:', typeof data.content === 'string' ? data.content.substring(0, 500) : data.content)
        throw new Error(`Failed to parse task analysis: ${parseError.message}`)
      }
      
      // Map section names to actual section objects
      const targetSections = analysis.targetSectionNames
        .map((name: string) => {
          // Normalize and find matching section
          const normalizedSearchTerm = name.toLowerCase().trim()
          return structure.find(s => 
            s.name.toLowerCase().includes(normalizedSearchTerm) ||
            normalizedSearchTerm.includes(s.name.toLowerCase())
          )
        })
        .filter(Boolean) // Remove null matches
      
      return {
        requiresMultipleSteps: analysis.requiresMultipleSteps,
        targetSections,
        reasoning: analysis.reasoning
      }
    } catch (error) {
      console.error('❌ [Task Analysis] Error:', error)
      
      // Fallback: Conservative single-step approach
      return {
        requiresMultipleSteps: false,
        targetSections: [],
        reasoning: 'Analysis failed, defaulting to structure-only mode'
      }
    }
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
  
  /**
   * Extract all summaries from a hierarchical document structure
   */
  private extractAllSummaries(documentData: any): Array<{name: string; summary: string}> {
    const summaries: Array<{name: string; summary: string}> = []
    
    function traverse(segments: any[], depth: number = 0) {
      for (const seg of segments) {
        if (seg.summary && seg.summary.trim().length > 0) {
          // Include the segment's name and summary
          const name = seg.title || seg.name || `Section ${seg.order || ''}`
          summaries.push({ 
            name: name,
            summary: seg.summary 
          })
        }
        
        // Recursively traverse children
        if (seg.children && Array.isArray(seg.children) && seg.children.length > 0) {
          traverse(seg.children, depth + 1)
        }
      }
    }
    
    if (documentData?.structure && Array.isArray(documentData.structure)) {
      traverse(documentData.structure)
    }
    
    return summaries
  }
  
  private buildRAGEnhancedPrompt(ragContext: any, canvasContext: CanvasContext): string {
    let prompt = formatCanvasContextForLLM(canvasContext)
    
    if (ragContext.hasRAG && ragContext.ragContent) {
      prompt += `\n\nRelevant Content (from semantic search):\n${ragContext.ragContent}`
    }
    
    return prompt
  }

  /**
   * PHASE 3: Retry wrapper for createStructurePlan with automatic fallback
   * Attempts to generate structure with primary model, falls back to alternatives if it fails
   */
  private async createStructurePlanWithFallback(
    userPrompt: string,
    format: string,
    primaryModelId: string,
    userKeyId: string,
    availableModels: TieredModel[],
    maxRetries: number = 3
  ): Promise<StructurePlan> {
    const attemptedModels: string[] = []
    let lastError: Error | null = null
    
    // Filter to reasoning models only (for structure generation)
    const reasoningModels = availableModels
      .filter(m => m.reasoning)
      .sort((a, b) => {
        // Sort by tier: frontier > premium > standard > fast
        const tierOrder: Record<string, number> = { frontier: 4, premium: 3, standard: 2, fast: 1 }
        return (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0)
      })
    
    // ✅ FIX: Only use primaryModelId if it's actually available to the user!
    const isPrimaryAvailable = reasoningModels.some(m => m.id === primaryModelId)
    
    const modelsToTry = isPrimaryAvailable 
      ? [primaryModelId, ...reasoningModels.map(m => m.id).filter(id => id !== primaryModelId)]
      : reasoningModels.map(m => m.id) // Skip primaryModelId if user doesn't have access
    
    console.log(`🔄 [Fallback] Primary model: ${primaryModelId} (available: ${isPrimaryAvailable})`)
    console.log(`🔄 [Fallback] Models to try: ${modelsToTry.join(', ')}`)
    
    for (let i = 0; i < Math.min(modelsToTry.length, maxRetries); i++) {
      const modelId = modelsToTry[i]
      attemptedModels.push(modelId)
      
      try {
        // Log which model we're attempting
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: i === 0 
            ? `🎯 Attempting structure generation with ${modelId}...`
            : `🔄 Retrying with ${modelId} (attempt ${i + 1}/${maxRetries})...`,
          type: 'progress'
        })
        
        const result = await this.createStructurePlan(userPrompt, format, modelId, userKeyId)
        
        // Success!
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: i === 0
            ? `✅ Structure generated successfully with ${modelId}`
            : `✅ Structure generation succeeded with ${modelId} after ${i} ${i === 1 ? 'retry' : 'retries'}`,
          type: 'result'
        })
        
        return result
      } catch (error: any) {
        lastError = error
        const errorReason = this.extractErrorReason(error)
        
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ Attempt ${i + 1} failed (${modelId}): ${errorReason}`,
          type: 'warning'
        })
        
        console.warn(`❌ [Fallback] Attempt ${i + 1} failed with ${modelId}:`, errorReason)
        
        // If this was the last attempt, throw
        if (i === Math.min(modelsToTry.length, maxRetries) - 1) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `❌ All ${attemptedModels.length} model(s) failed. Last error: ${errorReason}`,
            type: 'error'
          })
          throw new Error(`Structure generation failed after ${attemptedModels.length} attempts. Last error: ${errorReason}`)
        }
      }
    }
    
    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Structure generation failed')
  }
  
  /**
   * PHASE 3: Extract human-readable error reason from API error
   */
  private extractErrorReason(error: any): string {
    const message = error.message || ''
    
    if (message.includes('insufficient_quota') || message.includes('quota')) {
      return 'Insufficient credits'
    }
    if (message.includes('does not exist') || message.includes('not found')) {
      return 'Model not available'
    }
    if (message.includes('rate_limit') || message.includes('429')) {
      return 'Rate limit exceeded'
    }
    if (message.includes('authentication') || message.includes('401')) {
      return 'Invalid API key'
    }
    if (message.includes('access') || message.includes('permission')) {
      return 'No access to this model'
    }
    if (message.includes('500')) {
      return 'Server error (model might not be available)'
    }
    
    return message.substring(0, 100) // Truncate long messages
  }

  /**
   * Generate structure plan for create_structure intent
   * Uses native structured outputs when available
   */
  private async createStructurePlan(
    userPrompt: string,
    format: string,
    modelId: string,
    userKeyId: string
  ): Promise<StructurePlan> {
    // Progress tracking
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: '🔄 Step 1/4: Initializing structure generation...',
      type: 'progress'
    })
    
    // Check if model supports structured outputs
    const model = MODEL_TIERS.find(m => m.id === modelId)
    const useStructuredOutput = model?.structuredOutput === 'full'
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔄 Step 2/4: Preparing ${useStructuredOutput ? '✅ structured output' : '⚠️ JSON parsing'} format...`,
      type: 'progress'
    })
    
    // Import schema utilities
    const { getOpenAIResponseFormat, getAnthropicToolDefinition, validateStructurePlan } = await import('../schemas/structurePlan')
    
    // Build format-specific instructions
    const formatInstructions = this.getFormatInstructions(format)
    
    // Add critical instructions for reports to avoid screenplay structure
    const reportWarning = format.startsWith('report') ? `

🚨 CRITICAL FOR REPORTS:
- DO NOT use Act/Sequence/Scene structure (that's for screenplays!)
- DO NOT create "2.0 Global Story Structure" or "3.0 Act I Analysis" sections
- DO extract and ANALYZE actual content from the source material
- DO use proper report structure: Executive Summary → Main Sections (1.0, 2.0) → Subsections (1.1, 1.2)
- DO focus on insights, themes, findings, and recommendations - NOT meta-analysis of structure
- If analyzing a screenplay: Extract plot, characters, dialogue quality, marketability
- If analyzing a podcast: Extract themes, insights, key takeaways
- If analyzing a novel: Extract literary elements, character development, themes
` : ''
    
    const systemPrompt = `You are an expert story structure planner. Your role is to analyze creative prompts and create detailed, hierarchical structures optimized for the requested format.

${formatInstructions}${reportWarning}

Generate a complete structure plan with:
- Concise reasoning (max 1000 characters)
- 3-20 hierarchical structure items with clear parent-child relationships
- Realistic word count estimates for each section
- Specific writing tasks (minimum 1)
- Metadata with total word count, estimated time, and recommended models (REQUIRED)`

    const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/-/g, ' ')
    const userMessage = `The user wants to create a ${formatLabel}.\n\nUser's creative prompt:\n${userPrompt}\n\nAnalyze this prompt and create a detailed structure plan optimized for the ${formatLabel} format.`
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔄 Step 3/4: Calling ${model?.displayName || modelId}...`,
      type: 'progress'
    })
    
    // Call generation API with structured output if supported
    const requestBody: any = {
      mode: 'orchestrator',
      model: modelId,
      system_prompt: systemPrompt,
      user_prompt: userMessage,
      max_completion_tokens: 4000,
      user_key_id: userKeyId,
      stream: false
    }
    
    // Add structured output format based on provider
    if (useStructuredOutput && model) {
      if (model.provider === 'openai') {
        requestBody.response_format = getOpenAIResponseFormat()
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using OpenAI native JSON schema validation',
          type: 'thinking'
        })
      } else if (model.provider === 'anthropic') {
        requestBody.tools = [getAnthropicToolDefinition()]
        requestBody.tool_choice = { type: 'tool', name: 'create_structure_plan' }
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using Anthropic tool use (forced)',
          type: 'thinking'
        })
      } else if (model.provider === 'google') {
        // Google function calling will be handled in the API route
        requestBody.use_function_calling = true
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using Google function calling',
          type: 'thinking'
        })
      }
    } else if (model?.structuredOutput === 'json-mode') {
      requestBody.response_format = { type: 'json_object' }
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: '⚠️ Using JSON mode (no schema validation)',
        type: 'thinking'
      })
    }
    
    // Add timeout and progress heartbeat for long-running API calls
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout
    
    // Heartbeat: Show "still waiting..." every 5 seconds
    const heartbeat = setInterval(() => {
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: '⏳ Still generating structure, please wait...',
        type: 'progress'
      })
    }, 5000)
    
    let response: Response
    try {
      response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      })
      
      clearTimeout(timeout)
      clearInterval(heartbeat)
      
      if (!response.ok) {
        const errorData = await response.json()
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ Structure generation failed: ${errorData.error}`,
          type: 'error'
        })
        throw new Error(errorData.error || 'Structure generation API call failed')
      }
    } catch (error: any) {
      clearTimeout(timeout)
      clearInterval(heartbeat)
      
      if (error.name === 'AbortError') {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '❌ Structure generation timed out after 60 seconds',
          type: 'error'
        })
        throw new Error('Structure generation timed out - please try again')
      }
      throw error
    }
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: '🔄 Step 4/4: Validating structure plan...',
      type: 'progress'
    })
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: '🔄 Step 4/4: Validating structure plan...',
      type: 'progress'
    })
    
    const data = await response.json()
    
    // DEBUG: Log to console what we actually received
    console.log('🔍 [Structure Generation] API Response:', {
      keys: Object.keys(data),
      fullData: data, // Show everything
      hasContent: !!data.content,
      hasStructuredOutput: !!data.structured_output,
      contentType: typeof data.content,
      contentPreview: typeof data.content === 'string' ? data.content.substring(0, 200) : data.content
    })
    
    let planData: any
    
    // Log what we received for debugging
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `📦 Received response with keys: ${Object.keys(data).join(', ')}`,
      type: 'thinking'
    })
    
    // Handle different response formats
    if (useStructuredOutput) {
      // Structured output - response is already parsed JSON object
      if (model?.provider === 'anthropic' && data.tool_calls) {
        // Anthropic tool use format
        planData = data.tool_calls[0]?.input
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Extracted from Anthropic tool use',
          type: 'thinking'
        })
      } else if (data.structured_output) {
        // Unified structured output format
        planData = data.structured_output
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Received validated structured output',
          type: 'thinking'
        })
      } else if (typeof data.content === 'string') {
        // OpenAI returns JSON as string in content field
        try {
          planData = JSON.parse(data.content)
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: '✅ Parsed JSON from content string',
            type: 'thinking'
          })
        } catch (e) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `⚠️ Failed to parse content as JSON: ${e}`,
            type: 'thinking'
          })
          planData = data.content
        }
      } else if (typeof data.content === 'object') {
        // Content is already an object
        planData = data.content
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using content object directly',
          type: 'thinking'
        })
      } else {
        // Last resort fallback
        planData = data
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '⚠️ Using entire response as planData',
          type: 'thinking'
        })
      }
    } else {
      // String-based JSON - need to parse manually
      let rawContent = data.content || data.text || ''
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `📊 Received ${rawContent.length} characters, parsing...`,
        type: 'thinking'
      })
      
      // Extract JSON from markdown code blocks if present
      let jsonContent = rawContent.trim()
      
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
      }
      
      // Remove any leading/trailing non-JSON content
      const jsonStart = jsonContent.indexOf('{')
      const jsonEnd = jsonContent.lastIndexOf('}')
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
      }
      
      try {
        planData = JSON.parse(jsonContent)
      } catch (parseError: any) {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ JSON parse error: ${parseError.message}`,
          type: 'error'
        })
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `First 500 chars: ${rawContent.substring(0, 500)}`,
          type: 'thinking'
        })
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `Last 500 chars: ${rawContent.substring(Math.max(0, rawContent.length - 500))}`,
          type: 'thinking'
        })
        throw new Error(`Failed to parse JSON: ${parseError.message}`)
      }
    }
    
    // Validate with Zod schema
    const validation = validateStructurePlan(planData)
    
    if (!validation.success) {
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Validation failed: ${validation.error}`,
        type: 'error'
      })
      throw new Error(`Invalid structure plan: ${validation.error}`)
    }
    
    const plan = validation.data
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Structure plan validated: ${plan.structure.length} sections, ${plan.tasks.length} tasks`,
      type: 'result'
    })
    
    return plan
  }

  /**
   * Get format-specific instructions for structure generation
   */
  private getFormatInstructions(format: string): string {
    // Normalize format (e.g., 'short-story' -> 'short_story')
    const normalizedFormat = format.toLowerCase().replace(/-/g, '_')
    const hierarchy = getDocumentHierarchy(normalizedFormat)
    const docType = DOCUMENT_HIERARCHY.document_types[normalizedFormat]
    
    if (!hierarchy || !docType) {
      // Fallback for unknown formats
      return `For ${format.toUpperCase()} format:
- Create a logical hierarchical structure appropriate for this type of document
- Use clear parent-child relationships between sections
- Provide realistic word count estimates`
    }
    
    // Build format-specific instructions from documentHierarchy.ts
    const formatLabel = format.toUpperCase().replace(/-/g, ' ')
    let instructions = `For ${formatLabel} format:\n`
    instructions += `Description: ${docType.description}\n\n`
    instructions += `REQUIRED HIERARCHY (follow this structure exactly):\n`
    
    hierarchy.forEach((level, index) => {
      const optionalLabel = level.optional ? ' (optional)' : ' (REQUIRED)'
      instructions += `- Level ${level.level}: ${level.name}${optionalLabel}`
      if (level.description) {
        instructions += ` - ${level.description}`
      }
      instructions += '\n'
    })
    
    // Add format-specific guidance
    const wordCountGuidance: Record<string, string> = {
      'novel': '\nTarget: 60,000-100,000 words total. Chapters: 2,000-4,000 words each.',
      'short_story': '\nTarget: 1,000-7,500 words total.',
      'screenplay': '\nTarget: 90-120 pages (90-120 scenes). Each scene: 1-3 pages.',
      'report': '\nFocus on clarity, scanability, and logical flow.',
      'report_script_coverage': '\n✅ Industry standard screenplay coverage format.\nCRITICAL: Extract content from the screenplay - DO NOT just analyze its structure!\nExecutive Summary must include Pass/Consider/Recommend rating.\nLogline should be compelling one-sentence premise.\nSynopsis: 2-3 paragraph plot summary capturing key story beats.\nAnalyze actual characters, dialogue, pacing, and marketability from the screenplay content.',
      'report_business': '\nProfessional business/strategic analysis format.\nFocus on data-driven insights and actionable recommendations.\nExecutive Summary should highlight key findings up front.\nUse clear section numbering (1.0, 2.0, etc.).',
      'report_content_analysis': '\nThematic and content-focused analysis.\nExtract key themes, insights, and takeaways from the source material.\nProvide actionable recommendations for the audience.\nFocus on quality, clarity, and engagement factors.',
      'article': '\nTarget: 800-2,000 words total. Clear introduction and conclusion.',
      'essay': '\nTarget: 1,000-5,000 words. Strong thesis and supporting arguments.',
      'podcast': '\nTarget: 20-60 minutes (3,000-9,000 words). Conversational and engaging.'
    }
    
    instructions += wordCountGuidance[normalizedFormat] || ''
    
    instructions += '\n\nIMPORTANT: Only generate structure items for the FIRST 3-4 hierarchy levels. Do not include individual paragraphs, sentences, or lines in your structure plan.'
    
    return instructions
  }

  /**
   * Handle clarification response (user responding to request_clarification action)
   * Uses LLM reasoning to interpret natural language responses like "Go with the first option"
   */
  private async handleClarificationResponse(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const { clarificationContext, message } = request
    
    if (!clarificationContext) {
      throw new Error('handleClarificationResponse called without clarificationContext')
    }
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔍 Interpreting clarification response...`,
      type: 'thinking'
    })
    
    // Build context for LLM to understand which option user selected
    const optionsList = clarificationContext.options
      .map((opt, idx) => `${idx + 1}. [${opt.id}] ${opt.label} - ${opt.description}`)
      .join('\n')
    
    const systemPrompt = `You are an intelligent option selector. Parse the user's natural language response to determine which option they selected from a list.

Available options:
${optionsList}

Return ONLY the option ID (e.g., "use_podcast", "create_new", "use_screenplay") with NO additional text, explanation, or formatting.

Examples:
- User: "#1" or "1" or "first" → Return: ${clarificationContext.options[0]?.id}
- User: "Go with the first option" → Return: ${clarificationContext.options[0]?.id}
- User: "Let's use the podcast" → Return: use_podcast (if that's option 1)
- User: "Create something new" → Return: create_new`

    const userPrompt = `Original question: "${clarificationContext.question}"

User's response: "${message}"

Which option did the user select? Return ONLY the option ID.`

    try {
      // Use fast model for simple classification
      const response = await fetch('/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          temperature: 0.1 // Low temp for consistent classification
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to interpret clarification: ${response.statusText}`)
      }

      const data = await response.json()
      const selectedOptionId = data.content.trim()
      
      // Find the selected option
      const selectedOption = clarificationContext.options.find(opt => opt.id === selectedOptionId)
      
      if (!selectedOption) {
        // Fallback: Try to match by content
        const lowerMessage = message.toLowerCase()
        const fallbackOption = clarificationContext.options.find(opt =>
          lowerMessage.includes(opt.label.toLowerCase()) ||
          lowerMessage.includes(opt.id.toLowerCase()) ||
          lowerMessage.match(/^#?(\d+)$/)?.[1] === String(clarificationContext.options.indexOf(opt) + 1)
        )
        
        if (fallbackOption) {
          console.log('⚠️ [Clarification] LLM returned invalid ID, using fallback match')
          return this.buildActionFromClarification(
            clarificationContext.originalAction,
            fallbackOption,
            clarificationContext.payload,
            request
          )
        }
        
        // If still no match, return error
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ I didn't understand "${message}". Please choose by number (e.g., "1") or by name.`,
          type: 'error'
        })
        
        return {
          intent: 'general_chat',
          confidence: 0.3,
          reasoning: 'Failed to interpret clarification response',
          modelUsed: 'llama-3.1-8b-instant',
          actions: [],
          canvasChanged: false,
          requiresUserInput: true,
          estimatedCost: 0.0001
        }
      }
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Understood: "${selectedOption.label}"`,
        type: 'decision'
      })
      
      // Build appropriate action based on original action type
      return this.buildActionFromClarification(
        clarificationContext.originalAction,
        selectedOption,
        clarificationContext.payload,
        request
      )
      
    } catch (error) {
      console.error('❌ [Clarification] Error:', error)
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Error interpreting response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
      
      return {
        intent: 'general_chat',
        confidence: 0.2,
        reasoning: 'Error processing clarification response',
        modelUsed: 'none',
        actions: [],
        canvasChanged: false,
        requiresUserInput: true,
        estimatedCost: 0
      }
    }
  }

  /**
   * Build appropriate action based on clarification selection
   */
  private async buildActionFromClarification(
    originalAction: string,
    selectedOption: {id: string, label: string, description: string},
    payload: any,
    request: OrchestratorRequest
  ): Promise<OrchestratorResponse> {
    
    if (originalAction === 'create_structure') {
      const { documentFormat, userMessage, existingDocs, reportTypeRecommendations, sourceDocumentLabel, sourceDocumentFormat } = payload
      
      // ✅ NEW: Handle report type selection
      if (reportTypeRecommendations && sourceDocumentLabel) {
        const selectedReportType = reportTypeRecommendations.find((r: any) => r.id === selectedOption.id)
        
        if (selectedReportType) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `✅ Creating ${selectedReportType.label} based on "${sourceDocumentLabel}"...`,
            type: 'result'
          })
          
          // Construct enhanced prompt with report type context and explicit "based on" reference
          const enhancedPrompt = `Create a ${selectedReportType.label.toLowerCase()} based on "${sourceDocumentLabel}"`
          
          // Return create_structure intent with the specific report format
          return {
            intent: 'create_structure',
            confidence: 0.95,
            reasoning: `User selected ${selectedReportType.label} for analyzing ${sourceDocumentFormat}`,
            modelUsed: 'none',
            actions: [{
              type: 'message',
              payload: {
                content: `✅ Generating ${selectedReportType.label} structure...`,
                intent: 'create_structure',
                format: selectedReportType.formatKey, // Use the specific report format (e.g., 'report_script_coverage')
                prompt: enhancedPrompt
              },
              status: 'pending'
            }],
            canvasChanged: false,
            requiresUserInput: false,
            estimatedCost: 0
          }
        }
      }
      
      if (selectedOption.id === 'create_new') {
        // User wants to create something new (ignore existing docs)
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `✅ Creating new ${documentFormat} from scratch...`,
          type: 'result'
        })
        
        // 🔧 FIX: Return message action to trigger UI flow
        // The UI will call onCreateStory, which creates the node FIRST,
        // then calls triggerOrchestratedGeneration with the proper node ID
        console.log('✅ [Clarification] User chose create_new, returning message action')
        console.log('   Format:', documentFormat)
        console.log('   Message:', userMessage)
        console.log('   → UI will create node and trigger orchestration with node ID')
        
        return {
          intent: 'create_structure',
          confidence: 0.95,
          reasoning: `User chose to create new ${documentFormat} from scratch`,
          modelUsed: 'none',
          actions: [{
            type: 'message',
            payload: {
              content: `✅ Creating new ${documentFormat} from scratch...`,
              intent: 'create_structure',
              format: documentFormat,
              prompt: `${userMessage} from scratch` // Will trigger structure generation in triggerOrchestratedGeneration
            },
            status: 'pending'
          }],
          canvasChanged: false, // Canvas change will happen when UI executes onCreateStory
          requiresUserInput: false,
          estimatedCost: 0
        }
      } else {
        // User wants to base it on an existing doc
        const selectedDocId = selectedOption.id.replace('use_', '')
        const selectedDoc = existingDocs.find((d: any) => d.id === selectedDocId)
        
        if (selectedDoc) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `✅ Creating ${documentFormat} based on "${selectedDoc.name}" (${selectedDoc.format})...`,
            type: 'result'
          })
          
          // Return action to create structure with reference to existing doc
          const enhancedPrompt = `${userMessage} based on ${selectedDoc.name}`
          
          return {
            intent: 'create_structure',
            confidence: 0.95,
            reasoning: `User chose to base ${documentFormat} on ${selectedDoc.format}`,
            modelUsed: 'none',
            actions: [{
              type: 'message',
              payload: {
                content: `✅ Creating ${documentFormat} based on "${selectedDoc.name}"...`,
                intent: 'create_structure',
                format: documentFormat,
                prompt: enhancedPrompt,
                referenceDoc: selectedDocId
              },
              status: 'pending'
            }],
            canvasChanged: false, // Canvas change will happen when UI executes onCreateStory
            requiresUserInput: false,
            estimatedCost: 0
          }
        }
      }
    } else if (originalAction === 'open_and_write') {
      // User selected which node to open
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Opening "${selectedOption.label}"...`,
        type: 'result'
      })
      
      return {
        intent: 'open_and_write',
        confidence: 0.95,
        reasoning: `User selected node to open: ${selectedOption.label}`,
        modelUsed: 'none',
        actions: [{
          type: 'open_document',
          payload: {
            nodeId: selectedOption.id,
            sectionId: null
          },
          status: 'pending'
        }],
        canvasChanged: false,
        requiresUserInput: false,
        estimatedCost: 0
      }
    } else if (originalAction === 'delete_node') {
      // User selected which node to delete
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Deleting "${selectedOption.label}"...`,
        type: 'result'
      })
      
      return {
        intent: 'delete_node',
        confidence: 0.95,
        reasoning: `User confirmed deletion of: ${selectedOption.label}`,
        modelUsed: 'none',
        actions: [{
          type: 'delete_node',
          payload: {
            nodeId: selectedOption.id,
            nodeName: selectedOption.label
          },
          status: 'pending'
        }],
        canvasChanged: true,
        requiresUserInput: false,
        estimatedCost: 0
      }
    }
    
    // Fallback
    return {
      intent: 'general_chat',
      confidence: 0.5,
      reasoning: `Unknown original action: ${originalAction}`,
      modelUsed: 'none',
      actions: [],
      canvasChanged: false,
      requiresUserInput: false,
      estimatedCost: 0
    }
  }
}

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

const orchestrators = new Map<string, OrchestratorEngine>()

export function getOrchestrator(
  userId: string, 
  config?: Partial<OrchestratorConfig>,
  worldState?: WorldStateManager // PHASE 1: Accept WorldState
): OrchestratorEngine {
  // PHASE 1: For now, create new orchestrator each time if WorldState is provided
  // This ensures WorldState is always fresh. Later, we'll implement state updates.
  const cacheKey = userId + (worldState ? '-ws' : '')
  
  if (!orchestrators.has(cacheKey) || worldState) {
    orchestrators.set(cacheKey, new OrchestratorEngine({
      userId,
      ...config
    }, worldState)) // PHASE 1: Pass WorldState to constructor
  }
  return orchestrators.get(cacheKey)!
}

// PHASE 3: Multi-Agent Orchestrator Factory
// Import at runtime to avoid circular dependency
export function getMultiAgentOrchestrator(
  userId: string,
  config?: Partial<OrchestratorConfig>,
  worldState?: WorldStateManager
): any { // Return type is MultiAgentOrchestrator, but we avoid import here
  // Always create new instance for now (agent pool needs fresh state)
  // TODO: Implement proper caching with state updates
  const { MultiAgentOrchestrator } = require('../agents/MultiAgentOrchestrator')
  
  return new MultiAgentOrchestrator({
    userId,
    ...config
  }, worldState)
}

export function createOrchestrator(
  config: OrchestratorConfig, 
  worldState?: WorldStateManager // PHASE 1: Accept WorldState
): OrchestratorEngine {
  const orchestrator = new OrchestratorEngine(config, worldState) // PHASE 1: Pass WorldState
  orchestrators.set(config.userId, orchestrator)
  return orchestrator
}

