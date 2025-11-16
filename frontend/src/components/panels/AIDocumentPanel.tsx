'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useDocumentSections } from '@/hooks/useDocumentSections'
import { useDocumentEditor } from '@/hooks/useDocumentEditor'
import EditorToolbar from '../editor/EditorToolbar'
import NarrationArrangementView from '../document/NarrationArrangementView'
import type { StoryStructureItem, TestNodeData } from '@/types/nodes'
import type { Editor } from '@tiptap/react'
import type { DocumentSection } from '@/types/document'
import type { ProseMirrorEditorProps, ProseMirrorEditorRef } from '../editor/ProseMirrorEditor'
import type { Edge, Node } from 'reactflow'

// Dynamically import ProseMirrorEditor to avoid SSR issues
const ProseMirrorEditor = dynamic<ProseMirrorEditorProps>(
  () => import('../editor/ProseMirrorEditor'),
  { 
    ssr: false, 
    loading: () => <div className="flex items-center justify-center h-full"><div className="text-gray-400">Loading editor...</div></div>
  }
)

interface Task {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'completed'
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  tasks?: Task[]
  isThinkingCollapsed?: boolean
  hasAutoCollapsed?: boolean
}

interface AIDocumentPanelProps {
  isOpen: boolean
  onClose: () => void
  initialPrompt?: string
  storyStructureNodeId?: string | null
  structureItems?: StoryStructureItem[]
  initialSectionId?: string | null
  onUpdateStructure?: (nodeId: string, updatedItems: StoryStructureItem[]) => void
  canvasEdges?: Edge[]
  canvasNodes?: Node[]
}

