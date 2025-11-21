/**
 * Orchestrator Engine
 * 
 * Core agentic system that:
 * 1. Analyzes user prompts
 * 2. Plans story structure using smart orchestrator model
 * 3. Delegates writing tasks to appropriate models
 * 4. Provides reasoning visibility to user
 */

import type { StoryFormat } from '@/types/nodes'
import { 
  MODEL_CATALOG,
  type ModelCapabilities,
  getModelById,
  getModelsForRole 
} from '@/lib/models/modelCapabilities'
import { 
  TemporalMemory,
  createTemporalMemory,
  type EventDelta 
} from './temporalMemory'

// ============================================================
// TYPES
// ============================================================

export type TaskType = 'structure_planning' | 'content_generation' | 'editing'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed'
export type TaskComplexity = 'simple' | 'moderate' | 'complex'
export type ReasoningMessageType = 'thinking' | 'decision' | 'task' | 'result' | 'error'

export interface TaskRequirements {
  wordCount: number
  tone?: string
  style?: string
  complexity: TaskComplexity
  context?: string
}

export interface OrchestratorTask {
  id: string
  type: TaskType
  targetStructureId?: string
  description: string
  requirements: TaskRequirements
  assignedModel?: string
  status: TaskStatus
  result?: string
  error?: string
  startTime?: number
  endTime?: number
}

export interface StructureItem {
  id: string
  level: number
  name: string
  parentId?: string
  wordCount?: number
  summary?: string
  order?: number
}

export interface OrchestratorPlan {
  reasoning: string
  structure: StructureItem[]
  tasks: OrchestratorTask[]
  metadata?: {
    totalWordCount: number
    estimatedTime: string
    recommendedModels: string[]
  }
}

export interface OrchestratorPreferences {
  orchestratorModel: string
  availableModels: string[]
  userKeyId: string
}

export interface ReasoningMessage {
  timestamp: string
  content: string
  type: ReasoningMessageType
}

// ============================================================
// ORCHESTRATOR SYSTEM PROMPT
// ============================================================

const ORCHESTRATOR_SYSTEM_PROMPT = `You are a master story architect and orchestrator AI.

Your role:
1. Analyze creative prompts deeply
2. Design optimal story structures
3. Break stories into specific, actionable writing tasks
4. Think strategically about narrative flow

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations outside JSON.

Return format:
{
  "reasoning": "Your detailed analysis and strategic thinking here. Explain your structural choices, narrative decisions, and why you broke it down this way.",
  "structure": [
    {
      "id": "unique_id",
      "level": 1,
      "name": "Act I - The Opening",
      "parentId": null,
      "wordCount": 3000,
      "summary": "Brief summary of what happens in this section",
      "order": 0
    }
  ],
  "tasks": [
    {
      "id": "task_1",
      "type": "content_generation",
      "targetStructureId": "unique_id",
      "description": "Write opening scene: protagonist discovers mysterious artifact in Arctic wasteland",
      "requirements": {
        "wordCount": 800,
        "tone": "mysterious and tense",
        "style": "cinematic with vivid sensory details",
        "complexity": "moderate",
        "context": "This is the hook - establish mood and intrigue"
      }
    }
  ]
}

Guidelines:
- reasoning: Show your thinking process (visible to user)
- structure: Hierarchical (level 1-4), use parentId for nesting
- tasks: Specific, actionable writing instructions
- complexity: "simple" for < 500 words, "moderate" for 500-2000, "complex" for > 2000
- Be strategic: think about pacing, tension, character arcs
- Consider the format requirements (screenplay vs novel vs report)
`

// ============================================================
// ORCHESTRATOR ENGINE CLASS
// ============================================================

export class OrchestratorEngine {
  private modelCatalog: ModelCapabilities[]
  private onReasoning: (message: string, type: ReasoningMessageType) => void
  private temporalMemory: TemporalMemory
  
  constructor(
    modelCatalog: ModelCapabilities[],
    onReasoning: (message: string, type: ReasoningMessageType) => void,
    userId: string = 'system'
  ) {
    this.modelCatalog = modelCatalog
    this.onReasoning = onReasoning
    this.temporalMemory = createTemporalMemory(userId, 'orchestration')
    
    this.log('🧠 Temporal memory initialized', 'thinking')
  }
  
