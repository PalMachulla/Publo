/**
 * Phase 3: DAG Executor - Parallel Task Orchestration
 * 
 * Directed Acyclic Graph executor for managing task dependencies
 * and executing independent tasks in parallel.
 */

import type { 
  DAGNode, 
  AgentTask, 
  DAGExecutionResult, 
  Agent, 
  AgentContext 
} from './types'
import type { Blackboard } from '../core/blackboard'
import type { AgentRegistry } from './AgentRegistry'
import { DAGExecutionError } from './types'

export class DAGExecutor {
  constructor(
    private blackboard: Blackboard,
    private agentRegistry: AgentRegistry
  ) {
    console.log('🔀 [DAGExecutor] Initialized')
  }
  
  // ============================================================
  // DAG CONSTRUCTION
  // ============================================================
  
  /**
   * Build DAG from list of tasks
   * Establishes parent-child relationships based on dependencies
   */
  buildDAG(tasks: AgentTask[]): Map<string, DAGNode> {
    const dag = new Map<string, DAGNode>()
    
    // Create nodes
    tasks.forEach(task => {
      dag.set(task.id, {
        id: task.id,
        task,
        dependencies: task.dependencies || [],
        dependents: []
      })
    })
    
    // Build dependent relationships (reverse edges)
    dag.forEach(node => {
      node.dependencies.forEach(depId => {
        const depNode = dag.get(depId)
        if (depNode) {
          depNode.dependents.push(node.id)
        } else {
          console.warn(`⚠️ [DAGExecutor] Task ${node.id} depends on non-existent task ${depId}`)
        }
      })
    })
    
    // Validate DAG (check for cycles)
    this.validateDAG(dag)
    
    console.log(`✅ [DAGExecutor] Built DAG with ${dag.size} nodes`)
    return dag
  }
  
  /**
   * Validate DAG for cycles using DFS
   * Throws if cycle detected
   */
  private validateDAG(dag: Map<string, DAGNode>): void {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    
    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId)
      recursionStack.add(nodeId)
      
      const node = dag.get(nodeId)
      if (!node) return false
      
      for (const depId of node.dependencies) {
        if (!visited.has(depId)) {
          if (hasCycle(depId)) return true
        } else if (recursionStack.has(depId)) {
          return true // Cycle detected
        }
      }
      
