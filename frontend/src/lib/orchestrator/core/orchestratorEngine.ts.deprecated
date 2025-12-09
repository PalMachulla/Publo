/**
 * Orchestrator Engine - The Brain of Publo's AI System
 * 
 * ============================================================================
 * WHAT IS THIS FILE?
 * ============================================================================
 * 
 * This is the central coordinator that makes sense of user requests and decides
 * what actions to take. Think of it as the "conductor" of an orchestra - it
 * doesn't play the instruments (generate content), but it coordinates all the
 * musicians (AI agents, tools, models) to create beautiful music (helpful responses).
 * 
 * ============================================================================
 * WHERE DOES IT FIT IN THE FLOW?
 * ============================================================================
 * 
 * User Types Message
 *        ↓
 * OrchestratorPanel.tsx (UI component - handles chat interface)
 *        ↓
 * OrchestratorEngine.orchestrate() ← YOU ARE HERE
 *        ↓
 *    ┌───┴───┐
 *    │       │
 *    ↓       ↓
 * Intent   Model
 * Analysis Selection
 *    │       │
 *    └───┬───┘
 *        ↓
 * Action Generators (CreateStructureAction, WriteContentAction, etc.)
 *        ↓
 * MultiAgentOrchestrator (if complex task - coordinates multiple agents)
 *        ↓
 * Tools & Agents (WriterAgent, CriticAgent, etc.)
 *        ↓
 * Response back to UI
 * 
 * ============================================================================
 * KEY RESPONSIBILITIES
 * ============================================================================
 * 
 * 1. UNDERSTAND: Analyzes what the user wants (intent analysis via LLM)
 * 2. CONTEXT: Gathers relevant information (canvas state, conversation history)
 * 3. DECIDE: Selects the best AI model for the task (speed vs quality tradeoff)
 * 4. PLAN: Generates a sequence of actions to fulfill the request
 * 5. EXECUTE: Coordinates action execution (some auto-execute, some need UI)
 * 6. LEARN: Detects patterns and corrections from user feedback
 * 
 * ============================================================================
 * FILES IT INTERACTS WITH
 * ============================================================================
 * 
 * INPUT (Receives requests from):
 *   - OrchestratorPanel.tsx: Main UI component that sends user messages
 *   - MultiAgentOrchestrator.ts: Extends this class for complex multi-agent tasks
 * 
 * OUTPUT (Sends actions to):
 *   - OrchestratorPanel.tsx: Returns actions that UI displays/executes
 *   - Action Generators: Delegates to modular action generators
 *   - MultiAgentOrchestrator: For complex tasks requiring multiple agents
 * 
 * DEPENDENCIES (Uses these systems):
 *   - blackboard.ts: Conversation memory and agent communication hub
 *   - worldState.ts: Application state (canvas, documents, etc.)
 *   - modelRouter.ts: Intelligent AI model selection
 *   - intentRouter.ts: User intent analysis (pattern matching + LLM)
 *   - contextProvider.ts: Canvas context extraction
 *   - action generators/: Modular action creation (CreateStructureAction, etc.)
 * 
 * MODULAR HELPERS (Extracted for maintainability):
 *   - orchestratorEngine.helpers.ts: WorldState access utilities
 *   - orchestratorEngine.clarification.ts: Handles user clarification responses
 *   - orchestratorEngine.confirmation.ts: Handles yes/no confirmations
 *   - orchestratorEngine.structure.ts: Structure plan generation
 *   - orchestratorEngine.actions.ts: Action processing and execution
 *   - orchestratorEngine.learning.ts: Pattern extraction and correction detection
 * 
 * ============================================================================
 * ARCHITECTURE PATTERN
 * ============================================================================
 * 
 * This file follows a "thin wrapper" pattern after refactoring:
 * - Main class methods are thin wrappers that delegate to helper functions
 * - Complex logic lives in separate modules (see MODULAR HELPERS above)
 * - This makes the code easier to test, maintain, and understand
 * 

// ============================================================================
// CORE DEPENDENCIES - Essential Systems
// ============================================================================

/**
 * Blackboard: The conversation memory and agent communication hub
 * - Stores all conversation messages (user + orchestrator)
 * - Tracks recently referenced nodes for context resolution
 * - Enables agents to share information (blackboard pattern)
 */
import { Blackboard, type ConversationMessage } from './blackboard'

/**
 * Canvas Context: Understanding the user's workspace
 * - buildCanvasContext: Extracts canvas state (nodes, edges, connections)
 * - formatCanvasContextForLLM: Formats context for LLM prompts
 * - CanvasContext: Type definition for canvas state
 */
import { buildCanvasContext, formatCanvasContextForLLM, type CanvasContext } from '../context/contextProvider'

/**
 * Model Router: Intelligent AI model selection
 * - selectModel: Chooses best model based on task requirements
 * - assessTaskComplexity: Determines how complex a task is
 * - selectModelForTask: ⚠️ TO BE INVESTIGATED - May be legacy/unused
 * - isFrontierModel: ⚠️ TO BE INVESTIGATED - May be legacy/unused
 * - MODEL_TIERS: List of available AI models with metadata
 * - Types: ModelSelection, TaskRequirements, TieredModel
 */
import { 
  selectModel, 
  assessTaskComplexity, 
  selectModelForTask, // ⚠️ TO BE INVESTIGATED - Check if actually used
  isFrontierModel, // ⚠️ TO BE INVESTIGATED - Check if actually used
  MODEL_TIERS,
  type ModelSelection,
  type TaskRequirements,
  type TieredModel
} from './modelRouter'

/**
 * Intent Router: Understanding what the user wants
 * - analyzeIntent: Analyzes user message to determine intent (create_structure, write_content, etc.)
 * - Now supports Python backend via feature flag (NEXT_PUBLIC_USE_PYTHON_BACKEND)
 * - Types: IntentAnalysis (result), UserIntent (possible intents)
 */
// Add to imports section (around line 135)
import { intentContextToPipelineContext } from '../context/intent/utils/adapter'
import { analyzeIntent } from '../context/intentAnalyzerWrapper'
import { type IntentAnalysis, type UserIntent } from '../context/intentRouter'

/**
 * RAG Integration: Enhancing context with semantic search
 * - enhanceContextWithRAG: Adds relevant information from document corpus
 * - Used when enableRAG is true in config
 */
import { enhanceContextWithRAG } from '../context/ragIntegration'

/**
 * React Flow: Canvas graph types
 * - Node: Represents a document/structure node on the canvas
 * - Edge: Represents connections between nodes
 */
import { Node, Edge } from 'reactflow'

/**
 * Model Filter: Filtering available models
 * - filterAvailableModels: Filters models based on user's API keys and preferences
 */
import { filterAvailableModels } from '../utils/modelFilter'

/**
 * Error Utils: Error handling utilities
 * - extractErrorReason: Extracts human-readable error messages from various error types
 */
import { extractErrorReason } from '../utils/errorUtils'

/**
 * Format Instructions: Document format specifications
 * - getFormatInstructions: ⚠️ TO BE INVESTIGATED - May be legacy/unused (structure generation moved to structure.ts)
 * - Used for structure generation prompts
 */
import { getFormatInstructions } from '../schemas/formatInstructions' // ⚠️ TO BE INVESTIGATED - Check if used

/**
 * Structure Generation Prompts: Templates for structure generation
 * - getStructureGenerationPrompt: Builds system prompt for structure generation
 * - getReportWarning: Adds warnings for report-type documents
 */
import { getStructureGenerationPrompt, getReportWarning } from '../prompts/structureGeneration'

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * WorldState: Unified application state manager
 * - Single source of truth for canvas state, documents, orchestrator status
 * - Replaces scattered props and state variables
 * - Optional for backward compatibility during migration
 */
import type { WorldStateManager } from './worldState'

/**
 * Tool Registry: Executable tools system
 * - Registry of available tools (WriteContentTool, CreateStructureTool, etc.)
 * - Optional - used by MultiAgentOrchestrator for agent coordination
 */
import type { ToolRegistry } from '../tools'

// ============================================================================
// ACTION GENERATORS - Modular Action Creation
// ============================================================================

/**
 * Base Action: Abstract base class for all action generators
 * - Defines the interface that all action generators must implement
 */
import { BaseAction } from '../actions/base/BaseAction'

/**
 * Content Actions: Actions that generate or answer questions about content
 * - AnswerQuestionAction: Answers user questions about documents
 * - WriteContentAction: Generates content for sections
 */
