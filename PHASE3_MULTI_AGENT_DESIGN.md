# 🎯 Phase 3: Multi-Agent Coordination Architecture

## 📊 Status: Design Phase

**Branch:** `refactor/phase3-multi-agent-coordination`  
**Started:** 2025-11-25  
**Dependencies:** Phase 1 (WorldState) ✅, Phase 2 (Tool System) ✅

---

## 🎯 Vision

Transform the orchestrator from a **single-agent executor** into a **multi-agent coordinator** capable of decomposing complex tasks, allocating them to specialized agents, and executing them in parallel with sophisticated dependency management.

### Current Architecture (Phase 2):
```
User → Orchestrator → Sequential Actions → Results
         └─ Tools execute one-by-one (blocking)
```

### Target Architecture (Phase 3):
```
User → Orchestrator (Coordinator)
         ├─ Task Decomposition (LLM-powered)
         ├─ DAG Builder (dependency resolution)
         ├─ Agent Allocation (Writer, Critic, Continuity)
         ├─ A2A Message Bus (agent communication)
         ├─ Parallel Execution (Promise.all for independent tasks)
         └─ Result Assembly & Review
```

---

## 🏗️ Core Components

### 1. **A2A Message Protocol** (Agent-to-Agent Communication)

Based on [A2A Protocol](https://www.a2aprotocol.net) standard with Publo-specific extensions.

```typescript
interface A2AMessage {
  // Standard A2A fields
  id: string                    // Unique message ID
  from: string                  // Agent ID (e.g., "orchestrator", "writer-1")
  to: string | string[]         // Target agent(s) or "broadcast"
  timestamp: number
  
  // Message type
  type: 'task' | 'result' | 'query' | 'critique' | 'collaborate' | 'status'
  
  // Payload
  payload: {
    taskId: string              // Links to task in DAG
    action: string              // "write_chapter", "review_content", etc.
    context: any                // Task-specific context
    dependencies?: string[]     // Task IDs this depends on
    priority?: 'low' | 'normal' | 'high'
  }
  
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

interface A2AResult extends A2AMessage {
  type: 'result'
  payload: {
    taskId: string
    status: 'success' | 'failed' | 'partial'
    result: any
    error?: string
    tokensUsed?: number
    executionTime?: number
  }
}
```

**Key Decisions:**
- ✅ **Orchestrator is the only writer to Blackboard** (prevents race conditions)
- ✅ **Agents communicate via A2A messages** (not direct Blackboard access)
- ✅ **All messages logged to Blackboard** (for observability and learning)

---

### 2. **Enhanced Blackboard** (Coordination Hub)

Extend existing `Blackboard` class to support multi-agent coordination.

```typescript
class Blackboard {
  // Existing state
  private state: BlackboardState
  
  // NEW: Agent coordination
  private agentStates: Map<string, AgentState>
  private taskQueue: Map<string, AgentTask>
  private messageLog: A2AMessage[]
  
  // NEW: Agent coordination methods
  
  /**
   * Orchestrator assigns task to agent
   * Only orchestrator can write to task queue
   */
  assignTask(task: AgentTask, agentId: string): void {
    if (!this.isOrchestrator(agentId)) {
      throw new Error('Only orchestrator can assign tasks')
    }
    
    this.taskQueue.set(task.id, {
      ...task,
      assignedTo: agentId,
      status: 'pending',
      assignedAt: Date.now()
    })
    
    this.notifyAgent(agentId, task)
  }
  
  /**
   * Agent reads assigned task (read-only)
   */
  getTaskForAgent(agentId: string): AgentTask | null {
    return Array.from(this.taskQueue.values())
      .find(task => task.assignedTo === agentId && task.status === 'pending')
  }
  
  /**
   * Agent reports result back to orchestrator
   */
  reportResult(agentId: string, result: A2AResult): void {
    const task = this.taskQueue.get(result.payload.taskId)
    
    if (!task) {
      throw new Error(`Task ${result.payload.taskId} not found`)
    }
    
    // Update task status
    task.status = result.payload.status === 'success' ? 'completed' : 'failed'
    task.result = result.payload.result
    task.completedAt = Date.now()
    
    // Notify orchestrator
    this.notifyOrchestrator('task_completed', { agentId, result })
    
    // Log to message history
    this.messageLog.push(result)
  }
  
  /**
   * Get agent state (for monitoring)
   */
  getAgentState(agentId: string): AgentState | undefined {
    return this.agentStates.get(agentId)
  }
  
  /**
   * Update agent state (agents report their status)
   */
  updateAgentState(agentId: string, state: Partial<AgentState>): void {
    const current = this.agentStates.get(agentId) || {
      id: agentId,
      status: 'idle',
      currentTask: null,
      tasksCompleted: 0,
      lastActive: Date.now()
    }
    
    this.agentStates.set(agentId, { ...current, ...state })
  }
}

interface AgentState {
  id: string
  status: 'idle' | 'busy' | 'waiting' | 'error'
  currentTask: string | null
  tasksCompleted: number
  lastActive: number
  capabilities?: string[]       // e.g., ["write_chapter", "write_dialogue"]
}

interface AgentTask {
  id: string
  type: string                  // "write_chapter", "review_content"
  payload: any
  dependencies: string[]        // Task IDs that must complete first
  assignedTo: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  assignedAt?: number
  startedAt?: number
  completedAt?: number
  priority: 'low' | 'normal' | 'high'
}
```

---

### 3. **Agent Registry** (Agent Pool Management)

Registry of available agents and their capabilities.

```typescript
interface Agent {
  id: string
  type: 'writer' | 'critic' | 'continuity' | 'dialogue' | 'orchestrator'
  capabilities: string[]        // Actions this agent can perform
  status: 'idle' | 'busy' | 'offline'
  metadata: {
    displayName: string
    description: string
    preferredModel?: string     // Default LLM for this agent
    maxConcurrentTasks?: number
  }
  
  // Agent execution interface
  execute(task: AgentTask, context: AgentContext): Promise<AgentResult>
}

class AgentRegistry {
  private agents: Map<string, Agent>
  
  constructor(private blackboard: Blackboard) {
    this.agents = new Map()
  }
  
  /**
   * Register an agent in the pool
   */
  register(agent: Agent): void {
    this.agents.set(agent.id, agent)
    console.log(`✅ [AgentRegistry] Registered agent: ${agent.id}`)
  }
  
  /**
   * Find agents capable of handling a task
   */
  findCapableAgents(taskType: string): Agent[] {
    return Array.from(this.agents.values())
      .filter(agent => 
        agent.status === 'idle' && 
        agent.capabilities.includes(taskType)
      )
  }
  
  /**
   * Allocate agent for task (orchestrator calls this)
   */
  allocate(taskType: string): Agent | null {
    const capable = this.findCapableAgents(taskType)
    
    if (capable.length === 0) {
      return null
    }
    
    // Simple allocation: pick first idle agent
    // TODO: Could use load balancing, specialization matching, etc.
    return capable[0]
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
}
```

---

### 4. **DAG Execution Engine** (Parallel Task Orchestration)

Directed Acyclic Graph for modeling task dependencies and executing in parallel.

```typescript
interface DAGNode {
  id: string
  task: AgentTask
  dependencies: string[]        // IDs of tasks that must complete first
  dependents: string[]          // IDs of tasks that depend on this one
}

class DAGExecutor {
  constructor(
    private blackboard: Blackboard,
    private agentRegistry: AgentRegistry
  ) {}
  
  /**
   * Build DAG from list of tasks
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
    
    // Build dependent relationships
    dag.forEach(node => {
      node.dependencies.forEach(depId => {
        const depNode = dag.get(depId)
        if (depNode) {
          depNode.dependents.push(node.id)
        }
      })
    })
    
    return dag
  }
  
  /**
   * Execute DAG with parallel execution where possible
   */
  async execute(dag: Map<string, DAGNode>): Promise<Map<string, any>> {
    const completed = new Set<string>()
    const results = new Map<string, any>()
    
    while (completed.size < dag.size) {
      // Find all nodes whose dependencies are satisfied
      const ready = Array.from(dag.values()).filter(node =>
        !completed.has(node.id) &&
        node.dependencies.every(depId => completed.has(depId))
      )
      
      if (ready.length === 0) {
        // Deadlock detection
        const pending = Array.from(dag.values()).filter(n => !completed.has(n.id))
        throw new Error(`Deadlock detected! Pending tasks: ${pending.map(n => n.id).join(', ')}`)
      }
      
      console.log(`🚀 [DAGExecutor] Executing ${ready.length} task(s) in parallel`)
      
      // Execute all ready tasks in parallel
      const execResults = await Promise.all(
        ready.map(node => this.executeNode(node))
      )
      
      // Mark as completed and store results
      execResults.forEach((result, idx) => {
        const node = ready[idx]
        completed.add(node.id)
        results.set(node.id, result)
        
        console.log(`✅ [DAGExecutor] Task ${node.id} completed`)
      })
    }
    
    return results
  }
  
  /**
   * Execute a single node (allocate agent, send task, wait for result)
   */
  private async executeNode(node: DAGNode): Promise<any> {
    // Allocate agent
    const agent = this.agentRegistry.allocate(node.task.type)
    
    if (!agent) {
      throw new Error(`No agent available for task type: ${node.task.type}`)
    }
    
    // Assign task via blackboard
    this.blackboard.assignTask(node.task, agent.id)
    
    // Execute task
    try {
      const result = await agent.execute(node.task, {
        blackboard: this.blackboard,
        dependencies: this.getDependencyResults(node)
      })
      
      // Report result to blackboard
      this.blackboard.reportResult(agent.id, {
        id: `result-${node.id}`,
        from: agent.id,
        to: 'orchestrator',
        timestamp: Date.now(),
        type: 'result',
        sessionId: node.task.payload.sessionId || '',
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
      console.error(`❌ [DAGExecutor] Task ${node.id} failed:`, error)
      
      this.blackboard.reportResult(agent.id, {
        id: `result-${node.id}`,
        from: agent.id,
        to: 'orchestrator',
        timestamp: Date.now(),
        type: 'result',
        sessionId: node.task.payload.sessionId || '',
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
  private getDependencyResults(node: DAGNode): Record<string, any> {
    const depResults: Record<string, any> = {}
    
    node.dependencies.forEach(depId => {
      const depTask = this.blackboard.getTask(depId)
      if (depTask?.result) {
        depResults[depId] = depTask.result
      }
    })
    
    return depResults
  }
}
```

---

### 5. **Agent Implementations**

#### **Writer Agent** (Content Generation)

```typescript
class WriterAgent implements Agent {
  id: string
  type: 'writer' = 'writer'
  capabilities = ['write_chapter', 'write_scene', 'write_dialogue', 'write_description']
  status: 'idle' | 'busy' | 'offline' = 'idle'
  
  metadata = {
    displayName: 'Writer',
    description: 'Generates creative content based on outlines and constraints',
    preferredModel: 'gpt-4o',
    maxConcurrentTasks: 3
  }
  
  constructor(
    id: string,
    private userKeyId: string
  ) {
    this.id = id
  }
  
  async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    this.status = 'busy'
    
    try {
      const { action, context: taskContext } = task.payload
      
      // Build prompt based on context
      const prompt = this.buildPrompt(action, taskContext, context.dependencies)
      
      // Call LLM
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'writer',
          model: this.metadata.preferredModel,
          system_prompt: this.getSystemPrompt(action),
          user_prompt: prompt,
          user_key_id: this.userKeyId,
          stream: false
        })
      })
      
      if (!response.ok) {
        throw new Error(`Writer API failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      this.status = 'idle'
      
      return {
        data: data.content,
        tokensUsed: data.usage?.total_tokens || 0,
        executionTime: Date.now() - task.startedAt!,
        metadata: {
          model: data.model,
          cost: data.cost
        }
      }
    } catch (error) {
      this.status = 'idle'
      throw error
    }
  }
  
  private buildPrompt(action: string, taskContext: any, deps: Record<string, any>): string {
    // Include outline from dependencies if available
    let prompt = ''
    
    if (deps.structure) {
      prompt += `Story Structure:\n${JSON.stringify(deps.structure, null, 2)}\n\n`
    }
    
    prompt += `Task: ${action}\n\n`
    prompt += `Section: ${taskContext.section?.name || 'Unknown'}\n`
    prompt += `Description: ${taskContext.section?.description || ''}\n\n`
    
    if (taskContext.constraints) {
      prompt += `Constraints:\n${JSON.stringify(taskContext.constraints, null, 2)}\n\n`
    }
    
    prompt += `Please write engaging content for this section.`
    
    return prompt
  }
  
  private getSystemPrompt(action: string): string {
    return `You are a professional writer. Your task is to create engaging, high-quality content based on the provided outline and constraints. Write naturally and creatively while following the specified guidelines.`
  }
}
```

#### **Critic Agent** (Content Review & Quality Assurance)

```typescript
class CriticAgent implements Agent {
  id: string
  type: 'critic' = 'critic'
  capabilities = ['review_content', 'suggest_improvements', 'check_consistency']
  status: 'idle' | 'busy' | 'offline' = 'idle'
  
