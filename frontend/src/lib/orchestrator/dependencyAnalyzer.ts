/**
 * Dependency Analyzer for Ghostwriter-Level Coherence
 * 
 * Analyzes story structure to identify which sections are related and need
 * updating when a change is made to maintain narrative consistency.
 * 
 * This is what makes the orchestrator act like a professional ghostwriter.
 */

export interface StorySection {
  id: string
  name: string
  level: number
  order: number
  content?: string
  parentId?: string
}

export interface DependencyAnalysis {
  targetSection: StorySection
  affectedSections: AffectedSection[]
  reasoning: string
  updateOrder: string[] // Section IDs in the order they should be updated
}

export interface AffectedSection {
  section: StorySection
  relationshipType: 'parent' | 'child' | 'sibling' | 'preceding' | 'following' | 'thematic'
  reason: string
  priority: 'high' | 'medium' | 'low'
  suggestedChange: string
}

/**
 * Analyze dependencies for a target section change
 * Uses LLM reasoning to understand narrative relationships
 */
export async function analyzeDependencies(
  targetSectionId: string,
  changeDescription: string,
  allSections: StorySection[],
  existingContent: Record<string, string> // Map of section ID to content
): Promise<DependencyAnalysis> {
  
  const targetSection = allSections.find(s => s.id === targetSectionId)
  if (!targetSection) {
    throw new Error(`Target section ${targetSectionId} not found`)
  }
  
  console.log('🔍 [Dependency Analysis] Analyzing impact of change:', {
    targetSection: targetSection.name,
    changeDescription,
    totalSections: allSections.length
  })
  
  // Find structural relationships (hierarchy)
  const structuralDeps = findStructuralDependencies(targetSection, allSections)
  
  // Use LLM to analyze narrative relationships (plot, character, theme)
  const narrativeDeps = await analyzeNarrativeDependencies(
    targetSection,
    changeDescription,
    allSections,
    existingContent
  )
  
  // Merge and prioritize dependencies
  const allDeps = [...structuralDeps, ...narrativeDeps]
  
  // Remove duplicates, keeping highest priority
  const uniqueDeps = deduplicateDependencies(allDeps)
  
  // Determine update order (earlier sections first, then target, then later)
  const updateOrder = calculateUpdateOrder(targetSection, uniqueDeps, allSections)
  
  const reasoning = generateReasoningExplanation(targetSection, changeDescription, uniqueDeps)
  
  return {
    targetSection,
    affectedSections: uniqueDeps,
    reasoning,
    updateOrder
  }
}

/**
 * Find structural dependencies (parent, children, siblings)
 */
function findStructuralDependencies(
  targetSection: StorySection,
  allSections: StorySection[]
): AffectedSection[] {
  const deps: AffectedSection[] = []
  
  // Parent section (e.g., if changing a scene, the sequence might need updating)
  if (targetSection.parentId) {
    const parent = allSections.find(s => s.id === targetSection.parentId)
    if (parent) {
      deps.push({
        section: parent,
        relationshipType: 'parent',
        reason: `Parent section "${parent.name}" may need summary/context updates`,
        priority: 'medium',
        suggestedChange: 'Update summary to reflect changes in child section'
      })
    }
  }
  
  // Child sections (if changing an act, its sequences might need adjusting)
  const children = allSections.filter(s => s.parentId === targetSection.id)
  children.forEach(child => {
    deps.push({
      section: child,
      relationshipType: 'child',
      reason: `Child section "${child.name}" may need adjustments to align with parent changes`,
      priority: 'low',
      suggestedChange: 'Review and adjust to maintain consistency with parent section'
    })
  })
  
  // Immediately preceding section (setup/foreshadowing)
  const preceding = allSections
    .filter(s => s.level === targetSection.level && s.order === targetSection.order - 1)
    .sort((a, b) => b.order - a.order)[0]
  
  if (preceding) {
    deps.push({
      section: preceding,
      relationshipType: 'preceding',
      reason: `Preceding section "${preceding.name}" may contain setup or foreshadowing that needs adjustment`,
      priority: 'high',
      suggestedChange: 'Check for setup, foreshadowing, or transitions that need updating'
    })
  }
  
  // Immediately following section (payoff/consequences)
  const following = allSections
    .filter(s => s.level === targetSection.level && s.order === targetSection.order + 1)
    .sort((a, b) => a.order - b.order)[0]
  
  if (following) {
    deps.push({
      section: following,
      relationshipType: 'following',
      reason: `Following section "${following.name}" may reference events that no longer match`,
      priority: 'high',
      suggestedChange: 'Update references, consequences, and character reactions'
    })
  }
  
  return deps
}

/**
 * Analyze narrative dependencies using LLM reasoning
 * This identifies thematic, character, and plot relationships
 */
