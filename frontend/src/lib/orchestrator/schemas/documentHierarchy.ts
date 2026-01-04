/**
 * Document Hierarchy Definitions
 * Defines the structural breakdown for different document types
 */

export interface HierarchyLevel {
  level: number
  name: string
  optional: boolean
  description?: string
}

export interface DocumentType {
  description: string
  hierarchy: HierarchyLevel[]
  guidance?: string // Format-specific guidance for structure generation (word counts, standards, etc.)
}

export interface DocumentHierarchy {
  document_types: {
    [key: string]: DocumentType
  }
}

export const DOCUMENT_HIERARCHY: DocumentHierarchy = {
  document_types: {
    novel: {
      description: "Long-form narrative fiction",
      guidance: "Target: 60,000-100,000 words total. Chapters: 2,000-4,000 words each.",
      hierarchy: [
        {
          level: 1,
          name: "Part",
          optional: true,
          description: "Major story divisions (e.g., Part I, Part II)"
        },
        {
          level: 2,
          name: "Chapter",
          optional: false,
          description: "Primary narrative units"
        },
        {
          level: 3,
          name: "Scene",
          optional: true,
          description: "Marked by section breaks (*** or whitespace)"
        },
        {
          level: 4,
          name: "Paragraph",
          optional: false
        },
        {
          level: 5,
          name: "Sentence",
          optional: false
        }
      ]
    },
    short_story: {
      description: "Brief narrative fiction",
      guidance: "Target: 1,000-7,500 words total.",
      hierarchy: [
        {
          level: 1,
          name: "Scene",
          optional: true,
          description: "Marked by section breaks"
        },
        {
          level: 2,
          name: "Paragraph",
          optional: false
        },
        {
          level: 3,
          name: "Sentence",
          optional: false
        }
      ]
    },
    report: {
      description: "Structured analysis document",
      guidance: "Focus on clarity, scanability, and logical flow.",
      hierarchy: [
        {
          level: 1,
          name: "Executive Summary",
          optional: true,
          description: "Overview of key findings"
        },
        {
          level: 2,
          name: "Section",
          optional: false,
          description: "Major divisions (numbered, e.g., 1.0, 2.0)"
        },
        {
          level: 3,
          name: "Subsection",
          optional: true,
          description: "Subdivisions (e.g., 2.1, 2.2)"
        },
        {
          level: 4,
          name: "Sub-subsection",
          optional: true,
          description: "Further divisions (e.g., 2.1.1)"
        },
        {
          level: 5,
          name: "Paragraph",
          optional: false
        },
        {
          level: 6,
          name: "Sentence",
          optional: false
        }
      ]
    },
    report_script_coverage: {
      description: "Industry-standard screenplay coverage report",
      guidance: "✅ Industry standard screenplay coverage format.\nCRITICAL: Extract content from the screenplay - DO NOT just analyze its structure!\nExecutive Summary must include Pass/Consider/Recommend rating.\nLogline should be compelling one-sentence premise.\nSynopsis: 2-3 paragraph plot summary capturing key story beats.\nAnalyze actual characters, dialogue, pacing, and marketability from the screenplay content.",
      hierarchy: [
        {
          level: 1,
          name: "Executive Summary",
          optional: false,
          description: "High-level overview with Pass/Consider/Recommend rating"
        },
        {
          level: 1,
          name: "Logline",
          optional: false,
          description: "One-sentence story premise"
        },
        {
          level: 1,
          name: "Synopsis",
          optional: false,
          description: "2-3 paragraph plot summary"
        },
        {
          level: 1,
          name: "Character Analysis",
          optional: false,
          description: "Main characters and their arcs"
        },
        {
          level: 2,
          name: "Character",
          optional: false,
          description: "Individual character breakdown"
        },
        {
          level: 1,
          name: "Dialogue & Pacing",
          optional: false,
          description: "Quality assessment of dialogue and story flow"
        },
        {
          level: 1,
          name: "Structure & Plot",
          optional: false,
          description: "Story structure effectiveness"
        },
        {
          level: 1,
          name: "Marketability",
          optional: false,
          description: "Commercial potential and target audience"
        },
        {
          level: 2,
          name: "Target Audience",
          optional: false,
          description: "Who this screenplay is for"
        },
        {
          level: 2,
          name: "Comparable Titles",
          optional: true,
          description: "Similar successful films/shows"
        },
        {
          level: 1,
          name: "Recommendation",
          optional: false,
          description: "Final verdict: Pass/Consider/Recommend"
        }
      ]
    },
    report_business: {
      description: "Business analysis or strategic report",
      guidance: "Professional business/strategic analysis format.\nFocus on data-driven insights and actionable recommendations.\nExecutive Summary should highlight key findings up front.\nUse clear section numbering (1.0, 2.0, etc.).",
      hierarchy: [
        {
          level: 1,
          name: "Executive Summary",
          optional: false,
          description: "Key findings and recommendations at a glance"
        },
        {
          level: 1,
          name: "Introduction & Background",
          optional: false,
          description: "Context and purpose of the report"
        },
        {
          level: 1,
          name: "Methodology",
          optional: true,
          description: "How data was gathered and analyzed"
        },
        {
          level: 1,
          name: "Findings & Analysis",
          optional: false,
          description: "Main body of research and insights"
        },
        {
          level: 2,
          name: "Section",
          optional: false,
          description: "Thematic findings sections"
        },
        {
          level: 3,
          name: "Subsection",
          optional: true,
          description: "Detailed breakdowns"
        },
        {
          level: 1,
          name: "Recommendations",
          optional: false,
          description: "Actionable next steps"
        },
        {
          level: 1,
          name: "Conclusion",
          optional: false,
          description: "Summary and final thoughts"
        }
      ]
    },
    report_content_analysis: {
      description: "Analysis report for podcasts, articles, or media content",
      guidance: "Thematic and content-focused analysis.\nExtract key themes, insights, and takeaways from the source material.\nProvide actionable recommendations for the audience.\nFocus on quality, clarity, and engagement factors.",
      hierarchy: [
        {
          level: 1,
          name: "Executive Summary",
          optional: false,
          description: "Overview of content and key takeaways"
        },
        {
          level: 1,
          name: "Content Overview",
          optional: false,
          description: "What the content covers"
        },
        {
          level: 1,
          name: "Key Themes & Topics",
          optional: false,
          description: "Main subjects discussed"
        },
        {
          level: 2,
          name: "Theme",
          optional: false,
          description: "Individual theme breakdown"
        },
        {
          level: 1,
          name: "Notable Insights",
          optional: false,
          description: "Standout moments or revelations"
        },
        {
          level: 1,
          name: "Quality Assessment",
          optional: false,
          description: "Production value, clarity, engagement"
        },
        {
          level: 1,
          name: "Audience & Impact",
          optional: false,
          description: "Who this is for and its effectiveness"
        },
        {
          level: 1,
          name: "Key Takeaways",
          optional: false,
          description: "Actionable insights for the audience"
        }
      ]
    },
    article: {
      description: "Editorial or blog post",
      hierarchy: [
        {
          level: 1,
          name: "Introduction",
          optional: false,
          description: "Opening hook and thesis"
        },
        {
          level: 2,
          name: "Section",
          optional: true,
          description: "Marked by subheadings (H2, H3)"
        },
        {
          level: 3,
          name: "Subsection",
          optional: true,
          description: "Further subdivisions"
        },
        {
          level: 4,
          name: "Paragraph",
          optional: false
        },
        {
          level: 5,
          name: "Sentence",
          optional: false
        }
      ]
    },
    screenplay: {
      description: "Script for film or TV",
      guidance: "Target: 90-120 pages (90-120 scenes). Each scene: 1-3 pages.",
      hierarchy: [
        {
          level: 1,
          name: "Act",
          optional: false,
          description: "Major story structure (typically 3 acts)"
        },
        {
          level: 2,
          name: "Sequence",
          optional: true,
          description: "Series of related scenes"
        },
        {
          level: 3,
          name: "Scene",
          optional: false,
          description: "Individual scene with slug line (INT/EXT)"
        },
        {
          level: 4,
          name: "Beat",
          optional: true,
          description: "Moment or action within a scene"
        },
        {
          level: 5,
          name: "Action/Dialogue Block",
          optional: false
        },
        {
          level: 6,
          name: "Line",
          optional: false
        }
      ]
    },
    essay: {
      description: "Opinion or argumentative piece",
      guidance: "Target: 1,000-5,000 words. Strong thesis and supporting arguments.",
      hierarchy: [
        {
          level: 1,
          name: "Introduction",
          optional: false,
          description: "Hook, context, thesis statement"
        },
        {
          level: 2,
          name: "Body Paragraph",
          optional: false,
          description: "Topic sentence + supporting evidence"
        },
        {
          level: 3,
          name: "Conclusion",
          optional: false,
          description: "Synthesis and final thoughts"
        },
        {
          level: 4,
          name: "Sentence",
          optional: false
        }
      ]
    },
    podcast: {
      description: "Audio show with host and guests",
      guidance: "Target: 20-60 minutes (3,000-9,000 words). Conversational and engaging.",
      hierarchy: [
        {
          level: 1,
          name: "Season",
          optional: true,
          description: "Thematic or temporal grouping of episodes"
        },
        {
          level: 2,
          name: "Episode",
          optional: false,
          description: "Individual podcast recording"
        },
        {
          level: 3,
          name: "Segment",
          optional: true,
          description: "Major sections (intro, main content, ads, outro)"
        },
        {
          level: 4,
          name: "Topic/Discussion Point",
          optional: true,
          description: "Individual subjects or questions discussed"
        },
        {
          level: 5,
          name: "Exchange",
          optional: false,
          description: "Back-and-forth between speakers"
        },
        {
          level: 6,
          name: "Utterance/Turn",
          optional: false,
          description: "Individual speaking contribution by host or guest"
        },
        {
          level: 7,
          name: "Sentence",
          optional: false
        }
      ]
    }
  }
}