  metadata = {
    displayName: 'Critic',
    description: 'Reviews content for quality, consistency, and adherence to guidelines',
    preferredModel: 'gpt-4o-mini',
    maxConcurrentTasks: 5
  }
  
  constructor(
    id: string,
    private userKeyId: string
  ) {
    this.id = id
  }
  
  async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    this.status = 'busy'
    
    try {
      const { content, constraints } = task.payload.context
      
      const prompt = this.buildReviewPrompt(content, constraints)
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'critic',
          model: this.metadata.preferredModel,
          system_prompt: this.getSystemPrompt(),
          user_prompt: prompt,
          user_key_id: this.userKeyId,
          stream: false,
          response_format: { type: 'json_object' }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Critic API failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      const critique = JSON.parse(data.content)
      
      this.status = 'idle'
      
      return {
        data: critique,
        tokensUsed: data.usage?.total_tokens || 0,
        executionTime: Date.now() - task.startedAt!,
        metadata: {
          model: data.model
        }
      }
    } catch (error) {
      this.status = 'idle'
      throw error
    }
  }
  
  private buildReviewPrompt(content: string, constraints: any): string {
    return `Review the following content for quality, consistency, and adherence to guidelines.

Content:
${content}

Guidelines:
${JSON.stringify(constraints, null, 2)}

Provide feedback in JSON format:
{
  "approved": boolean,
  "issues": ["issue1", "issue2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...],
  "score": number (0-10)
}`
  }
  
  private getSystemPrompt(): string {
    return `You are an expert editor and critic. Your role is to review content objectively, identify areas for improvement, and provide constructive feedback. Be thorough but fair.`
  }
}
```

---

### 6. **Agent Cluster Patterns**

#### **Pattern A: Writer + Critic Loop** (Iterative Refinement)

```typescript
class WriterCriticCluster {
  constructor(
    private writer: WriterAgent,
    private critic: CriticAgent,
    private maxIterations: number = 3
  ) {}
  
