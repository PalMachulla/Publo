/**
 * Phase 3: Execution Tracer - Observability & Debugging
 * 
 * Tracks agent execution for debugging, analytics, and user feedback.
 * Provides detailed traces of what agents are doing, how long tasks take,
 * and what results they produce.
 */

import type { ExecutionTrace, ExecutionEvent, AgentTask } from './types'

export class ExecutionTracer {
  private traces: Map<string, ExecutionTrace>
  private activeTraces: Set<string>
  
  constructor(private maxTraces: number = 1000) {
    this.traces = new Map()
    this.activeTraces = new Set()
    
    console.log('📊 [ExecutionTracer] Initialized')
  }
  
  // ============================================================
  // TRACE LIFECYCLE
  // ============================================================
  
  /**
   * Start tracking a task execution
   */
  startTrace(taskId: string, agentId: string): void {
    const trace: ExecutionTrace = {
      taskId,
      agentId,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      status: 'success',
      tokensUsed: 0,
      cost: 0,
      events: []
    }
    
    this.traces.set(taskId, trace)
    this.activeTraces.add(taskId)
    
    this.addEvent(taskId, 'start', `Agent ${agentId} started task ${taskId}`)
    
    console.log(`📊 [ExecutionTracer] Started trace: ${taskId} (agent: ${agentId})`)
  }
  
  /**
   * Log an event during execution
   */
  addEvent(
    taskId: string,
    type: ExecutionEvent['type'],
    message: string,
    metadata?: any
  ): void {
    const trace = this.traces.get(taskId)
    
    if (!trace) {
      console.warn(`⚠️ [ExecutionTracer] No trace found for task ${taskId}`)
      return
    }
    
    const event: ExecutionEvent = {
      timestamp: Date.now(),
      type,
      message,
      metadata
    }
    
    trace.events.push(event)
    
    // Log to console with appropriate emoji
    const emoji = {
      start: '▶️',
      progress: '⏳',
      complete: '✅',
      error: '❌',
      critique: '🎭',
      revision: '🔄'
    }[type] || '📝'
    
    console.log(`${emoji} [ExecutionTracer] ${taskId}: ${message}`)
  }
  
  /**
   * End tracking and finalize trace
   */
  endTrace(
    taskId: string,
    status: 'success' | 'failed',
    tokensUsed: number = 0,
    cost: number = 0,
    metadata?: any
  ): void {
    const trace = this.traces.get(taskId)
    
    if (!trace) {
      console.warn(`⚠️ [ExecutionTracer] No trace found for task ${taskId}`)
      return
    }
    
    trace.endTime = Date.now()
    trace.duration = trace.endTime - trace.startTime
    trace.status = status
    trace.tokensUsed = tokensUsed
    trace.cost = cost
    
    this.activeTraces.delete(taskId)
    
    this.addEvent(
      taskId,
      status === 'success' ? 'complete' : 'error',
      `Task ${status} in ${trace.duration}ms (${tokensUsed} tokens, $${cost.toFixed(4)})`,
      metadata
    )
    
    console.log(`📊 [ExecutionTracer] Ended trace: ${taskId} (${status}, ${trace.duration}ms)`)
    
    // Cleanup old traces if we have too many
    if (this.traces.size > this.maxTraces) {
      this.cleanup()
    }
  }
  
  // ============================================================
  // RETRIEVAL
  // ============================================================
  
  /**
   * Get trace for a specific task
   */
  getTrace(taskId: string): ExecutionTrace | undefined {
    return this.traces.get(taskId)
  }
  
  /**
   * Get all traces (optionally filter by status)
   */
  getAllTraces(status?: 'success' | 'failed'): ExecutionTrace[] {
    const traces = Array.from(this.traces.values())
    return status ? traces.filter(t => t.status === status) : traces
  }
  
  /**
   * Get traces for a specific agent
   */
  getTracesByAgent(agentId: string): ExecutionTrace[] {
    return Array.from(this.traces.values()).filter(t => t.agentId === agentId)
  }
  
  /**
   * Get currently active traces
   */
  getActiveTraces(): ExecutionTrace[] {
    return Array.from(this.activeTraces)
      .map(taskId => this.traces.get(taskId))
      .filter(Boolean) as ExecutionTrace[]
  }
  
  // ============================================================
  // ANALYTICS
  // ============================================================
  
