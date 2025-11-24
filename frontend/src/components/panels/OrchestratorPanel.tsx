'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Node } from 'reactflow'
import { CreateStoryNodeData, StoryFormat } from '@/types/nodes'
import { createClient } from '@/lib/supabase/client'
import { 
  CollapsibleSection,
  Card,
  Badge,
  RadioGroup,
  RadioItem,
  Button
} from '@/components/ui'
import { 
  getOrchestrator, 
  buildCanvasContext, 
  type OrchestratorRequest,
  type OrchestratorAction,
  type UserIntent,
  analyzeIntent,
  validateIntent,
  explainIntent,
  enhanceContextWithRAG,
  buildRAGEnhancedPrompt,
  formatCanvasContextForLLM
} from '@/lib/orchestrator'
import { findReferencedNode } from '@/lib/orchestrator/canvasContextProvider'
import { Edge } from 'reactflow'

// Helper: Get canonical model details for filtering and display
const getCanonicalModel = (modelId: string) => {
  const id = modelId.toLowerCase()

  // Frontier / Future Models (GPT-5, 4.1)
  if (id.includes('gpt-5.1')) return { name: 'GPT-5.1 (Frontier)', priority: 110, group: 'OpenAI (Frontier)', isReasoning: true }
  if (id.includes('gpt-5') && !id.includes('mini') && !id.includes('nano')) return { name: 'GPT-5', priority: 105, group: 'OpenAI (Frontier)', isReasoning: true }
  if (id.includes('gpt-5') && (id.includes('mini') || id.includes('nano'))) return { name: 'GPT-5 Efficient', priority: 104, group: 'OpenAI (Frontier)', isReasoning: false }
  if (id.includes('gpt-4.1')) return { name: 'GPT-4.1', priority: 102, group: 'OpenAI (Frontier)', isReasoning: false }
  
  // OpenAI Models
  if (id.includes('o1-preview')) return { name: 'OpenAI o1 Preview', priority: 100, group: 'OpenAI (Reasoning)', isReasoning: true }
  if (id.includes('o1-mini')) return { name: 'OpenAI o1 Mini', priority: 95, group: 'OpenAI (Reasoning)', isReasoning: true }
  if (id.includes('gpt-4o') && !id.includes('mini')) return { name: 'GPT-4o', priority: 90, group: 'OpenAI', isReasoning: true }
  if (id.includes('gpt-4o') && id.includes('mini')) return { name: 'GPT-4o Mini', priority: 70, group: 'OpenAI', isReasoning: false }
  if (id.includes('gpt-4-turbo') || id.includes('gpt-4-1106') || id.includes('gpt-4-0125')) return { name: 'GPT-4 Turbo', priority: 85, group: 'OpenAI', isReasoning: true }
  if (id === 'gpt-4' || id.includes('gpt-4-0613') || id.includes('gpt-4-0314')) return { name: 'GPT-4 (Legacy)', priority: 60, group: 'OpenAI', isReasoning: true }
  
  // Anthropic Models
  if (id.includes('claude-sonnet-4.5') || id.includes('claude-4.5-sonnet')) return { name: 'Claude Sonnet 4.5', priority: 95, group: 'Anthropic', isReasoning: true }
  if (id.includes('claude-3-5-sonnet')) return { name: 'Claude 3.5 Sonnet', priority: 92, group: 'Anthropic', isReasoning: true }
  if (id.includes('claude-3-opus')) return { name: 'Claude 3 Opus', priority: 88, group: 'Anthropic', isReasoning: true }
  if (id.includes('claude-3-haiku')) return { name: 'Claude 3 Haiku', priority: 70, group: 'Anthropic', isReasoning: false }
  
  // Google Models
  if (id.includes('gemini-1.5-pro')) return { name: 'Gemini 1.5 Pro', priority: 89, group: 'Google', isReasoning: true }
  if (id.includes('gemini-1.5-flash')) return { name: 'Gemini 1.5 Flash', priority: 75, group: 'Google', isReasoning: false }
  if (id.includes('gemini-2.0-flash')) return { name: 'Gemini 2.0 Flash', priority: 87, group: 'Google', isReasoning: true }
  
  // Groq Models
  if (id.includes('llama-3.3-70b')) return { name: 'Llama 3.3 70B', priority: 85, group: 'Groq', isReasoning: true }
  if (id.includes('llama-3.1-70b')) return { name: 'Llama 3.1 70B', priority: 80, group: 'Groq', isReasoning: true }
  if (id.includes('llama-3.1-8b')) return { name: 'Llama 3.1 8B (Fast)', priority: 75, group: 'Groq', isReasoning: false }
  if (id.includes('mixtral-8x7b')) return { name: 'Mixtral 8x7B', priority: 70, group: 'Groq', isReasoning: false }
  
  return null
}

interface ActiveContext {
  type: 'section' | 'segment'
  id: string
  name: string
  title?: string
  level?: number
  description?: string
}

interface CreateStoryPanelProps {
  node: Node<CreateStoryNodeData>
  onCreateStory: (format: StoryFormat, template?: string, userPrompt?: string) => void
  onClose: () => void
  onUpdate?: (nodeId: string, data: Partial<CreateStoryNodeData>) => void
  onSendPrompt?: (prompt: string) => void // NEW: For chat-based prompting
  canvasChatHistory?: Array<{
    id: string
    timestamp: string
    content: string
    type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model'
    role?: 'user' | 'orchestrator'
  }>
  onAddChatMessage?: (message: string, role?: 'user' | 'orchestrator', type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model') => void
  onClearChat?: () => void
  onToggleDocumentView?: () => void // NEW: Toggle document panel visibility
  isDocumentViewOpen?: boolean // NEW: Document panel visibility state
  activeContext?: ActiveContext | null // NEW: Currently selected segment/section
  onClearContext?: () => void // NEW: Clear the active context
  onWriteContent?: (segmentId: string, prompt: string) => Promise<void> // NEW: Write content to specific segment
  onAnswerQuestion?: (question: string) => Promise<string> // NEW: Answer questions about content
  structureItems?: any[] // GHOSTWRITER: Document structure for dependency analysis
  contentMap?: Record<string, string> // GHOSTWRITER: Existing content by section ID (currently open document)
  canvasNodes?: Node[] // CANVAS VISIBILITY: All nodes on canvas
  canvasEdges?: Edge[] // CANVAS VISIBILITY: All edges on canvas
  currentStoryStructureNodeId?: string | null // CANVAS CONTENT: ID of currently loaded story structure
  onSelectNode?: (nodeId: string, sectionId?: string) => void // HELPFUL MODE: Select and open a specific canvas node, optionally auto-select a section
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
  id: string
  timestamp: string
  content: string
  type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model'
  role?: 'user' | 'orchestrator'
}

// Helper function to detect format from user message
function detectFormatFromMessage(message: string): StoryFormat | null {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('podcast')) return 'podcast'
  if (lowerMessage.includes('screenplay') || lowerMessage.includes('script')) return 'screenplay'
  if (lowerMessage.includes('novel') || lowerMessage.includes('book')) return 'novel'
  if (lowerMessage.includes('short story')) return 'short-story'
  if (lowerMessage.includes('article') || lowerMessage.includes('blog')) return 'article'
  if (lowerMessage.includes('report')) return 'report'
  
  return null
}

