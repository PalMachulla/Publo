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
   * Analyze task complexity and decide execution strategy
   */
  private analyzeExecutionStrategy(actions: OrchestratorAction[]): {
    strategy: ExecutionStrategy
    reasoning: string
  } {
    // Filter to content generation actions (the ones we can parallelize)
    const contentActions = actions.filter(a => a.type === 'generate_content')
    
    // Simple tasks: Sequential execution
    if (actions.length <= 2 || contentActions.length === 0) {
      return {
        strategy: 'sequential',
        reasoning: `Simple task (${actions.length} action${actions.length > 1 ? 's' : ''}) - executing sequentially`
      }
    }
    
    // Multiple content generation tasks: Parallel execution
    if (contentActions.length >= 3) {
      return {
        strategy: 'parallel',
        reasoning: `${contentActions.length} independent sections - executing in parallel for speed`
      }
    }
    
    // Single complex content task: Use writer-critic cluster for quality
    if (contentActions.length === 1) {
      // Check if this is a high-priority section (e.g., first chapter, opening)
      const action = contentActions[0]
      const sectionName = action.payload?.sectionName?.toLowerCase() || ''
      
      const isHighPriority = 
        sectionName.includes('chapter 1') ||
        sectionName.includes('opening') ||
        sectionName.includes('prologue') ||
        sectionName.includes('first')
      
      if (isHighPriority) {
        return {
          strategy: 'cluster',
          reasoning: `High-priority section ("${action.payload?.sectionName}") - using writer-critic cluster for quality`
        }
      }
    }
    
    // Default: Sequential
    return {
      strategy: 'sequential',
      reasoning: 'Mixed action types - executing sequentially'
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
    sessionId: string = `session-${Date.now()}`
  ): Promise<void> {
    if (actions.length === 0) {
      console.log('⚠️ [MultiAgentOrchestrator] No actions to execute')
      return
    }
    
    // Analyze and select strategy
    const { strategy, reasoning } = this.analyzeExecutionStrategy(actions)
    
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
        await this.executeSequential(actions)
        break
        
      case 'parallel':
        await this.executeParallel(actions, sessionId)
        break
        
      case 'cluster':
        await this.executeCluster(actions, sessionId)
        break
    }
  }
  
  // ============================================================
  // SEQUENTIAL EXECUTION
  // ============================================================
  
  private async executeSequential(actions: OrchestratorAction[]): Promise<void> {
    console.log(`⏭️ [MultiAgentOrchestrator] Executing ${actions.length} action(s) sequentially`)
    
    // Use base class implementation (existing UI callbacks)
    // TODO: Eventually replace with agent execution for all action types
    for (const action of actions) {
      console.log(`▶️ [MultiAgentOrchestrator] Executing: ${action.type}`)
      
      // For now, just log that we would execute
      // In full implementation, this would call UI callbacks or use tools
      console.log(`   Payload:`, action.payload)
    }
    
    console.log(`✅ [MultiAgentOrchestrator] Sequential execution complete`)
  }
  
  // ============================================================
  // PARALLEL EXECUTION (DAG)
  // ============================================================
  
  private async executeParallel(
    actions: OrchestratorAction[],
    sessionId: string
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
    })
    
    this.getBlackboard().addMessage({
      role: 'orchestrator',
      content: `🔀 Starting parallel execution: ${tasks.length} tasks across ${batches.length} batch(es)`,
      type: 'progress'
    })
    
    // Execute DAG
    try {
      const result = await this.dagExecutor.execute(dag, sessionId)
      
      if (result.success) {
        console.log(`✅ [MultiAgentOrchestrator] Parallel execution complete`)
        console.log(`   Completed: ${result.completedTasks.size}/${result.metadata.totalTasks}`)
        console.log(`   Time: ${result.executionTime}ms`)
        console.log(`   Max parallelism: ${result.metadata.maxParallelism}`)
        
        this.getBlackboard().addMessage({
          role: 'orchestrator',
          content: `✅ Parallel execution complete: ${result.completedTasks.size} tasks in ${result.executionTime}ms`,
          type: 'result'
        })
      } else {
        console.error(`❌ [MultiAgentOrchestrator] Parallel execution failed`)
        console.error(`   Failed tasks: ${result.failedTasks.size}`)
        
        this.getBlackboard().addMessage({
          role: 'orchestrator',
          content: `❌ Parallel execution failed: ${result.failedTasks.size} task(s) encountered errors`,
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
    sessionId: string
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
      const result = await cluster.generate(task, {
        blackboard: this.getBlackboard(),
        dependencies: {},
        sessionId
      })
      
      console.log(`✅ [MultiAgentOrchestrator] Cluster execution complete`)
      console.log(`   Iterations: ${result.iterations}`)
      console.log(`   Final score: ${result.finalScore}/10`)
      console.log(`   Approved: ${result.approved}`)
      console.log(`   Total tokens: ${result.metadata.totalTokens}`)
      console.log(`   Total time: ${result.metadata.totalTime}ms`)
      
      this.getBlackboard().addMessage({
        role: 'orchestrator',
        content: `✅ Quality-assured content generated: ${result.iterations} iteration(s), score ${result.finalScore}/10`,
        type: 'result'
      })
      
      // TODO: Save result to document via UI callback or tool
      console.log(`📝 [MultiAgentOrchestrator] Content ready (${this.countWords(result.content)} words)`)
      
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