  /**
   * Main orchestration flow
   */
  async orchestrate(
    userPrompt: string,
    format: StoryFormat,
    preferences: OrchestratorPreferences
  ): Promise<OrchestratorPlan> {
    
    // Log orchestration start event
    const orchestrationEvent = await this.temporalMemory.addEvent({
      verb: 'orchestration_started',
      object: format,
      attributes_diff: {
        prompt_length: userPrompt.length,
        orchestrator_model: preferences.orchestratorModel,
        available_writers: preferences.availableModels.length
      },
      context: {
        format,
        user_prompt_hash: this.hashString(userPrompt)
      }
    })
    
    try {
      this.log('🧠 Initializing orchestration...', 'thinking')
      
      // Step 1: Validate models
      this.log(`🔍 Checking available models...`, 'thinking')
      const orchestratorModel = this.validateOrchestratorModel(
        preferences.orchestratorModel
      )
      const writerModels = this.validateWriterModels(
        preferences.availableModels
      )
      
      // Log model selection event
      await this.temporalMemory.addEvent({
        verb: 'models_selected',
        object: orchestratorModel.id,
        attributes_diff: {
          orchestrator: orchestratorModel.displayName,
          writers: writerModels.map(m => m.displayName),
          writer_count: writerModels.length
        },
        derived_from: [orchestrationEvent.id]
      })
      
      this.log(
        `🎯 Using orchestrator: ${orchestratorModel.displayName}`,
        'decision'
      )
      this.log(
        `✍️ Available writers: ${writerModels.map(m => m.displayName).join(', ')}`,
        'decision'
      )
      
      // Step 2: Create structure plan (orchestrator thinks)
      this.log('💭 Orchestrator analyzing prompt and planning structure...', 'thinking')
      
      const plan = await this.createStructurePlan(
        userPrompt,
        format,
        orchestratorModel.id,
        preferences.userKeyId
      )
      
      this.log(
        `📋 Plan created: ${plan.structure.length} sections, ${plan.tasks.length} tasks`,
        'result'
      )
      
      // Log plan creation event
      await this.temporalMemory.addEvent({
        verb: 'plan_created',
        object: `${plan.structure.length}_sections`,
        attributes_diff: {
          section_count: plan.structure.length,
          task_count: plan.tasks.length,
          reasoning_length: plan.reasoning?.length || 0
        },
        derived_from: [orchestrationEvent.id]
      })
      
      // Log orchestrator's reasoning
      if (plan.reasoning) {
        this.log(`💭 Orchestrator reasoning:\n${plan.reasoning}`, 'thinking')
      }
      
      // Step 3: Assign models to tasks
      this.log('🎯 Assigning models to tasks...', 'thinking')
      
      for (const task of plan.tasks) {
        const selectedModel = this.selectModelForTask(
          task,
          writerModels.length > 0 ? writerModels : [orchestratorModel]
        )
        
        task.assignedModel = selectedModel.id
        
        // Log model assignment event
        await this.temporalMemory.addEvent({
          verb: 'task_assigned',
          object: task.id,
          attributes_diff: {
            assigned_model: selectedModel.displayName,
            complexity: task.requirements.complexity,
            word_count: task.requirements.wordCount
          },
          derived_from: [orchestrationEvent.id]
        })
        
        this.log(
          `📌 "${task.description.substring(0, 50)}..." → ${selectedModel.displayName} (${task.requirements.complexity})`,
          'decision'
        )
      }
      
      // Log orchestration completion
      await this.temporalMemory.addEvent({
        verb: 'orchestration_completed',
        object: format,
        attributes_diff: {
          duration_ms: Date.now() - orchestrationEvent.timestamp,
          success: true
        },
        derived_from: [orchestrationEvent.id]
      })
      
      this.log('✅ Orchestration plan complete and ready for execution', 'result')
      
      // Create timeline snapshot
      try {
        await this.temporalMemory.createSnapshot()
      } catch (e) {
        // Snapshots are optional, don't fail if they error
        console.debug('Could not create snapshot:', e)
      }
      
      return plan
      
    } catch (error: any) {
      // Log orchestration failure
      await this.temporalMemory.addEvent({
        verb: 'orchestration_failed',
        object: format,
        attributes_diff: {
          error_message: error.message,
          duration_ms: Date.now() - orchestrationEvent.timestamp
        },
        derived_from: [orchestrationEvent.id]
      })
      
      this.log(`❌ Orchestration failed: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * Execute a single task with assigned model
   */
  async executeTask(
    task: OrchestratorTask,
    userKeyId: string
  ): Promise<string> {
    
    // Log task execution start
    const taskStartEvent = await this.temporalMemory.addEvent({
      verb: 'task_started',
      object: task.id,
      attributes_diff: {
        assigned_model: task.assignedModel,
        target_word_count: task.requirements.wordCount,
        complexity: task.requirements.complexity
      },
      context: {
        user_prompt_hash: this.hashString(task.description)
      }
    })
    
    try {
      task.status = 'in_progress'
      task.startTime = Date.now()
      
      const model = getModelById(task.assignedModel!)
      if (!model) {
        throw new Error(`Model not found: ${task.assignedModel}`)
      }
      
      this.log(
        `⚡ Executing: "${task.description.substring(0, 60)}..." with ${model.displayName}`,
        'task'
      )
      
      // Construct writer prompt
      const writerPrompt = this.buildWriterPrompt(task)
      
      // Call writer model
      const result = await this.callWriterModel(
        task.assignedModel!,
        writerPrompt,
        task.requirements.wordCount,
        userKeyId
      )
      
      task.status = 'completed'
      task.endTime = Date.now()
      task.result = result
      
      const duration = ((task.endTime - task.startTime) / 1000).toFixed(1)
      
      // Log task completion
      await this.temporalMemory.addEvent({
        verb: 'task_completed',
        object: task.id,
        attributes_diff: {
          duration_ms: task.endTime - task.startTime,
          output_length: result.length,
          success: true
        },
        derived_from: [taskStartEvent.id]
      })
      
      this.log(
        `✅ Task completed in ${duration}s (${result.length} chars)`,
        'result'
      )
      
      return result
      
    } catch (error: any) {
      task.status = 'failed'
      task.error = error.message
      task.endTime = Date.now()
      
      // Log task failure
      await this.temporalMemory.addEvent({
        verb: 'task_failed',
        object: task.id,
        attributes_diff: {
          error_message: error.message,
          duration_ms: task.endTime! - task.startTime!
        },
        derived_from: [taskStartEvent.id]
      })
      
      this.log(`❌ Task failed: ${error.message}`, 'error')
      throw error
    }
  }
  
  /**
   * Create structure plan using orchestrator model
   */
  private async createStructurePlan(
    userPrompt: string,
    format: StoryFormat,
    orchestratorModelId: string,
    userKeyId: string
  ): Promise<OrchestratorPlan> {
    
    // Build format-specific instructions
    const formatInstructions = this.getFormatInstructions(format)
    
    const fullSystemPrompt = `${ORCHESTRATOR_SYSTEM_PROMPT}\n\n${formatInstructions}`
    
    const fullUserPrompt = `Format: ${format}\n\nUser's creative prompt:\n${userPrompt}\n\nCreate a detailed structure plan with specific writing tasks.`
    
    // Call orchestrator model
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'orchestrator',
        model: orchestratorModelId,
        system_prompt: fullSystemPrompt,
        user_prompt: fullUserPrompt,
        max_completion_tokens: 16000,
        user_key_id: userKeyId
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Orchestrator API call failed')
    }
    
    const data = await response.json()
    
    if (!data.success || !data.plan) {
      throw new Error('Invalid orchestrator response format')
    }
    
    // Validate plan structure
    if (!data.plan.structure || !Array.isArray(data.plan.structure)) {
      throw new Error('Plan missing structure array')
    }
    
    if (!data.plan.tasks || !Array.isArray(data.plan.tasks)) {
      throw new Error('Plan missing tasks array')
    }
    
    // Convert to OrchestratorPlan type
    const plan: OrchestratorPlan = {
      reasoning: data.plan.reasoning || '',
      structure: data.plan.structure.map((item: any, index: number) => ({
        id: item.id,
        level: item.level,
        name: item.name,
        parentId: item.parentId || null,
        wordCount: item.wordCount || 1000,
        summary: item.summary || '',
        order: item.order ?? index
      })),
      tasks: data.plan.tasks.map((task: any) => ({
        id: task.id,
        type: task.type || 'content_generation',
        targetStructureId: task.targetStructureId,
        description: task.description,
        requirements: {
          wordCount: task.requirements.wordCount || 1000,
          tone: task.requirements.tone,
          style: task.requirements.style,
          complexity: task.requirements.complexity || 'moderate',
          context: task.requirements.context
        },
        status: 'pending' as TaskStatus
      }))
    }
    
    return plan
  }
  
  /**
   * Select best model for a specific task
   */
  private selectModelForTask(
    task: OrchestratorTask,
    availableModels: ModelCapabilities[]
  ): ModelCapabilities {
    
    if (availableModels.length === 1) {
      // Only one model available (probably orchestrator doing everything)
      return availableModels[0]
    }
    
    const { complexity, wordCount } = task.requirements
    
    // Strategy 1: Simple, short tasks → fastest model
    if (complexity === 'simple' || wordCount < 500) {
      const fastestModel = availableModels
        .filter(m => m.speed === 'instant')
        .sort((a, b) => a.cost === 'cheap' ? -1 : 1)[0]
      
      if (fastestModel) return fastestModel
    }
    
    // Strategy 2: Complex tasks → smartest model
    if (complexity === 'complex' || wordCount > 2000) {
      const smartestModel = availableModels
        .filter(m => m.cost === 'expensive' || m.cost === 'moderate')
        .sort((a, b) => {
          // Prioritize expensive over moderate
          if (a.cost === 'expensive' && b.cost !== 'expensive') return -1
          if (b.cost === 'expensive' && a.cost !== 'expensive') return 1
          return 0
        })[0]
      
      if (smartestModel) return smartestModel
    }
    
    // Strategy 3: Moderate tasks → balanced model
    const balancedModel = availableModels.find(m => 
      (m.speed === 'fast' || m.speed === 'medium') &&
      (m.cost === 'cheap' || m.cost === 'moderate')
    )
    
    if (balancedModel) return balancedModel
    
    // Fallback: first available
    return availableModels[0]
  }
  
  /**
   * Build prompt for writer model
   */
  private buildWriterPrompt(task: OrchestratorTask): string {
    const { description, requirements } = task
    
    let prompt = `${description}\n\n`
    
    prompt += `Requirements:\n`
    prompt += `- Target word count: ~${requirements.wordCount} words\n`
    
    if (requirements.tone) {
      prompt += `- Tone: ${requirements.tone}\n`
    }
    
    if (requirements.style) {
      prompt += `- Style: ${requirements.style}\n`
    }
    
    if (requirements.context) {
      prompt += `- Context: ${requirements.context}\n`
    }
    
    prompt += `\nWrite the content now (plain text/markdown, no YAML):`
    
    return prompt
  }
  
  /**
   * Call writer model via API
   */
  private async callWriterModel(
    modelId: string,
    prompt: string,
    maxTokens: number,
    userKeyId: string
  ): Promise<string> {
    
    // Estimate tokens needed (roughly 1.5 tokens per word)
    const estimatedTokens = Math.ceil(maxTokens * 1.5)
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'writer',
        model: modelId,
        system_prompt: 'You are a skilled writer. Write exactly what is requested with high quality prose.',
        user_prompt: prompt,
        max_completion_tokens: estimatedTokens,
        user_key_id: userKeyId
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Writer API call failed')
    }
    
    const data = await response.json()
    
    if (!data.success || !data.content) {
      throw new Error('Invalid writer response format')
    }
    
    return data.content
  }
  
