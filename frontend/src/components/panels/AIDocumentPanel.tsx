'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useDocumentSections } from '@/hooks/useDocumentSections'
import { useDocumentEditor } from '@/hooks/useDocumentEditor'
import MarkdownEditor from '../editor/MarkdownEditor'
import NarrationArrangementView from '../document/NarrationArrangementView'
import type { StoryStructureItem, TestNodeData } from '@/types/nodes'
import type { DocumentSection } from '@/types/document'
import type { Edge, Node } from 'reactflow'

interface AIDocumentPanelProps {
  isOpen: boolean
  onClose: () => void
  storyStructureNodeId?: string | null
  structureItems?: StoryStructureItem[]
  initialSectionId?: string | null
  onUpdateStructure?: (nodeId: string, updatedItems: StoryStructureItem[]) => void
  canvasEdges?: Edge[]
  canvasNodes?: Node[]
  contentMap?: Record<string, string> // Map of structure item ID to markdown content
  orchestratorPanelWidth?: number // Width of the orchestrator panel in pixels
  onSwitchDocument?: (nodeId: string) => void // Switch to a different document
  onSetContext?: (context: { type: 'section' | 'segment', id: string, name: string, title?: string, level?: number, description?: string }) => void // Set active context for orchestrator
  onSectionsLoaded?: (sections: Array<{ id: string; structure_item_id: string; content: string }>) => void // Callback when sections are loaded from Supabase
  onRefreshSections?: (refreshFn: () => Promise<void>) => void // Callback to provide refresh function to parent
}

