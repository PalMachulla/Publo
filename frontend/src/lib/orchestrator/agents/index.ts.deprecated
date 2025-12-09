/**
 * Phase 3: Multi-Agent Coordination - Public API
 * 
 * This module exports all agent-related classes and types for use
 * throughout the orchestrator system.
 */

// Core types
export type {
  A2AMessage,
  A2APayload,
  TaskPayload,
  ResultPayload,
  CritiquePayload,
  AgentState,
  AgentTask,
  AgentContext,
  AgentResult,
  Agent,
  DAGNode,
  DAGExecutionResult,
  ExecutionStrategy,
  AgentAllocation,
  ClusterConfig,
  ExecutionTrace,
  ExecutionEvent
} from './types'

// Error classes
export { AgentExecutionError, DAGExecutionError } from './types'

// Agent Registry
export { AgentRegistry } from './AgentRegistry'

// DAG Executor
export { DAGExecutor } from './DAGExecutor'

// Core Agents
export { WriterAgent } from './WriterAgent'
export { CriticAgent } from './CriticAgent'

// Agent Clusters
export { WriterCriticCluster } from './clusters/WriterCriticCluster'

// Multi-Agent Orchestrator
export { MultiAgentOrchestrator } from './MultiAgentOrchestrator'

// Observability
export { ExecutionTracer, getTracer } from './ExecutionTracer'