  /**
   * Get format-specific instructions for orchestrator
   */
  private getFormatInstructions(format: StoryFormat): string {
    const instructions: Record<StoryFormat, string> = {
      'screenplay': `
Format: SCREENPLAY
Structure: Use 3-4 act structure with sequences and scenes
Levels: Act (1) → Sequence (2) → Scene (3) → Beat (4)
Typical lengths: Act (20-30 pages), Sequence (10-15 pages), Scene (2-5 pages)
Focus: Visual storytelling, clear scene headings, action and dialogue
`,
      'novel': `
Format: NOVEL
Structure: Use parts/chapters/sections as appropriate
Levels: Part (1) → Chapter (2) → Section (3) → Scene (4)
Typical lengths: Part (20,000-40,000 words), Chapter (2,000-5,000 words)
Focus: Character depth, prose quality, pacing, narrative voice
`,
      'short-story': `
Format: SHORT STORY
Structure: Simple structure with beginning/middle/end
Levels: Part (1) → Section (2) → Scene (3)
Typical length: 3,000-7,500 words total
Focus: Tight narrative, single plot thread, strong climax
`,
      'report': `
Format: REPORT
Structure: Structured sections with clear hierarchy
Levels: Section (1) → Subsection (2) → Topic (3)
Typical lengths: Section (2,000-5,000 words), Subsection (500-1,500 words)
Focus: Clarity, evidence, analysis, professional tone
`,
      'article': `
Format: ARTICLE
Structure: Introduction, body sections, conclusion
Levels: Section (1) → Subsection (2) → Paragraph group (3)
Typical lengths: Section (800-1,500 words), Subsection (300-600 words)
Focus: Engaging hook, clear arguments, strong conclusion
`,
      'essay': `
Format: ESSAY
Structure: Thesis-driven with supporting arguments
Levels: Section (1) → Argument (2) → Evidence (3)
Typical lengths: Section (1,000-2,000 words), Argument (400-800 words)
Focus: Thesis clarity, logical flow, persuasive evidence
`,
      'podcast': `
Format: PODCAST SCRIPT
Structure: Intro/segments/outro with time markers
Levels: Segment (1) → Topic (2) → Discussion point (3)
Typical lengths: Segment (5-10 minutes spoken), Topic (2-3 minutes)
Focus: Conversational tone, clear transitions, engagement
`
    }
    
    return instructions[format] || instructions['novel']
  }
  
