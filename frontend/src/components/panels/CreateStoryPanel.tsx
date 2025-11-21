'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Node } from 'reactflow'
import { CreateStoryNodeData, StoryFormat } from '@/types/nodes'
import { 
  CollapsibleSection,
  Card,
  Badge,
  RadioGroup,
  RadioItem,
  Button
} from '@/components/ui'

interface CreateStoryPanelProps {
  node: Node<CreateStoryNodeData>
  onCreateStory: (format: StoryFormat, template?: string) => void
  onClose: () => void
  onUpdate?: (nodeId: string, data: Partial<CreateStoryNodeData>) => void
}

interface Template {
  id: string
  name: string
  description: string
}

const templates: Record<StoryFormat, Template[]> = {
  'novel': [
    { id: 'three-act', name: 'Three-Act Structure', description: 'Classic beginning, middle, and end' },
    { id: 'heros-journey', name: "Hero's Journey", description: 'Archetypal adventure narrative' },
    { id: 'freytag', name: 'Freytag\'s Pyramid', description: 'Rising action, climax, falling action' },
    { id: 'save-the-cat', name: 'Save The Cat', description: 'Modern screenplay structure adapted for novels' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'short-story': [
    { id: 'classic', name: 'Classic Short Story', description: 'Single plot, few characters, brief timespan' },
    { id: 'flash-fiction', name: 'Flash Fiction', description: 'Ultra-short 500-1000 words' },
    { id: 'twist-ending', name: 'Twist Ending', description: 'Surprise revelation structure' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'report': [
    { id: 'business', name: 'Business Report', description: 'Executive summary, findings, recommendations' },
    { id: 'research', name: 'Research Report', description: 'Literature review, methodology, results' },
    { id: 'technical', name: 'Technical Report', description: 'Specifications, analysis, documentation' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'article': [
    { id: 'how-to', name: 'How-To Guide', description: 'Step-by-step instructional' },
    { id: 'listicle', name: 'Listicle', description: 'Numbered or bulleted list format' },
    { id: 'opinion', name: 'Opinion Piece', description: 'Editorial or commentary' },
    { id: 'feature', name: 'Feature Article', description: 'In-depth exploration of topic' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'screenplay': [
    { id: 'feature', name: 'Feature Film', description: '90-120 pages, three acts' },
    { id: 'tv-pilot', name: 'TV Pilot', description: '30 or 60-minute episode' },
    { id: 'short-film', name: 'Short Film', description: '5-30 pages' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'essay': [
    { id: 'argumentative', name: 'Argumentative', description: 'Claim, evidence, counterarguments' },
    { id: 'narrative', name: 'Narrative Essay', description: 'Personal story with reflection' },
    { id: 'compare-contrast', name: 'Compare & Contrast', description: 'Analyze similarities and differences' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ],
  'podcast': [
    { id: 'interview', name: 'Interview Format', description: 'Host interviews guests' },
    { id: 'co-hosted', name: 'Co-Hosted', description: 'Multiple hosts in conversation' },
    { id: 'storytelling', name: 'Storytelling', description: 'Narrative-driven episodes' },
    { id: 'blank', name: 'Blank Canvas', description: 'Start from scratch' }
  ]
}

const storyFormats: Array<{ type: StoryFormat; label: string; description: string; icon: JSX.Element }> = [
  {
    type: 'novel',
    label: 'Novel',
    description: 'Long-form narrative fiction',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    type: 'short-story',
    label: 'Short Story',
    description: 'Brief narrative fiction',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    )
  },
  {
    type: 'report',
    label: 'Report',
    description: 'Structured analysis document',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    type: 'article',
    label: 'Article',
    description: 'Editorial or blog post',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    )
  },
  {
    type: 'screenplay',
    label: 'Screenplay',
    description: 'Script for film or TV',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    )
  },
  {
    type: 'essay',
    label: 'Essay',
    description: 'Opinion or argumentative piece',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  },
  {
    type: 'podcast',
    label: 'Podcast',
    description: 'Audio show with host and guests',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )
  }
]

interface ReasoningMessage {
  timestamp: string
  content: string
  type: 'thinking' | 'decision' | 'task' | 'result' | 'error'
}

export default function CreateStoryPanel({ node, onCreateStory, onClose, onUpdate }: CreateStoryPanelProps) {
  const router = useRouter()
  const [configuredModel, setConfiguredModel] = useState<{
    orchestrator: string | null
    writerCount: number
  }>({ orchestrator: null, writerCount: 0 })
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [selectedFormat, setSelectedFormat] = useState<StoryFormat | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false) // Prevent double-clicks
  
  // Pill expansion state
  const [isModelPillExpanded, setIsModelPillExpanded] = useState(false)
  const [isFormatPillExpanded, setIsFormatPillExpanded] = useState(false)
  
  // Chat state
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<Array<{id: string, role: 'user' | 'orchestrator', content: string}>>([])
  
  // Reasoning chat state - synced from node data
  const [isReasoningOpen, setIsReasoningOpen] = useState(true) // Open by default to see streaming
  const reasoningEndRef = useRef<HTMLDivElement>(null) // Auto-scroll target
  const chatInputRef = useRef<HTMLTextAreaElement>(null) // Chat input ref
  
  // Read reasoning messages from node data (updated by orchestrator)
  const reasoningMessages: ReasoningMessage[] = (node.data as any).reasoningMessages || []
  
  // Detect if streaming (last message is from model and being updated)
  const isStreaming = reasoningMessages.length > 0 && 
    reasoningMessages[reasoningMessages.length - 1].content.startsWith('🤖 Model reasoning:')

  // Auto-open reasoning panel when messages appear or update
  useEffect(() => {
    if (reasoningMessages.length > 0) {
      setIsReasoningOpen(true)
      console.log('[CreateStoryPanel] Auto-opening reasoning panel, messages:', reasoningMessages.length)
    }
  }, [reasoningMessages])

  // Fetch configured models from Profile settings - ALWAYS refresh on mount
  useEffect(() => {
    console.log('[CreateStoryPanel] Component mounted, fetching configuration...')
    fetchConfiguredModels()
  }, []) // This now refreshes every time panel opens

  // Auto-refresh when page becomes visible (user returns from Profile)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('[CreateStoryPanel] Page became visible, refreshing configuration...')
        fetchConfiguredModels()
      }
    }
    
    // Listen for custom event from Profile page when config is saved
    const handleConfigUpdate = (e: CustomEvent) => {
      console.log('[CreateStoryPanel] Config update event received:', e.detail)
      fetchConfiguredModels()
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('popstate', fetchConfiguredModels) // Browser back button
    window.addEventListener('orchestratorConfigUpdated' as any, handleConfigUpdate as any)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('popstate', fetchConfiguredModels)
      window.removeEventListener('orchestratorConfigUpdated' as any, handleConfigUpdate as any)
    }
  }, [])

  // NEW: Auto-scroll to latest reasoning message
  useEffect(() => {
    if (reasoningMessages.length > 0 && reasoningEndRef.current) {
      reasoningEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [reasoningMessages])

  const fetchConfiguredModels = async () => {
    setLoadingConfig(true)
    
    try {
      console.log('[CreateStoryPanel] Fetching configured models from Profile')
      const response = await fetch('/api/user/api-keys')
      const data = await response.json()
      
      console.log('[CreateStoryPanel] 📦 API Response:', {
        success: data.success,
        keyCount: data.keys?.length,
        allKeys: data.keys?.map((k: any) => ({
          id: k.id,
          provider: k.provider,
          orchestrator_model_id: k.orchestrator_model_id,
          writer_model_ids: k.writer_model_ids,
          hasOrchestrator: !!k.orchestrator_model_id
        }))
      })
      
      if (data.success && data.keys?.length > 0) {
        // Find the first key with an orchestrator configured
        const configuredKey = data.keys.find((key: any) => key.orchestrator_model_id)
        
        console.log('[CreateStoryPanel] 🔍 Search result:', {
          foundKey: !!configuredKey,
          keyId: configuredKey?.id,
          orchestrator: configuredKey?.orchestrator_model_id,
          writers: configuredKey?.writer_model_ids
        })
        
        if (configuredKey) {
          console.log('[CreateStoryPanel] ✅ Setting configured model:', {
            orchestrator: configuredKey.orchestrator_model_id,
            writers: configuredKey.writer_model_ids?.length || 0
          })
          
          setConfiguredModel({
            orchestrator: configuredKey.orchestrator_model_id,
            writerCount: configuredKey.writer_model_ids?.length || 0
          })
        } else {
          console.log('[CreateStoryPanel] ⚠️ No orchestrator found, defaulting to Auto-select')
          // No explicit configuration - will auto-select
          setConfiguredModel({
            orchestrator: 'Auto-select',
            writerCount: 0
          })
        }
      } else {
        console.log('[CreateStoryPanel] ❌ No API keys found')
        // No API keys configured
        setConfiguredModel({
          orchestrator: null,
          writerCount: 0
        })
      }
    } catch (err) {
      console.error('[CreateStoryPanel] Error fetching configuration:', err)
      setConfiguredModel({
        orchestrator: 'Error loading config',
        writerCount: 0
      })
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleFormatClick = (format: StoryFormat) => {
    if (selectedFormat === format) {
      // Collapse if clicking the same format
      setSelectedFormat(null)
      setSelectedTemplate(null)
    } else {
      // Expand new format
      setSelectedFormat(format)
      setSelectedTemplate(null)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId)
  }

  const handleCreateStory = () => {
    if (selectedFormat && selectedTemplate && !isCreating) {
      setIsCreating(true) // Prevent double-clicks
      onCreateStory(selectedFormat, selectedTemplate)
      
      // Reset after 2 seconds (allows user to create again if needed)
      setTimeout(() => {
        setIsCreating(false)
      }, 2000)
      
      // Keep panel open to watch orchestrator reasoning
      // setSelectedFormat(null) // Keep selection visible
      // setSelectedTemplate(null)
      // onClose() // Don't close - user wants to see streaming
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Pills Bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3">
          {/* Model Pill */}
          <div className="relative flex-1">
            <button
              onClick={() => setIsModelPillExpanded(!isModelPillExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white border-2 border-indigo-200 rounded-full hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <span className="text-sm font-semibold text-gray-900">
                  {loadingConfig ? 'Loading...' : (configuredModel?.orchestrator || 'Auto-select')}
                </span>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${isModelPillExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Model Pill Dropdown */}
            {isModelPillExpanded && (
              <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-gray-200 rounded-lg shadow-lg z-10 animate-in slide-in-from-top-2 duration-200">
                <div className="text-xs text-gray-600 mb-2">
                  <span className="font-semibold">Orchestrator:</span> {configuredModel?.orchestrator || 'Auto-select best model'}
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  <span className="font-semibold">Writers:</span> {configuredModel?.writerCount || 0} models
                </div>
                <button
                  onClick={() => router.push('/profile')}
                  className="w-full text-xs font-medium text-indigo-600 hover:text-indigo-700 py-1.5 px-3 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                >
                  Change in Profile →
                </button>
              </div>
            )}
          </div>

          {/* Format Pill - Simplified (just shows selection) */}
          <button
            onClick={() => setIsFormatPillExpanded(!isFormatPillExpanded)}
            className="flex-1 flex items-center justify-between px-4 py-2.5 bg-white border-2 border-yellow-200 rounded-full hover:border-yellow-300 hover:bg-yellow-50 transition-all shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-sm font-semibold text-gray-900">
                {selectedFormat && selectedTemplate 
                  ? `${storyFormats.find(f => f.type === selectedFormat)?.label} - ${templates[selectedFormat].find(t => t.id === selectedTemplate)?.name}`
                  : selectedFormat 
                  ? storyFormats.find(f => f.type === selectedFormat)?.label
                  : 'Select Format'}
              </span>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isFormatPillExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Orchestrator Reasoning - Center Stage */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          {/* Format Selection Accordion (expands when pill clicked) */}
          {isFormatPillExpanded && (
            <div className="mb-4 bg-white rounded-lg border-2 border-yellow-300 shadow-md animate-in slide-in-from-top-2 duration-200">
              <div className="p-4 max-h-96 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Choose a Format & Template</h3>
                <div className="space-y-3">
                  {storyFormats.map((format) => {
                    const formatTemplates = templates[format.type]
                    const isSelected = selectedFormat === format.type
                    
                    return (
                      <div key={format.type} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => {
                            setSelectedFormat(isSelected ? null : format.type)
                            if (!isSelected) setSelectedTemplate(null)
                          }}
                          className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                            isSelected ? 'bg-yellow-50' : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className={`text-2xl ${isSelected ? 'text-yellow-600' : 'text-gray-400'}`}>
                            {format.icon}
                          </div>
                          <div className="flex-1">
                            <div className={`text-sm font-semibold ${isSelected ? 'text-yellow-900' : 'text-gray-900'}`}>
                              {format.label}
                            </div>
                            <div className="text-xs text-gray-500">{format.description}</div>
                          </div>
                          <svg 
                            className={`w-5 h-5 text-gray-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isSelected && (
                          <div className="bg-yellow-50 border-t border-yellow-200 p-3 space-y-2">
                            <p className="text-xs font-medium text-gray-700 mb-2">Select a template:</p>
                            {formatTemplates.map((template) => (
                              <button
                                key={template.id}
                                onClick={() => {
                                  setSelectedTemplate(template.id)
                                  setIsFormatPillExpanded(false)
                                  // Auto-create when template selected
                                  if (!isCreating) {
                                    handleCreateStory()
                                  }
                                }}
                                className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-colors ${
                                  selectedTemplate === template.id
                                    ? 'bg-yellow-200 text-yellow-900 font-semibold border-2 border-yellow-400'
                                    : 'bg-white text-gray-700 hover:bg-yellow-100 border-2 border-transparent'
                                }`}
                              >
                                {template.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto space-y-3">
            {reasoningMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm font-medium">AI reasoning will appear here</p>
                <p className="text-xs mt-1">Watch the orchestrator think through your story structure</p>
              </div>
            ) : (
              reasoningMessages.map((msg, i) => {
                // Distinguish model reasoning from orchestrator messages
                const isModelMessage = msg.content.startsWith('🤖 Model reasoning:')
                const isLastMessage = i === reasoningMessages.length - 1
                
                const bgColor = 
                  isModelMessage ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500' :
                  msg.type === 'thinking' ? 'bg-purple-50 border-l-4 border-purple-400' :
                  msg.type === 'decision' ? 'bg-blue-50 border-l-4 border-blue-400' :
                  msg.type === 'task' ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                  msg.type === 'result' ? 'bg-green-50 border-l-4 border-green-400' :
                  'bg-red-50 border-l-4 border-red-400'
                
                const icon = 
                  isModelMessage ? (
                    <svg className="w-3.5 h-3.5 text-indigo-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  ) :
                  msg.type === 'thinking' ? (
                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ) :
                  msg.type === 'decision' ? (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  ) :
                  msg.type === 'task' ? (
                    <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) :
                  msg.type === 'result' ? (
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) :
                  (
                    <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                
                const label = isModelMessage ? 'MODEL' : msg.type.toUpperCase()
                
                return (
                  <div key={i} className={`p-3 rounded ${bgColor} ${isLastMessage && isStreaming ? 'animate-pulse' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-medium uppercase tracking-wide ${isModelMessage ? 'text-indigo-600 font-bold' : 'text-gray-500'}`}>
                            {label}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.timestamp).toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit' 
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                          {msg.content}
                          {/* Typing indicator for last message when streaming */}
                          {isLastMessage && isStreaming && (
                            <span className="inline-block ml-1 w-1.5 h-4 bg-indigo-600 animate-pulse" />
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          {/* Scroll target */}
          <div ref={reasoningEndRef} />
          </div>
        </div>
      </div>

      {/* Chat Input - Bottom */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={chatInputRef}
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                // TODO: Send message to orchestrator
                console.log('Send message:', chatMessage)
                setChatMessage('')
              }
            }}
            placeholder="Chat with the orchestrator..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400"
          />
          <button
            onClick={() => {
              // TODO: Send message to orchestrator
              console.log('Send message:', chatMessage)
              setChatMessage('')
            }}
            disabled={!chatMessage.trim()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