      recursionStack.delete(nodeId)
      return false
    }
    
    for (const nodeId of dag.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId)) {
          throw new DAGExecutionError(
            'Cycle detected in task dependencies',
            Array.from(dag.keys())
          )
        }
      }
    }
  }
  
  // ============================================================
  // EXECUTION
  // ============================================================
  
  /**
   * Execute DAG with parallel execution where possible
   * Returns map of task IDs to their results
   */
  async execute(
    dag: Map<string, DAGNode>,
    sessionId: string = `session-${Date.now()}`
  ): Promise<DAGExecutionResult> {
    const startTime = Date.now()
    const completed = new Set<string>()
    const results = new Map<string, any>()
    const failed = new Map<string, Error>()
    
    let parallelBatches = 0
    let maxParallelism = 0
    
    console.log(`🚀 [DAGExecutor] Starting execution of ${dag.size} tasks`)
    
    while (completed.size < dag.size && failed.size === 0) {
      // Find all nodes whose dependencies are satisfied
      const ready = Array.from(dag.values()).filter(node =>
        !completed.has(node.id) &&
        !failed.has(node.id) &&
        node.dependencies.every(depId => completed.has(depId))
      )
      
      if (ready.length === 0) {
        // Check if we have pending tasks (potential deadlock)
        const pending = Array.from(dag.values()).filter(n => 
          !completed.has(n.id) && !failed.has(n.id)
        )
        
        if (pending.length > 0) {
          const pendingIds = pending.map(n => n.id)
          throw new DAGExecutionError(
            `Deadlock detected! No ready tasks but ${pending.length} pending tasks remain.`,
            pendingIds
          )
        }
        
        // All tasks completed
        break
      }
      
      // Track metrics
      parallelBatches++
      maxParallelism = Math.max(maxParallelism, ready.length)
      
      console.log(`🔀 [DAGExecutor] Batch ${parallelBatches}: Executing ${ready.length} task(s) in parallel`)
      
      // Execute all ready tasks in parallel
      const execPromises = ready.map(node => 
        this.executeNode(node, results, sessionId)
          .then(result => ({ nodeId: node.id, result, error: null }))
          .catch(error => ({ nodeId: node.id, result: null, error }))
      )
      
      const batchResults = await Promise.all(execPromises)
      
      // Process results
      batchResults.forEach(({ nodeId, result, error }) => {
        if (error) {
          failed.set(nodeId, error)
          console.error(`❌ [DAGExecutor] Task ${nodeId} failed:`, error.message)
        } else {
          completed.add(nodeId)
          results.set(nodeId, result)
          console.log(`✅ [DAGExecutor] Task ${nodeId} completed`)
        }
      })
      
      // If any task failed, stop execution
      if (failed.size > 0) {
        console.error(`❌ [DAGExecutor] Execution stopped due to ${failed.size} failed task(s)`)
        break
      }
    }
    
    const executionTime = Date.now() - startTime
    const success = failed.size === 0 && completed.size === dag.size
    
    console.log(`${success ? '✅' : '❌'} [DAGExecutor] Execution ${success ? 'completed' : 'failed'} in ${executionTime}ms`)
    console.log(`   Completed: ${completed.size}/${dag.size} tasks`)
    console.log(`   Failed: ${failed.size} tasks`)
    console.log(`   Parallel batches: ${parallelBatches}`)
    console.log(`   Max parallelism: ${maxParallelism}`)
    
    return {
      success,
      completedTasks: results,
      failedTasks: failed,
      executionTime,
      metadata: {
        totalTasks: dag.size,
        parallelBatches,
        maxParallelism
      }
    }
  }
  
  /**
   * Execute a single node
   * Allocates agent, executes task, reports result
   */
  private async executeNode(
    node: DAGNode,
    completedResults: Map<string, any>,
    sessionId: string
  ): Promise<any> {
    const task = node.task
    
    // Allocate agent
    const agent = this.agentRegistry.allocate(task)
    
    if (!agent) {
      throw new Error(`No agent available for task type: ${task.type}`)
    }
    
    // Assign task via blackboard
    this.blackboard.assignTask(task, agent.id)
    
    // Build context with dependency results
    const context: AgentContext = {
      blackboard: this.blackboard,
      dependencies: this.getDependencyResults(node, completedResults),
      sessionId
    }
    
    // Update task status
    task.startedAt = Date.now()
    task.status = 'running'
    
    try {
      // Execute task
      const result = await agent.execute(task, context)
      
      // Report success to blackboard
      this.blackboard.reportResult(agent.id, {
        id: `result-${node.id}-${Date.now()}`,
        from: agent.id,
        to: 'orchestrator',
        timestamp: Date.now(),
        type: 'result',
        sessionId,
        payload: {
          taskId: node.id,
          status: 'success',
          result: result.data,
          tokensUsed: result.tokensUsed,
          executionTime: result.executionTime
        }
      })
      
      return result.data
    } catch (error) {
      console.error(`❌ [DAGExecutor] Task ${node.id} execution failed:`, error)
      
      // Report failure to blackboard
      this.blackboard.reportResult(agent.id, {
        id: `result-${node.id}-${Date.now()}`,
        from: agent.id,
        to: 'orchestrator',
        timestamp: Date.now(),
        type: 'result',
        sessionId,
        payload: {
          taskId: node.id,
          status: 'failed',
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      
      throw error
    }
  }
  
  /**
   * Get results from dependency tasks
   */
  private getDependencyResults(
    node: DAGNode,
    completedResults: Map<string, any>
  ): Record<string, any> {
    const depResults: Record<string, any> = {}
    
    node.dependencies.forEach(depId => {
      const result = completedResults.get(depId)
      if (result !== undefined) {
        depResults[depId] = result
      }
    })
    
    return depResults
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  /**
   * Visualize DAG as ASCII tree (for debugging)
   */
  visualizeDAG(dag: Map<string, DAGNode>): string {
    const lines: string[] = ['DAG Visualization:']
    
    // Find root nodes (no dependencies)
    const roots = Array.from(dag.values()).filter(n => n.dependencies.length === 0)
    
    const visited = new Set<string>()
    
    const printNode = (node: DAGNode, prefix: string, isLast: boolean) => {
      if (visited.has(node.id)) {
        lines.push(`${prefix}${isLast ? '└─' : '├─'} ${node.task.type} (${node.id}) [DUPLICATE]`)
        return
      }
      
      visited.add(node.id)
      lines.push(`${prefix}${isLast ? '└─' : '├─'} ${node.task.type} (${node.id})`)
      
      const childPrefix = prefix + (isLast ? '   ' : '│  ')
      node.dependents.forEach((childId, idx) => {
        const childNode = dag.get(childId)
        if (childNode) {
          printNode(childNode, childPrefix, idx === node.dependents.length - 1)
        }
      })
    }
    
    roots.forEach((root, idx) => {
      printNode(root, '', idx === roots.length - 1)
    })
    
    return lines.join('\n')
  }
  
  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder(dag: Map<string, DAGNode>): string[][] {
    const completed = new Set<string>()
    const batches: string[][] = []
    
    while (completed.size < dag.size) {
      const ready = Array.from(dag.values())
        .filter(node =>
          !completed.has(node.id) &&
          node.dependencies.every(depId => completed.has(depId))
        )
        .map(n => n.id)
      
      if (ready.length === 0) {
        break // Deadlock or all completed
      }
      
      batches.push(ready)
      ready.forEach(id => completed.add(id))
    }
    
    return batches
  }
}

