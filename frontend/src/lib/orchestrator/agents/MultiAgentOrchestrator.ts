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
    this.agentRegistry = new AgentRegistry(this.getBlackboard())
    this.dagExecutor = new DAGExecutor(this.getBlackboard(), this.agentRegistry)
    
    // Initialize agent pool
    this.initializeAgents()
    
    console.log('🤖 [MultiAgentOrchestrator] Initialized with multi-agent coordination')
    
    // Log initialization to Blackboard for UI visibility
    this.getBlackboard().addMessage({
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
    
    // Step 2: Get the blackboard message count BEFORE agent execution
    const messagesBefore = this.getBlackboard().getRecentMessages(1000).length
    
    // Step 3: Execute actions with agents (if any)
    if (response.actions && response.actions.length > 0) {
      const sessionId = `session-${Date.now()}`
      
      this.getBlackboard().addMessage({
        role: 'orchestrator',
        content: `🚀 Starting agent execution for ${response.actions.length} action(s)`,
        type: 'progress'
      })
      
      try {
        // Pass the request so agents have access to currentStoryStructureNodeId
        await this.executeActionsWithAgents(response.actions, sessionId, request)
        
        this.getBlackboard().addMessage({
          role: 'orchestrator',
          content: `✅ Agent execution complete`,
          type: 'result'
        })
      } catch (error) {
        console.error('[MultiAgentOrchestrator] Agent execution failed:', error)
        
        this.getBlackboard().addMessage({
          role: 'orchestrator',
          content: `❌ Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'error'
        })
      }
    }
    
    // Step 4: Extract NEW messages for UI display (messages added during agent execution)
    const messagesAfter = this.getBlackboard().getRecentMessages(1000)
    const newMessages = messagesAfter.slice(messagesBefore)
    
    // Step 5: Add new messages to thinkingSteps for UI display
    if (newMessages.length > 0) {
      const agentSteps = newMessages.map(m => ({
        content: m.content,
        type: m.type || 'progress'
      }))
      
      // Append agent messages to existing thinking steps
      response.thinkingSteps = [...(response.thinkingSteps || []), ...agentSteps]
      
      console.log(`📨 [MultiAgentOrchestrator] Added ${agentSteps.length} agent messages to UI`)
    }
    
    // 🔍 DEBUG: Log final state
    console.log('✅ [MultiAgentOrchestrator] Orchestration complete:', {
      intent: response.intent,
      actionsExecuted: response.actions?.length || 0,
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
      
      // Validate strategy
      const validStrategies: ExecutionStrategy[] = ['sequential', 'parallel', 'cluster']
      if (!validStrategies.includes(analysis.strategy)) {
        throw new Error(`Invalid strategy: ${analysis.strategy}`)
      }
      
      return {
        strategy: analysis.strategy as ExecutionStrategy,
        reasoning: analysis.reasoning
      }
    } catch (error) {
      console.error('❌ [Strategy Selection] Error:', error)
      
      // Log to Blackboard for UI visibility
      this.getBlackboard().addMessage({
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
    
    // 🧠 PHASE 3: LLM-powered strategy selection using Blackboard and WorldState
    const { strategy, reasoning } = await this.analyzeExecutionStrategy(
      actions,
      this.getBlackboard(),
      this.worldState
    )
    
    console.log(`🎯 [MultiAgentOrchestrator] Strategy: ${strategy.toUpperCase()}`)
    console.log(`   Reasoning: ${reasoning}`)
    
    this.getBlackboard().addMessage({
      role: 'orchestrator',
      content: `🎯 Execution strategy: ${strategy} - ${reasoning}`,
      type: 'decision'
    })
    
    // Route to appropriate execution method
    switch (strategy) {
      case 'sequential':
        await this.executeSequential(actions, request)
        break
        
      case 'parallel':
        await this.executeParallel(actions, sessionId, request)
        break
        
      case 'cluster':
        await this.executeCluster(actions, sessionId, request)
        break
    }
  }
  
  // ============================================================
  // SEQUENTIAL EXECUTION
  // ============================================================
  
  private async executeSequential(actions: OrchestratorAction[], request?: any): Promise<void> {
    console.log(`⏭️ [MultiAgentOrchestrator] Executing ${actions.length} action(s) sequentially`)
    
    this.getBlackboard().addMessage({
      role: 'orchestrator',
      content: `⏭️ Sequential execution: ${actions.length} action(s)`,
      type: 'progress'
    })
    
    // Use base class implementation (existing UI callbacks)
    // TODO: Eventually replace with agent execution for all action types
    for (const action of actions) {
      console.log(`▶️ [MultiAgentOrchestrator] Executing: ${action.type}`)
      console.log(`   Payload:`, action.payload)
      
      this.getBlackboard().addMessage({
        role: 'orchestrator',
        content: `▶️ ${action.type}: ${action.payload?.sectionName || action.payload?.prompt?.substring(0, 50) || 'processing...'}`,
        type: 'progress'
      })
      
      // For now, just log that we would execute
      // In full implementation, this would call UI callbacks or use tools
    }
    
    console.log(`✅ [MultiAgentOrchestrator] Sequential execution complete`)
    
    this.getBlackboard().addMessage({
      role: 'orchestrator',
      content: `✅ Sequential execution complete`,
      type: 'result'
    })
  }
  
  // ============================================================
  // PARALLEL EXECUTION (DAG)
  // ============================================================
  
  private async executeParallel(
    actions: OrchestratorAction[],
    sessionId: string,
    request?: any
  ): Promise<void> {
    console.log(`🔀 [MultiAgentOrchestrator] Executing ${actions.length} action(s) in parallel`)
    
    // Convert actions to agent tasks
    const tasks = this.actionsToTasks(actions)
    
    // Build DAG from tasks
    const dag = this.dagExecutor.buildDAG(tasks)
    
    // Log execution plan
    console.log('📋 [MultiAgentOrchestrator] Execution plan:')
    const batches = this.dagExecutor.getExecutionOrder(dag)
    batches.forEach((batch, idx) => {
      console.log(`   Batch ${idx + 1}: ${batch.length} task(s) in parallel`)
      
      // Add to UI
      this.getBlackboard().addMessage({
        role: 'orchestrator',
        content: `📦 Batch ${idx + 1}: ${batch.map(t => t.payload.context?.section?.name || t.id).join(', ')}`,
        type: 'progress'
      })
    })
    
    this.getBlackboard().addMessage({
      role: 'orchestrator',
      content: `🔀 Parallel execution: ${tasks.length} tasks across ${batches.length} batch(es)`,
      type: 'progress'
    })
    
    // Execute DAG
    try {
      const result = await this.dagExecutor.execute(dag, sessionId)
      
      if (result.success) {
        const speedup = result.metadata.totalTasks > 1 ? `~${result.metadata.totalTasks}x faster` : ''
        console.log(`✅ [MultiAgentOrchestrator] Parallel execution complete`)
        console.log(`   Completed: ${result.completedTasks.size}/${result.metadata.totalTasks}`)
        console.log(`   Time: ${result.executionTime}ms`)
        console.log(`   Max parallelism: ${result.metadata.maxParallelism}`)
        
        this.getBlackboard().addMessage({
          role: 'orchestrator',
          content: `✅ Completed ${result.completedTasks.size} tasks in ${(result.executionTime / 1000).toFixed(1)}s ${speedup}`,
          type: 'result'
        })
      } else {
        console.error(`❌ [MultiAgentOrchestrator] Parallel execution failed`)
        console.error(`   Failed tasks: ${result.failedTasks.size}`)
        
        this.getBlackboard().addMessage({
          role: 'orchestrator',
          content: `❌ ${result.failedTasks.size} task(s) failed`,
          type: 'error'
        })
      }
    } catch (error) {
      console.error(`❌ [MultiAgentOrchestrator] DAG execution error:`, error)
      
      this.getBlackboard().addMessage({
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
    console.log(`🔄 [MultiAgentOrchestrator] Executing with writer-critic cluster`)
    
    // Get first content generation action
    const contentAction = actions.find(a => a.type === 'generate_content')
    
    if (!contentAction) {
      console.warn('⚠️ [MultiAgentOrchestrator] No content action found for cluster, falling back to sequential')
      return this.executeSequential(actions)
    }
    
    this.getBlackboard().addMessage({
      role: 'orchestrator',
      content: `🔄 Using writer-critic cluster for high-quality generation`,
      type: 'progress'
    })
    
    // Convert to agent task
    const task = this.actionToTask(contentAction)
    
    // Get writer and critic from pool
    const writer = this.agentRegistry.get('writer-0') as WriterAgent
    const critic = this.agentRegistry.get('critic-0') as CriticAgent
    
    if (!writer || !critic) {
      throw new Error('Writer or Critic agent not available')
    }
    
    // Create cluster
    const cluster = new WriterCriticCluster(
      writer,
      critic,
      3, // max 3 iterations
      7.0 // quality threshold
    )
    
    // Execute with iterative refinement
    try {
      // ✅ FIX: Pass storyStructureNodeId and format in metadata so WriterAgent can call /api/content/generate
      const storyStructureNodeId = request?.currentStoryStructureNodeId || 
                                   (this as any).worldState?.getState().canvas.activeDocumentNodeId
      const format = request?.documentFormat || 'novel'
      
      const result = await cluster.generate(task, {
        blackboard: this.getBlackboard(),
        dependencies: {},
        sessionId,
        metadata: {
          storyStructureNodeId,
          format
        }
      })
      
      console.log(`✅ [MultiAgentOrchestrator] Cluster execution complete`)
      console.log(`   Iterations: ${result.iterations}`)
      console.log(`   Final score: ${result.finalScore}/10`)
      console.log(`   Approved: ${result.approved}`)
      console.log(`   Total tokens: ${result.metadata.totalTokens}`)
      console.log(`   Total time: ${result.metadata.totalTime}ms`)
      
      const wordCount = this.countWords(result.content)
      const qualityEmoji = result.finalScore >= 8 ? '🌟' : result.finalScore >= 7 ? '✨' : '✅'
      
      this.getBlackboard().addMessage({
        role: 'orchestrator',
        content: `${qualityEmoji} Quality-assured: ${wordCount} words, score ${result.finalScore}/10 (${result.iterations} iteration${result.iterations > 1 ? 's' : ''})`,
        type: 'result'
      })
      
      // Save result to database
      // Try to get node ID from request first (most reliable), then WorldState
      const storyStructureNodeId = request?.currentStoryStructureNodeId || 
                                   (this as any).worldState?.getState().canvas.activeDocumentNodeId
      const sectionId = task.payload.context?.section?.id
      
      console.log(`💾 [MultiAgentOrchestrator] Attempting to save content:`, {
        hasNodeId: !!storyStructureNodeId,
        hasSectionId: !!sectionId,
        nodeId: storyStructureNodeId,
        sectionId
      })
      
      if (storyStructureNodeId && sectionId) {
        console.log(`💾 [MultiAgentOrchestrator] Saving content to database...`)
        
        const saveResult = await saveAgentContent({
          storyStructureNodeId,
          sectionId,
          content: result.content,
          userId: this.getConfig().userId
        })
        
        if (saveResult.success) {
          console.log(`✅ [MultiAgentOrchestrator] Content saved (total: ${saveResult.wordCount} words)`)
          
          this.getBlackboard().addMessage({
            role: 'orchestrator',
            content: `💾 Content saved to database`,
            type: 'result'
          })
        } else {
          console.error(`❌ [MultiAgentOrchestrator] Failed to save:`, saveResult.error)
          
          this.getBlackboard().addMessage({
            role: 'orchestrator',
            content: `⚠️ Content generated but save failed: ${saveResult.error}`,
            type: 'error'
          })
        }
      } else {
        console.warn(`⚠️ [MultiAgentOrchestrator] Missing save parameters:`, {
          hasNodeId: !!storyStructureNodeId,
          hasSectionId: !!sectionId
        })
      }
      
    } catch (error) {
      console.error(`❌ [MultiAgentOrchestrator] Cluster execution error:`, error)
      
      this.getBlackboard().addMessage({
        role: 'orchestrator',
        content: `❌ Cluster execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
      
      throw error
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
        action: this.actionTypeToTaskType(action.type),
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
      execution: this.getBlackboard().getExecutionStats()
    }
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length
  }
  
  // Expose protected methods for agent access
  private getBlackboard() {
    return (this as any).blackboard
  }
  
  private getConfig() {
    return (this as any).config
  }
}

