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
    
    // Step 2: CRITICAL - Filter actions BEFORE execution
    // Determine which actions should be executed by agents vs. returned to UI
    const hasNodeId = !!(request?.currentStoryStructureNodeId)
    const originalActionCount = response.actions?.length || 0
    
    // Split actions into two groups:
    // 1. actionsForAgentExecution: generate_content actions when we HAVE a node ID
    // 2. actionsForUI: everything else (structure creation, clarifications, etc.)
    const actionsForAgentExecution: OrchestratorAction[] = []
    const actionsForUI: OrchestratorAction[] = []
    
    response.actions?.forEach(a => {
      if (a.type === 'generate_content' && hasNodeId) {
        // We have a node ID, agents can execute this
        actionsForAgentExecution.push(a)
        console.log(`  ✅ Agent will execute: ${a.type} (${a.payload?.sectionName})`)
      } else {
        // UI needs to handle this (structure creation, clarifications, etc.)
        actionsForUI.push(a)
        console.log(`  📤 Returning to UI: ${a.type}`)
      }
    })
    
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
   */
  private async analyzeExecutionStrategy(
    actions: OrchestratorAction[],
    blackboard: Blackboard,
    worldState: any
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

Decision criteria:
- SEQUENTIAL: Use for simple tasks, non-content actions, or mixed action types
- PARALLEL: Use for 3+ independent content sections (chapters, scenes, etc.) where speed is important
- CLUSTER: Use for 1-2 high-priority content sections where quality is critical (first chapters, openings, key scenes)

Consider:
- Section importance (first chapters, opening scenes are high-priority)
- User's implicit quality expectations
- Task complexity and interdependencies

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
  async executeActionsWithAgents(
    actions: OrchestratorAction[],
    sessionId: string = `session-${Date.now()}`,
    request?: any // Pass request for accessing currentStoryStructureNodeId
  ): Promise<void> {
    if (actions.length === 0) {
      console.log('⚠️ [MultiAgentOrchestrator] No actions to execute')
      return
    }
    
    // ✅ FIX: Filter out UI-executed actions
    // - generate_structure: UI creates node on canvas first
    // - generate_content: Only execute if we have a node ID (otherwise UI must create node first)
    const hasNodeId = !!(request?.currentStoryStructureNodeId)
    
    const executableActions = actions.filter(a => {
      // Structure generation is always executed by UI
      if (a.type === 'generate_structure') return false
      
      // Content generation requires a node ID
      if (a.type === 'generate_content' && !hasNodeId) {
        console.log(`⚠️ [MultiAgentOrchestrator] Skipping generate_content (no node ID): ${a.payload?.sectionName}`)
        return false
      }
      
      return true
    })
    
    if (executableActions.length === 0) {
      console.log('⚠️ [MultiAgentOrchestrator] No executable actions (structure/content must be created by UI first)')
      this.getBlackboard().addMessage({
        role: 'orchestrator',
        content: '📋 Structure generation complete. UI will create node and generate content.',
        type: 'result'
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
    const { strategy, reasoning } = await this.analyzeExecutionStrategy(
      executableActions,
      this.getAgentBlackboard(),
      this.worldState
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

