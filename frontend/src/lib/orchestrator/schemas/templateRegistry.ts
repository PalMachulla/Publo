/**
 * Template Registry
 * 
 * Central source of truth for document templates across all formats.
 * Used by:
 * - LLM Intent Analyzer (for intelligent template suggestions)
 * - CreateStructureAction (for structure generation)
 * - OrchestratorPanel (for UI display)
 */

export interface Template {
  id: string
  name: string
  description: string
  keywords?: string[] // For LLM matching (e.g., ["interview", "guest", "host"])
  complexity?: 'simple' | 'moderate' | 'complex' // For user guidance
  recommendedFor?: string // When to use this template
}

export interface TemplateCategory {
  format: string
  label: string
  templates: Template[]
}

export type TemplateRegistry = Record<string, Template[]>

/**
 * Template Registry - Single Source of Truth
 */
export const TEMPLATE_REGISTRY: TemplateRegistry = {
  'novel': [
    {
      id: 'three-act',
      name: 'Three-Act Structure',
      description: 'Classic beginning, middle, and end',
      keywords: ['three act', 'classic', 'traditional', 'beginning middle end'],
      complexity: 'simple',
      recommendedFor: 'Traditional storytelling with clear setup, confrontation, and resolution'
    },
    {
      id: 'heros-journey',
      name: "Hero's Journey",
      description: 'Archetypal adventure narrative',
      keywords: ['hero', 'journey', 'monomyth', 'campbell', 'adventure', 'quest'],
      complexity: 'moderate',
      recommendedFor: 'Epic adventures, fantasy, or transformative character arcs'
    },
    {
      id: 'freytag',
      name: "Freytag's Pyramid",
      description: 'Rising action, climax, falling action',
      keywords: ['freytag', 'pyramid', 'rising action', 'climax', 'falling action'],
      complexity: 'moderate',
      recommendedFor: 'Dramatic stories with clear tension build-up and resolution'
    },
    {
      id: 'save-the-cat',
      name: 'Save The Cat',
      description: 'Modern screenplay structure adapted for novels',
      keywords: ['save the cat', 'snyder', 'beat sheet', 'screenplay'],
      complexity: 'complex',
      recommendedFor: 'Plot-driven novels with commercial appeal'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'short-story': [
    {
      id: 'classic',
      name: 'Classic Short Story',
      description: 'Single plot, few characters, brief timespan',
      keywords: ['classic', 'traditional', 'single plot'],
      complexity: 'simple',
      recommendedFor: 'Traditional short fiction with focused narrative'
    },
    {
      id: 'flash-fiction',
      name: 'Flash Fiction',
      description: 'Ultra-short 500-1000 words',
      keywords: ['flash', 'micro', 'ultra short', 'brief'],
      complexity: 'simple',
      recommendedFor: 'Extremely concise stories with punchy impact'
    },
    {
      id: 'twist-ending',
      name: 'Twist Ending',
      description: 'Surprise revelation structure',
      keywords: ['twist', 'surprise', 'revelation', 'unexpected'],
      complexity: 'moderate',
      recommendedFor: 'Stories with shocking or unexpected conclusions'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'report': [
    {
      id: 'business',
      name: 'Business Report',
      description: 'Executive summary, findings, recommendations',
      keywords: ['business', 'executive', 'corporate', 'findings'],
      complexity: 'moderate',
      recommendedFor: 'Corporate analysis and strategic recommendations'
    },
    {
      id: 'research',
      name: 'Research Report',
      description: 'Literature review, methodology, results',
      keywords: ['research', 'academic', 'methodology', 'literature review'],
      complexity: 'complex',
      recommendedFor: 'Academic or scientific research documentation'
    },
    {
      id: 'technical',
      name: 'Technical Report',
      description: 'Specifications, analysis, documentation',
      keywords: ['technical', 'specs', 'documentation', 'analysis'],
      complexity: 'complex',
      recommendedFor: 'Technical specifications and system documentation'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'report_script_coverage': [
    {
      id: 'standard',
      name: 'Standard Coverage',
      description: 'Industry-standard screenplay analysis',
      keywords: ['standard', 'industry', 'screenplay', 'coverage'],
      complexity: 'moderate',
      recommendedFor: 'Professional screenplay evaluation for production companies'
    },
    {
      id: 'detailed',
      name: 'Detailed Coverage',
      description: 'In-depth analysis with recommendations',
      keywords: ['detailed', 'in-depth', 'comprehensive', 'analysis'],
      complexity: 'complex',
      recommendedFor: 'Thorough screenplay analysis with development notes'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'report_business': [
    {
      id: 'executive',
      name: 'Executive Report',
      description: 'High-level strategic analysis',
      keywords: ['executive', 'strategic', 'high-level', 'leadership'],
      complexity: 'moderate',
      recommendedFor: 'C-suite and board-level strategic reports'
    },
    {
      id: 'analytical',
      name: 'Analytical Report',
      description: 'Data-driven insights and recommendations',
      keywords: ['analytical', 'data', 'insights', 'metrics'],
      complexity: 'complex',
      recommendedFor: 'Data-driven business intelligence reports'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'report_content_analysis': [
    {
      id: 'thematic',
      name: 'Thematic Analysis',
      description: 'Focus on themes and patterns',
      keywords: ['thematic', 'themes', 'patterns', 'motifs'],
      complexity: 'moderate',
      recommendedFor: 'Analyzing recurring themes and narrative patterns'
    },
    {
      id: 'structural',
      name: 'Structural Analysis',
      description: 'Analyze content structure and flow',
      keywords: ['structural', 'structure', 'flow', 'organization'],
      complexity: 'moderate',
      recommendedFor: 'Evaluating narrative structure and pacing'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'article': [
    {
      id: 'how-to',
      name: 'How-To Guide',
      description: 'Step-by-step instructional',
      keywords: ['how to', 'guide', 'tutorial', 'instructional', 'steps'],
      complexity: 'simple',
      recommendedFor: 'Instructional content with clear steps'
    },
    {
      id: 'listicle',
      name: 'Listicle',
      description: 'Numbered or bulleted list format',
      keywords: ['list', 'listicle', 'numbered', 'top 10', 'bullets'],
      complexity: 'simple',
      recommendedFor: 'Scannable content with multiple points'
    },
    {
      id: 'opinion',
      name: 'Opinion Piece',
      description: 'Editorial or commentary',
      keywords: ['opinion', 'editorial', 'commentary', 'perspective'],
      complexity: 'moderate',
      recommendedFor: 'Persuasive or thought-provoking content'
    },
    {
      id: 'feature',
      name: 'Feature Article',
      description: 'In-depth exploration of topic',
      keywords: ['feature', 'in-depth', 'long-form', 'deep dive'],
      complexity: 'complex',
      recommendedFor: 'Comprehensive topic exploration'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'screenplay': [
    {
      id: 'feature',
      name: 'Feature Film',
      description: '90-120 pages, three acts',
      keywords: ['feature', 'film', 'movie', 'theatrical', '90 minutes', 'three act'],
      complexity: 'complex',
      recommendedFor: 'Full-length theatrical films'
    },
    {
      id: 'tv-pilot',
      name: 'TV Pilot',
      description: '30 or 60-minute episode',
      keywords: ['tv', 'television', 'pilot', 'series', 'episode'],
      complexity: 'complex',
      recommendedFor: 'Television series premiere episodes'
    },
    {
      id: 'short-film',
      name: 'Short Film',
      description: '5-30 pages',
      keywords: ['short', 'short film', 'brief', 'festival'],
      complexity: 'moderate',
      recommendedFor: 'Festival submissions or proof-of-concept'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'essay': [
    {
      id: 'argumentative',
      name: 'Argumentative',
      description: 'Claim, evidence, counterarguments',
      keywords: ['argumentative', 'persuasive', 'debate', 'claim', 'evidence'],
      complexity: 'moderate',
      recommendedFor: 'Persuasive essays with clear thesis'
    },
    {
      id: 'narrative',
      name: 'Narrative Essay',
      description: 'Personal story with reflection',
      keywords: ['narrative', 'personal', 'story', 'reflection', 'memoir'],
      complexity: 'simple',
      recommendedFor: 'Personal storytelling with insight'
    },
    {
      id: 'compare-contrast',
      name: 'Compare & Contrast',
      description: 'Analyze similarities and differences',
      keywords: ['compare', 'contrast', 'comparison', 'similarities', 'differences'],
      complexity: 'moderate',
      recommendedFor: 'Analytical comparison of subjects'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ],
  'podcast': [
    {
      id: 'interview',
      name: 'Interview Format',
      description: 'Host interviews guests',
      keywords: ['interview', 'guest', 'host', 'q&a', 'conversation'],
      complexity: 'simple',
      recommendedFor: 'Guest-focused conversational podcasts'
    },
    {
      id: 'co-hosted',
      name: 'Co-Hosted',
      description: 'Multiple hosts in conversation',
      keywords: ['co-hosted', 'multiple hosts', 'panel', 'discussion'],
      complexity: 'moderate',
      recommendedFor: 'Dynamic multi-host discussions'
    },
    {
      id: 'storytelling',
      name: 'Storytelling',
      description: 'Narrative-driven episodes',
      keywords: ['storytelling', 'narrative', 'story', 'documentary'],
      complexity: 'complex',
      recommendedFor: 'Narrative or documentary-style podcasts'
    },
    {
      id: 'blank',
      name: 'Blank Canvas',
      description: 'Start from scratch',
      keywords: ['blank', 'custom', 'freeform', 'scratch'],
      complexity: 'simple',
      recommendedFor: 'When you want complete creative freedom'
    }
  ]
}

/**
 * Get templates for a specific format
 */
export function getTemplatesForFormat(format: string): Template[] {
  return TEMPLATE_REGISTRY[format] || []
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(format: string, templateId: string): Template | null {
  const templates = getTemplatesForFormat(format)
  return templates.find(t => t.id === templateId) || null
}

/**
 * Find template by keyword matching (for LLM intent analysis)
 */
export function findTemplateByKeywords(format: string, query: string): Template | null {
  const templates = getTemplatesForFormat(format)
  const lowerQuery = query.toLowerCase()
  
  // Try exact name match first
  const exactMatch = templates.find(t => t.name.toLowerCase() === lowerQuery)
  if (exactMatch) return exactMatch
  
  // Try keyword matching
  for (const template of templates) {
    if (template.keywords) {
      for (const keyword of template.keywords) {
        if (lowerQuery.includes(keyword) || keyword.includes(lowerQuery)) {
          return template
        }
      }
    }
  }
  
  return null
}

/**
 * Build template descriptions for LLM prompts
 * Similar to buildFormatDescriptionsForLLM() in documentHierarchy.ts
 */
export function buildTemplateDescriptionsForLLM(): string {
  let descriptions = 'AVAILABLE TEMPLATES BY FORMAT:\n\n'
  
  for (const [format, templates] of Object.entries(TEMPLATE_REGISTRY)) {
    const formatLabel = format.replace(/_/g, '-')
    descriptions += `${formatLabel}:\n`
    
    templates.forEach(template => {
      descriptions += `  - ${template.name}: ${template.description}`
      if (template.recommendedFor) {
        descriptions += ` (Best for: ${template.recommendedFor})`
      }
      descriptions += '\n'
    })
    descriptions += '\n'
  }
  
  descriptions += 'TEMPLATE MATCHING:\n'
  descriptions += '- If user mentions specific keywords (e.g., "interview", "hero\'s journey", "three act"), suggest the matching template\n'
  descriptions += '- If user is vague (e.g., "create a podcast"), ask which template they prefer\n'
  descriptions += '- Always include template suggestions in extractedEntities.suggestedTemplate\n'
  
  return descriptions
}

/**
 * Get all formats that have templates
 */
export function getAvailableFormats(): string[] {
  return Object.keys(TEMPLATE_REGISTRY)
}

/**
 * Get template count for a format
 */
export function getTemplateCount(format: string): number {
  return getTemplatesForFormat(format).length
}

