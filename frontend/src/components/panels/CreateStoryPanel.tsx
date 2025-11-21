'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
import { CreateStoryNodeData, StoryFormat } from '@/types/nodes'
import { NormalizedModel, LLMProvider } from '@/types/api-keys'
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

interface GroupedModels {
  provider: LLMProvider
  source: 'user' | 'publo'
  key_id?: string
  key_nickname?: string
  models: NormalizedModel[]
}

interface ReasoningMessage {
  timestamp: string
  content: string
  type: 'thinking' | 'decision' | 'task' | 'result' | 'error'
}

export default function CreateStoryPanel({ node, onCreateStory, onClose, onUpdate }: CreateStoryPanelProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>((node.data as any).selectedModel || null)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>((node.data as any).selectedKeyId || null)
  const [groupedModels, setGroupedModels] = useState<GroupedModels[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<StoryFormat | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  
  // Reasoning chat state - synced from node data
  const [isReasoningOpen, setIsReasoningOpen] = useState(false)
  
  // Read reasoning messages from node data (updated by orchestrator)
  const reasoningMessages: ReasoningMessage[] = (node.data as any).reasoningMessages || []

  // Auto-open reasoning panel when messages appear
  useEffect(() => {
    if (reasoningMessages.length > 0 && !isReasoningOpen) {
      setIsReasoningOpen(true)
    }
  }, [reasoningMessages.length])

  // Fetch models from all sources on mount
  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    setLoadingModels(true)
    setModelsError(null)
    
    try {
      console.log('[CreateStoryPanel] Fetching models from /api/models')
      const response = await fetch('/api/models')
      const data = await response.json()
      
      console.log('[CreateStoryPanel] Models API response:', {
        success: data.success,
        groupCount: data.grouped?.length,
        totalModels: data.total_count,
        rawGroups: data.grouped?.map((g: any) => ({
          provider: g.provider,
          source: g.source,
          keyId: g.key_id,
          modelCount: g.models?.length,
          firstModel: g.models?.[0],
          allModels: g.models?.map((m: any) => ({ id: m.id, name: m.name, supports_chat: m.supports_chat }))
        }))
      })
      
      if (data.success) {
        // Filter to only show chat-compatible models
        const filteredGroups = data.grouped.map((group: GroupedModels) => ({
          ...group,
          models: group.models.filter((m: NormalizedModel) => m.supports_chat)
        })).filter((group: GroupedModels) => group.models.length > 0)
        
        console.log('[CreateStoryPanel] After filtering:', {
          groups: filteredGroups.map((g: GroupedModels) => ({
            provider: g.provider,
            modelCount: g.models.length,
            models: g.models.map((m: NormalizedModel) => m.name)
          }))
        })
        
        setGroupedModels(filteredGroups)
        
        // Auto-select first production model from first group
        if (filteredGroups.length > 0 && filteredGroups[0].models.length > 0) {
          const firstGroup = filteredGroups[0]
          const firstProduction = firstGroup.models.find((m: NormalizedModel) => m.category === 'production') 
            || firstGroup.models[0]
          
          console.log('[CreateStoryPanel] Auto-selected model:', {
            model: firstProduction.name,
            id: firstProduction.id,
            provider: firstGroup.provider,
            keyId: firstGroup.key_id
          })
          
          setSelectedModel(firstProduction.id)
          setSelectedKeyId(firstGroup.key_id || null)
        }
      } else {
        setModelsError(data.error || 'Failed to load models')
      }
    } catch (err) {
      setModelsError('Failed to fetch models')
      console.error('[CreateStoryPanel] Error fetching models:', err)
    } finally {
      setLoadingModels(false)
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
    if (selectedFormat && selectedTemplate) {
      onCreateStory(selectedFormat, selectedTemplate)
      setSelectedFormat(null) // Reset selection after creating
      setSelectedTemplate(null)
      onClose() // Close the panel after creating
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Ghostwriter</h2>
            <p className="text-sm text-gray-500">Choose a format to begin writing</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Model Selection Section */}
        <CollapsibleSection
          title="1. Select Model"
          defaultOpen={true}
        >
          {loadingModels && (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-3 border-gray-200 border-t-yellow-400 rounded-full animate-spin" />
              <p className="text-xs text-gray-500 mt-3">Loading models...</p>
            </div>
          )}

          {modelsError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-red-600">{modelsError}</p>
              <button
                onClick={fetchModels}
                className="text-xs text-red-700 font-medium mt-1 underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loadingModels && !modelsError && groupedModels.length > 0 && (
            <div className="space-y-5">
              {groupedModels.map((group, groupIndex) => (
                <div key={`${group.provider}-${group.key_id || 'publo'}`}>
                  {/* Provider Group Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge 
                      variant={
                        group.provider === 'groq' ? 'purple' :
                        group.provider === 'openai' ? 'success' :
                        group.provider === 'anthropic' ? 'warning' :
                        'info'
                      }
                      size="md"
                    >
                      {group.provider.toUpperCase()}
                    </Badge>
                    {group.source === 'user' && (
                      <span className="text-xs text-gray-600 font-medium">
                        {group.key_nickname || 'Your Key'}
                      </span>
                    )}
                    {group.source === 'publo' && (
                      <Badge variant="outline" size="sm">Publo Default</Badge>
                    )}
                    <span className="text-xs text-gray-400">
                      {group.models.length} {group.models.length === 1 ? 'model' : 'models'}
                    </span>
                  </div>

                  {/* Models in this group */}
                  <div className="space-y-2">
                    {group.models.map((model) => (
                      <Card
                        key={model.id}
                        variant={selectedModel === model.id ? 'selected' : 'interactive'}
                        onClick={() => {
                          console.log('🎯 Model selected:', {
                            model: model.id,
                            provider: group.provider,
                            keyId: group.key_id,
                            keyNickname: group.key_nickname,
                            source: group.source
                          })
                          
                          setSelectedModel(model.id)
                          setSelectedKeyId(group.key_id || null)
                          // Store selected model and key in node data
                          if (onUpdate) {
                            onUpdate(node.id, { 
                              selectedModel: model.id,
                              selectedKeyId: group.key_id || null 
                            } as any)
                          }
                        }}
                        className="relative"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Model Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {model.id}
                              </h4>
                              {model.category && (
                                <Badge 
                                  variant={
                                    model.category === 'production' ? 'success' :
                                    model.category === 'preview' ? 'info' :
                                    'default'
                                  }
                                  size="sm"
                                >
                                  {model.category}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Pricing & Speed */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {model.input_price_per_1m !== null && model.input_price_per_1m !== undefined && (
                                <Badge variant="outline" size="sm">
                                  💵 In: ${model.input_price_per_1m.toFixed(3)}/1M
                                </Badge>
                              )}
                              {model.output_price_per_1m !== null && model.output_price_per_1m !== undefined && (
                                <Badge variant="outline" size="sm">
                                  💵 Out: ${model.output_price_per_1m.toFixed(3)}/1M
                                </Badge>
                              )}
                              {model.speed_tokens_per_sec && (
                                <Badge variant="outline" size="sm">
                                  ⚡ {model.speed_tokens_per_sec} t/s
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Selection Indicator */}
                          {selectedModel === model.id && (
                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Reasoning Chat Section (NEW) */}
        <CollapsibleSection
          title="Orchestrator Reasoning"
          defaultOpen={isReasoningOpen}
          className="mt-6"
        >
          <div className="space-y-2 max-h-96 overflow-y-auto">
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
                const bgColor = 
                  msg.type === 'thinking' ? 'bg-purple-50 border-l-4 border-purple-400' :
                  msg.type === 'decision' ? 'bg-blue-50 border-l-4 border-blue-400' :
                  msg.type === 'task' ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                  msg.type === 'result' ? 'bg-green-50 border-l-4 border-green-400' :
                  'bg-red-50 border-l-4 border-red-400'
                
                const icon = 
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
                
                return (
                  <div key={i} className={`p-3 rounded ${bgColor}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                            {msg.type}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {msg.timestamp}
                          </span>
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CollapsibleSection>

        {/* Format Selection Section */}
        <CollapsibleSection
          title="2. Choose Format"
          defaultOpen={true}
          className="mt-6"
        >
          <div className="space-y-2">
            {storyFormats.map((format) => {
              const isSelected = selectedFormat === format.type
              const formatTemplates = templates[format.type]
              
              return (
                <div key={format.type}>
                  {/* Format Card */}
                  <Card
                    variant={isSelected ? 'selected' : 'interactive'}
                    onClick={() => handleFormatClick(format.type)}
                    className="relative transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 transition-colors ${isSelected ? 'text-yellow-600' : 'text-gray-500'}`}>
                        {format.icon}
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-sm font-semibold transition-colors ${isSelected ? 'text-yellow-900' : 'text-gray-900'}`}>
                          {format.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format.description}
                        </div>
                      </div>
                      {/* Chevron indicator */}
                      <div className={`flex-shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`}>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Card>

                  {/* Template Selection (expands directly below format) */}
                  {isSelected && (
                    <div className="mt-2 ml-8 space-y-1 animate-in slide-in-from-top-2 duration-200">
                      {formatTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedTemplate === template.id
                              ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <div className={`text-sm font-medium ${
                                selectedTemplate === template.id ? 'text-yellow-900' : 'text-gray-900'
                              }`}>
                                {template.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {template.description}
                              </div>
                            </div>
                            {selectedTemplate === template.id && (
                              <div className="flex-shrink-0 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CollapsibleSection>
      </div>

      {/* Footer with Create Button */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <Button
          onClick={handleCreateStory}
          disabled={!selectedFormat || !selectedTemplate}
          variant="primary"
          size="lg"
          className="w-full"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {selectedFormat && selectedTemplate
            ? `Create ${storyFormats.find(f => f.type === selectedFormat)?.label}`
            : selectedFormat
            ? 'Select a Template'
            : 'Select a Format'}
        </Button>
        {selectedFormat && selectedTemplate && (
          <p className="text-xs text-gray-500 text-center mt-3">
            This will create a new story structure on the canvas
          </p>
        )}
      </div>
    </div>
  )
}