/**
 * Helper function to get hierarchy for a specific document type
 */
export function getDocumentHierarchy(documentType: string): HierarchyLevel[] | null {
  if (!documentType) return null
  // Convert hyphens to underscores to match object keys (e.g., 'short-story' -> 'short_story')
  const normalizedType = documentType.toLowerCase().replace(/-/g, '_')
  const type = DOCUMENT_HIERARCHY.document_types[normalizedType]
  return type ? type.hierarchy : null
}

/**
 * Helper function to get the primary structural level for a document type
 * (e.g., "Chapter" for novels, "Scene" for screenplays, "Episode" for podcasts)
 */
export function getPrimaryStructuralLevel(documentType: string): string | null {
  if (!documentType) return null
  const hierarchy = getDocumentHierarchy(documentType)
  if (!hierarchy) return null
  
  // Find the first non-optional level, or return the first level
  const primaryLevel = hierarchy.find(level => !level.optional) || hierarchy[0]
  return primaryLevel.name
}

/**
 * Generate format descriptions for LLM prompts
 * This ensures the LLM always has up-to-date format information
 */
export function buildFormatDescriptionsForLLM(): string {
  let descriptions = 'DOCUMENT FORMAT CONVENTIONS:\n\n'
  
  for (const [key, docType] of Object.entries(DOCUMENT_HIERARCHY.document_types)) {
    // Convert key to display name (e.g., 'short_story' -> 'Short Story')
    const displayName = key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    descriptions += `**${displayName}**: ${docType.description}\n`
    
    // Build hierarchy string (show main structural levels only)
    const mainLevels = docType.hierarchy
      .filter(level => level.level <= 4) // Show up to 4 levels
      .map(level => {
        const optional = level.optional ? ' (optional)' : ''
        return `${level.name}${optional}`
      })
    
    descriptions += `  Structure: ${mainLevels.join(' → ')}\n`
    
    // Highlight primary structural level
    const primaryLevel = docType.hierarchy.find(l => !l.optional)
    if (primaryLevel) {
      descriptions += `  Primary structure: ${primaryLevel.name}\n`
      if (primaryLevel.description) {
        descriptions += `  Note: ${primaryLevel.description}\n`
      }
    }
    
    descriptions += '\n'
  }
  
  return descriptions
}