  /**
   * Get execution statistics
   */
  getStats(): {
    totalTraces: number
    activeTraces: number
    successRate: number
    averageDuration: number
    totalTokens: number
    totalCost: number
    byAgent: Record<string, {
      count: number
      successRate: number
      averageDuration: number
    }>
  } {
    const traces = Array.from(this.traces.values())
    const completed = traces.filter(t => !this.activeTraces.has(t.taskId))
    
    const successful = completed.filter(t => t.status === 'success').length
    const successRate = completed.length > 0 ? successful / completed.length : 0
    
    const totalDuration = completed.reduce((sum, t) => sum + t.duration, 0)
    const averageDuration = completed.length > 0 ? totalDuration / completed.length : 0
    
    const totalTokens = completed.reduce((sum, t) => sum + t.tokensUsed, 0)
    const totalCost = completed.reduce((sum, t) => sum + t.cost, 0)
    
    // Group by agent
    const byAgent: Record<string, {
      count: number
      successRate: number
      averageDuration: number
    }> = {}
    
    traces.forEach(trace => {
      if (!byAgent[trace.agentId]) {
        byAgent[trace.agentId] = {
          count: 0,
          successRate: 0,
          averageDuration: 0
        }
      }
      
      byAgent[trace.agentId].count++
    })
    
    Object.keys(byAgent).forEach(agentId => {
      const agentTraces = traces.filter(t => t.agentId === agentId && !this.activeTraces.has(t.taskId))
      const agentSuccess = agentTraces.filter(t => t.status === 'success').length
      
      byAgent[agentId].successRate = agentTraces.length > 0 ? agentSuccess / agentTraces.length : 0
      byAgent[agentId].averageDuration = agentTraces.length > 0
        ? agentTraces.reduce((sum, t) => sum + t.duration, 0) / agentTraces.length
        : 0
    })
    
    return {
      totalTraces: traces.length,
      activeTraces: this.activeTraces.size,
      successRate,
      averageDuration,
      totalTokens,
      totalCost,
      byAgent
    }
  }
  
  /**
   * Get detailed timeline for a task (for debugging)
   */
  getTimeline(taskId: string): string {
    const trace = this.traces.get(taskId)
    
    if (!trace) {
      return `No trace found for task ${taskId}`
    }
    
    const lines: string[] = [
      `📊 Execution Timeline for ${taskId}`,
      `   Agent: ${trace.agentId}`,
      `   Duration: ${trace.duration}ms`,
      `   Status: ${trace.status}`,
      `   Tokens: ${trace.tokensUsed}`,
      `   Cost: $${trace.cost.toFixed(4)}`,
      '',
      'Events:'
    ]
    
    trace.events.forEach(event => {
      const elapsed = event.timestamp - trace.startTime
      const emoji = {
        start: '▶️',
        progress: '⏳',
        complete: '✅',
        error: '❌',
        critique: '🎭',
        revision: '🔄'
      }[event.type] || '📝'
      
      lines.push(`   [+${elapsed}ms] ${emoji} ${event.message}`)
      
      if (event.metadata) {
        lines.push(`      ${JSON.stringify(event.metadata)}`)
      }
    })
    
    return lines.join('\n')
  }
  
  /**
   * Export traces as JSON (for analysis)
   */
  exportTraces(): string {
    const data = {
      traces: Array.from(this.traces.values()),
      stats: this.getStats(),
      exportedAt: Date.now()
    }
    
    return JSON.stringify(data, null, 2)
  }
  
  // ============================================================
  // CLEANUP
  // ============================================================
  
  private cleanup(): void {
    // Keep only the most recent traces
    const traces = Array.from(this.traces.entries())
      .sort((a, b) => b[1].startTime - a[1].startTime)
    
    // Remove oldest traces
    const toRemove = traces.slice(this.maxTraces)
    toRemove.forEach(([taskId]) => {
      this.traces.delete(taskId)
    })
    
    console.log(`🧹 [ExecutionTracer] Cleaned up ${toRemove.length} old traces`)
  }
  
  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear()
    this.activeTraces.clear()
    console.log('🧹 [ExecutionTracer] All traces cleared')
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let tracerInstance: ExecutionTracer | null = null

export function getTracer(): ExecutionTracer {
  if (!tracerInstance) {
    tracerInstance = new ExecutionTracer()
  }
  return tracerInstance
}