import { AnswerQuestionAction } from '../actions/content/AnswerQuestionAction'
import { WriteContentAction } from '../actions/content/WriteContentAction'

/**
 * Structure Actions: Actions that create or modify document structures
 * - CreateStructureAction: Generates document structure plans (novels, screenplays, etc.)
 */
import { CreateStructureAction } from '../actions/structure/CreateStructureAction'

/**
 * Navigation Actions: Actions that navigate or modify the canvas
 * - DeleteNodeAction: Deletes nodes from canvas
 * - OpenDocumentAction: Opens documents for viewing/editing
 * - NavigateSectionAction: Navigates to specific sections within documents
 */
import { DeleteNodeAction } from '../actions/navigation/DeleteNodeAction'
import { OpenDocumentAction } from '../actions/navigation/OpenDocumentAction'
import { NavigateSectionAction } from '../actions/navigation/NavigateSectionAction'
// ============================================================================
// MODULAR HELPERS - Extracted for Better Organization
// ============================================================================
// These modules were extracted from this file during refactoring to improve
// maintainability. The main class methods are thin wrappers that delegate
// to these helper functions.

/**
 * WorldState Helpers: Utilities for accessing application state
 * - getCanvasNodesHelper: Gets canvas nodes from WorldState or request
 * - getCanvasEdgesHelper: Gets canvas edges from WorldState or request
 * - getActiveContextHelper: Gets active document context
 * - isDocumentViewOpenHelper: Checks if document view is open
 * - getDocumentFormatHelper: Gets current document format
 * - getStructureItemsHelper: Gets structure items from active document
 * - getContentMapHelper: Gets content map from active document
 * - getAvailableProvidersHelper: Gets available API providers
 * - getAvailableModelsHelper: Gets available AI models
 * - getModelPreferencesHelper: Gets user's model preferences
 */
import {
  getCanvasNodesHelper,
  getCanvasEdgesHelper,
  getActiveContextHelper,
  isDocumentViewOpenHelper,
  getDocumentFormatHelper,
  getStructureItemsHelper,
  getContentMapHelper,
  getAvailableProvidersHelper,
  getAvailableModelsHelper,
  getModelPreferencesHelper
} from './orchestratorEngine.helpers'

/**
 * Clarification Helpers: Handling user clarification responses
 * - handleClarificationResponseHelper: Processes user responses to clarification questions
 * - buildActionFromClarificationHelper: Builds actions based on user's clarification choice
 * - Example: User says "the first one" → system interprets and creates appropriate action
 */
import {
  handleClarificationResponseHelper,
  buildActionFromClarificationHelper
} from './orchestratorEngine.clarification'

/**
 * Confirmation Helpers: Handling yes/no confirmations
 * - continueConfirmationHelper: Processes user confirmations (yes/no or option selection)
 * - buildActionFromConfirmationHelper: Builds actions from confirmation responses
 * - Example: User confirms "yes" to delete → system creates delete action
 */
import {
  continueConfirmationHelper,
  buildActionFromConfirmationHelper
} from './orchestratorEngine.confirmation'

/**
 * Structure Generation Helpers: Creating document structures
 * - createStructurePlanWithFallbackHelper: Generates structure with automatic model fallback
 * - createStructurePlanHelper: Core structure generation logic
 * - Handles structured output formats (OpenAI, Anthropic, Google)
 * - Includes retry logic and error handling
 */
import {
  createStructurePlanWithFallbackHelper,
  createStructurePlanHelper
} from './orchestratorEngine.structure'

/**
 * Action Processing Helpers: Managing action execution
 * - generateActionsHelper: Creates actions based on intent analysis
 * - processActionDependenciesHelper: Handles action dependencies and auto-execution
 * - executeActionDirectlyHelper: Executes simple actions without UI interaction
 */
import {
  generateActionsHelper,
  processActionDependenciesHelper,
  executeActionDirectlyHelper
} from './orchestratorEngine.actions'

/**
 * Learning Helpers: Pattern extraction and correction detection
 * - extractPatternHelper: Identifies learnable patterns from user interactions
 * - detectCorrectionFromMessageHelper: Detects when user corrects a misclassification
 * - Example: User says "I wanted create_structure, not write_content" → system learns
 */
import {
  extractPatternHelper,
  detectCorrectionFromMessageHelper
} from './orchestratorEngine.learning'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Type Definitions: All orchestrator-related types
 * - OrchestratorConfig: Configuration for orchestrator instance
 * - OrchestratorRequest: Input request from UI (user message, canvas state, etc.)
 * - OrchestratorResponse: Output response (actions, intent, model used, etc.)
 * - OrchestratorAction: Individual action to execute (generate_content, open_document, etc.)
 * - StructurePlan: Generated document structure (sections, tasks, metadata)
 */
import type {
  OrchestratorConfig,
  OrchestratorRequest,
  OrchestratorResponse,
  OrchestratorAction,
  StructurePlan
} from './orchestratorEngine.types'

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Constants: Configuration values and magic numbers
 * - STRUCTURE_GENERATION_CONFIG: Timeouts, retries, token limits for structure generation
 * - CANVAS_CHANGE_WINDOW_MS: Time window for detecting canvas changes
 */
import {
  STRUCTURE_GENERATION_CONFIG,
  CANVAS_CHANGE_WINDOW_MS
} from './orchestratorEngine.constants'

// Re-export types for external consumers
export type {
  OrchestratorConfig,
  OrchestratorRequest,
  OrchestratorResponse,
  OrchestratorAction,
  StructurePlan
} from './orchestratorEngine.types'

// ============================================================================
// ORCHESTRATOR ENGINE CLASS
// ============================================================================

/**
 * OrchestratorEngine: The Central Coordinator
 * 
 * This class orchestrates the entire flow from user message to action execution.
 * It's designed to be extended by MultiAgentOrchestrator for complex multi-agent tasks.
 * 
 * CLASS STRUCTURE:
 * 
 * 1. CONSTRUCTOR
 *    - Initializes Blackboard (conversation memory)
 *    - Sets up action generators (modular action creators)
 *    - Connects to WorldState (application state)
 * 
 * 2. PUBLIC API (called by UI)
 *    - orchestrate(): Main entry point - processes user requests
 *    - continueClarification(): Handles clarification responses
 *    - continueConfirmation(): Handles confirmation responses
 * 
 * 3. PROTECTED METHODS (for subclasses like MultiAgentOrchestrator)
 *    - prepareContext(): Gathers context (canvas, conversation, state)
 *    - analyzeUserIntent(): Determines what user wants
 *    - selectOptimalModel(): Chooses best AI model
 *    - generateActions(): Creates actions based on intent
 *    - processActionDependencies(): Handles action execution order
 *    - buildResponse(): Constructs final response
 * 
 * 4. HELPER METHODS (delegate to extracted modules)
 *    - WorldState access helpers (getCanvasNodes, etc.)
 *    - Clarification handlers
 *    - Confirmation handlers
 *    - Structure generation
 *    - Action processing
 *    - Pattern learning
 * 
 * 5. FACTORY FUNCTIONS (at bottom of file)
 *    - getOrchestrator(): Gets or creates orchestrator instance
 *    - getMultiAgentOrchestrator(): Creates multi-agent orchestrator
 *    - createOrchestrator(): Creates new orchestrator instance
 */
export class OrchestratorEngine {
  // ============================================================================
  // CLASS PROPERTIES
  // ============================================================================
  
  /**
   * Blackboard: Conversation memory and agent communication hub
   * - Stores all conversation messages (user + orchestrator)
   * - Tracks recently referenced nodes for context resolution
   * - Enables agents to share information (blackboard pattern)
   * - Protected for MultiAgentOrchestrator subclass access
   */
  protected blackboard: Blackboard
  
  /**
   * Config: Orchestrator configuration
   * - User preferences (model priority, RAG, learning)
   * - Optional callbacks (onMessage for real-time updates)
   * - Protected for MultiAgentOrchestrator subclass access
   */
  protected config: Omit<Required<OrchestratorConfig>, 'toolRegistry' | 'onMessage'> & { 
    toolRegistry?: ToolRegistry
    onMessage?: OrchestratorConfig['onMessage'] 
  }
  
  /**
   * WorldState: Unified application state manager
   * - Single source of truth for canvas, documents, orchestrator status
   * - Optional for backward compatibility during migration
   * - Protected for MultiAgentOrchestrator subclass access
   */
  protected worldState?: WorldStateManager
  