  async generate(task: AgentTask, context: AgentContext): Promise<string> {
    let content = ''
    let iteration = 0
    
    while (iteration < this.maxIterations) {
      // Writer generates content
      const writeResult = await this.writer.execute(
        { ...task, payload: { ...task.payload, iteration } },
        context
      )
      
      content = writeResult.data
      
      // Critic reviews
      const critiqueResult = await this.critic.execute(
        {
          ...task,
          type: 'review_content',
          payload: {
            context: {
              content,
              constraints: task.payload.context.constraints
            }
          }
        },
        context
      )
      
      const critique = critiqueResult.data
      
      // If approved, we're done
      if (critique.approved && critique.score >= 7) {
        console.log(`✅ [WriterCriticCluster] Content approved after ${iteration + 1} iteration(s)`)
        return content
      }
      
      // Otherwise, revise
      console.log(`🔄 [WriterCriticCluster] Iteration ${iteration + 1}: Score ${critique.score}/10, revising...`)
      
      // Update task context with critique for next iteration
      task.payload.context.previousCritique = critique
      iteration++
    }
    
    // Max iterations reached, return best effort
    console.log(`⚠️ [WriterCriticCluster] Max iterations reached, returning final draft`)
    return content
  }
}
```

#### **Pattern B: Competitive Writers** (Best-of-N)

```typescript
class CompetitiveWriterCluster {
  constructor(
    private writers: WriterAgent[],
    private critic: CriticAgent
  ) {}
  