export default function AIDocumentPanel({
  isOpen,
  onClose,
  storyStructureNodeId = null,
  structureItems = [],
  initialSectionId = null,
  onUpdateStructure,
  canvasEdges = [],
  canvasNodes = [],
  contentMap = {},
  orchestratorPanelWidth = 384,
  onSwitchDocument,
  onSetContext,
  onSectionsLoaded,
  onRefreshSections,
}: AIDocumentPanelProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId)
  
  // Detect all story structure nodes on canvas for tabs
  const storyStructureNodes = useMemo(() => {
    return canvasNodes.filter(node => node.type === 'storyStructureNode').map(node => ({
      id: node.id,
      name: node.data?.name || node.data?.label || 'Untitled',
      format: node.data?.format,
    }))
  }, [canvasNodes])
  
  // Persist panel collapse states to localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('publo-sections-collapsed')
      return saved ? JSON.parse(saved) : false
    }
    return false
  })
  
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionParentId, setNewSectionParentId] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  
  // Persist arrangement view collapse state
  const [isArrangementCollapsed, setIsArrangementCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('publo-arrangement-collapsed')
      return saved ? JSON.parse(saved) : true // Default: collapsed
    }
    return true
  })

  const containerRef = useRef<HTMLDivElement>(null)

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
    storyStructureNodeId,
    structureItems,
    enabled: isOpen && !!storyStructureNodeId,
  })

  // Auto-expand all sections by default
  useEffect(() => {
    if (structureItems.length > 0) {
      const allItemIds = new Set(structureItems.map(item => item.id))
      setExpandedSections(allItemIds)
    }
  }, [structureItems])

  // Notify parent when sections are loaded (so orchestrator can access content)
  useEffect(() => {
    console.log('🔍 AIDocumentPanel sections changed:', {
      sectionsLength: sections.length,
      hasCallback: !!onSectionsLoaded,
      sampleSection: sections[0] ? {
        id: sections[0].id,
        structure_item_id: sections[0].structure_item_id,
        contentLength: sections[0].content?.length || 0,
        contentPreview: sections[0].content?.substring(0, 100)
      } : null
    })
    
    if (sections.length > 0 && onSectionsLoaded) {
      console.log('📞 Calling onSectionsLoaded with', sections.length, 'sections')
      onSectionsLoaded(sections)
    } else {
      console.log('⚠️ Not calling onSectionsLoaded:', {
        reason: sections.length === 0 ? 'sections empty' : 'no callback'
      })
    }
  }, [sections, onSectionsLoaded])
  
  // Provide refreshSections function to parent via callback
  useEffect(() => {
    if (onRefreshSections) {
      // Pass our refreshSections function to parent
      // Parent can call this to refresh the sections list
      onRefreshSections(refreshSections)
    }
  }, [onRefreshSections, refreshSections])

  // Persist sections sidebar collapse state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('publo-sections-collapsed', JSON.stringify(isSidebarCollapsed))
    }
  }, [isSidebarCollapsed])

  // Persist arrangement view collapse state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('publo-arrangement-collapsed', JSON.stringify(isArrangementCollapsed))
    }
  }, [isArrangementCollapsed])

  // Track if full document has been loaded to avoid re-loading on every render
  const [hasLoadedFullDocument, setHasLoadedFullDocument] = useState(false)
  
  // Ref to the editor's scrollable container for TOC scrolling
  const editorContainerRef = useRef<HTMLDivElement>(null)
  
  // Track which nodes have been initialized to prevent duplicates
  const initializedNodesRef = useRef<Set<string>>(new Set())

  // Re-initialize sections when structure items change
  useEffect(() => {
    if (isOpen && storyStructureNodeId && structureItems.length > 0) {
      const nodeKey = storyStructureNodeId
      
      // If sections is empty, initialize all sections (but only once per node)
      if (sections.length === 0) {
        if (!initializedNodesRef.current.has(nodeKey)) {
          console.log('🚀 No sections exist, initializing all sections for node:', nodeKey)
          initializedNodesRef.current.add(nodeKey)
          initializeSections()
        } else {
          console.log('⏭️ Skipping initialization - already attempted for node:', nodeKey)
        }
        return
      }
      
      // Check if structure items have changed (added/removed)
      const structureItemIds = new Set(structureItems.map(item => item.id))
      const sectionItemIds = new Set(sections.map(s => s.structure_item_id))
      
      const hasNewItems = structureItems.some(item => !sectionItemIds.has(item.id))
      const hasRemovedItems = sections.some(s => !structureItemIds.has(s.structure_item_id))
      
      if (hasNewItems || hasRemovedItems) {
        console.log('🔄 Structure items changed, re-initializing sections...')
        initializeSections()
      }
    }
  }, [isOpen, storyStructureNodeId, structureItems, sections, initializeSections])

  // Get the active section
  const activeSection = activeSectionId
    ? sections.find(s => s.id === activeSectionId)
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
    autoSaveDelay: 999999, // Effectively disable auto-save (manual save only)
    enabled: !!activeSection,
  })

  // Detect test nodes connected to orchestrator
  const connectedTestNode = useMemo(() => {
    // Find orchestrator node (id 'context')
    const orchestratorId = 'context'
    
    // Find edges where target is orchestrator
    const testEdges = canvasEdges.filter(edge => edge.target === orchestratorId)
    
    // Find test nodes among those connected
    for (const edge of testEdges) {
      const sourceNode = canvasNodes.find(n => n.id === edge.source)
      if (sourceNode?.data?.nodeType === 'test') {
        return sourceNode as Node<TestNodeData>
      }
    }
    
    return null
  }, [canvasEdges, canvasNodes])

  // Note: We don't auto-load individual sections - the full document is loaded once
  // and users navigate via TOC scrolling

  // Set active section when sections load
  useEffect(() => {
    if (sections.length > 0 && !activeSectionId) {
      // If initialSectionId is provided, try to find that section
      if (initialSectionId) {
        const targetSection = sections.find(s => s.structure_item_id === initialSectionId)
        if (targetSection) {
          setActiveSectionId(targetSection.id)
          return
        }
      }
      // Otherwise, set the first section as active
      setActiveSectionId(sections[0].id)
    }
  }, [sections, activeSectionId, initialSectionId])

  // Load initial section content
  useEffect(() => {
    if (isOpen && initialSectionId && sections.length > 0) {
      const section = sections.find(s => s.structure_item_id === initialSectionId)
      if (section) {
        handleSectionClick(section)
      }
    }
  }, [isOpen, initialSectionId, sections])


  // Aggregate content hierarchically for a structure item
  const aggregateHierarchicalContent = (itemId: string, includeHeaders: boolean = true): string => {
    const item = structureItems.find(i => i.id === itemId)
    if (!item) return ''
    
    const children = structureItems
      .filter(i => i.parentId === itemId)
      .sort((a, b) => a.order - b.order)
    
    // Build the aggregated content
    const aggregatedContent: string[] = []
    
    // Add header for this item if requested (with anchor ID for TOC linking)
    if (includeHeaders) {
      const headerLevel = Math.min(item.level, 6)
      const headerTag = '#'.repeat(headerLevel)
      const headerText = item.title ? `${item.title}` : item.name
      
      // Add HTML anchor for scroll-to functionality (separate from header for proper parsing)
      const anchorDiv = `<div id="section-${itemId}"></div>`
      aggregatedContent.push(anchorDiv)
      aggregatedContent.push(`${headerTag} ${headerText}`)
    }
    
    // If no children, return the section's own content
    if (children.length === 0) {
      // First try contentMap (from test markdown), then Supabase section
      const contentFromMap = contentMap[itemId]
      if (contentFromMap) {
        aggregatedContent.push(contentFromMap)
        return aggregatedContent.join('\n\n')
      }
      
      const section = sections.find(s => s.structure_item_id === itemId)
      if (section?.content) {
        aggregatedContent.push(section.content)
      }
      return aggregatedContent.join('\n\n')
    }
    
    // Include this item's content if it exists (for parent items with children)
    const parentContent = contentMap[itemId]
    if (parentContent) {
      aggregatedContent.push(parentContent)
    }
    
    // Recursively aggregate children (inherit includeHeaders setting)
    for (const child of children) {
      const childContent = aggregateHierarchicalContent(child.id, includeHeaders)
      if (childContent) {
        aggregatedContent.push(childContent)
      }
    }
    
    return aggregatedContent.join('\n\n')
  }

  // Handle section click (from sidebar)
  const handleSectionClick = (section: DocumentSection) => {
    setActiveSectionId(section.id)
    
    // Load aggregated content for this section
    const structureItem = structureItems.find(i => i.id === section.structure_item_id)
    if (structureItem) {
      const aggregatedContent = aggregateHierarchicalContent(structureItem.id)
      if (aggregatedContent) {
        setContent(aggregatedContent)
      }
    }
  }
  
  // Handle segment click (from Narration Arrangement View timeline)
  // Timeline shows focused content (summaries for high-level, full content for low-level)
  const handleSegmentClick = (item: StoryStructureItem) => {
    // For high-level segments (1-3), show summary if available
    // For detailed segments (4+), show full content
    if (item.level <= 3 && item.summary) {
      setContent(`# ${item.name}\n\n**Summary:**\n\n${item.summary}`)
    } else {
      const aggregatedContent = aggregateHierarchicalContent(item.id)
      
      if (aggregatedContent) {
        setContent(aggregatedContent)
      } else {
        console.warn('⚠️ No content found for segment:', item.name)
        setContent(`_No content yet for ${item.name}_`)
      }
    }
    
    setActiveSectionId(item.id)
    
    // Set orchestrator context when segment is clicked
    if (onSetContext) {
      onSetContext({
        type: 'segment',
        id: item.id,
        name: item.name,
        title: item.title,
        level: item.level,
        description: item.description
      })
    }
  }

  // Handle generating content from test node
  const handleGenerateFromTest = () => {
    if (!connectedTestNode || !structureItems.length) return
    
    const markdown = connectedTestNode.data.markdown || ''
    
    // Display the full markdown for testing
    setContent(markdown)
  }

  // Toggle section expansion
  const toggleSectionExpansion = (itemId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }

  // Handle adding a new section
  const handleAddSection = () => {
    if (!newSectionName.trim() || !storyStructureNodeId) return

    // Determine level based on parent
    let level = 1
    let parentId = newSectionParentId
    
    if (parentId) {
      const parent = structureItems.find(item => item.id === parentId)
      if (parent) {
        level = parent.level + 1
      }
    }

    // Calculate order (add after siblings or at end)
    const siblings = structureItems.filter(item => item.parentId === parentId)
    const order = siblings.length > 0 
      ? Math.max(...siblings.map(s => s.order)) + 1 
      : structureItems.length

    // Create new structure item
    const newItemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newItem: StoryStructureItem = {
      id: newItemId,
      level,
      name: newSectionName.trim(),
      title: newSectionTitle.trim() || undefined,
      description: '',
      order,
      completed: false,
      content: '',
      parentId: parentId || undefined,
    }

    // Update structure items in parent
    const updatedItems = [...structureItems, newItem]
    
    if (onUpdateStructure && storyStructureNodeId) {
      onUpdateStructure(storyStructureNodeId, updatedItems)
    }
    
    // Close modal and reset form
    setShowAddSectionModal(false)
    setNewSectionName('')
    setNewSectionTitle('')
    setNewSectionParentId(null)
  }

  // Open add section modal with default parent (Cover if exists)
  const openAddSectionModal = () => {
    // Find Cover section (default parent)
    const coverItem = structureItems.find(item => 
      item.name.toLowerCase() === 'cover' || item.level === 1
    )
    
    setNewSectionParentId(coverItem?.id || null)
    setShowAddSectionModal(true)
  }

  // Render enhanced section tree with add/edit capabilities
  const renderSectionTree = () => {
    if (sectionsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-sm text-gray-400">Loading sections...</div>
        </div>
      )
    }

    if (sectionsError) {
      return (
        <div className="p-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-700">{sectionsError}</div>
          </div>
        </div>
      )
    }

    // Build hierarchical structure
    const buildTree = (items: typeof structureItems, parentId?: string): typeof structureItems => {
      return items
        .filter(item => item.parentId === parentId)
        .sort((a, b) => a.order - b.order)
    }

    const renderTreeLevel = (items: typeof structureItems, level: number = 0) => {
      return items.map((item) => {
        const section = sections.find(s => s.structure_item_id === item.id)
        const children = buildTree(structureItems, item.id)
        const hasChildren = children.length > 0
        const isExpanded = expandedSections.has(item.id)
        const isActive = section?.id === activeSectionId

        return (
          <div key={item.id}>
            {/* Section Item Row */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer group ${
                isActive
                  ? 'bg-yellow-50 text-yellow-900'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
              {/* Chevron (if has children) */}
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSectionExpansion(item.id)
                  }}
                  className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
                >
                  <svg
                    className={`w-3 h-3 text-gray-500 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <div className="w-4 h-4 flex-shrink-0" />
              )}

              {/* Document Icon */}
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>

              {/* Section Name & Title */}
              <button
                onClick={() => {
                  // Sidebar acts as table of contents
                  const sectionId = `section-${item.id}`
                  const container = editorContainerRef.current
                  
                  // Helper function to scroll to the section
                  const scrollToSection = () => {
                    const element = document.getElementById(sectionId)
                    if (element && container) {
                      const containerRect = container.getBoundingClientRect()
                      const elementRect = element.getBoundingClientRect()
                      const offsetTop = elementRect.top - containerRect.top + container.scrollTop - 20
                      
                      container.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                      })
                      return true
                    }
                    return false
                  }
                  
                  // Try to scroll immediately
                  const scrolled = scrollToSection()
                  
                  // If the element wasn't found, reload the full document first
                  if (!scrolled) {
                    const rootItems = structureItems.filter(i => i.level === 1).sort((a, b) => a.order - b.order)
                    const fullDocContent = rootItems.map(rootItem => 
                      aggregateHierarchicalContent(rootItem.id, true)
                    ).join('\n\n')
                    
                    setContent(fullDocContent)
                    
                    // Wait for React to update the DOM, then scroll
                    setTimeout(() => {
                      scrollToSection()
                    }, 100)
                  }
                }}
                className="flex-1 text-left text-sm truncate min-w-0 px-1"
              >
                <span className="font-normal">{item.name}</span>
                {item.title && (
                  <span className="text-xs text-gray-400 ml-1">• {item.title}</span>
                )}
              </button>

              {/* Word Count */}
              <div className="flex-shrink-0 text-xs text-gray-400 font-mono pr-1">
                {section?.word_count || 0}w
              </div>

              {/* Status Indicator */}
              <div
                className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
                  section?.status === 'completed'
                    ? 'bg-green-500'
                    : section?.status === 'in_progress'
                    ? 'bg-yellow-500'
                    : 'bg-gray-300'
                }`}
                title={section?.status || 'draft'}
              />
            </div>

            {/* Render children (if expanded) */}
            {hasChildren && isExpanded && (
              <div>
                {renderTreeLevel(children, level + 1)}
              </div>
            )}
          </div>
        )
      })
    }

    const rootItems = buildTree(structureItems, undefined)

    if (rootItems.length === 0) {
      return (
        <div className="p-8 text-center">
          <div className="text-gray-400 text-sm mb-4">No sections yet</div>
          <button
            onClick={openAddSectionModal}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg text-sm font-medium transition-colors"
          >
            + Add First Section
          </button>
        </div>
      )
    }

    return (
      <div className="py-1">
        {renderTreeLevel(rootItems, 0)}
        
        {/* Add Section Button at bottom */}
        <button
          onClick={openAddSectionModal}
          className="w-full mt-2 mx-2 p-2.5 border-2 border-dashed border-gray-300 hover:border-yellow-400 hover:bg-yellow-50 rounded-md text-sm text-gray-500 hover:text-yellow-900 transition-all"
        >
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium">Add Section</span>
          </div>
        </button>
      </div>
    )
  }

  // Render Add Section Modal
  const renderAddSectionModal = () => {
    if (!showAddSectionModal) return null

    // Get parent section display name
    const getParentDisplayName = (parentId: string | null) => {
      if (!parentId) return 'Top Level'
      const parent = structureItems.find(item => item.id === parentId)
      return parent ? parent.name : 'Top Level'
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowAddSectionModal(false)}>
        <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Section</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Section
              </label>
              <select
                value={newSectionParentId || ''}
                onChange={(e) => setNewSectionParentId(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
              >
                <option value="">Top Level (No Parent)</option>
                {structureItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {'  '.repeat(item.level - 1)}└─ {item.name}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500 mt-1">
                Will be added under: <span className="font-medium">{getParentDisplayName(newSectionParentId)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Introduction, Chapter 1, Act 1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSectionName.trim()) {
                    handleAddSection()
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title (optional)
              </label>
              <input
                type="text"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                placeholder="e.g., The Beginning, Once Upon a Time"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSectionName.trim()) {
                    handleAddSection()
                  }
                }}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowAddSectionModal(false)
                setNewSectionName('')
                setNewSectionTitle('')
                setNewSectionParentId(null)
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSection}
              disabled={!newSectionName.trim()}
              className="flex-1 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Section
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Load full document when panel opens (after aggregateHierarchicalContent is defined)
  useEffect(() => {
    if (isOpen && structureItems.length > 0 && Object.keys(contentMap).length > 0 && !hasLoadedFullDocument) {
      // Build the complete document from all root-level structure items
      const rootItems = structureItems.filter(item => !item.parentId)
      const fullDocument = rootItems
        .sort((a, b) => a.order - b.order)
        .map(item => aggregateHierarchicalContent(item.id, true))
        .filter(Boolean)
        .join('\n\n')
      
      if (fullDocument) {
        setContent(fullDocument)
        setHasLoadedFullDocument(true)
      } else {
        console.warn('⚠️ No full document content generated')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, structureItems, contentMap, hasLoadedFullDocument, setContent])

  // Reset loaded flag when panel closes
  useEffect(() => {
    if (!isOpen) {
      setHasLoadedFullDocument(false)
    }
  }, [isOpen])

  // Save status indicator

  return (
    <>
      {/* Document Panel - Glides out from orchestrator, grips to its left edge */}
      <div
        className={`fixed top-16 bottom-0 bg-white border-r border-t border-gray-200 shadow-xl z-40 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
        }`}
        style={{
          left: 0,
          right: `${orchestratorPanelWidth}px`,
        }}
      >
        {/* Header with Tabs */}
        <div className="border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          {/* Top Bar - Title and Actions */}
          <div className="h-10 flex items-center justify-between px-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900">Document View</h2>
              <div className="text-xs text-gray-500 font-mono">{wordCount} words</div>
            </div>
            <div className="flex items-center gap-2">
              {/* Save Button */}
              <button
                onClick={saveNow}
                disabled={!isDirty || saveStatus === 'saving'}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isDirty
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                } ${saveStatus === 'saving' ? 'opacity-50' : ''}`}
              >
                {saveStatus === 'saving' ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                aria-label="Hide document view"
                title="Hide document view"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs Bar */}
          {storyStructureNodes.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 overflow-x-auto">
              {storyStructureNodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => onSwitchDocument && onSwitchDocument(node.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    node.id === storyStructureNodeId
                      ? 'bg-yellow-100 text-yellow-900 border border-yellow-300'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  title={node.name}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="max-w-[150px] truncate">{node.name}</span>
                  {node.format && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded uppercase">
                      {node.format}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Split Content with Arrangement View */}
        <div className="flex flex-col" style={{ height: `calc(100vh - ${storyStructureNodes.length > 0 ? '9rem' : '7.5rem'})` }}>
          {/* Document Editor + Section Nav */}
          <div className="flex flex-1 min-h-0" ref={containerRef}>
          <div className="flex flex-col bg-white relative w-full">
            <div className="flex h-full">
              {/* Section Navigation Sidebar */}
              {!isSidebarCollapsed && (
                <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Sections</h3>
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
                  <div className="flex-1 overflow-y-auto">{renderSectionTree()}</div>
                </div>
              )}

              {/* Editor Area */}
              <div className="flex-1 flex flex-col relative bg-gray-100">
                {/* Grid Background */}
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
                
                {/* Scrollable Container with Document */}
                <div ref={editorContainerRef} className="flex-1 overflow-y-auto relative z-10 p-8">
                  {/* Document Container - Like a real paper with shadow */}
                  <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-lg">
                    <MarkdownEditor
                      content={content}
                      onUpdate={handleEditorUpdate}
                      placeholder="Click to start writing..."
                      className="min-h-[calc(100vh-8rem)]"
                    />
                  </div>
                </div>

                {/* Sidebar Expand Button (when collapsed) */}
                {isSidebarCollapsed && (
                  <button
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="absolute top-4 left-0 p-2 bg-white border border-gray-200 rounded-r-lg hover:bg-gray-50 transition-colors shadow-sm z-20"
                    title="Show sections"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
          
          {/* Bottom: Narration Arrangement View */}
          <NarrationArrangementView
            sections={sections}
            structureItems={structureItems}
            activeSectionId={activeSectionId}
            onSectionClick={handleSectionClick}
            onItemClick={handleSegmentClick}
            format={structureItems[0]?.level === 1 ? 'screenplay' : undefined} // TODO: Derive format properly
            isCollapsed={isArrangementCollapsed}
            onToggleCollapse={() => setIsArrangementCollapsed(!isArrangementCollapsed)}
            canvasEdges={canvasEdges}
            canvasNodes={canvasNodes}
          />
        </div>
      </div>

      {/* Add Section Modal */}
      {renderAddSectionModal()}
    </>
  )
}