  /**
   * ToolRegistry: Executable tools system
   * - Registry of available tools (WriteContentTool, CreateStructureTool, etc.)
   * - Used by MultiAgentOrchestrator for agent coordination
   * - Optional - only used in multi-agent scenarios
   */
  private toolRegistry?: ToolRegistry
  
  /**
   * ActionGenerators: Modular action creation system
   * - Maps user intents to action generator classes
   * - Each generator handles a specific intent (create_structure, write_content, etc.)
   * - Enables extensible, maintainable action creation
   */
  private actionGenerators: Map<UserIntent, BaseAction>
  
  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================
  
  /**
   * Creates a new OrchestratorEngine instance
   * 
   * Initialization Steps:
   * 1. Sets up Blackboard (conversation memory) with optional real-time message callback
   * 2. Connects to WorldState if provided (unified application state)
   * 3. Stores ToolRegistry if provided (for multi-agent coordination)
   * 4. Initializes action generators (modular action creators)
   * 5. Configures orchestrator settings (model priority, RAG, learning, etc.)
   * 
   * @param config - Orchestrator configuration (userId, preferences, callbacks)
   * @param worldState - Optional unified state manager (for gradual migration)
   * 
   * Architecture Notes:
   * - Message callback: Blackboard calls onMessage when messages are added
   * - WorldState connection: Enables temporal memory logging and state synchronization
   * - Action generators: Each intent has a dedicated generator class
   */
  constructor(config: OrchestratorConfig, worldState?: WorldStateManager) {
    // Step 1: Set up message callback for real-time UI updates
    // Note: Don't add to WorldState here - onAddChatMessage callback already handles it
    // The messageCallback is called by Blackboard when messages are added, and the UI's
    // onAddChatMessage callback (passed as config.onMessage) is responsible for adding
    // messages to WorldState. Adding here would cause duplicates.
    const messageCallback = config.onMessage ? (msg: any) => {
      // Call the UI callback - it will add to WorldState
      // Pass metadata if available for structured content support
      config.onMessage!(msg.content, msg.role, msg.type, msg.metadata)
    } : undefined

    // Step 2: Initialize Blackboard (conversation memory)
    this.blackboard = new Blackboard(config.userId, messageCallback)
    
    // Step 3: Store and connect WorldState if provided
    this.worldState = worldState
    if (worldState) {
      // Connect Blackboard to WorldState (enables temporal memory logging)
      this.blackboard.setWorldState(worldState)
    }
    
    // Step 4: Store ToolRegistry if provided (for multi-agent scenarios)
    this.toolRegistry = config.toolRegistry
    
    // Step 5: Build configuration with defaults
    this.config = {
      userId: config.userId,
      modelPriority: config.modelPriority || 'balanced', // balanced, speed, quality
      enableRAG: config.enableRAG !== false, // Default: enabled
      enablePatternLearning: config.enablePatternLearning !== false, // Default: enabled
      maxConversationDepth: config.maxConversationDepth || 50, // Max conversation history
      toolRegistry: config.toolRegistry, // Optional tool system
      ...(config.onMessage && { onMessage: config.onMessage }) // Optional real-time callback
    }
    
    // Step 6: Initialize modular action generators
    // Each intent maps to a dedicated action generator class
    this.actionGenerators = new Map([
      ['answer_question', new AnswerQuestionAction()],
      ['write_content', new WriteContentAction()],
      ['create_structure', new CreateStructureAction(this)], // Needs orchestrator reference
      ['delete_node', new DeleteNodeAction(this.blackboard)],
      ['open_and_write', new OpenDocumentAction(this.blackboard)],
      ['navigate_section', new NavigateSectionAction()],
      // More actions can be added here as they're created
    ])
    
    // Log initialization for debugging
    console.log('🎯 [Orchestrator] Initialized', {
      userId: config.userId,
      priority: this.config.modelPriority,
      rag: this.config.enableRAG,
      learning: this.config.enablePatternLearning,
      hasWorldState: !!worldState,
      hasToolRegistry: !!config.toolRegistry,
      toolCount: config.toolRegistry?.getAll().length || 0,
      actionGeneratorsCount: this.actionGenerators.size
    })
  }
  
  // ============================================================================
  // PUBLIC API - Main Entry Points
  // ============================================================================
  
