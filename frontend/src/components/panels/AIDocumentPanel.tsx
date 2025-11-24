'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useDocumentSectionsAdapter as useDocumentSections } from '@/hooks/useDocumentSectionsAdapter'
import { useDocumentEditor } from '@/hooks/useDocumentEditor'
import MarkdownEditor from '../editor/MarkdownEditor'
import SectionTreeView from '../document/SectionTreeView'
import NarrationCardView from '../document/NarrationCardView'
import DocumentCardView from '../document/DocumentCardView'
import SidebarViewToggle, { type SidebarView } from '../document/SidebarViewToggle'
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
  
  // Update active section when initialSectionId changes (e.g., orchestrator opens a specific section)
  useEffect(() => {
    if (initialSectionId) {
      setActiveSectionId(initialSectionId)
    }
  }, [initialSectionId])
  
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
  
  // Persist sidebar view (tree vs narration)
  const [sidebarView, setSidebarView] = useState<SidebarView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('publo-sidebar-view')
      return (saved as SidebarView) || 'tree'
    }
    return 'tree'
  })
  
  // Theme colors for cards (persisted per document)
  const [themeColors, setThemeColors] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined' && storyStructureNodeId) {
      const saved = localStorage.getItem(`publo-theme-colors-${storyStructureNodeId}`)
      return saved ? JSON.parse(saved) : {}
    }
    return {}
  })
  
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionParentId, setNewSectionParentId] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

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
    // ✅ CRITICAL FIX: Only call onSectionsLoaded if sections have meaningfully changed
    // Compare a hash of section IDs and content lengths to detect real changes
    const sectionsHash = sections
      .map(s => `${s.id}:${s.content?.length || 0}`)
      .join('|')
    
    console.log('🔍 AIDocumentPanel sections check:', {
      sectionsLength: sections.length,
      hasCallback: !!onSectionsLoaded,
      currentHash: sectionsHash.substring(0, 100),
      prevHash: prevSectionsRef.current.substring(0, 100),
      hasChanged: sectionsHash !== prevSectionsRef.current
    })
    
    if (sections.length > 0 && onSectionsLoaded && sectionsHash !== prevSectionsRef.current) {
      console.log('📞 Calling onSectionsLoaded with', sections.length, 'sections (content changed)')
      prevSectionsRef.current = sectionsHash
      onSectionsLoaded(sections)
    } else if (sectionsHash === prevSectionsRef.current) {
      console.log('⏭️ Skipping onSectionsLoaded - sections unchanged')
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
  
  // Persist sidebar view (tree vs narration)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('publo-sidebar-view', sidebarView)
    }
  }, [sidebarView])
  
  // Persist theme colors
  useEffect(() => {
    if (typeof window !== 'undefined' && storyStructureNodeId) {
      localStorage.setItem(`publo-theme-colors-${storyStructureNodeId}`, JSON.stringify(themeColors))
    }
  }, [themeColors, storyStructureNodeId])

  // Track if full document has been loaded to avoid re-loading on every render
  const [hasLoadedFullDocument, setHasLoadedFullDocument] = useState(false)
  
  // Ref to the editor's scrollable container for TOC scrolling
  const editorContainerRef = useRef<HTMLDivElement>(null)
  
  // Track which nodes have been initialized to prevent duplicates
  const initializedNodesRef = useRef<Set<string>>(new Set())
  
  // ✅ CRITICAL FIX: Track previous sections to prevent infinite loop
  const prevSectionsRef = useRef<string>('')
  
  // Clear initialization tracking when document closes
  useEffect(() => {
    if (!isOpen) {
      console.log('🧹 Document panel closed - clearing initialization tracking')
      initializedNodesRef.current.clear()
      prevSectionsRef.current = ''
    }
  }, [isOpen])

  // Re-initialize sections when structure items change
  useEffect(() => {
    console.log('📋 [AIDocumentPanel] Section initialization check:', {
      isOpen,
      storyStructureNodeId,
      structureItemsLength: structureItems.length,
      sectionsLength: sections.length,
      alreadyInitialized: storyStructureNodeId ? initializedNodesRef.current.has(storyStructureNodeId) : false
    })
    
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
          console.log('   If sections are still empty, there may be an RLS or database issue')
        }
        return
      }
      
      // Check if structure items have changed (added/removed)
      const structureItemIds = new Set(structureItems.map(item => item.id))
      const sectionItemIds = new Set(sections.map(s => s.structure_item_id))
      
      const hasNewItems = structureItems.some(item => !sectionItemIds.has(item.id))
      const hasRemovedItems = sections.some(s => !structureItemIds.has(s.structure_item_id))
      
      if (hasNewItems || hasRemovedItems) {
        console.log('🔄 Structure items changed, re-initializing sections...', {
          hasNewItems,
          hasRemovedItems,
          newItemsCount: hasNewItems ? structureItems.filter(item => !sectionItemIds.has(item.id)).length : 0
        })
        initializeSections()
      } else {
        console.log('✅ Sections in sync with structure items (no changes needed)')
      }
    }
  }, [isOpen, storyStructureNodeId, structureItems, sections, initializeSections])

  // Get the active section
  // activeSectionId is a structure_item_id, not a section.id
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

  // Set active section from structure items (not requiring Supabase sections)
  useEffect(() => {
    if (structureItems.length > 0 && !activeSectionId) {
      // Use structure item ID directly (works like Word's navigation)
      if (initialSectionId) {
        setActiveSectionId(initialSectionId)
        return
      }
      // Otherwise, set the first structure item as active
      setActiveSectionId(structureItems[0].id)
    }
  }, [structureItems, activeSectionId, initialSectionId])

  // Handle section navigation (when orchestrator or user wants to jump to a section)
  useEffect(() => {
    if (isOpen && initialSectionId && structureItems.length > 0) {
      console.log('🧭 [AIDocumentPanel] Navigating to section:', {
        initialSectionId,
        currentActiveSectionId: activeSectionId,
        willUpdate: initialSectionId !== activeSectionId
      })
      // Always update to the requested section (even if one is already active)
      if (initialSectionId !== activeSectionId) {
        setActiveSectionId(initialSectionId)
      }
    }
  }, [isOpen, initialSectionId, structureItems, activeSectionId])

  // Notify parent when active section changes (update context for orchestrator)
  useEffect(() => {
    if (activeSectionId && onSetContext) {
      const activeItem = structureItems.find(i => i.id === activeSectionId)
      if (activeItem) {
        console.log('📍 [AIDocumentPanel] Setting context for active section:', {
          id: activeSectionId,
          name: activeItem.name
        })
        onSetContext({
          type: 'section',
          id: activeSectionId,
          name: activeItem.name,
          title: activeItem.title,
          level: activeItem.level
        })
      }
    }
  }, [activeSectionId, structureItems, onSetContext])


  // Scroll to section when active section changes (e.g., via orchestrator navigation)
  useEffect(() => {
    if (activeSectionId && editorContainerRef.current) {
      const sectionId = `section-${activeSectionId}`
      const container = editorContainerRef.current
      
      // Helper function to scroll to the section
      const scrollToSection = () => {
        const element = document.getElementById(sectionId)
        if (element && container) {
          console.log('📜 [AIDocumentPanel] Scrolling to section:', activeSectionId)
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
      
      // If element not found, wait a bit for the document to render, then retry
      if (!scrolled) {
        console.log('⏳ [AIDocumentPanel] Section not found yet, waiting for render...')
        setTimeout(() => {
          const retried = scrollToSection()
          if (!retried) {
            console.warn('⚠️ [AIDocumentPanel] Section element not found after retry:', sectionId)
          }
        }, 200)
      }
    }
  }, [activeSectionId])


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
      
      // Use HTML heading with ID attribute for reliable anchor targeting
      // This ensures the ID survives markdown rendering
      const headingWithId = `<h${headerLevel} id="section-${itemId}" style="scroll-margin-top: 20px;">${headerText}</h${headerLevel}>`
      aggregatedContent.push(headingWithId)
      aggregatedContent.push('') // Add blank line for proper markdown spacing
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
      if (section?.content && section.content.trim()) {
        aggregatedContent.push(section.content)
      } else {
        // Add placeholder for empty sections
        aggregatedContent.push('*[No content yet - Click here to start writing]*')
      }
      return aggregatedContent.join('\n\n')
    }
    
    // Include this item's content if it exists (for parent items with children)
    const parentContent = contentMap[itemId]
    if (parentContent) {
      aggregatedContent.push(parentContent)
    } else {
      // Check if parent has section content
      const parentSection = sections.find(s => s.structure_item_id === itemId)
      if (parentSection?.content) {
        aggregatedContent.push(parentSection.content)
      }
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

  // Handle section click (from sidebar or NarrationArrangementView)
  // Convert Supabase section to structure item and delegate
  const handleSectionClick = (section: DocumentSection) => {
    const structureItem = structureItems.find(i => i.id === section.structure_item_id)
    if (structureItem) {
      handleSegmentClick(structureItem)
    }
  }
  
  // Handle segment click (from Narration Arrangement View timeline or sidebar)
  // Full document is always loaded - just scroll to the section
  const handleSegmentClick = (item: StoryStructureItem) => {
    console.log('📍 [handleSegmentClick] Navigating to section:', item.name)
    
    // Set active section (this will trigger context update and scroll)
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
    
    // Scroll to the section anchor in the full document
    const sectionId = `section-${item.id}`
    const container = editorContainerRef.current
    
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
    
    // If element not found, wait and retry
    if (!scrolled) {
      console.log('⏳ [handleSegmentClick] Section anchor not found, waiting for render...')
      setTimeout(() => {
        const retried = scrollToSection()
        if (!retried) {
          console.warn('⚠️ [handleSegmentClick] Section anchor still not found:', sectionId)
        }
      }, 200)
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
  // Handle color change for cards
  const handleColorChange = (itemId: string, color: string) => {
    setThemeColors(prev => ({
      ...prev,
      [itemId]: color
    }))
  }
  
  // Handle add sub-agent (placeholder)
  const handleAddSubAgent = (itemId: string) => {
    // TODO: Implement sub-agent functionality
    console.log('🤖 Add sub-agent for:', itemId)
    alert('Sub-agent functionality coming soon!')
  }
  
  // Handle edit summary
  const handleEditSummary = (itemId: string) => {
    const item = structureItems.find(i => i.id === itemId)
    if (!item) return
    
    const newSummary = prompt('Edit summary:', item.summary || '')
    if (newSummary !== null && onUpdateStructure && storyStructureNodeId) {
      // Update the structure item with new summary
      const updatedItems = structureItems.map(i =>
        i.id === itemId ? { ...i, summary: newSummary } : i
      )
      onUpdateStructure(storyStructureNodeId, updatedItems)
    }
  }

  const openAddSectionModal = () => {
    // Find Cover section (default parent)
    const coverItem = structureItems.find(item => 
      item.name.toLowerCase() === 'cover' || item.level === 1
    )
    
    setNewSectionParentId(coverItem?.id || null)
    setShowAddSectionModal(true)
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

  // Load full document when in Tree view (not Cards view)
  useEffect(() => {
    // Only load full document in Tree view
    if (isOpen && sidebarView === 'tree' && structureItems.length > 0) {
      console.log('📄 [AIDocumentPanel] Loading full document for Tree view:', {
        structureItemsCount: structureItems.length,
        sectionsCount: sections.length,
        contentMapSize: Object.keys(contentMap).length,
        sections: sections.map(s => ({ id: s.id, structure_item_id: s.structure_item_id, hasContent: !!s.content }))
      })
      
      // Build the complete document from all root-level structure items
      const rootItems = structureItems.filter(item => !item.parentId)
      const fullDocument = rootItems
        .sort((a, b) => a.order - b.order)
        .map(item => {
          const content = aggregateHierarchicalContent(item.id, true)
          console.log(`📝 Content for ${item.name}:`, content.substring(0, 100))
          return content
        })
        .filter(Boolean)
        .join('\n\n---\n\n') // Add visual separators between major sections
      
      if (fullDocument && fullDocument.length > 10) {
        console.log('✅ [AIDocumentPanel] Full document loaded:', fullDocument.length, 'chars')
        setContent(fullDocument)
        setHasLoadedFullDocument(true)
      } else {
        console.warn('⚠️ [AIDocumentPanel] No full document content generated or content is empty')
        // Set placeholder if no content
        setContent('# Document\n\nNo content yet. Click a section to start writing.')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sidebarView, structureItems, sections, contentMap])

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
        <div className="flex flex-col bg-gray-50 border-b border-gray-200">
          {/* Tabs Bar - Cursor Style */}
          {storyStructureNodes.length > 0 && (
            <div className="flex items-center justify-between pr-2">
              {/* Tabs on Left */}
              <div className="flex items-end px-2 pt-2 gap-1 overflow-x-auto scrollbar-hide flex-1">
                {storyStructureNodes.map(node => {
                  const isActive = node.id === storyStructureNodeId
                  return (
                    <button
                      key={node.id}
                      onClick={() => onSwitchDocument && onSwitchDocument(node.id)}
                      className={`
                        group relative flex items-center gap-2 px-4 py-2 text-xs font-medium transition-all whitespace-nowrap rounded-t-lg border-t border-l border-r
                        ${isActive 
                          ? 'bg-white text-gray-900 border-gray-200 border-b-white -mb-px z-10 shadow-sm' 
                          : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200 hover:text-gray-700'
                        }
                      `}
                      title={node.name}
                    >
                      {/* Active Indicator Line (Top) */}
                      {isActive && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500 rounded-t-lg" />
                      )}
                      
                      {/* Document Icon */}
                      <svg 
                        className={`w-3.5 h-3.5 ${isActive ? 'text-purple-500' : 'text-gray-400 group-hover:text-gray-500'}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      
                      <span className="max-w-[150px] truncate">{node.name}</span>
                      
                      {node.format && (
                        <span className={`
                          text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider
                          ${isActive ? 'bg-purple-50 text-purple-700' : 'bg-gray-200 text-gray-500'}
                        `}>
                          {node.format}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Actions on Right */}
              <div className="flex items-center gap-2 pb-1">
                <div className="text-xs text-gray-400 font-mono mr-2">{wordCount} words</div>
                <button
                  onClick={saveNow}
                  disabled={!isDirty || saveStatus === 'saving'}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    isDirty
                      ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  } ${saveStatus === 'saving' ? 'opacity-50' : ''}`}
                >
                  {saveStatus === 'saving' ? 'Saving...' : isDirty ? 'Save' : 'Saved'}
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-500"
                  aria-label="Hide document view"
                  title="Hide document view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Split Content with Arrangement View */}
        <div className="flex flex-col h-[calc(100%-3rem)]">
          {/* Document Editor + Section Nav */}
          <div className="flex flex-1 min-h-0" ref={containerRef}>
          <div className="flex flex-col bg-white relative w-full">
            <div className="flex h-full">
              {/* Section Navigation Sidebar */}
              {!isSidebarCollapsed && (
                <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
                  {/* Sidebar Header with Toggle and Controls */}
                  <div className="p-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <SidebarViewToggle value={sidebarView} onChange={setSidebarView} />
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
                  </div>
                  
                  {/* Sidebar Content */}
                  {sidebarView === 'tree' ? (
                    <SectionTreeView
                      structureItems={structureItems}
                      sections={sections}
                      activeSectionId={activeSectionId}
                      expandedSections={expandedSections}
                      toggleSectionExpansion={toggleSectionExpansion}
                      onSectionClick={setActiveSectionId}
                      editorContainerRef={editorContainerRef}
                      onAddSection={openAddSectionModal}
                    />
                  ) : (
                    <NarrationCardView
                      structureItems={structureItems}
                      activeSectionId={activeSectionId}
                      onSectionClick={setActiveSectionId}
                      onColorChange={handleColorChange}
                      onAddSubAgent={handleAddSubAgent}
                      onEdit={handleEditSummary}
                      themeColors={themeColors}
                    />
                  )}
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
                <div ref={editorContainerRef} className="flex-1 overflow-y-auto relative z-10">
                  {sidebarView === 'narration' ? (
                    /* Card View: Show structure as cards with headers and summaries */
                    <DocumentCardView
                      structureItems={structureItems}
                      activeSectionId={activeSectionId}
                      onSectionClick={setActiveSectionId}
                      onColorChange={handleColorChange}
                      onAddSubAgent={handleAddSubAgent}
                      onEdit={handleEditSummary}
                      themeColors={themeColors}
                    />
                  ) : (
                    /* Tree View: Show full markdown content */
                    <div className="p-8">
                      <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-lg">
                        <MarkdownEditor
                          content={content}
                          onUpdate={handleEditorUpdate}
                          placeholder="Click to start writing..."
                          className="min-h-[calc(100vh-8rem)]"
                        />
                      </div>
                    </div>
                  )}
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
        </div>
      </div>

      {/* Add Section Modal */}
      {renderAddSectionModal()}
    </>
  )
}
