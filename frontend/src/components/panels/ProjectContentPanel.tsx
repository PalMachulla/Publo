'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useDocumentSectionsAdapter as useDocumentSections } from '@/hooks/useDocumentSectionsAdapter'
import { useDocumentEditor } from '@/hooks/useDocumentEditor'
import { useSectionCards } from '@/hooks/useSectionCards'
import { MarkdownContent } from '../ui/atoms/MarkdownContent'
import ProjectTree from './ProjectTree'
import ContentRenderer, { selectionToFocusedContent } from './ContentRenderer'
import CharacterPanel from './CharacterPanel'
import ResearchPanel from './ResearchPanel'
import type { StoryStructureItem, CharacterNodeData, ResearchNodeData } from '@/types/nodes'
import type { DocumentSection } from '@/types/document'
import type { ProjectTreeSelection, FocusedContent } from '@/types/focused-content'
import type { Edge, Node } from 'reactflow'

// Streaming content from orchestrator (real-time writing)
interface StreamingContentState {
  sectionId: string
  content: string
  isComplete: boolean
}

interface ProjectContentPanelProps {
  isOpen: boolean
  onClose: () => void
  storyStructureNodeId?: string | null
  structureItems?: StoryStructureItem[]
  initialSectionId?: string | null
  /** Character selection trigger (from canvas double-click) - uses timestamp to ensure effect triggers */
  selectedCharacterTrigger?: { nodeId: string; timestamp: number } | null
  
  /** Clear the character selection trigger after processing */
  onClearCharacterTrigger?: () => void
  onUpdateStructure?: (nodeId: string, updatedItems: StoryStructureItem[]) => void
  canvasEdges?: Edge[]
  canvasNodes?: Node[]
  contentMap?: Record<string, string>
  streamingContent?: Record<string, StreamingContentState>
  orchestratorPanelWidth?: number
  onSwitchDocument?: (nodeId: string) => void
  onSetContext?: (context: { type: 'section' | 'segment', id: string, name: string, title?: string, level?: number, description?: string }) => void
  onSectionsLoaded?: (sections: Array<{ id: string; structure_item_id: string; content: string }>) => void
  onRefreshSections?: (refreshFn: () => Promise<void>) => void
  /** Callback when focused content changes (for orchestrator context) */
  onFocusedContentChange?: (focusedContent: FocusedContent | null) => void
  /** User ID for character/research panels */
  userId?: string
  /** Story ID for character/research panels */
  storyId?: string
  /** Callback to update a node */
  onNodeUpdate?: (nodeId: string, data: any) => void
  /** Callback to delete a node */
  onNodeDelete?: (nodeId: string) => void
}

