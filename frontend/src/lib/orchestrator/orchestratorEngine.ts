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
  userKeyId?: string
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
2. Design optimal structures based on document format
3. Break documents into specific, actionable writing tasks
4. Think strategically about content flow and organization

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations outside JSON.

Return format:
{
  "reasoning": "Your detailed analysis and strategic thinking here. Explain your structural choices, organizational decisions, and why you broke it down this way.",
  "structure": [
    {
      "id": "unique_id",
      "level": 1,
      "name": "[Format-appropriate section name - see format instructions]",
      "parentId": null,
      "wordCount": 3000,
      "summary": "Brief summary of what this section covers",
      "order": 0
    }
  ],
  "tasks": [
    {
      "id": "task_1",
      "type": "content_generation",
      "targetStructureId": "unique_id",
      "description": "Clear, specific writing instruction for this section",
      "requirements": {
        "wordCount": 800,
        "tone": "[appropriate for format]",
        "style": "[appropriate for format]",
        "complexity": "moderate",
        "context": "Purpose of this section in overall structure"
      }
    }
  ]
}

Guidelines:
- reasoning: Show your thinking process (visible to user)
- structure: Hierarchical (level 1-4), use parentId for nesting
- tasks: Specific, actionable writing instructions
- complexity: "simple" for < 500 words, "moderate" for 500-2000, "complex" for > 2000
- FOLLOW FORMAT INSTRUCTIONS: Each format has specific structure requirements (see below)
- Section names MUST match the format (Reports use "Executive Summary", NOT "Act I")
- Be strategic: think about content flow, logical organization, and format conventions
`

// ============================================================
// ORCHESTRATOR ENGINE CLASS
// ============================================================

export class OrchestratorEngine {
  private modelCatalog: ModelCapabilities[]
  private onReasoning: (message: string, type: ReasoningMessageType) => void
  private onModelStream?: (content: string, type: 'reasoning' | 'content') => void
  private temporalMemory: TemporalMemory
  
  constructor(
    modelCatalog: ModelCapabilities[],
    onReasoning: (message: string, type: ReasoningMessageType) => void,
    userId: string = 'system',
    onModelStream?: (content: string, type: 'reasoning' | 'content') => void
  ) {
    this.modelCatalog = modelCatalog
    this.onReasoning = onReasoning
    this.onModelStream = onModelStream
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
      
      // Validate userKeyId is available
      if (!preferences.userKeyId) {
        const errorMsg = 'No API key configured. Please configure your orchestrator in the Profile page.'
        this.log(`❌ ${errorMsg}`, 'error')
        throw new Error(errorMsg)
      }
      
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
    
    const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/-/g, ' ')
    const fullUserPrompt = `The user wants to create a ${formatLabel}.\n\nUser's creative prompt:\n${userPrompt}\n\nPlease analyze this prompt carefully and create a detailed structure plan optimized for the ${formatLabel} format, with specific writing tasks.`
    
    // Check if streaming is enabled
    const useStreaming = !!this.onModelStream
    
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
        user_key_id: userKeyId,
        stream: useStreaming // NEW: Enable streaming if callback exists
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Orchestrator API call failed')
    }
    
    // ═══════════════════════════════════════════════════════════════
    // STREAMING MODE: Parse SSE stream
    // ═══════════════════════════════════════════════════════════════
    if (useStreaming && response.headers.get('content-type')?.includes('text/event-stream')) {
      let fullContent = ''
      let reasoningBuffer = ''
      
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            
            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'reasoning' && this.onModelStream) {
                // Stream model's reasoning tokens
                reasoningBuffer += parsed.content
                this.onModelStream(parsed.content, 'reasoning')
              } else if (parsed.type === 'content' && parsed.content) {
                // Stream regular content (JSON plan)
                fullContent += parsed.content
                if (this.onModelStream) {
                  this.onModelStream(parsed.content, 'content')
                }
              } else if (parsed.type === 'done') {
                // Stream complete
                break
              } else if (parsed.type === 'error') {
                throw new Error(parsed.error || 'Streaming failed')
              }
            } catch (e) {
              // Ignore parse errors for individual chunks
            }
          }
        }
      }
      
      // Parse the accumulated JSON content
      try {
        // Extract JSON from markdown code blocks if present
        let jsonContent = fullContent.trim()
        const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim()
        }
        
        const plan = JSON.parse(jsonContent)
        
        // Validate plan structure
        if (!plan.structure || !Array.isArray(plan.structure)) {
          throw new Error('Plan missing structure array')
        }
        
        if (!plan.tasks || !Array.isArray(plan.tasks)) {
          throw new Error('Plan missing tasks array')
        }
        
        // Add reasoning buffer if captured
        if (reasoningBuffer) {
          plan.reasoning = reasoningBuffer
        }
        
        return plan as OrchestratorPlan
      } catch (error) {
        console.error('[Orchestrator] JSON Parse Error:', error)
        console.error('[Orchestrator] Raw content (first 500 chars):', fullContent.substring(0, 500))
        console.error('[Orchestrator] Raw content (last 500 chars):', fullContent.substring(Math.max(0, fullContent.length - 500)))
        this.log(`❌ Model returned invalid JSON. Content length: ${fullContent.length} chars`, 'error')
        throw new Error(`Failed to parse orchestrator plan: ${error}\n\nResponse preview: ${fullContent.substring(0, 200)}...`)
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // BATCH MODE: Parse JSON response (existing behavior)
    // ═══════════════════════════════════════════════════════════════
    const data = await response.json()
    
    if (!data.success || !data.plan) {
      console.error('[Orchestrator] Invalid response:', data)
      this.log(`❌ API returned invalid format. Success: ${data.success}, Has plan: ${!!data.plan}`, 'error')
      throw new Error('Invalid orchestrator response format')
    }
    
    // Validate plan structure
    if (!data.plan.structure || !Array.isArray(data.plan.structure)) {
      console.error('[Orchestrator] Plan structure invalid:', data.plan)
      throw new Error('Plan missing structure array')
    }
    
    if (!data.plan.tasks || !Array.isArray(data.plan.tasks)) {
      console.error('[Orchestrator] Plan tasks invalid:', data.plan)
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
FORMAT: SCREENPLAY

MANDATORY STRUCTURE:
- Level 1: Acts (e.g., "Act I - Setup", "Act II - Confrontation", "Act III - Resolution")
- Level 2: Sequences within acts (e.g., "Sequence 1 - The Catalyst")
- Level 3: Scenes within sequences (e.g., "Scene 1 - Opening Image")
- Level 4: Beats within scenes (e.g., "Beat 1 - Character Introduction")

REQUIRED SECTIONS:
- Use 3-act structure (Act I: 25%, Act II: 50%, Act III: 25%)
- Each act has 2-3 sequences
- Each sequence has 2-4 scenes
- Each scene has 2-3 beats

NAMING CONVENTION: Acts must start with "Act I", "Act II", "Act III"
Focus: Visual storytelling, scene headings, action and dialogue
`,
      'novel': `
FORMAT: NOVEL

MANDATORY STRUCTURE:
- Level 1: Parts (e.g., "Part I - The Beginning", "Part II - Rising Action")
- Level 2: Chapters within parts (e.g., "Chapter 1 - The Awakening")
- Level 3: Sections within chapters (e.g., "Section 1 - Morning")
- Level 4: Beats/scenes within sections

REQUIRED SECTIONS:
- Use 3-5 part structure for longer novels
- Each part has 5-10 chapters
- Each chapter has 3-5 sections
- Typical lengths: Part (25k words), Chapter (3k words)

NAMING CONVENTION: Parts must start with "Part I", "Part II", etc. Chapters with "Chapter 1", "Chapter 2"
Focus: Character depth, prose quality, pacing, narrative voice
`,
      'short-story': `
FORMAT: SHORT STORY

MANDATORY STRUCTURE:
- Level 1: Main parts (e.g., "Beginning", "Middle", "End")
- Level 2: Sections within parts (e.g., "Section 1 - The Hook")
- Level 3: Beats/moments within sections

REQUIRED SECTIONS:
- Use 3-part structure (Beginning 30%, Middle 40%, End 30%)
- Keep simple - 6-9 total sections maximum
- Total target: 3,000-7,500 words

NAMING CONVENTION: Use "Beginning", "Middle", "End" for parts. Simple descriptive names for sections.
Focus: Tight narrative, single plot thread, strong climax
`,
      'report': `
FORMAT: BUSINESS/RESEARCH REPORT

MANDATORY STRUCTURE (DO NOT USE "ACT" OR "SEQUENCE" - THOSE ARE FOR SCREENPLAYS!):
- Level 1: Major sections (e.g., "Executive Summary", "Introduction", "Findings", "Recommendations", "Conclusion")
- Level 2: Subsections within sections (e.g., "Background", "Methodology", "Key Results")
- Level 3: Topics within subsections (e.g., "Market Analysis", "Risk Assessment")

REQUIRED SECTIONS (in order):
1. "Executive Summary" (level 1)
2. "Introduction" (level 1)
   - "Background" (level 2)
   - "Objectives" (level 2)
3. "Methodology" or "Approach" (level 1)
4. "Findings" or "Results" (level 1)
   - Subsections for each major finding
5. "Analysis" or "Discussion" (level 1)
6. "Recommendations" (level 1)
7. "Conclusion" (level 1)

NAMING CONVENTION: Use professional report terminology. NO ACTS, NO SEQUENCES!
Focus: Clarity, evidence-based, objective tone, actionable insights
`,
      'article': `
FORMAT: ARTICLE/BLOG POST

MANDATORY STRUCTURE:
- Level 1: Main sections (e.g., "Introduction", "The Problem", "Solution", "Conclusion")
- Level 2: Subsections within sections (e.g., "Background", "Case Study")
- Level 3: Supporting points or examples

REQUIRED SECTIONS:
- Start with compelling "Introduction"
- 3-5 main body sections with descriptive names
- End with "Conclusion" or strong closing

NAMING CONVENTION: Use descriptive, engaging section names. NO acts or sequences!
Focus: Engaging hook, clear arguments, strong conclusion, journalistic style
`,
      'essay': `
FORMAT: ACADEMIC ESSAY

MANDATORY STRUCTURE:
- Level 1: Main sections (e.g., "Introduction", "Argument 1", "Argument 2", "Conclusion")
- Level 2: Subsections (e.g., "Evidence", "Analysis", "Counterargument")
- Level 3: Supporting points

REQUIRED SECTIONS:
- "Introduction" with thesis statement
- 3-5 argument sections (each with evidence + analysis)
- "Conclusion" summarizing arguments

NAMING CONVENTION: Use clear argumentative structure. NO acts or sequences!
Focus: Thesis clarity, logical flow, persuasive evidence, academic tone
`,
      'podcast': `
FORMAT: PODCAST SCRIPT/EPISODE

MANDATORY STRUCTURE (DO NOT USE "ACT" OR "SEQUENCE"!):
- Level 1: Major segments (e.g., "Introduction", "Segment 1 - [Topic]", "Interview", "Outro")
- Level 2: Topics or discussions within segments (e.g., "Discussion", "Q&A", "Guest Introduction")
- Level 3: Discussion points or questions

REQUIRED SECTIONS:
1. "Introduction" or "Cold Open" (level 1)
2. Main content segments - 3-5 segments with descriptive names (level 1)
   - Each segment has 2-3 discussion topics (level 2)
3. "Conclusion" or "Outro" (level 1)

NAMING CONVENTION: Use "Introduction", "Segment 1 - [Topic Name]", "Interview", "Outro". NO ACTS!
Focus: Conversational tone, clear transitions, audience engagement, spoken format
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

