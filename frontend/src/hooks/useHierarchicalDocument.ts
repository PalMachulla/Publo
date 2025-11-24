/**
 * useHierarchicalDocument
 * 
 * Replaces useDocumentSections with hierarchical document management
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DocumentManager } from '@/lib/document/DocumentManager'
import type { DocumentData, FlatDocumentSection } from '@/types/document-hierarchy'
import type { StoryStructureItem } from '@/types/nodes'

interface UseHierarchicalDocumentOptions {
  nodeId: string | null // The story-structure node ID
  structureItems: StoryStructureItem[]
  format: 'screenplay' | 'novel' | 'report'
  enabled?: boolean
}

interface UseHierarchicalDocumentReturn {
  // Document manager instance
  manager: DocumentManager | null
  
  // Derived data for UI compatibility
  sections: FlatDocumentSection[] // Flat view for existing UI components
  fullDocument: string // Complete markdown
  
  // State
  loading: boolean
  error: string | null
  
  // Operations
  updateContent: (sectionId: string, content: string) => Promise<boolean>
  updateSummary: (sectionId: string, summary: string) => Promise<boolean>
  updateThemeColor: (sectionId: string, color: string) => Promise<boolean>
  getSectionById: (sectionId: string) => FlatDocumentSection | undefined
  
  // Save to database
  save: () => Promise<boolean>
  
  // Refresh from database
  refresh: () => Promise<void>
}

export function useHierarchicalDocument({
  nodeId,
  structureItems,
  format,
  enabled = true,
}: UseHierarchicalDocumentOptions): UseHierarchicalDocumentReturn {
  const [manager, setManager] = useState<DocumentManager | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabaseRef = useRef(createClient()) // ✅ FIX: Use ref to prevent recreation

  // Fetch document from database
  const fetchDocument = useCallback(async () => {
    if (!nodeId || !enabled) {
      console.log('🔍 [useHierarchicalDocument] fetch skipped:', { nodeId, enabled })
      setLoading(false)
      return
    }

    try {
      console.log('🔍 [useHierarchicalDocument] Fetching document for node:', nodeId)
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabaseRef.current
        .from('nodes')
        .select('document_data')
        .eq('id', nodeId)
        .single()

      if (fetchError) throw fetchError

      // If document_data exists, use it; otherwise, initialize from structure items
      if (data?.document_data) {
        console.log('✅ [useHierarchicalDocument] Loaded existing document:', {
          version: data.document_data.version,
          format: data.document_data.format,
          structureCount: data.document_data.structure?.length || 0,
          totalWordCount: data.document_data.totalWordCount
        })
        
        const docManager = new DocumentManager(data.document_data as DocumentData)
        setManager(docManager)
      } else {
        console.log('🆕 [useHierarchicalDocument] No document_data found, initializing from structure items')
        
        // Create new document from structure items
        const docManager = DocumentManager.fromStructureItems(structureItems, format)
        setManager(docManager)
        
        // Save the new document
        await saveDocument(docManager, nodeId)
      }
    } catch (err) {
      console.error('❌ [useHierarchicalDocument] Failed to fetch document:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch document')
      
      // Fallback: Create from structure items if structureItems are available
      if (structureItems && structureItems.length > 0) {
        try {
          console.log('🔄 [useHierarchicalDocument] Fallback: Creating from structure items')
          const docManager = DocumentManager.fromStructureItems(structureItems, format)
          setManager(docManager)
        } catch (fallbackErr) {
          console.error('❌ [useHierarchicalDocument] Fallback failed:', fallbackErr)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [nodeId, enabled, structureItems, format]) // ✅ FIX: Removed supabase from deps

  // Save document to database
  const saveDocument = async (docManager: DocumentManager, targetNodeId: string): Promise<boolean> => {
    try {
      console.log('💾 [useHierarchicalDocument] Saving document to node:', targetNodeId)
      
      const documentData = docManager.getData()
      
      const { error: updateError} = await supabaseRef.current
        .from('nodes')
        .update({ document_data: documentData })
        .eq('id', targetNodeId)

      if (updateError) throw updateError

      console.log('✅ [useHierarchicalDocument] Document saved successfully')
      return true
    } catch (err) {
      console.error('❌ [useHierarchicalDocument] Failed to save document:', err)
      setError(err instanceof Error ? err.message : 'Failed to save document')
      return false
    }
  }

  // Auto-save with debounce
  const scheduleSave = useCallback(() => {
    if (!manager || !nodeId) return
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Schedule new save after 2 seconds of inactivity
    saveTimeoutRef.current = setTimeout(() => {
      console.log('⏰ [useHierarchicalDocument] Auto-saving...')
      saveDocument(manager, nodeId)
    }, 2000)
  }, [manager, nodeId])

  // Update content
  const updateContent = useCallback(
    async (sectionId: string, content: string): Promise<boolean> => {
      if (!manager) return false

      const success = manager.updateContent(sectionId, content)
      if (success) {
        // Trigger re-render
        setManager(new DocumentManager(manager.getData()))
        scheduleSave()
      }
      return success
    },
    [manager, scheduleSave]
  )

  // Update summary
  const updateSummary = useCallback(
    async (sectionId: string, summary: string): Promise<boolean> => {
      if (!manager) return false

      const success = manager.updateSummary(sectionId, summary)
      if (success) {
        setManager(new DocumentManager(manager.getData()))
        scheduleSave()
      }
      return success
    },
    [manager, scheduleSave]
  )

  // Update theme color
  const updateThemeColor = useCallback(
    async (sectionId: string, color: string): Promise<boolean> => {
      if (!manager) return false

      const success = manager.updateThemeColor(sectionId, color)
      if (success) {
        setManager(new DocumentManager(manager.getData()))
        scheduleSave()
      }
      return success
    },
    [manager, scheduleSave]
  )

  // Get section by ID
  const getSectionById = useCallback(
    (sectionId: string): FlatDocumentSection | undefined => {
      if (!manager) return undefined
      return manager.getFlatStructure().find(s => s.id === sectionId)
    },
    [manager]
  )

  // Manual save
  const save = useCallback(async (): Promise<boolean> => {
    if (!manager || !nodeId) return false
    return await saveDocument(manager, nodeId)
  }, [manager, nodeId])

  // Refresh from database
  const refresh = useCallback(async () => {
    await fetchDocument()
  }, [fetchDocument])

  // Fetch on mount and when nodeId/structureItems change
  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Derived data for UI
  const sections = manager ? manager.getFlatStructure() : []
  const fullDocument = manager ? manager.getFullDocument() : ''

  return {
    manager,
    sections,
    fullDocument,
    loading,
    error,
    updateContent,
    updateSummary,
    updateThemeColor,
    getSectionById,
    save,
    refresh,
  }
}