/**
 * Get format-specific guidance for structure generation
 * Returns word count targets, writing standards, and format-specific instructions
 */
export function getFormatGuidance(format: string): string {
  // Normalize format (e.g., 'short-story' -> 'short_story')
  const normalizedFormat = format.toLowerCase().replace(/-/g, '_')
  const docType = DOCUMENT_HIERARCHY.document_types[normalizedFormat]
  
  if (!docType || !docType.guidance) {
    return ''
  }
  
  return docType.guidance
}

/**
 * Recommend report type based on source document format
 */
export interface ReportTypeRecommendation {
  id: string
  label: string
  description: string
  formatKey: string // The key in DOCUMENT_HIERARCHY.document_types
}

export function recommendReportType(sourceFormat: string): ReportTypeRecommendation[] {
  const normalizedSource = sourceFormat?.toLowerCase().replace(/-/g, '_')
  
  if (normalizedSource === 'screenplay') {
    return [
      {
        id: 'script_coverage',
        label: 'Script Coverage Report',
        description: 'Industry-standard coverage with Pass/Consider/Recommend rating (Recommended)',
        formatKey: 'report_script_coverage'
      },
      {
        id: 'content_analysis',
        label: 'Story Analysis',
        description: 'Thematic breakdown and narrative insights',
        formatKey: 'report_content_analysis'
      },
      {
        id: 'business',
        label: 'Development Report',
        description: 'Production feasibility and market analysis',
        formatKey: 'report_business'
      },
      {
        id: 'general',
        label: 'General Report',
        description: 'Flexible report structure',
        formatKey: 'report'
      }
    ]
  } else if (normalizedSource === 'podcast' || normalizedSource === 'article') {
    return [
      {
        id: 'content_analysis',
        label: 'Content Analysis Report',
        description: 'Key themes, insights, and takeaways (Recommended)',
        formatKey: 'report_content_analysis'
      },
      {
        id: 'business',
        label: 'Performance Report',
        description: 'Audience engagement and impact analysis',
        formatKey: 'report_business'
      },
      {
        id: 'general',
        label: 'General Report',
        description: 'Flexible report structure',
        formatKey: 'report'
      }
    ]
  } else if (normalizedSource === 'novel' || normalizedSource === 'short_story') {
    return [
      {
        id: 'content_analysis',
        label: 'Editorial Assessment',
        description: 'Literary analysis with publishing considerations (Recommended)',
        formatKey: 'report_content_analysis'
      },
      {
        id: 'script_coverage',
        label: 'Reader\'s Report',
        description: 'Synopsis, strengths/weaknesses, recommendation',
        formatKey: 'report_script_coverage'
      },
      {
        id: 'general',
        label: 'General Report',
        description: 'Flexible report structure',
        formatKey: 'report'
      }
    ]
  }
  
  // Default for unknown sources
  return [
    {
      id: 'general',
      label: 'General Report',
      description: 'Flexible report structure',
      formatKey: 'report'
    },
    {
      id: 'business',
      label: 'Business Report',
      description: 'Strategic analysis with recommendations',
      formatKey: 'report_business'
    },
    {
      id: 'content_analysis',
      label: 'Content Analysis',
      description: 'Thematic breakdown and insights',
      formatKey: 'report_content_analysis'
    }
  ]
}

