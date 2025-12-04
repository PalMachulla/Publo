/**
 * Multi-Agent Orchestrator - Advanced Task Coordination with AI Agents
 *
 * ============================================================================
 * WHAT IS THIS FILE?
 * ============================================================================
 *
 * This file extends the base `OrchestratorEngine` with multi-agent coordination
 * capabilities. While `OrchestratorEngine` analyzes user intent and generates
 * actions, `MultiAgentOrchestrator` takes those actions and intelligently executes
 * them using a pool of specialized AI agents (writers, critics) with different
 * execution strategies.
 *
 * Think of it as the "conductor with a full orchestra" - it not only coordinates
 * but also has specialized musicians (agents) that can work in parallel, sequentially,
 * or collaboratively (writer-critic clusters) to produce high-quality content.
 *
 * ============================================================================
 * WHERE DOES IT FIT IN THE FLOW?
 * ============================================================================
 *
 * User Types Message
 *        ↓
 * OrchestratorPanel.tsx (UI component)
 *        ↓
 * OrchestratorEngine.orchestrate() (base class)
 *        ↓
 *    [Analyzes intent, generates actions]
 *        ↓
 * MultiAgentOrchestrator.orchestrate() (THIS FILE - overrides base)
 *        ↓
 *    [Filters actions, selects execution strategy]
 *        ↓
 *    ┌─────────────┬──────────────┬──────────────┐
 *    │             │              │              │
 *    ↓             ↓              ↓              ↓
 * Sequential   Parallel      Cluster        UI Actions
 * (Simple)     (DAG-based)   (Writer+Critic) (User interaction)
 *    │             │              │              │
 *    └─────────────┴──────────────┴──────────────┘
 *        ↓
 * Tools & Agents (WriterAgent, CriticAgent via ToolRegistry)
 *        ↓
 * LLM APIs (OpenAI, Anthropic, etc.)
 *        ↓
 * Response back to UI with generated content
 *
 * ============================================================================
 * KEY RESPONSIBILITIES
 * ============================================================================
 *
 * 1. ACTION FILTERING: Separates actions into:
 *    - Agent-executable: Content generation that can run automatically
 *    - UI-required: Actions needing user interaction (clarifications, confirmations)
 *    - Dependency-sequenced: Actions that must execute in order
 *
 * 2. STRATEGY SELECTION: Uses LLM reasoning to choose optimal execution strategy:
 *    - SEQUENTIAL: Simple tasks (1-2 actions) - safe, one at a time
 *    - PARALLEL: Independent tasks (3+ chapters/scenes) - fast, uses DAG for dependency resolution
 *    - CLUSTER: High-quality tasks (1-2 important sections) - writer + critic collaboration
 *
 * 3. AGENT COORDINATION: Manages a pool of specialized agents:
 *    - WriterAgent: Generates content for sections
 *    - CriticAgent: Reviews and improves content quality
 *    - AgentRegistry: Tracks agent availability and performance
 *
 * 4. DEPENDENCY RESOLUTION: Handles action dependencies using DAG (Directed Acyclic Graph):
 *    - Ensures dependencies execute before dependents
 *    - Example: select_section must execute before generate_content
 *    - open_document must execute before generate_content for that document
 *
 * 5. TOOL INTEGRATION: Executes actions via ToolRegistry:
 *    - write_content tool: Generates content using WriterAgent
 *    - create_structure tool: Creates document structures
 *    - Other tools: Navigation, deletion, etc.
 *
 * ============================================================================
 * FILES IT INTERACTS WITH
 * ============================================================================
 *
 * EXTENDS:
 *   - OrchestratorEngine: Base orchestrator class (inherits intent analysis, action generation)
 *
 * USES (Agent Infrastructure):
 *   - AgentRegistry: Manages agent pool (writers, critics)
 *   - DAGExecutor: Handles dependency resolution for parallel execution
 *   - WriterAgent: Specialized agent for content generation
 *   - CriticAgent: Specialized agent for content review and improvement
 *   - WriterCriticCluster: Collaborative writer-critic loops (currently disabled)
 *
 * USES (Core Systems):
 *   - Blackboard: Conversation memory and agent communication (inherited from base)
 *   - WorldState: Application state (canvas, documents) - inherited from base
 *   - ToolRegistry: Executable tools system (from config)
 *
 * CALLED BY:
 *   - OrchestratorPanel.tsx: UI component that uses MultiAgentOrchestrator for complex tasks
 *   - orchestratorEngine.ts: Factory function getMultiAgentOrchestrator()
 *
 * CALLS:
 *   - ToolRegistry.execute(): Executes actions via tools (write_content, etc.)
 *   - AgentRegistry: Manages agent pool and task assignment
 *   - DAGExecutor: Builds dependency graphs and execution order
 *
 * ============================================================================
 * EXECUTION STRATEGIES
 * ============================================================================
 *
 * 1. SEQUENTIAL:
 *    - Use case: Simple tasks, 1-2 actions, mixed action types
 *    - Execution: One action at a time, in order
 *    - Agents: Single writer agent per action
 *    - Speed: Slowest (but safest)
 *    - Quality: Good (standard writer quality)
 *
 * 2. PARALLEL:
 *    - Use case: 3+ independent content sections (chapters, scenes)
 *    - Execution: Multiple actions simultaneously using DAG for dependencies
 *    - Agents: Multiple writer agents working in parallel
 *    - Speed: Fastest (parallel execution)
 *    - Quality: Good (standard writer quality)
 *
 * 3. CLUSTER:
 *    - Use case: 1-2 high-priority sections (first chapters, key scenes)
 *    - Execution: Writer-critic collaboration with iterative refinement
 *    - Agents: Writer + Critic working together
 *    - Speed: Slowest (iterative refinement)
 *    - Quality: Best (critic-reviewed and improved)
 *    - Note: Currently disabled (useCluster: false) - see PHASE3_COMPLETE.md
 *
 * ============================================================================
 * ARCHITECTURE NOTES
 * ============================================================================
 *
 * - Inheritance: Extends OrchestratorEngine, overrides orchestrate() method
 * - Protected Access: Uses protected methods from base class (getBlackboard(), getConfig())
 * - Tool-Based Execution: All agent execution goes through ToolRegistry (not direct agent calls)
 * - WorldState Required: Most operations require WorldState for state management
 * - Dependency Injection: Receives ToolRegistry via config.toolRegistry
 */

// ============================================================================
// CORE DEPENDENCIES - Base Orchestrator
// ============================================================================

/**
 * OrchestratorEngine: Base orchestrator class that this extends
 * - Provides intent analysis, action generation, context preparation
 * - MultiAgentOrchestrator overrides orchestrate() to add agent execution
 * - Inherits protected methods: getBlackboard(), getConfig(), prepareContext(), etc.
 */
import { OrchestratorEngine } from '../core/orchestratorEngine'

/**
 * Blackboard & ConversationMessage: Conversation memory and message types
 * - Blackboard: Central communication hub for agents (inherited from base)
 * - ConversationMessage: Type for messages stored in blackboard
 * - Used for: Agent communication, conversation history, execution tracking
 */
import type { Blackboard, ConversationMessage } from '../core/blackboard'

/**
 * Orchestrator Types: Configuration, request, and action types
 * - OrchestratorConfig: Configuration for orchestrator (userId, preferences, toolRegistry)
 * - OrchestratorRequest: User request with message, canvas state, preferences
 * - OrchestratorAction: Individual action to execute (generate_content, open_document, etc.)
 * - Used for: Type safety, method signatures, action processing
 */
import type { 
  OrchestratorConfig, 
  OrchestratorRequest,
  OrchestratorAction 
} from '../core/orchestratorEngine'

/**
 * WorldStateManager: Unified application state manager
 * - Single source of truth for canvas, documents, orchestrator status
 * - Required for: Tool execution, state updates, document access
 * - Inherited from base class as protected worldState
 */
import type { WorldStateManager } from '../core/worldState'

// ============================================================================
// AGENT INFRASTRUCTURE
// ============================================================================

/**
 * AgentRegistry: Manages the pool of available agents
 * - Tracks agent availability (writers, critics)
 * - Assigns tasks to agents
 * - Monitors agent performance
 * - Used for: Agent pool management, task assignment, performance tracking
 */
import { AgentRegistry } from './AgentRegistry'

/**
 * DAGExecutor: Handles dependency resolution for parallel execution
 * - Builds Directed Acyclic Graph (DAG) from actions with dependencies
 * - Determines execution order (batches of parallel tasks)
 * - Ensures dependencies execute before dependents
 * - Used for: Parallel execution strategy, dependency resolution
 */
import { DAGExecutor } from './DAGExecutor'

/**
 * WriterAgent: Specialized agent for content generation
 * - Generates content for document sections
 * - Used by: ToolRegistry (write_content tool) for actual content generation
 * - Note: Not directly instantiated here - created during agent pool initialization
 */
import { WriterAgent } from './WriterAgent'

