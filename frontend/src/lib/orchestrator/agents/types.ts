/**
 * Phase 3: Multi-Agent Coordination - Type Definitions
 * 
 * Based on A2A Protocol (https://www.a2aprotocol.net)
 * 
 * This module defines the core types for agent-to-agent communication,
 * task management, and agent coordination in the multi-agent orchestrator.
 */

import type { Blackboard } from '../core/blackboard'

// ============================================================
// A2A MESSAGE PROTOCOL
// ============================================================

/**
 * Agent-to-Agent message (A2A Protocol compliant)
 */
export interface A2AMessage {
  // Standard A2A fields
  id: string                    // Unique message ID
  from: string                  // Agent ID (e.g., "orchestrator", "writer-1")
  to: string | string[]         // Target agent(s) or "broadcast"
  timestamp: number             // Unix timestamp (ms)
  
  // Message type
  type: 'task' | 'result' | 'query' | 'critique' | 'collaborate' | 'status'
  
  // Payload (type-specific)
  payload: A2APayload
  
  // Session tracking
  sessionId: string
  conversationId?: string       // For multi-turn agent dialogues
  
  // Metadata
  metadata?: {
    estimatedTime?: number      // Expected execution time (ms)
    tokens?: number             // Estimated token usage
    cost?: number               // Estimated cost ($)
  }
}

/**
 * Generic payload interface (specific types extend this)
 */
export interface A2APayload {
  taskId: string
  action: string
  context?: any
  dependencies?: string[]
  priority?: 'low' | 'normal' | 'high'
  [key: string]: any           // Allow extensions
}

/**
 * Task assignment payload
 */
export interface TaskPayload extends A2APayload {
  action: 'write_chapter' | 'write_scene' | 'write_dialogue' | 'review_content' | 'check_consistency'
  context: {
    section?: {
      id: string
      name: string
      description?: string
    }
    outline?: any               // Structure from dependencies
    constraints?: {
      tone?: string
      length?: number
      style?: string
      targetAudience?: string
    }
    previousCritique?: any      // For revision iterations
  }
}

/**
 * Result payload (task completion)
 */
export interface ResultPayload {
  taskId: string
  status: 'success' | 'failed' | 'partial'
  result: any
  error?: string
  tokensUsed?: number
  executionTime?: number        // ms
}

/**
 * Critique payload (for Critic agent)
 */
export interface CritiquePayload {
  taskId: string
  content: string               // Content being reviewed
  approved: boolean
  issues: string[]
  suggestions: string[]
  score: number                 // 0-10
}

// ============================================================
// AGENT SYSTEM
// ============================================================

/**
 * Agent state (for monitoring)
 */
export interface AgentState {
  id: string
  status: 'idle' | 'busy' | 'waiting' | 'error'
  currentTask: string | null
  tasksCompleted: number
  tasksAssigned: number
  lastActive: number            // Unix timestamp
  capabilities?: string[]       // Actions this agent can perform
  metadata?: {
    totalTokensUsed?: number
    totalCost?: number
    averageExecutionTime?: number
  }
}

/**
 * Agent task (in task queue)
 */
export interface AgentTask {
  id: string
  type: string                  // Action type (e.g., "write_chapter")
  payload: TaskPayload
  dependencies: string[]        // Task IDs that must complete first
  assignedTo: string | null     // Agent ID
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  priority: 'low' | 'normal' | 'high'
  
  // Timing
  createdAt: number
  assignedAt?: number
  startedAt?: number
  completedAt?: number
}

/**
 * Agent execution context (passed to agent.execute())
 */
export interface AgentContext {
  blackboard: Blackboard        // Read-only access to blackboard
  dependencies: Record<string, any>  // Results from dependency tasks
  sessionId: string
  metadata?: {                  // Optional metadata for context
    storyStructureNodeId?: string
    format?: string
    [key: string]: any
  }
}

/**
 * Agent execution result
 */
export interface AgentResult {
  data: any                     // Generated content or output
  tokensUsed: number
  executionTime: number         // ms
  metadata?: {
    model?: string
    cost?: number
    iterations?: number         // For iterative agents
    [key: string]: any
  }
}

/**
 * Base Agent interface (all agents implement this)
 */
export interface Agent {
  // Identity
  id: string
  type: 'writer' | 'critic' | 'continuity' | 'dialogue' | 'orchestrator'
  
  // Capabilities
  capabilities: string[]        // Actions this agent can perform
  
  // State
  status: 'idle' | 'busy' | 'offline'
  
  // Metadata
  metadata: {
    displayName: string
    description: string
    preferredModel?: string     // Default LLM for this agent
    maxConcurrentTasks?: number
  }
  
  // Execution interface
  execute(task: AgentTask, context: AgentContext): Promise<AgentResult>
}

// ============================================================
// DAG EXECUTION
// ============================================================

/**
 * DAG (Directed Acyclic Graph) node
 */
export interface DAGNode {
  id: string
  task: AgentTask
  dependencies: string[]        // IDs of tasks that must complete first
  dependents: string[]          // IDs of tasks that depend on this one
}

/**
 * DAG execution result
 */
export interface DAGExecutionResult {
  success: boolean
  completedTasks: Map<string, any>
  failedTasks: Map<string, Error>
  executionTime: number         // Total time (ms)
  metadata: {
    totalTasks: number
    parallelBatches: number     // Number of parallel execution waves
    maxParallelism: number      // Max tasks executed simultaneously
  }
}

// ============================================================
// ORCHESTRATOR COORDINATION
// ============================================================

/**
 * Execution strategy (orchestrator decides which to use)
 */
export type ExecutionStrategy = 'sequential' | 'parallel' | 'cluster'

/**
 * Agent allocation (orchestrator assigns tasks to agents)
 */
export interface AgentAllocation {
  taskId: string
  agentId: string
  allocatedAt: number
  estimatedTime?: number
}

/**
 * Cluster configuration (for Writer+Critic patterns)
 */
export interface ClusterConfig {
  pattern: 'writer-critic' | 'competitive-writers' | 'specialized-team'
  agents: string[]              // Agent IDs in this cluster
  maxIterations?: number        // For iterative patterns
  qualityThreshold?: number     // Min score to accept (0-10)
}

// ============================================================
// OBSERVABILITY
// ============================================================

/**
 * Task execution trace (for debugging and learning)
 */
export interface ExecutionTrace {
  taskId: string
  agentId: string
  startTime: number
  endTime: number
  duration: number
  status: 'success' | 'failed'
  tokensUsed: number
  cost: number
  iterations?: number           // For iterative tasks
  events: ExecutionEvent[]
}

/**
 * Execution event (timestamped log entry)
 */
export interface ExecutionEvent {
  timestamp: number
  type: 'start' | 'progress' | 'complete' | 'error' | 'critique' | 'revision'
  message: string
  metadata?: any
}

// ============================================================
// ERROR HANDLING
// ============================================================

/**
 * Agent execution error
 */
export class AgentExecutionError extends Error {
  constructor(
    message: string,
    public agentId: string,
    public taskId: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'AgentExecutionError'
  }
}

/**
 * DAG execution error (deadlock, cycle detection, etc.)
 */
export class DAGExecutionError extends Error {
  constructor(
    message: string,
    public pendingTasks: string[],
    public cause?: Error
  ) {
    super(message)
    this.name = 'DAGExecutionError'
  }
}

