import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  DocumentSection,
  DocumentSectionCreate,
  DocumentSectionUpdate,
} from '@/types/document'
import type { StoryStructureItem } from '@/types/nodes'
import { calculateWordCount } from '@/types/document'

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

export function useDocumentSections({
  storyStructureNodeId,
  structureItems,
  enabled = true,
}: UseDocumentSectionsOptions): UseDocumentSectionsReturn {
  const [sections, setSections] = useState<DocumentSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initializingRef = useRef(false) // Prevent concurrent initialization

  const supabase = createClient()

  // Fetch sections from database
  const fetchSections = useCallback(async () => {
    if (!storyStructureNodeId || !enabled) {
      console.log('🔍 [useDocumentSections] fetchSections skipped:', { storyStructureNodeId, enabled })
      setLoading(false)
      return
    }

    try {
      console.log('🔍 [useDocumentSections] Fetching sections for node:', storyStructureNodeId)
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('document_sections')
        .select('*')
        .eq('story_structure_node_id', storyStructureNodeId)
        .order('order_index', { ascending: true })

      if (fetchError) throw fetchError

      console.log('✅ [useDocumentSections] Fetched sections:', {
        count: data?.length || 0,
        sample: data?.[0] ? {
          id: data[0].id,
          structure_item_id: data[0].structure_item_id,
          contentLength: data[0].content?.length || 0,
          contentPreview: data[0].content?.substring(0, 50)
        } : null
      })

      setSections(data || [])
    } catch (err) {
      console.error('Failed to fetch sections:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch sections')
    } finally {
      setLoading(false)
    }
  }, [storyStructureNodeId, enabled, supabase])

  // Initialize sections from structure items if they don't exist
  const initializeSections = useCallback(async () => {
    if (!storyStructureNodeId || !enabled || structureItems.length === 0) {
      return
    }

    // Prevent concurrent initialization
    if (initializingRef.current) {
      console.log('Already initializing sections, skipping...')
      return
    }

    try {
      initializingRef.current = true
      setLoading(true)
      setError(null)

      console.log('Initializing sections for node:', storyStructureNodeId)
      
      // Debug: Check current user
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Current user:', user?.id, user?.email)

      // Check which sections already exist
      const existingSectionIds = new Set(
        sections.map(s => s.structure_item_id)
      )

      // Create sections for items that don't have them
      // Map with original index to preserve order
      const newSections: DocumentSectionCreate[] = structureItems
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !existingSectionIds.has(item.id))
        .map(({ item, originalIndex }) => ({
          story_structure_node_id: storyStructureNodeId,
          structure_item_id: item.id,
          content: `<h${Math.min(item.level, 3)} data-section-id="${item.id}" id="section-${item.id}">${item.name}</h${Math.min(item.level, 3)}>\n<p></p>`,
          word_count: 0,
          status: 'draft' as const,
          order_index: typeof item.order === 'number' ? item.order : originalIndex, // Use item.order if valid, fallback to original index
        }))

      if (newSections.length === 0) {
        console.log('No new sections to create')
        setLoading(false)
        return
      }

      console.log('Creating sections:', newSections)
      
      // Debug: Check if node exists and user owns story
      const { data: nodeCheck, error: nodeError } = await supabase
        .from('nodes')
        .select('id, story_id, stories(user_id)')
        .eq('id', storyStructureNodeId)
        .single()
      
      console.log('Node ownership check:', { nodeCheck, nodeError })
      
      // Use ignoreDuplicates to handle race conditions
      const { data, error: createError } = await supabase
        .from('document_sections')
        .insert(newSections)
        .select()
        .throwOnError()

      console.log('Sections created successfully:', data)

      // Merge with existing sections
      if (data && data.length > 0) {
        setSections(prev => [...prev, ...data].sort((a, b) => a.order_index - b.order_index))
      }
    } catch (err: any) {
      // If it's a duplicate key error, just fetch to get existing sections
      if (err?.code === '23505') {
        console.log('Duplicate sections detected, fetching existing sections...')
        await fetchSections()
      } else {
        console.error('Failed to initialize sections:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize sections')
      }
    } finally {
      setLoading(false)
      initializingRef.current = false
    }
  }, [storyStructureNodeId, enabled, structureItems, sections, supabase, fetchSections])

  // Create a new section
  const createSection = useCallback(
    async (section: DocumentSectionCreate): Promise<DocumentSection | null> => {
      if (!enabled) return null

      try {
        const { data, error: createError } = await supabase
          .from('document_sections')
          .insert(section)
          .select()
          .single()

        if (createError) throw createError

        setSections(prev => [...prev, data].sort((a, b) => a.order_index - b.order_index))
        return data
      } catch (err) {
        console.error('Failed to create section:', err)
        setError(err instanceof Error ? err.message : 'Failed to create section')
        return null
      }
    },
    [enabled, supabase]
  )

  // Update a section
  const updateSection = useCallback(
    async (sectionId: string, updates: DocumentSectionUpdate): Promise<boolean> => {
      if (!enabled) return false

      try {
        // Calculate word count if content is being updated
        const updateData = { ...updates }
        if (updates.content !== undefined) {
          updateData.word_count = calculateWordCount(updates.content)
        }

        const { error: updateError } = await supabase
          .from('document_sections')
          .update(updateData)
          .eq('id', sectionId)

        if (updateError) throw updateError

        // Update local state
        setSections(prev =>
          prev.map(section =>
            section.id === sectionId
              ? { ...section, ...updateData, updated_at: new Date().toISOString() }
              : section
          )
        )

        return true
      } catch (err) {
        console.error('Failed to update section:', err)
        setError(err instanceof Error ? err.message : 'Failed to update section')
        return false
      }
    },
    [enabled, supabase]
  )

  // Delete a section
  const deleteSection = useCallback(
    async (sectionId: string): Promise<boolean> => {
      if (!enabled) return false

      try {
        const { error: deleteError } = await supabase
          .from('document_sections')
          .delete()
          .eq('id', sectionId)

        if (deleteError) throw deleteError

        setSections(prev => prev.filter(section => section.id !== sectionId))
        return true
      } catch (err) {
        console.error('Failed to delete section:', err)
        setError(err instanceof Error ? err.message : 'Failed to delete section')
        return false
      }
    },
    [enabled, supabase]
  )

  // Get section by structure item ID
  const getSectionByStructureItemId = useCallback(
    (structureItemId: string): DocumentSection | undefined => {
      return sections.find(s => s.structure_item_id === structureItemId)
    },
    [sections]
  )

  // Refresh sections
  const refreshSections = useCallback(async () => {
    await fetchSections()
  }, [fetchSections])

  // Fetch sections on mount and when storyStructureNodeId changes
  useEffect(() => {
    fetchSections()
  }, [fetchSections])

  // Auto-initialize sections when structure items change
  // Disabled to prevent race conditions - sections are created on-demand when panel opens
  // useEffect(() => {
  //   if (
  //     storyStructureNodeId &&
  //     enabled &&
  //     !loading &&
  //     structureItems.length > 0 &&
  //     sections.length < structureItems.length
  //   ) {
  //     initializeSections()
  //   }
  // }, [storyStructureNodeId, enabled, loading, structureItems, sections.length, initializeSections])

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