  /**
   * Main orchestration method - The Heart of the System
   * 
   * This is the primary entry point for processing user requests. It coordinates
   * the entire flow from user message to action execution.
   * 
   * ORCHESTRATION FLOW:
   * 
   * 1. CONTEXT PREPARATION
   *    - Extracts canvas state (nodes, edges, active document)
   *    - Gathers conversation history
   *    - Checks for user corrections
   *    - Updates WorldState with orchestrator status
   * 
   * 2. INTENT ANALYSIS
   *    - Analyzes user message to determine intent (create_structure, write_content, etc.)
   *    - Uses LLM reasoning for complex/ambiguous requests
   *    - Applies corrections if user corrected previous misclassification
   * 
   * 3. MODEL SELECTION
   *    - Assesses task complexity (simple, reasoning, complex)
   *    - Selects optimal AI model based on requirements
   *    - Enhances context with RAG if enabled
   * 
   * 4. ACTION GENERATION
   *    - Delegates to appropriate action generator based on intent
   *    - Each generator creates specific actions (generate_content, open_document, etc.)
   * 
   * 5. ACTION PROCESSING
   *    - Resolves action dependencies (topological sorting)
   *    - Auto-executes simple actions (select_section, message)
   *    - Returns complex actions to UI (generate_content, create_structure)
   * 
   * 6. PATTERN LEARNING (if enabled)
   *    - Extracts learnable patterns from interaction
   *    - Stores patterns for future use
   * 
   * 7. RESPONSE BUILDING
   *    - Constructs final response with actions, metadata, and thinking steps
   *    - Updates WorldState with final status
   * 
   * @param request - User request with message, canvas state, preferences, etc.
   * @returns OrchestratorResponse with actions, intent, model used, and metadata
   * 
   * Example:
   * ```typescript
   * const response = await orchestrator.orchestrate({
   *   message: "Create a novel about dragons",
   *   canvasNodes: [...],
   *   canvasEdges: [...],
   *   availableModels: [...]
   * })
   * // Returns: { intent: 'create_structure', actions: [...], ... }
   * ```
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
    
    // Special case: Handle clarification responses (user responding to clarification question)
    // This skips the normal orchestration flow since we already know the context
    if (request.clarificationContext) {
      return await this.handleClarificationResponse(request)
    }
    
    // ========================================================================
    // MAIN ORCHESTRATION FLOW
    // ========================================================================
    
    // Step 1: Prepare Context
    // Gathers all necessary information: canvas state, conversation history, available models, etc.
    const context = await this.prepareContext(request, startTime)
    
    // Step 2: Analyze User Intent
    // Determines what the user wants (create_structure, write_content, etc.)
    // Applies corrections if user corrected a previous misclassification
    const intentAnalysis = await this.analyzeUserIntent(request, {
      canvasNodes: context.canvasNodes,
      activeContext: context.activeContext,
      canvasContext: context.canvasContext,
      conversationHistory: context.conversationHistory,
      availableModels: context.availableModels,
      corrections: context.corrections,
      detectedCorrection: context.detectedCorrection
    })
    
    // Step 3: Select Optimal Model
    // Chooses the best AI model for the task (considering speed, quality, capabilities)
    // Enhances context with RAG if enabled
    const { modelSelection, validatedFixedModelId, ragContext } = await this.selectOptimalModel(
      intentAnalysis,
      request,
      {
        canvasContext: context.canvasContext,
        conversationHistory: context.conversationHistory,
        availableProviders: context.availableProviders,
        availableModels: context.availableModels
      },
      null // ragContext will be created/enhanced in selectOptimalModel if RAG is enabled
    )
    
    // Step 4: Generate Actions
    // Delegates to appropriate action generator based on intent
    // Each generator creates specific actions (generate_content, open_document, etc.)
    const actions = await this.generateActions(
      intentAnalysis,
      request,
      context.canvasContext,
      ragContext, // RAG-enhanced context for better content generation
      modelSelection,
      validatedFixedModelId,
      context.availableModels
    )
    
    // Step 5: Process Action Dependencies
    // Handles action execution order and auto-executes simple actions
    // Returns actions that need UI interaction or complex processing
    const { executedActions, remainingActions } = await this.processActionDependencies(
      actions,
      request
    )
    
    // Log execution summary for debugging
    if (executedActions.length > 0) {
      console.log(`✅ [Orchestrator] Auto-executed ${executedActions.length} action(s):`, executedActions.map(a => a.type))
    }
    if (remainingActions.length > 0) {
      console.log(`📤 [Orchestrator] Returning ${remainingActions.length} action(s) to UI:`, remainingActions.map(a => a.type))
    }
    
    // Step 6: Pattern Learning (if enabled)
    // Extracts learnable patterns from user interactions for future improvement
    if (this.config.enablePatternLearning && intentAnalysis.confidence > 0.8) {
      const pattern = this.extractPattern(request.message, intentAnalysis, context.canvasContext)
      if (pattern) {
        await this.blackboard.storePattern(
          pattern.pattern,
          pattern.action,
          'intent_detection'
        )
      }
    }
    
    // Step 7: Build Final Response
    // Assembles all information into a response the UI can use
    const response = this.buildResponse(
      intentAnalysis,
      remainingActions,
      modelSelection,
      context.canvasChanged,
      startTime
    )
    
    console.log('✅ [Orchestrator] Completed', {
      intent: response.intent,
      confidence: response.confidence,
      model: response.modelUsed,
      cost: response.estimatedCost,
      time: Date.now() - startTime
    })
    
    return response
  }
  
  // ============================================================================
  // PROTECTED ORCHESTRATION HELPERS
  // ============================================================================
  // These methods break down orchestrate() into smaller, testable units.
  // They're protected so MultiAgentOrchestrator can override or extend them.
  
  /**
   * Prepare Context: Gathers all necessary context for orchestration
   * 
   * This method is the first step in orchestration. It:
   * - Extracts canvas state from WorldState or request props
   * - Updates WorldState with orchestrator status
   * - Builds canvas context (connected nodes, relationships)
   * - Gathers conversation history
   * - Checks for user corrections (learning from mistakes)
   * - Filters available models based on user's API keys
   * 
   * State Priority:
   * 1. WorldState (if available) - Single source of truth
   * 2. Request props - Fallback for backward compatibility
   * 
   * @param request - User request with optional state information
   * @param startTime - Timestamp when orchestration started (for canvas change detection)
   * @returns Prepared context object with all necessary information
   * 
   * Context includes:
   * - Canvas state (nodes, edges, active document)
   * - Document state (format, structure items, content map)
   * - Available models and providers
   * - Conversation history
   * - Detected corrections (if user corrected previous intent)
   */
  protected async prepareContext(
    request: OrchestratorRequest,
    startTime: number
  ): Promise<{
    canvasNodes: Node[]
    canvasEdges: Edge[]
    activeContext?: { id: string; name: string }
    isDocViewOpen: boolean
    documentFormat?: string
    structureItems?: any[]
    contentMap?: Record<string, string>
    availableProviders: string[]
    availableModels: TieredModel[]
    canvasContext: CanvasContext
    canvasChanged: boolean
    conversationHistory: ConversationMessage[]
    corrections: any[]
    detectedCorrection: { wrongIntent: string; correctIntent: string; originalMessage: string } | null
  }> {
    // Extract state from WorldState or request
    const canvasNodes = this.getCanvasNodes(request)
    const canvasEdges = this.getCanvasEdges(request)
    const activeContext = this.getActiveContext(request)
    const isDocViewOpen = this.isDocumentViewOpen(request)
    const documentFormat = this.getDocumentFormat(request)
    const structureItems = this.getStructureItems(request)
    const contentMap = this.getContentMap(request)
    const availableProviders = this.getAvailableProviders(request) || ['openai', 'groq', 'anthropic', 'google']
    const availableModels = this.getAvailableModels(request)
    
    // Update WorldState if structureItems provided
    if (this.worldState && request.structureItems && request.structureItems.length > 0 && request.currentStoryStructureNodeId) {
      this.worldState.setActiveDocument(
        request.currentStoryStructureNodeId,
        documentFormat || 'novel',
        request.structureItems
      )
      if (request.currentStoryStructureNodeId) {
        this.blackboard.logDocumentUpdate(request.currentStoryStructureNodeId)
      }
    }
    
    // Add user message to blackboard
    this.blackboard.addMessage({
      role: 'user',
      content: request.message,
      type: 'user'
    })
    
    // Build canvas context
    const canvasContext = buildCanvasContext(
      'context',
      canvasNodes,
      canvasEdges,
      request.currentStoryStructureNodeId && request.contentMap
        ? { [request.currentStoryStructureNodeId]: { contentMap: request.contentMap } }
        : undefined
    )
    
    // Log canvas visibility
    if (canvasContext.connectedNodes.length > 0) {
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `👁️ Canvas visibility: ${canvasContext.connectedNodes.length} node(s) connected`,
        type: 'thinking'
      })
      canvasContext.connectedNodes.forEach(node => {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `   • ${node.label}: ${node.summary}`,
          type: 'thinking'
        })
      })
    }
    
    // Check for canvas changes
    const canvasChanged = this.blackboard.hasCanvasChanged(startTime - CANVAS_CHANGE_WINDOW_MS)
    
    // Get conversation history
    const conversationHistory = this.blackboard.getRecentMessages(10)
    
    // Get available models
    const modelsToUse: TieredModel[] = availableModels && availableModels.length > 0
      ? filterAvailableModels(availableModels)
      : MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
    
    // Check for corrections
    let corrections: any[] = []
    let detectedCorrection: { wrongIntent: string; correctIntent: string; originalMessage: string } | null = null
    
    if (request.supabaseClient && this.config.userId) {
      try {
        const { findSimilarCorrections, storeCorrectionPattern } = await import('../learning/correctionService')
        
        detectedCorrection = this.detectCorrectionFromMessage(request.message, conversationHistory)
        
        if (detectedCorrection) {
          await storeCorrectionPattern(request.supabaseClient, this.config.userId, {
            originalMessage: detectedCorrection.originalMessage,
            wrongIntent: detectedCorrection.wrongIntent,
            correctIntent: detectedCorrection.correctIntent,
            correctionMessage: request.message,
            context: {
              canvasNodes: canvasNodes?.map(n => n.data?.label || n.id),
              documentPanelOpen: isDocViewOpen,
              previousIntent: conversationHistory
                .slice(-3)
                .reverse()
                .find(m => m.role === 'orchestrator' && m.metadata?.intent)?.metadata?.intent
            }
          })
        } else {
          corrections = await findSimilarCorrections(
            request.supabaseClient,
            this.config.userId,
            request.message,
            { matchThreshold: 0.75, matchCount: 3 }
          )
        }
      } catch (error) {
        console.warn('⚠️ [Orchestrator] Correction learning unavailable:', error)
      }
    }
    
    return {
      canvasNodes,
      canvasEdges,
      activeContext,
      isDocViewOpen,
      documentFormat,
      structureItems,
      contentMap,
      availableProviders,
      availableModels: modelsToUse,
      canvasContext,
      canvasChanged,
      conversationHistory,
      corrections,
      detectedCorrection
    }
  }
  
  /**
   * Analyze User Intent: Determines what the user wants
   * 
   * This method analyzes the user's message to determine their intent. It uses:
   * - Pattern matching for simple, unambiguous requests
   * - LLM reasoning for complex or ambiguous requests
   * - Conversation history for context
   * - Canvas state for document-aware intents
   * - Correction detection to learn from mistakes
   * 
   * Intent Types:
   * - create_structure: User wants to create a new document structure
   * - write_content: User wants to write content in a section
   * - answer_question: User is asking a question about their document
   * - open_and_write: User wants to open a document and write in it
   * - delete_node: User wants to delete a node
   * - navigate_section: User wants to navigate to a specific section
   * 
   * @param request - User request
   * @param context - Prepared context from prepareContext()
   * @returns IntentAnalysis with intent, confidence, reasoning, and metadata
   * 
   * Example:
   * Input: "Create a screenplay about space exploration"
   * Output: { intent: 'create_structure', confidence: 0.95, reasoning: '...', ... }
   */
  protected async analyzeUserIntent(
    request: OrchestratorRequest,
    context: {
      canvasNodes: Node[]
      activeContext?: { id: string; name: string }
      canvasContext: CanvasContext
      conversationHistory: ConversationMessage[]
      availableModels: TieredModel[]
      corrections: any[]
      detectedCorrection: { wrongIntent: string; correctIntent: string; originalMessage: string } | null
    }
  ): Promise<IntentAnalysis> {
    const intentAnalysis = await analyzeIntent(
      request.message,  // Extract message from IntentContext
      intentContextToPipelineContext(
        {
          message: request.message,
          hasActiveSegment: !!context.activeContext,
          activeSegmentName: context.activeContext?.name,
          activeSegmentId: context.activeContext?.id,
          conversationHistory: context.conversationHistory.map(m => ({
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
          canvasContext: formatCanvasContextForLLM(context.canvasContext),
          availableModels: context.availableModels,
          corrections: context.corrections
        },
        this.worldState,
        this.blackboard,
        context.canvasNodes
      )
    )
    
    // Override intent if correction detected
    if (context.detectedCorrection) {
      intentAnalysis.intent = context.detectedCorrection.correctIntent as any
      intentAnalysis.confidence = 0.95
      intentAnalysis.reasoning = `User corrected: wanted ${context.detectedCorrection.correctIntent}, not ${context.detectedCorrection.wrongIntent}. Correction stored for future learning.`
    }
    
    // Update WorldState
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
    
    return intentAnalysis
  }
  
  /**
   * Select Optimal Model: Chooses the best AI model for the task
   * 
   * This method intelligently selects an AI model based on:
   * - Task complexity (simple, reasoning, complex)
   * - User preferences (speed vs quality)
   * - Available models (user's API keys)
   * - Model capabilities (reasoning, structured output, speed)
   * 
   * Model Selection Strategy:
   * 1. Assess task complexity (simple tasks → fast models, complex → reasoning models)
   * 2. Apply user preferences (balanced, speed, quality)
   * 3. Filter by available models (user's API keys)
   * 4. Select best match (considering speed, cost, capabilities)
   * 
   * RAG Enhancement:
   * - If enabled and relevant, enhances context with semantic search
   * - Adds relevant information from document corpus
   * - Improves context for content generation tasks
   * 
   * @param intentAnalysis - Analyzed user intent
   * @param request - User request with model preferences
   * @param context - Context with available models and providers
   * @param ragContext - Optional RAG context (will be enhanced if enabled)
   * @returns Model selection with reasoning and estimated cost
   * 
   * Example:
   * Simple task: "What is the plot?" → Fast model (Groq, GPT-3.5)
   * Complex task: "Create a novel structure" → Reasoning model (GPT-4, Claude Sonnet)
   */
  protected async selectOptimalModel(
    intentAnalysis: IntentAnalysis,
    request: OrchestratorRequest,
    context: {
      canvasContext: CanvasContext
      conversationHistory: ConversationMessage[]
      availableProviders: string[]
      availableModels: TieredModel[]
    },
    ragContext: any
  ): Promise<{
    modelSelection: ModelSelection
    validatedFixedModelId: string | null
    ragContext: any
  }> {
    // Enhance with RAG if enabled
    let enhancedRagContext = ragContext
    if (this.config.enableRAG && 
        context.canvasContext.connectedNodes.length > 0 &&
        intentAnalysis.intent !== 'create_structure' &&
        intentAnalysis.intent !== 'clarify_intent') {
      enhancedRagContext = await enhanceContextWithRAG(
        request.message,
        context.canvasContext,
        undefined,
        context.conversationHistory.map(m => ({ role: m.role, content: m.content }))
      )
    }
    
    // Record intent in blackboard
    this.blackboard.setIntent(intentAnalysis.intent, intentAnalysis.confidence)
    
    // Assess task complexity
    const taskComplexity = assessTaskComplexity(
      intentAnalysis.intent,
      request.message.length + (enhancedRagContext?.ragContent?.length || 0),
      intentAnalysis.intent === 'rewrite_with_coherence'
    )
    
    // Validate fixed model if specified
    let validatedFixedModelId: string | null = null
    if (request.modelMode === 'fixed' && request.fixedModelId) {
      const isValidModel = context.availableModels.some(m => m.id === request.fixedModelId)
      if (isValidModel) {
        validatedFixedModelId = request.fixedModelId
      } else {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `⚠️ Configured model "${request.fixedModelId}" is no longer available. Auto-selecting the best model for this task instead.`,
          type: 'decision'
        })
      }
    }
    
    // Determine if reasoning is required
    const requiresReasoning = 
      intentAnalysis.intent === 'create_structure' ||
      intentAnalysis.intent === 'rewrite_with_coherence' ||
      taskComplexity === 'reasoning' ||
      taskComplexity === 'complex'
    
    // Select model
    const modelSelection = selectModel(
      taskComplexity,
      this.config.modelPriority,
      context.availableProviders,
      context.availableModels,
      requiresReasoning
    )
    
    // Log reasoning to blackboard
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
    
    return { modelSelection, validatedFixedModelId, ragContext: enhancedRagContext }
  }
  
  /**
   * Build Response: Constructs the final orchestrator response
   * 
   * This method assembles all the information into a final response that
   * the UI can use to display results and execute actions.
   * 
   * Response includes:
   * - Intent and confidence (what we think the user wants)
   * - Reasoning (why we made this decision)
   * - Model used (which AI model was selected)
   * - Actions (what needs to be executed)
   * - Canvas changes (whether canvas state changed)
   * - User input required (whether user needs to provide more info)
   * - Estimated cost (how much this request cost)
   * - Thinking steps (internal reasoning for debugging)
   * 
   * @param intentAnalysis - Analyzed user intent
   * @param remainingActions - Actions that weren't auto-executed
   * @param modelSelection - Selected AI model
   * @param canvasChanged - Whether canvas state changed
   * @param startTime - When orchestration started (for timing)
   * @returns Complete OrchestratorResponse ready for UI
   */
  protected buildResponse(
    intentAnalysis: IntentAnalysis,
    remainingActions: OrchestratorAction[],
    modelSelection: ModelSelection,
    canvasChanged: boolean,
    startTime: number
  ): OrchestratorResponse {
    // Extract thinking steps from blackboard
    const recentMessages = this.blackboard.getRecentMessages(10)
    const thinkingSteps = recentMessages
      .filter(m => m.role === 'orchestrator' && (m.type === 'thinking' || m.type === 'decision'))
      .map(m => ({ content: m.content, type: m.type || 'thinking' }))
    
    const response: OrchestratorResponse = {
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      reasoning: intentAnalysis.reasoning,
      modelUsed: modelSelection.modelId,
      actions: remainingActions,
      canvasChanged,
      requiresUserInput: intentAnalysis.needsClarification || remainingActions.some(a => a.requiresUserInput !== false) || false,
      estimatedCost: modelSelection.estimatedCost,
      thinkingSteps
    }
    
    // Learn pattern if enabled
    if (this.config.enablePatternLearning && intentAnalysis.confidence > 0.8) {
      // Note: extractPattern needs canvasContext, but we can skip it here
      // as pattern learning is optional
    }
    
    // Record action
    this.blackboard.recordAction(intentAnalysis.intent, {
      confidence: intentAnalysis.confidence,
      modelUsed: modelSelection.modelId,
      taskComplexity: assessTaskComplexity(intentAnalysis.intent, 0, false),
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
    
    return response
  }
  
  // ============================================================================
  // PUBLIC API - Clarification & Confirmation Handling
  // ============================================================================
  // These methods handle user responses to clarification and confirmation requests.
  // They're optimized to skip full orchestration since we already know the context.
  
  /**
   * Continue Clarification: Processes user's clarification response
   * 
   * When the orchestrator asks a clarification question (e.g., "Which template?"),
   * the user responds with their choice. This method processes that response.
   * 
   * Why This Exists:
   * - More efficient than full orchestration (skips intent analysis)
   * - We already know the original action and context
   * - Directly interprets response and builds appropriate action
   * 
   * Response Interpretation:
   * - Direct matches: "1", "TV Pilot" → Exact option match
   * - Number matches: "2" → Option at index 1
   * - Natural language: "the first one", "go with podcast" → LLM interpretation
   * 
   * @param response - User's response (option label, number, or natural language)
   * @param clarificationContext - Original clarification context (question, options, payload)
   * @param request - Optional request context (will use WorldState if not provided)
   * @returns OrchestratorResponse with actions ready for execution
   * 
   * Example:
   * User asked: "Which template?" with options ["Three Act", "Hero's Journey"]
   * User responds: "the first one"
   * This method interprets → selects "Three Act" → creates create_structure action
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
  
  /**
   * Handle Clarification Option: UI-facing method for clarification clicks
   * 
   * This method is called by the UI when a user clicks a clarification option button.
   * It reads all necessary context from WorldState (single source of truth) and
   * processes the clarification response.
   * 
   * Architecture:
   * - UI Layer: Displays clarification options, receives clicks
   * - Logic Layer (this method): Reads from WorldState, processes, returns actions
   * 
   * WorldState Integration:
   * - Reads pending clarification from WorldState.ui.pendingClarification
   * - Reads canvas state, document state, models from WorldState
   * - Clears clarification from WorldState after successful processing
   * 
   * @param response - User's response (option label, ID, or natural language)
   * @param request - Optional request context (will be read from WorldState if not provided)
   * @returns OrchestratorResponse with actions ready for execution
   * 
   * @throws Error if WorldState is not available (required for this method)
   */
  async handleClarificationOption(
    response: string,
    request: Partial<OrchestratorRequest> = {}
  ): Promise<OrchestratorResponse> {
    // ✅ LOGIC LAYER: Read clarification from WorldState (single source of truth)
    if (!this.worldState) {
      throw new Error('WorldState required for clarification handling')
    }
    
    const state = this.worldState.getState()
    const pendingClarification = state.ui.pendingClarification
    
    if (!pendingClarification) {
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: '⚠️ No pending clarification found',
        type: 'error'
      })
      return {
        intent: 'general_chat',
        confidence: 0.1,
        reasoning: 'No clarification context available',
        modelUsed: 'none',
        actions: [],
        canvasChanged: false,
        requiresUserInput: true,
        estimatedCost: 0
      }
    }
    
    // ✅ LOGIC LAYER: Read all context from WorldState using existing helper methods
    // Build minimal request - helpers will read from WorldState
    // Note: Provide defaults for required fields - helpers will override from WorldState
    const minimalRequest: OrchestratorRequest = {
      message: response,
      canvasNodes: request.canvasNodes || [],
      canvasEdges: request.canvasEdges || [],
      structureItems: request.structureItems,
      contentMap: request.contentMap,
      currentStoryStructureNodeId: request.currentStoryStructureNodeId,
      documentFormat: request.documentFormat,
      availableModels: request.availableModels,
      availableProviders: request.availableProviders,
      userKeyId: request.userKeyId
    }
    
    // ✅ LOGIC LAYER: Use existing helper methods that read from WorldState
    const canvasNodes = this.getCanvasNodes(minimalRequest)
    const canvasEdges = this.getCanvasEdges(minimalRequest)
    const structureItems = this.getStructureItems(minimalRequest)
    const contentMap = this.getContentMap(minimalRequest)
    const currentStoryStructureNodeId = minimalRequest.currentStoryStructureNodeId || state.activeDocument.nodeId
    const documentFormat = this.getDocumentFormat(minimalRequest)
    const availableModels = this.getAvailableModels(minimalRequest)
    const availableProviders = this.getAvailableProviders(minimalRequest)
    const userKeyId = minimalRequest.userKeyId || state.user.apiKeys.orchestratorKeyId
    
    // ✅ LOGIC LAYER: Process clarification using existing continueClarification method
    const result = await this.continueClarification(
      response,
      {
        originalAction: pendingClarification.originalIntent,
        question: pendingClarification.question,
        options: pendingClarification.options,
        payload: pendingClarification.originalPayload
      },
      {
        canvasNodes,
        canvasEdges,
        structureItems,
        contentMap,
        currentStoryStructureNodeId,
        documentFormat,
        availableModels,
        availableProviders,
        userKeyId
      }
    )
    
    // ✅ LOGIC LAYER: Clear clarification from WorldState after successful processing
    // Only clear if we got non-clarification actions (not another clarification request)
    const hasNonClarificationActions = result.actions.some(
      a => a.type !== 'request_clarification'
    )
    
    if (hasNonClarificationActions) {
      this.worldState.update(draft => {
        draft.ui.pendingClarification = null
      })
    }
    
    return result
  }
  
  /**
   * Continue Confirmation: Processes user's confirmation response
   * 
   * When the orchestrator asks for confirmation (e.g., "Delete this node?"),
   * the user responds with "yes", "no", or selects an option. This method
   * processes that response and builds the appropriate action.
   * 
   * Confirmation Types:
   * - Destructive: "Delete this node?" → Requires explicit confirmation
   * - Permission: "Allow access?" → Requires permission
   * - Info: "Proceed with this action?" → Informational confirmation
   * - Clarification: Multiple choice confirmation
   * 
   * Response Processing:
   * - Yes/No: "yes", "y", "confirm", "ok" → Confirmed
   * - Cancel: "no", "n", "cancel" → Cancelled
   * - Option selection: User selects from multiple options
   * 
   * Why This Exists:
   * - Logic stays in orchestrator (maintains architectural separation)
   * - Single source of truth for action building
   * - Easier to test and maintain
   * - Consistent with continueClarification() pattern
   * 
   * @param response - User's response ("yes", "no", or selected option)
   * @param confirmationContext - Original confirmation context (action type, payload, options)
   * @param request - Optional request context
   * @returns OrchestratorResponse with action to execute (or empty if cancelled)
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
    return continueConfirmationHelper(
      response,
      confirmationContext,
      request,
      this.blackboard,
      this.worldState,
      (actionType, originalPayload, selectedOption) =>
        this.buildActionFromConfirmation(actionType, originalPayload, selectedOption)
    )
  }
  
  // ============================================================================
  // PROTECTED CLARIFICATION & CONFIRMATION HELPERS
  // ============================================================================
  // These methods handle the internal logic for clarification and confirmation.
  // They're protected so subclasses can override if needed.
  
  /**
   * Handle Clarification Response: Internal method for processing clarifications
   * 
   * This is called by orchestrate() when request.clarificationContext is present.
   * It delegates to the clarification helper module for better organization.
   * 
   * @param request - Request with clarificationContext
   * @returns OrchestratorResponse with actions based on user's clarification choice
   */
  protected async handleClarificationResponse(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    return handleClarificationResponseHelper(
      request,
      this.blackboard,
      (originalAction, selectedOption, payload, req) => 
        this.buildActionFromClarification(originalAction, selectedOption, payload, req)
    )
  }
  
  /**
   * Build Action From Clarification: Creates action based on clarification choice
   * 
   * When user selects a clarification option, this method builds the appropriate
   * action. The action type depends on the original action that needed clarification.
   * 
   * @param originalAction - Original action type (create_structure, open_and_write, etc.)
   * @param selectedOption - User's selected option (id, label, description)
   * @param payload - Original action payload
   * @param request - User request context
   * @returns OrchestratorResponse with appropriate actions
   */
  protected async buildActionFromClarification(
    originalAction: string,
    selectedOption: {id: string, label: string, description: string},
    payload: any,
    request: OrchestratorRequest
  ): Promise<OrchestratorResponse> {
    return buildActionFromClarificationHelper(
      originalAction,
      selectedOption,
      payload,
      request,
      this.blackboard,
      this.actionGenerators
    )
  }
  
  /**
   * Build Action From Confirmation: Creates action based on confirmation choice
   * 
   * When user confirms an action, this method builds the appropriate action
   * based on the original action type and selected option.
   * 
   * @param actionType - Original action type that needed confirmation
   * @param originalPayload - Original action payload
   * @param selectedOption - User's selected option (for multi-choice confirmations)
   * @returns OrchestratorAction ready for execution
   */
  protected buildActionFromConfirmation(
    actionType: string,
    originalPayload: any,
    selectedOption: {id: string, label: string, description?: string}
  ): OrchestratorAction {
    return buildActionFromConfirmationHelper(actionType, originalPayload, selectedOption)
  }
  
  // ============================================================================
  // PROTECTED UTILITY METHODS
  // ============================================================================
  // These methods provide access to internal state for subclasses.
  // They're protected so MultiAgentOrchestrator can access them.
  
  /**
   * Get Blackboard: Returns the conversation memory and agent communication hub
   * 
   * Used by subclasses (MultiAgentOrchestrator) to access blackboard functionality.
   * 
   * @returns Blackboard instance
   */
  protected getBlackboard(): Blackboard {
    return this.blackboard
  }
  
  /**
   * Get Config: Returns the orchestrator configuration
   * 
   * Used by subclasses to access configuration settings.
   * 
   * @returns Orchestrator configuration object
   */
  protected getConfig() {
    return this.config
  }
  
  /**
   * Create Snapshot: Creates a temporal snapshot of the conversation state
   * 
   * Useful for debugging or restoring conversation state.
   * 
   * @returns Promise that resolves when snapshot is created
   */
  async createSnapshot(): Promise<void> {
    await this.blackboard.createSnapshot()
  }
  
  /**
   * Reset: Clears all orchestrator state
   * 
   * Resets the blackboard (conversation memory) to start fresh.
   * Useful for testing or when user wants to start over.
   */
  reset(): void {
    this.blackboard.reset()
    console.log('🔄 [Orchestrator] Reset')
  }
  
  // ============================================================================
  // PROTECTED WORLDSTATE HELPERS
  // ============================================================================
  // These methods provide access to application state from WorldState or request props.
  // They follow a priority: WorldState (if available) > Request Props (fallback)
  // 
  // Why These Exist:
  // - Backward compatibility: Code can still use request props
  // - Gradual migration: WorldState is optional during migration
  // - Single source of truth: When WorldState is available, it's authoritative
  // 
  // All methods delegate to helper functions in orchestratorEngine.helpers.ts
  // for better testability and organization.
  
  /**
   * Get Canvas Nodes: Retrieves canvas nodes from WorldState or request
   * 
   * Priority: WorldState.canvas.nodes > request.canvasNodes
   * 
   * @param request - Request with optional canvasNodes
   * @returns Array of canvas nodes
   */
  protected getCanvasNodes(request: OrchestratorRequest): Node[] {
    return getCanvasNodesHelper(this.worldState, request)
  }
  
  /**
   * Get Canvas Edges: Retrieves canvas edges from WorldState or request
   * 
   * @param request - Request with optional canvasEdges
   * @returns Array of canvas edges
   */
  protected getCanvasEdges(request: OrchestratorRequest): Edge[] {
    return getCanvasEdgesHelper(this.worldState, request)
  }
  
  /**
   * Get Active Context: Retrieves active document context
   * 
   * @param request - Request with optional activeContext
   * @returns Active context (document ID and name) or undefined
   */
  protected getActiveContext(request: OrchestratorRequest): {id: string, name: string} | undefined {
    return getActiveContextHelper(this.worldState, request)
  }
  
  /**
   * Is Document View Open: Checks if document view is currently open
   * 
   * @param request - Request with optional isDocumentViewOpen
   * @returns True if document view is open, false otherwise
   */
  protected isDocumentViewOpen(request: OrchestratorRequest): boolean {
    return isDocumentViewOpenHelper(this.worldState, request)
  }
  
  /**
   * Get Document Format: Retrieves current document format
   * 
   * @param request - Request with optional documentFormat
   * @returns Document format (novel, screenplay, etc.) or undefined
   */
  protected getDocumentFormat(request: OrchestratorRequest): string | undefined {
    return getDocumentFormatHelper(this.worldState, request)
  }
  
  /**
   * Get Structure Items: Retrieves structure items from active document
   * 
   * @param request - Request with optional structureItems
   * @returns Array of structure items (sections, chapters, etc.) or undefined
   */
  protected getStructureItems(request: OrchestratorRequest): any[] | undefined {
    return getStructureItemsHelper(this.worldState, request)
  }
  
  /**
   * Get Content Map: Retrieves content map from active document
   * 
   * @param request - Request with optional contentMap
   * @returns Content map (section ID → content) or undefined
   */
  protected getContentMap(request: OrchestratorRequest): Record<string, string> | undefined {
    return getContentMapHelper(this.worldState, request)
  }
  
  /**
   * Get Available Providers: Retrieves available API providers
   * 
   * @param request - Request with optional availableProviders
   * @returns Array of provider names (openai, anthropic, etc.) or undefined
   */
  protected getAvailableProviders(request: OrchestratorRequest): string[] | undefined {
    return getAvailableProvidersHelper(this.worldState, request)
  }
  
  /**
   * Get Available Models: Retrieves available AI models
   * 
   * @param request - Request with optional availableModels
   * @returns Array of TieredModel objects or undefined
   */
  protected getAvailableModels(request: OrchestratorRequest): TieredModel[] | undefined {
    return getAvailableModelsHelper(this.worldState, request)
  }
  
  /**
   * Get Model Preferences: Retrieves user's model selection preferences
   * 
   * @param request - Request with optional model preferences
   * @returns Model preferences (mode, fixed model ID, strategy) or defaults
   */
  protected getModelPreferences(request: OrchestratorRequest): {
    modelMode?: 'automatic' | 'fixed'
    fixedModelId?: string | null
    fixedModeStrategy?: 'consistent' | 'loose'
  } {
    return getModelPreferencesHelper(this.worldState, request)
  }
  
  // ============================================================================
  // PROTECTED ACTION PROCESSING METHODS
  // ============================================================================
  // These methods handle action generation, dependency resolution, and execution.
  // They're protected so subclasses can override or extend them.
  
  /**
   * Generate Actions: Creates actions based on intent analysis
   * 
   * This method delegates to the appropriate action generator based on the
   * detected intent. Each intent has a dedicated action generator class that
   * knows how to create the right actions.
   * 
   * Action Generation Flow:
   * 1. Look up action generator for intent (e.g., CreateStructureAction for create_structure)
   * 2. Call generator.generate() with intent, request, and context
   * 3. Generator returns array of actions (generate_content, open_document, etc.)
   * 4. Fallback to default handling for unknown intents
   * 
   * @param intent - Analyzed user intent
   * @param request - User request with context
   * @param canvasContext - Canvas state and relationships
   * @param ragContext - RAG-enhanced context (if enabled)
   * @param modelSelection - Selected AI model
   * @param validatedFixedModelId - Validated fixed model ID (if user specified)
   * @param availableModels - Available models for delegation
   * @returns Array of OrchestratorActions ready for processing
   */
  protected async generateActions(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    canvasContext: CanvasContext,
    ragContext: any,
    modelSelection: any,
    validatedFixedModelId: string | null = null,
    availableModels?: TieredModel[] // PHASE 2: Available models for writer delegation
  ): Promise<OrchestratorAction[]> {
    return generateActionsHelper(
      intent,
      request,
      canvasContext,
      ragContext,
      modelSelection,
      validatedFixedModelId,
      availableModels,
      this.actionGenerators
    )
  }
  
  /**
   * Process Action Dependencies: Handles action execution order and auto-execution
   * 
   * This method processes actions and determines which can be auto-executed
   * and which need UI interaction. It handles:
   * 
   * 1. Dependency Resolution:
   *    - Topological sorting of actions based on dependencies
   *    - Ensures dependencies execute before dependent actions
   * 
   * 2. Auto-Execution:
   *    - Simple actions (select_section, message) can execute automatically
   *    - Complex actions (generate_content) are sent to UI/MultiAgentOrchestrator
   * 
   * 3. Action Categorization:
   *    - Auto-executable: Actions with autoExecute: true and no dependencies
   *    - UI-required: Actions that need user interaction or complex processing
   * 
   * @param actions - Array of actions to process
   * @param request - Original user request (for context)
   * @returns Object with executedActions (auto-executed) and remainingActions (for UI)
   */
  protected async processActionDependencies(
    actions: OrchestratorAction[],
    request: OrchestratorRequest
  ): Promise<{
    executedActions: OrchestratorAction[]
    remainingActions: OrchestratorAction[]
  }> {
    return processActionDependenciesHelper(
      actions,
      request,
      (action, req) => this.executeActionDirectly(action, req)
    )
  }
  
  /**
   * Execute Action Directly: Executes a simple action without UI interaction
   * 
   * This method handles actions that can be executed automatically:
   * - select_section: Navigation (marked as complete, actual nav handled by UI)
   * - message: Displays message to user via onMessage callback
   * - generate_content: Should not reach here (handled by MultiAgentOrchestrator)
   * 
   * Note: Most actions require UI interaction and are not auto-executed.
   * This method only handles the simplest cases.
   * 
   * @param action - Action to execute
   * @param request - Original user request (for context)
   * @returns Promise that resolves when action is executed
   */
  protected async executeActionDirectly(
    action: OrchestratorAction,
    request: OrchestratorRequest
  ): Promise<void> {
    return executeActionDirectlyHelper(
      action,
      request,
      this.config.onMessage
    )
  }

  // ============================================================================
  // PROTECTED LEARNING METHODS
  // ============================================================================
  // These methods handle pattern extraction and correction detection for learning.
  
  /**
   * Extract Pattern: Identifies learnable patterns from user interactions
   * 
   * This method analyzes user interactions to identify patterns that can be
   * learned and reused. Examples:
   * - User asks about "the plot" after discussing a document → resolve to that document
   * - User uses pronouns ("it", "this") → resolve to most recently discussed node
   * - User wants to write in existing node → open_and_write intent pattern
   * 
   * Patterns are stored in the blackboard for future use, improving the system's
   * ability to understand user intent over time.
   * 
   * @param message - User's message
   * @param intent - Analyzed intent
   * @param canvasContext - Canvas state and relationships
   * @returns Pattern object with pattern description and action, or null if no pattern found
   */
  protected extractPattern(
    message: string,
    intent: IntentAnalysis,
    canvasContext: CanvasContext
  ): { pattern: string; action: string } | null {
    return extractPatternHelper(
      message,
      intent,
      canvasContext,
      this.blackboard
    )
  }
  
  /**
   * Detect Correction From Message: Detects when user corrects a misclassification
   * 
   * This method analyzes user messages to detect correction patterns like:
   * - "I wanted create_structure, not write_content"
   * - "No, I meant open_and_write"
   * - "That's wrong, I wanted delete_node"
   * 
   * When a correction is detected, the system:
   * 1. Identifies the wrong intent (from previous orchestrator action)
   * 2. Extracts the correct intent (from correction message)
   * 3. Stores the correction pattern for future learning
   * 4. Overrides the current intent analysis with the corrected intent
   * 
   * @param message - User's message
   * @param conversationHistory - Recent conversation messages
   * @returns Correction info (wrong intent, correct intent, original message) or null
   */
  protected detectCorrectionFromMessage(
    message: string,
    conversationHistory: ConversationMessage[]
  ): { wrongIntent: string, correctIntent: string, originalMessage: string } | null {
    return detectCorrectionFromMessageHelper(message, conversationHistory)
  }
  
  // ============================================================================
  // PROTECTED STRUCTURE GENERATION METHODS
  // ============================================================================
  // These methods handle document structure generation with fallback and retry logic.
  // They're protected so CreateStructureAction can access them.
  
  /**
   * Create Structure Plan With Fallback: Generates structure with automatic retry
   * 
   * This method attempts to generate a document structure (novel, screenplay, etc.)
   * with the primary model. If it fails, it automatically falls back to alternative
   * models with structured output support.
   * 
   * Fallback Strategy:
   * 1. Try primary model (user preference or best match)
   * 2. If fails, try next best model with structured output
   * 3. Continue until success or all models exhausted
   * 4. Models are prioritized by: structured output support, speed, cost, tier
   * 
   * Why Fallback Exists:
   * - Structure generation is complex and can fail
   * - Different models have different capabilities
   * - User's preferred model might not be available
   * - Automatic retry improves reliability
   * 
   * @param userPrompt - User's creative prompt (e.g., "a story about dragons")
   * @param format - Document format (novel, screenplay, podcast, etc.)
   * @param primaryModelId - Preferred model ID (user choice or best match)
   * @param userKeyId - User's API key ID for authentication
   * @param availableModels - Models available to the user
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @returns StructurePlan with sections, tasks, and metadata
   * 
   * @throws Error if all models fail or no models with structured output are available
   */
  protected async createStructurePlanWithFallback(
    userPrompt: string,
    format: string,
    primaryModelId: string,
    userKeyId: string,
    availableModels: TieredModel[],
    maxRetries: number = STRUCTURE_GENERATION_CONFIG.MAX_RETRIES
  ): Promise<StructurePlan> {
    return createStructurePlanWithFallbackHelper(
      userPrompt,
      format,
      primaryModelId,
      userKeyId,
      availableModels,
      this.blackboard,
      (up, f, mid, ukid) => this.createStructurePlan(up, f, mid, ukid),
      maxRetries
    )
  }
  
  
  /**
   * Create Structure Plan: Core structure generation logic
   * 
   * This method generates a document structure plan using the specified AI model.
   * It handles different structured output formats:
   * - OpenAI: Native JSON schema validation
   * - Anthropic: Tool use (forced)
   * - Google: Function calling
   * - JSON mode: Fallback for models without full structured output
   * 
   * Generation Process:
   * 1. Build format-specific instructions and system prompt
   * 2. Call AI model with structured output format
   * 3. Parse response (handles different provider formats)
   * 4. Validate with Zod schema
   * 5. Return validated structure plan
   * 
   * Progress Tracking:
   * - Shows progress steps (1/4, 2/4, etc.)
   * - Heartbeat messages for long-running requests
   * - Detailed error messages on failure
   * 
   * @param userPrompt - User's creative prompt
   * @param format - Document format (novel, screenplay, etc.)
   * @param modelId - AI model ID to use
   * @param userKeyId - User's API key ID
   * @returns StructurePlan with validated structure and tasks
   * 
   * @throws Error if generation fails, times out, or validation fails
   */
  protected async createStructurePlan(
    userPrompt: string,
    format: string,
    modelId: string,
    userKeyId: string
  ): Promise<StructurePlan> {
    return createStructurePlanHelper(
      userPrompt,
      format,
      modelId,
      userKeyId,
      this.blackboard
    )
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================
// These functions create and manage OrchestratorEngine instances.
// They provide a convenient API for getting orchestrators with proper caching.

/**
 * Orchestrator Cache: In-memory cache of orchestrator instances
 * 
 * Key format: userId + (worldState ? '-ws' : '')
 * - Without WorldState: userId only (cached)
 * - With WorldState: userId + '-ws' (always fresh, not cached)
 * 
 * Note: WorldState instances are not cached to ensure fresh state.
 */
const orchestrators = new Map<string, OrchestratorEngine>()

/**
 * Get Orchestrator: Gets or creates an OrchestratorEngine instance
 * 
 * This is the primary factory function for getting orchestrator instances.
 * It implements caching to avoid creating multiple instances for the same user.
 * 
   * Caching Strategy:
   * - Without WorldState: Cached by userId (reuses instance)
   * - With WorldState: Always creates new instance (ensures fresh state)
   * 
   * @param userId - User ID for the orchestrator
   * @param config - Optional partial configuration (merged with defaults)
   * @param worldState - Optional unified state manager
   * @returns OrchestratorEngine instance
   * 
   * Example:
   * ```typescript
   * const orchestrator = getOrchestrator(user.id, {
   *   modelPriority: 'quality',
   *   enableRAG: true
   * }, worldState)
   * ```
   */
export function getOrchestrator(
  userId: string, 
  config?: Partial<OrchestratorConfig>,
  worldState?: WorldStateManager
): OrchestratorEngine {
  // Build cache key: include WorldState indicator to ensure fresh instances
  const cacheKey = userId + (worldState ? '-ws' : '')
  
  // Create new instance if not cached or if WorldState is provided
  // (WorldState instances are never cached to ensure fresh state)
  if (!orchestrators.has(cacheKey) || worldState) {
    orchestrators.set(cacheKey, new OrchestratorEngine({
      userId,
      ...config
    }, worldState))
  }
  return orchestrators.get(cacheKey)!
}

/**
 * Get Multi-Agent Orchestrator: Creates a MultiAgentOrchestrator instance
 * 
 * This factory creates a MultiAgentOrchestrator, which extends OrchestratorEngine
 * with multi-agent coordination capabilities (parallel, sequential, cluster strategies).
 * 
 * Why Runtime Import:
 * - Avoids circular dependency (MultiAgentOrchestrator imports OrchestratorEngine)
 * - Imported at runtime using require() to break the cycle
 * 
 * Caching:
 * - Always creates new instance (agent pool needs fresh state)
 * - TODO: Implement proper caching with state updates
 * 
 * @param userId - User ID for the orchestrator
 * @param config - Optional partial configuration
 * @param worldState - Optional unified state manager
 * @returns MultiAgentOrchestrator instance
 * 
 * Note: Return type is 'any' to avoid circular dependency in type system.
 * The actual return type is MultiAgentOrchestrator.
 */
export function getMultiAgentOrchestrator(
  userId: string,
  config?: Partial<OrchestratorConfig>,
  worldState?: WorldStateManager
): any {
  // Import at runtime to avoid circular dependency
  const { MultiAgentOrchestrator } = require('../agents/MultiAgentOrchestrator')
  
  // Always create new instance for now (agent pool needs fresh state)
  // TODO: Implement proper caching with state updates
  return new MultiAgentOrchestrator({
    userId,
    ...config
  }, worldState)
}

/**
 * Create Orchestrator: Creates a new OrchestratorEngine and adds it to cache
 * 
 * This is a lower-level factory that explicitly creates and caches an instance.
 * Use getOrchestrator() for most cases (it handles caching automatically).
 * 
 * @param config - Full orchestrator configuration
 * @param worldState - Optional unified state manager
 * @returns New OrchestratorEngine instance (also cached)
 */
export function createOrchestrator(
  config: OrchestratorConfig, 
  worldState?: WorldStateManager
): OrchestratorEngine {
  const orchestrator = new OrchestratorEngine(config, worldState)
  orchestrators.set(config.userId, orchestrator)
  return orchestrator
}