async function analyzeNarrativeDependencies(
  targetSection: StorySection,
  changeDescription: string,
  allSections: StorySection[],
  existingContent: Record<string, string>
): Promise<AffectedSection[]> {
  
  // Build context for LLM
  const structureContext = allSections
    .map(s => `- ${s.name} (Level ${s.level}, Order ${s.order})${s.content ? ': ' + s.content.substring(0, 100) + '...' : ''}`)
    .join('\n')
  
  const targetContent = existingContent[targetSection.id] || 'No content yet'
  
  const systemPrompt = `You are a professional ghostwriter analyzing narrative dependencies in a story.

Your job: Identify which sections will be affected by a change to maintain story coherence.

Consider:
- Character arcs and development
- Plot setup and payoff
- Foreshadowing and callbacks
- Theme and tone consistency
- Cause and effect chains
- Timeline and continuity

Return ONLY a JSON array of affected sections with this structure:
[
  {
    "sectionId": "section ID from the structure",
    "relationshipType": "thematic",
    "reason": "Why this section is affected",
    "priority": "high" | "medium" | "low",
    "suggestedChange": "Specific change to maintain coherence"
  }
]

Be selective - only flag sections that TRULY need updating. Empty array if no narrative dependencies.`

  const userPrompt = `Target section being changed: "${targetSection.name}"
Current content: ${targetContent.substring(0, 500)}

Planned change: ${changeDescription}

Full story structure:
${structureContext}

Which OTHER sections (not the target) will be affected by this change? Return JSON array.`

  try {
    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        temperature: 0.4 // Balance creativity with consistency
      })
    })
    
    if (!response.ok) {
      console.warn('[Narrative Deps] API call failed, falling back to structural only')
      return []
    }
    
    const data = await response.json()
    
    // Parse LLM response
    let deps: any[] = []
    try {
      const jsonMatch = data.content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        deps = JSON.parse(jsonMatch[0])
      } else {
        deps = JSON.parse(data.content)
      }
    } catch (parseError) {
      console.warn('[Narrative Deps] Failed to parse LLM response:', data.content)
      return []
    }
    
    // Map to AffectedSection objects
    const affectedSections: AffectedSection[] = deps
      .map(dep => {
        const section = allSections.find(s => s.id === dep.sectionId)
        if (!section) return null
        
        return {
          section,
          relationshipType: 'thematic' as const,
          reason: dep.reason,
          priority: dep.priority as 'high' | 'medium' | 'low',
          suggestedChange: dep.suggestedChange
        }
      })
      .filter((dep): dep is AffectedSection => dep !== null)
    
    console.log('🧠 [Narrative Deps] LLM identified', affectedSections.length, 'narrative dependencies')
    
    return affectedSections
    
  } catch (error) {
    console.error('[Narrative Deps] Error analyzing narrative dependencies:', error)
    return []
  }
}

/**
 * Remove duplicate dependencies, keeping highest priority
 */
function deduplicateDependencies(deps: AffectedSection[]): AffectedSection[] {
  const seen = new Map<string, AffectedSection>()
  
  const priorityWeight = { high: 3, medium: 2, low: 1 }
  
  deps.forEach(dep => {
    const existing = seen.get(dep.section.id)
    if (!existing || priorityWeight[dep.priority] > priorityWeight[existing.priority]) {
      seen.set(dep.section.id, dep)
    }
  })
  
  return Array.from(seen.values())
}

/**
 * Calculate the order in which sections should be updated
 * Earlier sections first (setup), then target, then later sections (payoff)
 */
function calculateUpdateOrder(
  targetSection: StorySection,
  affectedSections: AffectedSection[],
  allSections: StorySection[]
): string[] {
  const order: string[] = []
  
  // 1. Earlier sections (setup, foreshadowing) - sorted by order
  const earlier = affectedSections
    .filter(dep => dep.section.order < targetSection.order)
    .sort((a, b) => a.section.order - b.section.order)
    .map(dep => dep.section.id)
  
  order.push(...earlier)
  
  // 2. Target section
  order.push(targetSection.id)
  
  // 3. Later sections (payoff, consequences) - sorted by order
  const later = affectedSections
    .filter(dep => dep.section.order > targetSection.order)
    .sort((a, b) => a.section.order - b.section.order)
    .map(dep => dep.section.id)
  
  order.push(...later)
  
  console.log('📋 [Update Order] Calculated update sequence:', {
    totalSteps: order.length,
    sequence: order.map(id => allSections.find(s => s.id === id)?.name || id)
  })
  
  return order
}

/**
 * Generate human-readable explanation of the dependency analysis
 */
function generateReasoningExplanation(
  targetSection: StorySection,
  changeDescription: string,
  dependencies: AffectedSection[]
): string {
  if (dependencies.length === 0) {
    return `No other sections need updating - the change to "${targetSection.name}" is self-contained.`
  }
  
  const highPriority = dependencies.filter(d => d.priority === 'high')
  const mediumPriority = dependencies.filter(d => d.priority === 'medium')
  const lowPriority = dependencies.filter(d => d.priority === 'low')
  
  let explanation = `Changing "${targetSection.name}" will affect ${dependencies.length} other section(s):\n\n`
  
  if (highPriority.length > 0) {
    explanation += `🔴 Critical updates (${highPriority.length}):\n`
    highPriority.forEach(dep => {
      explanation += `  • ${dep.section.name}: ${dep.reason}\n`
    })
    explanation += '\n'
  }
  
  if (mediumPriority.length > 0) {
    explanation += `🟡 Recommended updates (${mediumPriority.length}):\n`
    mediumPriority.forEach(dep => {
      explanation += `  • ${dep.section.name}: ${dep.reason}\n`
    })
    explanation += '\n'
  }
  
  if (lowPriority.length > 0) {
    explanation += `🟢 Optional updates (${lowPriority.length}):\n`
    lowPriority.forEach(dep => {
      explanation += `  • ${dep.section.name}: ${dep.reason}\n`
    })
  }
  
  return explanation.trim()
}