/**
 * CriticAgent: Specialized agent for content review and improvement
 * - Reviews generated content for quality
 * - Provides feedback for iterative improvement
 * - Used by: WriterCriticCluster for collaborative refinement (currently disabled)
 * - Note: Not directly instantiated here - created during agent pool initialization
 */
import { CriticAgent } from './CriticAgent'

/**
 * WriterCriticCluster: Collaborative writer-critic loops
 * - Coordinates writer and critic agents for iterative refinement
 * - Used for: Cluster execution strategy (high-quality content)
 * - Status: Currently disabled (useCluster: false) - see PHASE3_COMPLETE.md
 * - To be investigated: May be legacy/unused if cluster strategy is permanently disabled
 */
import { WriterCriticCluster } from './clusters/WriterCriticCluster'

/**
 * Agent Types: Type definitions for agent system
 * - AgentTask: Task representation for agents (id, type, payload, dependencies)
 * - ExecutionStrategy: Strategy type ('sequential' | 'parallel' | 'cluster')
 * - DAGNode: Node in dependency graph (for DAGExecutor)
 * - Used for: Type safety in agent coordination
 */
import type { AgentTask, ExecutionStrategy, DAGNode } from './types'

/**
 * Content Persistence Utilities: Functions for saving agent-generated content
 * - saveAgentContent: Saves single agent content to database
 * - batchSaveAgentContent: Saves multiple agent contents in batch
 * - To be investigated: May be unused if content persistence is handled by tools
 */
import { saveAgentContent, batchSaveAgentContent } from './utils/contentPersistence'

// ============================================================================
// MULTI-AGENT ORCHESTRATOR CLASS
// ============================================================================

/**
 * MultiAgentOrchestrator: Advanced Orchestrator with Multi-Agent Coordination
 * 
 * This class extends OrchestratorEngine to add intelligent multi-agent execution
 * capabilities. It analyzes generated actions and executes them using specialized
 * AI agents (writers, critics) with optimal execution strategies.
 * 
 * CLASS STRUCTURE:
 * 
 * 1. CONSTRUCTOR
 *    - Calls super() to initialize base OrchestratorEngine
 *    - Initializes AgentRegistry (agent pool management)
 *    - Initializes DAGExecutor (dependency resolution)
 *    - Creates agent pool (3 writers, 2 critics)
 * 
 * 2. OVERRIDDEN METHODS
 *    - orchestrate(): Overrides base class to add agent execution
 *      - Calls super.orchestrate() for intent analysis and action generation
 *      - Filters actions (agent-executable vs UI-required)
 *      - Handles action dependencies
 *      - Executes actions with agents using selected strategy
 * 
 * 3. STRATEGY SELECTION
 *    - analyzeExecutionStrategy(): Uses LLM to select optimal strategy
 *    - Considers: Task complexity, action count, model performance, user expectations
 * 
 * 4. EXECUTION METHODS
 *    - executeSequential(): Simple one-at-a-time execution
 *    - executeParallel(): Parallel execution with DAG dependency resolution
 *    - executeCluster(): Writer-critic collaboration (currently disabled)
 * 
 * 5. DEPENDENCY HANDLING
 *    - executeSequencedActions(): Resolves and executes actions in dependency order
 *    - Handles: select_section → generate_content, open_document → generate_content
 * 
 * 6. UTILITY METHODS
 *    - actionsToTasks(): Converts OrchestratorActions to AgentTasks
 *    - actionTypeToToolName(): Maps action types to tool names
 *    - getAgentStats(): Returns agent performance statistics
 */
export class MultiAgentOrchestrator extends OrchestratorEngine {
  // ============================================================================
  // CLASS PROPERTIES
  // ============================================================================
  
  /**
   * AgentRegistry: Manages the pool of available agents
   * - Tracks agent availability (writers, critics)
   * - Assigns tasks to agents
   * - Monitors agent performance
   */
  private agentRegistry: AgentRegistry
  
  /**
   * DAGExecutor: Handles dependency resolution for parallel execution
   * - Builds DAG from actions with dependencies
   * - Determines execution order (batches of parallel tasks)
   * - Used by: executeParallel() strategy
   */
  private dagExecutor: DAGExecutor
  
  // ============================================================================
  // CONSTRUCTOR
  // ============================================================================
  
