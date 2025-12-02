'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Node } from 'reactflow'
import { CreateStoryNodeData, StoryFormat } from '@/types/nodes'
import { createClient } from '@/lib/supabase/client'
import { 
  ChatAccordion,
  ChatOptionsSelector,
  templateToChatOption
} from '@/components/ui'
import { 
  getMultiAgentOrchestrator, // PHASE 3: Multi-agent support
  buildCanvasContext, 
  type OrchestratorAction
} from '@/lib/orchestrator'
// PHASE 1: WorldState - Unified state management
// WorldState is the single source of truth for canvas/document state, converting ReactFlow nodes/edges
// into a format the orchestrator can use. Provides centralized access to active documents, sections,
// canvas structure, and conversation history across the entire application.
import { buildWorldStateFromReactFlow, type WorldStateManager } from '@/lib/orchestrator/core/worldState'

// PHASE 2: Tool System - Executable tools
// Tool registry provides executable actions (generate_content, modify_structure, etc.) that agents
// can use to perform actual work. The default registry includes all standard orchestrator tools.
import { createDefaultToolRegistry } from '@/lib/orchestrator/tools'


// ReactFlow types for canvas edge data structure
import { Edge } from 'reactflow'

// React hook that subscribes to WorldState changes and provides reactive data for UI updates.
// Automatically re-renders components when WorldState changes (document selection, canvas updates, etc.)
import { useWorldState } from '@/hooks/useWorldState'


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
  // ✅ MIGRATION: canvasChatHistory removed - now using WorldState.conversation.messages
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
  // ✅ NEW: Optional WorldStateManager for unified state management
  worldState?: WorldStateManager
}

// ✅ REFACTORED: Templates now imported from schema (single source of truth)
import { getTemplatesForFormat, type Template } from '@/lib/orchestrator/schemas/templateRegistry'

// Removed hardcoded templates - now using templateRegistry schema
// Old location: lines 141-207 (67 lines removed)
// New location: frontend/src/lib/orchestrator/schemas/templateRegistry.ts

// ✅ SINGLE SOURCE OF TRUTH: Import format metadata from schemas
import { FORMAT_METADATA, getFormatLabel } from '@/lib/orchestrator/schemas/formatMetadata'

// Re-export for backward compatibility (components may reference storyFormats)
const storyFormats = FORMAT_METADATA

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

// ✅ REMOVED: detectFormatFromMessage function
// The orchestrator's intentRouter already extracts documentFormat from user messages.
// Format detection is now handled entirely by the orchestrator's intent analysis.
// The UI only passes documentFormat when there's an active document (for context/terminology).

