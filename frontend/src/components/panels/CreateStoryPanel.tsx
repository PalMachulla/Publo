'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
import { CreateStoryNodeData, StoryFormat } from '@/types/nodes'
import { GroqModelWithPricing } from '@/lib/groq/types'

interface CreateStoryPanelProps {
  node: Node<CreateStoryNodeData>
  onCreateStory: (format: StoryFormat, template?: string) => void
  onClose: () => void
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

export default function CreateStoryPanel({ node, onCreateStory, onClose }: CreateStoryPanelProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [models, setModels] = useState<GroqModelWithPricing[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<StoryFormat | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // Fetch Groq models on mount
  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    setLoadingModels(true)
    setModelsError(null)
    
    try {
      const response = await fetch('/api/groq/models')
      const data = await response.json()
      
      if (data.success) {
        setModels(data.data)
        // Auto-select first production model
        const firstProduction = data.data.find((m: GroqModelWithPricing) => m.category === 'production')
        if (firstProduction) {
          setSelectedModel(firstProduction.id)
        }
      } else {
        setModelsError(data.error || 'Failed to load models')
      }
    } catch (err) {
      setModelsError('Failed to fetch models')
      console.error('Error fetching models:', err)
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
    <div className="h-full flex flex-col bg-white">
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
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            1. Select Model
          </h3>

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

          {!loadingModels && !modelsError && models.length > 0 && (
            <div className="space-y-2">
              {models.slice(0, 5).map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedModel === model.id
                      ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Model Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {model.id}
                        </h4>
                        {model.category && (
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              model.category === 'production'
                                ? 'bg-green-100 text-green-700'
                                : model.category === 'preview'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {model.category}
                          </span>
                        )}
                      </div>
                      
                      {/* Pricing & Speed */}
                      <div className="flex items-center gap-3 text-[11px]">
                        {model.price_per_1m_input !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">In:</span>
                            <span className="font-mono font-medium text-gray-900">
                              ${model.price_per_1m_input.toFixed(3)}
                            </span>
                          </div>
                        )}
                        {model.price_per_1m_output !== undefined && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Out:</span>
                            <span className="font-mono font-medium text-gray-900">
                              ${model.price_per_1m_output.toFixed(3)}
                            </span>
                          </div>
                        )}
                        {model.speed_tokens_per_sec && (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">Speed:</span>
                            <span className="font-mono font-medium text-gray-900">
                              {model.speed_tokens_per_sec} t/s
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    {selectedModel === model.id && (
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

        {/* Format Selection Section */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
            2. Choose Format
          </h3>
        </div>

        <div className="space-y-2">
          {storyFormats.map((format) => {
            const isExpanded = selectedFormat === format.type
            const formatTemplates = templates[format.type]

            return (
              <div key={format.type} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Format Header (Accordion Trigger) */}
                <button
                  onClick={() => handleFormatClick(format.type)}
                  className={`w-full p-4 transition-all text-left ${
                    isExpanded
                      ? 'bg-yellow-50 border-b border-yellow-100'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Chevron */}
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 mt-0.5 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>

                    {/* Icon */}
                    <div className={`mt-0.5 ${isExpanded ? 'text-yellow-600' : 'text-gray-500'}`}>
                      {format.icon}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isExpanded ? 'text-yellow-900' : 'text-gray-900'}`}>
                        {format.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {format.description}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Templates (Accordion Content) */}
                {isExpanded && (
                  <div className="bg-white p-3 space-y-2">
                    {formatTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        className={`w-full p-3 rounded-md border transition-all text-left ${
                          selectedTemplate === template.id
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
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
                            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
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
      </div>

      {/* Footer with Create Button */}
      <div className="p-6 border-t border-gray-200">
        <button
          onClick={handleCreateStory}
          disabled={!selectedFormat || !selectedTemplate}
          className={`w-full px-4 py-3 rounded-lg font-medium text-white transition-colors ${
            selectedFormat && selectedTemplate
              ? 'bg-yellow-500 hover:bg-yellow-600'
              : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          {selectedFormat && selectedTemplate
            ? `Create ${storyFormats.find(f => f.type === selectedFormat)?.label}`
            : selectedFormat
            ? 'Select a Template'
            : 'Select a Format'}
        </button>
      </div>
    </div>
  )
}