  /**
   * Creates a new MultiAgentOrchestrator instance
   * 
   * Initialization Steps:
   * 1. Calls super() to initialize base OrchestratorEngine (Blackboard, WorldState, etc.)
   * 2. Initializes AgentRegistry (agent pool management)
   * 3. Initializes DAGExecutor (dependency resolution for parallel execution)
   * 4. Creates agent pool (3 writers, 2 critics)
   * 5. Logs initialization to Blackboard for UI visibility
   * 
   * @param config - Orchestrator configuration (must include toolRegistry for execution)
   * @param worldState - Optional unified state manager (required for tool execution)
   * 
   * Architecture Notes:
   * - ToolRegistry: Must be provided in config.toolRegistry for agent execution
   * - WorldState: Required for most operations (tool execution, state updates)
   * - Agent Pool: Created during initialization (3 writers, 2 critics)
   * - Blackboard: Inherited from base class, shared with agents for communication
   */
  constructor(
    config: OrchestratorConfig,
    worldState?: WorldStateManager
  ) {
    // Step 1: Initialize base OrchestratorEngine
    super(config, worldState)
    
    // Step 2: Initialize agent infrastructure
    // AgentRegistry manages the pool of available agents
    this.agentRegistry = new AgentRegistry(this.getAgentBlackboard())
    
    // DAGExecutor handles dependency resolution for parallel execution
    this.dagExecutor = new DAGExecutor(this.getAgentBlackboard(), this.agentRegistry)
    
    // Step 3: Create agent pool (3 writers, 2 critics)
    this.initializeAgents()
    
    // Log initialization
    console.log('🤖 [MultiAgentOrchestrator] Initialized with multi-agent coordination')
    console.log('   Has WorldState:', !!this.worldState)
    
    // Log to Blackboard for UI visibility
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: '🤖 Multi-agent system initialized',
      type: 'thinking'
    })
  }
  
  // ============================================================================
  // OVERRIDDEN METHODS - Main Entry Point
  // ============================================================================
  
  /**
   * Orchestrate: Overrides base class to add agent execution
   * 
   * This is the main entry point that extends the base OrchestratorEngine's
   * orchestration with intelligent multi-agent execution.
   * 
   * EXECUTION FLOW:
   * 
   * 1. CALL BASE ORCHESTRATE
   *    - Calls super.orchestrate() to analyze intent and generate actions
   *    - Base class handles: context preparation, intent analysis, model selection, action generation
   * 
   * 2. FILTER ACTIONS
   *    - Separates actions into three groups:
   *      - actionsForAgentExecution: Content generation that can run automatically (has nodeId)
   *      - actionsForSequencing: Actions with dependencies that need ordered execution
   *      - actionsForUI: Actions requiring user interaction or can't be auto-executed
   * 
   * 3. HANDLE DEPENDENCIES
   *    - Processes actions with dependencies (select_section → generate_content)
   *    - Executes dependencies first, then dependents
   *    - Extracts nodeId from open_document actions for dependent generate_content
   * 
   * 4. EXECUTE WITH AGENTS
   *    - Selects execution strategy (sequential, parallel, cluster) using LLM reasoning
   *    - Executes actions via ToolRegistry (tools → agents → LLM APIs)
   *    - Captures agent messages for UI display
   * 
   * 5. RETURN RESPONSE
   *    - Returns only UI-required actions (agent-executed actions are already complete)
   *    - Includes agent thinking steps in response.thinkingSteps
   * 
   * @param request - User request with message, canvas state, preferences, etc.
   * @returns OrchestratorResponse with UI-required actions and agent thinking steps
   * 
   * Example:
   * User: "Write chapters 1, 2, and 3"
   * → Base generates 3 generate_content actions
   * → This method filters: all 3 are agent-executable (has nodeId)
   * → Strategy: PARALLEL (3+ independent sections)
   * → Executes all 3 in parallel via tools
   * → Returns empty actions array (all executed) + thinking steps
   */
  async orchestrate(request: any): Promise<any> {
    // Step 1: Call parent to analyze and generate actions
    const response = await super.orchestrate(request)
    
    // 🔍 DEBUG: Log what actions were generated
    console.log('🔍 [MultiAgentOrchestrator] Actions generated:', {
      count: response.actions?.length || 0,
      actions: response.actions?.map((a: any) => ({
        type: a.type,
        sectionId: a.payload?.sectionId,
        sectionName: a.payload?.sectionName,
        autoStart: a.payload?.autoStart
      }))
    })
    
    // Step 2: Process action dependencies and sequencing
    // ✅ NEW: Handle action dependencies and auto-execution
    const hasNodeId = !!(request?.currentStoryStructureNodeId)
    const originalActionCount = response.actions?.length || 0
    
    // Split actions into three groups:
    // 1. actionsForAgentExecution: generate_content actions when we HAVE a node ID (auto-executable)
    // 2. actionsForSequencing: Actions with dependencies that need to be executed in order
    // 3. actionsForUI: Actions that require user interaction or can't be auto-executed
    const actionsForAgentExecution: OrchestratorAction[] = []
    const actionsForSequencing: OrchestratorAction[] = []
    const actionsForUI: OrchestratorAction[] = []
    
    response.actions?.forEach(a => {
      // Actions that require user input always go to UI
      if (a.requiresUserInput === true) {
        actionsForUI.push(a)
        console.log(`  📤 Returning to UI (requiresUserInput): ${a.type}`)
        return
      }
      
      // generate_content actions: route based on type
      if (a.type === 'generate_content') {
        // ✅ FIX: Questions (isAnswer: true) should always go to UI, not agents
        if (a.payload?.isAnswer === true) {
          actionsForUI.push(a)
          console.log(`  📤 Returning to UI (isAnswer): ${a.type}`)
          return
        }
        
        // Regular content generation: execute via agents if we have node ID
        if (hasNodeId) {
          // Check if this action has dependencies
          if (a.dependsOn && a.dependsOn.length > 0) {
            // Has dependencies - add to sequencing queue
            actionsForSequencing.push(a)
            console.log(`  🔗 Queued for sequencing (depends on: ${a.dependsOn.join(', ')}): ${a.type}`)
          } else {
            // No dependencies - execute immediately
            actionsForAgentExecution.push(a)
            console.log(`  ✅ Agent will execute: ${a.type} (${a.payload?.sectionName})`)
          }
          return
        }
      }
      
      // select_section actions: execute first if they're dependencies
      if (a.type === 'select_section' && a.autoExecute === true) {
        // Execute navigation first (it's a dependency for generate_content)
        actionsForSequencing.push(a)
        console.log(`  🔗 Queued for sequencing (navigation): ${a.type}`)
        return
      }
      
      // open_document actions: if other actions depend on it, add to sequencing
      // Check if any other actions depend on open_document
      if (a.type === 'open_document') {
        const isDependency = response.actions?.some(otherAction => 
          otherAction.dependsOn?.includes('open_document')
        )
        if (isDependency) {
          // This open_document is a dependency - add to sequencing so it gets marked complete
          actionsForSequencing.push(a)
          console.log(`  🔗 Queued for sequencing (dependency): ${a.type}`)
          return
        }
        // Not a dependency - send to UI normally
        actionsForUI.push(a)
        console.log(`  📤 Returning to UI: ${a.type}`)
        return
      }
      
      // Default: send to UI
      actionsForUI.push(a)
      console.log(`  📤 Returning to UI: ${a.type}`)
    })
    
    // Step 2.5: Execute actions in dependency order
    // ✅ NEW: Process sequenced actions (dependencies first)
    if (actionsForSequencing.length > 0) {
      const sequencedResult = await this.executeSequencedActions(
        actionsForSequencing,
        actionsForAgentExecution,
        request
      )
      // Add any auto-executed actions to the agent execution queue
      actionsForAgentExecution.push(...sequencedResult.agentActions)
      // Add any remaining actions to UI
      actionsForUI.push(...sequencedResult.uiActions)
    }
    
    console.log('🔍 [MultiAgentOrchestrator] Action split:', {
      total: originalActionCount,
      forAgents: actionsForAgentExecution.length,
      forUI: actionsForUI.length,
      hasNodeId
    })
    
    // Step 3: Get the blackboard message count BEFORE agent execution
    const messagesBefore = this.getAgentBlackboard().getRecentMessages(1000).length
    
    // Step 4: Execute ONLY the filtered actions with agents
    if (actionsForAgentExecution.length > 0) {
      const sessionId = `session-${Date.now()}`
      
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: `🚀 Starting agent execution for ${actionsForAgentExecution.length} action(s)`,
        type: 'progress'
      })
      
      try {
        // Pass the request so agents have access to currentStoryStructureNodeId
        await this.executeActionsWithAgents(actionsForAgentExecution, sessionId, request)
        
        this.getAgentBlackboard().addMessage({
          role: 'orchestrator',
          content: `✅ Agent execution complete`,
          type: 'result'
        })
      } catch (error) {
        console.error('[MultiAgentOrchestrator] Agent execution failed:', error)
        
        this.getAgentBlackboard().addMessage({
          role: 'orchestrator',
          content: `❌ Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'error'
        })
      }
    }
    
    // Step 5: Extract NEW messages for UI display (messages added during agent execution)
    const messagesAfter = this.getAgentBlackboard().getRecentMessages(1000)
    const newMessages = messagesAfter.slice(messagesBefore)
    
    // Step 6: Add new messages to thinkingSteps for UI display
    if (newMessages.length > 0) {
      const agentSteps = newMessages.map((m: ConversationMessage) => ({
        content: m.content,
        type: m.type || 'progress'
      }))
      
      // Append agent messages to existing thinking steps
      response.thinkingSteps = [...(response.thinkingSteps || []), ...agentSteps]
      
      console.log(`📨 [MultiAgentOrchestrator] Added ${agentSteps.length} agent messages to UI`)
    }
    
    // Step 7: Return ONLY UI actions (already filtered above)
    
    response.actions = actionsForUI
    
    console.log('✅ [MultiAgentOrchestrator] Orchestration complete:', {
      intent: response.intent,
      totalActionsGenerated: originalActionCount,
      agentExecutedActions: actionsForAgentExecution.length,
      actionsReturnedToUI: actionsForUI.length,
      messagesSent: newMessages.length,
      currentNodeId: request?.currentStoryStructureNodeId
    })
    
    return response
  }
  
  // ============================================================================
  // AGENT INITIALIZATION
  // ============================================================================
  
  /**
   * Initialize Agents: Creates the agent pool
   * 
   * This method creates a pool of specialized agents that will be used for
   * content generation. The pool consists of:
   * - 3 WriterAgent instances: For parallel content generation
   * - 2 CriticAgent instances: For content review (used in cluster strategy, currently disabled)
   * 
   * Agent Pool Strategy:
   * - Writers: Multiple instances allow parallel execution of independent tasks
   * - Critics: Fewer instances since they're only used in cluster mode (currently disabled)
   * 
   * Registration:
   * - Agents are registered with AgentRegistry
   * - AgentRegistry tracks availability and assigns tasks
   * - Agents share the same Blackboard for communication
   * 
   * Note: Agents are created but not directly used here. They're accessed via
   * ToolRegistry when tools (write_content) are executed.
   */
  private initializeAgents(): void {
    const userId = this.getConfig().userId
    
    // Create writer agents (3 for parallel processing)
    for (let i = 0; i < 3; i++) {
      const writer = new WriterAgent(`writer-${i}`, userId)
      this.agentRegistry.register(writer)
    }
    
    // Create critic agents (2 for parallel review)
    for (let i = 0; i < 2; i++) {
      const critic = new CriticAgent(`critic-${i}`, userId)
      this.agentRegistry.register(critic)
    }
    
    const stats = this.agentRegistry.getStats()
    console.log(`✅ [MultiAgentOrchestrator] Agent pool ready: ${stats.totalAgents} agents (${stats.agentsByType.writer || 0} writers, ${stats.agentsByType.critic || 0} critics)`)
  }
  
  // ============================================================================
  // STRATEGY SELECTION
  // ============================================================================
  
  /**
   * Analyze Execution Strategy: Uses LLM to select optimal execution strategy
   * 
   * This method uses LLM reasoning to intelligently select the best execution
   * strategy based on task characteristics, context, and available resources.
   * 
   * Strategy Selection Criteria:
   * - SEQUENTIAL: Simple tasks, 1-2 actions, mixed action types, non-content actions
   * - PARALLEL: 3+ independent content sections, speed is important, model performance allows it
   * - CLUSTER: 1-2 high-priority sections, quality is critical, first chapters/key scenes
   * 
   * LLM Analysis Factors:
   * - Total actions and content generation actions count
   * - Action details (sections, types, dependencies)
   * - Recent conversation context
   * - Blackboard state (active agents)
   * - Model performance metrics (cost, speed) when available
   * - Section importance (first chapters, opening scenes)
   * 
   * Model Performance Integration:
   * - Uses actual model metadata (cost_per_1k_tokens_input, speed_tokens_per_sec)
   * - Considers model performance when making efficiency decisions
   * - Focuses on writing models (not reasoning models) for parallel execution
   * 
   * Fallback:
   * - If LLM analysis fails, defaults to SEQUENTIAL (safest option)
   * - Logs error to Blackboard for UI visibility
   * 
   * @param actions - Actions to execute
   * @param blackboard - Conversation memory for context
   * @param worldState - Application state (for context)
   * @param availableModels - Available models with performance metadata
   * @returns Selected strategy ('sequential' | 'parallel' | 'cluster') with reasoning
   * 
   * Example:
   * Input: 5 generate_content actions for chapters 1-5
   * LLM Analysis: "5 independent sections, speed important, models support parallel"
   * Output: { strategy: 'parallel', reasoning: '...' }
   */
  private async analyzeExecutionStrategy(
    actions: OrchestratorAction[],
    blackboard: Blackboard,
    worldState: any,
    availableModels?: any[] // ✅ STEP 4: Accept available models with metadata
  ): Promise<{
    strategy: ExecutionStrategy
    reasoning: string
  }> {
    // Build context for LLM
    const actionSummary = actions.map(a => ({
      type: a.type,
      section: a.payload?.sectionName || null,
      isContent: a.type === 'generate_content'
    }))
    
    const contentActions = actions.filter(a => a.type === 'generate_content')
    
    // Get recent blackboard messages for context
    const recentMessages = blackboard.getRecentMessages(5)
    const context = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')
    
    // ✅ STEP 4: Build model performance summary from metadata
    let modelPerformanceInfo = 'Not available'
    if (availableModels && availableModels.length > 0) {
      const performanceSummary = availableModels
        .filter(m => m.reasoning === false) // Focus on writing models (not reasoning models)
        .slice(0, 5) // Top 5 models
        .map(m => {
          const enriched = m as any
          const cost = enriched.cost_per_1k_tokens_input 
            ? `$${enriched.cost_per_1k_tokens_input.toFixed(4)}/1k`
            : enriched.cost || 'unknown'
          const speed = enriched.speed_tokens_per_sec 
            ? `${enriched.speed_tokens_per_sec} tokens/sec`
            : enriched.speed || 'unknown'
          return `- ${m.displayName}: ${cost}, ${speed}, tier: ${m.tier}`
        })
        .join('\n')
      
      if (performanceSummary) {
        modelPerformanceInfo = `Available writing models:\n${performanceSummary}`
      }
    }
    
    const systemPrompt = `You are an intelligent execution strategy selector for a multi-agent writing system.

Available strategies:
1. SEQUENTIAL - Execute actions one after another (safe, slower)
2. PARALLEL - Execute multiple content generations simultaneously using DAG (fast, efficient)
3. CLUSTER - Use Writer-Critic collaboration for high-quality iterative refinement (best quality, slower)

Context:
- Total actions: ${actions.length}
- Content generation actions: ${contentActions.length}
- Action details: ${JSON.stringify(actionSummary, null, 2)}
- Recent activity: ${context}
- Blackboard state: ${blackboard.getAllAgents().length} agents active
- ${modelPerformanceInfo}

Decision criteria:
- SEQUENTIAL: Use for simple tasks, non-content actions, or mixed action types
- PARALLEL: Use for 3+ independent content sections (chapters, scenes, etc.) where speed is important. Consider actual model speed when available.
- CLUSTER: Use for 1-2 high-priority content sections where quality is critical (first chapters, openings, key scenes)

Consider:
- Section importance (first chapters, opening scenes are high-priority)
- User's implicit quality expectations
- Task complexity and interdependencies
- Actual model performance (cost, speed) when making efficiency decisions

Respond in JSON format:
{
  "strategy": "sequential" | "parallel" | "cluster",
  "reasoning": "Brief explanation of why this strategy is best for this situation"
}`

    try {
      const response = await fetch('/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: `Actions to execute: ${JSON.stringify(actionSummary, null, 2)}\n\nWhat's the best execution strategy?`,
          temperature: 0.3 // Some creativity but mostly consistent
        })
      })

      if (!response.ok) {
        throw new Error(`Strategy selection failed: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Parse JSON with better error handling (same as analyzeTaskComplexity)
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
        console.error('❌ [Strategy Selection] JSON parse error:', parseError.message)
        console.error('   Content:', typeof data.content === 'string' ? data.content.substring(0, 500) : data.content)
        throw new Error(`Failed to parse strategy analysis: ${parseError.message}`)
      }
      
      // Normalize strategy to lowercase (LLM might return SEQUENTIAL, Sequential, etc.)
      const normalizedStrategy = (analysis.strategy || '').toLowerCase().trim()
      
      // Validate strategy
      const validStrategies: ExecutionStrategy[] = ['sequential', 'parallel', 'cluster']
      if (!validStrategies.includes(normalizedStrategy as ExecutionStrategy)) {
        throw new Error(`Invalid strategy: ${analysis.strategy} (normalized: ${normalizedStrategy})`)
      }
      
      return {
        strategy: normalizedStrategy as ExecutionStrategy,
        reasoning: analysis.reasoning
      }
    } catch (error) {
      console.error('❌ [Strategy Selection] Error:', error)
      
      // Log to Blackboard for UI visibility
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: `⚠️ Strategy selection failed, defaulting to sequential: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'warning'
      })
      
      // Fallback: Conservative sequential approach
      return {
        strategy: 'sequential',
        reasoning: 'Strategy analysis failed, defaulting to sequential execution for safety'
      }
    }
  }
  
  // ============================================================================
  // DEPENDENCY RESOLUTION
  // ============================================================================
  
  /**
   * Execute Sequenced Actions: Resolves and executes actions in dependency order
   * 
   * This method handles actions that have dependencies, ensuring dependencies
   * execute before dependents. It's a critical part of the orchestration flow
   * that enables complex multi-step operations.
   * 
   * DEPENDENCY TYPES:
   * 
   * 1. select_section → generate_content
   *    - Navigation must happen before content generation
   *    - Handled by: Marking select_section as complete, then allowing generate_content
   * 
   * 2. open_document → generate_content
   *    - Document must be open before generating content for it
   *    - Handled by: Extracting nodeId from open_document, injecting into generate_content
   * 
   * EXECUTION PROCESS:
   * 
   * 1. Dependency Detection:
   *    - Checks if select_section was already executed by base orchestrator
   *    - Tracks completed action types
   *    - Maps nodeIds from open_document actions
   * 
   * 2. Topological Sorting:
   *    - Sorts actions to process dependencies first
   *    - Actions with no dependencies come first
   *    - Actions with satisfied dependencies come next
   * 
   * 3. Action Execution:
   *    - select_section: Marked complete, sent to UI for actual navigation
   *    - open_document: Marked complete, nodeId stored, sent to UI for actual opening
   *    - generate_content: NodeId injected from open_document if needed, ready for agents
   * 
   * 4. Circular Dependency Prevention:
   *    - Detects infinite loops (no progress made)
   *    - Moves remaining actions to UI as fallback
   * 
   * @param sequencedActions - Actions with dependencies that need sequencing
   * @param agentActions - Actions ready for immediate agent execution (will be populated)
   * @param request - Original orchestrator request (for context and nodeId updates)
   * @returns Object with:
   *   - agentActions: Actions ready for agent execution (dependencies satisfied)
   *   - uiActions: Actions that need UI interaction (navigation, document opening)
   * 
   * Example:
   * Input: [
   *   { type: 'open_document', payload: { nodeId: 'doc-1' } },
   *   { type: 'generate_content', dependsOn: ['open_document'], payload: { sectionId: 's1' } }
   * ]
   * Process: open_document → extract nodeId → inject into generate_content → ready for agents
   * Output: { agentActions: [generate_content with nodeId], uiActions: [open_document] }
   */
  private async executeSequencedActions(
    sequencedActions: OrchestratorAction[],
    agentActions: OrchestratorAction[],
    request?: any
  ): Promise<{
    agentActions: OrchestratorAction[]
    uiActions: OrchestratorAction[]
  }> {
    const completedActionTypes = new Set<string>()
    const readyForAgentExecution: OrchestratorAction[] = []
    const uiActions: OrchestratorAction[] = []
    
    // ✅ Track node IDs from open_document actions for dependent generate_content actions
    const nodeIdByActionType = new Map<string, string>()
    
    // ✅ FIX: Check if select_section was already executed by base orchestrator
    // If generate_content depends on select_section but select_section isn't in the queue,
    // it means it was already auto-executed by the base orchestrator
    const hasSelectSectionDependency = sequencedActions.some(a => 
      a.type === 'generate_content' && a.dependsOn?.includes('select_section')
    )
    const hasSelectSectionInQueue = sequencedActions.some(a => a.type === 'select_section')
    
    if (hasSelectSectionDependency && !hasSelectSectionInQueue) {
      // select_section was already executed by base orchestrator, mark it as complete
      completedActionTypes.add('select_section')
      console.log('✅ [ActionSequencer] select_section was already executed by base orchestrator')
    }
    
    // Execute actions in dependency order
    const executeQueue = [...sequencedActions]
    const executed = new Set<string>()
    
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: `🔗 Processing ${sequencedActions.length} action(s) with dependencies...`,
      type: 'progress'
    })
    
    while (executeQueue.length > 0) {
      let progressMade = false
      
      // ✅ FIX: Sort actions to process dependencies first
      // Actions with no dependencies come first, then actions with satisfied dependencies
      executeQueue.sort((a, b) => {
        const aHasDeps = a.dependsOn && a.dependsOn.length > 0
        const bHasDeps = b.dependsOn && b.dependsOn.length > 0
        
        if (!aHasDeps && bHasDeps) return -1 // a comes first (no deps)
        if (aHasDeps && !bHasDeps) return 1  // b comes first (no deps)
        
        // Both have deps or both don't - check if deps are satisfied
        const aDepsSatisfied = !aHasDeps || a.dependsOn!.every(dep => completedActionTypes.has(dep))
        const bDepsSatisfied = !bHasDeps || b.dependsOn!.every(dep => completedActionTypes.has(dep))
        
        if (aDepsSatisfied && !bDepsSatisfied) return -1 // a comes first (deps satisfied)
        if (!aDepsSatisfied && bDepsSatisfied) return 1  // b comes first (deps satisfied)
        
        return 0 // Keep original order
      })
      
      for (let i = executeQueue.length - 1; i >= 0; i--) {
        const action = executeQueue[i]
        const actionKey = `${action.type}_${action.payload?.sectionId || i}`
        
        // Check if dependencies are satisfied
        const dependenciesSatisfied = !action.dependsOn || action.dependsOn.every(
          depType => completedActionTypes.has(depType)
        )
        
        if (dependenciesSatisfied && !executed.has(actionKey)) {
          // Execute dependency actions (like select_section, open_document) via UI callbacks
          if (action.type === 'select_section') {
            // Navigation is handled by UI - we just mark it as complete
            console.log(`📍 [ActionSequencer] Navigation dependency satisfied: ${action.payload?.sectionId}`)
            
            this.getAgentBlackboard().addMessage({
              role: 'orchestrator',
              content: `📍 Navigating to section: ${action.payload?.sectionName || action.payload?.sectionId}`,
              type: 'progress'
            })
            
            completedActionTypes.add('select_section')
            executed.add(actionKey)
            executeQueue.splice(i, 1)
            progressMade = true
            
            // Add to UI actions so navigation actually happens
            uiActions.push(action)
          } else if (action.type === 'open_document') {
            // open_document is handled by UI - we just mark it as complete
            const nodeId = action.payload?.nodeId
            const nodeName = action.payload?.nodeName || nodeId
            
            console.log(`📂 [ActionSequencer] Document opening dependency satisfied: ${nodeId}`)
            
            // ✅ Store node ID for dependent generate_content actions
            if (nodeId) {
              nodeIdByActionType.set('open_document', nodeId)
            }
            
            this.getAgentBlackboard().addMessage({
              role: 'orchestrator',
              content: `📂 Opening document: ${nodeName}`,
              type: 'progress'
            })
            
            completedActionTypes.add('open_document')
            executed.add(actionKey)
            executeQueue.splice(i, 1)
            progressMade = true
            
            // Add to UI actions so document actually opens
            uiActions.push(action)
          } else if (action.type === 'generate_content') {
            // ✅ FIX: Questions (isAnswer: true) should always go to UI, not agents
            // This is a defensive check in case an isAnswer action somehow got into sequencing
            if (action.payload?.isAnswer === true) {
              console.log(`📤 [ActionSequencer] Routing isAnswer action to UI: ${action.type}`)
              uiActions.push(action)
              completedActionTypes.add('generate_content')
              executed.add(actionKey)
              executeQueue.splice(i, 1)
              progressMade = true
              continue
            }
            
            // Content generation can now proceed (dependency satisfied)
            const sectionName = action.payload?.sectionName || action.payload?.sectionId || 'section'
            
            // ✅ FIX: If depends on open_document, extract nodeId from the dependency
            if (action.dependsOn?.includes('open_document')) {
              const nodeId = nodeIdByActionType.get('open_document')
              if (nodeId) {
                // ✅ Inject nodeId into action payload so executeActionsWithAgents can use it
                action.payload = {
                  ...action.payload,
                  nodeId: nodeId // Add nodeId to payload
                }
                
                // ✅ Also update request if available
                if (request) {
                  request.currentStoryStructureNodeId = nodeId
                }
                
                console.log(`✍️ [ActionSequencer] Content generation ready (using nodeId from open_document): ${sectionName}`)
                
                this.getAgentBlackboard().addMessage({
                  role: 'orchestrator',
                  content: `✍️ Ready to generate content for: ${sectionName}`,
                  type: 'progress'
                })
              } else {
                console.warn(`⚠️ [ActionSequencer] generate_content depends on open_document but no nodeId found`)
                
                this.getAgentBlackboard().addMessage({
                  role: 'orchestrator',
                  content: `⚠️ Waiting for document to open before generating: ${sectionName}`,
                  type: 'thinking'
                })
                
                // Send to UI as fallback
                uiActions.push(action)
                completedActionTypes.add('generate_content')
                executed.add(actionKey)
                executeQueue.splice(i, 1)
                progressMade = true
                continue
              }
            } else {
              console.log(`✍️ [ActionSequencer] Content generation dependency satisfied: ${sectionName}`)
              
              this.getAgentBlackboard().addMessage({
                role: 'orchestrator',
                content: `✍️ Ready to generate content for: ${sectionName}`,
                type: 'progress'
              })
            }
            
            readyForAgentExecution.push(action)
            completedActionTypes.add('generate_content')
            executed.add(actionKey)
            executeQueue.splice(i, 1)
            progressMade = true
          } else {
            // Unknown action type - send to UI
            uiActions.push(action)
            executed.add(actionKey)
            executeQueue.splice(i, 1)
            progressMade = true
          }
        }
      }
      
      // Prevent infinite loops
      if (!progressMade) {
        console.warn('⚠️ [ActionSequencer] Circular dependency or missing dependency detected')
        
        this.getAgentBlackboard().addMessage({
          role: 'orchestrator',
          content: `⚠️ Some actions couldn't be executed due to missing dependencies`,
          type: 'error'
        })
        
        // Move remaining actions to UI
        for (const action of executeQueue) {
          uiActions.push(action)
        }
        break
      }
    }
    
    if (readyForAgentExecution.length > 0) {
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: `✅ ${readyForAgentExecution.length} action(s) ready for content generation`,
        type: 'progress'
      })
    }
    
    return {
      agentActions: readyForAgentExecution,
      uiActions
    }
  }

  /**
   * Execute Actions With Agents: Main agent execution coordinator
   * 
   * This method coordinates the execution of actions using specialized AI agents.
   * It filters executable actions, selects an execution strategy, and routes
   * to the appropriate execution method.
   * 
   * EXECUTION FLOW:
   * 
   * 1. FILTER ACTIONS
   *    - Removes generate_structure (always executed by UI)
   *    - Validates generate_content has nodeId (required for execution)
   *    - Updates request with nodeId if extracted from action payload
   * 
   * 2. STRATEGY SELECTION
   *    - Calls analyzeExecutionStrategy() with LLM reasoning
   *    - Considers: Action count, complexity, model performance, user expectations
   *    - Returns: 'sequential' | 'parallel' | 'cluster' with reasoning
   * 
   * 3. ROUTE TO EXECUTION METHOD
   *    - SEQUENTIAL → executeSequential() (one at a time)
   *    - PARALLEL → executeParallel() (DAG-based parallel execution)
   *    - CLUSTER → executeCluster() (writer-critic collaboration)
   * 
   * 4. TOOL EXECUTION
   *    - All execution goes through ToolRegistry (not direct agent calls)
   *    - Tools (write_content) internally use agents (WriterAgent)
   *    - WorldState required for tool execution
   * 
   * @param actions - Actions to execute (should be pre-filtered for agent execution)
   * @param sessionId - Session identifier for tracking (defaults to timestamp)
   * @param request - Original orchestrator request (for nodeId, format, etc.)
   * @returns Promise that resolves when all actions are executed
   * 
   * Requirements:
   * - request.currentStoryStructureNodeId or action.payload.nodeId (for generate_content)
   * - config.toolRegistry (for tool execution)
   * - worldState (for tool execution and state updates)
   * 
   * Example:
   * Input: [generate_content for section1, generate_content for section2]
   * Strategy: PARALLEL (2 independent sections)
   * Execution: Both execute simultaneously via write_content tool
   * Result: Content generated for both sections
   */
  async executeActionsWithAgents(
    actions: OrchestratorAction[],
    sessionId: string = `session-${Date.now()}`,
    request?: any
  ): Promise<void> {
    if (actions.length === 0) {
      console.log('⚠️ [MultiAgentOrchestrator] No actions to execute')
      return
    }
    
    // ✅ FIX: Check nodeId from request OR from action payload (for open_document dependencies)
    const hasNodeId = !!(request?.currentStoryStructureNodeId)
    
    const executableActions = actions.filter(a => {
      // Structure generation is always executed by UI
      if (a.type === 'generate_structure') return false
      
      // Content generation requires a node ID
      if (a.type === 'generate_content') {
        // ✅ Check both request and action payload for nodeId
        const nodeId = request?.currentStoryStructureNodeId || a.payload?.nodeId
        
        if (!nodeId) {
          console.log(`⚠️ [MultiAgentOrchestrator] Skipping generate_content (no node ID): ${a.payload?.sectionName}`)
          
          this.getAgentBlackboard().addMessage({
            role: 'orchestrator',
            content: `⚠️ Cannot generate content for "${a.payload?.sectionName || 'section'}" - document not open`,
            type: 'error'
          })
          return false
        }
        
        // ✅ Update request with nodeId if it came from action payload
        if (!request?.currentStoryStructureNodeId && nodeId) {
          if (request) {
            request.currentStoryStructureNodeId = nodeId
          }
        }
        
        return true
      }
      
      return true
    })
    
    if (executableActions.length === 0) {
      console.log('⚠️ [MultiAgentOrchestrator] No executable actions (structure/content must be created by UI first)')
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: '📋 Waiting for document to be opened before generating content...',
        type: 'thinking'
      })
      return
    }
    
    console.log(`🔍 [MultiAgentOrchestrator] Filtered actions:`, {
      original: actions.length,
      executable: executableActions.length,
      skipped: actions.length - executableActions.length,
      hasNodeId
    })
    
    // 🧠 PHASE 3: LLM-powered strategy selection using Blackboard and WorldState
    // ✅ STEP 4: Pass available models with metadata for performance-aware strategy selection
    const availableModels = request?.availableModels || []
    const { strategy, reasoning } = await this.analyzeExecutionStrategy(
      executableActions,
      this.getAgentBlackboard(),
      this.worldState,
      availableModels // ✅ Pass models with metadata
    )
    
    console.log(`🎯 [MultiAgentOrchestrator] Strategy: ${strategy.toUpperCase()}`)
    console.log(`   Reasoning: ${reasoning}`)
    
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: `🎯 Execution strategy: ${strategy} - ${reasoning}`,
      type: 'decision'
    })
    
    // Route to appropriate execution method with FILTERED actions
    switch (strategy) {
      case 'sequential':
        await this.executeSequential(executableActions, request)
        break
        
      case 'parallel':
        await this.executeParallel(executableActions, sessionId, request)
        break
        
      case 'cluster':
        await this.executeCluster(executableActions, sessionId, request)
        break
    }
  }
  
  // ============================================================================
  // EXECUTION STRATEGIES
  // ============================================================================
  
  /**
   * Execute Sequential: Simple one-at-a-time execution
   * 
   * This strategy executes actions sequentially, one after another. It's the
   * safest option and is used for:
   * - Simple tasks (1-2 actions)
   * - Mixed action types (not all content generation)
   * - When dependencies require strict ordering
   * 
   * EXECUTION PROCESS:
   * 
   * 1. For each action:
   *    - Maps action type to tool name (generate_content → write_content)
   *    - Builds tool payload with action payload + nodeId + format
   *    - Executes via ToolRegistry
   *    - Logs progress to Blackboard
   * 
   * 2. Tool Execution:
   *    - Uses ToolRegistry.execute() with tool name and payload
   *    - Tools internally use agents (WriterAgent for write_content)
   *    - WorldState required for tool execution
   * 
   * 3. Error Handling:
   *    - Continues execution even if one action fails
   *    - Logs errors to console and Blackboard
   * 
   * @param actions - Actions to execute sequentially
   * @param request - Original orchestrator request (for nodeId, format, etc.)
   * @returns Promise that resolves when all actions are executed
   * 
   * Requirements:
   * - config.toolRegistry (for tool execution)
   * - worldState (for tool execution)
   * - request.currentStoryStructureNodeId (for generate_content actions)
   * 
   * Example:
   * Actions: [generate_content for section1, generate_content for section2]
   * Execution: section1 → wait → section2 → wait
   * Time: ~2x individual action time (sequential)
   */
  private async executeSequential(actions: OrchestratorAction[], request?: any): Promise<void> {
    console.log(`⏭️ [MultiAgentOrchestrator] Executing ${actions.length} action(s) sequentially via TOOL SYSTEM`)
    
    // Get tool registry from config
    const toolRegistry = (this as any).config?.toolRegistry
    if (!toolRegistry) {
      console.warn('⚠️ [MultiAgentOrchestrator] No tool registry available, skipping execution')
      return
    }
    
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: `⏭️ Sequential execution: ${actions.length} action(s)`,
      type: 'progress'
    })
    
    // Execute each action via tool system
    for (const action of actions) {
      console.log(`▶️ [MultiAgentOrchestrator] Executing: ${action.type}`)
      console.log(`   Payload:`, action.payload)
      
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: `▶️ ${action.type}: ${action.payload?.sectionName || action.payload?.prompt?.substring(0, 50) || 'processing...'}`,
        type: 'progress'
      })
      
      // Map action type to tool name
      const toolName = this.actionTypeToToolName(action.type)
      
      if (toolName && toolRegistry.has(toolName)) {
        try {
          // Build tool payload with node ID and format from request
          const toolPayload: any = {
            ...action.payload,
            useCluster: false // Sequential = simple writer, no cluster
          }
          
          // ✅ FIX: Pass storyStructureNodeId and format to tools (for content generation)
          if (toolName === 'write_content' && request?.currentStoryStructureNodeId) {
            toolPayload.storyStructureNodeId = request.currentStoryStructureNodeId
            toolPayload.format = request.documentFormat || 'novel'
            console.log(`🔧 [executeSequential] Adding node context to write_content:`, {
              nodeId: toolPayload.storyStructureNodeId,
              format: toolPayload.format
            })
          }
          
          // ✅ FIX: Access worldState from parent class (now protected)
          if (!this.worldState) {
            console.error('❌ [executeSequential] CRITICAL: worldState is undefined!')
            throw new Error('WorldState not available - cannot execute tools')
          }
          
          const toolResult = await toolRegistry.execute(
            toolName,
            toolPayload,
            {
              worldState: this.worldState,
              userId: this.getConfig().userId,
              userKeyId: request?.userKeyId,
              blackboard: this.getAgentBlackboard(),
              supabaseClient: request?.supabaseClient // ✅ FIX: Pass authenticated Supabase client
            }
          )
          
          if (toolResult.success) {
            console.log(`✅ [MultiAgentOrchestrator] Tool ${toolName} executed successfully`)
          } else {
            console.error(`❌ [MultiAgentOrchestrator] Tool ${toolName} failed:`, toolResult.error)
          }
        } catch (error) {
          console.error(`❌ [MultiAgentOrchestrator] Tool execution error:`, error)
        }
      } else {
        console.log(`⚠️ [MultiAgentOrchestrator] No tool available for action: ${action.type}`)
      }
    }
    
    console.log(`✅ [MultiAgentOrchestrator] Sequential execution complete`)
    
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: `✅ Sequential execution complete`,
      type: 'result'
    })
  }
  
  /**
   * Action Type To Tool Name: Maps OrchestratorAction types to ToolRegistry tool names
   * 
   * This utility method maps action types from the orchestrator to the corresponding
   * tool names in the ToolRegistry. It's used when executing actions via tools.
   * 
   * Mapping:
   * - generate_content → write_content (content generation tool)
   * - generate_structure → create_structure (structure generation tool)
   * - open_document → open_document (document opening tool)
   * - select_section → select_section (section navigation tool)
   * - delete_node → delete_node (node deletion tool)
   * - message → message (message display tool)
   * 
   * @param actionType - OrchestratorAction type (e.g., 'generate_content')
   * @returns ToolRegistry tool name (e.g., 'write_content') or null if no mapping
   */
  private actionTypeToToolName(actionType: string): string | null {
    const mapping: Record<string, string> = {
      'generate_content': 'write_content',
      'generate_structure': 'create_structure',
      'open_document': 'open_document',
      'select_section': 'select_section',
      'delete_node': 'delete_node',
      'message': 'message'
    }
    
    return mapping[actionType] || null
  }
  
  /**
   * Execute Parallel: Parallel execution with DAG dependency resolution
   * 
   * This strategy executes multiple actions simultaneously, using a DAG (Directed
   * Acyclic Graph) to handle dependencies. It's the fastest option for independent
   * tasks and is used for:
   * - 3+ independent content sections (chapters, scenes)
   * - When speed is important
   * - When model performance supports parallel execution
   * 
   * EXECUTION PROCESS:
   * 
   * 1. CONVERT TO TASKS
   *    - Converts OrchestratorActions to AgentTasks
   *    - Preserves dependencies and payload information
   * 
   * 2. BUILD DAG
   *    - Uses DAGExecutor to build dependency graph
   *    - Identifies independent tasks (can run in parallel)
   *    - Identifies dependent tasks (must wait for dependencies)
   * 
   * 3. GET EXECUTION ORDER
   *    - DAGExecutor returns batches of tasks
   *    - Each batch contains tasks that can run in parallel
   *    - Batches execute sequentially (batch 1 → batch 2 → ...)
   * 
   * 4. EXECUTE BATCHES
   *    - For each batch, execute all tasks in parallel
   *    - Uses Promise.all() for parallel execution
   *    - Maps tasks back to actions for tool execution
   *    - Executes via ToolRegistry (write_content tool)
   * 
   * 5. TRACK PROGRESS
   *    - Logs batch progress to Blackboard
   *    - Tracks completion and failure counts
   *    - Calculates execution time and speedup
   * 
   * DEPENDENCY HANDLING:
   * - Tasks with no dependencies: Execute in first batch
   * - Tasks with dependencies: Wait for dependencies to complete
   * - Example: If section2 depends on section1, they're in different batches
   * 
   * @param actions - Actions to execute in parallel
   * @param sessionId - Session identifier for tracking
   * @param request - Original orchestrator request (for nodeId, format, etc.)
   * @returns Promise that resolves when all actions are executed
   * 
   * Requirements:
   * - config.toolRegistry (for tool execution)
   * - worldState (for tool execution)
   * - request.currentStoryStructureNodeId (for generate_content actions)
   * 
   * Example:
   * Actions: [generate_content for ch1, ch2, ch3, ch4, ch5] (all independent)
   * DAG: All in batch 1 (no dependencies)
   * Execution: All 5 execute simultaneously
   * Time: ~1x individual action time (parallel) vs ~5x (sequential)
   * Speedup: ~5x faster than sequential
   */
  private async executeParallel(
    actions: OrchestratorAction[],
    sessionId: string,
    request?: any
  ): Promise<void> {
    console.log(`🔀 [MultiAgentOrchestrator] Executing ${actions.length} action(s) in parallel via TOOL SYSTEM`)
    
    // Get tool registry from config
    const toolRegistry = (this as any).config?.toolRegistry
    if (!toolRegistry) {
      console.warn('⚠️ [MultiAgentOrchestrator] No tool registry available, skipping execution')
      return
    }
    
    // Convert actions to tasks for dependency analysis
    const tasks = this.actionsToTasks(actions)
    
    // Build DAG from tasks for batching (dependency resolution)
    const dag = this.dagExecutor.buildDAG(tasks)
    const batches = this.dagExecutor.getExecutionOrder(dag)
    
    // Log execution plan
    console.log('📋 [MultiAgentOrchestrator] Execution plan:')
    batches.forEach((batch, idx) => {
      console.log(`   Batch ${idx + 1}: ${batch.length} task(s) in parallel`)
      
      // Add to UI
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: `📦 Batch ${idx + 1}: ${batch.length} tasks in parallel`,
        type: 'progress'
      })
    })
    
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: `🔀 Parallel execution: ${actions.length} actions across ${batches.length} batch(es) via tools`,
      type: 'progress'
    })
    
    // Execute batches sequentially, tasks within each batch in parallel
    const startTime = Date.now()
    let completedCount = 0
    let failedCount = 0
    
    try {
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batchTaskIds = batches[batchIdx] // These are IDs
        
        console.log(`🔀 [executeParallel] Processing batch ${batchIdx + 1}/${batches.length} (${batchTaskIds.length} tasks)`)
        
        this.getAgentBlackboard().addMessage({
          role: 'orchestrator',
          content: `⚙️ Processing batch ${batchIdx + 1}/${batches.length} (${batchTaskIds.length} tasks in parallel)`,
          type: 'progress'
        })
        
        // Map tasks back to actions (tasks were created from actions)
        // Fetch task objects from DAG using IDs
        const batchTasks = batchTaskIds.map(id => dag.get(id)?.task).filter(t => t)
        
        console.log(`🔍 [executeParallel] Mapping ${batchTasks.length} tasks to actions...`)
        console.log(`   Task IDs:`, batchTaskIds)
        console.log(`   Action IDs:`, actions.map(a => a.payload?.sectionId))
        
        const batchActions = batchTasks.map(task => {
          // Find corresponding action by sectionId
          return actions.find(a => a.payload?.sectionId === task?.payload?.context?.section?.id)
        }).filter(a => a !== undefined) as OrchestratorAction[]
        
        console.log(`✅ [executeParallel] Mapped ${batchActions.length}/${batchTaskIds.length} tasks to actions`)
        
        if (batchActions.length === 0) {
          console.error(`❌ [executeParallel] CRITICAL: No actions mapped! Tasks won't execute!`)
          console.error(`   This means task/action ID mismatch`)
          continue // Skip this batch
        }
        
        console.log(`✅ [executeParallel] Starting execution of ${batchActions.length} tools...`)
        
        // Execute all tasks in this batch in parallel using tools
        const batchPromises = batchActions.map(async (action) => {
          const toolName = this.actionTypeToToolName(action.type)
          console.log(`🔧 [executeParallel] Tool: ${toolName} | Section: ${action.payload?.sectionName || action.payload?.sectionId}`)
          
          if (toolName && toolRegistry.has(toolName)) {
            try {
              // Build tool payload with node ID and format from request
              const toolPayload: any = {
                ...action.payload,
                useCluster: false // Parallel = simple writer for speed
              }
              
              // ✅ Pass storyStructureNodeId and format to tools
              if (toolName === 'write_content' && request?.currentStoryStructureNodeId) {
                toolPayload.storyStructureNodeId = request.currentStoryStructureNodeId
                toolPayload.format = request.documentFormat || 'novel'
              }
              
              // ✅ FIX: Access worldState from parent class (now protected)
              if (!this.worldState) {
                console.error('❌ [executeParallel] CRITICAL: worldState is undefined!')
                throw new Error('WorldState not available - cannot execute tools')
              }
              
              const toolResult = await toolRegistry.execute(
                toolName,
                toolPayload,
                {
                  worldState: this.worldState,
                  userId: this.getConfig().userId,
                  userKeyId: request?.userKeyId,
                  blackboard: this.getAgentBlackboard(),
                  supabaseClient: request?.supabaseClient // ✅ FIX: Pass authenticated Supabase client
                }
              )
              
              if (toolResult.success) {
                completedCount++
                console.log(`✅ [executeParallel] Tool ${toolName} completed: ${action.payload?.sectionName}`)
              } else {
                failedCount++
                console.error(`❌ [executeParallel] Tool ${toolName} failed:`, toolResult.error)
              }
              
              return toolResult
            } catch (error) {
              failedCount++
              console.error(`❌ [executeParallel] Tool execution error:`, error)
              return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
            }
          } else {
            console.warn(`⚠️ [executeParallel] No tool for action: ${action.type}`)
            return { success: false, error: `No tool available for ${action.type}` }
          }
        })
        
        // Wait for all tasks in this batch to complete
        await Promise.all(batchPromises)
        
        console.log(`✅ [executeParallel] Batch ${batchIdx + 1} complete (${completedCount}/${actions.length} total)`)
      }
      
      const executionTime = Date.now() - startTime
      const speedup = batches.length > 1 ? `~${batches.length}x faster` : ''
      
      console.log(`✅ [MultiAgentOrchestrator] Parallel execution complete`)
      console.log(`   Completed: ${completedCount}/${actions.length}`)
      console.log(`   Failed: ${failedCount}`)
      console.log(`   Time: ${executionTime}ms`)
      
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: `✅ Completed ${completedCount}/${actions.length} tasks in ${(executionTime / 1000).toFixed(1)}s ${speedup}`,
        type: 'result'
      })
      
      if (failedCount > 0) {
        this.getAgentBlackboard().addMessage({
          role: 'orchestrator',
          content: `⚠️ ${failedCount} task(s) failed`,
          type: 'error'
        })
      }
    } catch (error) {
      console.error(`❌ [MultiAgentOrchestrator] Parallel execution error:`, error)
      
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: `❌ Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
      
      throw error
    }
  }
  
  /**
   * Execute Cluster: Writer-critic collaboration for high-quality content
   * 
   * This strategy uses writer-critic collaboration for iterative refinement,
   * producing the highest quality content. It's used for:
   * - 1-2 high-priority sections (first chapters, key scenes)
   * - When quality is more important than speed
   * - Important content that needs review and improvement
   * 
   * EXECUTION PROCESS:
   * 
   * 1. For each generate_content action:
   *    - Calls write_content tool with useCluster flag
   *    - Tool coordinates WriterAgent + CriticAgent collaboration
   *    - Writer generates content, Critic reviews and provides feedback
   *    - Iterative refinement until quality threshold met
   * 
   * 2. Quality Metrics:
   *    - Tool returns quality metrics (wordCount, finalScore, iterations)
   *    - Logs metrics to Blackboard for UI display
   * 
   * CURRENT STATUS:
   * - useCluster is currently set to false (disabled)
   * - See PHASE3_COMPLETE.md "Known Limitations" for details
   * - When enabled, would use WriterCriticCluster for collaboration
   * 
   * @param actions - Actions to execute with cluster strategy
   * @param sessionId - Session identifier for tracking
   * @param request - Original orchestrator request (for nodeId, format, etc.)
   * @returns Promise that resolves when all actions are executed
   * 
   * Requirements:
   * - config.toolRegistry (for tool execution)
   * - worldState (required, checked at start)
   * - request.currentStoryStructureNodeId (for generate_content actions)
   * 
   * Example:
   * Action: generate_content for "Chapter 1: Opening Scene"
   * Execution: Writer generates → Critic reviews → Writer improves → Critic approves
   * Result: High-quality content with quality score and iteration count
   * Time: ~3-5x individual action time (iterative refinement)
   */
  private async executeCluster(
    actions: OrchestratorAction[],
    sessionId: string,
    request?: any
  ): Promise<void> {
    console.log(`🔄 [MultiAgentOrchestrator] Executing with writer-critic cluster via TOOL SYSTEM`)
    
    // Check WorldState availability (CRITICAL FIX)
    if (!this.worldState) {
      console.error('❌ [executeCluster] CRITICAL: worldState is undefined!')
      this.getAgentBlackboard().addMessage({
        role: 'orchestrator',
        content: '❌ System Error: WorldState not available for cluster execution.',
        type: 'error'
      })
      throw new Error('WorldState not available - cannot execute tools in cluster mode')
    }

    // Get tool registry from config
    const toolRegistry = (this as any).config?.toolRegistry
    if (!toolRegistry) {
      console.warn('⚠️ [MultiAgentOrchestrator] No tool registry available, skipping execution')
      return
    }
    
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: `🔄 Using writer-critic cluster for high-quality generation`,
      type: 'progress'
    })
    
    // Execute each generate_content action via write_content tool
    for (const action of actions) {
      if (action.type === 'generate_content') {
        try {
          console.log(`🔧 [MultiAgentOrchestrator] Calling write_content tool for: ${action.payload?.sectionName}`)
          
          // ✅ FIX: Pass storyStructureNodeId and format from request
          const storyStructureNodeId = request?.currentStoryStructureNodeId || 
                                       (this as any).worldState?.getState().canvas.activeDocumentNodeId
          const format = request?.documentFormat || 'novel'
          
          console.log(`🔧 [executeCluster] Adding node context to write_content:`, {
            nodeId: storyStructureNodeId,
            format: format
          })
          
          // Execute via tool system (Tools → Agents → API)
          const toolResult = await toolRegistry.execute(
            'write_content',
            {
              sectionId: action.payload?.sectionId,
              sectionName: action.payload?.sectionName,
              prompt: action.payload?.prompt,
              useCluster: false, // ⚠️ DISABLED: See PHASE3_COMPLETE.md "Known Limitations"
              storyStructureNodeId, // ✅ Pass node ID
              format // ✅ Pass document format
            },
            {
              worldState: this.worldState, // ✅ Guaranteed defined by check above
              userId: this.getConfig().userId,
              userKeyId: request?.userKeyId,
              blackboard: this.getAgentBlackboard(),
              supabaseClient: request?.supabaseClient // ✅ FIX: Pass authenticated Supabase client
            }
          )
          
          if (toolResult.success) {
            console.log(`✅ [MultiAgentOrchestrator] Tool execution successful`)
            
            // Tool result already includes quality metrics
            const metadata = toolResult.metadata || {}
            this.getAgentBlackboard().addMessage({
              role: 'orchestrator',
              content: `✨ Generated ${metadata.wordCount || 0} words (quality: ${metadata.finalScore || 0}/10, ${metadata.iterations || 1} iteration${metadata.iterations > 1 ? 's' : ''})`,
              type: 'result'
            })
          } else {
            console.error(`❌ [MultiAgentOrchestrator] Tool execution failed:`, toolResult.error)
            
            this.getAgentBlackboard().addMessage({
              role: 'orchestrator',
              content: `❌ Failed to generate content: ${toolResult.error}`,
              type: 'error'
            })
          }
        } catch (error) {
          console.error(`❌ [MultiAgentOrchestrator] Tool execution error:`, error)
          
          this.getAgentBlackboard().addMessage({
            role: 'orchestrator',
            content: `❌ Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error'
          })
        }
      } else {
        // For non-content actions, log that we're skipping
        console.log(`⏭️ [MultiAgentOrchestrator] Skipping non-content action: ${action.type}`)
      }
    }
  }
  
  // ============================================================================
  // TASK CONVERSION UTILITIES
  // ============================================================================
  
  /**
   * Actions To Tasks: Converts OrchestratorActions to AgentTasks
   * 
   * This utility method converts actions from the orchestrator format to the
   * agent task format required by DAGExecutor. It's used for parallel execution
   * strategy to build dependency graphs.
   * 
   * @param actions - OrchestratorActions to convert
   * @returns Array of AgentTasks ready for DAGExecutor
   */
  private actionsToTasks(actions: OrchestratorAction[]): AgentTask[] {
    return actions.map(action => this.actionToTask(action))
  }
  
  /**
   * Action To Task: Converts a single OrchestratorAction to AgentTask
   * 
   * This method creates an AgentTask from an OrchestratorAction, preserving
   * important information like section details, dependencies, and constraints.
   * 
   * Task Structure:
   * - id: Unique task identifier
   * - type: Task type (write_chapter, create_structure, etc.)
   * - payload: Task payload with section info and constraints
   * - dependencies: Array of dependency task IDs (empty for now, set by DAGExecutor)
   * - status: Task status (pending, in_progress, completed, failed)
   * 
   * @param action - OrchestratorAction to convert
   * @returns AgentTask ready for DAGExecutor
   */
  private actionToTask(action: OrchestratorAction): AgentTask {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: this.actionTypeToTaskType(action.type),
      payload: {
        taskId: '',
        action: this.actionTypeToTaskType(action.type) as any,
        context: {
          section: {
            id: action.payload?.sectionId || '',
            name: action.payload?.sectionName || '',
            description: action.payload?.prompt || ''
          },
          constraints: {
            tone: 'professional',
            style: 'engaging',
            targetAudience: 'general readers',
            length: 2000 // default word count
          }
        },
        dependencies: []
      },
      dependencies: [],
      assignedTo: null,
      status: 'pending',
      priority: 'normal',
      createdAt: Date.now()
    }
  }
  
  /**
   * Action Type To Task Type: Maps OrchestratorAction types to AgentTask types
   * 
   * This utility method maps action types to task types used by the agent system.
   * It's used when converting actions to tasks for DAGExecutor.
   * 
   * Mapping:
   * - generate_content → write_chapter (content generation task)
   * - generate_structure → create_structure (structure generation task)
   * - modify_structure → modify_structure (structure modification task)
   * - open_document → open_document (document opening task)
   * - Other types: Passed through as-is
   * 
   * @param actionType - OrchestratorAction type (e.g., 'generate_content')
   * @returns AgentTask type (e.g., 'write_chapter')
   */
  private actionTypeToTaskType(actionType: string): string {
    const mapping: Record<string, string> = {
      'generate_content': 'write_chapter',
      'generate_structure': 'create_structure',
      'modify_structure': 'modify_structure',
      'open_document': 'open_document'
    }
    
    return mapping[actionType] || actionType
  }
  
  // ============================================================================
  // PUBLIC API - Inspection & Statistics
  // ============================================================================
  
  /**
   * Get Agent Registry: Returns the agent registry for inspection/testing
   * 
   * This method provides access to the AgentRegistry, which manages the agent
   * pool. Useful for debugging, testing, or monitoring agent availability.
   * 
   * @returns AgentRegistry instance
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry
  }
  
  /**
   * Get DAG Executor: Returns the DAG executor for inspection/testing
   * 
   * This method provides access to the DAGExecutor, which handles dependency
   * resolution. Useful for debugging or inspecting dependency graphs.
   * 
   * @returns DAGExecutor instance
   */
  getDAGExecutor(): DAGExecutor {
    return this.dagExecutor
  }
  
  /**
   * Get Agent Stats: Returns comprehensive agent statistics
   * 
   * This method returns statistics about agent performance, registry state,
   * and execution metrics. Useful for monitoring and debugging.
   * 
   * Statistics include:
   * - registry: Agent pool statistics (total agents, by type, availability)
   * - performance: Agent performance metrics (tasks completed, average time, etc.)
   * - execution: Execution statistics from Blackboard (messages, actions, etc.)
   * 
   * @returns Object with registry, performance, and execution statistics
   */
  getAgentStats() {
    return {
      registry: this.agentRegistry.getStats(),
      performance: this.agentRegistry.getPerformanceSummary(),
      execution: this.getAgentBlackboard().getExecutionStats()
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Count Words: Utility method for counting words in text
   * 
   * This is a simple utility method that counts words in a text string.
   * Used for content metrics and reporting.
   * 
   * @param text - Text to count words in
   * @returns Number of words in the text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length
  }
  
  /**
   * Get Agent Blackboard: Wrapper for accessing Blackboard
   * 
   * This method provides access to the Blackboard (conversation memory) using
   * the protected method from the base OrchestratorEngine class.
   * 
   * Why This Exists:
   * - Base class has protected getBlackboard() method
   * - This wrapper provides convenient access with a descriptive name
   * - Maintains consistency with other getter methods
   * 
   * @returns Blackboard instance (shared with base class)
   */
  private getAgentBlackboard() {
    return this.getBlackboard() // Use protected method from OrchestratorEngine
  }
  
  // Note: getConfig() is now protected in parent class (OrchestratorEngine)
  // All calls use this.getConfig() directly, which works with protected access
  // No wrapper method needed - inheritance handles it correctly
}