  async generate(task: AgentTask, context: AgentContext): Promise<string> {
    // All writers generate proposals in parallel
    const proposals = await Promise.all(
      this.writers.map(writer => writer.execute(task, context))
    )
    
    // Critic ranks all proposals
    const rankings = await Promise.all(
      proposals.map(proposal => 
        this.critic.execute(
          {
            ...task,
            type: 'review_content',
            payload: {
              context: {
                content: proposal.data,
                constraints: task.payload.context.constraints
              }
            }
          },
          context
        )
      )
    )
    
    // Select best proposal
    const bestIndex = rankings.reduce(
      (bestIdx, critique, idx) => 
        critique.data.score > rankings[bestIdx].data.score ? idx : bestIdx,
      0
    )
    
    console.log(`🏆 [CompetitiveWriterCluster] Selected proposal ${bestIndex + 1} (score: ${rankings[bestIndex].data.score}/10)`)
    
    return proposals[bestIndex].data
  }
}
```

---

### 7. **Enhanced Orchestrator** (Multi-Agent Coordinator)

```typescript
class MultiAgentOrchestrator extends OrchestratorEngine {
  private agentRegistry: AgentRegistry
  private dagExecutor: DAGExecutor
  
  constructor(
    config: OrchestratorConfig,
    worldState?: WorldStateManager
  ) {
    super(config, worldState)
    
    this.agentRegistry = new AgentRegistry(this.blackboard)
    this.dagExecutor = new DAGExecutor(this.blackboard, this.agentRegistry)
    
    // Initialize agent pool
    this.initializeAgents()
  }
  