export default function OrchestratorPanel({ 
  node, 
  onCreateStory, 
  onClose, 
  onUpdate, 
  onSendPrompt,
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
  onDeleteNode,
  worldState // ✅ NEW: Optional WorldStateManager
}: CreateStoryPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  
  // ✅ Build WorldStateManager from ReactFlow state (if not provided as prop)
  // Use ref to persist WorldState across re-mounts and preserve conversation messages
  const worldStateRef = useRef<WorldStateManager | null>(null)
  const [effectiveWorldState, setEffectiveWorldState] = useState<WorldStateManager | null>(() => {
    // If worldState prop is provided, use it immediately
    if (worldState) {
      worldStateRef.current = worldState
      return worldState
    }
    // Check if we already have a persisted WorldState
    if (worldStateRef.current) {
      return worldStateRef.current
    }
    // Otherwise, build from ReactFlow state
    const newWorldState = buildWorldStateFromReactFlow(
      canvasNodes,
      canvasEdges,
      '',
      {
        activeDocumentNodeId: currentStoryStructureNodeId,
        selectedSectionId: activeContext?.id || null,
        isDocumentPanelOpen: isDocumentViewOpen,
        availableProviders: [],
        availableModels: [],
        modelPreferences: {
          modelMode: 'automatic',
          fixedModelId: null,
          fixedModeStrategy: 'loose'
        }
      }
    )
    worldStateRef.current = newWorldState
    return newWorldState
  })

  // Update WorldState when canvas or context changes, but preserve conversation
  useEffect(() => {
    if (worldState) {
      // If worldState prop provided, use it directly
      worldStateRef.current = worldState
      setEffectiveWorldState(worldState)
    } else {
      // Update existing WorldState with new canvas data
      setEffectiveWorldState(prevState => {
        let stateToUpdate = prevState

        if (!stateToUpdate) {
          // Create new if none exists
          stateToUpdate = buildWorldStateFromReactFlow(
            canvasNodes,
            canvasEdges,
            '',
            {
              activeDocumentNodeId: currentStoryStructureNodeId,
              selectedSectionId: activeContext?.id || null,
              isDocumentPanelOpen: isDocumentViewOpen,
              availableProviders: [],
              availableModels: [],
              modelPreferences: {
                modelMode: 'automatic',
                fixedModelId: null,
                fixedModeStrategy: 'loose'
              }
            }
          )
          worldStateRef.current = stateToUpdate
        }

        // Update existing WorldState
        stateToUpdate.update(draft => {
            // Update canvas
            draft.canvas.nodes.clear()
            canvasNodes.forEach(node => {
              draft.canvas.nodes.set(node.id, {
                id: node.id,
                type: node.type || 'default',
                label: node.data?.label || node.data?.name || 'Untitled',
                format: node.data?.format,
                position: node.position,
                data: node.data,
                summary: node.data?.summary,
                wordCount: node.data?.document_data?.totalWordCount || node.data?.wordCount,
                hasContent: !!node.data?.document_data || !!node.data?.contentMap,
                structure: node.data?.document_data?.structure || node.data?.items
              })
            })

            draft.canvas.edges.clear()
            canvasEdges.forEach(edge => {
              draft.canvas.edges.set(edge.id, {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                type: edge.type,
                data: edge.data
              })
            })

            // Update active document
            if (currentStoryStructureNodeId) {
              const activeNode = draft.canvas.nodes.get(currentStoryStructureNodeId)
              if (activeNode) {
                draft.activeDocument = {
                  nodeId: activeNode.id,
                  format: activeNode.format || null,
                  structure: activeNode.structure ? {
                    items: Array.isArray(activeNode.structure) ? activeNode.structure : [],
                    hierarchy: activeNode.format || 'unknown'
                  } : null,
                  content: new Map(), // Content will be loaded separately
                  selectedSectionId: activeContext?.id || null
                }
              }
            } else {
              draft.activeDocument = {
                nodeId: null,
                format: null,
                structure: null,
                content: new Map(),
                selectedSectionId: null
              }
            }

            // Update selected section
            draft.activeDocument.selectedSectionId = activeContext?.id || null
          })
          return stateToUpdate
      })
    }
  }, [worldState])
  
  // ✅ NEW: Subscribe to WorldState (from prop or built)
  const worldStateData = useWorldState(effectiveWorldState || undefined)
  
  // Debug: Log received props on mount and when they change
  useEffect(() => {
    console.log('🎯 [CreateStoryPanel] Props received:', {
      canvasNodesCount: canvasNodes.length,
      canvasEdgesCount: canvasEdges.length,
      canvasNodesList: canvasNodes.map(n => ({ id: n.id, type: n.type, label: n.data?.label })),
      canvasEdgesList: canvasEdges.map(e => ({ source: e.source, target: e.target })),
      hasWorldState: !!worldState,
      worldStateVersion: worldStateData?.meta.version
    })
  }, [canvasNodes, canvasEdges, worldState, worldStateData])
  const [configuredModel, setConfiguredModel] = useState<{
    orchestrator: string | null
    writerCount: number
  }>({ orchestrator: null, writerCount: 0 })
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [availableOrchestrators, setAvailableOrchestrators] = useState<Array<{id: string, name: string, keyId: string, provider: string, group?: string, priority?: number}>>([])
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null)
  // ✅ REMOVED: updatingModel state (model selector UI removed)
  // const [updatingModel, setUpdatingModel] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<StoryFormat>('novel') // Default to 'novel'
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false) // Prevent double-clicks
  
  // Model configuration state (still used by orchestrator, even though UI selector is removed)
  // TODO: Model selection/enforcement will be redesigned later
  const [modelMode, setModelMode] = useState<'automatic' | 'fixed'>('automatic') // Default to Auto
  const [fixedModeStrategy, setFixedModeStrategy] = useState<'consistent' | 'loose'>('loose') // Default to Loose (cost-effective)
  
  // ✅ REMOVED: Model selector UI state (button removed, will be redesigned later)
  // const [currentlyUsedModels, setCurrentlyUsedModels] = useState<{intent: string, writer: string}>({intent: '', writer: ''})
  
  // ✅ UI State: Use WorldState if available, otherwise local state (backward compatible)
  const worldStateUI = worldStateData?.ui
  const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationRequest | null>(null)
  const [pendingClarification, setPendingClarification] = useState<{
    question: string
    context?: string
    options: Array<{id: string, label: string, description: string}>
    originalIntent: string
    originalPayload: any
  } | null>(null)
  const [pendingCreation, setPendingCreation] = useState<{
    format: StoryFormat
    userMessage: string
    referenceNode?: any
    enhancedPrompt?: string
  } | null>(null)
  
  // ✅ Local state fallbacks (used when WorldState not available)
  // NOTE: localIsReasoningOpen is set but never read - the reasoning panel state is managed
  // by WorldState or handled by ChatAccordion component. Keeping commented for potential future use.
  // const [localIsReasoningOpen, setLocalIsReasoningOpen] = useState(true)
  
  // ✅ REMOVED: Model selector UI state (button removed, will be redesigned later)
  // const [localIsModelDropdownOpen, setLocalIsModelDropdownOpen] = useState(false)
  // const [updatingModel, setUpdatingModel] = useState(false)
  // const currentIsModelDropdownOpen = worldStateUI?.isModelDropdownOpen ?? localIsModelDropdownOpen
  
  // ✅ Get UI state from WorldState or fallback to props/local state
  // NOTE: These "current" variables were intended to provide a unified interface,
  // but the code was never fully migrated to use them. The code currently uses
  // the original variables (pendingCreation, activeContext, isDocumentViewOpen, etc.) directly.
  // Keeping commented for potential future migration to WorldState-first approach.
  // const currentPendingClarification = worldStateUI?.pendingClarification || pendingClarification
  // const currentPendingCreation = worldStateUI?.pendingCreation || pendingCreation
  // const currentActiveContext = worldStateUI?.activeContext || activeContext
  // const currentIsDocumentViewOpen = worldStateUI?.documentPanelOpen ?? isDocumentViewOpen
  // const currentIsReasoningOpen = worldStateUI?.isReasoningOpen ?? localIsReasoningOpen
  
  // Chat state (local input only, history is canvas-level)
  const [chatMessage, setChatMessage] = useState('')
  
  // LLM reasoning mode toggle
  const [useLLMReasoning, setUseLLMReasoning] = useState(true) // true = always LLM (recommended for GPT-5.1), false = pattern + LLM fallback
  const reasoningEndRef = useRef<HTMLDivElement>(null) // Auto-scroll target
  const chatInputRef = useRef<HTMLTextAreaElement>(null) // Chat input ref
  
  // ✅ MIGRATION: Always use WorldState conversation (single source of truth)
  const reasoningMessages: ReasoningMessage[] = useMemo(() => {
    const worldStateMessages = worldStateData?.conversation.messages || []
    console.log('[OrchestratorPanel] Message sources:', {
      worldStateMessages: worldStateMessages.length,
      using: 'worldState', // ✅ Always WorldState now
      messageTypes: worldStateMessages.map(m => ({ type: m.type, role: m.role, contentPreview: m.content.substring(0, 50) }))
    })
    // ✅ Always use WorldState - no fallback to canvasChatHistory
    const messages = worldStateMessages
    
    // Get pending clarification from WorldState or local state
    const currentPendingClarification = worldStateData?.ui.pendingClarification || pendingClarification
    
    // Find the most recent decision message that matches the clarification question
    // This ensures we only attach options to the relevant decision message, not old ones
    let targetDecisionIndex = -1
    if (currentPendingClarification) {
      const clarificationQuestion = currentPendingClarification.question
      // Search backwards from the end to find the most recent matching decision message
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (msg.type === 'decision') {
          // Match if content matches the question (allowing for truncation)
          const contentMatches = msg.content === clarificationQuestion || 
                                 msg.content.startsWith(clarificationQuestion.substring(0, 20)) ||
                                 clarificationQuestion.startsWith(msg.content.substring(0, 20))
          if (contentMatches) {
            targetDecisionIndex = i
            break
          }
        }
      }
    }
    
    return messages.map((msg, index) => {
      const isLastMessage = index === messages.length - 1
      const isDecisionMessage = msg.type === 'decision'
      const isTargetDecision = index === targetDecisionIndex
      
      // Add options ONLY to the target decision message that matches the clarification
      // This prevents attaching options to old decision messages
      if (isDecisionMessage && isTargetDecision && currentPendingClarification) {
        // Use options from message if available, otherwise use pending clarification
        const optionsSource = msg.options || currentPendingClarification?.options || []
        
        return {
          ...msg,
          options: optionsSource.map((opt: any) => ({
            id: opt.id,
            title: opt.title || opt.label,
            description: opt.description
          })),
          onOptionSelect: async (optionId: string, optionTitle: string) => {
            console.log('✅ [Clarification] Option selected:', { optionId, optionTitle })
            
            // ✅ FIX: UI should NOT interpret option IDs - orchestrator handles all logic
            // Just pass the option to orchestrator and let it decide what to do
            
            // Clear clarification state (will be cleared after orchestrator processes it)
            // Don't clear here - let orchestrator handle it to prevent race conditions
            
            // ✅ Call orchestrator with option - orchestrator interprets and builds action
            // Use optionTitle as the response (orchestrator can match by label or ID)
            await handleClarificationResponse(optionTitle)
          }
        }
      }
      
      return msg
    })
  }, [worldStateData, pendingClarification, worldState])
  
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
  
  // Note: effectiveWorldState is already declared above (before useWorldState hook)
  
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
    if (process.env.NODE_ENV === 'development' && effectiveWorldState) {
      // Only log on meaningful changes, not every rebuild
      const state = effectiveWorldState.getState()
      if (state.meta.version === 1) { // Only log initial build
        console.log('🗺️ [WorldState] Initial build:', {
          version: state.meta.version,
          canvasNodes: effectiveWorldState.getAllNodes().length,
          canvasEdges: effectiveWorldState.getAllEdges().length,
          activeDocId: effectiveWorldState.getActiveDocument().nodeId,
          selectedSectionId: effectiveWorldState.getActiveSectionId(),
          documentPanelOpen: effectiveWorldState.isDocumentPanelOpen(),
          toolsAvailable: toolRegistry.getAll().length // PHASE 2: Log tool count
        })
      }
    }
  }, [effectiveWorldState, toolRegistry])
  
  // Detect if streaming - check WorldState for orchestrator processing status
  const isStreaming = effectiveWorldState?.isOrchestratorProcessing() || false
  
  // ✅ REMOVED: Canvas context display logic moved to orchestrator layer
  // The orchestrator now emits canvas awareness messages via blackboard (orchestratorEngine.ts line ~310).
  // This keeps the UI layer purely for display - it receives messages from orchestrator, doesn't generate them.
  // The orchestrator owns the logic of what it can "see" and communicates this to the user.
  
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
    
    // ✅ FIX: Check if there's a pending clarification
    // If so, pass to orchestrator - orchestrator handles ALL interpretation (numbers, text, etc.)
    if (pendingClarification) {
      console.log('📝 [Clarification] User response detected, passing to orchestrator:', message)
      // ✅ Orchestrator handles:
      // - Number matching ("1", "2", etc.)
      // - Exact label matching ("TV Pilot")
      // - Partial matching ("pilot" matches "TV Pilot")
      // - Natural language interpretation ("the first one", "go with podcast")
      // - Option ID interpretation (create_new, use_existing, template IDs, etc.)
      await handleClarificationResponse(message)
      return // ✅ CRITICAL: Don't continue with normal orchestration - clarification response handles it
    }
    
    // ============================================================
    // MESSAGE FLOW: User Input → Orchestrator → Blackboard → UI
    // ============================================================
    // 
    // When the user sends a message, here's what happens:
    // 
    // 1. UI clears the input field (line below)
    // 2. UI calls orchestrator.orchestrate({ message, ... })
    // 3. Orchestrator adds user message to blackboard (orchestratorEngine.ts line ~296)
    // 4. Blackboard triggers messageCallback (blackboard.ts line ~212)
    // 5. messageCallback calls UI's onMessage (orchestratorEngine.ts line ~171)
    // 6. UI displays the message via onAddChatMessage callback
    // 
    // ❌ DO NOT manually add user message here (e.g., onAddChatMessage(message, 'user'))
    //    This would cause duplication because the orchestrator already adds it to blackboard,
    //    which automatically triggers the UI display via the callback chain above.
    // 
    // ✅ The UI's job is to: clear input, call orchestrator, and display messages it receives.
    //    The orchestrator's job is: add messages to blackboard, trigger callbacks.
    setChatMessage('')
    
    // ============================================================
    // CANVAS CONTEXT AWARENESS (Moved to Orchestrator Layer)
    // ============================================================
    // 
    // Canvas context display logic was moved from UI to orchestrator layer.
    // 
    // Why? Canvas awareness is part of the orchestrator's "reasoning" - it needs to know
    // what nodes are connected so it can reference them in responses. This logic belongs
    // in the orchestrator layer, not the UI layer.
    // 
    // How it works now:
    // 1. Orchestrator builds canvas context (orchestratorEngine.ts line ~303)
    // 2. Orchestrator emits awareness messages via blackboard (orchestratorEngine.ts line ~319)
    // 3. Blackboard triggers messageCallback → UI displays messages
    // 
    // This maintains clean architecture: orchestrator = logic/reasoning, UI = display only.
    // The UI receives and displays messages from orchestrator, it doesn't generate them.
    
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
      
      // ✅ FIX: Only pass documentFormat when there's an active document (for context/terminology)
      // For new document creation, let orchestrator extract format from message via intent analysis
      // The orchestrator will extract format and put it in extractedEntities.documentFormat
      const formatForContext = currentStoryStructureNodeId 
        ? (canvasNodes.find(n => n.id === currentStoryStructureNodeId)?.data?.format as StoryFormat | undefined)
        : undefined
      
      console.log('📋 [OrchestratorPanel] Format context:', {
        hasActiveDocument: !!currentStoryStructureNodeId,
        formatForContext,
        message: message.substring(0, 100),
        note: 'Orchestrator will extract format from message if creating new document'
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
      let freshStructureItems = structureItems || []
      if (effectiveWorldState) {
        effectiveWorldState.update(draft => {
          draft.user.id = user.id
          draft.user.availableProviders = availableProviders
          draft.user.availableModels = availableModelsToPass || []
          draft.user.apiKeys.orchestratorKeyId = userKeyId
        })
        
        // ✅ CRITICAL: Get structureItems from WorldState if available (more up-to-date than props)
        const activeDoc = effectiveWorldState.getActiveDocument()
        freshStructureItems = activeDoc.structure?.items || structureItems || []
      }
      
      console.log('🔍 [OrchestratorPanel] Structure items source:', {
        fromWorldState: effectiveWorldState ? effectiveWorldState.getActiveDocument().structure?.items?.length || 0 : 0,
        fromProps: structureItems?.length || 0,
        using: freshStructureItems.length,
        currentNodeId: currentStoryStructureNodeId
      })
      
      // PHASE 3: Use multi-agent orchestrator for intelligent task coordination
      const response = await getMultiAgentOrchestrator(user.id, {
        toolRegistry,
        onMessage: onAddChatMessage // PHASE 3: Real-time message streaming
      }, effectiveWorldState || undefined).orchestrate({
        message,
        canvasNodes,
        canvasEdges,
        activeContext: activeContext || undefined, // Convert null to undefined
        isDocumentViewOpen,
        documentFormat: formatForContext, // ✅ FIX: Only pass format for active documents (context), let orchestrator extract for new documents
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
      
      // ============================================================
      // TEMPLATE SELECTION ARCHITECTURE
      // ============================================================
      // 
      // Template selection decisions are handled by CreateStructureAction (orchestrator layer),
      // NOT by the UI. This maintains clean architecture: orchestrator = logic/reasoning, UI = display/execution.
      // 
      // Flow:
      // 1. Intent analysis extracts suggestedTemplate from user message (if explicit keywords found)
      //    - "Create a podcast interview" → suggestedTemplate: "interview" ✅
      //    - "Create a podcast" → suggestedTemplate: undefined (vague) ✅
      // 
      // 2. CreateStructureAction receives intent with suggestedTemplate:
      //    - If suggestedTemplate exists → proceeds directly with structure generation (high confidence)
      //    - If suggestedTemplate is undefined → returns request_clarification with template options
      // 
      // 3. UI executes actions returned by orchestrator:
      //    - If request_clarification → shows template selector UI
      //    - If generate_structure → proceeds with structure creation
      // 
      // This ensures all template logic is centralized in CreateStructureAction, making it:
      // - Easier to test (logic isolated in one place)
      // - More maintainable (single source of truth)
      // - Architecturally correct (decisions in orchestrator, not UI)
      // 
      // See: CreateStructureAction.ts lines 112-254 for template selection logic
      
      // ✅ SIMPLIFIED: Execute actions returned by orchestrator
      // Note: The orchestrator now handles action dependencies and auto-execution.
      // Actions returned here are either:
      // 1. Actions that require user interaction (requiresUserInput: true)
      // 2. Actions that couldn't be auto-executed (e.g., structure creation)
      // 3. Dependency actions that need UI handling (e.g., select_section for navigation)
      
      if (response.actions.length > 0) {
        console.log('🎬 [OrchestratorPanel] Executing UI actions:', response.actions.map((a: OrchestratorAction) => a.type))
        
        if (onAddChatMessage) {
          onAddChatMessage(`🚀 Processing ${response.actions.length} action(s)...`, 'orchestrator', 'thinking')
        }
        
        // Execute actions (orchestrator has already handled dependencies and auto-execution)
        for (const action of response.actions) {
          console.log('▶️ [OrchestratorPanel] Executing UI action:', action.type, action.payload)
          await executeAction(action) // Use executeAction to handle confirmations
        }
        
        if (onAddChatMessage) {
          onAddChatMessage(`✅ Actions completed!`, 'orchestrator', 'result')
        }
      } else {
        // No actions returned - either auto-executed by orchestrator or no actions needed
        if (response.requiresUserInput) {
          // Orchestrator is waiting for user input (clarification, etc.)
          console.log('💬 [OrchestratorPanel] Orchestrator requires user input')
        } else {
          // Actions were auto-executed by orchestrator/agents
          console.log('✅ [OrchestratorPanel] Actions were auto-executed by orchestrator')
          if (onAddChatMessage) {
            onAddChatMessage(`✅ Task completed!`, 'orchestrator', 'result')
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Orchestration error:', error)
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
      }
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
  
  // ============================================================
  // CLARIFICATION RESPONSE HANDLING (UI LAYER - DELEGATES TO ORCHESTRATOR)
  // ============================================================
  // 
  // ✅ ARCHITECTURE: UI Layer only delegates to orchestrator
  // - Orchestrator reads clarification from WorldState
  // - Orchestrator reads all context from WorldState
  // - Orchestrator processes response and returns actions
  // - UI executes actions
  // 
  // Flow:
  // 1. User clicks option or types response
  // 2. UI calls orchestrator.handleClarificationOption(response)
  // 3. Orchestrator reads from WorldState, processes, returns actions
  // 4. UI executes actions
  const handleClarificationResponse = async (response: string) => {
    // ✅ UI LAYER: Just clear input and delegate to orchestrator
    setChatMessage('')
    
    // Get user ID for orchestration
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('User not authenticated')
      return
    }
    
    try {
      // ✅ UI LAYER: Get orchestrator instance
      const orchestrator = getMultiAgentOrchestrator(user.id, {
        toolRegistry,
        onMessage: onAddChatMessage
      }, effectiveWorldState || undefined)
      
      // ✅ UI LAYER: Call orchestrator - orchestrator handles ALL logic
      // Orchestrator will:
      // - Read clarification from WorldState
      // - Read canvas context from WorldState
      // - Read models/providers from WorldState
      // - Process the response
      // - Clear clarification from WorldState when done
      // - Return actions
      const orchestratorResponse = await orchestrator.handleClarificationOption(response, {
        // Optional: Pass canvas props if WorldState not available (fallback)
        canvasNodes,
        canvasEdges,
        structureItems,
        contentMap,
        currentStoryStructureNodeId,
        documentFormat: selectedFormat
      })
      
      console.log('✅ [Clarification] Orchestrator response received:', {
        actionsCount: orchestratorResponse.actions.length,
        actionTypes: orchestratorResponse.actions.map((a: OrchestratorAction) => a.type)
      })
      
      // ✅ UI LAYER: Execute actions returned by orchestrator
      for (const action of orchestratorResponse.actions) {
        console.log('▶️ [Clarification] Executing action:', action.type, action.payload)
        
        if (action.type === 'message' && action.payload.intent === 'create_structure') {
          const { format, prompt } = action.payload
          if (onAddChatMessage) {
            onAddChatMessage(action.payload.content, 'orchestrator', 'result')
          }
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
        onAddChatMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
      }
    }
  }
  
  // ============================================================
  // CONFIRMATION RESPONSE HANDLING
  // ============================================================
  // 
  // This function processes user responses to confirmation requests.
  // Instead of building actions in the UI (which violates orchestrator taxonomy),
  // we use the dedicated continueConfirmation() method in the orchestrator.
  // 
  // Benefits:
  // - Logic stays in orchestrator (maintains architectural separation)
  // - Single source of truth for action building
  // - Easier to test and maintain
  // - Consistent with continueClarification() pattern
  // 
  // Flow:
  // 1. User responds to confirmation ("yes", "no", or selects an option)
  // 2. UI calls orchestrator.continueConfirmation() with response and context
  // 3. Orchestrator interprets response and builds appropriate action
  // 4. UI executes the returned action
  // 
  // See: orchestratorEngine.ts continueConfirmation() method
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
    
    // ✅ FIX: Don't add user response here - orchestrator will add it automatically
    // Get user ID for orchestration
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('User not authenticated')
      return
    }
    
    try {
      // ✅ NEW: Use orchestrator to process confirmation response
      const orchestrator = getMultiAgentOrchestrator(user.id, {
        toolRegistry,
        onMessage: onAddChatMessage
      }, effectiveWorldState || undefined)
      
      const orchestratorResponse = await orchestrator.continueConfirmation(
        response,
        {
          actionId: pendingConfirmation.actionId,
          actionType: pendingConfirmation.actionType,
          actionPayload: pendingConfirmation.actionPayload,
          confirmationType: pendingConfirmation.confirmationType,
          options: pendingConfirmation.options
        },
        {
          canvasNodes,
          canvasEdges,
          structureItems,
          contentMap,
          currentStoryStructureNodeId
        }
      )
      
      // Clear confirmation
      setPendingConfirmation(null)
      
      // Execute returned actions
      if (orchestratorResponse.actions.length > 0) {
        for (const action of orchestratorResponse.actions) {
          await executeActionDirectly(action)
        }
      }
    } catch (error) {
      console.error('❌ [Confirmation] Error:', error)
      if (onAddChatMessage) {
        onAddChatMessage(`❌ Error processing confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
      }
      // Don't clear pending confirmation on error - let user try again
      console.warn('⚠️ [Confirmation] Keeping pending confirmation due to error')
    }
  }
  
  /**
   * Execute action with confirmation handling (if needed)
   * 
   * ✅ SIMPLIFIED: The orchestrator now handles action dependencies and sequencing.
   * This function only handles:
   * 1. Confirmation requests (destructive actions like delete_node)
   * 2. Direct execution of actions returned by orchestrator
   * 
   * @param action - Action to execute
   */
  const executeAction = async (action: OrchestratorAction) => {
    // Check if this action requires confirmation
    const requiresConfirmation = action.type === 'delete_node' && action.requiresUserInput !== false
    
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
  
  /**
   * Execute action directly (bypasses confirmation)
   * 
   * ✅ SIMPLIFIED: This function handles UI-level action execution.
   * The orchestrator has already handled:
   * - Action dependencies and sequencing
   * - Auto-execution of actions that can be handled by agents
   * 
   * Actions received here are either:
   * - Actions that require UI interaction (navigation, structure creation)
   * - Actions that couldn't be auto-executed
   * 
   * @param action - Action to execute directly
   */
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
          console.log('🔍 [Clarification] Payload structure:', {
            hasQuestion: !!action.payload.question,
            hasMessage: !!action.payload.message,
            hasOptions: !!action.payload.options,
            optionsCount: action.payload.options?.length || 0,
            options: action.payload.options
          })
          
          // Store pending clarification FIRST (before adding message)
          const questionText = action.payload.question || action.payload.message || 'Please select an option'
          const clarificationData = {
            question: questionText,
            context: action.payload.context,
            options: action.payload.options || [],
            originalIntent: action.payload.originalIntent || action.payload.originalAction || 'create_structure',
            originalPayload: action.payload.originalPayload || action.payload
          }
          
          console.log('💾 [Clarification] Storing clarification data:', {
            question: clarificationData.question,
            optionsCount: clarificationData.options.length,
            options: clarificationData.options,
            hasWorldState: !!effectiveWorldState
          })
          
          // Store clarification in WorldState or local state
          if (effectiveWorldState) {
            effectiveWorldState.setPendingClarification(clarificationData)
            console.log('✅ [Clarification] Stored in WorldState')
            
            // ✅ Add message directly to WorldState with options included
            // This ensures the message has the right type and options are available immediately
            effectiveWorldState.addMessage({
              content: questionText,
              role: 'orchestrator',
              type: 'decision',
              options: clarificationData.options.map((opt: {id: string, label: string, description?: string}) => ({
                id: opt.id,
                title: opt.label,
                description: opt.description
              }))
            })
            console.log('✅ [Clarification] Message added to WorldState with options')
          } else {
            setPendingClarification(clarificationData)
            console.log('✅ [Clarification] Stored in local state')
            
            // Fallback: Use onAddChatMessage if WorldState not available
            if (onAddChatMessage) {
              onAddChatMessage(
                questionText,
                'orchestrator',
                'decision'
              )
              console.log('✅ [Clarification] Message added via onAddChatMessage')
            }
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
          console.log('🔍 [executeActionDirectly] generate_content action:', {
            isAnswer: action.payload.isAnswer,
            hasOnAnswerQuestion: !!onAnswerQuestion,
            hasSectionId: !!action.payload.sectionId,
            hasOnWriteContent: !!onWriteContent,
            promptLength: action.payload.prompt?.length || 0,
            promptPreview: action.payload.prompt?.substring(0, 100)
          })
          
          if (action.payload.isAnswer && onAnswerQuestion) {
            // This is an answer to a question
            console.log('💬 [executeActionDirectly] Calling onAnswerQuestion with prompt:', action.payload.prompt?.substring(0, 100))
            try {
              const answer = await onAnswerQuestion(action.payload.prompt)
              console.log('✅ [executeActionDirectly] Received answer, length:', answer?.length || 0)
              console.log('✅ [executeActionDirectly] Answer preview:', answer?.substring(0, 200))
              console.log('✅ [executeActionDirectly] onAddChatMessage available:', !!onAddChatMessage)
              if (onAddChatMessage) {
                console.log('📤 [executeActionDirectly] Calling onAddChatMessage with answer...')
                onAddChatMessage(`📖 ${answer}`, 'orchestrator', 'result')
                console.log('✅ [executeActionDirectly] onAddChatMessage called successfully')
              } else {
                console.warn('⚠️ [executeActionDirectly] onAddChatMessage is not available!')
              }
            } catch (error) {
              console.error('❌ [executeActionDirectly] Error in onAnswerQuestion:', error)
              if (onAddChatMessage) {
                onAddChatMessage(`❌ Error answering question: ${error instanceof Error ? error.message : 'Unknown error'}`, 'orchestrator', 'error')
              }
            }
          } else if (action.payload.sectionId && onWriteContent) {
            // This is content for a specific section
            console.log('✍️ [executeActionDirectly] Calling onWriteContent for section:', action.payload.sectionId)
            await onWriteContent(action.payload.sectionId, action.payload.prompt)
          } else {
            // ⚠️ No handler matched - log warning
            console.warn('⚠️ [executeActionDirectly] generate_content action not handled:', {
              isAnswer: action.payload.isAnswer,
              hasOnAnswerQuestion: !!onAnswerQuestion,
              sectionId: action.payload.sectionId,
              hasOnWriteContent: !!onWriteContent
            })
            if (onAddChatMessage) {
              onAddChatMessage(`⚠️ Action not handled: generate_content (isAnswer: ${action.payload.isAnswer}, sectionId: ${action.payload.sectionId})`, 'orchestrator', 'error')
            }
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

            // Use centralized format label helper
            const expectedTitle = getFormatLabel(format)
            
            console.log('📝 [generate_structure] Creating story node:', {
              format,
              expectedTitle,
              planStructureCount: plan.structure?.length,
              prompt: prompt.substring(0, 50) + '...',
              planStructure: plan.structure?.slice(0, 2) // First 2 items only
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
  
  
 

  // Auto-open reasoning panel when messages appear or update
  useEffect(() => {
    if (reasoningMessages.length > 0) {
      if (worldState) {
        // Use WorldState if available
        if (worldState && !worldStateData?.ui.isReasoningOpen) {
          worldState.toggleReasoningPanel()
        }
      } else {
        // Fallback to local state (commented out - reasoning panel managed by ChatAccordion)
        // setLocalIsReasoningOpen(true)
      }
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
        console.log('[CreateStoryPanel] WorldState conversation messages before refresh:', effectiveWorldState?.getState().conversation.messages.length || 0)
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

  // ============================================================
  // MODEL CONFIGURATION
  // ============================================================
  // 
  // This function fetches models, maps API keys, and manages orchestrator configuration.
  // It's still needed to provide model metadata to the orchestrator, even though
  // the UI model selector button has been removed (will be redesigned later).
  // 
  // TODO: Consider extracting to a separate hook or service for reusability.
  // The logic is complex (140+ lines) and could be shared across components.
  // 
  // Note: Model selection UI has been removed - model selection/enforcement
  // will be redesigned in a future update.
  const fetchConfiguredModels = async () => {
    setLoadingConfig(true)
    
    try {
      console.log('[CreateStoryPanel] Fetching configured models from Profile')
      
      // ✅ SINGLE SOURCE OF TRUTH: Use model metadata API instead of hardcoded mappings
      const modelsResponse = await fetch('/api/models/available')
      const modelsData = await modelsResponse.json()
      
      // Also fetch API keys to get keyId for each model
      const keysResponse = await fetch('/api/user/api-keys')
      const keysData = await keysResponse.json()
      
      // Create a map of model_id -> keyId for quick lookup
      const modelToKeyId = new Map<string, string>()
      if (keysData.success && keysData.keys?.length > 0) {
        keysData.keys.forEach((key: any) => {
          if (key.models_cache) {
            key.models_cache.forEach((model: any) => {
              // Map provider:model_id to keyId
              modelToKeyId.set(`${key.provider}:${model.id}`, key.id)
            })
          }
        })
      }
      
      // Populate available orchestrators from metadata API (single source of truth)
      if (modelsData.success && modelsData.models?.length > 0) {
        const uniqueModels = new Map<string, {
            id: string, 
            name: string, 
            keyId: string, 
            provider: string,
            group: string,
            priority: number
        }>()
        
        modelsData.models.forEach((model: any) => {
          // Use vendor_name from database if available, otherwise fall back to displayName
          const displayName = model.vendor_name || model.displayName || model.id
          
          // Get keyId from the map
          const keyId = modelToKeyId.get(`${model.provider}:${model.id}`) || ''
          
          // Use tier for grouping (convert tier to group name)
          const group = model.tier 
            ? `${model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}${model.tier === 'frontier' ? ' (Frontier)' : model.tier === 'premium' ? ' (Premium)' : ''}`
            : model.provider.charAt(0).toUpperCase() + model.provider.slice(1)
          
          // Use priority from tier metadata (database is single source of truth)
          // Default to 50 if priority is missing (shouldn't happen if database is properly configured)
          const priority = model.priority || 50
          
          // Deduplicate by Display Name + Provider
          const dedupKey = `${displayName}-${model.provider}`
          
          if (!uniqueModels.has(dedupKey)) {
            uniqueModels.set(dedupKey, {
              id: model.id,
              name: displayName,
              keyId: keyId,
              provider: model.provider,
              group: group,
              priority: priority
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
        modelsSuccess: modelsData.success,
        modelsCount: modelsData.models?.length || 0,
        keysSuccess: keysData.success,
        keyCount: keysData.keys?.length || 0,
        allKeys: keysData.keys?.map((k: any) => ({
          id: k.id,
          provider: k.provider,
          orchestrator_model_id: k.orchestrator_model_id,
          writer_model_ids: k.writer_model_ids,
          hasOrchestrator: !!k.orchestrator_model_id
        }))
      })
      
      if (keysData.success && keysData.keys?.length > 0) {
        // Find the first key with an orchestrator configured
        const configuredKey = keysData.keys.find((key: any) => key.orchestrator_model_id)
        
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
                <svg className="w-12 h-12 mx-auto mb-3 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.0} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
          
          {/* Bottom Bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50/50 backdrop-blur-sm">
            {/* Left: Helper text */}
            <p className="text-[10px] text-gray-500">
              <kbd className="px-1 py-0.5 text-[9px] bg-white border border-gray-300 rounded shadow-sm">Enter</kbd> to send • <kbd className="px-1 py-0.5 text-[9px] bg-white border border-gray-300 rounded shadow-sm">Shift+Enter</kbd> for new line
            </p>
            
            {/* Right: Reserved for future model selector */}
            {/* TODO: Model selection/enforcement will be redesigned later */}
          </div>
        </div>
      </div>
    </div>
  )
}
