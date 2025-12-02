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

import { Blackboard, type ConversationMessage } from './blackboard'
import { buildCanvasContext, formatCanvasContextForLLM, type CanvasContext } from '../context/contextProvider'
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
import { analyzeIntent, type IntentAnalysis, type UserIntent } from '../context/intentRouter'
import { enhanceContextWithRAG } from '../context/ragIntegration'
import { Node, Edge } from 'reactflow'
import { filterAvailableModels } from '../utils/modelFilter'
import { extractErrorReason } from '../utils/errorUtils'
import { getFormatInstructions } from '../schemas/formatInstructions'
import { getStructureGenerationPrompt, getReportWarning } from '../prompts/structureGeneration'
// PHASE 1: WorldState - Unified state management
import type { WorldStateManager } from './worldState'
// PHASE 2: Tool System - Executable tools
import type { ToolRegistry } from '../tools'
// PHASE 1 REFACTORING: Modular action generators
import { BaseAction } from '../actions/base/BaseAction'
import { AnswerQuestionAction } from '../actions/content/AnswerQuestionAction'
import { WriteContentAction } from '../actions/content/WriteContentAction'
import { CreateStructureAction } from '../actions/structure/CreateStructureAction'
import { DeleteNodeAction } from '../actions/navigation/DeleteNodeAction'
import { OpenDocumentAction } from '../actions/navigation/OpenDocumentAction'
import { NavigateSectionAction } from '../actions/navigation/NavigateSectionAction'

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
  // ✅ FIX: Authenticated Supabase client (to avoid RLS issues in agents)
  supabaseClient?: any
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
  /**
   * Action dependencies and execution metadata
   * 
   * - dependsOn: Array of action types that must complete before this action can execute
   * - autoExecute: If true, orchestrator will automatically execute this action after dependencies are met
   * - requiresUserInput: If true, action requires user confirmation/interaction before execution
   * 
   * Example: generate_content depends on select_section and should auto-execute:
   *   { dependsOn: ['select_section'], autoExecute: true, requiresUserInput: false }
   */
  dependsOn?: string[] // Action types that must complete first
  autoExecute?: boolean // Should orchestrator execute automatically after dependencies?
  requiresUserInput?: boolean // Does this action need user confirmation?
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
  protected worldState?: WorldStateManager // PHASE 1: Optional for gradual migration (protected for child classes)
  private toolRegistry?: ToolRegistry // PHASE 2: Optional tool system
  private actionGenerators: Map<UserIntent, BaseAction> // PHASE 1 REFACTORING: Modular action generators
  
  constructor(config: OrchestratorConfig, worldState?: WorldStateManager) {
    // PHASE 3: Pass real-time message callback to Blackboard
    // ✅ FIX: Don't add to WorldState here - onAddChatMessage callback already handles it
    // The messageCallback is called by Blackboard when messages are added, and the UI's
    // onAddChatMessage callback (passed as config.onMessage) is responsible for adding
    // messages to WorldState. Adding here would cause duplicates.
    const messageCallback = config.onMessage ? (msg: any) => {
      // Call the UI callback - it will add to WorldState
      config.onMessage!(msg.content, msg.role, msg.type)
    } : undefined

    this.blackboard = new Blackboard(config.userId, messageCallback)
    this.worldState = worldState // PHASE 1: Store WorldState if provided
    
    // Connect Blackboard to WorldState (enables temporal memory logging from WorldState)
    if (worldState) {
      this.blackboard.setWorldState(worldState)
    }
    
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
    
    // PHASE 1 REFACTORING: Initialize modular action generators
    this.actionGenerators = new Map([
      ['answer_question', new AnswerQuestionAction()],
      ['write_content', new WriteContentAction()],
      ['create_structure', new CreateStructureAction(this)],
      ['delete_node', new DeleteNodeAction(this.blackboard)],
      ['open_and_write', new OpenDocumentAction(this.blackboard)],
      ['navigate_section', new NavigateSectionAction()],
      // More actions will be added as they're extracted
    ])
    
    console.log('🎯 [Orchestrator] Initialized', {
      userId: config.userId,
      priority: this.config.modelPriority,
      rag: this.config.enableRAG,
      learning: this.config.enablePatternLearning,
      hasWorldState: !!worldState, // PHASE 1: Log if using WorldState
      hasToolRegistry: !!config.toolRegistry, // PHASE 2: Log if using tools
      toolCount: config.toolRegistry?.getAll().length || 0,
      actionGeneratorsCount: this.actionGenerators.size // PHASE 1 REFACTORING: Log action generators
    })
  }
  
  /**
   * Main orchestration method
   */
  async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now()
    
    // Update WorldState: Orchestrator is starting to think
    this.worldState?.update(draft => {
      draft.orchestrator.status = 'thinking'
      draft.orchestrator.currentTask = {
        type: 'analyze_intent',
        startedAt: Date.now(),
        description: 'Analyzing user request'
      }
    })
    
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
    
    // ✅ CRITICAL FIX: Update WorldState if structureItems provided
    // This ensures agents have access to the latest structure context
    console.log('🔍 [Orchestrator] Checking WorldState update conditions:', {
      hasWorldState: !!this.worldState,
      hasStructureItems: !!request.structureItems,
      structureItemsLength: request.structureItems?.length || 0,
      hasNodeId: !!request.currentStoryStructureNodeId,
      nodeId: request.currentStoryStructureNodeId
    })
    
    // Step 1: Update WorldState (single source of truth for canvas/document state)
    if (this.worldState && request.structureItems && request.structureItems.length > 0 && request.currentStoryStructureNodeId) {
      console.log('🔄 [Orchestrator] Updating WorldState with structure items:', {
        nodeId: request.currentStoryStructureNodeId,
        format: _documentFormat || 'novel',
        itemsCount: request.structureItems.length,
        firstItemId: request.structureItems[0]?.id
      })
      this.worldState.setActiveDocument(
        request.currentStoryStructureNodeId,
        _documentFormat || 'novel',
        request.structureItems
      )
      console.log('✅ [Orchestrator] WorldState updated - agents can now access structure')
      
      // Log document update to temporal memory (Blackboard reads from WorldState)
      if (request.currentStoryStructureNodeId) {
        this.blackboard.logDocumentUpdate(request.currentStoryStructureNodeId)
      }
    } else {
      console.warn('⚠️ [Orchestrator] WorldState NOT updated - missing requirements')
    }
    
    // NOTE: Canvas/document state is now managed by WorldState only
    // Blackboard reads from WorldState for temporal memory logging
    
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
    
    // ✅ ARCHITECTURE: Canvas context awareness belongs in orchestrator layer
    // The orchestrator owns the logic of what it can "see" on the canvas and communicates
    // this awareness to the user via blackboard messages (which trigger UI display via onMessage callback).
    // This keeps the UI layer purely for display - it doesn't generate canvas awareness messages.
    // 
    // Why here? Canvas context is built before intent analysis, so we can inform the user
    // about what resources are available while the orchestrator is thinking.
    if (canvasContext.connectedNodes.length > 0) {
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `👁️ Canvas visibility: ${canvasContext.connectedNodes.length} node(s) connected`,
        type: 'thinking'
      })
      
      // List each connected node so user knows what the orchestrator can reference
      canvasContext.connectedNodes.forEach(node => {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `   • ${node.label}: ${node.summary}`,
          type: 'thinking'
        })
      })
    }
    
    // Step 4: Check for canvas changes (reads from WorldState if available)
    const canvasChanged = this.blackboard.hasCanvasChanged(startTime - 5000)
    
    // Step 5: Analyze intent (MOVED UP - need to know intent before RAG)
    const conversationHistory = this.blackboard.getRecentMessages(10)
    
    // Get available providers and models (needed for both intent analysis and later model selection)
    const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
    const modelsToUse: TieredModel[] = request.availableModels && request.availableModels.length > 0
      ? filterAvailableModels(request.availableModels)
      : MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
    
    // Step 5.5: Check for corrections and retrieve similar patterns
    let corrections: any[] = []
    let detectedCorrection: { wrongIntent: string, correctIntent: string, originalMessage: string } | null = null
    
    if (request.supabaseClient && this.config.userId) {
      try {
        // Import correction service
        const { 
          findSimilarCorrections, 
          storeCorrectionPattern
        } = await import('../learning/correctionService')
        
        // Detect if this is a correction
        detectedCorrection = this.detectCorrectionFromMessage(
          request.message,
          conversationHistory
        )
        
        if (detectedCorrection) {
          console.log('🔧 [Orchestrator] Correction detected:', detectedCorrection)
          
          // Store the correction pattern
          await storeCorrectionPattern(
            request.supabaseClient,
            this.config.userId,
            {
              originalMessage: detectedCorrection.originalMessage,
              wrongIntent: detectedCorrection.wrongIntent,
              correctIntent: detectedCorrection.correctIntent,
              correctionMessage: request.message,
              context: {
                canvasNodes: _canvasNodes?.map(n => n.data?.label || n.id),
                documentPanelOpen: _isDocViewOpen,
                previousIntent: conversationHistory
                  .slice(-3)
                  .reverse()
                  .find(m => m.role === 'orchestrator' && m.metadata?.intent)?.metadata?.intent
              }
            }
          )
        } else {
          // Retrieve similar corrections for context
          corrections = await findSimilarCorrections(
            request.supabaseClient,
            this.config.userId,
            request.message,
            { matchThreshold: 0.75, matchCount: 3 }
          )
          
          if (corrections.length > 0) {
            console.log(`📚 [Orchestrator] Found ${corrections.length} similar corrections to guide intent analysis`)
          }
        }
      } catch (error) {
        console.warn('⚠️ [Orchestrator] Correction learning unavailable:', error)
      }
    }
    
    // First pass: Quick intent analysis without RAG
    // Pass available models and corrections to intent pipeline
    const intentAnalysis = await analyzeIntent({
      message: request.message,
      hasActiveSegment: !!request.activeContext,
      activeSegmentName: request.activeContext?.name,
      activeSegmentId: request.activeContext?.id,
      conversationHistory: conversationHistory.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        type: m.type
      })),
      documentStructure: request.structureItems,
      isDocumentViewOpen: request.isDocumentViewOpen,
      documentFormat: request.documentFormat,
      useLLM: true,
      canvasContext: formatCanvasContextForLLM(canvasContext),
      availableModels: modelsToUse, // ✅ NEW: Pass available models to intent pipeline
      corrections: corrections // ✅ NEW: Pass learned corrections to intent pipeline
    }, _canvasNodes,  // ✅ Pass canvas nodes
       this.worldState,  // ✅ Pass worldState
       this.blackboard)  // ✅ Pass blackboard
    
    // If correction was detected, override intent
    if (detectedCorrection) {
      intentAnalysis.intent = detectedCorrection.correctIntent as any
      intentAnalysis.confidence = 0.95
      intentAnalysis.reasoning = `User corrected: wanted ${detectedCorrection.correctIntent}, not ${detectedCorrection.wrongIntent}. Correction stored for future learning.`
      console.log('✅ [Orchestrator] Intent overridden based on user correction')
    }
    
    // Update WorldState: Intent analyzed, now deciding
    this.worldState?.update(draft => {
      draft.orchestrator.status = 'deciding'
      draft.orchestrator.lastIntent = {
        intent: intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
        timestamp: Date.now()
      }
      draft.orchestrator.currentTask = {
        type: 'generate_structure',
        startedAt: Date.now(),
        description: `Preparing ${intentAnalysis.intent} action`
      }
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
    
    // NOTE: availableProviders and modelsToUse are already defined above (lines 303-306)
    // Reuse them here - no need to redefine
    
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
    
    // Step 11: Process action dependencies and sequencing
    // ✅ NEW: Automatically execute actions with dependencies in the correct order
    const { executedActions, remainingActions } = await this.processActionDependencies(
      actions,
      request
    )
    
    // Step 12: Build response
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
      actions: remainingActions, // Only return actions that need UI handling
      canvasChanged,
      requiresUserInput: intentAnalysis.needsClarification || remainingActions.some(a => a.requiresUserInput !== false) || false,
      estimatedCost: modelSelection.estimatedCost,
      thinkingSteps // Include detailed thinking from blackboard
    }
    
    // Log what was auto-executed vs returned to UI
    if (executedActions.length > 0) {
      console.log(`✅ [Orchestrator] Auto-executed ${executedActions.length} action(s):`, executedActions.map(a => a.type))
    }
    if (remainingActions.length > 0) {
      console.log(`📤 [Orchestrator] Returning ${remainingActions.length} action(s) to UI:`, remainingActions.map(a => a.type))
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
    
    // Update WorldState: Orchestrator is done
    this.worldState?.update(draft => {
      draft.orchestrator.status = 'idle'
      draft.orchestrator.currentTask = {
        type: null,
        startedAt: null
      }
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
  
  // ============================================================
  // CONTINUE CLARIFICATION: Streamlined Clarification Processing
  // ============================================================
  
  /**
   * Continue from a clarification response
   * 
   * This is a streamlined method that processes clarification responses
   * without re-analyzing intent or rebuilding context. It's more efficient
   * than calling orchestrate() with clarificationContext because it:
   * 
   * 1. Skips intent analysis (we already know the originalAction)
   * 2. Skips canvas context rebuilding (uses existing context)
   * 3. Directly interprets the clarification response
   * 4. Builds and returns actions immediately
   * 
   * @param response - User's clarification response (e.g., "1", "TV Pilot", "the first one")
   * @param clarificationContext - The original clarification context from request_clarification action
   * @param request - Minimal request context (canvas nodes, structure items, etc.)
   * @returns OrchestratorResponse with actions ready for execution
   */
  async continueClarification(
    response: string,
    clarificationContext: {
      originalAction: string
      question: string
      options: Array<{id: string, label: string, description: string}>
      payload: any
    },
    request: {
      canvasNodes?: Node[]
      canvasEdges?: Edge[]
      structureItems?: any[]
      contentMap?: Record<string, string>
      currentStoryStructureNodeId?: string | null
      documentFormat?: string
      availableModels?: TieredModel[]
      availableProviders?: string[]
      userKeyId?: string
    } = {}
  ): Promise<OrchestratorResponse> {
    const startTime = Date.now()
    
    // Update WorldState: Processing clarification response
    this.worldState?.update(draft => {
      draft.orchestrator.status = 'thinking'
      draft.orchestrator.currentTask = {
        type: 'analyze_intent', // Use existing task type
        startedAt: Date.now(),
        description: 'Processing clarification response'
      }
    })
    
    // Add user response to blackboard
    this.blackboard.addMessage({
      role: 'user',
      content: response,
      type: 'user'
    })
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔍 Processing your selection...`,
      type: 'thinking'
    })
    
    // Build minimal request for handleClarificationResponse
    const clarificationRequest: OrchestratorRequest = {
      message: response,
      canvasNodes: request.canvasNodes || [],
      canvasEdges: request.canvasEdges || [],
      structureItems: request.structureItems,
      contentMap: request.contentMap,
      currentStoryStructureNodeId: request.currentStoryStructureNodeId,
      documentFormat: request.documentFormat,
      availableModels: request.availableModels,
      availableProviders: request.availableProviders,
      userKeyId: request.userKeyId,
      clarificationContext: {
        originalAction: clarificationContext.originalAction,
        question: clarificationContext.question,
        options: clarificationContext.options,
        payload: clarificationContext.payload
      }
    }
    
    // Use existing handleClarificationResponse logic (it's already optimized)
    const result = await this.handleClarificationResponse(clarificationRequest)
    
    // Update WorldState: Clarification processed
    this.worldState?.update(draft => {
      draft.orchestrator.status = 'idle'
      draft.orchestrator.currentTask = {
        type: null,
        startedAt: null
      }
    })
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Ready to proceed with ${result.actions.length} action(s)`,
      type: 'result'
    })
    
    return result
  }
  
  // ============================================================
  // CONTINUE CONFIRMATION: Streamlined Confirmation Processing
  // ============================================================
  
  /**
   * Continue from a confirmation response
   * 
   * This processes confirmation responses (yes/no or option selection)
   * and returns the action to execute. The orchestrator knows what action
   * needs confirmation, so it also knows what to execute after confirmation.
   * 
   * This is more efficient than having the UI build actions because:
   * 1. Logic stays in orchestrator (maintains architectural separation)
   * 2. Single source of truth for action building
   * 3. Easier to test and maintain
   * 4. Consistent with continueClarification() pattern
   * 
   * @param response - User's confirmation response ("yes", "no", or selected option)
   * @param confirmationContext - The original confirmation context
   * @param request - Minimal request context
   * @returns OrchestratorResponse with action to execute
   */
  async continueConfirmation(
    response: string | { id: string },
    confirmationContext: {
      actionId: string
      actionType: string
      actionPayload: any
      confirmationType: 'destructive' | 'permission' | 'info' | 'clarification'
      options?: Array<{id: string, label: string, description?: string}>
    },
    request: {
      canvasNodes?: Node[]
      canvasEdges?: Edge[]
      structureItems?: any[]
      contentMap?: Record<string, string>
      currentStoryStructureNodeId?: string | null
    } = {}
  ): Promise<OrchestratorResponse> {
    const startTime = Date.now()
    
    // Update WorldState: Processing confirmation response
    this.worldState?.update(draft => {
      draft.orchestrator.status = 'thinking'
      draft.orchestrator.currentTask = {
        type: 'analyze_intent', // Use existing task type
        startedAt: Date.now(),
        description: 'Processing confirmation response'
      }
    })
    
    // Add user response to blackboard
    const responseText = typeof response === 'string' ? response : response.id
    this.blackboard.addMessage({
      role: 'user',
      content: responseText,
      type: 'user'
    })
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔍 Processing your confirmation...`,
      type: 'thinking'
    })
    
    // Handle different confirmation types
    if (confirmationContext.confirmationType === 'clarification' && confirmationContext.options) {
      // Multiple choice confirmation - find selected option
      let selectedOption = confirmationContext.options.find(opt => opt.id === responseText)
      
      if (!selectedOption && typeof response === 'string') {
        // Try fuzzy matching
        const lowerResponse = response.toLowerCase()
        selectedOption = confirmationContext.options.find(opt => 
          lowerResponse.includes(opt.id.toLowerCase()) ||
          lowerResponse.includes(opt.label.toLowerCase()) ||
          (opt.description && lowerResponse.includes(opt.description.toLowerCase()))
        )
      }
      
      if (!selectedOption) {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❓ I didn't understand which option you meant. Please try again or click one of the buttons.`,
          type: 'error'
        })
        
        // Update WorldState: Confirmation failed
        this.worldState?.update(draft => {
          draft.orchestrator.status = 'idle'
          draft.orchestrator.currentTask = {
            type: null,
            startedAt: null
          }
        })
        
        return {
          intent: 'general_chat',
          confidence: 0.3,
          reasoning: 'Failed to interpret confirmation response',
          modelUsed: 'none',
          actions: [],
          canvasChanged: false,
          requiresUserInput: true,
          estimatedCost: 0
        }
      }
      
      // Build action based on original action type and selected option
      // The orchestrator knows what action to build based on the original action
      const action = this.buildActionFromConfirmation(
        confirmationContext.actionType,
        confirmationContext.actionPayload,
        selectedOption
      )
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Proceeding with: ${selectedOption.label}`,
        type: 'decision'
      })
      
      // Update WorldState: Confirmation processed
      this.worldState?.update(draft => {
        draft.orchestrator.status = 'idle'
        draft.orchestrator.currentTask = {
          type: null,
          startedAt: null
        }
      })
      
      return {
        intent: confirmationContext.actionType as UserIntent,
        confidence: 0.95,
        reasoning: `User confirmed: ${selectedOption.label}`,
        modelUsed: 'none',
        actions: [action],
        canvasChanged: false,
        requiresUserInput: false,
        estimatedCost: 0
      }
    } else {
      // Yes/no confirmation (destructive or permission)
      const lowerResponse = typeof response === 'string' ? response.toLowerCase().trim() : ''
      const isConfirmed = lowerResponse === 'yes' || lowerResponse === 'y' || 
                         lowerResponse === 'confirm' || lowerResponse === 'ok'
      const isCancelled = lowerResponse === 'no' || lowerResponse === 'n' || 
                          lowerResponse === 'cancel'
      
      if (isConfirmed) {
        // Build action from confirmation context
        const action: OrchestratorAction = {
          type: confirmationContext.actionType as OrchestratorAction['type'],
          payload: confirmationContext.actionPayload,
          status: 'pending'
        }
        
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `✅ Confirmed. Proceeding...`,
          type: 'decision'
        })
        
        // Update WorldState: Confirmation processed
        this.worldState?.update(draft => {
          draft.orchestrator.status = 'idle'
          draft.orchestrator.currentTask = {
            type: null,
            startedAt: null
          }
        })
        
        return {
          intent: confirmationContext.actionType as UserIntent,
          confidence: 0.95,
          reasoning: 'User confirmed action',
          modelUsed: 'none',
          actions: [action],
          canvasChanged: false,
          requiresUserInput: false,
          estimatedCost: 0
        }
      } else if (isCancelled) {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ Action cancelled.`,
          type: 'result'
        })
        
        // Update WorldState: Confirmation cancelled
        this.worldState?.update(draft => {
          draft.orchestrator.status = 'idle'
          draft.orchestrator.currentTask = {
            type: null,
            startedAt: null
          }
        })
        
        return {
          intent: 'general_chat',
          confidence: 0.95,
          reasoning: 'User cancelled action',
          modelUsed: 'none',
          actions: [],
          canvasChanged: false,
          requiresUserInput: false,
          estimatedCost: 0
        }
      } else {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❓ Please reply "yes" to confirm or "no" to cancel.`,
          type: 'error'
        })
        
        // Update WorldState: Unclear response
        this.worldState?.update(draft => {
          draft.orchestrator.status = 'idle'
          draft.orchestrator.currentTask = {
            type: null,
            startedAt: null
          }
        })
        
        return {
          intent: 'general_chat',
          confidence: 0.3,
          reasoning: 'Unclear confirmation response',
          modelUsed: 'none',
          actions: [],
          canvasChanged: false,
          requiresUserInput: true,
          estimatedCost: 0
        }
      }
    }
  }
  
  /**
   * Build action from confirmation selection
   * 
   * The orchestrator knows what action to build based on the original action type
   * and the selected option. This keeps the logic in the orchestrator layer.
   * 
   * @param actionType - Original action type that needed confirmation
   * @param originalPayload - Original action payload
   * @param selectedOption - User's selected option from confirmation
   * @returns OrchestratorAction ready for execution
   */
  private buildActionFromConfirmation(
    actionType: string,
    originalPayload: any,
    selectedOption: {id: string, label: string, description?: string}
  ): OrchestratorAction {
    if (actionType === 'delete_node') {
      // For delete_node, we need nodeId and nodeName from selected option
      return {
        type: 'delete_node',
        payload: {
          nodeId: selectedOption.id,
          nodeName: selectedOption.label
        },
        status: 'pending'
      }
    } else if (actionType === 'open_and_write') {
      // For open_and_write, we need nodeId from selected option
      // sectionId comes from original payload if it was specified
      return {
        type: 'open_document',
        payload: {
          nodeId: selectedOption.id,
          sectionId: originalPayload.sectionId || null
        },
        status: 'pending'
      }
    } else {
      // Generic fallback: merge selected option ID into original payload
      return {
        type: actionType as OrchestratorAction['type'],
        payload: {
          ...originalPayload,
          selectedOptionId: selectedOption.id
        },
        status: 'pending'
      }
    }
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
    
    // PHASE 1 REFACTORING: Try modular action generator first
    const generator = this.actionGenerators.get(intent.intent)
    if (generator) {
      console.log(`✅ [Orchestrator] Using modular action generator for: ${intent.intent}`)
      return generator.generate(intent, request, canvasContext, {
        ragContext,
        modelSelection,
        availableModels
      })
    }
    
    // FALLBACK: Handle any intents not covered by modular actions
    // Note: All major intents (answer_question, write_content, create_structure, etc.)
    // are now handled by modular action generators above.
    // This fallback only handles general_chat and unknown intents.
    switch (intent.intent) {
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
   * Process action dependencies and automatically execute actions in the correct order
   * 
   * This method handles:
   * 1. Topological sorting of actions based on dependencies
   * 2. Automatic execution of actions with autoExecute: true
   * 3. Returning only actions that require user input to the UI
   * 
   * @param actions - Array of actions to process
   * @param request - Original orchestrator request (for context)
   * @returns Object with executedActions (auto-executed) and remainingActions (for UI)
   */
  private async processActionDependencies(
    actions: OrchestratorAction[],
    request: OrchestratorRequest
  ): Promise<{
    executedActions: OrchestratorAction[]
    remainingActions: OrchestratorAction[]
  }> {
    const executedActions: OrchestratorAction[] = []
    const remainingActions: OrchestratorAction[] = []
    const completedActionTypes = new Set<string>()
    
    // Separate actions into auto-executable and UI-required
    const autoExecutableActions: OrchestratorAction[] = []
    const uiRequiredActions: OrchestratorAction[] = []
    
    for (const action of actions) {
      // Actions that require user input always go to UI
      if (action.requiresUserInput === true) {
        uiRequiredActions.push(action)
        continue
      }
      
      // Actions with autoExecute: true and no dependencies can execute immediately
      if (action.autoExecute === true && (!action.dependsOn || action.dependsOn.length === 0)) {
        autoExecutableActions.push(action)
        continue
      }
      
      // Actions with dependencies need to wait
      if (action.autoExecute === true && action.dependsOn && action.dependsOn.length > 0) {
        autoExecutableActions.push(action)
        continue
      }
      
      // Default: send to UI
      uiRequiredActions.push(action)
    }
    
    // Execute actions in dependency order
    // Build dependency graph
    const actionMap = new Map<string, OrchestratorAction[]>()
    for (const action of autoExecutableActions) {
      const key = action.type
      if (!actionMap.has(key)) {
        actionMap.set(key, [])
      }
      actionMap.get(key)!.push(action)
    }
    
    // Execute actions topologically (dependencies first)
    const executeQueue = [...autoExecutableActions]
    const executed = new Set<string>()
    
    while (executeQueue.length > 0) {
      let progressMade = false
      
      for (let i = executeQueue.length - 1; i >= 0; i--) {
        const action = executeQueue[i]
        const actionKey = `${action.type}_${i}`
        
        // Check if dependencies are satisfied
        const dependenciesSatisfied = !action.dependsOn || action.dependsOn.every(
          depType => completedActionTypes.has(depType)
        )
        
        if (dependenciesSatisfied && !executed.has(actionKey)) {
          // Execute this action
          try {
            await this.executeActionDirectly(action, request)
            executed.add(actionKey)
            completedActionTypes.add(action.type)
            executedActions.push({ ...action, status: 'completed' })
            executeQueue.splice(i, 1)
            progressMade = true
            
            console.log(`✅ [ActionSequencer] Executed: ${action.type}`)
          } catch (error) {
            console.error(`❌ [ActionSequencer] Failed to execute ${action.type}:`, error)
            executed.add(actionKey)
            completedActionTypes.add(action.type)
            executedActions.push({ ...action, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' })
            executeQueue.splice(i, 1)
            progressMade = true
          }
        }
      }
      
      // Prevent infinite loops
      if (!progressMade) {
        console.warn('⚠️ [ActionSequencer] Circular dependency or missing dependency detected')
        // Move remaining actions to UI
        for (const action of executeQueue) {
          uiRequiredActions.push(action)
        }
        break
      }
    }
    
    // All remaining actions go to UI
    remainingActions.push(...uiRequiredActions)
    
    return { executedActions, remainingActions }
  }
  
  /**
   * Execute a single action directly (used by action sequencer)
   * 
   * This handles actions that can be executed automatically without UI interaction.
   * Currently supports: select_section, generate_content (via tools), message
   * 
   * Note: generate_content execution is actually handled by MultiAgentOrchestrator,
   * so this method just marks it for agent execution.
   * 
   * @param action - Action to execute
   * @param request - Original orchestrator request (for context)
   */
  private async executeActionDirectly(
    action: OrchestratorAction,
    request: OrchestratorRequest
  ): Promise<void> {
    switch (action.type) {
      case 'select_section':
        // Navigation is handled by UI, but we mark it as complete
        // The actual navigation happens when UI receives the action
        console.log(`📍 [ActionSequencer] Section selection: ${action.payload?.sectionId}`)
        break
        
      case 'generate_content':
        // Content generation should be handled by MultiAgentOrchestrator
        // If we're in base OrchestratorEngine, we can't execute this
        // It will be handled by MultiAgentOrchestrator's executeActionsWithAgents
        console.log(`✍️ [ActionSequencer] Content generation will be handled by agent system`)
        break
        
      case 'message':
        // Display message to user
        if (this.config.onMessage) {
          this.config.onMessage(
            action.payload?.content || '',
            'orchestrator',
            action.payload?.type || 'result'
          )
        }
        break
        
      default:
        console.log(`ℹ️ [ActionSequencer] Action ${action.type} requires UI handling`)
        // Other actions require UI interaction
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
    
    // ✅ DEBUG: Log what models we received BEFORE filtering
    console.log(`🔍 [createStructurePlanWithFallback] DEBUG START:`, {
      primaryModelId,
      availableModelsCount: availableModels?.length || 0,
      availableModels: availableModels?.map(m => ({
        id: m.id,
        provider: m.provider,
        reasoning: m.reasoning,
        structuredOutput: m.structuredOutput,
        tier: m.tier,
        // Check enriched fields
        enrichedReasoning: (m as any).supports_reasoning,
        enrichedStructuredOutput: (m as any).supports_structured_output
      })) || []
    })
    
    // ✅ FIX: Filter for structured output support (not just reasoning models)
    // Structure generation needs models with structured output, not necessarily reasoning
    const structuredOutputModels = availableModels
      .filter(m => {
        // Include models with full or json-mode structured output support
        const hasStructuredOutput = m.structuredOutput === 'full' || m.structuredOutput === 'json-mode'
        
        // ✅ DEBUG: Log why models are included/excluded
        if (!hasStructuredOutput) {
          console.log(`⏭️ [Structure Gen] Excluding ${m.id}: structuredOutput=${m.structuredOutput} (needs 'full' or 'json-mode')`)
        } else {
          console.log(`✅ [Structure Gen] Including ${m.id}: structuredOutput=${m.structuredOutput}`)
        }
        
        return hasStructuredOutput
      })
      .sort((a, b) => {
        // ✅ DYNAMIC: Use metadata to prioritize instead of hardcoded values
        
        // 0. Priority: Boost primaryModelId if it's available (user preference)
        const isAPrimary = a.id === primaryModelId
        const isBPrimary = b.id === primaryModelId
        if (isAPrimary && !isBPrimary) return -1
        if (!isAPrimary && isBPrimary) return 1
        
        // 1. Priority: Structured output support (full > json-mode > none)
        const structuredOutputPriority: Record<string, number> = {
          'full': 100,
          'json-mode': 50,
          'none': 0
        }
        const aStructured = structuredOutputPriority[a.structuredOutput] || 0
        const bStructured = structuredOutputPriority[b.structuredOutput] || 0
        if (aStructured !== bStructured) return bStructured - aStructured
        
        // 2. Priority: Actual speed from metadata (if available)
        const enrichedA = a as any
        const enrichedB = b as any
        const aSpeedTokens = enrichedA.speed_tokens_per_sec
        const bSpeedTokens = enrichedB.speed_tokens_per_sec
        
        if (aSpeedTokens && bSpeedTokens) {
          // Both have actual speed data - use it directly
          if (aSpeedTokens !== bSpeedTokens) return bSpeedTokens - aSpeedTokens
        } else if (aSpeedTokens && !bSpeedTokens) {
          // A has speed data, B doesn't - prefer A
          return -1
        } else if (!aSpeedTokens && bSpeedTokens) {
          // B has speed data, A doesn't - prefer B
          return 1
        } else {
          // Neither has speed data - fallback to categorical speed
          const speedPriority: Record<string, number> = {
            'instant': 100,
            'fast': 80,
            'medium': 50,
            'slow': 20
          }
          const aSpeed = speedPriority[a.speed] || 0
          const bSpeed = speedPriority[b.speed] || 0
          if (aSpeed !== bSpeed) return bSpeed - aSpeed
        }
        
        // 3. Priority: Tier (frontier > premium > standard > fast)
        const tierOrder: Record<string, number> = { 
          frontier: 4, 
          premium: 3, 
          standard: 2, 
          fast: 1 
        }
        const aTier = tierOrder[a.tier] || 0
        const bTier = tierOrder[b.tier] || 0
        if (aTier !== bTier) return bTier - aTier
        
        // 4. Priority: Cost (cheaper is better for structure generation)
        // Use actual cost from metadata if available
        const aCost = enrichedA.cost_per_1k_tokens_input
        const bCost = enrichedB.cost_per_1k_tokens_input
        
        if (aCost && bCost) {
          // Both have actual cost - prefer cheaper
          if (aCost !== bCost) return aCost - bCost
        } else {
          // Fallback to categorical cost
          const costPriority: Record<string, number> = {
            'cheap': 1,
            'moderate': 2,
            'expensive': 3
          }
          const aCostCat = costPriority[a.cost] || 2
          const bCostCat = costPriority[b.cost] || 2
          if (aCostCat !== bCostCat) return aCostCat - bCostCat
        }
        
        // 5. Final tiebreaker: Model ID (alphabetical for consistency)
        return a.id.localeCompare(b.id)
      })
    
    // ✅ FIX: Only use primaryModelId if it's actually available to the user!
    const isPrimaryAvailable = structuredOutputModels.some(m => m.id === primaryModelId)
    
    // ✅ Models are already sorted by metadata-based priority above
    // Build final list: primaryModelId first (if available), then others by metadata priority
    const modelList = structuredOutputModels.map(m => m.id)
    
    // Remove duplicates while preserving order
    const modelsToTry = [...new Set(modelList)]
    
    // ✅ DEBUG: Log what models passed the filter
    console.log(`🔍 [createStructurePlanWithFallback] After filter:`, {
      structuredOutputModelsCount: structuredOutputModels.length,
      structuredOutputModels: structuredOutputModels.map(m => ({
        id: m.id,
        structuredOutput: m.structuredOutput,
        reasoning: m.reasoning
      }))
    })
    
    console.log(`🎯 [Model Selection] Primary model: ${primaryModelId} (available: ${isPrimaryAvailable})`)
    console.log(`🔄 [Fallback] Primary model: ${primaryModelId} (available: ${isPrimaryAvailable})`)
    console.log(`🔄 [Fallback] Models to try: ${modelsToTry.join(', ')}`)
    console.log(`🔄 [Fallback] Structured output models available: ${structuredOutputModels.length}, Total available models: ${availableModels.length}`)
    
    // ✅ DEBUG: Log prioritization details for first few models
    if (structuredOutputModels.length > 0) {
      console.log(`🔍 [Fallback] Top 3 prioritized models:`, structuredOutputModels.slice(0, 3).map(m => {
        const enriched = m as any
        return {
          id: m.id,
          structuredOutput: m.structuredOutput,
          speed_tokens_per_sec: enriched.speed_tokens_per_sec || 'N/A',
          cost_per_1k: enriched.cost_per_1k_tokens_input || 'N/A',
          tier: m.tier,
          speed: m.speed
        }
      }))
    }
    
    // ✅ CRITICAL: Check if we have any models to try
    if (modelsToTry.length === 0) {
      // ✅ FIX: More accurate error message
      const errorMsg = structuredOutputModels.length === 0
        ? `No models with structured output support available. Found ${availableModels?.length || 0} total models, but none support structured outputs (full or json-mode). Please add an API key for a model that supports structured outputs (e.g., GPT-4o, GPT-4.1, Claude Sonnet, or Groq models with JSON mode).`
        : 'No models available for structure generation.'
      
      // ✅ DEBUG: Log detailed breakdown for debugging
      console.error(`❌ [createStructurePlanWithFallback] No models available:`, {
        totalAvailable: availableModels?.length || 0,
        withStructuredOutput: structuredOutputModels.length,
        availableModelDetails: availableModels?.map(m => ({
          id: m.id,
          structuredOutput: m.structuredOutput,
          reasoning: m.reasoning,
          whyExcluded: m.structuredOutput !== 'full' && m.structuredOutput !== 'json-mode' 
            ? `structuredOutput=${m.structuredOutput}` 
            : 'should be included'
        })) || []
      })
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ ${errorMsg}`,
        type: 'error'
      })
      
      throw new Error(errorMsg)
    }
    
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
        const errorReason = extractErrorReason(error)
        
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
    
    // Build format-specific instructions and system prompt
    const formatInstructions = getFormatInstructions(format)
    const reportWarning = getReportWarning(format)
    const systemPrompt = getStructureGenerationPrompt(formatInstructions, reportWarning)

    const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/-/g, ' ')
    const userMessage = `The user wants to create a ${formatLabel}.\n\nUser's creative prompt:\n${userPrompt}\n\nIMPORTANT: You MUST analyze the user's creative prompt and create a structure plan where EVERY scene/section description directly relates to and incorporates their specific theme/topic. Do NOT use generic template descriptions. Make each scene description specific to the user's request about "${userPrompt.replace(/create a screenplay about/i, '').trim()}".`
    
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
      max_completion_tokens: 2000, // ⚡ OPTIMIZED: Reduced from 4000 for faster generation
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
    const timeout = setTimeout(() => {
      console.error('⏰ [Structure Generation] Request timed out after 60s')
      controller.abort()
    }, 60000) // ⚡ Increased to 60s for structure generation (complex task)
    
    // Heartbeat: Show "still waiting..." every 5 seconds
    const heartbeat = setInterval(() => {
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: '⏳ Still generating structure, please wait...',
        type: 'progress'
      })
    }, 5000)
    
    console.log('🚀 [Structure Generation] Starting API call...', {
      endpoint: '/api/generate',
      model: modelId,
      useStructuredOutput,
      hasResponseFormat: !!requestBody.response_format,
      hasTools: !!requestBody.tools
    })
    
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
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
          
          // Preserve detailed error information
          if (errorData.details) {
            errorMessage += ` (${errorData.details})`
          }
        } catch (parseError) {
          // If JSON parsing fails, try to get text
          try {
            const errorText = await response.text()
            if (errorText) errorMessage = errorText.substring(0, 200)
          } catch {
            // Use default error message
          }
        }
        
        console.error('❌ [Structure Generation] API error:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          modelId
        })
        
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ Structure generation failed: ${errorMessage}`,
          type: 'error'
        })
        throw new Error(errorMessage)
      }
    } catch (error: any) {
      clearTimeout(timeout)
      clearInterval(heartbeat)
      
      console.error('❌ [Structure Generation] API call failed:', {
        errorName: error.name,
        errorMessage: error.message,
        isAbortError: error.name === 'AbortError',
        fullError: error
      })
      
      if (error.name === 'AbortError') {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '❌ Structure generation timed out after 60 seconds',
          type: 'error'
        })
        throw new Error('Structure generation timed out - trying next model')
      }
      
      // Preserve the original error message
      const errorMessage = error.message || error.toString() || 'Unknown error'
      
      // Add more context to the error
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Structure generation error: ${errorMessage}`,
        type: 'error'
      })
      
      // Preserve the original error with its message
      const enhancedError = new Error(errorMessage)
      enhancedError.name = error.name || 'StructureGenerationError'
      if (error.stack) enhancedError.stack = error.stack
      throw enhancedError
    }
    
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
   * Handle clarification response (user responding to request_clarification action)
   * Uses LLM reasoning to interpret natural language responses like "Go with the first option"
   */
  private async handleClarificationResponse(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const { clarificationContext, message, availableModels, availableProviders } = request
    
    if (!clarificationContext) {
      throw new Error('handleClarificationResponse called without clarificationContext')
    }
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔍 Interpreting clarification response...`,
      type: 'thinking'
    })
    
    // ✅ CRITICAL: First try direct matching before calling LLM (faster and more reliable)
    const normalizedMessage = message.toLowerCase().trim()
    
    // Strategy 1: Exact label match (e.g., "TV Pilot" -> "TV Pilot")
    let directMatch = clarificationContext.options.find(opt => 
      opt.label.toLowerCase().trim() === normalizedMessage
    )
    
    // Strategy 2: Number match (e.g., "2" -> option at index 1)
    if (!directMatch) {
      const numberMatch = normalizedMessage.match(/^#?(\d+)$/)
      if (numberMatch) {
        const optionIndex = parseInt(numberMatch[1]) - 1
        if (optionIndex >= 0 && optionIndex < clarificationContext.options.length) {
          directMatch = clarificationContext.options[optionIndex]
          console.log('✅ [Clarification] Direct number match:', {
            number: numberMatch[1],
            matchedOption: directMatch.label,
            matchedId: directMatch.id
          })
        }
      }
    }
    
    // Strategy 3: Partial label match (e.g., "pilot" matches "TV Pilot")
    if (!directMatch) {
      directMatch = clarificationContext.options.find(opt => {
        const normalizedLabel = opt.label.toLowerCase().trim()
        return normalizedLabel.includes(normalizedMessage) ||
               normalizedMessage.includes(normalizedLabel) ||
               normalizedLabel.replace(/\s+/g, '') === normalizedMessage.replace(/\s+/g, '')
      })
      if (directMatch) {
        console.log('✅ [Clarification] Direct label match:', {
          userMessage: message,
          matchedOption: directMatch.label,
          matchedId: directMatch.id
        })
      }
    }
    
    // If we found a direct match, skip LLM call
    if (directMatch) {
      console.log('✅ [Clarification] Using direct match, skipping LLM call')
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Understood: "${directMatch.label}"`,
        type: 'decision'
      })
      
      const updatedPayload = {
        ...clarificationContext.payload,
        selectedOptionId: directMatch.id
      }
      
      return this.buildActionFromClarification(
        clarificationContext.originalAction,
        directMatch,
        updatedPayload,
        request
      )
    }
    
    // ============================================================
    // LLM FALLBACK: Interpret Natural Language Clarification Response
    // ============================================================
    // 
    // When direct pattern matching fails (exact label, number, or partial match),
    // we use an LLM to interpret the user's natural language response.
    // 
    // Why this is needed:
    // - Users may respond in various ways: "the first one", "go with podcast", "let's do TV pilot"
    // - Direct matching can't handle all natural language variations
    // - LLM can understand context, synonyms, and implicit references
    // 
    // How it works:
    // 1. Build a formatted list of available options with IDs, labels, and descriptions
    // 2. Create a system prompt that instructs the LLM to return ONLY the option ID
    // 3. Provide examples of common response patterns (numbers, ordinals, descriptions)
    // 4. Send user's response to LLM for interpretation
    // 5. Validate the returned option ID against available options
    // 
    // Expected output:
    // - A single option ID string (e.g., "use_podcast", "create_new", "tv-pilot")
    // - This ID is then used to build the appropriate action via buildActionFromClarification()
    
    // Build formatted options list for LLM context
    // Format: "1. [option_id] Option Label - Option Description"
    const optionsList = clarificationContext.options
      .map((opt, idx) => `${idx + 1}. [${opt.id}] ${opt.label} - ${opt.description}`)
      .join('\n')
    
    // System prompt instructs LLM to act as an option selector
    // Critical: Must return ONLY the option ID, no additional text or formatting
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
      // Use model router to select appropriate fast model for simple classification
      const modelsToUse: TieredModel[] = availableModels && availableModels.length > 0
        ? filterAvailableModels(availableModels)
        : MODEL_TIERS.filter(m => (availableProviders || ['openai', 'groq', 'anthropic', 'google']).includes(m.provider))
      
      const modelSelection = selectModel(
        'simple', // Simple classification task
        'speed', // Prioritize speed for clarification
        availableProviders || ['openai', 'groq', 'anthropic', 'google'],
        modelsToUse,
        false // No reasoning needed for simple option selection
      )
      
      // Use the model router's API endpoint
      const response = await fetch('/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          temperature: 0.1 // Low temp for consistent classification
          // Note: model selection is handled by /api/intent/analyze based on available models
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to interpret clarification: ${response.statusText}`)
      }

      const data = await response.json()
      const selectedOptionId = data.content.trim()
      
      // ✅ FIX: Validate clarificationContext.options exists
      if (!clarificationContext.options || !Array.isArray(clarificationContext.options)) {
        console.error('❌ [Clarification] options is undefined or not an array:', clarificationContext)
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ Error: Clarification context is invalid`,
          type: 'error'
        })
        
        return {
          intent: 'general_chat',
          confidence: 0.3,
          reasoning: 'Invalid clarification context',
          modelUsed: 'none',
          actions: [],
          canvasChanged: false,
          requiresUserInput: true,
          estimatedCost: 0
        }
      }
      
      // Find the selected option
      let selectedOption = clarificationContext.options.find(opt => opt.id === selectedOptionId)
      
      if (!selectedOption) {
        console.log('⚠️ [Clarification] LLM returned ID not found in options, trying fallback matching:', {
          llmReturnedId: selectedOptionId,
          availableIds: clarificationContext.options.map(o => o.id),
          userMessage: message
        })
        
        // Fallback: Try multiple matching strategies
        const lowerMessage = message.toLowerCase().trim()
        const normalizedLlmId = selectedOptionId.toLowerCase().replace(/[^a-z0-9-]/g, '')
        
        // Strategy 1: Match by label (e.g., "TV Pilot" -> "TV Pilot")
        let fallbackOption = clarificationContext.options.find(opt => {
          const normalizedLabel = opt.label.toLowerCase().trim()
          return normalizedLabel === lowerMessage || 
                 normalizedLabel.includes(lowerMessage) ||
                 lowerMessage.includes(normalizedLabel)
        })
        
        // Strategy 2: Match by ID with normalization (e.g., "tv-pilot" matches "tv pilot")
        if (!fallbackOption) {
          fallbackOption = clarificationContext.options.find(opt => {
            const normalizedId = opt.id.toLowerCase().replace(/[^a-z0-9-]/g, '')
            const normalizedMessage = lowerMessage.replace(/[^a-z0-9-]/g, '')
            return normalizedId === normalizedMessage ||
                   normalizedId === normalizedLlmId ||
                   normalizedMessage.includes(normalizedId) ||
                   normalizedId.includes(normalizedMessage)
          })
        }
        
        // Strategy 3: Match by number (e.g., "2" -> option at index 1)
        if (!fallbackOption) {
          const numberMatch = lowerMessage.match(/^#?(\d+)$/)
          if (numberMatch) {
            const optionIndex = parseInt(numberMatch[1]) - 1
            if (optionIndex >= 0 && optionIndex < clarificationContext.options.length) {
              fallbackOption = clarificationContext.options[optionIndex]
            }
          }
        }
        
        // Strategy 4: Match LLM returned ID with normalized option IDs
        if (!fallbackOption && normalizedLlmId) {
          fallbackOption = clarificationContext.options.find(opt => {
            const normalizedId = opt.id.toLowerCase().replace(/[^a-z0-9-]/g, '')
            return normalizedId === normalizedLlmId
          })
        }
        
        if (fallbackOption) {
          console.log('✅ [Clarification] Fallback match found:', {
            matchedOption: fallbackOption.label,
            matchedId: fallbackOption.id,
            originalLlmId: selectedOptionId,
            userMessage: message
          })
          selectedOption = fallbackOption
        } else {
          // If still no match, return error
          console.error('❌ [Clarification] No match found after all strategies:', {
            llmReturnedId: selectedOptionId,
            userMessage: message,
            availableOptions: clarificationContext.options.map(o => ({ id: o.id, label: o.label }))
          })
          
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `❌ I didn't understand "${message}". Please choose by number (e.g., "1") or by name.`,
            type: 'error'
          })
          
          return {
            intent: 'general_chat',
            confidence: 0.3,
            reasoning: 'Failed to interpret clarification response',
            modelUsed: modelSelection.modelId || 'none',
            actions: [],
            canvasChanged: false,
            requiresUserInput: true,
            estimatedCost: modelSelection.estimatedCost || 0
          }
        }
      } else {
        console.log('✅ [Clarification] Direct match found:', {
          optionId: selectedOption.id,
          optionLabel: selectedOption.label
        })
      }
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Understood: "${selectedOption.label}"`,
        type: 'decision'
      })
      
      // Build appropriate action based on original action type
      // ✅ CRITICAL: Pass selectedOptionId in payload so CreateStructureAction can find it
      const updatedPayload = {
        ...clarificationContext.payload,
        selectedOptionId: selectedOption.id // ✅ Ensure selectedOptionId is in payload
      }
      
      return this.buildActionFromClarification(
        clarificationContext.originalAction,
        selectedOption,
        updatedPayload, // ✅ Pass updated payload with selectedOptionId
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
      const { documentFormat, userMessage, existingDocs, reportTypeRecommendations, sourceDocumentLabel, sourceDocumentFormat, format, prompt, userKeyId } = payload
      
      // ✅ NEW: Handle template selection (all template IDs from templateRegistry)
      // Complete list of all template IDs across all formats
      const templateIds = [
        // Novels
        'three-act', 'heros-journey', 'freytag', 'save-the-cat', 'blank',
        // Short Stories
        'classic', 'flash-fiction', 'twist-ending',
        // Reports
        'business', 'research', 'technical',
        // Script Coverage
        'standard', 'detailed',
        // Podcast Report
        'executive', 'analytical',
        // Story Analysis
        'thematic', 'structural',
        // Articles/Blog
        'how-to', 'listicle', 'opinion', 'feature',
        // Screenplays
        'tv-pilot', 'short-film',  // ✅ Added 'tv-pilot'
        // Essays
        'argumentative', 'narrative', 'compare-contrast',
        // Podcasts
        'interview', 'co-hosted', 'storytelling'
      ]
      
      if (templateIds.includes(selectedOption.id)) {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `✅ Generating ${documentFormat} structure with ${selectedOption.label} template...`,
          type: 'result'
        })
        
        // Use CreateStructureAction to generate the structure with the selected template
        const createStructureAction = this.actionGenerators.get('create_structure')
        if (!createStructureAction) {
          throw new Error('CreateStructureAction not found in action generators')
        }
        
        // Build intent with suggested template
        const intentWithTemplate = {
          intent: 'create_structure' as const,
          confidence: 0.95,
          reasoning: `User selected ${selectedOption.label} template`,
          suggestedAction: `Generate structure with ${selectedOption.label} template`,
          requiresContext: false,
          suggestedModel: 'orchestrator' as const,
          extractedEntities: {
            suggestedTemplate: selectedOption.id // ✅ Pass template ID to action generator
          }
        }
        
        // Build canvas context from nodes and edges
        const canvasContext = buildCanvasContext(
          'context', // orchestrator node ID
          request.canvasNodes || [],
          request.canvasEdges || []
        )
        
        // Call action generator to create generate_structure action with plan
        // ✅ CRITICAL: Pass clarificationContext with selectedOptionId so CreateStructureAction recognizes the selection
        const actions = await createStructureAction.generate(
          intentWithTemplate,
          {
            ...request,
            documentFormat: format || documentFormat,
            message: prompt || userMessage,
            userKeyId: userKeyId,
            clarificationContext: request.clarificationContext ? {
              originalAction: request.clarificationContext.originalAction || 'create_structure',
              question: request.clarificationContext.question || '',
              options: request.clarificationContext.options || [],
              payload: {
                ...request.clarificationContext.payload,
                selectedOptionId: selectedOption.id // ✅ Ensure selectedOptionId is set
              }
            } : undefined
          },
          canvasContext,
          {
            modelSelection: request.fixedModelId ? { modelId: request.fixedModelId, displayName: request.fixedModelId } : undefined,
            availableModels: request.availableModels
          }
        )
        
        return {
          intent: 'create_structure',
          confidence: 0.95,
          reasoning: `Generated structure with ${selectedOption.label} template`,
          modelUsed: 'gpt-4o',
          actions,
          canvasChanged: false,
          requiresUserInput: false,
          estimatedCost: 0.01
        }
      }
      
      // ✅ Handle report type selection
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
  
  /**
   * Detect if user message is correcting a previous misclassification
   * Returns correction info if detected, null otherwise
   */
  private detectCorrectionFromMessage(
    message: string,
    conversationHistory: ConversationMessage[]
  ): { wrongIntent: string, correctIntent: string, originalMessage: string } | null {
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