export default function AIDocumentPanel({
  isOpen,
  onClose,
  initialPrompt,
  storyStructureNodeId = null,
  structureItems = [],
  initialSectionId = null,
  onUpdateStructure,
  canvasEdges = [],
  canvasNodes = [],
}: AIDocumentPanelProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [leftPanelWidth, setLeftPanelWidth] = useState(35) // Percentage (for right-side chat, editor gets 100 - this)
  const [isDragging, setIsDragging] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [newSectionParentId, setNewSectionParentId] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [isArrangementCollapsed, setIsArrangementCollapsed] = useState(true) // Collapsed by default

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const hasProcessedInitialPrompt = useRef(false)

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

  // Re-initialize sections when structure items change
  useEffect(() => {
    if (isOpen && storyStructureNodeId && structureItems.length > 0 && sections.length > 0) {
      // Check if structure items have changed (added/removed)
      const structureItemIds = new Set(structureItems.map(item => item.id))
      const sectionItemIds = new Set(sections.map(s => s.structure_item_id))
      
      const hasNewItems = structureItems.some(item => !sectionItemIds.has(item.id))
      const hasRemovedItems = sections.some(s => !structureItemIds.has(s.structure_item_id))
      
      if (hasNewItems || hasRemovedItems) {
        console.log('Structure items changed, re-syncing sections...')
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

  // Update content when active section changes (without remounting editor)
  useEffect(() => {
    if (activeSection) {
      setContent(activeSection.content)
    }
  }, [activeSection?.id, activeSection?.content, setContent])
  
  // Note: We deliberately don't include 'content' from editor state in deps
  // to avoid resetting the editor while the user is typing

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-collapse thinking box when all tasks are completed
  useEffect(() => {
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && msg.tasks && !msg.isThinkingCollapsed && !msg.hasAutoCollapsed) {
        const allCompleted = msg.tasks.every(task => task.status === 'completed')
        if (allCompleted) {
          setTimeout(() => {
            setMessages(prev =>
              prev.map((m, i) =>
                i === idx ? { ...m, isThinkingCollapsed: true, hasAutoCollapsed: true } : m
              )
            )
          }, 1000)
        }
      }
    })
  }, [messages])

  const toggleThinkingCollapse = (messageIndex: number) => {
    setMessages(prev =>
      prev.map((msg, idx) =>
        idx === messageIndex
          ? {
              ...msg,
              isThinkingCollapsed: !msg.isThinkingCollapsed,
            }
          : msg
      )
    )
  }

  // Handle initial prompt when panel opens
  useEffect(() => {
    if (isOpen && initialPrompt && !hasProcessedInitialPrompt.current) {
      hasProcessedInitialPrompt.current = true
      setMessages([{ role: 'user', content: initialPrompt }])

      // Simulate AI planning (would be real AI later)
      setTimeout(() => {
        const aiResponse: Message = {
          role: 'assistant',
          content: "I'll help you with that. Here's my reasoning process:",
          isThinkingCollapsed: false,
          hasAutoCollapsed: false,
          tasks: [
            { id: '1', text: 'Understanding the prompt and extracting key requirements', status: 'in_progress' },
            { id: '2', text: 'Breaking down the task into logical components', status: 'pending' },
            { id: '3', text: 'Identifying the narrative structure and tone', status: 'pending' },
            { id: '4', text: 'Drafting initial content with key points', status: 'pending' },
          ],
        }
        setMessages(prev => [...prev, aiResponse])

        // Simulate task progression
        setTimeout(() => {
          setMessages(prev =>
            prev.map((msg, idx) =>
              idx === prev.length - 1 && msg.tasks
                ? {
                    ...msg,
                    tasks: msg.tasks.map(task =>
                      task.id === '1' ? { ...task, status: 'completed' } : task.id === '2' ? { ...task, status: 'in_progress' } : task
                    ),
                  }
                : msg
            )
          )
        }, 1200)

        setTimeout(() => {
          setMessages(prev =>
            prev.map((msg, idx) =>
              idx === prev.length - 1 && msg.tasks
                ? {
                    ...msg,
                    tasks: msg.tasks.map(task =>
                      task.id === '2' ? { ...task, status: 'completed' } : task.id === '3' ? { ...task, status: 'in_progress' } : task
                    ),
                  }
                : msg
            )
          )
        }, 2400)

        setTimeout(() => {
          setMessages(prev =>
            prev.map((msg, idx) =>
              idx === prev.length - 1 && msg.tasks
                ? {
                    ...msg,
                    tasks: msg.tasks.map(task =>
                      task.id === '3' ? { ...task, status: 'completed' } : task.id === '4' ? { ...task, status: 'in_progress' } : task
                    ),
                  }
                : msg
            )
          )
        }, 3600)

        setTimeout(() => {
          setMessages(prev =>
            prev.map((msg, idx) =>
              idx === prev.length - 1 && msg.tasks
                ? {
                    ...msg,
                    tasks: msg.tasks.map(task => (task.id === '4' ? { ...task, status: 'completed' } : task)),
                  }
                : msg
            )
          )
        }, 4800)
      }, 800)
    }

    if (!isOpen) {
      hasProcessedInitialPrompt.current = false
      setMessages([])
    }
  }, [isOpen, initialPrompt])

  // Sections are initialized automatically by the hook, no need to call here

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

  // Scroll to initial section
  useEffect(() => {
    if (isOpen && initialSectionId && editor && sections.length > 0) {
      setTimeout(() => {
        const structureItem = structureItems.find(item => item.id === initialSectionId)
        if (structureItem) {
          const element = editor.view.dom.querySelector(`[data-section-id="${initialSectionId}"]`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }
      }, 500)
    }
  }, [isOpen, initialSectionId, editor, structureItems, sections])

  // Handle mouse drag for resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const mousePercent = ((e.clientX - containerRect.left) / containerRect.width) * 100
    
    // Since editor is on left and chat on right, leftPanelWidth represents right chat width
    // So we need to invert: if mouse is at 60%, chat width should be 40%
    const newChatWidth = 100 - mousePercent

    // Constrain chat between 25% and 50% (editor gets 50% to 75%)
    if (newChatWidth >= 25 && newChatWidth <= 50) {
      setLeftPanelWidth(newChatWidth)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = input
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')

    // Simulate AI response (would be real AI later)
    setTimeout(() => {
      const timestamp = Date.now()
      const aiResponse: Message = {
        role: 'assistant',
        content: 'Thinking through your request...',
        isThinkingCollapsed: false,
        hasAutoCollapsed: false,
        tasks: [
          { id: `${timestamp}-1`, text: 'Analyzing the context of your input', status: 'in_progress' },
          { id: `${timestamp}-2`, text: 'Determining the best approach for this task', status: 'pending' },
          { id: `${timestamp}-3`, text: 'Composing and refining the output', status: 'pending' },
        ],
      }
      setMessages(prev => [...prev, aiResponse])

      // Simulate task progression
      setTimeout(() => {
        setMessages(prev =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 && msg.tasks
              ? {
                  ...msg,
                  tasks: msg.tasks.map(task =>
                    task.id === `${timestamp}-1` ? { ...task, status: 'completed' } : task.id === `${timestamp}-2` ? { ...task, status: 'in_progress' } : task
                  ),
                }
              : msg
          )
        )
      }, 1000)

      setTimeout(() => {
        setMessages(prev =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 && msg.tasks
              ? {
                  ...msg,
                  tasks: msg.tasks.map(task =>
                    task.id === `${timestamp}-2` ? { ...task, status: 'completed' } : task.id === `${timestamp}-3` ? { ...task, status: 'in_progress' } : task
                  ),
                }
              : msg
          )
        )
      }, 2200)

      setTimeout(() => {
        setMessages(prev =>
          prev.map((msg, idx) =>
            idx === prev.length - 1 && msg.tasks
              ? {
                  ...msg,
                  tasks: msg.tasks.map(task => (task.id === `${timestamp}-3` ? { ...task, status: 'completed' } : task)),
                }
              : msg
          )
        )
      }, 3400)
    }, 500)
  }

  // Aggregate content hierarchically for a structure item
  const aggregateHierarchicalContent = (itemId: string): string => {
    const item = structureItems.find(i => i.id === itemId)
    if (!item) return ''
    
    const children = structureItems
      .filter(i => i.parentId === itemId)
      .sort((a, b) => a.order - b.order)
    
    // If no children, return the section's own content
    if (children.length === 0) {
      const section = sections.find(s => s.structure_item_id === itemId)
      return section?.content || ''
    }
    
    // Aggregate children with headers
    const aggregatedContent: string[] = []
    
    for (const child of children) {
      const childSection = sections.find(s => s.structure_item_id === child.id)
      const childContent = aggregateHierarchicalContent(child.id)
      
      if (childContent) {
        // Add header based on level
        const headerLevel = Math.min(child.level, 6) // HTML only supports h1-h6
        const headerTag = '#'.repeat(headerLevel)
        const headerText = child.title ? `${child.name}: ${child.title}` : child.name
        
        aggregatedContent.push(`${headerTag} ${headerText}\n\n${childContent}`)
      }
    }
    
    return aggregatedContent.join('\n\n')
  }

  // Handle section click
  const handleSectionClick = (section: DocumentSection) => {
    setActiveSectionId(section.id)
    
    // Load aggregated content for this section
    const structureItem = structureItems.find(i => i.id === section.structure_item_id)
    if (structureItem) {
      const aggregatedContent = aggregateHierarchicalContent(structureItem.id)
      if (aggregatedContent && editor) {
        editor.commands.setContent(aggregatedContent)
      }
    }
    
    if (editor) {
      const element = editor.view.dom.querySelector(`[data-section-id="${section.structure_item_id}"]`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // Handle generating content from test node
  const handleGenerateFromTest = () => {
    if (!connectedTestNode || !structureItems.length) return
    
    const markdown = connectedTestNode.data.markdown || ''
    
    // Parse markdown and aggregate hierarchical content
    // For now, we'll display the full markdown for testing
    // In the future, this will be parsed by structure level
    if (editor) {
      editor.commands.setContent(markdown)
    }
    
    console.log('📄 Generating from test markdown:', {
      testNodeId: connectedTestNode.id,
      markdownLength: markdown.length,
      structureItemsCount: structureItems.length,
    })
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
                onClick={() => section && handleSectionClick(section)}
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

  // Save status indicator

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Split Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full bg-white shadow-2xl z-50 transform transition-transform duration-500 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">AI Document Assistant</h2>
            <div className="text-sm text-gray-500">{wordCount} words</div>
          </div>
          <div className="flex items-center gap-3">
            {/* Generate from Test Format Button - only shown when test node is connected */}
            {connectedTestNode && (
              <button
                onClick={handleGenerateFromTest}
                className="px-4 py-2 rounded-full text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white transition-all"
                title="Generate content from connected test node"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Generate from Test</span>
                </div>
              </button>
            )}
            
            {/* Save Button */}
            <button
              onClick={saveNow}
              disabled={!isDirty || saveStatus === 'saving'}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isDirty
                  ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              } ${saveStatus === 'saving' ? 'opacity-50' : ''}`}
            >
              {saveStatus === 'saving' ? (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Saving...</span>
                </div>
              ) : isDirty ? (
                'Save Changes'
              ) : (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Saved</span>
                </div>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Split Content with Arrangement View */}
        <div className="flex flex-col h-[calc(100vh-4rem)]">
          {/* Top: Existing split view (Editor + Chat) */}
          <div className="flex flex-1 min-h-0" ref={containerRef}>
          {/* Left Side - Document Editor + Section Nav */}
          <div className="flex flex-col bg-white" style={{ width: `${100 - leftPanelWidth}%` }}>
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
              <div className="flex-1 flex flex-col">
                {/* Toolbar */}
                <EditorToolbar editor={editor} />

                {/* Editor */}
                <ProseMirrorEditor
                  content={content}
                  onUpdate={handleEditorUpdate}
                  onEditorReady={setEditor}
                  placeholder="Start writing..."
                  className="flex-1"
                />

                {/* Sidebar Expand Button (when collapsed) */}
                {isSidebarCollapsed && (
                  <button
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="absolute top-20 left-0 p-2 bg-white border border-gray-200 rounded-r-lg hover:bg-gray-50 transition-colors shadow-sm"
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

          {/* Resize Handle */}
          <div
            className={`relative w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors group ${
              isDragging ? 'bg-blue-500' : ''
            }`}
            onMouseDown={handleMouseDown}
          >
            {/* Center Handle Bar */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-12 bg-gray-300 group-hover:bg-blue-500 rounded-full flex items-center justify-center shadow-md transition-colors">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          </div>

          {/* Right Side - AI Chat */}
          <div
            className="border-l border-gray-200 flex flex-col bg-gray-50 relative overflow-hidden"
            style={{ width: `${leftPanelWidth}%` }}
          >
            {/* Grid background */}
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundImage: `
                linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
              `,
                backgroundSize: '24px 24px',
              }}
            />

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <p className="text-sm">Chat with AI to build your document</p>
                    <p className="text-xs mt-2 text-gray-300">(AI integration coming soon)</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div key={index} className="space-y-3">
                      {message.role === 'user' ? (
                        <div className="bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
                          <p className="text-sm text-gray-900">{message.content}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700 mb-3">{message.content}</p>

                          {/* Thinking Process Box */}
                          {message.tasks && message.tasks.length > 0 && (
                            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                              {/* Header */}
                              <button
                                onClick={() => toggleThinkingCollapse(index)}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-200 transition-colors"
                              >
                                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Thinking Process</span>
                                <svg
                                  className={`w-4 h-4 text-gray-500 transition-transform ${
                                    message.isThinkingCollapsed ? 'rotate-0' : 'rotate-180'
                                  }`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {/* Task List */}
                              {!message.isThinkingCollapsed && (
                                <div className="px-4 pb-3 space-y-2">
                                  {message.tasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-3 group">
                                      {/* Status Icon */}
                                      <div className="flex-shrink-0 w-5 h-5">
                                        {task.status === 'completed' ? (
                                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2.5}
                                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                          </svg>
                                        ) : task.status === 'in_progress' ? (
                                          <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                            <path
                                              className="opacity-75"
                                              fill="currentColor"
                                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                          </svg>
                                        ) : (
                                          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="9" strokeWidth="2" />
                                          </svg>
                                        )}
                                      </div>

                                      {/* Task Text */}
                                      <p
                                        className={`text-sm flex-1 px-3 py-1.5 rounded bg-white/20 backdrop-blur-sm ${
                                          task.status === 'completed'
                                            ? 'text-gray-600 line-through'
                                            : task.status === 'in_progress'
                                            ? 'text-gray-900 font-medium'
                                            : 'text-gray-500'
                                        }`}
                                      >
                                        {task.text}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-200 relative z-10">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="What's your story, Morning Glory?"
                  maxLength={1000}
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm placeholder:text-gray-400"
                  aria-label="Message input"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-200 disabled:cursor-not-allowed rounded-xl transition-colors"
                  aria-label="Send message"
                >
                  <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
          </div>
          
          {/* Bottom: Narration Arrangement View */}
          <NarrationArrangementView
            sections={sections}
            structureItems={structureItems}
            activeSectionId={activeSectionId}
            onSectionClick={handleSectionClick}
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
