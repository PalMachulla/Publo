/**
 * Phase 3: Critic Agent - Content Quality Assurance
 * 
 * Specialized agent for reviewing creative content quality.
 * Evaluates writing craft, consistency, pacing, and adherence to format conventions.
 * Provides constructive feedback for the Writer Agent to improve.
 */

import type { Agent, AgentTask, AgentContext, AgentResult, CritiquePayload } from './types'

interface CritiqueResult {
  approved: boolean
  score: number // 0-10
  issues: string[]
  suggestions: string[]
  strengths: string[]
  detailedFeedback: {
    craft: { score: number; notes: string }
    pacing: { score: number; notes: string }
    dialogue: { score: number; notes: string }
    consistency: { score: number; notes: string }
    formatting: { score: number; notes: string }
  }
}

export class CriticAgent implements Agent {
  id: string
  type: 'critic' = 'critic'
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
    private qualityThreshold: number = 7.0, // Min score to approve (0-10)
    capabilities: string[] = [
      'review_content',
      'suggest_improvements',
      'check_consistency',
      'evaluate_craft'
    ]
  ) {
    this.id = id
    this.capabilities = capabilities
    
    this.metadata = {
      displayName: 'Critic Agent',
      description: 'Reviews content for quality, consistency, and adherence to best practices',
      preferredModel: 'gpt-4o-mini', // Fast model for review
      maxConcurrentTasks: 5
    }
    
    console.log(`🎭 [CriticAgent] Initialized: ${id} (threshold: ${qualityThreshold})`)
  }
  
  // ============================================================
  // EXECUTION
  // ============================================================
  
  async execute(task: AgentTask, context: AgentContext): Promise<AgentResult> {
    this.status = 'busy'
    const startTime = Date.now()
    
    try {
      const { context: taskContext } = task.payload
      const { content, constraints, section } = taskContext
      
      console.log(`🎭 [CriticAgent ${this.id}] Reviewing content for section "${section?.name || 'Unknown'}"`)
      
      // Build review prompt
      const prompt = this.buildReviewPrompt(content, constraints, context.dependencies)
      const systemPrompt = this.getSystemPrompt(constraints)
      
      // ✅ FIX: Use /api/content/generate (like WriterAgent) instead of non-existent /api/generate
      // Combine system prompt and user prompt with JSON format instruction
      const combinedPrompt = `${systemPrompt}\n\n${prompt}\n\n**IMPORTANT: You must respond with ONLY valid JSON matching this exact structure (no markdown, no code blocks):**
{
  "approved": boolean,
  "score": number (0-10),
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "strengths": ["strength1", "strength2"],
  "detailedFeedback": {
    "craft": { "score": number, "notes": "string" },
    "pacing": { "score": number, "notes": "string" },
    "dialogue": { "score": number, "notes": "string" },
    "consistency": { "score": number, "notes": "string" },
    "formatting": { "score": number, "notes": "string" }
  }
}`
      
      const response = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentId: 'critic-review', // Identifier for review task
          prompt: combinedPrompt,
          storyStructureNodeId: context.metadata?.storyStructureNodeId || null,
          structureItems: context.dependencies?.structure || [],
          contentMap: context.dependencies?.contentMap || {},
          format: context.metadata?.format || 'novel'
          // /api/content/generate will auto-select model and handle streaming
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(`Critic API failed: ${errorData.error || response.statusText}`)
      }
      
      const data = await response.json()
      // Extract critique from response - /api/content/generate returns { content: "..." }
      const critique = this.parseCritique(data.content)
      const executionTime = Date.now() - startTime
      
      // Log review summary
      const approved = critique.approved ? '✅ APPROVED' : '⚠️ NEEDS REVISION'
      console.log(`🎭 [CriticAgent ${this.id}] ${approved} (score: ${critique.score}/10) in ${executionTime}ms`)
      
      this.status = 'idle'
      
      return {
        data: critique,
        tokensUsed: 0, // /api/content/generate doesn't return token usage yet
        executionTime,
        metadata: {
          model: 'auto-selected', // /api/content/generate auto-selects model
          approved: critique.approved,
          score: critique.score
        }
      }
    } catch (error) {
      this.status = 'idle'
      console.error(`❌ [CriticAgent ${this.id}] Review failed:`, error)
      throw error
    }
  }
  
  // ============================================================
  // PROMPT BUILDING
  // ============================================================
  
  private buildReviewPrompt(
    content: string,
    constraints: any,
    dependencies: Record<string, any>
  ): string {
    let prompt = '# Content Review Request\n\n'
    
    // Include structure/outline for consistency check
    if (dependencies.structure) {
      prompt += '## Story Structure (for consistency check)\n'
      prompt += this.formatStructure(dependencies.structure)
      prompt += '\n\n'
    }
    
    // Writing guidelines
    if (constraints) {
      prompt += '## Writing Guidelines\n'
      if (constraints.tone) prompt += `- **Tone**: ${constraints.tone}\n`
      if (constraints.style) prompt += `- **Style**: ${constraints.style}\n`
      if (constraints.targetAudience) prompt += `- **Target Audience**: ${constraints.targetAudience}\n`
      if (constraints.length) prompt += `- **Target Length**: ~${constraints.length} words\n`
      prompt += '\n'
    }
    
    // Content to review
    prompt += '## Content to Review\n\n'
    prompt += '```\n'
    prompt += content
    prompt += '\n```\n\n'
    
    // Review criteria
    prompt += this.getReviewCriteria(constraints)
    
    // Output format
    prompt += `\n## Output Format (JSON)\n
Provide your review as a JSON object with this structure:
\`\`\`json
{
  "approved": boolean,
  "score": number (0-10),
  "issues": ["issue 1", "issue 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "strengths": ["strength 1", "strength 2", ...],
  "detailedFeedback": {
    "craft": { "score": number, "notes": "..." },
    "pacing": { "score": number, "notes": "..." },
    "dialogue": { "score": number, "notes": "..." },
    "consistency": { "score": number, "notes": "..." },
    "formatting": { "score": number, "notes": "..." }
  }
}
\`\`\`

Approve if score >= ${this.qualityThreshold} and no critical issues exist.`
    
    return prompt
  }
  
  private formatStructure(structure: any): string {
    const formatItems = (items: any[], level: number = 0): string => {
      let result = ''
      items.forEach(item => {
        const indent = '  '.repeat(level)
        result += `${indent}- ${item.name}\n`
        if (item.children && item.children.length > 0) {
          result += formatItems(item.children, level + 1)
        }
      })
      return result
    }
    
    if (Array.isArray(structure)) {
      return formatItems(structure)
    } else if (structure.structure) {
      return formatItems(structure.structure)
    }
    return ''
  }
  
  private getReviewCriteria(constraints: any): string {
    return `## Review Criteria

Evaluate the content on these dimensions (0-10 scale):

**1. Writing Craft (Score: ?/10)**
- Vivid, sensory descriptions that immerse the reader
- Strong, active verbs and specific nouns
- Varied sentence structure for rhythm
- Fresh metaphors and imagery (no clichés)
- Effective use of literary devices

**2. Pacing (Score: ?/10)**
- Appropriate narrative momentum
- Scenes that don't drag or rush
- Effective transitions between beats
- Tension and release balanced
- Reader engagement maintained

**3. Dialogue (Score: ?/10)**
- Natural, character-appropriate speech
- Reveals personality and advances plot
- Includes action beats and subtext
- Avoids "talking heads" syndrome
- Sounds authentic when read aloud

**4. Consistency (Score: ?/10)**
- Aligns with story structure/outline
- Maintains established tone and voice
- Character behavior feels authentic
- Plot details are accurate
- Format conventions followed

**5. Formatting (Score: ?/10)**
- Proper paragraph breaks
- Appropriate use of dialogue tags
- Scene transitions are clear
- Format-specific conventions met
- Professional presentation

**Overall Assessment:**
- Calculate average score (sum/5)
- List specific issues that need fixing
- Provide actionable suggestions
- Note what's working well (strengths)
- Approve if score >= ${this.qualityThreshold} and no critical flaws`
  }
  
  // ============================================================
  // SYSTEM PROMPT
  // ============================================================
  
  private getSystemPrompt(constraints: any): string {
    return `You are an expert editor and writing coach with deep knowledge of creative writing craft. Your role is to provide constructive, actionable feedback that helps writers improve their work.

**Your Expertise:**
- 15+ years experience editing novels, screenplays, and long-form content
- Deep understanding of story structure, character development, and pacing
- Expert in dialogue craft and sensory description
- Knowledge of format-specific conventions and best practices
- Ability to identify both technical flaws and missed opportunities

**Your Approach:**
- Be thorough but fair in your assessment
- Identify specific issues with examples
- Provide concrete suggestions for improvement
- Acknowledge what's working well
- Focus on high-impact improvements first
- Maintain professional, supportive tone

**Review Philosophy:**
- Good writing shows, doesn't tell
- Every word should serve the story
- Readers must feel immersed in the scene
- Dialogue reveals character through subtext
- Pacing keeps readers turning pages

Evaluate the content honestly and provide feedback that will elevate the writing to professional quality.`
  }
  
  // ============================================================
  // CRITIQUE PARSING
  // ============================================================
  
  private parseCritique(responseContent: string): CritiqueResult {
    try {
      let critique: any
      
      // Handle different response formats
      if (typeof responseContent === 'object') {
        // Already parsed
        critique = responseContent
      } else if (typeof responseContent === 'string') {
        // Try to extract JSON from markdown code blocks or plain text
        let jsonContent = responseContent.trim()
        
        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        const codeBlockMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch) {
          jsonContent = codeBlockMatch[1].trim()
        }
        
        // Remove any leading/trailing markdown formatting
        jsonContent = jsonContent.replace(/^\*\*.*?\*\*\s*/g, '') // Remove **headers**
        jsonContent = jsonContent.replace(/^#+\s+.*$/gm, '') // Remove markdown headers
        
        // Try to find JSON object in text
        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonContent = jsonMatch[0]
        }
        
        try {
          critique = JSON.parse(jsonContent)
        } catch (parseError) {
          console.warn('⚠️ [CriticAgent] Failed to parse JSON, attempting fallback extraction')
          console.log('Response content:', responseContent.substring(0, 200))
          // If JSON parsing fails, create fallback
          return this.createFallbackCritique()
        }
      } else {
        return this.createFallbackCritique()
      }
      
      // Validate structure
      if (!critique.score || typeof critique.score !== 'number') {
        console.warn('⚠️ [CriticAgent] Invalid critique format, using fallback')
        return this.createFallbackCritique()
      }
      
      // Ensure approved field is set correctly
      critique.approved = critique.approved !== false && critique.score >= this.qualityThreshold
      
      // Ensure arrays exist
      critique.issues = critique.issues || []
      critique.suggestions = critique.suggestions || []
      critique.strengths = critique.strengths || []
      
      // Validate detailed feedback
      if (!critique.detailedFeedback) {
        critique.detailedFeedback = {
          craft: { score: critique.score, notes: 'No detailed feedback provided' },
          pacing: { score: critique.score, notes: 'No detailed feedback provided' },
          dialogue: { score: critique.score, notes: 'No detailed feedback provided' },
          consistency: { score: critique.score, notes: 'No detailed feedback provided' },
          formatting: { score: critique.score, notes: 'No detailed feedback provided' }
        }
      }
      
      return critique as CritiqueResult
    } catch (error) {
      console.error('❌ [CriticAgent] Failed to parse critique:', error)
      return this.createFallbackCritique()
    }
  }
  
  private createFallbackCritique(): CritiqueResult {
    return {
      approved: false,
      score: 5.0,
      issues: ['Review failed - unable to parse critique'],
      suggestions: ['Please try regenerating the content'],
      strengths: [],
      detailedFeedback: {
        craft: { score: 5, notes: 'Review incomplete' },
        pacing: { score: 5, notes: 'Review incomplete' },
        dialogue: { score: 5, notes: 'Review incomplete' },
        consistency: { score: 5, notes: 'Review incomplete' },
        formatting: { score: 5, notes: 'Review incomplete' }
      }
    }
  }
}

