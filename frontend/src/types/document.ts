// Document-related TypeScript interfaces for the AI Document Assistant

import { StoryStructureItem } from './nodes'

// ============================================================================
// Document Section
// ============================================================================
export interface DocumentSection {
  id: string
  story_structure_node_id: string
  structure_item_id: string
  content: string
  word_count: number
  status: 'draft' | 'in_progress' | 'completed'
  order_index: number
  created_at: string
  updated_at: string
}

export interface DocumentSectionCreate {
  story_structure_node_id: string
  structure_item_id: string
  content?: string
  word_count?: number
  status?: 'draft' | 'in_progress' | 'completed'
  order_index: number
}

export interface DocumentSectionUpdate {
  content?: string
  word_count?: number
  status?: 'draft' | 'in_progress' | 'completed'
  order_index?: number
}

// ============================================================================
// AI Interactions (Future Use)
// ============================================================================
export type AIInteractionType = 
  | 'analysis' 
  | 'suggestion' 
  | 'generation' 
  | 'continuation' 
  | 'companion'

export interface AIInteraction {
  id: string
  user_id: string
  document_section_id: string | null
  interaction_type: AIInteractionType
  prompt: string
  response: string | null
  metadata: Record<string, any>
  created_at: string
}

export interface AIInteractionCreate {
  document_section_id?: string
  interaction_type: AIInteractionType
  prompt: string
  response?: string
  metadata?: Record<string, any>
}

// ============================================================================
// Highlights (Future Use)
// ============================================================================
export type HighlightType = 'yellow' | 'red' | 'blue' | 'green'

export interface Highlight {
  id: string
  document_section_id: string
  start_offset: number
  end_offset: number
  type: HighlightType
  message: string | null
  created_at: string
  updated_at: string
}

export interface HighlightCreate {
  document_section_id: string
  start_offset: number
  end_offset: number
  type: HighlightType
  message?: string
}

export interface HighlightUpdate {
  type?: HighlightType
  message?: string
}

// Highlight type descriptions for UI
export const HIGHLIGHT_TYPES: Record<HighlightType, { label: string; description: string; color: string }> = {
  yellow: {
    label: 'Style Issue',
    description: 'Passive voice, repetition, or style concerns',
    color: 'bg-yellow-100 border-yellow-400 text-yellow-800'
  },
  red: {
    label: 'Serious Problem',
    description: 'Factual errors, inconsistencies, or critical issues',
    color: 'bg-red-100 border-red-400 text-red-800'
  },
  blue: {
    label: 'Needs Detail',
    description: 'Areas needing more detail or citations',
    color: 'bg-blue-100 border-blue-400 text-blue-800'
  },
  green: {
    label: 'Strong Section',
    description: 'Well-written sections to preserve',
    color: 'bg-green-100 border-green-400 text-green-800'
  }
}

// ============================================================================
// Track Changes (Future Use)
// ============================================================================
export type TrackChangeStatus = 'pending' | 'accepted' | 'rejected'

export interface TrackChange {
  id: string
  document_section_id: string
  start_offset: number
  end_offset: number
  original_text: string
  suggested_text: string
  status: TrackChangeStatus
  created_at: string
  updated_at: string
}

export interface TrackChangeCreate {
  document_section_id: string
  start_offset: number
  end_offset: number
  original_text: string
  suggested_text: string
  status?: TrackChangeStatus
}

export interface TrackChangeUpdate {
  status: TrackChangeStatus
}

// ============================================================================
// Editor Configuration
// ============================================================================
export interface EditorConfig {
  editable: boolean
  placeholder?: string
  autofocus?: boolean
  extensions?: any[] // TipTap extensions
}

// ============================================================================
// Document Navigation
// ============================================================================
export interface DocumentSectionWithMeta extends DocumentSection {
  structureItem: StoryStructureItem
  isActive?: boolean
}

export interface SectionNavigationItem {
  sectionId: string
  structureItemId: string
  name: string
  level: number
  wordCount: number
  status: 'draft' | 'in_progress' | 'completed'
  orderIndex: number
  children?: SectionNavigationItem[]
}

// ============================================================================
// Auto-Save State
// ============================================================================
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface AutoSaveState {
  status: SaveStatus
  lastSaved: Date | null
  error: string | null
}

// ============================================================================
// Document Statistics
// ============================================================================
export interface DocumentStatistics {
  totalWords: number
  totalSections: number
  completedSections: number
  inProgressSections: number
  draftSections: number
  averageWordsPerSection: number
}

// ============================================================================
// AI Mode Configuration (Future Use)
// ============================================================================
export interface AIModeConfig {
  id: string
  label: string
  description: string
  icon: React.ComponentType
  enabled: boolean
  comingSoon: boolean
}

// ============================================================================
// Utility Functions
// ============================================================================
export function calculateWordCount(text: string): number {
  if (!text || text.trim().length === 0) return 0
  
  // Remove HTML tags
  const plainText = text.replace(/<[^>]*>/g, ' ')
  
  // Split by whitespace and count
  const words = plainText
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
  
  return words.length
}

export function buildSectionNavigationTree(
  sections: DocumentSection[],
  structureItems: StoryStructureItem[]
): SectionNavigationItem[] {
  // Create a map of structure items by ID
  const itemMap = new Map<string, StoryStructureItem>()
  structureItems.forEach(item => itemMap.set(item.id, item))
  
  // Create navigation items from sections
  const navItems: SectionNavigationItem[] = sections
    .sort((a, b) => a.order_index - b.order_index)
    .map(section => {
      const item = itemMap.get(section.structure_item_id)
      return {
        sectionId: section.id,
        structureItemId: section.structure_item_id,
        name: item?.name || 'Untitled',
        level: item?.level || 1,
        wordCount: section.word_count,
        status: section.status,
        orderIndex: section.order_index
      }
    })
  
  // Build hierarchical tree based on parent-child relationships
  const buildTree = (parentId: string | undefined): SectionNavigationItem[] => {
    return navItems
      .filter(item => {
        const structureItem = itemMap.get(item.structureItemId)
        return structureItem?.parentId === parentId
      })
      .map(item => ({
        ...item,
        children: buildTree(item.structureItemId)
      }))
  }
  
  return buildTree(undefined)
}

export function calculateDocumentStatistics(sections: DocumentSection[]): DocumentStatistics {
  const totalWords = sections.reduce((sum, section) => sum + section.word_count, 0)
  const totalSections = sections.length
  const completedSections = sections.filter(s => s.status === 'completed').length
  const inProgressSections = sections.filter(s => s.status === 'in_progress').length
  const draftSections = sections.filter(s => s.status === 'draft').length
  const averageWordsPerSection = totalSections > 0 ? Math.round(totalWords / totalSections) : 0
  
  return {
    totalWords,
    totalSections,
    completedSections,
    inProgressSections,
    draftSections,
    averageWordsPerSection
  }
}

export function getSectionAnchorId(structureItemId: string): string {
  return `section-${structureItemId}`
}

