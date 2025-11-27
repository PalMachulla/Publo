/**
 * Blackboard Architecture - Central State & Context Management
 * 
 * Inspired by:
 * - AgentDB Timeline Self-Reflection (temporalMemory.ts)
 * - Agentic Flow ReasoningBank (learning memory)
 * - Blackboard pattern (shared knowledge base for multi-agent systems)
 * 
 * The Blackboard serves as the "single source of truth" for:
 * - Conversation history and context
 * - Canvas state (nodes, edges, content)
 * - User intent and orchestrator decisions
 * - Temporal patterns and learning
 * - Model selection and routing
 * 
 * @see https://github.com/ruvnet/agentic-flow
 */

import { Node, Edge } from 'reactflow'
import { TemporalMemory, EventDelta } from '../context/temporalMemory'

// ============================================================
// TYPES
// ============================================================

export interface ConversationMessage {
  id: string
  role: 'user' | 'orchestrator' | 'system'
  content: string
  timestamp: string
  type?: 'user' | 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'progress' | 'warning' // PHASE 3: Added 'warning' for fallback messages
  metadata?: {
    intent?: string
    confidence?: number
    modelUsed?: string
    tokensUsed?: number
  }
}

export interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  activeDocumentId: string | null
  lastModified: number
}

export interface DocumentState {
  nodeId: string
  format: string
  structureItems: any[]
  contentMap: Record<string, string>
  wordsWritten: number
  lastModified: number
}

export interface OrchestratorContext {
  currentIntent: string | null
  lastAction: string | null
  activeModel: string | null
  conversationDepth: number
  referencedNodes: string[] // Recently discussed nodes
  pendingActions: string[]
}

export interface BlackboardState {
  // Conversation
  messages: ConversationMessage[]
  
  // Canvas
  canvas: CanvasState
  
  // Documents
  documents: Map<string, DocumentState>
  
  // Orchestrator
  orchestrator: OrchestratorContext
  
  // Temporal Memory
  temporal: TemporalMemory
  
  // Learning Patterns (ReasoningBank-inspired)
  patterns: Map<string, PatternMemory>
  
  // PHASE 3: Multi-Agent Coordination
  agents: Map<string, AgentState>
  taskQueue: Map<string, AgentTask>
  messageLog: A2AMessage[]
}

// PHASE 3: Agent types (imported from agents/types.ts when available)
export interface AgentState {
  id: string
  status: 'idle' | 'busy' | 'waiting' | 'error'
  currentTask: string | null
  tasksCompleted: number
  tasksAssigned: number
  lastActive: number
  capabilities?: string[]
  metadata?: {
    totalTokensUsed?: number
    totalCost?: number
    averageExecutionTime?: number
  }
}

export interface AgentTask {
  id: string
  type: string
  payload: any
  dependencies: string[]
  assignedTo: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  priority: 'low' | 'normal' | 'high'
  createdAt: number
  assignedAt?: number
  startedAt?: number
  completedAt?: number
}

export interface A2AMessage {
  id: string
  from: string
  to: string | string[]
  timestamp: number
  type: 'task' | 'result' | 'query' | 'critique' | 'collaborate' | 'status'
  payload: any
  sessionId: string
  conversationId?: string
  metadata?: {
    estimatedTime?: number
    tokens?: number
    cost?: number
  }
}

export interface PatternMemory {
  id: string
  pattern: string // e.g., "user asks about plot after discussing screenplay"
  action: string // e.g., "resolve to screenplay node"
  successRate: number // 0-1
  timesUsed: number
  lastUsed: number
  namespace: string // e.g., "node_resolution", "intent_detection"
}

// ============================================================
// BLACKBOARD CLASS
// ============================================================

export class Blackboard {
  private state: BlackboardState
  private subscribers: Map<string, Set<(state: BlackboardState) => void>>
  private messageCallback?: (message: ConversationMessage) => void // Real-time UI callback
  
  constructor(userId: string, messageCallback?: (message: ConversationMessage) => void) {
    this.messageCallback = messageCallback
    this.state = {
      messages: [],
      canvas: {
        nodes: [],
        edges: [],
        selectedNodeId: null,
        activeDocumentId: null,
        lastModified: Date.now()
      },
      documents: new Map(),
      orchestrator: {
        currentIntent: null,
        lastAction: null,
        activeModel: null,
        conversationDepth: 0,
        referencedNodes: [],
        pendingActions: []
      },
      temporal: new TemporalMemory(userId, 'orchestration'),
      patterns: new Map(),
      // PHASE 3: Multi-Agent Coordination
      agents: new Map(),
      taskQueue: new Map(),
      messageLog: []
    }
    
    this.subscribers = new Map()
    
    console.log('🎯 [Blackboard] Initialized for user:', userId)
  }
  
  // ============================================================
  // CONVERSATION MANAGEMENT
  // ============================================================
  
  addMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'>): ConversationMessage {
    const newMessage: ConversationMessage = {
      ...message,
      id: this.generateId('msg'),
      timestamp: new Date().toISOString()
    }
    
    this.state.messages.push(newMessage)
    this.state.orchestrator.conversationDepth++
    
    // Log to temporal memory
    this.state.temporal.addEvent({
      verb: 'message_added',
      object: newMessage.id,
      attributes_diff: {
        role: message.role,
        type: message.type,
        contentLength: message.content.length
      }
    })
    
    this.notify('messages')
    
    // 🚀 REAL-TIME: Call UI callback immediately if provided
    if (this.messageCallback) {
      this.messageCallback(newMessage)
    }
    
    return newMessage
  }
  
  getRecentMessages(count: number = 10): ConversationMessage[] {
    return this.state.messages.slice(-count)
  }
  
  getConversationContext(): string {
    const recent = this.getRecentMessages(5)
    return recent
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n')
  }
  
  // ============================================================
  // CANVAS STATE MANAGEMENT
  // ============================================================
  
  updateCanvas(nodes: Node[], edges: Edge[]): void {
    const hasChanged = 
      JSON.stringify(this.state.canvas.nodes) !== JSON.stringify(nodes) ||
      JSON.stringify(this.state.canvas.edges) !== JSON.stringify(edges)
    
    if (hasChanged) {
      this.state.canvas.nodes = nodes
      this.state.canvas.edges = edges
      this.state.canvas.lastModified = Date.now()
      
      // Log to temporal memory
      this.state.temporal.addEvent({
        verb: 'canvas_updated',
        object: 'canvas',
        attributes_diff: {
          nodeCount: nodes.length,
          edgeCount: edges.length
        }
      })
      
      this.notify('canvas')
    }
  }
  
  getCanvasState(): CanvasState {
    return this.state.canvas
  }
  
  hasCanvasChanged(since: number): boolean {
    return this.state.canvas.lastModified > since
  }
  
  // ============================================================
  // DOCUMENT STATE MANAGEMENT
  // ============================================================
  
  updateDocument(nodeId: string, document: Partial<DocumentState>): void {
    const existing = this.state.documents.get(nodeId)
    const updated: DocumentState = {
      nodeId,
      format: document.format || existing?.format || 'unknown',
      structureItems: document.structureItems || existing?.structureItems || [],
      contentMap: document.contentMap || existing?.contentMap || {},
      wordsWritten: document.wordsWritten || existing?.wordsWritten || 0,
      lastModified: Date.now()
    }
    
    this.state.documents.set(nodeId, updated)
    
    // Log to temporal memory
    this.state.temporal.addEvent({
      verb: 'document_updated',
      object: nodeId,
      attributes_diff: {
        format: updated.format,
        wordsWritten: updated.wordsWritten,
        sectionCount: updated.structureItems.length
      }
    })
    
    this.notify('documents')
  }
  
  getDocument(nodeId: string): DocumentState | undefined {
    return this.state.documents.get(nodeId)
  }
  
  // ============================================================
  // ORCHESTRATOR CONTEXT
  // ============================================================
  
  setIntent(intent: string, confidence: number): void {
    this.state.orchestrator.currentIntent = intent
    
    // Log to temporal memory
    this.state.temporal.addEvent({
      verb: 'intent_detected',
      object: intent,
      attributes_diff: { confidence }
    })
    
    this.notify('orchestrator')
  }
  
  recordAction(action: string, metadata?: Record<string, any>): void {
    this.state.orchestrator.lastAction = action
    
    // Log to temporal memory
    this.state.temporal.addEvent({
      verb: 'action_executed',
      object: action,
      attributes_diff: metadata || {}
    })
    
    this.notify('orchestrator')
  }
  
  addReferencedNode(nodeId: string): void {
    // Keep only last 5 referenced nodes
    this.state.orchestrator.referencedNodes.unshift(nodeId)
    this.state.orchestrator.referencedNodes = 
      this.state.orchestrator.referencedNodes.slice(0, 5)
    
    this.notify('orchestrator')
  }
  
  getRecentlyReferencedNodes(): string[] {
    return this.state.orchestrator.referencedNodes
  }
  
  // ============================================================
  // PATTERN LEARNING (ReasoningBank-inspired)
  // ============================================================
  
  async storePattern(
    pattern: string,
    action: string,
    namespace: string = 'general'
  ): Promise<void> {
    const id = this.generateId('pattern')
    const memory: PatternMemory = {
      id,
      pattern,
      action,
      successRate: 1.0,
      timesUsed: 1,
      lastUsed: Date.now(),
      namespace
    }
    
    this.state.patterns.set(id, memory)
    
    console.log(`💡 [Blackboard] Stored pattern: "${pattern}" → "${action}"`)
  }
  
  async queryPatterns(query: string, namespace?: string): Promise<PatternMemory[]> {
    const results: PatternMemory[] = []
    
    for (const [_, pattern] of this.state.patterns) {
      if (namespace && pattern.namespace !== namespace) continue
      
      // Simple substring matching (can be enhanced with embeddings)
      if (pattern.pattern.toLowerCase().includes(query.toLowerCase())) {
        results.push(pattern)
      }
    }
    
    // Sort by success rate and recency
    return results.sort((a, b) => {
      const scoreA = a.successRate * 0.7 + (1 - (Date.now() - a.lastUsed) / 3600000) * 0.3
      const scoreB = b.successRate * 0.7 + (1 - (Date.now() - b.lastUsed) / 3600000) * 0.3
      return scoreB - scoreA
    })
  }
  
  updatePatternSuccess(patternId: string, success: boolean): void {
    const pattern = this.state.patterns.get(patternId)
    if (!pattern) return
    
    // Update success rate with exponential moving average
    const alpha = 0.3
    pattern.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * pattern.successRate
    pattern.timesUsed++
    pattern.lastUsed = Date.now()
    
    console.log(`📊 [Blackboard] Pattern "${pattern.pattern}" success rate: ${(pattern.successRate * 100).toFixed(1)}%`)
  }
  
  // ============================================================
  // TEMPORAL MEMORY ACCESS
  // ============================================================
  
  getTemporalMemory(): TemporalMemory {
    return this.state.temporal
  }
  
  async createSnapshot(): Promise<void> {
    await this.state.temporal.createSnapshot()
    console.log('📸 [Blackboard] Created temporal snapshot')
  }
  
  // ============================================================
  // SUBSCRIPTION SYSTEM (Observer Pattern)
  // ============================================================
  
  subscribe(
    channel: keyof BlackboardState | 'all',
    callback: (state: BlackboardState) => void
  ): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
    }
    
    this.subscribers.get(channel)!.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(channel)?.delete(callback)
    }
  }
  
  private notify(channel: keyof BlackboardState | 'all'): void {
    // Notify specific channel
    this.subscribers.get(channel)?.forEach(callback => callback(this.state))
    
    // Notify 'all' subscribers
    this.subscribers.get('all')?.forEach(callback => callback(this.state))
  }
  
  // ============================================================
  // PHASE 3: MULTI-AGENT COORDINATION
  // ============================================================
  
  /**
   * Orchestrator assigns a task to an agent
   * Only orchestrator can write to task queue (prevents race conditions)
   */
  assignTask(task: AgentTask, agentId: string, orchestratorId: string = 'orchestrator'): void {
    if (!this.isOrchestrator(orchestratorId)) {
      throw new Error('Only orchestrator can assign tasks')
    }
    
    const assignedTask: AgentTask = {
      ...task,
      assignedTo: agentId,
      status: 'pending',
      assignedAt: Date.now()
    }
    
    this.state.taskQueue.set(task.id, assignedTask)
    
    // Update agent state
    const agentState = this.state.agents.get(agentId)
    if (agentState) {
      agentState.tasksAssigned++
      agentState.lastActive = Date.now()
    }
    
    // Log to temporal memory
    this.state.temporal.addEvent({
      verb: 'task_assigned',
      object: task.id,
      attributes_diff: {
        agentId,
        taskType: task.type,
        priority: task.priority
      }
    })
    
    this.notify('taskQueue')
    console.log(`✅ [Blackboard] Task ${task.id} assigned to agent ${agentId}`)
  }
  
  /**
   * Agent reads assigned task (read-only)
   */
  getTaskForAgent(agentId: string): AgentTask | null {
    return Array.from(this.state.taskQueue.values())
      .find(task => task.assignedTo === agentId && task.status === 'pending') || null
  }
  
  /**
   * Get task by ID
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.state.taskQueue.get(taskId)
  }
  
  /**
   * Get all tasks (optionally filter by status)
   */
  getTasks(status?: AgentTask['status']): AgentTask[] {
    const tasks = Array.from(this.state.taskQueue.values())
    return status ? tasks.filter(t => t.status === status) : tasks
  }
  
  /**
   * Agent reports result back to orchestrator
   */
  reportResult(agentId: string, result: A2AMessage): void {
    const taskId = result.payload.taskId
    const task = this.state.taskQueue.get(taskId)
    
    if (!task) {
      console.error(`❌ [Blackboard] Task ${taskId} not found`)
      return
    }
    
    // Update task status
    task.status = result.payload.status === 'success' ? 'completed' : 'failed'
    task.result = result.payload.result
    task.error = result.payload.error
    task.completedAt = Date.now()
    
    // Update agent state
    const agentState = this.state.agents.get(agentId)
    if (agentState) {
      agentState.tasksCompleted++
      agentState.currentTask = null
      agentState.status = 'idle'
      agentState.lastActive = Date.now()
      
      // Update metadata
      if (result.payload.tokensUsed) {
        agentState.metadata = agentState.metadata || {}
        agentState.metadata.totalTokensUsed = (agentState.metadata.totalTokensUsed || 0) + result.payload.tokensUsed
      }
    }
    
    // Log message
    this.state.messageLog.push(result)
    
    // Log to temporal memory
    this.state.temporal.addEvent({
      verb: 'task_completed',
      object: taskId,
      attributes_diff: {
        agentId,
        status: task.status,
        executionTime: result.payload.executionTime
      }
    })
    
    this.notify('taskQueue')
    this.notify('agents')
    
    console.log(`✅ [Blackboard] Task ${taskId} completed by agent ${agentId} (status: ${task.status})`)
  }
  
  /**
   * Register an agent in the blackboard
   */
  registerAgent(agentState: AgentState): void {
    this.state.agents.set(agentState.id, agentState)
    
    this.state.temporal.addEvent({
      verb: 'agent_registered',
      object: agentState.id,
      attributes_diff: {
        capabilities: agentState.capabilities
      }
    })
    
    this.notify('agents')
    console.log(`✅ [Blackboard] Agent registered: ${agentState.id}`)
  }
  
  /**
   * Update agent state
   */
  updateAgentState(agentId: string, updates: Partial<AgentState>): void {
    const current = this.state.agents.get(agentId)
    
    if (!current) {
      console.warn(`⚠️ [Blackboard] Agent ${agentId} not found, cannot update state`)
      return
    }
    
    this.state.agents.set(agentId, { ...current, ...updates })
    this.notify('agents')
  }
  
  /**
   * Get agent state by ID
   */
  getAgentState(agentId: string): AgentState | undefined {
    return this.state.agents.get(agentId)
  }
  
  /**
   * Get all registered agents
   */
  getAllAgents(): AgentState[] {
    return Array.from(this.state.agents.values())
  }
  
  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: string): AgentState[] {
    return this.getAllAgents().filter(agent =>
      agent.capabilities?.includes(capability)
    )
  }
  
  /**
   * Get idle agents (available for work)
   */
  getIdleAgents(): AgentState[] {
    return this.getAllAgents().filter(agent => agent.status === 'idle')
  }
  
  /**
   * Log A2A message (for observability)
   */
  logMessage(message: A2AMessage): void {
    this.state.messageLog.push(message)
    
    // Keep only last 1000 messages (prevent memory leak)
    if (this.state.messageLog.length > 1000) {
      this.state.messageLog = this.state.messageLog.slice(-1000)
    }
  }
  
  /**
   * Get message log (optionally filter by type)
   */
  getMessageLog(type?: A2AMessage['type']): A2AMessage[] {
    return type 
      ? this.state.messageLog.filter(m => m.type === type)
      : this.state.messageLog
  }
  
  /**
   * Check if caller is orchestrator (for authorization)
   */
  private isOrchestrator(callerId: string): boolean {
    return callerId === 'orchestrator'
  }
  
  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalTasks: number
    completedTasks: number
    failedTasks: number
    pendingTasks: number
    totalAgents: number
    idleAgents: number
    busyAgents: number
  } {
    const tasks = this.getTasks()
    const agents = this.getAllAgents()
    
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      totalAgents: agents.length,
      idleAgents: agents.filter(a => a.status === 'idle').length,
      busyAgents: agents.filter(a => a.status === 'busy').length
    }
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
  
  getState(): BlackboardState {
    return this.state
  }
  
  reset(): void {
    const userId = this.state.temporal['userId']
    this.state = {
      messages: [],
      canvas: {
        nodes: [],
        edges: [],
        selectedNodeId: null,
        activeDocumentId: null,
        lastModified: Date.now()
      },
      documents: new Map(),
      orchestrator: {
        currentIntent: null,
        lastAction: null,
        activeModel: null,
        conversationDepth: 0,
        referencedNodes: [],
        pendingActions: []
      },
      temporal: new TemporalMemory(userId, 'orchestration'),
      patterns: new Map(),
      // PHASE 3: Multi-Agent Coordination
      agents: new Map(),
      taskQueue: new Map(),
      messageLog: []
    }
    
    this.notify('all')
    console.log('🔄 [Blackboard] Reset')
  }
}

// ============================================================
// SINGLETON FACTORY
// ============================================================

const blackboards = new Map<string, Blackboard>()

export function getBlackboard(userId: string): Blackboard {
  if (!blackboards.has(userId)) {
    blackboards.set(userId, new Blackboard(userId))
  }
  return blackboards.get(userId)!
}

export function createBlackboard(userId: string): Blackboard {
  const blackboard = new Blackboard(userId)
  blackboards.set(userId, blackboard)
  return blackboard
}

