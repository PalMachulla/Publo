// src/lib/orchestrator/hooks/useOrchestratorActions.ts

/**
 * Hook to handle orchestrator action execution.
 * 
 * Bridges the gap between orchestrator responses and canvas/document updates.
 * Uses custom events to communicate with AIDocumentPanel.
 */

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Action } from '../components/OrchestratorPanel/types'

interface UseOrchestratorActionsOptions {
  /** Current story structure node ID */
  storyStructureNodeId?: string | null
  
  /** Callback to open/close document panel */
  onToggleDocumentPanel?: (open: boolean) => void
  
  /** Callback to navigate to a section */
  onNavigateToSection?: (sectionId: string) => void
  
  /** Callback when structure is updated */
  onStructureUpdate?: (structure: Record<string, unknown>) => void  // Changed from unknown to Record<string, unknown>
  
  /** Callback for custom action handling */
  onCustomAction?: (action: Action) => void
}

interface ContentResult {
  sectionId: string
  content: string
  wordCount?: number
}

export function useOrchestratorActions(options: UseOrchestratorActionsOptions = {}) {
  const {
    storyStructureNodeId,
    onToggleDocumentPanel,
    onNavigateToSection,
    onStructureUpdate,
    onCustomAction
  } = options
  
  /**
   * Dispatch custom event for content generation started
   */
  const dispatchGenerationStarted = useCallback((sectionId: string, sectionName?: string) => {
    if (!storyStructureNodeId) return
    
    console.log('📤 [Actions] Dispatching content-generation-started:', sectionId)
    
    window.dispatchEvent(new CustomEvent('content-generation-started', {
      detail: {
        nodeId: storyStructureNodeId,
        sectionId,
        sectionName: sectionName || sectionId
      }
    }))
  }, [storyStructureNodeId])
  
  /**
   * Dispatch custom event for content saved
   */
  const dispatchContentSaved = useCallback((sectionId: string, wordCount?: number) => {
    if (!storyStructureNodeId) return
    
    console.log('📤 [Actions] Dispatching content-saved:', sectionId)
    
    window.dispatchEvent(new CustomEvent('content-saved', {
      detail: {
        nodeId: storyStructureNodeId,
        sectionId,
        wordCount: wordCount || 0
      }
    }))
  }, [storyStructureNodeId])
  
  /**
   * Save content to Supabase document_sections table
   */
  const saveContentToSupabase = useCallback(async (
    sectionId: string, 
    content: string
  ): Promise<boolean> => {
    if (!storyStructureNodeId) {
      console.warn('⚠️ [Actions] No storyStructureNodeId, cannot save to Supabase')
      return false
    }
    
    try {
      const supabase = createClient()
      
      console.log('💾 [Actions] Saving content to Supabase:', {
        nodeId: storyStructureNodeId,
        sectionId,
        contentLength: content.length
      })
      
      // Update or insert the section content
      const { error } = await supabase
        .from('document_sections')
        .upsert({
          story_structure_node_id: storyStructureNodeId,
          structure_item_id: sectionId,
          content: content,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'story_structure_node_id,structure_item_id'
        })
      
      if (error) {
        console.error('❌ [Actions] Failed to save content:', error)
        return false
      }
      
      console.log('✅ [Actions] Content saved successfully')
      return true
      
    } catch (err) {
      console.error('❌ [Actions] Error saving content:', err)
      return false
    }
  }, [storyStructureNodeId])
  
  /**
   * Handle content generation results
   */
  const handleContentResults = useCallback(async (results: ContentResult[]) => {
    console.log('📝 [Actions] Handling content results:', results.length)
    
    for (const result of results) {
      // Save to Supabase
      const saved = await saveContentToSupabase(result.sectionId, result.content)
      
      if (saved) {
        // Dispatch event to trigger AIDocumentPanel refresh
        dispatchContentSaved(result.sectionId, result.wordCount)
      }
    }
    
    // Open document panel if we generated content
    if (results.length > 0 && onToggleDocumentPanel) {
      onToggleDocumentPanel(true)
    }
  }, [saveContentToSupabase, dispatchContentSaved, onToggleDocumentPanel])
  
  /**
   * Execute a single action
   */
  const executeAction = useCallback(async (action: Action) => {
    console.log('⚡ [Actions] Executing action:', action.type, action.payload)
    
    switch (action.type) {
      case 'open_document':
        // Open a specific document node
        const docNodeId = action.payload.nodeId || action.payload.node_id
        if (docNodeId) {
          console.log('📂 [Actions] Opening document:', docNodeId)
          onToggleDocumentPanel?.(true)
          // TODO: Could also emit event to select node on canvas
        }
        break
        
      case 'open_document_panel':
        onToggleDocumentPanel?.(true)
        break
        
      case 'close_document_panel':
        onToggleDocumentPanel?.(false)
        break
        
      case 'navigate_section':
      case 'select_section':
        const targetSectionId = action.payload.sectionId || (typeof action.payload.section_id === 'string' ? action.payload.section_id : undefined)
        if (targetSectionId && typeof targetSectionId === 'string') {
          onNavigateToSection?.(targetSectionId)
          onToggleDocumentPanel?.(true) // Also open panel
        }
        break
        
      case 'generate_content':
        // Content generation is handled via results, not actions
        // But we can show progress indicator
        const genSectionId = action.payload.sectionId || (typeof action.payload.section_id === 'string' ? action.payload.section_id : undefined)
        if (genSectionId && typeof genSectionId === 'string') {
          dispatchGenerationStarted(genSectionId, action.payload.sectionName)
        }
        break
        
      case 'generate_structure':
        // Structure generation - pass to parent for canvas update
        console.log('📐 [Actions] Structure generation requested:', action.payload)
        onStructureUpdate?.(action.payload)
        break
        
      case 'message':
        // Message actions are handled in the response flow, not here
        break
        
      default:
        // Let parent handle custom actions
        console.log('🔧 [Actions] Unhandled action, passing to parent:', action.type)
        onCustomAction?.(action)
    }
  }, [
    onToggleDocumentPanel,
    onNavigateToSection,
    onStructureUpdate,
    onCustomAction,
    dispatchGenerationStarted
  ])
  
  /**
   * Execute multiple actions in sequence
   */
  const executeActions = useCallback(async (actions: Action[]) => {
    for (const action of actions) {
      if (!action.requiresUserInput) {
        await executeAction(action)
      }
    }
  }, [executeAction])
  
  return {
    executeAction,
    executeActions,
    handleContentResults,
    dispatchGenerationStarted,
    dispatchContentSaved,
    saveContentToSupabase
  }
}