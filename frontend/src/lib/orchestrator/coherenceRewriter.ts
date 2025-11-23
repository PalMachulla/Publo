/**
 * Coherence Rewriter - Ghostwriter-Level Multi-Section Updates
 * 
 * Orchestrates complex rewrites that maintain narrative consistency
 * across multiple sections of a story.
 */

import { analyzeDependencies, type StorySection, type DependencyAnalysis } from './dependencyAnalyzer'

export interface CoherenceRewritePlan {
  steps: RewriteStep[]
  totalSteps: number
  estimatedTime: string
  reasoning: string
}

export interface RewriteStep {
  stepNumber: number
  sectionId: string
  sectionName: string
  action: 'rewrite' | 'update' | 'review'
  prompt: string
  priority: 'high' | 'medium' | 'low'
  reason: string
}

export interface CoherenceRewriteContext {
  targetSectionId: string
  userRequest: string
  allSections: StorySection[]
  existingContent: Record<string, string>
  storyFormat: string
}

/**
 * Create a ghostwriter-level rewrite plan
 * Analyzes dependencies and creates step-by-step plan
 */
export async function createCoherenceRewritePlan(
  context: CoherenceRewriteContext
): Promise<CoherenceRewritePlan> {
  
  console.log('🎭 [Coherence Rewrite] Creating ghostwriter plan...', {
    targetSection: context.allSections.find(s => s.id === context.targetSectionId)?.name,
    userRequest: context.userRequest,
    totalSections: context.allSections.length
  })
  
  // Step 1: Analyze dependencies
  const analysis = await analyzeDependencies(
    context.targetSectionId,
    context.userRequest,
    context.allSections,
    context.existingContent
  )
  
  // Step 2: Create rewrite steps based on update order
  const steps = await createRewriteSteps(context, analysis)
  
  // Step 3: Calculate estimated time
  const estimatedTime = calculateEstimatedTime(steps)
  
  // Step 4: Generate overall reasoning
  const reasoning = generatePlanReasoning(context, analysis, steps)
  
  return {
    steps,
    totalSteps: steps.length,
    estimatedTime,
    reasoning
  }
}

/**
 * Create individual rewrite steps from dependency analysis
 */
async function createRewriteSteps(
  context: CoherenceRewriteContext,
  analysis: DependencyAnalysis
): Promise<RewriteStep[]> {
  
  const steps: RewriteStep[] = []
  
  // Create a step for each section in the update order
  for (let i = 0; i < analysis.updateOrder.length; i++) {
    const sectionId = analysis.updateOrder[i]
    const section = context.allSections.find(s => s.id === sectionId)
    if (!section) continue
    
    const isTargetSection = sectionId === context.targetSectionId
    const affectedSection = analysis.affectedSections.find(a => a.section.id === sectionId)
    
    let action: 'rewrite' | 'update' | 'review'
    let prompt: string
    let priority: 'high' | 'medium' | 'low'
    let reason: string
    
    if (isTargetSection) {
      // This is the main rewrite
      action = 'rewrite'
      priority = 'high'
      reason = 'Primary target section requested by user'
      prompt = await generateTargetSectionPrompt(context, section, analysis)
    } else if (affectedSection) {
      // This is a dependent section
      action = affectedSection.priority === 'high' ? 'update' : 'review'
      priority = affectedSection.priority
      reason = affectedSection.reason
      prompt = await generateDependentSectionPrompt(
        context,
        section,
        affectedSection.suggestedChange,
        analysis.targetSection
      )
    } else {
      continue
    }
    
    steps.push({
      stepNumber: i + 1,
      sectionId,
      sectionName: section.name,
      action,
      prompt,
      priority,
      reason
    })
  }
  
  return steps
}

/**
 * Generate prompt for the target section rewrite
 */
async function generateTargetSectionPrompt(
  context: CoherenceRewriteContext,
  section: StorySection,
  analysis: DependencyAnalysis
): Promise<string> {
  
  const currentContent = context.existingContent[section.id] || 'No content yet'
  
  let prompt = `You are a professional ghostwriter rewriting a section of a ${context.storyFormat}.

TARGET SECTION: "${section.name}"

USER REQUEST: ${context.userRequest}

CURRENT CONTENT:
${currentContent}

YOUR TASK: Rewrite this section to fulfill the user's request while maintaining the story's overall structure and quality.

`

  // Add context about what other sections will be updated
  if (analysis.affectedSections.length > 0) {
    const highPriority = analysis.affectedSections.filter(a => a.priority === 'high')
    if (highPriority.length > 0) {
      prompt += `NOTE: The following sections will be updated after this rewrite to maintain coherence:\n`
      highPriority.forEach(a => {
        prompt += `- ${a.section.name}: ${a.reason}\n`
      })
      prompt += '\n'
    }
  }
  
  prompt += `Write the rewritten section now. Maintain the appropriate format for a ${context.storyFormat}.`
  
  return prompt
}

