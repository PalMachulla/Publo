/**
 * useDocumentState - Document panel state management hook
 * 
 * Manages state related to the document panel, including:
 * - Document panel visibility
 * - Active document structure items and content
 * - Active context (selected section/segment)
 * - Section management and refresh callbacks
 * 
 * Architecture Notes:
 * - Document state is separate from canvas state
 * - Content map uses fallback chain: node contentMap → section content → structure summary
 * - Active context is used by orchestrator for targeted operations
 * 
 * @see AIDocumentPanel for document panel UI
 * @see canvas/page.tsx for original implementation
 */

import { useState, useRef, useCallback } from 'react'
import type { StoryFormat } from '@/types/nodes'

export interface ActiveContext {
  type: 'section' | 'segment'
  id: string
  name: string
  title?: string
  level?: number
  description?: string
}

export interface UseDocumentStateReturn {
  // Document panel visibility
  isAIDocPanelOpen: boolean
  setIsAIDocPanelOpen: React.Dispatch<React.SetStateAction<boolean>>
  
  // Orchestrator panel width (for layout coordination)
  orchestratorPanelWidth: number
  setOrchestratorPanelWidth: React.Dispatch<React.SetStateAction<number>>
  
  // Active document state
  currentStoryStructureNodeId: string | null
  setCurrentStoryStructureNodeId: React.Dispatch<React.SetStateAction<string | null>>
  
  // Document structure and content
  currentStructureItems: any[]
  setCurrentStructureItems: React.Dispatch<React.SetStateAction<any[]>>
  
  currentStructureFormat: StoryFormat | undefined
  setCurrentStructureFormat: React.Dispatch<React.SetStateAction<StoryFormat | undefined>>
  
  currentContentMap: Record<string, string>
  setCurrentContentMap: React.Dispatch<React.SetStateAction<Record<string, string>>>
  
  // Sections (from Supabase)
  currentSections: Array<{ id: string; structure_item_id: string; content: string }>
  setCurrentSections: React.Dispatch<React.SetStateAction<Array<{ id: string; structure_item_id: string; content: string }>>>
  
  // Initial section selection (for auto-selecting when opening document)
  initialSectionId: string | null
  setInitialSectionId: React.Dispatch<React.SetStateAction<string | null>>
  
  // Initial prompt/content (for document creation)
  initialPrompt: string
  setInitialPrompt: React.Dispatch<React.SetStateAction<string>>
  
  initialDocumentContent: string
  setInitialDocumentContent: React.Dispatch<React.SetStateAction<string>>
  
  // Current story draft ID
  currentStoryDraftId: string | null
  setCurrentStoryDraftId: React.Dispatch<React.SetStateAction<string | null>>
  
  // Active context (selected section/segment for orchestrator)
  activeContext: ActiveContext | null
  setActiveContext: React.Dispatch<React.SetStateAction<ActiveContext | null>>
  
  // Refresh sections callback (from document panel)
  refreshSectionsRef: React.MutableRefObject<(() => Promise<void>) | null>
  
  // Callbacks
  handleSectionsLoaded: (sections: Array<{ id: string; structure_item_id: string; content: string }>) => void
  handleRefreshSectionsCallback: (refreshFn: () => Promise<void>) => void
}

/**
 * Hook for managing document panel state
 */
export function useDocumentState(): UseDocumentStateReturn {
  // Document panel visibility
  const [isAIDocPanelOpen, setIsAIDocPanelOpen] = useState(false)
  
  // Orchestrator panel width (for layout coordination)
  const [orchestratorPanelWidth, setOrchestratorPanelWidth] = useState(384)
  
  // Active document state
  const [currentStoryStructureNodeId, setCurrentStoryStructureNodeId] = useState<string | null>(null)
  
  // Document structure and content
  const [currentStructureItems, setCurrentStructureItems] = useState<any[]>([])
  const [currentStructureFormat, setCurrentStructureFormat] = useState<StoryFormat | undefined>(undefined)
  const [currentContentMap, setCurrentContentMap] = useState<Record<string, string>>({})
  
  // Sections (from Supabase - actual content)
  const [currentSections, setCurrentSections] = useState<Array<{ id: string; structure_item_id: string; content: string }>>([])
  
  // Initial section selection (for auto-selecting when opening document)
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null)
  
  // Initial prompt/content (for document creation)
  const [initialPrompt, setInitialPrompt] = useState('')
  const [initialDocumentContent, setInitialDocumentContent] = useState('')
  
  // Current story draft ID
  const [currentStoryDraftId, setCurrentStoryDraftId] = useState<string | null>(null)
  
  // Active context (selected section/segment for orchestrator)
  const [activeContext, setActiveContext] = useState<ActiveContext | null>(null)
  
  // Store refresh function from document panel
  const refreshSectionsRef = useRef<(() => Promise<void>) | null>(null)
  
  /**
   * Handle sections loaded from AIDocumentPanel (Supabase)
   * 
   * This is the ACTUAL content source - not node contentMap.
   * Sections contain user-written full story content from the database.
   */
  const handleSectionsLoaded = useCallback((sections: Array<{ id: string; structure_item_id: string; content: string }>) => {
    console.log('📚 [useDocumentState] handleSectionsLoaded called:', {
      count: sections.length,
      sampleIds: sections.slice(0, 3).map(s => ({ 
        id: s.id, 
        structureItemId: s.structure_item_id, 
        contentLength: s.content?.length || 0,
        contentPreview: s.content?.substring(0, 50)
      }))
    })
    setCurrentSections(sections)
    console.log('✅ [useDocumentState] currentSections state updated')
  }, [])
  
  /**
   * Receive refresh function from document panel
   * 
   * This allows the canvas page to trigger section refreshes
   * when content is updated (e.g., after content generation)
   */
  const handleRefreshSectionsCallback = useCallback((refreshFn: () => Promise<void>) => {
    console.log('🔗 [useDocumentState] Received refreshSections function from document panel')
    refreshSectionsRef.current = refreshFn
  }, [])
  
  return {
    // Document panel visibility
    isAIDocPanelOpen,
    setIsAIDocPanelOpen,
    
    // Orchestrator panel width
    orchestratorPanelWidth,
    setOrchestratorPanelWidth,
    
    // Active document state
    currentStoryStructureNodeId,
    setCurrentStoryStructureNodeId,
    
    // Document structure and content
    currentStructureItems,
    setCurrentStructureItems,
    
    currentStructureFormat,
    setCurrentStructureFormat,
    
    currentContentMap,
    setCurrentContentMap,
    
    // Sections
    currentSections,
    setCurrentSections,
    
    // Initial section selection
    initialSectionId,
    setInitialSectionId,
    
    // Initial prompt/content
    initialPrompt,
    setInitialPrompt,
    
    initialDocumentContent,
    setInitialDocumentContent,
    
    // Current story draft ID
    currentStoryDraftId,
    setCurrentStoryDraftId,
    
    // Active context
    activeContext,
    setActiveContext,
    
    // Refresh sections callback
    refreshSectionsRef,
    
    // Callbacks
    handleSectionsLoaded,
    handleRefreshSectionsCallback,
  }
}

