/**
 * Phase 3: Writer Agent - Creative Content Generation
 * 
 * Specialized agent for generating creative, long-form content
 * for the ghostwriting platform. Understands format-specific conventions
 * and maintains consistency with outlines and style guides.
 */

import type { Agent, AgentTask, AgentContext, AgentResult, TaskPayload } from './types'

export class WriterAgent implements Agent {
  id: string
  type: 'writer' = 'writer'
  capabilities: string[]
  status: 'idle' | 'busy' | 'offline' = 'idle'
  
  metadata: {
    displayName: string
    description: string
    preferredModel?: string
    maxConcurrentTasks?: number
  }
  
  constructor(
    id: string,
    private userKeyId: string,
    capabilities: string[] = [
      'write_chapter',
      'write_scene', 
      'write_dialogue',
      'write_description',
      'write_beat',
      'write_act'
    ]
  ) {
    this.id = id
    this.capabilities = capabilities
    
    this.metadata = {
      displayName: 'Writer Agent',
      description: 'Generates creative content for novels, screenplays, and other long-form formats',
      preferredModel: 'gpt-4o', // High-quality model for creative writing
      maxConcurrentTasks: 3
    }
    
    console.log(`✍️ [WriterAgent] Initialized: ${id}`)
  }
  
  // ============================================================
  // EXECUTION
  // ============================================================
  
  async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    this.status = 'busy'
    const startTime = Date.now()
    
    try {
      const payload = task.payload as TaskPayload
      const { action, context: taskContext } = payload
      
      console.log(`✍️ [WriterAgent ${this.id}] Executing: ${action} for section "${taskContext.section?.name}"`)
      
      // Build prompt based on context and dependencies
      const prompt = this.buildPrompt(action, taskContext, context.dependencies)
      const systemPrompt = this.getSystemPrompt(action, taskContext)
      
      // Determine optimal model (can override default)
      const model = this.selectModel(taskContext)
      
      // Call LLM generation API
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'writer',
          model,
          system_prompt: systemPrompt,
          user_prompt: prompt,
          user_key_id: this.userKeyId,
          stream: false, // TODO: Add streaming support in future
          max_completion_tokens: this.estimateTokens(taskContext)
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(`Writer API failed: ${errorData.error || response.statusText}`)
      }
      
      const data = await response.json()
      const executionTime = Date.now() - startTime
      
      this.status = 'idle'
      
      console.log(`✅ [WriterAgent ${this.id}] Completed in ${executionTime}ms (${data.usage?.total_tokens || 0} tokens)`)
      