/**
 * Generate prompt for dependent section update
 */
async function generateDependentSectionPrompt(
  context: CoherenceRewriteContext,
  section: StorySection,
  suggestedChange: string,
  targetSection: StorySection
): Promise<string> {
  
  const currentContent = context.existingContent[section.id] || 'No content yet'
  const targetContent = context.existingContent[targetSection.id] || 'No content yet'
  
  const prompt = `You are a professional ghostwriter ensuring narrative coherence.

SECTION TO UPDATE: "${section.name}"

CURRENT CONTENT:
${currentContent}

CONTEXT: Another section "${targetSection.name}" was just rewritten with these changes:
${context.userRequest}

NEW VERSION OF "${targetSection.name}":
${targetContent}

REQUIRED CHANGE: ${suggestedChange}

YOUR TASK: Update this section to maintain consistency with the changes made to "${targetSection.name}". 

Key considerations:
- Adjust any references, foreshadowing, or setup that now conflicts
- Maintain character consistency and timeline accuracy
- Preserve the section's core purpose while adapting details
- Keep the tone and style consistent with the rest of the ${context.storyFormat}

Write the updated section now.`
  
  return prompt
}

/**
 * Calculate estimated time for all steps
 */
function calculateEstimatedTime(steps: RewriteStep[]): string {
  // Rough estimates: rewrite ~2min, update ~1min, review ~30sec per section
  const minutes = steps.reduce((total, step) => {
    switch (step.action) {
      case 'rewrite': return total + 2
      case 'update': return total + 1
      case 'review': return total + 0.5
      default: return total
    }
  }, 0)
  
  if (minutes < 1) return 'Less than a minute'
  if (minutes < 2) return '1-2 minutes'
  if (minutes < 5) return '2-5 minutes'
  return `${Math.ceil(minutes)} minutes`
}

/**
 * Generate human-readable explanation of the plan
 */
function generatePlanReasoning(
  context: CoherenceRewriteContext,
  analysis: DependencyAnalysis,
  steps: RewriteStep[]
): string {
  const targetSection = analysis.targetSection
  
  let reasoning = `🎭 **Ghostwriter Plan for "${targetSection.name}"**\n\n`
  
  reasoning += `You requested: "${context.userRequest}"\n\n`
  
  if (steps.length === 1) {
    reasoning += `This change is self-contained and won't affect other sections. I'll rewrite "${targetSection.name}" for you.`
  } else {
    reasoning += `To maintain story coherence, I'll need to update ${steps.length} section(s):\n\n`
    
    const rewrites = steps.filter(s => s.action === 'rewrite')
    const updates = steps.filter(s => s.action === 'update')
    const reviews = steps.filter(s => s.action === 'review')
    
    if (rewrites.length > 0) {
      reasoning += `**Step 1: Primary Rewrite**\n`
      rewrites.forEach(step => {
        reasoning += `  ${step.stepNumber}. ${step.sectionName} - ${step.reason}\n`
      })
      reasoning += '\n'
    }
    
    if (updates.length > 0) {
      reasoning += `**Step 2: Critical Updates** (maintain continuity)\n`
      updates.forEach(step => {
        reasoning += `  ${step.stepNumber}. ${step.sectionName} - ${step.reason}\n`
      })
      reasoning += '\n'
    }
    
    if (reviews.length > 0) {
      reasoning += `**Step 3: Minor Adjustments**\n`
      reviews.forEach(step => {
        reasoning += `  ${step.stepNumber}. ${step.sectionName} - ${step.reason}\n`
      })
      reasoning += '\n'
    }
  }
  
  reasoning += `\nEstimated time: ${calculateEstimatedTime(steps)}`
  
  return reasoning
}

/**
 * Execute a single rewrite step
 */
export async function executeRewriteStep(
  step: RewriteStep,
  context: CoherenceRewriteContext
): Promise<{ success: boolean; content?: string; error?: string }> {
  
  console.log(`📝 [Coherence Rewrite] Executing step ${step.stepNumber}: ${step.sectionName}`)
  
  try {
    // Call the content generation API
    const response = await fetch('/api/content/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section_id: step.sectionId,
        prompt: step.prompt,
        format: context.storyFormat,
        mode: 'writer'
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ [Step ${step.stepNumber}] Failed:`, errorText)
      return {
        success: false,
        error: `Failed to ${step.action} ${step.sectionName}: ${errorText}`
      }
    }
    
    const data = await response.json()
    
    if (!data.success || !data.content) {
      return {
        success: false,
        error: `No content returned for ${step.sectionName}`
      }
    }
    
    console.log(`✅ [Step ${step.stepNumber}] Completed: ${step.sectionName}`)
    
    return {
      success: true,
      content: data.content
    }
    
  } catch (error: any) {
    console.error(`❌ [Step ${step.stepNumber}] Error:`, error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}