export default function OrchestratorPanel({ 
  node, 
  onCreateStory, 
  onClose, 
  onUpdate, 
  onSendPrompt,
  canvasChatHistory = [],
  onAddChatMessage,
  onClearChat,
  onToggleDocumentView,
  isDocumentViewOpen = false,
  activeContext = null,
  onClearContext,
  onWriteContent,
  onAnswerQuestion,
  structureItems = [],
  contentMap = {},
  canvasNodes = [],
  canvasEdges = [],
  currentStoryStructureNodeId = null,
  onSelectNode
}: CreateStoryPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  
  // Debug: Log received props on mount and when they change
  useEffect(() => {
    console.log('🎯 [CreateStoryPanel] Props received:', {
      canvasNodesCount: canvasNodes.length,
      canvasEdgesCount: canvasEdges.length,
      canvasNodesList: canvasNodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label })),
      canvasEdgesList: canvasEdges.map(e => ({ source: e.source, target: e.target }))
    })
  }, [canvasNodes, canvasEdges])
  const [configuredModel, setConfiguredModel] = useState<{
    orchestrator: string | null
    writerCount: number
  }>({ orchestrator: null, writerCount: 0 })
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [availableOrchestrators, setAvailableOrchestrators] = useState<Array<{id: string, name: string, keyId: string, provider: string, group?: string, priority?: number}>>([])
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null)
  const [updatingModel, setUpdatingModel] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<StoryFormat>('novel') // Default to 'novel'
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false) // Prevent double-clicks
  
  // Pending creation state - for interactive template selection
  const [pendingCreation, setPendingCreation] = useState<{
    format: StoryFormat
    userMessage: string
    referenceNode?: any
    enhancedPrompt?: string
  } | null>(null)
  
  // Pill expansion state
  const [isModelPillExpanded, setIsModelPillExpanded] = useState(false)
  const [isFormatPillExpanded, setIsFormatPillExpanded] = useState(false)
  
  // Chat state (local input only, history is canvas-level)
  const [chatMessage, setChatMessage] = useState('')
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set())
  
  // LLM reasoning mode toggle
  const [useLLMReasoning, setUseLLMReasoning] = useState(true) // true = always LLM (recommended for GPT-5.1), false = pattern + LLM fallback
  
  // Reasoning chat state
  const [isReasoningOpen, setIsReasoningOpen] = useState(true) // Open by default to see streaming
  const reasoningEndRef = useRef<HTMLDivElement>(null) // Auto-scroll target
  const chatInputRef = useRef<HTMLTextAreaElement>(null) // Chat input ref
  
  // Use CANVAS-LEVEL chat history (persistent across all generations)
  const reasoningMessages: ReasoningMessage[] = canvasChatHistory
  
  // Detect if streaming (last message is from model and being updated)
  const isStreaming = reasoningMessages.length > 0 && 
    reasoningMessages[reasoningMessages.length - 1].role === 'orchestrator' &&
    reasoningMessages[reasoningMessages.length - 1].content.startsWith('🤖 Model')
  
  // Build external content map for connected story structure nodes
  // This injects Supabase content that's not in the node's local state
  const externalContentMap: Record<string, { contentMap: Record<string, string> }> = {}
  
  // If we have a currently loaded story structure with content from Supabase, inject it
  if (currentStoryStructureNodeId && contentMap && Object.keys(contentMap).length > 0) {
    externalContentMap[currentStoryStructureNodeId] = {
      contentMap: contentMap
    }
    console.log('💉 [Content Injection] Injecting Supabase content for node:', {
      nodeId: currentStoryStructureNodeId,
      sectionsWithContent: Object.keys(contentMap).length,
      totalWords: Object.values(contentMap).reduce((sum, content) => sum + content.split(/\s+/).length, 0)
    })
  }
  
  // Also check node's own contentMap as fallback (might be from Test nodes or other sources)
  canvasNodes.forEach(node => {
    if ((node.type === 'storyStructureNode' || node.data?.nodeType === 'story-structure') && 
        !externalContentMap[node.id]) {
      if (node.data?.contentMap && Object.keys(node.data.contentMap).length > 0) {
        externalContentMap[node.id] = {
          contentMap: node.data.contentMap
        }
      }
    }
  })
  
  // Build canvas context - orchestrator's "eyes" on the canvas
  const canvasContext = buildCanvasContext('context', canvasNodes, canvasEdges, externalContentMap)
  
  // Track canvas state to detect changes
  const [lastCanvasState, setLastCanvasState] = useState<string>('')
  const currentCanvasState = JSON.stringify({
    nodes: canvasContext.connectedNodes.map(n => ({ id: n.nodeId, label: n.label, sections: n.detailedContext?.allSections?.length || 0 })),
    edges: canvasEdges.length
  })
  
  // Debug logging
  console.log('🔍 [Canvas Context Debug]', {
    canvasNodesCount: canvasNodes.length,
    canvasEdgesCount: canvasEdges.length,
    connectedNodesFound: canvasContext.connectedNodes.length,
    externalContentMapKeys: Object.keys(externalContentMap),
    canvasNodes: canvasNodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label, hasContentMap: !!n.data?.contentMap })),
    canvasEdges: canvasEdges.map(e => ({ source: e.source, target: e.target })),
    orchestratorId: 'context'
  })
  
  /**
   * Agentic message handler - analyzes intent and routes to appropriate action
   */
  // Handle template selection (both button click and conversational)
  const handleTemplateSelection = async (templateId: string, templateName?: string) => {
    if (!pendingCreation) return
    
    // Clear pending creation
    const creation = pendingCreation
    setPendingCreation(null)
    
    if (onAddChatMessage) {
      onAddChatMessage(`✨ Great choice! Creating ${creation.format} with "${templateName || templateId}" template...`, 'orchestrator', 'result')
      onAddChatMessage(`🏗️ Planning structure with orchestrator model...`, 'orchestrator', 'thinking')
    }
    
    // Create with selected template
    onCreateStory(creation.format, templateId, creation.enhancedPrompt)
  }

  // ============================================================
  // NEW ORCHESTRATOR ARCHITECTURE
  // ============================================================
  
  const handleSendMessage_NEW = async (message: string) => {
    // Add user message to chat
    if (onAddChatMessage) {
      onAddChatMessage(message, 'user')
    }
    setChatMessage('')
    
    // Show canvas context if changed
    const currentCanvasState = JSON.stringify(canvasNodes.map(n => ({ id: n.id, type: n.type })))
    if (onAddChatMessage && canvasContext.connectedNodes.length > 0 && currentCanvasState !== lastCanvasState) {
      onAddChatMessage(`👁️ Canvas visibility: ${canvasContext.connectedNodes.length} node(s) connected`, 'orchestrator', 'thinking')
      canvasContext.connectedNodes.forEach(ctx => {
        onAddChatMessage(`   • ${ctx.label}: ${ctx.summary}`, 'orchestrator', 'thinking')
      })
      setLastCanvasState(currentCanvasState)
    }
    
    try {
      // Get user ID from Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }
      
      if (onAddChatMessage) {
        onAddChatMessage(`🧠 Analyzing your request...`, 'orchestrator', 'thinking')
      }
      
      // Call the new orchestrator
      const response = await getOrchestrator(user.id).orchestrate({
        message,
        canvasNodes,
        canvasEdges,
        activeContext: activeContext || undefined, // Convert null to undefined
        isDocumentViewOpen,
        documentFormat: selectedFormat,
        structureItems,
        contentMap,
        currentStoryStructureNodeId
      })
      
      // Display reasoning
      if (onAddChatMessage) {
        onAddChatMessage(`⚡ Intent: ${response.intent} (${Math.round(response.confidence * 100)}%)`, 'orchestrator', 'decision')
        onAddChatMessage(`💭 ${response.reasoning}`, 'orchestrator', 'thinking')
        onAddChatMessage(`🤖 Model: ${response.modelUsed}`, 'orchestrator', 'model')
      }
      
      // Execute actions generated by the orchestrator
      if (response.actions.length > 0) {
        console.log('🎬 [Orchestrator] Executing actions:', response.actions)
        
        if (onAddChatMessage) {
          onAddChatMessage(`🚀 Executing ${response.actions.length} action(s)...`, 'orchestrator', 'thinking')
        }
        
        for (const action of response.actions) {
          console.log('▶️ [Orchestrator] Executing action:', action.type, action.payload)
          await executeAction(action)
        }
        
        if (onAddChatMessage) {
          onAddChatMessage(`✅ Actions completed!`, 'orchestrator', 'result')
        }
      } else {
        // No actions generated - inform user
        console.warn('⚠️ [Orchestrator] No actions generated for intent:', response.intent)
        if (onAddChatMessage) {
          onAddChatMessage(`💡 I understood your intent (${response.intent}) but couldn't generate specific actions. Could you provide more details?`, 'orchestrator', 'result')
        }
      }
      
    } catch (error) {
      console.error('❌ Orchestration error:', error)
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
      }
    }
  }
  
  // Helper: Execute action based on intent (uses OLD implementation logic)
  const handleSendMessage_OLD_ExecuteOnly = async (message: string, intent: UserIntent) => {
    // Execute the action using the OLD handler's proven logic
    // But with context awareness from the NEW orchestrator
    
    switch (intent) {
      case 'answer_question': {
        // Build a context-aware prompt that includes ALL canvas nodes
        let enhancedPrompt = `User Question: ${message}\n\n`
        
        // Add canvas context (structure and summaries from ALL connected nodes)
        if (canvasContext.connectedNodes.length > 0) {
          enhancedPrompt += `Available Context from Canvas:\n`
          canvasContext.connectedNodes.forEach(node => {
            enhancedPrompt += `\n--- ${node.label} (${node.nodeType}) ---\n`
            enhancedPrompt += `Summary: ${node.summary}\n`
            
            if (node.detailedContext?.structure) {
              enhancedPrompt += `Structure:\n${node.detailedContext.structure}\n`
            }
            
            // If there's actual content, include it
            if (node.detailedContext?.contentMap && currentStoryStructureNodeId === node.nodeId) {
              const contentEntries = Object.entries(node.detailedContext.contentMap)
              if (contentEntries.length > 0) {
                enhancedPrompt += `\nContent (${contentEntries.length} sections):\n`
                contentEntries.slice(0, 5).forEach(([sectionId, content]: [string, any]) => {
                  if (content && content.trim()) {
                    const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content
                    enhancedPrompt += `\n${truncated}\n`
                  }
                })
              }
            }
          })
        }
        
        // Call the answer handler with enhanced prompt
        if (onAnswerQuestion) {
          const answer = await onAnswerQuestion(enhancedPrompt)
          if (onAddChatMessage) {
            onAddChatMessage(`📖 ${answer}`, 'orchestrator', 'result')
          }
        }
        break
      }
        
      case 'write_content':
        if (activeContext && onWriteContent) {
          await onWriteContent(activeContext.id, message)
        }
        break
        
      case 'create_structure':
        onCreateStory(selectedFormat, selectedTemplate || undefined, message)
        break
        
      case 'general_chat':
      default:
        // For general chat, also use enhanced context
        if (onAnswerQuestion) {
          const answer = await onAnswerQuestion(message)
          if (onAddChatMessage) {
            onAddChatMessage(`💬 ${answer}`, 'orchestrator', 'result')
          }
        }
        break
    }
  }
  
  // Action executor - handles actions from the orchestrator
  const executeAction = async (action: OrchestratorAction) => {
    try {
      switch (action.type) {
        case 'message':
          if (onAddChatMessage) {
            onAddChatMessage(action.payload.content, 'orchestrator', action.payload.type || 'result')
          }
          break
          
        case 'open_document':
          if (onSelectNode) {
            onSelectNode(action.payload.nodeId, action.payload.sectionId)
          }
          if (!isDocumentViewOpen && onToggleDocumentView) {
            onToggleDocumentView()
          }
          break
          
        case 'select_section':
          if (onSelectNode && currentStoryStructureNodeId) {
            onSelectNode(currentStoryStructureNodeId, action.payload.sectionId)
          }
          break
          
        case 'generate_content':
          // Handle both answer generation and content writing
          if (action.payload.isAnswer && onAnswerQuestion) {
            // This is an answer to a question
            const answer = await onAnswerQuestion(action.payload.prompt)
            if (onAddChatMessage) {
              onAddChatMessage(`📖 ${answer}`, 'orchestrator', 'result')
            }
          } else if (action.payload.sectionId && onWriteContent) {
            // This is content for a specific section
            await onWriteContent(action.payload.sectionId, action.payload.prompt)
          }
          break
          
        case 'modify_structure':
          // Handle structure creation/modification
          if (action.payload.action === 'create') {
            onCreateStory(
              action.payload.format || selectedFormat,
              selectedTemplate || undefined,
              action.payload.prompt
            )
          }
          break
          
        default:
          console.warn('Unknown action type:', action.type)
      }
    } catch (error) {
      console.error('Action execution error:', error)
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
      }
    }
  }
  
  // ============================================================
  // OLD ORCHESTRATOR (BACKUP - TO BE REMOVED)
  // ============================================================
  
  const handleSendMessage_OLD = async (message: string) => {
    // Check if user is responding to template selection
    if (pendingCreation) {
      // Parse conversational template selection
      const lowerMessage = message.toLowerCase()
      const availableTemplates = templates[pendingCreation.format] || []
      
      // Try to match user response to a template
      for (const template of availableTemplates) {
        const templateNameLower = template.name.toLowerCase()
        const templateWords = templateNameLower.split(' ')
        
        // Match: "the interview one", "interview format", "interview", "the first one", etc.
        if (
          lowerMessage.includes(templateNameLower) ||
          templateWords.some(word => lowerMessage.includes(word)) ||
          (lowerMessage.includes('first') && availableTemplates[0] && template.id === availableTemplates[0].id) ||
          (lowerMessage.includes('blank') && template.id === 'blank')
        ) {
          if (onAddChatMessage) {
            onAddChatMessage(message, 'user')
          }
          setChatMessage('') // Clear input immediately
          await handleTemplateSelection(template.id, template.name)
          return
        }
      }
      
      // Didn't match any template - ask for clarification
      if (onAddChatMessage) {
        onAddChatMessage(message, 'user')
        onAddChatMessage(`🤔 I didn't quite catch which template you want. Could you click one of the options below or be more specific?`, 'orchestrator', 'result')
      }
      setChatMessage('') // Clear input immediately
      return
    }
    
    // Add user message to chat history
    if (onAddChatMessage) {
      onAddChatMessage(message, 'user')  // Actual user input
    }
    
    // Clear input immediately after adding to chat (better UX)
    setChatMessage('')
    
    // Prepare conversation history for context resolution (used by findReferencedNode)
    const conversationForContext = reasoningMessages
      .filter(m => m.role === 'user' || m.role === 'orchestrator')
      .slice(-5)
      .map(m => ({ role: m.role || 'orchestrator', content: m.content }))
    
    // Show canvas context ONLY if it changed (new nodes, new sections, etc.)
    if (onAddChatMessage && canvasContext.connectedNodes.length > 0 && currentCanvasState !== lastCanvasState) {
      onAddChatMessage(`👁️ Canvas visibility: ${canvasContext.connectedNodes.length} node(s) connected`)
      canvasContext.connectedNodes.forEach(ctx => {
        onAddChatMessage(`   • ${ctx.label}: ${ctx.summary}`)
      })
      setLastCanvasState(currentCanvasState)
    }
    
    // STEP 0.5: Enhance context with RAG (semantic search) if available
    let ragEnhancedContext
    if (canvasContext.connectedNodes.length > 0) {
      if (onAddChatMessage) {
        onAddChatMessage(`🔍 Checking for semantic search availability...`, 'orchestrator', 'thinking')
      }
      
      try {
        ragEnhancedContext = await enhanceContextWithRAG(message, canvasContext, undefined, conversationForContext)
        
        if (ragEnhancedContext.hasRAG) {
          if (onAddChatMessage) {
            onAddChatMessage(`✅ Semantic search active: Found ${ragEnhancedContext.ragStats?.resultsFound || 0} relevant chunks from "${ragEnhancedContext.referencedNode?.label}"`, 'orchestrator', 'result')
            onAddChatMessage(`   📊 Average relevance: ${Math.round((ragEnhancedContext.ragStats?.averageSimilarity || 0) * 100)}%`, 'orchestrator', 'result')
          }
        } else if (ragEnhancedContext.fallbackReason) {
          if (onAddChatMessage) {
            onAddChatMessage(`⚠️ Semantic search unavailable: ${ragEnhancedContext.fallbackReason}`, 'orchestrator', 'error')
          }
        }
      } catch (error) {
        console.error('RAG enhancement error:', error)
        if (onAddChatMessage) {
          onAddChatMessage(`⚠️ Could not use semantic search, continuing with standard context`, 'orchestrator', 'error')
        }
      }
    }
    
    // STEP 1: Analyze user intent using Hybrid IntentRouter
    if (onAddChatMessage) {
      onAddChatMessage(`🧠 Analyzing your request...`, 'orchestrator', 'thinking')
    }
    
    const intentAnalysis = await analyzeIntent({
      message,
      hasActiveSegment: !!activeContext,
      activeSegmentName: activeContext?.name,
      activeSegmentId: activeContext?.id,
      activeSegmentHasContent: false, // TODO: Track if segment has content
      conversationHistory: canvasChatHistory
        .filter(msg => msg.role === 'user' || (msg.role === 'orchestrator' && msg.type === 'user'))
        .slice(-10) // Increased from 5 to 10 for better context
        .map(msg => ({
          role: (msg.role === 'orchestrator' ? 'assistant' : msg.role) || 'user',
          content: msg.content,
          timestamp: msg.timestamp
        })),
      documentStructure: structureItems, // Pass current document structure
      isDocumentViewOpen: isDocumentViewOpen, // CRITICAL: Tell intent analyzer about document state
      documentFormat: selectedFormat, // Novel, Report, etc.
      useLLM: useLLMReasoning, // NEW: Force LLM reasoning if toggle is on
      canvasContext: ragEnhancedContext?.hasRAG 
        ? buildRAGEnhancedPrompt('', ragEnhancedContext, canvasContext)
        : formatCanvasContextForLLM(canvasContext) // NEW: RAG-enhanced or standard canvas visibility!
    })
    
    // Log intent analysis to reasoning chat
    if (onAddChatMessage) {
      const method = intentAnalysis.usedLLM ? '🧠 LLM Reasoning' : '⚡ Pattern Matching'
      onAddChatMessage(`${method}: ${explainIntent(intentAnalysis)} (Confidence: ${Math.round(intentAnalysis.confidence * 100)}%)`, 'orchestrator', 'decision')
      onAddChatMessage(`💭 ${intentAnalysis.reasoning}`, 'orchestrator', 'thinking')
    }
    
    // STEP 1.5: Handle clarifying questions
    if (intentAnalysis.needsClarification && intentAnalysis.clarifyingQuestion) {
      if (onAddChatMessage) {
        onAddChatMessage(`❓ ${intentAnalysis.clarifyingQuestion}`)
      }
      return
    }
    
    // STEP 2: Validate intent can be executed
    const validation = validateIntent(intentAnalysis, !!activeContext)
    
    if (!validation.canExecute) {
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Cannot execute: ${validation.errorMessage}`)
        if (validation.suggestion) {
          onAddChatMessage(`💡 ${validation.suggestion}`)
        }
      }
      return
    }
    
    // STEP 3: Route to appropriate action based on intent
    try {
      switch (intentAnalysis.intent) {
        case 'write_content':
          // Write content to selected segment
          if (onAddChatMessage) {
            onAddChatMessage(`📝 Delegating to writer model: ${intentAnalysis.suggestedModel}`, 'orchestrator', 'thinking')
          }
          
          // Smart Section Detection: Find target section from message if none selected
          let writeTargetId = activeContext?.id
          
          if (!writeTargetId) {
            // Try to get structure from props or canvas context
            const availableStructure = structureItems.length > 0 ? structureItems : 
                                      (canvasContext.connectedNodes.find(n => n.nodeType === 'story-structure')?.detailedContext?.allSections || [])
            
            console.log('[write_content] Section detection:', {
              hasActiveContext: !!activeContext,
              structureItemsCount: structureItems.length,
              canvasContextNodes: canvasContext.connectedNodes.length,
              availableStructureCount: availableStructure.length,
              message: message.substring(0, 50)
            })
            
            if (availableStructure.length > 0) {
              const lowerMessage = message.toLowerCase()
              const matchedSection = availableStructure.find((item: any) => {
                const name = item.name.toLowerCase()
                // Match full name or key parts
                return lowerMessage.includes(name) || 
                       // Match partial names like "welfare" for "Animal Welfare Consideration"
                       name.split(' ').some((word: string) => word.length > 4 && lowerMessage.includes(word))
              })
              
              if (matchedSection) {
                writeTargetId = matchedSection.id
                if (onAddChatMessage) {
                  onAddChatMessage(`🎯 Auto-selecting section: "${matchedSection.name}"`, 'orchestrator', 'result')
                }
                // Auto-select the section visually
                if (currentStoryStructureNodeId && onSelectNode) {
                  onSelectNode(currentStoryStructureNodeId, writeTargetId)
                }
              } else {
                console.log('[write_content] No section matched. Available sections:', availableStructure.map((s: any) => s.name))
              }
            }
          }
          
          if (writeTargetId && onWriteContent) {
            await onWriteContent(writeTargetId, message)
          } else {
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Cannot execute: Action "write_content" requires a selected segment`, 'orchestrator', 'error')
              onAddChatMessage(`💡 Please click on a section in the document view to select it first`, 'orchestrator', 'result')
            }
          }
          break
        
        case 'improve_content':
          // Improve existing content in selected segment
          if (onAddChatMessage) {
            onAddChatMessage(`✨ Delegating to editor model: ${intentAnalysis.suggestedModel}`)
          }
          
          if (activeContext && onWriteContent) {
            const improvePrompt = `Improve the following content:\n\n${message}`
            await onWriteContent(activeContext.id, improvePrompt)
          } else {
            // Fallback
            onCreateStory(selectedFormat, selectedTemplate || undefined, `Improve: ${message}`)
          }
          break
        
        case 'rewrite_with_coherence':
          // Ghostwriter-level coherent rewriting across multiple sections
          if (onAddChatMessage) {
            onAddChatMessage(`🎭 Activating ghostwriter mode - analyzing story dependencies...`)
          }
          
          if (!activeContext) {
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Please select a section to rewrite first.`)
            }
            break
          }
          
          // Import the coherence rewriter dynamically
          const { createCoherenceRewritePlan, executeRewriteStep } = await import('@/lib/orchestrator/coherenceRewriter')
          
          // Get all sections and their content for dependency analysis
          // TODO: Pass from props - for now, use placeholder
          const allSections = structureItems || []
          const existingContent: Record<string, string> = contentMap || {}
          
          // Create the rewrite plan
          if (onAddChatMessage) {
            onAddChatMessage(`🔍 Analyzing which sections will be affected...`)
          }
          
          try {
            const plan = await createCoherenceRewritePlan({
              targetSectionId: activeContext.id,
              userRequest: message,
              allSections: allSections.map(item => ({
                id: item.id,
                name: item.name,
                level: item.level,
                order: item.order,
                content: existingContent[item.id],
                parentId: item.parentId
              })),
              existingContent,
              storyFormat: selectedFormat
            })
            
            // Show the plan to the user
            if (onAddChatMessage) {
              onAddChatMessage(plan.reasoning)
              onAddChatMessage(`\n⏱️ This will take approximately ${plan.estimatedTime}`)
              onAddChatMessage(`\n🚀 Starting ${plan.totalSteps}-step rewrite process...`)
            }
            
            // Execute each step sequentially
            for (const step of plan.steps) {
              if (onAddChatMessage) {
                onAddChatMessage(`\n📝 Step ${step.stepNumber}/${plan.totalSteps}: ${step.action.toUpperCase()} "${step.sectionName}"`)
                onAddChatMessage(`   ${step.reason}`)
              }
              
              const result = await executeRewriteStep(step, {
                targetSectionId: activeContext.id,
                userRequest: message,
                allSections: allSections.map(item => ({
                  id: item.id,
                  name: item.name,
                  level: item.level,
                  order: item.order,
                  content: existingContent[item.id],
                  parentId: item.parentId
                })),
                existingContent,
                storyFormat: selectedFormat
              })
              
              if (result.success && result.content) {
                // Update the content map with new content
                existingContent[step.sectionId] = result.content
                
                // Save to database if onWriteContent is available
                if (onWriteContent) {
                  await onWriteContent(step.sectionId, result.content)
                }
                
                if (onAddChatMessage) {
                  onAddChatMessage(`   ✅ Completed - ${result.content.split(/\s+/).length} words`)
                }
              } else {
                if (onAddChatMessage) {
                  onAddChatMessage(`   ❌ Failed: ${result.error}`)
                }
                // Continue with remaining steps even if one fails
              }
            }
            
            // Final success message
            if (onAddChatMessage) {
              onAddChatMessage(`\n🎉 Ghostwriter rewrite complete! All ${plan.totalSteps} sections updated with narrative coherence maintained.`)
            }
            
          } catch (planError: any) {
            console.error('❌ Coherence rewrite failed:', planError)
            if (onAddChatMessage) {
              onAddChatMessage(`❌ Ghostwriter mode failed: ${planError.message}`)
            }
          }
          break
        
        case 'answer_question':
          // Answer question using orchestrator model with canvas context (STREAMING)
          if (onAddChatMessage) {
            onAddChatMessage(`💬 Answering with orchestrator model...`, 'orchestrator', 'thinking')
          }
          
          // Build context-aware prompt
          let questionPrompt = message
          
          // Add canvas context if available
          if (canvasContext.connectedNodes.length > 0) {
            let contextSummary = ''
            let totalContentChars = 0
            
            // Build detailed context from each node
            canvasContext.connectedNodes.forEach(node => {
              contextSummary += `\n--- ${node.label} (${node.nodeType}) ---\n`
              contextSummary += `Summary: ${node.summary}\n`
              
              // If it's a story structure node with actual content, include it!
              if (node.nodeType === 'story-structure' && node.detailedContext?.contentMap) {
                const contentMap = node.detailedContext.contentMap as Record<string, string>
                const contentEntries = Object.entries(contentMap)
                
                if (contentEntries.length > 0) {
                  contextSummary += `\nContent (${contentEntries.length} sections):\n`
                  
                  // Include content from sections (limit to prevent overwhelming the context)
                  contentEntries.slice(0, 10).forEach(([sectionId, content]) => {
                    if (content && content.trim()) {
                      const sectionInfo = node.detailedContext?.allSections?.find((s: any) => s.id === sectionId)
                      const sectionName = sectionInfo?.name || sectionId
                      
                      // Truncate very long sections to keep context manageable
                      const truncatedContent = content.length > 1000 
                        ? content.substring(0, 1000) + '...' 
                        : content
                      
                      contextSummary += `\n## ${sectionName}\n${truncatedContent}\n`
                      totalContentChars += truncatedContent.length
                    }
                  })
                  
                  if (contentEntries.length > 10) {
                    contextSummary += `\n(... ${contentEntries.length - 10} more sections available)\n`
                  }
                }
              }
              
              // Include structure information
              if (node.detailedContext?.structure) {
                contextSummary += `\nStructure:\n${node.detailedContext.structure}\n`
              }
              
              contextSummary += '\n'
            })
            
            questionPrompt = `User Question: ${message}\n\nAvailable Context from Canvas:${contextSummary}`
            
            // Add RAG-enhanced content if available (this would supplement the above)
            if (ragEnhancedContext?.hasRAG && ragEnhancedContext.ragContent) {
              questionPrompt += `\n\nAdditional Relevant Content (from semantic search):\n${ragEnhancedContext.ragContent}`
            } else if (ragEnhancedContext?.fallbackReason?.includes('No relevant content found') && ragEnhancedContext.referencedNode) {
              // RAG found no relevant chunks - fetch all content from database as fallback
              if (onAddChatMessage) {
                onAddChatMessage(`📚 Fetching document content (no semantically relevant chunks found)...`, 'orchestrator', 'thinking')
              }
              
              try {
                const nodeId = ragEnhancedContext.referencedNode.nodeId
                const { data: allSections, error } = await supabase
                  .from('document_sections')
                  .select('id, content, structure_item_id')
                  .eq('story_structure_node_id', nodeId)
                  .limit(15) // Get first 15 sections
                
                if (!error && allSections && allSections.length > 0) {
                  let fallbackContent = '\n\nDocument Content (all sections):\n'
                  let totalChars = 0
                  
                  allSections.forEach(section => {
                    if (section.content && section.content.trim()) {
                      const truncated = section.content.length > 800 
                        ? section.content.substring(0, 800) + '...' 
                        : section.content
                      fallbackContent += `\n---\n${truncated}\n`
                      totalChars += truncated.length
                    }
                  })
                  
                  questionPrompt += fallbackContent
                  
                  if (onAddChatMessage) {
                    onAddChatMessage(`📄 Retrieved ${allSections.length} sections (~${Math.round(totalChars/5)} words)`, 'orchestrator', 'result')
                  }
                }
              } catch (fetchError) {
                console.error('Failed to fetch fallback content:', fetchError)
              }
            }
            
            if (onAddChatMessage) {
              onAddChatMessage(`📚 Using context from ${canvasContext.connectedNodes.length} connected node(s)`, 'orchestrator', 'result')
              if (totalContentChars > 0) {
                const wordCount = Math.round(totalContentChars / 5)
                onAddChatMessage(`📄 Including ~${wordCount} words of actual content`, 'orchestrator', 'result')
              }
              if (ragEnhancedContext?.hasRAG) {
                onAddChatMessage(`🎯 Enhanced with ${ragEnhancedContext.ragStats?.resultsFound || 0} relevant chunks`, 'orchestrator', 'result')
              }
            }
          }
          
          // Call API with streaming support
          try {
            const response = await fetch('/api/content/answer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                question: questionPrompt,
                context: {
                  storyStructureNodeId: currentStoryStructureNodeId,
                  structureItems: structureItems,
                  contentMap: contentMap,
                  activeContext
                }
              })
            })
            
            if (!response.ok) {
              throw new Error(`Failed to answer question: ${response.statusText}`)
            }
            
            // Handle streaming response
            const reader = response.body?.getReader()
            const decoder = new TextDecoder()
            let streamedText = ''
            
            if (reader) {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                
                const chunk = decoder.decode(value, { stream: true })
                streamedText += chunk
                
                // Log progress (we'll add a proper streaming UI update later)
                console.log('📖 Streaming...', streamedText.length, 'chars')
              }
              
              // After streaming is complete, add the full message
              if (onAddChatMessage && streamedText) {
                onAddChatMessage(`📖 ${streamedText}`, 'orchestrator', 'result')
              }
            }
          } catch (error) {
            console.error('Failed to answer question:', error)
            if (onAddChatMessage) {
              onAddChatMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
            }
          }
          break
        
        case 'create_structure':
          // Create new story structure (Allowed even if document panel is open)
          
          // CANVAS INTELLIGENCE: Check if user is referencing connected nodes
          let enhancedPrompt = message
          const referencePhrases = [
            'our screenplay', 'the screenplay', 'that screenplay',
            'our story', 'our other story', 'that story', 'our stories', 'the stories', 'these stories',
            'the document', 'that document', 'our documents', 'the documents',
            'the characters', 'characters in', 'characters from',
            'based on', 'base this on', 'based upon', 'base it on', 'using the', 'using our',
            'from the', 'from our', 'adapt', 'stories we have', 'documents we have',
          ]
          
          // Detect plural references (user wants ALL stories, not just one)
          const pluralPhrases = [
            'our stories', 'the stories', 'these stories', 'all stories', 'all the stories',
            'our documents', 'the documents', 'these documents', 'all documents',
            'stories we have', 'documents we have', 'everything we have'
          ]
          const wantsAllStories = pluralPhrases.some(phrase => message.toLowerCase().includes(phrase))
          
          const hasReference = referencePhrases.some(phrase => message.toLowerCase().includes(phrase)) || 
                              (canvasContext.connectedNodes.length > 0 && 
                               (message.toLowerCase().includes('interview') || 
                                message.toLowerCase().includes('characters')))
          
          if (hasReference && canvasContext.connectedNodes.length > 0) {
            if (wantsAllStories) {
              // User wants content from ALL story nodes!
              if (onAddChatMessage) {
                onAddChatMessage(`📚 Reading content from ${canvasContext.connectedNodes.filter(n => n.nodeType === 'story-structure').length} connected stories...`, 'orchestrator', 'thinking')
              }
              
              const allStoryContent: string[] = []
              let totalWords = 0
              
              for (const node of canvasContext.connectedNodes) {
                if (node.nodeType === 'story-structure' && node.detailedContext) {
                  const contentMap = node.detailedContext.contentMap as Record<string, string> || {}
                  const allSections = node.detailedContext.allSections || []
                  const hasContent = Object.keys(contentMap).length > 0
                  
                  if (hasContent) {
                    const storyContent = Object.entries(contentMap)
                      .map(([sectionId, content]) => {
                        const section = allSections.find((s: any) => s.id === sectionId)
                        return `### ${section?.name || 'Section'}\n${content}`
                      })
                      .join('\n\n')
                    
                    allStoryContent.push(`## ${node.label} (${node.detailedContext.format})\n\n${storyContent.substring(0, 5000)}`)
                    totalWords += node.detailedContext.wordsWritten || 0
                  } else {
                    // Include structure even if no content
                    const structureDetails = allSections
                      .map((s: any) => `${'  '.repeat(s.level - 1)}- ${s.name}${s.summary ? ': ' + s.summary : ''}`)
                      .join('\n')
                    allStoryContent.push(`## ${node.label} (${node.detailedContext.format})\n\nStructure:\n${structureDetails}`)
                  }
                }
              }
              
              if (allStoryContent.length > 0) {
                enhancedPrompt = `${message}

REFERENCE CONTENT FROM ALL CONNECTED STORIES:

${allStoryContent.join('\n\n---\n\n')}

INSTRUCTION: Use the above stories as inspiration for creating the new podcast structure. Extract characters, themes, plot points, and narrative elements from ALL the stories above. ${message.toLowerCase().includes('interview') || message.toLowerCase().includes('character') ? 'Identify all named characters across these stories, their roles, personalities, and characteristics. Build the podcast around interviewing or featuring these characters.' : ''}`

                if (onAddChatMessage) {
                  onAddChatMessage(`✅ Extracted content from ${allStoryContent.length} story nodes (~${totalWords} words total)`, 'orchestrator', 'result')
                }
              }
            } else {
              // Find a single referenced node (with conversation history for context)
              const referencedNode = findReferencedNode(message, canvasContext, conversationForContext)
            
            if (referencedNode && referencedNode.detailedContext) {
              if (onAddChatMessage) {
                onAddChatMessage(`📖 Reading content from "${referencedNode.label}"...`)
              }
              
              // Extract detailed content based on node type
              if (referencedNode.nodeType === 'story-structure') {
                const contentMap = referencedNode.detailedContext.contentMap as Record<string, string> || {}
                const allSections = referencedNode.detailedContext.allSections || []
                
                // Try to extract written content first
                const hasWrittenContent = Object.keys(contentMap).length > 0
                
                if (hasWrittenContent) {
                  // Extract full story content
                  const allContent = Object.entries(contentMap)
                    .map(([sectionId, content]) => {
                      const section = allSections.find((s: any) => s.id === sectionId)
                      return `## ${section?.name || 'Section'}\n${content}`
                    })
                    .join('\n\n')
                  
                  // Enhance prompt with actual content
                  enhancedPrompt = `${message}

REFERENCE CONTENT FROM "${referencedNode.label}" (${referencedNode.detailedContext.format}):

STRUCTURE:
${referencedNode.detailedContext.structure}

FULL CONTENT:
${allContent.substring(0, 8000)}

${allContent.length > 8000 ? '... (content truncated for length)' : ''}

INSTRUCTION: Use the above ${referencedNode.detailedContext.format} content as inspiration for creating the new ${selectedFormat} structure. 

${message.toLowerCase().includes('interview') || message.toLowerCase().includes('character') ? 
`FOCUS ON CHARACTERS: The user wants to feature the characters from this content. Carefully read through the content above and identify all named characters, their roles, personalities, and key characteristics. Build the ${selectedFormat} structure around interviewing or featuring these specific characters.` : 
`Extract characters, themes, plot points, and narrative elements to adapt them for the ${selectedFormat} format.`}`

                  if (onAddChatMessage) {
                    onAddChatMessage(`✅ Extracted ${Object.keys(contentMap).length} sections (${referencedNode.detailedContext.wordsWritten} words) from "${referencedNode.label}"`)
                    onAddChatMessage(`🎯 Creating new ${selectedFormat} inspired by this content...`)
                  }
                } else {
                  // Use structure summaries if no written content yet
                  const structureDetails = allSections
                    .map((s: any) => `${'  '.repeat(s.level - 1)}- ${s.name}${s.summary ? ': ' + s.summary : ''}`)
                    .join('\n')
                  
                  enhancedPrompt = `${message}

REFERENCE STRUCTURE FROM "${referencedNode.label}" (${referencedNode.detailedContext.format}):

${structureDetails}

INSTRUCTION: Use the above ${referencedNode.detailedContext.format} structure and summaries as inspiration for creating the new ${selectedFormat} structure.`

                  if (onAddChatMessage) {
                    onAddChatMessage(`✅ Using structure from "${referencedNode.label}" (${allSections.length} sections)`)
                    onAddChatMessage(`ℹ️ Note: No written content found, using structure summaries only`)
                  }
                }
              } else if (referencedNode.nodeType === 'test' && referencedNode.detailedContext.markdown) {
                // Use markdown content from test node
                const markdown = referencedNode.detailedContext.markdown as string
                enhancedPrompt = `${message}

REFERENCE CONTENT:
${markdown.substring(0, 8000)}

${markdown.length > 8000 ? '... (content truncated for length)' : ''}

Use the above content as inspiration for creating the new ${selectedFormat} structure.`

                if (onAddChatMessage) {
                  onAddChatMessage(`✅ Extracted ${referencedNode.detailedContext.wordCount} words from "${referencedNode.label}"`)
                }
              }
            } else if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Found node "${referencedNode?.label}" but couldn't extract content. Proceeding with user prompt only.`)
            }
            } // Close the else block for single-node extraction
          }
          
          // Detect format from user message
          const detectedFormat = detectFormatFromMessage(message)
          const formatToUse = detectedFormat || selectedFormat
          
          // Store pending creation and ask for template choice
          setPendingCreation({
            format: formatToUse,
            userMessage: message,
            referenceNode: hasReference ? findReferencedNode(message, canvasContext, conversationForContext) : undefined,
            enhancedPrompt: enhancedPrompt
          })
          
          // Show template options to user
          const formatLabel = storyFormats.find(f => f.type === formatToUse)?.label || formatToUse
          const availableTemplates = templates[formatToUse] || []
          
          if (onAddChatMessage) {
            onAddChatMessage(`📝 Great! Let's create a ${formatLabel}. What style would you like?`, 'orchestrator', 'result')
          }
          
          // Template options will be shown in the UI below chat
          break
        
        case 'modify_structure':
          // Modify existing structure (add/remove sections within current document)
          if (!isDocumentViewOpen) {
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Cannot modify structure without an open document. Open a document first.`)
            }
            break
          }
          
          if (onAddChatMessage) {
            onAddChatMessage(`🔧 Modifying document structure...`)
          }
          
          // Smart Section Detection: Find target section from message if none selected
          let modTargetId = activeContext?.id
          
          if (!modTargetId && structureItems.length > 0) {
            const lowerMessage = message.toLowerCase()
            const matchedSection = structureItems.find(item => {
              const name = item.name.toLowerCase()
              return lowerMessage.includes(name) || 
                     (name.includes('sequence') && lowerMessage.includes('sequence') && lowerMessage.includes(item.name.split(' ').pop()?.toLowerCase() || ''))
            })
            
            if (matchedSection) {
              modTargetId = matchedSection.id
              if (onAddChatMessage) {
                onAddChatMessage(`🎯 Identified target section: "${matchedSection.name}"`, 'orchestrator', 'thinking')
              }
              // Auto-select the section visually
              if (currentStoryStructureNodeId && onSelectNode) {
                onSelectNode(currentStoryStructureNodeId, modTargetId)
              }
            }
          }
          
          // For now, treat structure modification as content generation for the target section
          // TODO: Implement proper structure modification (add/remove/reorder sections)
          if (modTargetId && onWriteContent) {
            // User wants to add content to a specific section (like "add to summary")
            await onWriteContent(modTargetId, message)
          } else {
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Structure modification requires a target section. Please click on a section or mention its name (e.g. "Sequence 2").`)
            }
          }
          break
        
        case 'clarify_intent':
          // This should be handled above, but just in case
          if (onAddChatMessage) {
            onAddChatMessage(`❓ I need more information. Could you clarify what you'd like me to do?`)
          }
          break
        
        case 'open_and_write':
          // HELPFUL MODE: User wants to write in an existing canvas node
          // Auto-open the document for them!
          if (onAddChatMessage) {
            onAddChatMessage(`📂 Finding the document to open...`, 'orchestrator', 'thinking')
          }
          
          // Identify which node to open (with conversation history for context)
          const nodeToOpen = findReferencedNode(message, canvasContext, conversationForContext)
          
          if (!nodeToOpen) {
            // No clear node reference - ask for clarification
            if (onAddChatMessage) {
              if (canvasContext.connectedNodes.length > 0) {
                const nodeList = canvasContext.connectedNodes.map(n => `• ${n.label}`).join('\n')
                onAddChatMessage(`❓ Which document would you like to work on?\n\n${nodeList}`, 'orchestrator', 'result')
              } else {
                onAddChatMessage(`⚠️ I don't see any documents connected to the orchestrator. Please connect a story node first.`, 'orchestrator', 'error')
              }
            }
            break
          }
          
          // Found a node - open it!
          if (onAddChatMessage) {
            onAddChatMessage(`✅ Opening "${nodeToOpen.label}" (${nodeToOpen.detailedContext?.format || 'document'}) for editing...`, 'orchestrator', 'result')
          }
          
          // Try to detect if user mentioned a specific section
          let targetSectionId: string | undefined
          if (nodeToOpen.detailedContext?.allSections) {
            const lowerMessage = message.toLowerCase()
            const sections = nodeToOpen.detailedContext.allSections as Array<{id: string, name: string, level: number}>
            
            // Find section that matches user's message
            const mentionedSection = sections.find((section: {id: string, name: string}) => {
              const lowerSectionName = section.name.toLowerCase()
              
              // Bidirectional matching: message contains section name OR section name contains message keywords
              if (lowerMessage.includes(lowerSectionName) || lowerSectionName.includes(lowerMessage.trim())) {
                return true
              }
              
              // Pattern matching for common references
              // "scene 1" → "Scene 1 – Opening Image"
              const sceneMatch = lowerMessage.match(/scene\s+(\d+)/i)
              if (sceneMatch && lowerSectionName.includes(`scene ${sceneMatch[1]}`)) {
                return true
              }
              
              // "act 1" → "Act I" or "Act 1"
              const actMatch = lowerMessage.match(/act\s+(\d+|i{1,3}|iv|v)/i)
              if (actMatch && (lowerSectionName.includes(`act ${actMatch[1]}`) || lowerSectionName.includes('act i'))) {
                return true
              }
              
              // "sequence 2" → "Sequence 2"
              const seqMatch = lowerMessage.match(/sequence\s+(\d+)/i)
              if (seqMatch && lowerSectionName.includes(`sequence ${seqMatch[1]}`)) {
                return true
              }
              
              // Common section keywords
              return (lowerMessage.includes('intro') && lowerSectionName.includes('intro')) ||
                     (lowerMessage.includes('background') && lowerSectionName.includes('background')) ||
                     (lowerMessage.includes('conclusion') && lowerSectionName.includes('conclusion')) ||
                     (lowerMessage.includes('opening') && lowerSectionName.includes('opening'))
            })
            
            if (mentionedSection) {
              targetSectionId = mentionedSection.id
              if (onAddChatMessage) {
                onAddChatMessage(`🎯 Auto-selecting "${mentionedSection.name}" section...`, 'orchestrator', 'result')
              }
            } else {
              // No section mentioned - default to Introduction (or first section)
              const defaultSection = sections.find((s: any) => 
                s.name.toLowerCase().includes('intro') || 
                s.name.toLowerCase().includes('opening') ||
                s.level === 1 // First top-level section
              ) || sections[0] // Fallback to first section
              
              if (defaultSection) {
                targetSectionId = defaultSection.id
                if (onAddChatMessage) {
                  onAddChatMessage(`📄 Opening to "${defaultSection.name}" (default section)...`, 'orchestrator', 'result')
                }
              }
            }
          }
          
          // Trigger document load (keeps orchestrator panel visible!)
          if (onSelectNode && nodeToOpen.nodeId) {
            console.log('🚀 [open_and_write] Calling onSelectNode:', {
              nodeId: nodeToOpen.nodeId,
              nodeName: nodeToOpen.label,
              targetSectionId,
              hasDetailedContext: !!nodeToOpen.detailedContext,
              format: nodeToOpen.detailedContext?.format,
              totalSections: nodeToOpen.detailedContext?.totalSections
            })
            onSelectNode(nodeToOpen.nodeId, targetSectionId)
          }
          
          // Open the document view if it's not already open
          if (!isDocumentViewOpen && onToggleDocumentView) {
            onToggleDocumentView()
          }
          
          // Guide the user
          setTimeout(() => {
            if (onAddChatMessage) {
              const sectionCount = nodeToOpen.detailedContext?.allSections?.length || 0
              if (targetSectionId) {
                onAddChatMessage(`📂 Document loaded and section selected!`, 'orchestrator', 'result')
                onAddChatMessage(`💡 Ready to write! Tell me what you'd like to add.`, 'orchestrator', 'result')
              } else {
                onAddChatMessage(`📂 Document loaded with ${sectionCount} section(s)!`, 'orchestrator', 'result')
                onAddChatMessage(`💡 **Next step**: Click on any section in the document view to select it, then tell me what you'd like to write!`, 'orchestrator', 'result')
              }
            }
          }, 300)
          break
        
        case 'general_chat':
        default:
          // General conversation - but still provide canvas context!
          if (onAddChatMessage) {
            onAddChatMessage(`💭 Responding conversationally...`, 'orchestrator', 'thinking')
          }
          
          if (onAnswerQuestion) {
            // Build context-aware prompt just like answer_question
            let chatPrompt = message
            
            if (canvasContext.connectedNodes.length > 0) {
              let contextSummary = ''
              let totalContentChars = 0
              
              // Extract content from canvas nodes
              canvasContext.connectedNodes.forEach(node => {
                contextSummary += `\n--- ${node.label} (${node.nodeType}) ---\n`
                contextSummary += `Summary: ${node.summary}\n`
                
                // Include actual content if available
                if (node.nodeType === 'story-structure' && node.detailedContext?.contentMap) {
                  const contentMap = node.detailedContext.contentMap as Record<string, string>
                  const contentEntries = Object.entries(contentMap)
                  
                  if (contentEntries.length > 0) {
                    contextSummary += `\nContent (${contentEntries.length} sections):\n`
                    
                    contentEntries.slice(0, 10).forEach(([sectionId, content]) => {
                      if (content && content.trim()) {
                        const sectionInfo = node.detailedContext?.allSections?.find((s: any) => s.id === sectionId)
                        const sectionName = sectionInfo?.name || sectionId
                        const truncatedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content
                        contextSummary += `\n## ${sectionName}\n${truncatedContent}\n`
                        totalContentChars += truncatedContent.length
                      }
                    })
                    
                    if (contentEntries.length > 10) {
                      contextSummary += `\n(... ${contentEntries.length - 10} more sections available)\n`
                    }
                  }
                }
                
                contextSummary += '\n'
              })
              
              chatPrompt = `User Message: ${message}\n\nAvailable Context from Canvas:${contextSummary}`
              
              // Add RAG content if available
              if (ragEnhancedContext?.hasRAG && ragEnhancedContext.ragContent) {
                chatPrompt += `\n\nAdditional Relevant Content (from semantic search):\n${ragEnhancedContext.ragContent}`
              }
              
              if (onAddChatMessage && totalContentChars > 0) {
                const wordCount = Math.round(totalContentChars / 5)
                onAddChatMessage(`📚 Using context from ${canvasContext.connectedNodes.length} connected node(s)`)
                onAddChatMessage(`📄 Including ~${wordCount} words of actual content`)
              }
            }
            
            const response = await onAnswerQuestion(chatPrompt)
            if (onAddChatMessage) {
              onAddChatMessage(`💬 ${response}`)
            }
          } else {
            onCreateStory(selectedFormat, selectedTemplate || undefined, message)
          }
          break
      }
    } catch (error) {
      console.error('❌ Error executing intent:', error)
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  // Auto-open reasoning panel when messages appear or update
  useEffect(() => {
    if (reasoningMessages.length > 0) {
      setIsReasoningOpen(true)
      console.log('[CreateStoryPanel] Auto-opening reasoning panel, messages:', reasoningMessages.length)
    }
  }, [reasoningMessages])

  // Auto-collapse thinking/decision/error messages when new messages arrive
  useEffect(() => {
    if (reasoningMessages.length === 0) return

    // Find all thinking/decision/error messages except the last one
    const thinkingMessages = reasoningMessages.filter(msg => 
      ['thinking', 'decision', 'error'].includes(msg.type)
    )

    if (thinkingMessages.length > 1) {
      // Auto-collapse all thinking messages except the most recent one
      setCollapsedMessages(prev => {
        const next = new Set(prev)
        thinkingMessages.slice(0, -1).forEach(msg => {
          next.add(msg.id)
        })
        return next
      })
    }
  }, [reasoningMessages])

  // Clear context when document view is closed
  useEffect(() => {
    if (!isDocumentViewOpen && activeContext && onClearContext) {
      onClearContext()
    }
  }, [isDocumentViewOpen, activeContext, onClearContext])

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
      
      // Populate available orchestrators (Refined & Canonical)
      if (data.success && data.keys?.length > 0) {
        const uniqueModels = new Map<string, {
            id: string, 
            name: string, 
            keyId: string, 
            provider: string,
            group: string,
            priority: number
        }>()
        
        data.keys.forEach((key: any) => {
          if (key.models_cache) {
            key.models_cache.forEach((model: any) => {
              const canonical = getCanonicalModel(model.id)
              if (canonical) {
                // Deduplicate by Canonical Name + Provider (e.g. "GPT-4 Turbo" on OpenAI)
                // This merges "gpt-4-1106-preview" and "gpt-4-0125-preview" into one "GPT-4 Turbo" entry
                const dedupKey = `${canonical.name}-${key.provider}`
                
                // Only add if not exists, or maybe overwrite if we want "latest" logic? 
                // For now, first found is fine as they are usually equivalent aliases.
                if (!uniqueModels.has(dedupKey)) {
                  uniqueModels.set(dedupKey, {
                    id: model.id,
                    name: canonical.name,
                    keyId: key.id,
                    provider: key.provider,
                    group: canonical.group,
                    priority: canonical.priority
                  })
                }
              }
            })
          }
        })
        
        // Sort by priority (High to Low)
        const sortedModels = Array.from(uniqueModels.values()).sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority
            return a.name.localeCompare(b.name)
        })
        
        setAvailableOrchestrators(sortedModels)
      } else {
        setAvailableOrchestrators([])
      }

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
          
          setActiveKeyId(configuredKey.id)
          setConfiguredModel({
            orchestrator: configuredKey.orchestrator_model_id,
            writerCount: configuredKey.writer_model_ids?.length || 0
          })
        } else {
          console.log('[CreateStoryPanel] ⚠️ No orchestrator found, defaulting to Auto-select')
          // No explicit configuration - will auto-select
          setActiveKeyId(null)
          setConfiguredModel({
            orchestrator: 'Auto-select',
            writerCount: 0
          })
        }
      } else {
        console.log('[CreateStoryPanel] ❌ No API keys found')
        // No API keys configured
        setActiveKeyId(null)
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
    // Always select the format (no deselection - format is required)
    setSelectedFormat(format)
    setSelectedTemplate(null)
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
      {/* Orchestrator Header with Document View Toggle & New Chat */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Orchestrator</h3>
        <div className="flex items-center gap-2">
          {/* LLM Reasoning Mode Toggle */}
          <button
            onClick={() => setUseLLMReasoning(!useLLMReasoning)}
            className={`p-1.5 rounded-md transition-colors ${
              useLLMReasoning 
                ? 'bg-purple-100 hover:bg-purple-200 text-purple-700' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            title={useLLMReasoning ? 'Full LLM Reasoning (Slower, Most Intelligent)' : 'Semi Reasoning (Fast Pattern Matching + LLM Fallback)'}
          >
            {useLLMReasoning ? (
              // Full brain icon - LLM reasoning
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm3 13h-2v3h-2v-3H9v-2.51c-1.24-.96-2-2.44-2-4.02 0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.58-.76 3.06-2 4.02V15z"/>
                <circle cx="10" cy="9" r="1"/>
                <circle cx="14" cy="9" r="1"/>
                <path d="M12 13c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z"/>
              </svg>
            ) : (
              // Half brain icon - Semi reasoning (pattern matching)
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 1.58-.76 3.06-2 4.02V15h-6v-2.51c-1.24-.96-2-2.44-2-4.02 0-2.76 2.24-5 5-5z"/>
                <path d="M12 4v11" stroke="currentColor" strokeWidth="1"/>
                <circle cx="10" cy="9" r="0.8"/>
                <circle cx="14" cy="9" r="0.8" opacity="0.3"/>
              </svg>
            )}
          </button>
          
          {onToggleDocumentView && (
            <button
              onClick={onToggleDocumentView}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              title={isDocumentViewOpen ? 'Switch to Canvas View' : 'Switch to Document View'}
            >
              {isDocumentViewOpen ? (
                // Node/Network icon for Canvas View
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 100 4 2 2 0 000-4zM4 16a2 2 0 100 4 2 2 0 000-4zM18 16a2 2 0 100 4 2 2 0 000-4zM11 14a2 2 0 100 4 2 2 0 000-4zM11 8v4M6.5 17.5l3.5-2M14 17.5l-3.5-2" />
                </svg>
              ) : (
                // Document icon
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={() => {
              if (onClearChat) {
                onClearChat()
              }
            }}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Active Context Display - Compact (only show when document view is open) */}
      {activeContext && isDocumentViewOpen && (
        <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-xs text-yellow-900 truncate">
              <span className="font-medium">Writing:</span> {activeContext.name}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (onAddChatMessage && activeContext) {
                  onAddChatMessage(`Write content for "${activeContext.name}"`)
                  onCreateStory(selectedFormat, selectedTemplate || undefined, `Write detailed content for "${activeContext.name}"`)
                }
              }}
              className="px-2 py-1 bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded text-xs font-medium transition-colors"
              title="Write this section"
            >
              Write
            </button>
            <button
              onClick={onClearContext}
              className="p-1 hover:bg-yellow-200 rounded transition-colors"
              title="Clear context"
            >
              <svg className="w-3.5 h-3.5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Thin Stacked Accordion Tiles */}
      <div className="border-b border-gray-200 bg-gray-50">
        {/* Model Tile */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setIsModelPillExpanded(!isModelPillExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <span className="text-xs font-medium text-gray-700">
                {loadingConfig ? 'Loading...' : (configuredModel?.orchestrator || 'Auto-select model')}
              </span>
            </div>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isModelPillExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {/* Model Accordion Content */}
          {isModelPillExpanded && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 animate-in slide-in-from-top-2 duration-200">
              {availableOrchestrators.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                       <label className="text-xs font-semibold text-gray-600">Select Model:</label>
                       {updatingModel && <span className="text-[10px] text-purple-600 animate-pulse font-medium">Switching...</span>}
                    </div>
                    <select
                      value={configuredModel.orchestrator || ''}
                      onChange={async (e) => {
                        const selectedId = e.target.value
                        const selectedOption = availableOrchestrators.find(m => m.id === selectedId)
                        
                        if (selectedOption) {
                          setUpdatingModel(true)
                          // Optimistic UI update
                          setConfiguredModel(prev => ({ ...prev, orchestrator: selectedId }))
                          
                          try {
                             // 1. Get current key data
                             const keysResponse = await fetch('/api/user/api-keys')
                             const keysData = await keysResponse.json()
                             const targetKey = keysData.keys.find((k: any) => k.id === selectedOption.keyId)
                             
                             if (targetKey) {
                               // 2. Update preference on TARGET key
                               await fetch(`/api/user/api-keys/${targetKey.id}/preferences`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    orchestratorModelId: selectedId,
                                    writerModelIds: targetKey.writer_model_ids || [] 
                                  })
                               })

                               // 3. Clear orchestrator on ALL OTHER keys (Ensure single active orchestrator)
                               const otherKeys = keysData.keys.filter((k: any) => k.id !== targetKey.id && k.orchestrator_model_id)
                               if (otherKeys.length > 0) {
                                 await Promise.all(otherKeys.map((k: any) => 
                                   fetch(`/api/user/api-keys/${k.id}/preferences`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        orchestratorModelId: null, // Clear
                                        writerModelIds: k.writer_model_ids || [] // Preserve
                                      })
                                   })
                                 ))
                               }
                               
                               // 4. Dispatch event
                               window.dispatchEvent(new CustomEvent('orchestratorConfigUpdated', {
                                  detail: { orchestratorModelId: selectedId }
                               }))
                               
                               // 5. Refresh
                               await fetchConfiguredModels()
                             }
                          } catch (err) {
                            console.error('Failed to switch model', err)
                            fetchConfiguredModels() // Revert
                          } finally {
                            setUpdatingModel(false)
                          }
                        }
                      }}
                      disabled={updatingModel}
                      className="w-full text-xs border-gray-300 rounded shadow-sm focus:border-purple-500 focus:ring-purple-500 py-1.5 bg-white text-gray-700"
                    >
                      <option value="" disabled>Select an orchestrator...</option>
                      {/* Group models by Canonical Group */}
                      {Object.entries(availableOrchestrators.reduce((acc, model) => {
                        // Use the explicit group from canonical details
                        const group = model.group || 'Other'
                        if (!acc[group]) acc[group] = []
                        acc[group].push(model)
                        return acc
                      }, {} as Record<string, typeof availableOrchestrators>)).map(([group, models]) => (
                        <optgroup key={group} label={group}>
                          {models.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold">Writers:</span> {configuredModel.writerCount} models available
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic mb-2">
                  No compatible models found.
                </div>
              )}
              
              <button
                onClick={() => router.push('/profile')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 underline mt-2 block"
              >
                Manage Keys in Profile →
              </button>
            </div>
          )}
        </div>

        {/* Format Tile */}
        <div>
          <button
            onClick={() => setIsFormatPillExpanded(!isFormatPillExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-xs font-medium text-gray-700">
                {selectedFormat && selectedTemplate 
                  ? `${storyFormats.find(f => f.type === selectedFormat)?.label} - ${templates[selectedFormat].find(t => t.id === selectedTemplate)?.name}`
                  : selectedFormat 
                  ? storyFormats.find(f => f.type === selectedFormat)?.label
                  : 'Select format'}
              </span>
            </div>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isFormatPillExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Orchestrator Reasoning - Center Stage */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          {/* Format Selection Accordion (expands when tile clicked) */}
          {isFormatPillExpanded && (
            <div className="mb-4 bg-white rounded-md border border-gray-200 shadow-sm animate-in slide-in-from-top-2 duration-200">
              <div className="p-4 max-h-96 overflow-y-auto">
                <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Choose Format & Template</h3>
                <div className="space-y-3">
                  {storyFormats.map((format) => {
                    const formatTemplates = templates[format.type]
                    const isSelected = selectedFormat === format.type
                    
                    return (
                      <div key={format.type} className="border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors">
                        <button
                          onClick={() => {
                            setSelectedFormat(format.type)
                            setSelectedTemplate(null)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            isSelected ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div className={`text-xl ${isSelected ? 'text-gray-700' : 'text-gray-400'}`}>
                            {format.icon}
                          </div>
                          <div className="flex-1">
                            <div className={`text-xs font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                              {format.label}
                            </div>
                            <div className="text-xs text-gray-500">{format.description}</div>
                          </div>
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {isSelected && (
                          <div className="bg-gray-50 border-t border-gray-200 p-3 space-y-1.5">
                            <p className="text-xs font-medium text-gray-600 mb-2">Templates:</p>
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
                                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                                  selectedTemplate === template.id
                                    ? 'bg-gray-700 text-white font-medium'
                                    : 'bg-white text-gray-700 hover:bg-gray-200 border border-gray-200'
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
              // GROUP consecutive messages from same sender/type/time
              (() => {
                const groupedMessages: Array<{
                  role: string | undefined
                  type: string
                  timestamp: string
                  messages: typeof reasoningMessages
                  isLast: boolean
                }> = []
                
                reasoningMessages.forEach((msg, i) => {
                  const prevGroup = groupedMessages[groupedMessages.length - 1]
                  const isSameGroup = prevGroup &&
                    prevGroup.role === msg.role &&
                    prevGroup.type === msg.type &&
                    Math.abs(new Date(prevGroup.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000 // Within 5 seconds
                  
                  if (isSameGroup) {
                    prevGroup.messages.push(msg)
                    prevGroup.isLast = i === reasoningMessages.length - 1
                  } else {
                    groupedMessages.push({
                      role: msg.role,
                      type: msg.type,
                      timestamp: msg.timestamp,
                      messages: [msg],
                      isLast: i === reasoningMessages.length - 1
                    })
                  }
                })
                
                return groupedMessages.map((group, groupIndex) => {
                  const firstMsg = group.messages[0]
                  
                  const isUserMessage = group.role === 'user'
                  const isOrchestratorMessage = group.role === 'orchestrator' && group.type === 'user'
                  const isStatusMessage = ['thinking', 'decision', 'task', 'result', 'error'].includes(group.type)
                  const isModelMessage = firstMsg.content.startsWith('🤖 Model reasoning:')
                  const isLastMessage = group.isLast
                
                // CHAT MESSAGE: Simple, clean conversation
                if (isUserMessage || (isOrchestratorMessage && !isStatusMessage)) {
                  return (
                    <div key={groupIndex} className={`p-3 rounded ${isUserMessage ? 'bg-gray-100' : 'bg-white border border-gray-200'}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {isUserMessage ? (
                            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                              {isUserMessage ? 'PUBLO' : 'ORCHESTRATOR'}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(group.timestamp).toLocaleTimeString('en-US', { 
                                hour: '2-digit', 
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          {/* Render all messages in group as a list */}
                          {group.messages.length === 1 ? (
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                              {group.messages[0].content}
                            </p>
                          ) : (
                            <div className="text-sm text-gray-800 space-y-0.5">
                              {group.messages.map((msg, msgIdx) => (
                                <p key={msgIdx} className="whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }
                
                // STATUS MESSAGE: Collapsible accordion with colored tint
                const messageId = firstMsg.id
                const isCollapsed = collapsedMessages.has(messageId) && !isLastMessage
                
                const toggleCollapse = () => {
                  setCollapsedMessages(prev => {
                    const next = new Set(prev)
                    if (next.has(messageId)) {
                      next.delete(messageId)
                    } else {
                      next.add(messageId)
                    }
                    return next
                  })
                }
                
                const bgColor = 
                  isModelMessage ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500' :
                  group.type === 'thinking' ? 'bg-purple-50 border-l-4 border-purple-400' :
                  group.type === 'decision' ? 'bg-blue-50 border-l-4 border-blue-400' :
                  group.type === 'task' ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                  group.type === 'result' ? 'bg-green-50 border-l-4 border-green-400' :
                  'bg-red-50 border-l-4 border-red-400'
                
                const icon = isModelMessage ? (
                    <svg className="w-3.5 h-3.5 text-indigo-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  ) :
                  group.type === 'thinking' ? (
                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ) :
                  group.type === 'decision' ? (
                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  ) :
                  group.type === 'task' ? (
                    <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) :
                  group.type === 'result' ? (
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) :
                  (
                    <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )
                
                const label = isModelMessage ? 'MODEL' : group.type.toUpperCase()
                
                return (
                  <div key={groupIndex} className={`rounded ${bgColor} overflow-hidden ${isLastMessage && isStreaming ? 'animate-pulse' : ''}`}>
                    {/* Collapsible header */}
                    <button
                      onClick={toggleCollapse}
                      className="w-full p-2 flex items-center justify-between hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                          {icon}
                        </div>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-600">
                          {label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(group.timestamp).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {!isLastMessage && (
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Collapsible content */}
                    {!isCollapsed && (
                      <div className="px-3 pb-3">
                        {/* Render all messages in group */}
                        {group.messages.length === 1 ? (
                          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                            {group.messages[0].content}
                            {isLastMessage && isStreaming && (
                              <span className="inline-block ml-1 w-1.5 h-4 bg-indigo-600 animate-pulse" />
                            )}
                          </p>
                        ) : (
                          <div className="text-sm text-gray-800 space-y-0.5">
                            {group.messages.map((msg, msgIdx) => (
                              <p key={msgIdx} className="whitespace-pre-wrap break-words">
                                {msg.content}
                                {msgIdx === group.messages.length - 1 && isLastMessage && isStreaming && (
                                  <span className="inline-block ml-1 w-1.5 h-4 bg-indigo-600 animate-pulse" />
                                )}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
                })
              })()
            )}
          {/* Scroll target */}
          <div ref={reasoningEndRef} />
          </div>
        </div>
      </div>

      {/* Chat Input - Bottom */}
      <div className="border-t border-gray-200 bg-white p-4">
        {/* Template Selection UI - shown when waiting for user to choose template */}
        {pendingCreation && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-gray-900 mb-3">
              Choose a template for your {storyFormats.find(f => f.type === pendingCreation.format)?.label || pendingCreation.format}:
            </p>
            <div className="grid grid-cols-1 gap-2">
              {(templates[pendingCreation.format] || []).map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelection(template.id, template.name)}
                  className="flex flex-col items-start p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                >
                  <span className="font-medium text-gray-900 group-hover:text-blue-700">
                    {template.name}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {template.description}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              💬 Or just tell me which one: &quot;The interview one looks good&quot; or &quot;Let&apos;s go with blank canvas&quot;
            </p>
          </div>
        )}
        
        <textarea
          ref={chatInputRef}
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (chatMessage.trim()) {
                await handleSendMessage_NEW(chatMessage) // Using new orchestrator architecture
              }
            }
          }}
          placeholder={activeContext 
            ? `Write about "${activeContext.name}"...` 
            : `Chat with the orchestrator (${selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1).replace('-', ' ')})...`}
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder-gray-400"
        />
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send • Shift+Enter for new line • Format: <span className="font-semibold text-gray-700">{selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1).replace('-', ' ')}</span>
        </p>
      </div>
    </div>
  )
}
