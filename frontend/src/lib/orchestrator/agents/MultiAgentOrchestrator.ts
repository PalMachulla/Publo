/**
 * Phase 3: Multi-Agent Orchestrator - Intelligent Task Coordination
 * 
 * Extends the base OrchestratorEngine with multi-agent coordination capabilities.
 * Analyzes task complexity and selects optimal execution strategy:
 * - Sequential: Simple tasks (1-2 actions)
 * - Parallel: Independent tasks (3+ chapters/scenes)
 * - Cluster: Complex single tasks requiring quality (writer + critic loops)
 */

import { OrchestratorEngine } from '../core/orchestratorEngine'
import type { Blackboard, ConversationMessage } from '../core/blackboard'
import type { 
  OrchestratorConfig, 
  OrchestratorRequest,
  OrchestratorAction 
} from '../core/orchestratorEngine'
import type { WorldStateManager } from '../core/worldState'
import { AgentRegistry } from './AgentRegistry'
import { DAGExecutor } from './DAGExecutor'
import { WriterAgent } from './WriterAgent'
import { CriticAgent } from './CriticAgent'
import { WriterCriticCluster } from './clusters/WriterCriticCluster'
import type { AgentTask, ExecutionStrategy, DAGNode } from './types'
import { saveAgentContent, batchSaveAgentContent } from './utils/contentPersistence'

export class MultiAgentOrchestrator extends OrchestratorEngine {
  private agentRegistry: AgentRegistry
  private dagExecutor: DAGExecutor
  
  constructor(
    config: OrchestratorConfig,
    worldState?: WorldStateManager
  ) {
    super(config, worldState)
    
    // Initialize agent infrastructure
    this.agentRegistry = new AgentRegistry(this.getAgentBlackboard())
    this.dagExecutor = new DAGExecutor(this.getAgentBlackboard(), this.agentRegistry)
    
    // Initialize agent pool
    this.initializeAgents()
    
    console.log('🤖 [MultiAgentOrchestrator] Initialized with multi-agent coordination')
    console.log('   Has WorldState:', !!this.worldState)
    
    // Log initialization to Blackboard for UI visibility
    this.getAgentBlackboard().addMessage({
      role: 'orchestrator',
      content: '🤖 Multi-agent system initialized',
      type: 'thinking'
    })
  }
  
  // ============================================================
  // OVERRIDE: ORCHESTRATE WITH AGENT EXECUTION
  // ============================================================
  
  /**
   * Override orchestrate to execute actions with agents automatically
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
  
  // ============================================================
  // AGENT INITIALIZATION
  // ============================================================
  
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
  
  // ============================================================
  // STRATEGY SELECTION
  // ============================================================
  
  /**
   * PHASE 3: LLM-powered execution strategy selection
   * Replaces hard-coded rules with reasoning based on context
   * 
   * ✅ STEP 4: Now uses actual model performance metrics from database metadata
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
  
  // ============================================================
  // EXECUTION ROUTING
  // ============================================================
  
  /**
   * Execute actions with multi-agent coordination
   * Overrides base class method to add agent support
   */
  /**
   * Execute actions in dependency order (dependencies first, then dependents)
   * 
   * This method handles the sequencing of actions that have dependencies.
   * For example: generate_content depends on select_section, so we execute
   * select_section first, then generate_content.
   * 
   * @param sequencedActions - Actions with dependencies that need sequencing
   * @param agentActions - Actions ready for immediate agent execution
   * @param request - Original orchestrator request (for context)
   * @returns Object with agentActions (ready for execution) and uiActions (for UI)
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

  async executeActionsWithAgents(
    actions: OrchestratorAction[],
    sessionId: string = `session-${Date.now()}`,
    request?: any // Pass request for accessing currentStoryStructureNodeId
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
  
  // ============================================================
  // SEQUENTIAL EXECUTION
  // ============================================================
  
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
   * Map action type to tool name
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
  
  // ============================================================
  // PARALLEL EXECUTION (DAG)
  // ============================================================
  
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
  
  // ============================================================
  // CLUSTER EXECUTION (WRITER + CRITIC)
  // ============================================================
  
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
  
  // ============================================================
  // TASK CONVERSION
  // ============================================================
  
  private actionsToTasks(actions: OrchestratorAction[]): AgentTask[] {
    return actions.map(action => this.actionToTask(action))
  }
  
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
  
  private actionTypeToTaskType(actionType: string): string {
    const mapping: Record<string, string> = {
      'generate_content': 'write_chapter',
      'generate_structure': 'create_structure',
      'modify_structure': 'modify_structure',
      'open_document': 'open_document'
    }
    
    return mapping[actionType] || actionType
  }
  
  // ============================================================
  // PUBLIC API
  // ============================================================
  
  /**
   * Get agent registry (for inspection/testing)
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry
  }
  
  /**
   * Get DAG executor (for inspection/testing)
   */
  getDAGExecutor(): DAGExecutor {
    return this.dagExecutor
  }
  
  /**
   * Get agent statistics
   */
  getAgentStats() {
    return {
      registry: this.agentRegistry.getStats(),
      performance: this.agentRegistry.getPerformanceSummary(),
      execution: this.getAgentBlackboard().getExecutionStats()
    }
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length
  }
  
  // Expose protected methods for agent access
  private getAgentBlackboard() {
    return (this as any).blackboard
  }
  
  private getConfig() {
    return (this as any).config
  }
}