  private initializeAgents(): void {
    // Create writer agents
    for (let i = 0; i < 3; i++) {
      const writer = new WriterAgent(`writer-${i}`, this.config.userId)
      this.agentRegistry.register(writer)
    }
    
    // Create critic agents
    for (let i = 0; i < 2; i++) {
      const critic = new CriticAgent(`critic-${i}`, this.config.userId)
      this.agentRegistry.register(critic)
    }
    
    console.log(`✅ [MultiAgentOrchestrator] Initialized ${this.agentRegistry.getAll().length} agents`)
  }
  
  /**
   * Analyze task complexity and decide execution strategy
   */
  private analyzeExecutionStrategy(tasks: OrchestratorAction[]): 'sequential' | 'parallel' | 'cluster' {
    // Simple tasks: Sequential
    if (tasks.length <= 2) {
      return 'sequential'
    }
    
    // Check if tasks are parallelizable (no inter-dependencies)
    const contentTasks = tasks.filter(t => t.type === 'generate_content')
    
    if (contentTasks.length >= 3) {
      // Multi-chapter/scene write: Use parallel execution
      return 'parallel'
    }
    
    // Complex single task: Use cluster (writer + critic)
    return 'cluster'
  }
  
  /**
   * Execute actions with multi-agent coordination
   */
  async executeWithAgents(actions: OrchestratorAction[]): Promise<void> {
    const strategy = this.analyzeExecutionStrategy(actions)
    
    console.log(`🎯 [MultiAgentOrchestrator] Execution strategy: ${strategy}`)
    
    switch (strategy) {
      case 'sequential':
        // Execute one-by-one (existing behavior)
        for (const action of actions) {
          await this.executeAction(action)
        }
        break
        
      case 'parallel':
        // Build DAG and execute in parallel
        const tasks = actions.map(action => this.actionToTask(action))
        const dag = this.dagExecutor.buildDAG(tasks)
        await this.dagExecutor.execute(dag)
        break
        
      case 'cluster':
        // Use writer-critic cluster for single complex task
        const cluster = new WriterCriticCluster(
          this.agentRegistry.get('writer-0') as WriterAgent,
          this.agentRegistry.get('critic-0') as CriticAgent
        )
        
        const task = this.actionToTask(actions[0])
        await cluster.generate(task, { blackboard: this.blackboard, dependencies: {} })
        break
    }
  }
  
