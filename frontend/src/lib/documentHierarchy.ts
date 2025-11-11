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

