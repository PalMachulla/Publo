'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
  Button,
  ChatAccordion,
  ChatOptionsSelector,
  templateToChatOption
} from '@/components/ui'
import { 
  getMultiAgentOrchestrator, // PHASE 3: Multi-agent support
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
// PHASE 1: WorldState - Unified state management
import { buildWorldStateFromReactFlow, type WorldStateManager } from '@/lib/orchestrator/core/worldState'
// PHASE 2: Tool System - Executable tools
import { createDefaultToolRegistry } from '@/lib/orchestrator/tools'
// Deprecated: findReferencedNode moved to core/contextProvider (now using resolveNode)
// import { findReferencedNode } from '@/lib/orchestrator/canvasContextProvider.deprecated'
import { Edge } from 'reactflow'

// Helper: Get canonical model details for filtering and display
const getCanonicalModel = (modelId: string) => {
  const id = modelId.toLowerCase()
  
  // ❌ FILTER OUT: Non-text-generation models
  if (id.includes('embedding')) return null // text-embedding-*
  if (id.includes('tts')) return null // tts-1, tts-1-hd
  if (id.includes('whisper')) return null // whisper-1
  if (id.includes('dall-e')) return null // dall-e-2, dall-e-3
  if (id.includes('moderation')) return null // text-moderation-*
  if (id.includes('babbage') || id.includes('davinci') || id.includes('curie')) return null // Legacy completion models
  if (id.includes('gpt-3.5') && !id.includes('turbo')) return null // Old GPT-3.5 base models
  if (id.includes('text-davinci') || id.includes('text-curie')) return null // Legacy text models

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
  if (id.includes('gpt-3.5-turbo')) return { name: 'GPT-3.5 Turbo (Legacy)', priority: 40, group: 'OpenAI', isReasoning: false }
  
  // Anthropic Models
  if (id.includes('claude-sonnet-4.5') || id.includes('claude-4.5-sonnet')) return { name: 'Claude Sonnet 4.5', priority: 95, group: 'Anthropic', isReasoning: true }
  if (id.includes('claude-3-5-sonnet')) return { name: 'Claude 3.5 Sonnet', priority: 92, group: 'Anthropic', isReasoning: true }
  if (id.includes('claude-3-opus')) return { name: 'Claude 3 Opus', priority: 88, group: 'Anthropic', isReasoning: true }
  if (id.includes('claude-3-haiku')) return { name: 'Claude 3 Haiku', priority: 70, group: 'Anthropic', isReasoning: false }
  
  // Google Models
  if (id.includes('gemini-1.5-pro')) return { name: 'Gemini 1.5 Pro', priority: 89, group: 'Google', isReasoning: true }
  if (id.includes('gemini-1.5-flash')) return { name: 'Gemini 1.5 Flash', priority: 75, group: 'Google', isReasoning: false }
  if (id.includes('gemini-2.0-flash')) return { name: 'Gemini 2.0 Flash', priority: 87, group: 'Google', isReasoning: true }
  if (id.includes('gemini-pro')) return { name: 'Gemini Pro', priority: 65, group: 'Google', isReasoning: false }
  
  // Groq Models
  if (id.includes('llama-3.3-70b')) return { name: 'Llama 3.3 70B', priority: 85, group: 'Groq', isReasoning: true }
  if (id.includes('llama-3.1-70b')) return { name: 'Llama 3.1 70B', priority: 80, group: 'Groq', isReasoning: true }
  if (id.includes('llama-3.1-8b')) return { name: 'Llama 3.1 8B (Fast)', priority: 75, group: 'Groq', isReasoning: false }
  if (id.includes('llama-3.2')) return { name: 'Llama 3.2', priority: 72, group: 'Groq', isReasoning: false }
  if (id.includes('mixtral-8x7b')) return { name: 'Mixtral 8x7B', priority: 70, group: 'Groq', isReasoning: false }
  if (id.includes('gemma')) return { name: 'Gemma', priority: 50, group: 'Groq', isReasoning: false }
  
  // If we don't recognize it, filter it out (safer than showing unknown models)
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

interface ConfirmationRequest {
  actionId: string
  actionType: OrchestratorAction['type']
  actionPayload: any
  message: string
  confirmationType: 'destructive' | 'clarification' | 'permission'
  options?: Array<{ id: string; label: string; description?: string }> // For multiple choice clarifications
  createdAt: number
  expiresAt: number // Timeout after 2 minutes
}

interface CreateStoryPanelProps {
  node: Node<CreateStoryNodeData>
  onCreateStory: (format: StoryFormat, template?: string, userPrompt?: string, plan?: any) => void
  onClose: () => void
  onUpdate?: (nodeId: string, data: Partial<CreateStoryNodeData>) => void
  onSendPrompt?: (prompt: string) => void // NEW: For chat-based prompting
  canvasChatHistory?: Array<{
    id: string
    timestamp: string
    content: string
    type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress'
    role?: 'user' | 'orchestrator'
  }>
  onAddChatMessage?: (message: string, role?: 'user' | 'orchestrator', type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress') => void
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
  onDeleteNode?: (nodeId: string) => Promise<void> // DELETE: Delete a canvas node
}

// ✅ REFACTORED: Templates now imported from schema (single source of truth)
import { getTemplatesForFormat, type Template } from '@/lib/orchestrator/schemas/templateRegistry'

// Removed hardcoded templates - now using templateRegistry schema
// Old location: lines 141-207 (67 lines removed)
// New location: frontend/src/lib/orchestrator/schemas/templateRegistry.ts

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
  type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress'
  role?: 'user' | 'orchestrator'
  // ✅ NEW: Support inline options for clarification
  options?: Array<{id: string, title: string, description?: string}>
  onOptionSelect?: (optionId: string, optionTitle: string) => void
}

// Helper function to detect format from user message
// Prioritizes "create X" patterns over references in "based on Y" contexts
function detectFormatFromMessage(message: string): StoryFormat | null {
  const lowerMessage = message.toLowerCase()
  
  // PRIORITY 1: Explicit "create X" patterns (primary intent)
  const createPatterns = [
    { pattern: /create.*?report/i, format: 'report' as StoryFormat },
    { pattern: /create.*?podcast/i, format: 'podcast' as StoryFormat },
    { pattern: /create.*?screenplay/i, format: 'screenplay' as StoryFormat },
    { pattern: /create.*?novel/i, format: 'novel' as StoryFormat },
    { pattern: /create.*?short story/i, format: 'short-story' as StoryFormat },
    { pattern: /create.*?article/i, format: 'article' as StoryFormat }
  ]
  
  for (const { pattern, format } of createPatterns) {
    if (pattern.test(message)) {
      console.log('🎯 [Format Detection] Explicit create pattern:', format)
      return format
    }
  }
  
  // PRIORITY 2: Standalone mentions (no "create" keyword)
  // Check for report BEFORE screenplay to avoid "report on screenplay" confusion
  if (lowerMessage.includes('report')) return 'report'
  if (lowerMessage.includes('podcast')) return 'podcast'
  if (lowerMessage.includes('screenplay') || lowerMessage.includes('script')) return 'screenplay'
  if (lowerMessage.includes('novel') || lowerMessage.includes('book')) return 'novel'
  if (lowerMessage.includes('short story')) return 'short-story'
  if (lowerMessage.includes('article') || lowerMessage.includes('blog')) return 'article'
  
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
  onSelectNode,
  onDeleteNode
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
  
  // Model selector state (Cursor-style dropdown at bottom)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [modelMode, setModelMode] = useState<'automatic' | 'fixed'>('automatic') // Default to Auto
  const [fixedModeStrategy, setFixedModeStrategy] = useState<'consistent' | 'loose'>('loose') // Default to Loose (cost-effective)
  const [currentlyUsedModels, setCurrentlyUsedModels] = useState<{intent: string, writer: string}>({intent: '', writer: ''})
  
  // Confirmation state - for 2-step execution flow
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null)
  
  // ✅ NEW: Clarification state - for inline chat options (not modal)
  const [pendingClarification, setPendingClarification] = useState<{
    question: string
    context?: string
    options: Array<{id: string, label: string, description: string}>
    originalIntent: string
    originalPayload: any
  } | null>(null)
  
  // Chat state (local input only, history is canvas-level)
  const [chatMessage, setChatMessage] = useState('')
  
  // LLM reasoning mode toggle
  const [useLLMReasoning, setUseLLMReasoning] = useState(true) // true = always LLM (recommended for GPT-5.1), false = pattern + LLM fallback
  
  // Reasoning chat state
  const [isReasoningOpen, setIsReasoningOpen] = useState(true) // Open by default to see streaming
  const reasoningEndRef = useRef<HTMLDivElement>(null) // Auto-scroll target
  const chatInputRef = useRef<HTMLTextAreaElement>(null) // Chat input ref
  
  // Use CANVAS-LEVEL chat history (persistent across all generations)
  // ✅ Transform messages to add inline options for clarifications
  const reasoningMessages: ReasoningMessage[] = canvasChatHistory.map((msg, index) => {
    // Add options to the last 'decision' message if there's a pending clarification
    const isLastMessage = index === canvasChatHistory.length - 1
    const isDecisionMessage = msg.type === 'decision'
    
    if (isLastMessage && isDecisionMessage && pendingClarification) {
      return {
        ...msg,
        options: pendingClarification.options.map(opt => ({
          id: opt.id,
          title: opt.label,
          description: opt.description
        })),
        onOptionSelect: async (optionId: string, optionTitle: string) => {
          console.log('✅ [Clarification] Option selected:', { optionId, optionTitle })
          
          // Store clarification for processing
          const clarification = pendingClarification
          setPendingClarification(null)
          
          // Handle based on option selected
          if (optionId === 'create_new') {
            // User wants to create new - show template selection
            setPendingCreation({
              format: clarification.originalPayload.format as StoryFormat,
              userMessage: clarification.originalPayload.userMessage
            })
          } else if (optionId === 'use_existing') {
            // User wants to use existing - send to orchestrator
            handleSendMessage_NEW('Open the existing document')
          } else {
            // Generic option selection - respond with option text
            handleSendMessage_NEW(optionTitle)
          }
        }
      }
    }
    
    return msg
  })
  
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
  
  // ============================================================
  // PHASE 1: BUILD WORLDSTATE (Unified State Management)
  // ============================================================
  // TODO: This will eventually replace individual props passed to orchestrator
  // For now, we build it in parallel for gradual migration
  
  // FIX: Use stable dependency to prevent rebuild loop
  // Only rebuild when node/edge structure actually changes, not on every render
  const canvasStateKey = useMemo(() => 
    JSON.stringify({
      nodeIds: canvasNodes.map(n => n.id).sort(),
      edgeIds: canvasEdges.map(e => e.id).sort(),
      activeDocId: currentStoryStructureNodeId,
      activeSectionId: activeContext?.id,
      docPanelOpen: isDocumentViewOpen,
      modelMode,
      fixedModel: configuredModel.orchestrator
    }),
    [canvasNodes, canvasEdges, currentStoryStructureNodeId, activeContext?.id, isDocumentViewOpen, modelMode, configuredModel.orchestrator]
  )
  
  const worldState = useMemo(() => {
    console.log('🔧 [WorldState] Rebuilding (canvasStateKey changed)')
    // We don't have user.id yet (fetched async), so we'll pass empty string
    // and update it in the orchestrate call
    return buildWorldStateFromReactFlow(
      canvasNodes,
      canvasEdges,
      '', // userId will be set when orchestrate is called
      {
        activeDocumentNodeId: currentStoryStructureNodeId,
        selectedSectionId: activeContext?.id || null,
        isDocumentPanelOpen: isDocumentViewOpen,
        availableProviders: [], // Will be populated from API keys
        availableModels: [], // Will be populated from /api/models/available
        modelPreferences: {
          modelMode,
          fixedModelId: configuredModel.orchestrator,
          fixedModeStrategy
        },
        orchestratorKeyId: undefined // Will be set from activeKeyId
      }
    )
  }, [canvasStateKey]) // FIX: Only depend on stable key, not raw arrays
  
  // ============================================================
  // PHASE 2: BUILD TOOL REGISTRY
  // ============================================================
  // Create tool registry once on mount for executing actions
  const toolRegistry = useMemo(() => {
    console.log('🔧 [ToolRegistry] Creating default tool registry')
    return createDefaultToolRegistry()
  }, []) // Only create once on mount
  
  // Debug: Log WorldState on changes (reduced logging to prevent spam)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Only log on meaningful changes, not every rebuild
      const state = worldState.getState()
      if (state.meta.version === 1) { // Only log initial build
        console.log('🗺️ [WorldState] Initial build:', {
          version: state.meta.version,
          canvasNodes: worldState.getAllNodes().length,
          canvasEdges: worldState.getAllEdges().length,
          activeDocId: worldState.getActiveDocument().nodeId,
          selectedSectionId: worldState.getActiveSectionId(),
          documentPanelOpen: worldState.isDocumentPanelOpen(),
          toolsAvailable: toolRegistry.getAll().length // PHASE 2: Log tool count
        })
      }
    }
  }, [worldState, toolRegistry])
  
  // Detect if streaming - check WorldState for orchestrator processing status
  const isStreaming = worldState.isOrchestratorProcessing()
  
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
    canvasNodes: canvasNodes.map(n => ({ 
      id: n.id, 
      type: n.type, 
      label: n.data?.label, 
      hasContentMap: !!n.data?.contentMap,
      hasDocumentData: !!n.data?.document_data,  // ✅ DEBUG
      documentDataKeys: n.data?.document_data ? Object.keys(n.data.document_data) : []  // ✅ DEBUG
    })),
    canvasEdges: canvasEdges.map(e => ({ source: e.source, target: e.target })),
    orchestratorId: 'context'
  })
  
  // Handle confirmation timeout and auto-clear
  useEffect(() => {
    if (!pendingConfirmation) return
    
    const checkInterval = setInterval(() => {
      if (isConfirmationExpired(pendingConfirmation)) {
        setPendingConfirmation(null)
        if (onAddChatMessage) {
          onAddChatMessage('⏱️ Confirmation expired. Please try again.', 'orchestrator', 'error')
        }
      }
    }, 1000) // Check every second
    
    return () => clearInterval(checkInterval)
  }, [pendingConfirmation, onAddChatMessage])
  
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
    // Check if there's a pending confirmation
    if (pendingConfirmation) {
      // This message is a response to the confirmation
      await handleConfirmationResponse(message)
      return
    }
    
    // ✅ NEW: Check if there's a pending clarification
    if (pendingClarification) {
      // User is responding to a clarification request by typing a number
      // Try to match the number to an option
      const numberMatch = message.match(/^\s*(\d+)\s*$/)
      if (numberMatch) {
        const optionIndex = parseInt(numberMatch[1]) - 1
        if (optionIndex >= 0 && optionIndex < pendingClarification.options.length) {
          const selectedOption = pendingClarification.options[optionIndex]
          console.log('✅ [Clarification] Number matched to option:', selectedOption)
          
          // Clear input and clarification
          setChatMessage('')
          const clarification = pendingClarification
          setPendingClarification(null)
          
          // Handle based on option ID
          if (selectedOption.id === 'create_new') {
            setPendingCreation({
              format: clarification.originalPayload.format as StoryFormat,
              userMessage: clarification.originalPayload.userMessage
            })
          } else if (selectedOption.id === 'use_existing') {
            await handleSendMessage_NEW('Open the existing document')
          } else {
            await handleSendMessage_NEW(selectedOption.label)
          }
          return
        }
      }
      
      // If not a number match, treat as a text response
      console.log('📝 [Clarification] Text response (not a number):', message)
      setChatMessage('')
      setPendingClarification(null)
      // Continue with normal orchestration below
    }
    
    // ✅ FIX: Don't add user message here - orchestrator will add it automatically
    // The orchestrator adds the user message to blackboard, which triggers the messageCallback
    // Adding it here causes duplication in the UI
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
        onAddChatMessage(`⏳ Analyzing your request...`, 'orchestrator', 'thinking')
      }
      
      // Get available providers from user's API keys
      const availableProviders = Array.from(new Set(availableOrchestrators.map(m => m.provider)))
      
      // Get first available API key ID for structure generation
      const userKeyId = availableOrchestrators.length > 0 ? availableOrchestrators[0].keyId : undefined
      
      console.log('🔑 [OrchestratorPanel] Available providers:', availableProviders)
      console.log('🔑 [OrchestratorPanel] User key ID:', userKeyId)
      
      // ✅ FIX: Detect format from user's message BEFORE calling orchestrator
      const detectedFormat = detectFormatFromMessage(message)
      const formatToUse = detectedFormat || selectedFormat
      
      console.log('📋 [OrchestratorPanel] Format detection:', {
        detected: detectedFormat,
        selected: selectedFormat,
        using: formatToUse,
        message: message.substring(0, 100)
      })
      
      // PHASE 1.2: Fetch available models with tier metadata
      let availableModelsToPass: any[] | undefined = undefined
      try {
        console.log('🔍 [OrchestratorPanel] Fetching available models...')
        const modelsResponse = await fetch('/api/models/available')
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json()
          if (modelsData.success && modelsData.models && modelsData.models.length > 0) {
            availableModelsToPass = modelsData.models
            console.log(`✅ [OrchestratorPanel] Loaded ${modelsData.models.length} available models (${modelsData.stats.reasoningCount} reasoning, ${modelsData.stats.writingCount} writing)`)
          }
        } else {
          console.warn('⚠️ [OrchestratorPanel] Failed to fetch available models, using static MODEL_TIERS')
        }
      } catch (error) {
        console.warn('⚠️ [OrchestratorPanel] Error fetching available models:', error)
        // Continue with static MODEL_TIERS (backward compatible)
      }
      
      // Call the new orchestrator with WorldState
      // PHASE 1: Update WorldState with user.id before passing
      worldState.update(draft => {
        draft.user.id = user.id
        draft.user.availableProviders = availableProviders
        draft.user.availableModels = availableModelsToPass || []
        draft.user.apiKeys.orchestratorKeyId = userKeyId
      })
      
      // ✅ CRITICAL: Get structureItems from WorldState if available (more up-to-date than props)
      const activeDoc = worldState.getActiveDocument()
      const freshStructureItems = activeDoc.structure?.items || structureItems || []
      
      console.log('🔍 [OrchestratorPanel] Structure items source:', {
        fromWorldState: activeDoc.structure?.items?.length || 0,
        fromProps: structureItems?.length || 0,
        using: freshStructureItems.length,
        currentNodeId: currentStoryStructureNodeId
      })
      
      // PHASE 3: Use multi-agent orchestrator for intelligent task coordination
      const response = await getMultiAgentOrchestrator(user.id, { 
        toolRegistry,
        onMessage: onAddChatMessage // PHASE 3: Real-time message streaming
      }, worldState).orchestrate({
        message,
        canvasNodes,
        canvasEdges,
        activeContext: activeContext || undefined, // Convert null to undefined
        isDocumentViewOpen,
        documentFormat: formatToUse, // ✅ FIX: Use detected format instead of selectedFormat
        structureItems: freshStructureItems, // ✅ FIX: Use WorldState items if available
        contentMap,
        currentStoryStructureNodeId,
        // Model selection preferences
        modelMode,
        fixedModeStrategy: modelMode === 'fixed' ? fixedModeStrategy : undefined,
        fixedModelId: modelMode === 'fixed' ? configuredModel.orchestrator : undefined,
        // Available providers (from user's API keys)
        availableProviders: availableProviders.length > 0 ? availableProviders : undefined,
        // PHASE 1.2: Pass available models with tier metadata (undefined = fallback to static MODEL_TIERS)
        availableModels: availableModelsToPass || undefined as any, // Intentionally allow undefined for backward compatibility
        // User key ID for structure generation
        userKeyId
      })
      
      // ⚠️ REMOVED: Real-time callback already displays messages - no need to display them again!
      // thinkingSteps are now streamed in real-time via onMessage callback
      
      // PHASE 3: Smart template auto-selection
      // If intent is create_structure and LLM suggested a template, auto-select it
      if (response.intent === 'create_structure') {
        const intentAnalysis = response as any // Type assertion to access extractedEntities
        const suggestedTemplate = intentAnalysis.extractedEntities?.suggestedTemplate
        const documentFormat = intentAnalysis.extractedEntities?.documentFormat
        
        if (suggestedTemplate && documentFormat) {
          console.log('🎯 [Smart Intent] Auto-selecting template:', {
            format: documentFormat,
            template: suggestedTemplate
          })
          
          // Import template registry
          const { getTemplateById } = await import('@/lib/orchestrator/schemas/templateRegistry')
          const template = getTemplateById(documentFormat, suggestedTemplate)
          
          if (template) {
            if (onAddChatMessage) {
              onAddChatMessage(`✨ Using "${template.name}" template for your ${documentFormat}`, 'orchestrator', 'result')
            }
            
            // Set pending creation with pre-selected template
            setPendingCreation({
              format: documentFormat as StoryFormat,
              userMessage: message
            })
            
            // Auto-select template (skip UI)
            await handleTemplateSelection(suggestedTemplate, template.name)
            return // Exit early, template selection will handle the rest
          }
        }
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
        // Extract format from user message (screenplay, novel, report, etc.)
        const detectedFormat = detectFormatFromMessage(message)
        await onCreateStory(detectedFormat || selectedFormat, selectedTemplate || undefined, message) // ✅ FIX: Await
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
  
  // Helper: Create a confirmation request
  const createConfirmationRequest = (
    action: OrchestratorAction,
    confirmationType: ConfirmationRequest['confirmationType'],
    message: string,
    options?: ConfirmationRequest['options']
  ): ConfirmationRequest => {
    const now = Date.now()
    return {
      actionId: `${action.type}_${now}`,
      actionType: action.type,
      actionPayload: action.payload,
      message,
      confirmationType,
      options,
      createdAt: now,
      expiresAt: now + 2 * 60 * 1000 // 2 minutes
    }
  }
  
  // Helper: Check if confirmation has expired
  const isConfirmationExpired = (confirmation: ConfirmationRequest): boolean => {
    return Date.now() > confirmation.expiresAt
  }
  
  // ✅ REFACTORED: Handle clarification response by sending back to orchestrator for LLM reasoning
  const handleClarificationResponse = async (response: string) => {
    if (!pendingClarification) {
      console.warn('No pending clarification')
      return
    }
    
    console.log('📥 [Clarification] Received response:', response)
    console.log('📥 [Clarification] Pending:', pendingClarification)
    
    // ✅ FIX: Don't add user response here - orchestrator will add it automatically
    setChatMessage('')
    
    // Get user ID for orchestration
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('User not authenticated')
      return
    }
    
    // Get available providers
    const availableProviders = Array.from(new Set(availableOrchestrators.map(m => m.provider)))
    const userKeyId = availableOrchestrators.length > 0 ? availableOrchestrators[0].keyId : undefined
    
    // Send back to orchestrator WITH clarification context
    try {
      // PHASE 1: Update WorldState before clarification response
      worldState.update(draft => {
        draft.user.id = user.id
        draft.user.availableProviders = availableProviders
        draft.user.apiKeys.orchestratorKeyId = userKeyId
      })
      
      // ✅ CRITICAL: Get structureItems from WorldState (clarification responses)
      const activeDocForClarification = worldState.getActiveDocument()
      const freshStructureItemsForClarification = activeDocForClarification.structure?.items || structureItems || []
      
      // PHASE 3: Use multi-agent orchestrator for clarification responses too
      const orchestratorResponse = await getMultiAgentOrchestrator(user.id, { 
        toolRegistry,
        onMessage: onAddChatMessage // PHASE 3: Real-time message streaming
      }, worldState).orchestrate({
        message: response,
        canvasNodes,
        canvasEdges,
        activeContext: activeContext || undefined,
        isDocumentViewOpen,
        documentFormat: pendingClarification.originalPayload?.format || selectedFormat,
        structureItems: freshStructureItemsForClarification, // ✅ FIX: Use WorldState items
        contentMap,
        currentStoryStructureNodeId,
        modelMode,
        fixedModeStrategy: modelMode === 'fixed' ? fixedModeStrategy : undefined,
        fixedModelId: modelMode === 'fixed' ? configuredModel.orchestrator : undefined,
        availableProviders: availableProviders.length > 0 ? availableProviders : undefined,
        userKeyId,
        // NEW: Pass clarification context
        clarificationContext: {
          originalAction: pendingClarification.originalIntent,
          question: pendingClarification.question,
          options: pendingClarification.options,
          payload: pendingClarification.originalPayload
        }
      })
      
      // ⚠️ REMOVED: Real-time callback already displays messages - no need to display them again!
      
      // Execute actions returned by orchestrator
      for (const action of orchestratorResponse.actions) {
        console.log('▶️ [Clarification] Executing action:', action.type, action.payload)
        
        // Handle message actions specially for create_structure
        if (action.type === 'message' && action.payload.intent === 'create_structure') {
          const { format, prompt, referenceDoc } = action.payload
          if (onAddChatMessage) {
            onAddChatMessage(action.payload.content, 'orchestrator', 'result')
          }
          // ✅ FIX: AWAIT onCreateStory to ensure node is saved before continuing
          await onCreateStory(format, undefined, prompt)
        } else {
          await executeActionDirectly(action)
        }
      }
      
      if (onAddChatMessage) {
        onAddChatMessage(`✅ Actions completed!`, 'orchestrator', 'result')
      }
      
    } catch (error) {
      console.error('❌ [Clarification] Error:', error)
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Error processing clarification: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
      }
    }
    
    // Clear pending clarification
    setPendingClarification(null)
  }
  
  // Helper: Handle confirmation response
  const handleConfirmationResponse = async (response: string | { id: string }) => {
    if (!pendingConfirmation) {
      console.warn('No pending confirmation')
      return
    }
    
    // Check if expired
    if (isConfirmationExpired(pendingConfirmation)) {
      setPendingConfirmation(null)
      if (onAddChatMessage) {
        onAddChatMessage('⏱️ Confirmation expired. Please try again.', 'orchestrator', 'error')
      }
      return
    }
    
    // Handle clarification (multiple choice)
    if (pendingConfirmation.confirmationType === 'clarification' && pendingConfirmation.options) {
      let selectedOption: typeof pendingConfirmation.options[0] | undefined
      
      if (typeof response === 'object' && 'id' in response) {
        // Direct option selection (button click)
        selectedOption = pendingConfirmation.options.find(opt => opt.id === response.id)
      } else if (typeof response === 'string') {
        // Natural language response - try to match
        const lowerResponse = response.toLowerCase()
        selectedOption = pendingConfirmation.options.find(opt => 
          lowerResponse.includes(opt.id.toLowerCase()) ||
          lowerResponse.includes(opt.label.toLowerCase()) ||
          (opt.description && lowerResponse.includes(opt.description.toLowerCase()))
        )
      }
      
      if (selectedOption) {
        // Build the appropriate action based on the original action type
        let updatedAction: OrchestratorAction
        
        // Check originalAction type (stored in actionType by createConfirmationRequest)
        const originalAction = pendingConfirmation.actionType as string
        
        if (originalAction === 'delete_node') {
          // For delete_node, we need nodeId and nodeName
          updatedAction = {
            type: 'delete_node',
            payload: {
              nodeId: selectedOption.id,
              nodeName: selectedOption.label
            },
            status: 'pending'
          }
        } else if (originalAction === 'open_and_write') {
          // For open_and_write, we need nodeId
          updatedAction = {
            type: 'open_document',
            payload: {
              nodeId: selectedOption.id,
              sectionId: null
            },
            status: 'pending'
          }
        } else {
          // Generic fallback
          updatedAction = {
            type: pendingConfirmation.actionType,
            payload: {
              ...pendingConfirmation.actionPayload,
              selectedOptionId: selectedOption.id
            },
            status: 'pending'
          }
        }
        
        // Clear confirmation and execute
        setPendingConfirmation(null)
        await executeActionDirectly(updatedAction)
      } else {
        if (onAddChatMessage) {
          onAddChatMessage('❓ I didn\'t understand which option you meant. Please try again or click one of the buttons.', 'orchestrator', 'error')
        }
      }
      return
    }
    
    // Handle destructive/permission confirmations (yes/no)
    if (pendingConfirmation.confirmationType === 'destructive' || pendingConfirmation.confirmationType === 'permission') {
      const lowerResponse = typeof response === 'string' ? response.toLowerCase().trim() : ''
      const isConfirmed = lowerResponse === 'yes' || lowerResponse === 'y' || lowerResponse === 'confirm' || lowerResponse === 'ok'
      const isCancelled = lowerResponse === 'no' || lowerResponse === 'n' || lowerResponse === 'cancel'
      
      if (isConfirmed) {
        // Execute the action
        const actionToExecute: OrchestratorAction = {
          type: pendingConfirmation.actionType,
          payload: pendingConfirmation.actionPayload,
          status: 'pending'
        }
        
        setPendingConfirmation(null)
        await executeActionDirectly(actionToExecute)
      } else if (isCancelled) {
        setPendingConfirmation(null)
        if (onAddChatMessage) {
          onAddChatMessage('❌ Action cancelled.', 'orchestrator', 'result')
        }
      } else {
        if (onAddChatMessage) {
          onAddChatMessage('❓ Please reply "yes" to confirm or "no" to cancel.', 'orchestrator', 'error')
        }
      }
    }
  }
  
  // Action executor - handles actions from the orchestrator (with confirmation checks)
  const executeAction = async (action: OrchestratorAction) => {
    // Check if this action requires confirmation
    const requiresConfirmation = action.type === 'delete_node'
    
    if (requiresConfirmation) {
      // Create confirmation request instead of executing directly
      let confirmationMessage = ''
      let confirmationType: ConfirmationRequest['confirmationType'] = 'destructive'
      
      if (action.type === 'delete_node') {
        confirmationMessage = `⚠️ Delete "${action.payload.nodeName}"?\nThis cannot be undone.`
        confirmationType = 'destructive'
      }
      
      const confirmation = createConfirmationRequest(action, confirmationType, confirmationMessage)
      setPendingConfirmation(confirmation)
      
      if (onAddChatMessage) {
        onAddChatMessage(confirmationMessage, 'orchestrator', 'result')
      }
      
      return // Don't execute yet, wait for confirmation
    }
    
    // No confirmation needed, execute directly
    await executeActionDirectly(action)
  }
  
  // Action executor - direct execution (bypasses confirmation)
  const executeActionDirectly = async (action: OrchestratorAction) => {
    try {
      switch (action.type) {
        case 'message':
          if (onAddChatMessage) {
            onAddChatMessage(action.payload.content, 'orchestrator', action.payload.type || 'result')
          }
          break
        
        case 'request_clarification':
          // Handle clarification requests with ChatOptionsSelector
          console.log('🤔 [Orchestrator] Clarification requested:', action.payload)
          
          // ✅ Add clarification question as a chat message (in the flow)
          if (onAddChatMessage) {
            onAddChatMessage(
              action.payload.question || 'Please select an option',
              'orchestrator',
              'decision'
            )
          }
          
          // Store pending clarification for input handling
          setPendingClarification({
            question: action.payload.question,
            context: action.payload.context,
            options: action.payload.options,
            originalIntent: action.payload.originalIntent,
            originalPayload: action.payload.originalPayload
          })
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
            await onCreateStory( // ✅ FIX: Await
              action.payload.format || selectedFormat,
              selectedTemplate || undefined,
              action.payload.prompt
            )
          }
          break
          
        case 'delete_node':
          // Handle node deletion
          if (action.payload.nodeId && onDeleteNode) {
            await onDeleteNode(action.payload.nodeId)
            if (onAddChatMessage) {
              onAddChatMessage(`✅ Deleted "${action.payload.nodeName}"`, 'orchestrator', 'result')
            }
          }
          break
          
        case 'generate_structure':
          // Handle structure generation - create the story node on canvas
          if (action.payload.plan && action.payload.format && onCreateStory) {
            const format = action.payload.format
            const prompt = action.payload.prompt || ''
            const plan = action.payload.plan
            
            console.log('📝 [generate_structure] Creating story node:', {
              format,
              planStructureCount: plan.structure?.length,
              prompt,
              planStructure: plan.structure
            })
            
            // Call onCreateStory with the format, template, prompt, AND the plan
            await onCreateStory(format, undefined, prompt, plan)
            
            if (onAddChatMessage) {
              onAddChatMessage(`✅ Created ${format} structure with ${plan.structure?.length || 0} sections`, 'orchestrator', 'result')
            }
          } else {
            console.error('❌ generate_structure action missing required data:', action.payload)
            if (onAddChatMessage) {
              const missing = []
              if (!action.payload.plan) missing.push('plan')
              if (!action.payload.format) missing.push('format')
              onAddChatMessage(`❌ Failed to create structure: Missing ${missing.join(', ')}`, 'orchestrator', 'error')
            }
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
      const availableTemplates = getTemplatesForFormat(pendingCreation.format)
      
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
      onAddChatMessage(`⏳ Analyzing your request...`, 'orchestrator', 'thinking')
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
      const method = intentAnalysis.usedLLM ? '⚙️ LLM Reasoning' : '⚡ Pattern Matching'
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
            await onCreateStory(selectedFormat, selectedTemplate || undefined, `Improve: ${message}`) // ✅ FIX: Await
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
          const { createCoherenceRewritePlan, executeRewriteStep } = await import('@/lib/orchestrator/reasoning/coherenceRewriter')
          
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
          
          // 🎯 DETECT FORMAT FIRST (before building prompts)
          const detectedFormat = detectFormatFromMessage(message)
          const formatToUse = detectedFormat || selectedFormat
          
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
              // TODO: Refactor to use orchestrator's resolveNode from core/contextProvider
              // For now, use simple fallback
              const referencedNode = canvasContext.connectedNodes.find(n => n.nodeType === 'story-structure' || n.nodeType === 'storyStructureNode')
            
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

INSTRUCTION: Use the above ${referencedNode.detailedContext.format} content as inspiration for creating the new ${formatToUse} structure. 

${message.toLowerCase().includes('interview') || message.toLowerCase().includes('character') ? 
`FOCUS ON CHARACTERS: The user wants to feature the characters from this content. Carefully read through the content above and identify all named characters, their roles, personalities, and key characteristics. Build the ${formatToUse} structure around interviewing or featuring these specific characters.` : 
`Extract characters, themes, plot points, and narrative elements to adapt them for the ${formatToUse} format.`}`

                  if (onAddChatMessage) {
                    onAddChatMessage(`✅ Extracted ${Object.keys(contentMap).length} sections (${referencedNode.detailedContext.wordsWritten} words) from "${referencedNode.label}"`)
                    onAddChatMessage(`🎯 Creating new ${formatToUse} inspired by this content...`)
                  }
                } else {
                  // Use structure summaries if no written content yet
                  const structureDetails = allSections
                    .map((s: any) => `${'  '.repeat(s.level - 1)}- ${s.name}${s.summary ? ': ' + s.summary : ''}`)
                    .join('\n')
                  
                  enhancedPrompt = `${message}

REFERENCE STRUCTURE FROM "${referencedNode.label}" (${referencedNode.detailedContext.format}):

${structureDetails}

INSTRUCTION: Use the above ${referencedNode.detailedContext.format} structure and summaries as inspiration for creating the new ${formatToUse} structure.`

                  if (onAddChatMessage) {
                    onAddChatMessage(`✅ Using structure from "${referencedNode.label}" (${allSections.length} sections)`)
                    onAddChatMessage(`ℹ️ Note: No written content found, using structure summaries only`)
                  }
                }
              } else if (referencedNode.nodeType === 'test' && (referencedNode.detailedContext as any).markdown) {
                // Use markdown content from test node
                const markdown = (referencedNode.detailedContext as any).markdown as string
                enhancedPrompt = `${message}

REFERENCE CONTENT:
${markdown.substring(0, 8000)}

${markdown.length > 8000 ? '... (content truncated for length)' : ''}

Use the above content as inspiration for creating the new ${formatToUse} structure.`

                if (onAddChatMessage) {
                  onAddChatMessage(`✅ Extracted ${(referencedNode.detailedContext as any).wordCount || 0} words from "${referencedNode.label}"`)
                }
              }
            } else if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Found node "${referencedNode?.label}" but couldn't extract content. Proceeding with user prompt only.`)
            }
            } // Close the else block for single-node extraction
          }
          
          // Store pending creation and ask for template choice (formatToUse already detected at top)
          setPendingCreation({
            format: formatToUse,
            userMessage: message,
            // TODO: Refactor to use orchestrator's resolveNode
            referenceNode: hasReference ? canvasContext.connectedNodes.find(n => n.nodeType === 'story-structure' || n.nodeType === 'storyStructureNode') : undefined,
            enhancedPrompt: enhancedPrompt
          })
          
          // Show template options to user
          const formatLabel = storyFormats.find(f => f.type === formatToUse)?.label || formatToUse
          const availableTemplates = getTemplatesForFormat(formatToUse)
          
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
          
          // TODO: Refactor to use orchestrator's resolveNode
          // For now, use simple fallback
          const nodeToOpen = canvasContext.connectedNodes.find(n => n.nodeType === 'story-structure' || n.nodeType === 'storyStructureNode')
          
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
            await onCreateStory(selectedFormat, selectedTemplate || undefined, message) // ✅ FIX: Await
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

  // Auto-collapse is now handled by ChatAccordion component

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

      {/* Active Context Display - REMOVED: Sidebar already shows active section */}
      
      {/* Model & Format selection moved to bottom input area (Cursor-style) */}

      {/* Orchestrator Reasoning - Center Stage */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
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
              <ChatAccordion 
                messages={reasoningMessages}
                isStreaming={isStreaming}
              />
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
            <ChatOptionsSelector
              title={`Choose a template for your ${storyFormats.find(f => f.type === pendingCreation.format)?.label || pendingCreation.format}`}
              options={getTemplatesForFormat(pendingCreation.format).map(templateToChatOption)}
              onSelect={handleTemplateSelection}
            />
          </div>
        )}
        
        {/* ✅ Clarification options now appear inline in chat messages above */}
        
        {/* Confirmation UI - shown when waiting for user confirmation */}
        {pendingConfirmation && (
          <div className={`mb-4 p-4 border-2 rounded-lg ${
            pendingConfirmation.confirmationType === 'destructive' 
              ? 'bg-red-50 border-red-300' 
              : pendingConfirmation.confirmationType === 'permission'
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-blue-50 border-blue-300'
          }`}>
            {/* Confirmation message */}
            <p className="text-sm font-medium text-gray-900 mb-3 whitespace-pre-wrap">
              {pendingConfirmation.message}
            </p>
            
            {/* Clarification options (multiple choice) */}
            {pendingConfirmation.confirmationType === 'clarification' && pendingConfirmation.options && (
              <div className="space-y-2">
                {pendingConfirmation.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleConfirmationResponse({ id: option.id })}
                    className="w-full flex items-start gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-left group"
                  >
                    <span className="text-lg">📄</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 group-hover:text-blue-700">
                        {option.label}
                      </div>
                      {option.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {option.description}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                <p className="text-xs text-gray-500 mt-2">
                  💬 Or describe it: &quot;The one with 79,200 words&quot;
                </p>
              </div>
            )}
            
            {/* Destructive/Permission actions (yes/no) */}
            {(pendingConfirmation.confirmationType === 'destructive' || pendingConfirmation.confirmationType === 'permission') && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleConfirmationResponse('no')}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmationResponse('yes')}
                  className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                    pendingConfirmation.confirmationType === 'destructive'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {pendingConfirmation.confirmationType === 'destructive' ? 'Yes, Delete' : 'Confirm'}
                </button>
              </div>
            )}
            
            {/* Timeout indicator */}
            <p className="text-[10px] text-gray-500 mt-2">
              ⏱️ Expires in {Math.max(0, Math.ceil((pendingConfirmation.expiresAt - Date.now()) / 1000))}s
            </p>
          </div>
        )}
        
        {/* Input area - Cursor-style Composer */}
        <div className="relative border border-gray-300 rounded-lg bg-white shadow-sm hover:border-gray-400 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200 transition-all">
          {/* Text Input */}
          <textarea
            ref={chatInputRef}
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (chatMessage.trim()) {
                  await handleSendMessage_NEW(chatMessage)
                }
              }
            }}
            placeholder={activeContext 
              ? `Write about "${activeContext.name}"...` 
              : "Chat with the orchestrator..."}
            rows={3}
            className="w-full resize-none px-4 pt-3 pb-12 text-sm focus:outline-none placeholder-gray-400 bg-transparent"
          />
          
          {/* Bottom Bar with Model Selector */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50/50 backdrop-blur-sm">
            {/* Left: Helper text */}
            <p className="text-[10px] text-gray-500">
              <kbd className="px-1 py-0.5 text-[9px] bg-white border border-gray-300 rounded shadow-sm">Enter</kbd> to send • <kbd className="px-1 py-0.5 text-[9px] bg-white border border-gray-300 rounded shadow-sm">Shift+Enter</kbd> for new line
            </p>
            
            {/* Right: Model Selector Button */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors shadow-sm"
              >
                {modelMode === 'automatic' ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Auto</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    <span className="max-w-[100px] truncate">{configuredModel.orchestrator || 'Fixed'}</span>
                  </>
                )}
                <svg className={`w-3 h-3 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            
            {/* Dropdown Menu */}
            {isModelDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                {/* Mode Toggle */}
                <div className="p-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModelMode('automatic')}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                        modelMode === 'automatic' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      ⚡ Automatic
                    </button>
                    <button
                      onClick={() => setModelMode('fixed')}
                      className={`flex-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
                        modelMode === 'fixed' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      📌 Fixed
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {modelMode === 'automatic' 
                      ? 'Best model selected per task (intent, writing, etc.)'
                      : 'Use one model for all tasks'}
                  </p>
                </div>
                
                {/* Currently Using (if Auto mode) */}
                {modelMode === 'automatic' && currentlyUsedModels.intent && (
                  <div className="p-3 bg-blue-50 border-b border-blue-200">
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Currently Using:</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">🧠 Intent:</span>
                        <span className="font-medium text-gray-900">{currentlyUsedModels.intent}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">✍️ Writer:</span>
                        <span className="font-medium text-gray-900">{currentlyUsedModels.writer}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Strategy Toggle (only show if Fixed mode) */}
                {modelMode === 'fixed' && (
                  <div className="p-3 border-b border-gray-200 bg-gray-50">
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Strategy:</p>
                    <div className="space-y-2">
                      <label className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name="strategy"
                          checked={fixedModeStrategy === 'consistent'}
                          onChange={() => setFixedModeStrategy('consistent')}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-medium text-gray-900 group-hover:text-purple-700">
                            🎯 Consistent
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Use selected model for ALL tasks (expensive)
                          </div>
                        </div>
                      </label>
                      
                      <label className="flex items-start gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          name="strategy"
                          checked={fixedModeStrategy === 'loose'}
                          onChange={() => setFixedModeStrategy('loose')}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="text-xs font-medium text-gray-900 group-hover:text-purple-700">
                            💡 Loose (Strategic)
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Strategic tasks only, cheaper models for writing
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
                
                {/* Model List (only show if Fixed mode) */}
                {modelMode === 'fixed' && (
                  <div className="p-2">
                    <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide px-2 py-1.5">Select Model:</p>
                    {availableOrchestrators.length > 0 ? (
                      Object.entries(availableOrchestrators.reduce((acc, model) => {
                        const group = model.group || 'Other'
                        if (!acc[group]) acc[group] = []
                        acc[group].push(model)
                        return acc
                      }, {} as Record<string, typeof availableOrchestrators>)).map(([group, models]) => (
                        <div key={group} className="mb-2">
                          <p className="text-[10px] font-medium text-gray-500 px-2 py-1">{group}</p>
                          {models.map((model) => (
                            <button
                              key={model.id}
                              onClick={async () => {
                                // Same logic as before for updating model
                                setUpdatingModel(true)
                                setConfiguredModel(prev => ({ ...prev, orchestrator: model.id }))
                                
                                try {
                                  const keysResponse = await fetch('/api/user/api-keys')
                                  const keysData = await keysResponse.json()
                                  const targetKey = keysData.keys.find((k: any) => k.id === model.keyId)
                                  
                                  if (targetKey) {
                                    await fetch(`/api/user/api-keys/${targetKey.id}/preferences`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        orchestratorModelId: model.id,
                                        writerModelIds: targetKey.writer_model_ids || [] 
                                      })
                                    })

                                    const otherKeys = keysData.keys.filter((k: any) => k.id !== targetKey.id && k.orchestrator_model_id)
                                    if (otherKeys.length > 0) {
                                      await Promise.all(otherKeys.map((k: any) => 
                                        fetch(`/api/user/api-keys/${k.id}/preferences`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            orchestratorModelId: null,
                                            writerModelIds: k.writer_model_ids || []
                                          })
                                        })
                                      ))
                                    }
                                    
                                    await fetchConfiguredModels()
                                    setIsModelDropdownOpen(false)
                                  }
                                } catch (err) {
                                  console.error('Failed to switch model', err)
                                  fetchConfiguredModels()
                                } finally {
                                  setUpdatingModel(false)
                                }
                              }}
                              className={`w-full text-left px-3 py-2 text-xs rounded hover:bg-gray-100 transition-colors ${
                                configuredModel.orchestrator === model.id 
                                  ? 'bg-purple-50 text-purple-700 font-medium' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {model.name}
                            </button>
                          ))}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 px-2 py-2">No models available</p>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