  private actionToTask(action: OrchestratorAction): AgentTask {
    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: action.type,
      payload: action.payload,
      dependencies: [],
      assignedTo: null,
      status: 'pending',
      priority: 'normal'
    }
  }
}
```

---

## 🎯 Implementation Phases

### **Phase 3A: Foundation** (Week 1)
- [ ] Define A2A message schema
- [ ] Enhance Blackboard with agent coordination
- [ ] Create AgentRegistry
- [ ] Implement base Agent interface

### **Phase 3B: Core Agents** (Week 2)
- [ ] Implement WriterAgent
- [ ] Implement CriticAgent
- [ ] Test writer + critic loop
- [ ] Add agent state monitoring

### **Phase 3C: DAG Execution** (Week 3)
- [ ] Build DAGExecutor
- [ ] Implement parallel execution
- [ ] Add dependency resolution
- [ ] Test multi-chapter parallel write

### **Phase 3D: Integration** (Week 4)
- [ ] Integrate with MultiAgentOrchestrator
- [ ] Add execution strategy selection
- [ ] Implement agent clusters
- [ ] Test end-to-end workflows

### **Phase 3E: Observability** (Week 5)
- [ ] Add execution tracing
- [ ] Build agent monitoring dashboard
- [ ] Add performance metrics
- [ ] Implement learning from execution

---

## 📊 Success Criteria

- ✅ **Parallel Execution:** 3+ chapters written simultaneously
- ✅ **Quality:** Critic agent approves 80%+ of content on first review
- ✅ **Performance:** 3x speedup for multi-chapter tasks
- ✅ **Reliability:** Zero deadlocks, graceful failure handling
- ✅ **Observability:** Full execution trace visible to user

---

## 🚨 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Deadlock in DAG** | Medium | High | Detect cycles, timeout tasks |
| **Agent coordination overhead** | Medium | Medium | Optimize message passing, use local state |
| **Cost explosion (parallel LLM calls)** | High | High | Set max concurrent tasks, estimate costs upfront |
| **Inconsistent content** | Medium | Medium | Use critic agent, cross-reference with outline |
| **Complex debugging** | High | Medium | Comprehensive logging, execution traces |

---

## 🔗 Related Documents

- `ORCHESTRATOR_REFACTOR_PLAN.md` - Overall refactor plan
- `PHASE1_WORLDSTATE_COMPLETE.md` - WorldState foundation
- `PHASE2_TOOL_SYSTEM_COMPLETE.md` - Tool system architecture

---

## 📝 References

- [A2A Protocol](https://www.a2aprotocol.net) - Agent-to-agent communication standard
- [IBM Agent Communication Protocol](https://www.ibm.com/think/topics/agent-communication-protocol)
- [Contract Net Protocol](https://en.wikipedia.org/wiki/Contract_Net_Protocol)
- [Blackboard Pattern](https://en.wikipedia.org/wiki/Blackboard_(design_pattern))