      return {
        data: data.content,
        tokensUsed: data.usage?.total_tokens || 0,
        executionTime,
        metadata: {
          model: data.model,
          cost: data.cost,
          wordCount: this.countWords(data.content)
        }
      }
    } catch (error) {
      this.status = 'idle'
      console.error(`❌ [WriterAgent ${this.id}] Execution failed:`, error)
      throw error
    }
  }
  
  // ============================================================
  // PROMPT BUILDING (Format-Aware)
  // ============================================================
  
  private buildPrompt(
    action: string,
    taskContext: TaskPayload['context'],
    dependencies: Record<string, any>
  ): string {
    let prompt = ''
    
    // Include full structure/outline from dependencies
    if (dependencies.structure) {
      prompt += this.formatStructureContext(dependencies.structure)
      prompt += '\n\n'
    }
    
    // Section details
    if (taskContext.section) {
      const { name, description } = taskContext.section
      prompt += `## Section: ${name}\n`
      if (description) {
        prompt += `Description: ${description}\n`
      }
      prompt += '\n'
    }
    
    // Constraints (tone, style, target audience, word count)
    if (taskContext.constraints) {
      prompt += this.formatConstraints(taskContext.constraints)
      prompt += '\n'
    }
    
    // Previous critique (for revisions)
    if (taskContext.previousCritique) {
      prompt += `## Revision Request\n`
      prompt += `Previous draft had the following issues:\n`
      taskContext.previousCritique.issues?.forEach((issue: string) => {
        prompt += `- ${issue}\n`
      })
      prompt += '\nSuggestions for improvement:\n'
      taskContext.previousCritique.suggestions?.forEach((suggestion: string) => {
        prompt += `- ${suggestion}\n`
      })
      prompt += '\nPlease address these points in your revision.\n\n'
    }
    
    // Task-specific instructions
    prompt += this.getTaskInstructions(action, taskContext)
    
    return prompt
  }
  
  private formatStructureContext(structure: any): string {
    let context = '## Story Structure\n\n'
    
    // Format structure as hierarchical outline
    const formatItems = (items: any[], level: number = 0): string => {
      let result = ''
      items.forEach(item => {
        const indent = '  '.repeat(level)
        result += `${indent}- ${item.name}\n`
        if (item.description) {
          result += `${indent}  ${item.description}\n`
        }
        if (item.children && item.children.length > 0) {
          result += formatItems(item.children, level + 1)
        }
      })
      return result
    }
    
    if (Array.isArray(structure)) {
      context += formatItems(structure)
    } else if (structure.structure) {
      context += formatItems(structure.structure)
    }
    
    return context
  }
  
  private formatConstraints(constraints: TaskPayload['context']['constraints']): string {
    let text = '## Writing Guidelines\n'
    
    if (constraints?.tone) {
      text += `- **Tone**: ${constraints.tone}\n`
    }
    if (constraints?.style) {
      text += `- **Style**: ${constraints.style}\n`
    }
    if (constraints?.targetAudience) {
      text += `- **Target Audience**: ${constraints.targetAudience}\n`
    }
    if (constraints?.length) {
      text += `- **Target Length**: ~${constraints.length} words\n`
    }
    
    return text
  }
  
  private getTaskInstructions(action: string, taskContext: TaskPayload['context']): string {
    const instructions: Record<string, string> = {
      write_chapter: 'Write a complete chapter that advances the story naturally. Include vivid descriptions, engaging dialogue, and character development. Maintain consistent pacing and ensure smooth transitions.',
      
      write_scene: 'Write a compelling scene with clear setting, action, and dialogue. Focus on showing rather than telling. Create tension and maintain reader engagement throughout.',
      
      write_dialogue: 'Write natural, character-appropriate dialogue that reveals personality and advances the plot. Include action beats and emotional subtext.',
      
      write_description: 'Write vivid, sensory descriptions that immerse the reader in the scene. Use specific details and avoid clichés. Balance description with pacing.',
      
      write_beat: 'Write a story beat that captures a key moment or turning point. Make it memorable and emotionally resonant.',
      
      write_act: 'Write a complete act that sets up conflict, develops characters, and builds toward a climax. Ensure proper story structure and pacing.'
    }
    
    return `## Your Task\n${instructions[action] || 'Write engaging, professional content that follows the outline and guidelines.'}\n\n**Now write the content:**`
  }
  
  // ============================================================
  // SYSTEM PROMPTS (Format-Specific)
  // ============================================================
  
  private getSystemPrompt(action: string, taskContext: TaskPayload['context']): string {
    // Determine format from context (if available)
    const format = this.detectFormat(taskContext)
    
    const basePrompt = `You are an expert ghostwriter specializing in ${format} writing. Your role is to create engaging, professional content that captivates readers and maintains high literary quality.

**Your Strengths:**
- Vivid, sensory descriptions that immerse readers
- Natural dialogue that reveals character
- Well-paced narrative that maintains tension
- Consistent voice and tone throughout
- Format-specific conventions and best practices

**Writing Philosophy:**
- Show, don't tell - use action and dialogue to reveal story
- Every scene must serve the plot or character development
- Vary sentence structure for rhythm and flow
- Use specific, concrete details over vague descriptions
- Maintain reader engagement on every page`
    
    // Add format-specific guidance
    const formatGuidance = this.getFormatGuidance(format)
    
    return `${basePrompt}\n\n${formatGuidance}\n\nWrite with confidence and creativity. Your goal is to produce professional, publishable content.`
  }
  
  private detectFormat(taskContext: TaskPayload['context']): string {
    // Try to detect format from section structure or constraints
    const sectionName = taskContext.section?.name?.toLowerCase() || ''
    
    if (sectionName.includes('chapter')) return 'novel'
    if (sectionName.includes('scene') || sectionName.includes('act')) return 'screenplay'
    if (sectionName.includes('beat')) return 'podcast'
    if (sectionName.includes('section')) return 'report'
    
    return 'long-form narrative'
  }
  
  private getFormatGuidance(format: string): string {
    const guidance: Record<string, string> = {
      novel: `**Novel Writing Standards:**
- Chapters should be 2,000-4,000 words
- Use deep POV to connect readers with characters
- Balance action, dialogue, and introspection
- Each chapter should end with a hook or question
- Maintain narrative momentum`,
      
      screenplay: `**Screenplay Standards:**
- Write in present tense with clear scene headings
- Keep descriptions concise and visual
- Dialogue should sound natural when spoken aloud
- Each scene should have a clear purpose
- Follow industry formatting conventions`,
      
      podcast: `**Podcast Script Standards:**
- Write conversationally for spoken delivery
- Use natural speech patterns and pauses
- Include cues for tone and emphasis
- Build energy and maintain listener engagement
- Plan for ~150 words per minute of audio`,
      
      report: `**Report Writing Standards:**
- Use clear, professional language
- Support claims with evidence and analysis
- Organize with clear sections and headings
- Balance detail with readability
- Provide actionable insights`,
      
      'long-form narrative': `**Narrative Writing Standards:**
- Engage readers from the first sentence
- Build clear narrative arcs
- Develop characters through action and dialogue
- Use literary techniques effectively
- Maintain consistent quality throughout`
    }
    
    return guidance[format] || guidance['long-form narrative']
  }
  
  // ============================================================
  // MODEL SELECTION
  // ============================================================
  
  private selectModel(taskContext: TaskPayload['context']): string {
    // For creative writing, always use high-quality models
    // Could add logic to select based on:
    // - Task complexity (longer scenes = better model)
    // - Quality requirements (revision = better model)
    // - Budget constraints
    
    return this.metadata.preferredModel || 'gpt-4o'
  }
  
  private estimateTokens(taskContext: TaskPayload['context']): number {
    // Estimate output tokens based on target length
    const targetWords = taskContext.constraints?.length || 2000
    
    // Rough estimate: 1 token ≈ 0.75 words
    // Add buffer for formatting and variation
    return Math.ceil(targetWords / 0.75 * 1.2)
  }
  
  // ============================================================
  // UTILITIES
  // ============================================================
  
  private countWords(text: string): number {
    return text.trim().split(/\s+/).length
  }
}

