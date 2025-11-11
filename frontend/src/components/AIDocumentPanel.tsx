'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useDocumentSections } from '@/hooks/useDocumentSections'
import { useDocumentEditor } from '@/hooks/useDocumentEditor'
import EditorToolbar from './editor/EditorToolbar'
import type { StoryStructureItem } from '@/types/nodes'
import type { Editor } from '@tiptap/react'
import type { DocumentSection } from '@/types/document'
import type { ProseMirrorEditorProps, ProseMirrorEditorRef } from './editor/ProseMirrorEditor'

// Dynamically import ProseMirrorEditor to avoid SSR issues
const ProseMirrorEditor = dynamic<ProseMirrorEditorProps>(
  () => import('./editor/ProseMirrorEditor'),
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
}

export default function AIDocumentPanel({
  isOpen,
  onClose,
  initialPrompt,
  storyStructureNodeId = null,
  structureItems = [],
  initialSectionId = null,
}: AIDocumentPanelProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [leftPanelWidth, setLeftPanelWidth] = useState(35) // Percentage (for right-side chat, editor gets 100 - this)
  const [isDragging, setIsDragging] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(initialSectionId)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

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
  } = useDocumentSections({
    storyStructureNodeId,
    structureItems,
    enabled: isOpen && !!storyStructureNodeId,
  })

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

  // Update content when active section changes (without remounting editor)
  useEffect(() => {
    if (activeSection && activeSection.content !== content) {
      setContent(activeSection.content)
    }
  }, [activeSection?.id, activeSection?.content, content, setContent])

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
  }, [isDragging])

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

  // Handle section click
  const handleSectionClick = (section: DocumentSection) => {
    setActiveSectionId(section.id)
    if (editor) {
      const element = editor.view.dom.querySelector(`[data-section-id="${section.structure_item_id}"]`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // Render section navigation
  const renderSectionNav = () => {
    if (sectionsLoading) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="text-sm text-gray-400">Loading sections...</div>
        </div>
      )
    }

    if (sectionsError) {
      return (
        <div className="p-4">
          <div className="text-sm text-red-600">Error: {sectionsError}</div>
        </div>
      )
    }

    if (sections.length === 0) {
      return (
        <div className="p-4">
          <div className="text-sm text-gray-400">No sections yet</div>
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {sections.map(section => {
          const item = structureItems.find(i => i.id === section.structure_item_id)
          if (!item) return null

          return (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                section.id === activeSectionId
                  ? 'bg-yellow-100 text-yellow-900 border-l-2 border-yellow-500'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              style={{ paddingLeft: `${item.level * 12 + 16}px` }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{item.name}</div>
                  {item.title && <div className="text-xs text-gray-500 truncate">{item.title}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Status indicator */}
                  <div
                    className={`w-2 h-2 rounded-full ${
                      section.status === 'completed'
                        ? 'bg-green-500'
                        : section.status === 'in_progress'
                        ? 'bg-yellow-500'
                        : 'bg-gray-300'
                    }`}
                    title={section.status}
                  />
                  {/* Word count */}
                  <div className="text-xs text-gray-400">{section.word_count}w</div>
                </div>
              </div>
            </button>
          )
        })}
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

        {/* Split Content */}
        <div className="flex h-[calc(100vh-4rem)]" ref={containerRef}>
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
                  <div className="flex-1 overflow-y-auto">{renderSectionNav()}</div>
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
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm placeholder:text-gray-400"
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
      </div>
    </>
  )
}