export default function ProjectContentPanel({
  isOpen,
  onClose,
  storyStructureNodeId = null,
  structureItems = [],
  initialSectionId = null,
  selectedCharacterTrigger = null,
  // onClearCharacterTrigger - no longer used, using ref to track processed triggers
  onUpdateStructure,
  canvasEdges = [],
  canvasNodes = [],
  contentMap = {},
  streamingContent = {},
  orchestratorPanelWidth = 384,
  onSwitchDocument,
  onSetContext,
  onSectionsLoaded,
  onRefreshSections,
  onFocusedContentChange,
  userId = '',
  storyId = '',
  onNodeUpdate,
  onNodeDelete,
}: ProjectContentPanelProps) {
  
  // Tree selection state
  const [treeSelection, setTreeSelection] = useState<ProjectTreeSelection | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId)
  
  // Track the last processed character trigger timestamp to avoid re-processing
  const lastProcessedTriggerRef = useRef<number | null>(null)
  
  // Handle character selection from canvas double-click
  // Uses timestamp in trigger to ensure effect runs even for same character
  useEffect(() => {
    if (selectedCharacterTrigger) {
      // Only process if this is a new trigger (different timestamp)
      if (lastProcessedTriggerRef.current === selectedCharacterTrigger.timestamp) {
        console.log('📂 [ProjectContentPanel] Skipping already processed trigger:', selectedCharacterTrigger.timestamp)
        return // Already processed this trigger
      }
      
      const { nodeId, timestamp } = selectedCharacterTrigger
      console.log('📂 [ProjectContentPanel] Processing character trigger:', { nodeId, timestamp, canvasNodesCount: canvasNodes.length })
      
      const charNode = canvasNodes.find(n => n.id === nodeId)
      console.log('📂 [ProjectContentPanel] Found charNode:', charNode ? { id: charNode.id, label: charNode.data?.label, characterName: charNode.data?.characterName } : 'NOT FOUND')
      
      if (charNode) {
        // Mark as processed BEFORE updating state
        lastProcessedTriggerRef.current = timestamp
        
        const charName = charNode.data?.label || charNode.data?.characterName || charNode.data?.name || 'Character'
        console.log('📂 [ProjectContentPanel] Selecting character from canvas:', charName, 'nodeId:', nodeId, 'trigger:', timestamp)
        
        // Use the tree's node ID format: character-{canvasNodeId}
        const newSelection: ProjectTreeSelection = {
          type: 'character',
          nodeId: `character-${nodeId}`,
          canvasNodeId: nodeId,
          name: charName,
        }
        setTreeSelection(newSelection)
        
        // Immediately update focused content for orchestrator context
        if (onFocusedContentChange) {
          const focusedContent = selectionToFocusedContent(newSelection, canvasNodes)
          console.log('📂 [ProjectContentPanel] Updating focused content for character:', focusedContent)
          onFocusedContentChange(focusedContent)
        }
      }
    }
  }, [selectedCharacterTrigger, canvasNodes, onFocusedContentChange])
  
  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('publo-project-sidebar-collapsed')
      return saved ? JSON.parse(saved) : false
    }
    return false
  })
  
  // Theme colors for cards
  const [themeColors, setThemeColors] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined' && storyStructureNodeId) {
      const saved = localStorage.getItem(`publo-theme-colors-${storyStructureNodeId}`)
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })

  const editorContainerRef = useRef<HTMLDivElement>(null)
  
  // Fetch and manage document sections
  const {
    sections,
    loading: sectionsLoading,
    error: sectionsError,
    updateSection,
    getSectionByStructureItemId,
    initializeSections,
    refreshSections,
  } = useDocumentSections({
    storyStructureNodeId: storyStructureNodeId || null,
    structureItems,
  })
  
  // Load section cards from Librarian
  const { 
    cardsWithDetails: sectionCards, 
    refreshCards: refreshSectionCards,
    isLoading: cardsLoading 
  } = useSectionCards({ 
    nodeId: storyStructureNodeId || null,
    autoRefresh: false 
  })

  // Get active section for document editor
  const activeSection = activeSectionId
    ? sections.find(s => s.structure_item_id === activeSectionId) || sections.find(s => s.id === activeSectionId)
    : sections[0]

  // Document editor with auto-save
  const {
    content,
    setContent,
    wordCount,
    saveStatus,
    lastSaved,
    saveError,
    handleEditorUpdate,
    isDirty,
    saveNow,
  } = useDocumentEditor({
    initialContent: activeSection?.content || '',
    onSave: async (newContent, words) => {
      if (activeSection) {
        await updateSection(activeSection.id, {
          content: newContent,
          word_count: words,
          status: 'in_progress',
        })
      }
    },
    autoSaveDelay: 999999,
    enabled: !!activeSection,
  })

  // Persist sidebar state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('publo-project-sidebar-collapsed', JSON.stringify(isSidebarCollapsed))
    }
  }, [isSidebarCollapsed])

  // Persist theme colors
  useEffect(() => {
    if (typeof window !== 'undefined' && storyStructureNodeId) {
      localStorage.setItem(`publo-theme-colors-${storyStructureNodeId}`, JSON.stringify(themeColors))
    }
  }, [themeColors, storyStructureNodeId])

  // Provide refresh function to parent
  useEffect(() => {
    if (onRefreshSections) {
      onRefreshSections(refreshSections)
    }
  }, [onRefreshSections, refreshSections])

  // Update focused content when selection changes
  useEffect(() => {
    if (onFocusedContentChange) {
      const focusedContent = selectionToFocusedContent(treeSelection, canvasNodes)
      onFocusedContentChange(focusedContent)
    }
  }, [treeSelection, canvasNodes, onFocusedContentChange])

  // Handle tree selection
  const handleTreeSelect = useCallback((selection: ProjectTreeSelection) => {
    setTreeSelection(selection)
    
    // If selecting a section, update active section
    if (selection.type === 'section' && selection.sectionId) {
      setActiveSectionId(selection.sectionId)
    }
    
    // If selecting a story, update active story
    if (selection.type === 'story' && selection.canvasNodeId && onSwitchDocument) {
      onSwitchDocument(selection.canvasNodeId)
    }
  }, [onSwitchDocument])

  // Handle story switch from tree
  const handleSwitchStory = useCallback((nodeId: string) => {
    if (onSwitchDocument) {
      onSwitchDocument(nodeId)
    }
  }, [onSwitchDocument])

  // Handle section click in librarian view
  const handleSectionClick = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId)
    // Also update tree selection
    setTreeSelection({
      nodeId: `section-${sectionId}`,
      type: 'section',
      canvasNodeId: storyStructureNodeId || undefined,
      sectionId,
      name: structureItems.find(i => i.id === sectionId)?.name || 'Section',
    })
  }, [storyStructureNodeId, structureItems])

  // Handle color change for cards
  const handleColorChange = useCallback((itemId: string, color: string) => {
    setThemeColors(prev => ({ ...prev, [itemId]: color }))
  }, [])

  // Calculate writing section IDs
  const writingSectionIds = useMemo(() => {
    return Object.entries(streamingContent)
      .filter(([_, state]) => !state.isComplete)
      .map(([sectionId]) => sectionId)
  }, [streamingContent])

  // Render document content (for story/section selections)
  const renderDocumentContent = useCallback(() => {
    return (
      <div className="h-full flex flex-col">
        {/* Document header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-900">
                {treeSelection?.name || 'Document'}
              </h2>
              {activeSectionId && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {structureItems.find(i => i.id === activeSectionId)?.title || ''}
                </p>
              )}
            </div>
            <div className="text-xs text-gray-400 font-mono">{wordCount} words</div>
          </div>
        </div>
        
        {/* Document content */}
        <div ref={editorContainerRef} className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-6">
            {structureItems.length > 0 ? (
              <div className="prose prose-sm max-w-none">
                {/* Render active section content */}
                {activeSectionId && (
                  <MarkdownContent>
                    {getContentForSection(activeSectionId)}
                  </MarkdownContent>
                )}
              </div>
            ) : (
              <p className="text-gray-400 italic text-center py-8">
                No structure yet. Ask the orchestrator to create a structure first.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }, [treeSelection, activeSectionId, wordCount, structureItems])

  // Get content for a section (including streaming)
  const getContentForSection = (sectionId: string): string => {
    const streaming = streamingContent[sectionId]
    if (streaming && !streaming.isComplete) {
      return streaming.content + ' ▌'
    }
    
    const section = sections.find(s => s.structure_item_id === sectionId)
    if (section?.content) {
      return section.content
    }
    
    return contentMap[sectionId] || '_No content yet. Ask the orchestrator to write this section._'
  }

  // Render character panel (embedded)
  const renderCharacterPanel = useCallback((node: Node<CharacterNodeData>) => {
    return (
      <CharacterPanel
        node={node}
        onUpdate={(nodeId, data) => onNodeUpdate?.(nodeId, data)}
        onDelete={(nodeId) => onNodeDelete?.(nodeId)}
        userId={userId}
        storyId={storyId}
        embedded
      />
    )
  }, [userId, storyId, onNodeUpdate, onNodeDelete])

  // Render research panel (embedded)
  const renderResearchPanel = useCallback((node: Node<ResearchNodeData>) => {
    return (
      <ResearchPanel
        node={node}
        onUpdate={(nodeId, data) => onNodeUpdate?.(nodeId, data)}
        onDelete={(nodeId) => onNodeDelete?.(nodeId)}
        embedded
      />
    )
  }, [onNodeUpdate, onNodeDelete])

  // Build breadcrumb from selection
  const breadcrumb = useMemo(() => {
    if (!treeSelection) return []
    
    const parts: string[] = []
    
    switch (treeSelection.type) {
      case 'story':
        parts.push('Stories', treeSelection.name)
        break
      case 'section':
        parts.push('Stories')
        // Find parent story
        const storyNode = canvasNodes.find(n => n.id === treeSelection.canvasNodeId)
        if (storyNode) {
          parts.push(storyNode.data?.name || 'Story')
        }
        parts.push('Content')
        parts.push(treeSelection.name)
        break
      case 'librarian':
        parts.push('Stories')
        const libStoryNode = canvasNodes.find(n => n.id === treeSelection.canvasNodeId)
        if (libStoryNode) {
          parts.push(libStoryNode.data?.name || 'Story')
        }
        parts.push('Librarian')
        break
      case 'character':
        parts.push('Characters', treeSelection.name)
        break
      case 'research':
        parts.push('Research', treeSelection.name)
        break
      default:
        parts.push(treeSelection.name)
    }
    
    return parts
  }, [treeSelection, canvasNodes])

  if (!isOpen) return null

  return (
    <div
      className="fixed top-16 bottom-0 bg-white border-r border-t border-gray-200 shadow-xl z-40 flex flex-col"
      style={{
        left: 0,
        right: `${orchestratorPanelWidth}px`,
      }}
    >
      {/* Header with breadcrumb */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-sm">
          {breadcrumb.length > 0 ? (
            breadcrumb.map((part, i) => (
              <span key={i} className="flex items-center">
                {i > 0 && <span className="mx-2 text-gray-300">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'font-medium text-gray-900' : 'text-gray-500'}>
                  {part}
                </span>
              </span>
            ))
          ) : (
            <span className="text-gray-500">Select an item</span>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          title="Close panel"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main content area with sidebar */}
      <div className="flex-1 flex min-h-0">
        {/* Project Tree Sidebar */}
        {!isSidebarCollapsed && (
          <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Project</span>
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Collapse sidebar"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            
            <ProjectTree
              canvasNodes={canvasNodes}
              activeStoryNodeId={storyStructureNodeId}
              structureItems={structureItems}
              selection={treeSelection}
              onSelect={handleTreeSelect}
              onSwitchStory={handleSwitchStory}
            />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative bg-gray-100">
          {/* Grid background */}
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0, 0, 0, 0.03) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 1px, transparent 1px)
              `,
              backgroundSize: '24px 24px',
              opacity: 0.5,
            }}
          />
          
          {/* Content renderer */}
          <div className="flex-1 relative z-10 overflow-hidden">
            <ContentRenderer
              selection={treeSelection}
              canvasNodes={canvasNodes}
              canvasEdges={canvasEdges}
              structureItems={structureItems}
              sectionCards={sectionCards}
              activeSectionId={activeSectionId}
              onSectionClick={handleSectionClick}
              contentMap={contentMap}
              streamingContent={streamingContent}
              writingSectionIds={writingSectionIds}
              themeColors={themeColors}
              onColorChange={handleColorChange}
              renderDocumentContent={renderDocumentContent}
              renderCharacterPanel={renderCharacterPanel}
              renderResearchPanel={renderResearchPanel}
              userId={userId}
              storyId={storyId}
              onNodeUpdate={onNodeUpdate}
              onNodeDelete={onNodeDelete}
            />
          </div>

          {/* Sidebar expand button (when collapsed) */}
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsSidebarCollapsed(false)}
              className="absolute top-4 left-0 p-2 bg-white border border-gray-200 rounded-r-lg hover:bg-gray-50 transition-colors shadow-sm z-20"
              title="Show project tree"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
