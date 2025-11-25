/**
 * useDocumentSectionsAdapter
 * 
 * Adapter hook that provides backward compatibility with useDocumentSections
 * while using the new hierarchical document system underneath
 */

import { useMemo, useCallback } from 'react'
import { useHierarchicalDocument } from './useHierarchicalDocument'
import type { DocumentSection, DocumentSectionCreate, DocumentSectionUpdate } from '@/types/document'
import type { StoryStructureItem } from '@/types/nodes'

interface UseDocumentSectionsOptions {
  storyStructureNodeId: string | null
  structureItems: StoryStructureItem[]
  enabled?: boolean
}

interface UseDocumentSectionsReturn {
  sections: DocumentSection[]
  loading: boolean
  error: string | null
  createSection: (section: DocumentSectionCreate) => Promise<DocumentSection | null>
  updateSection: (sectionId: string, updates: DocumentSectionUpdate) => Promise<boolean>
  deleteSection: (sectionId: string) => Promise<boolean>
  getSectionByStructureItemId: (structureItemId: string) => DocumentSection | undefined
  initializeSections: () => Promise<void>
  refreshSections: () => Promise<void>
}

/**
 * Adapter that makes useHierarchicalDocument look like useDocumentSections
 * This allows gradual migration of components
 */
export function useDocumentSectionsAdapter({
  storyStructureNodeId,
  structureItems,
  enabled = true,
}: UseDocumentSectionsOptions): UseDocumentSectionsReturn {
  // Determine document format from structure items
  const format = useMemo(() => {
    // Check if any structure items have format info, otherwise default to 'screenplay'
    const firstItem = structureItems[0]
    if (firstItem && 'format' in firstItem) {
      return (firstItem as any).format || 'screenplay'
    }
    return 'screenplay'
  }, [structureItems])

  const {
    manager,
    sections: flatSections,
    loading,
    error,
    updateContent,
    save,
    refresh,
  } = useHierarchicalDocument({
    nodeId: storyStructureNodeId,
    structureItems,
    format,
    enabled,
  })

  // Convert flat sections to DocumentSection format
  const sections = useMemo<DocumentSection[]>(() => {
    // ✅ FIX: Use section timestamps if available, otherwise use current time
    // This prevents unnecessary re-renders from changing timestamps
    const now = new Date().toISOString()
    return flatSections.map(section => ({
      id: section.id,
      story_structure_node_id: storyStructureNodeId || '',
      structure_item_id: section.id, // In new system, these are the same
      content: section.content,
      word_count: section.wordCount,
      status: section.status,
      order_index: section.order,
      created_at: section.createdAt || now,
      updated_at: section.updatedAt || now,
    }))
  }, [flatSections, storyStructureNodeId])

  // Create section (not commonly used in new system, but for compatibility)
  const createSection = useCallback(
    async (section: DocumentSectionCreate): Promise<DocumentSection | null> => {
      console.warn('[Adapter] createSection called - not fully supported in hierarchical system')
      return null
    },
    []
  )

  // Update section
  const updateSection = useCallback(
    async (sectionId: string, updates: DocumentSectionUpdate): Promise<boolean> => {
      if (!manager) return false

      // Handle content update
      if (updates.content !== undefined) {
        const success = await updateContent(sectionId, updates.content)
        if (success) {
          await save() // Explicitly save
        }
        return success
      }

      // Handle status update
      if (updates.status !== undefined) {
        const node = manager.findNode(sectionId)
        if (node) {
          manager.updateStatus(sectionId, updates.status)
          await save()
          return true
        }
      }

      return false
    },
    [manager, updateContent, save]
  )

  // Delete section (not commonly used, but for compatibility)
  const deleteSection = useCallback(
    async (sectionId: string): Promise<boolean> => {
      if (!manager) return false
      const success = manager.deleteNode(sectionId)
      if (success) {
        await save()
      }
      return success
    },
    [manager, save]
  )

  // Get section by structure item ID
  const getSectionByStructureItemId = useCallback(
    (structureItemId: string): DocumentSection | undefined => {
      return sections.find(s => s.structure_item_id === structureItemId)
    },
    [sections]
  )

  // Initialize sections (auto-handled by hierarchical system)
  const initializeSections = useCallback(async () => {
    console.log('[Adapter] initializeSections called - hierarchical system auto-initializes')
    await refresh()
  }, [refresh])

  // Refresh sections
  const refreshSections = useCallback(async () => {
    await refresh()
  }, [refresh])

  return {
    sections,
    loading,
    error,
    createSection,
    updateSection,
    deleteSection,
    getSectionByStructureItemId,
    initializeSections,
    refreshSections,
  }
}

