'use client'

import { useState, useRef, useEffect } from 'react'

interface Task {
  id: string
  text: string
  status: 'pending' | 'in_progress' | 'completed'
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  tasks?: Task[]
}

interface AIDocumentPanelProps {
  isOpen: boolean
  onClose: () => void
  initialPrompt?: string
}

export default function AIDocumentPanel({ isOpen, onClose, initialPrompt }: AIDocumentPanelProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [documentContent, setDocumentContent] = useState('')
  const [leftPanelWidth, setLeftPanelWidth] = useState(50) // Percentage
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasProcessedInitialPrompt = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle initial prompt when panel opens
  useEffect(() => {
    if (isOpen && initialPrompt && !hasProcessedInitialPrompt.current) {
      hasProcessedInitialPrompt.current = true
      // Add user message with initial prompt
      setMessages([{ role: 'user', content: initialPrompt }])
      
      // Simulate AI planning and reasoning
      setTimeout(() => {
        const aiResponse: Message = {
          role: 'assistant',
          content: 'I\'ll help you with that. Let me break this down into steps:',
          tasks: [
            { id: '1', text: 'Analyzing your request and understanding the context', status: 'completed' },
            { id: '2', text: 'Researching relevant information and sources', status: 'completed' },
            { id: '3', text: 'Structuring the content and outlining key points', status: 'in_progress' },
            { id: '4', text: 'Drafting the document with proper formatting', status: 'pending' },
            { id: '5', text: 'Review and refine the final output', status: 'pending' },
          ]
        }
        setMessages(prev => [...prev, aiResponse])
        
        // Simulate task progression
        setTimeout(() => {
          setMessages(prev => prev.map((msg, idx) => 
            idx === prev.length - 1 && msg.tasks ? {
              ...msg,
              tasks: msg.tasks.map(task => 
                task.id === '3' ? { ...task, status: 'completed' } : 
                task.id === '4' ? { ...task, status: 'in_progress' } : task
              )
            } : msg
          ))
        }, 2000)
        
        setTimeout(() => {
          setMessages(prev => prev.map((msg, idx) => 
            idx === prev.length - 1 && msg.tasks ? {
              ...msg,
              tasks: msg.tasks.map(task => 
                task.id === '4' ? { ...task, status: 'completed' } : 
                task.id === '5' ? { ...task, status: 'in_progress' } : task
              )
            } : msg
          ))
        }, 4000)
        
        setTimeout(() => {
          setMessages(prev => prev.map((msg, idx) => 
            idx === prev.length - 1 && msg.tasks ? {
              ...msg,
              tasks: msg.tasks.map(task => 
                task.id === '5' ? { ...task, status: 'completed' } : task
              )
            } : msg
          ))
        }, 6000)
      }, 800)
    }
    
    // Reset the flag when panel closes
    if (!isOpen) {
      hasProcessedInitialPrompt.current = false
      setMessages([]) // Clear messages when panel closes
    }
  }, [isOpen, initialPrompt])

  // Handle mouse drag for resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
    
    // Constrain between 30% and 70%
    if (newWidth >= 30 && newWidth <= 70) {
      setLeftPanelWidth(newWidth)
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

    // Add user message
    const userMessage = input
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setInput('')
    
    // Simulate AI response with tasks
    setTimeout(() => {
      const aiResponse: Message = {
        role: 'assistant',
        content: 'Processing your request. Here\'s my approach:',
        tasks: [
          { id: `${Date.now()}-1`, text: 'Understanding your specific requirements', status: 'completed' },
          { id: `${Date.now()}-2`, text: 'Gathering relevant information', status: 'in_progress' },
          { id: `${Date.now()}-3`, text: 'Composing the response', status: 'pending' },
        ]
      }
      setMessages(prev => [...prev, aiResponse])
      
      // Simulate task progression
      setTimeout(() => {
        setMessages(prev => prev.map((msg, idx) => 
          idx === prev.length - 1 && msg.tasks ? {
            ...msg,
            tasks: msg.tasks.map(task => 
              task.status === 'in_progress' ? { ...task, status: 'completed' } : 
              task.status === 'pending' ? { ...task, status: 'in_progress' } : task
            )
          } : msg
        ))
      }, 1500)
      
      setTimeout(() => {
        setMessages(prev => prev.map((msg, idx) => 
          idx === prev.length - 1 && msg.tasks ? {
            ...msg,
            tasks: msg.tasks.map(task => 
              task.status === 'in_progress' ? { ...task, status: 'completed' } : task
            )
          } : msg
        ))
      }, 3000)
    }, 500)
  }

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
          <h2 className="text-lg font-semibold text-gray-900">AI Document Assistant</h2>
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

        {/* Split Content */}
        <div className="flex h-[calc(100vh-4rem)]" ref={containerRef}>
          {/* Left Side - AI Chat */}
          <div 
            className="border-r border-gray-200 flex flex-col bg-gray-50 relative overflow-hidden" 
            style={{ width: `${leftPanelWidth}%` }}
          >
            {/* Grid background */}
            <div className="absolute inset-0 z-0" style={{
              backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
              backgroundSize: '20px 20px'
            }} />
            
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-sm">Start a conversation to build your document</p>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div key={index} className="space-y-3">
                      {message.role === 'user' ? (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-medium">fg</span>
                          </div>
                          <div className="flex-1 bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-200">
                            <p className="text-sm text-gray-900">{message.content}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-700 mb-3">{message.content}</p>
                              
                              {/* Task List */}
                              {message.tasks && message.tasks.length > 0 && (
                                <div className="space-y-2 mt-3">
                                  {message.tasks.map((task) => (
                                    <div 
                                      key={task.id} 
                                      className="flex items-start gap-3 group"
                                    >
                                      {/* Status Icon */}
                                      <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                                        {task.status === 'completed' ? (
                                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        ) : task.status === 'in_progress' ? (
                                          <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                        ) : (
                                          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="9" strokeWidth="2" />
                                          </svg>
                                        )}
                                      </div>
                                      
                                      {/* Task Text */}
                                      <p className={`text-sm flex-1 ${
                                        task.status === 'completed' ? 'text-gray-600 line-through' : 
                                        task.status === 'in_progress' ? 'text-gray-900 font-medium' : 
                                        'text-gray-500'
                                      }`}>
                                        {task.text}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
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
                  onChange={(e) => setInput(e.target.value)}
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

          {/* Right Side - Document Editor */}
          <div className="flex flex-col bg-white" style={{ width: `${100 - leftPanelWidth}%` }}>
            {/* Editor Toolbar */}
            <div className="h-12 border-b border-gray-200 flex items-center px-4 gap-2 bg-gray-50">
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Bold">
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
                </svg>
              </button>
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Italic">
                <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20h4M8 4h8m-4 0v16" />
                </svg>
              </button>
              <div className="w-px h-6 bg-gray-300 mx-1" />
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Heading 1">
                <span className="text-sm font-bold text-gray-700">H1</span>
              </button>
              <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Heading 2">
                <span className="text-sm font-bold text-gray-700">H2</span>
              </button>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-12 py-8">
                {documentContent ? (
                  <div 
                    className="prose prose-lg max-w-none"
                    dangerouslySetInnerHTML={{ __html: documentContent }}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">Your document will appear here</p>
                      <p className="text-xs mt-2 text-gray-300">Chat with AI to generate content</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

