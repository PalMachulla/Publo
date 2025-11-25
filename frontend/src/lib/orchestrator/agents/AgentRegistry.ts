/**
 * Phase 3: Agent Registry - Agent Pool Management
 * 
 * Central registry for managing available agents, their capabilities,
 * and intelligent allocation based on task requirements.
 */

import type { Agent, AgentTask, AgentState } from './types'
import type { Blackboard } from '../core/blackboard'

export class AgentRegistry {
  private agents: Map<string, Agent>
  private allocationHistory: Array<{
    taskId: string
    agentId: string
    allocatedAt: number
    taskType: string
  }>
  
  constructor(private blackboard: Blackboard) {
    this.agents = new Map()
    this.allocationHistory = []
    
    console.log('📋 [AgentRegistry] Initialized')
  }
  
  // ============================================================
  // AGENT MANAGEMENT
  // ============================================================
  
  /**
   * Register an agent in the pool
   */
  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      console.warn(`⚠️ [AgentRegistry] Agent ${agent.id} already registered, overwriting`)
    }
    
    this.agents.set(agent.id, agent)
    
    // Also register in blackboard for state tracking
    this.blackboard.registerAgent({
      id: agent.id,
      status: agent.status,
      currentTask: null,
      tasksCompleted: 0,
      tasksAssigned: 0,
      lastActive: Date.now(),
      capabilities: agent.capabilities
    })
    
    console.log(`✅ [AgentRegistry] Registered agent: ${agent.id} (${agent.type})`)
  }
  
  /**
   * Unregister an agent from the pool
   */
  unregister(agentId: string): void {
    const agent = this.agents.get(agentId)
    
    if (!agent) {
      console.warn(`⚠️ [AgentRegistry] Agent ${agentId} not found`)
      return
    }
    
    // Check if agent has pending tasks
    const agentState = this.blackboard.getAgentState(agentId)
    if (agentState && agentState.status === 'busy') {
      console.warn(`⚠️ [AgentRegistry] Cannot unregister busy agent ${agentId}`)
      return
    }
    
    this.agents.delete(agentId)
    console.log(`✅ [AgentRegistry] Unregistered agent: ${agentId}`)
  }
  
  /**
   * Get agent by ID
   */
  get(agentId: string): Agent | undefined {
    return this.agents.get(agentId)
  }
  
  /**
   * Get all registered agents
   */
  getAll(): Agent[] {
    return Array.from(this.agents.values())
  }
  
  /**
   * Get agents by type
   */
  getByType(type: Agent['type']): Agent[] {
    return this.getAll().filter(agent => agent.type === type)
  }
  
  // ============================================================
  // CAPABILITY MATCHING
  // ============================================================
  
  /**
   * Find agents capable of handling a specific task type
   */
  findCapableAgents(taskType: string): Agent[] {
    return this.getAll().filter(agent => {
      const agentState = this.blackboard.getAgentState(agent.id)
      return (
        agent.capabilities.includes(taskType) &&
        agentState?.status === 'idle'
      )
    })
  }
  
  /**
   * Find best agent for a task (considers capabilities, load, performance)
   */
  findBestAgent(taskType: string): Agent | null {
    const capable = this.findCapableAgents(taskType)
    
    if (capable.length === 0) {
      return null
    }
    
    // If only one capable agent, return it
    if (capable.length === 1) {
      return capable[0]
    }
    
    // Score each agent based on:
    // 1. Current load (fewer tasks = higher score)
    // 2. Historical performance (faster = higher score)
    // 3. Specialization (exact match = higher score)
    
    const scored = capable.map(agent => {
      const state = this.blackboard.getAgentState(agent.id)!
      
      // Load score (inverse of tasks assigned)
      const loadScore = 1 / (state.tasksAssigned + 1)
      
      // Performance score (inverse of average execution time)
      const perfScore = state.metadata?.averageExecutionTime 
        ? 1 / (state.metadata.averageExecutionTime + 1)
        : 0.5 // Default for agents with no history
      
      // Specialization score (1.0 if agent has only this capability, 0.5 otherwise)
      const specScore = agent.capabilities.length === 1 && agent.capabilities[0] === taskType
        ? 1.0
        : 0.5
      
      // Weighted total (adjust weights as needed)
      const totalScore = (loadScore * 0.4) + (perfScore * 0.3) + (specScore * 0.3)
      
      return { agent, score: totalScore }
    })
    
    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score)
    
    const best = scored[0].agent
    console.log(`🎯 [AgentRegistry] Best agent for ${taskType}: ${best.id} (score: ${scored[0].score.toFixed(2)})`)
    
    return best
  }
  
  // ============================================================
  // ALLOCATION
  // ============================================================
  
  /**
   * Allocate an agent for a task
   * Uses intelligent matching to find the best available agent
   */
  allocate(task: AgentTask): Agent | null {
    const agent = this.findBestAgent(task.type)
    
    if (!agent) {
      console.warn(`⚠️ [AgentRegistry] No available agent for task type: ${task.type}`)
      return null
    }
    
    // Update agent state to busy
    this.blackboard.updateAgentState(agent.id, {
      status: 'busy',
      currentTask: task.id
    })
    
    // Record allocation
    this.allocationHistory.push({
      taskId: task.id,
      agentId: agent.id,
      allocatedAt: Date.now(),
      taskType: task.type
    })
    
    // Keep only last 1000 allocations
    if (this.allocationHistory.length > 1000) {
      this.allocationHistory = this.allocationHistory.slice(-1000)
    }
    
    console.log(`✅ [AgentRegistry] Allocated agent ${agent.id} for task ${task.id}`)
    
    return agent
  }
  
  /**
   * Batch allocate multiple tasks
   * Returns map of taskId -> agent (or null if no agent available)
   */
  allocateBatch(tasks: AgentTask[]): Map<string, Agent | null> {
    const allocations = new Map<string, Agent | null>()
    
    for (const task of tasks) {
      const agent = this.allocate(task)
      allocations.set(task.id, agent)
    }
    
    return allocations
  }
  
  // ============================================================
  // STATISTICS
  // ============================================================
  
  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number
    agentsByType: Record<string, number>
    idleAgents: number
    busyAgents: number
    totalAllocations: number
    allocationsByType: Record<string, number>
  } {
    const agents = this.getAll()
    const agentStates = agents.map(a => this.blackboard.getAgentState(a.id)!).filter(Boolean)
    
    // Group by type
    const byType: Record<string, number> = {}
    agents.forEach(agent => {
      byType[agent.type] = (byType[agent.type] || 0) + 1
    })
    
    // Group allocations by type
    const allocationsByType: Record<string, number> = {}
    this.allocationHistory.forEach(alloc => {
      allocationsByType[alloc.taskType] = (allocationsByType[alloc.taskType] || 0) + 1
    })
    
    return {
      totalAgents: agents.length,
      agentsByType: byType,
      idleAgents: agentStates.filter(s => s.status === 'idle').length,
      busyAgents: agentStates.filter(s => s.status === 'busy').length,
      totalAllocations: this.allocationHistory.length,
      allocationsByType
    }
  }
  
  /**
   * Get allocation history for debugging
   */
  getAllocationHistory(limit: number = 100): typeof this.allocationHistory {
    return this.allocationHistory.slice(-limit)
  }
  
  /**
   * Get performance summary for all agents
   */
  getPerformanceSummary(): Array<{
    agentId: string
    type: string
    tasksCompleted: number
    averageTime: number | null
    totalTokens: number | null
    totalCost: number | null
  }> {
    return this.getAll().map(agent => {
      const state = this.blackboard.getAgentState(agent.id)!
      
      return {
        agentId: agent.id,
        type: agent.type,
        tasksCompleted: state.tasksCompleted,
        averageTime: state.metadata?.averageExecutionTime || null,
        totalTokens: state.metadata?.totalTokensUsed || null,
        totalCost: state.metadata?.totalCost || null
      }
    })
  }
}