  /**
   * Validate orchestrator model
   */
  private validateOrchestratorModel(modelId: string): ModelCapabilities {
    const model = getModelById(modelId)
    
    if (!model) {
      throw new Error(`Orchestrator model not found: ${modelId}`)
    }
    
    if (!model.roles.includes('orchestrator')) {
      throw new Error(`Model ${modelId} is not suitable for orchestrator role`)
    }
    
    return model
  }
  
  /**
   * Validate writer models
   */
  private validateWriterModels(modelIds: string[]): ModelCapabilities[] {
    if (modelIds.length === 0) {
      return [] // Will use orchestrator for writing too
    }
    
    const models = modelIds
      .map(id => getModelById(id))
      .filter((m): m is ModelCapabilities => m !== undefined)
      .filter(m => m.roles.includes('writer'))
    
    return models
  }
  
  /**
   * Log reasoning message
   */
  private log(message: string, type: ReasoningMessageType): void {
    this.onReasoning(message, type)
  }
  
  /**
   * Hash string for privacy (used in event logging)
   */
  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
  
  /**
   * Get audit trail for debugging and compliance
   */
  async getAuditTrail(startTime?: number, endTime?: number): Promise<any[]> {
    const now = Date.now()
    const start = startTime || (now - 3600000) // Last hour by default
    const end = endTime || now
    
    return this.temporalMemory.getAuditTrail(start, end)
  }
  
  /**
   * Prove timeline integrity for compliance
   */
  async proveTimeline(range?: [number, number]): Promise<any> {
    const now = Date.now()
    const defaultRange: [number, number] = [now - 3600000, now]
    
    return this.temporalMemory.proveTimeline(range || defaultRange)
  }
}

