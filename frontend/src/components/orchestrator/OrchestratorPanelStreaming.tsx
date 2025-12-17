/**
 * OrchestratorPanelStreaming
 * 
 * Progressive streaming UI for the orchestrator.
 * Shows real-time feedback as stories are created:
 * - Structure creation with section list
 * - Per-section writing progress
 * - Visual completion states
 * 
 * @feature NEXT_PUBLIC_USE_STREAMING_ORCHESTRATOR
 */
'use client'

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { 
  ChevronDownIcon, 
  SpeakerLoudIcon, 
  PaperPlaneIcon,
  MixerHorizontalIcon,
  LightningBoltIcon,
  CheckCircledIcon,
  FileTextIcon,
  Pencil1Icon,
  CursorArrowIcon,
  GearIcon,
  ExclamationTriangleIcon,
  MagicWandIcon,
} from '@radix-ui/react-icons'
import { useOrchestratorStream, ChatMessage } from '@/hooks/useOrchestratorStream'
import { StructureCreatedEvent, ClarificationEvent, CreationProgress } from '@/types/orchestrator-streaming-types'
import { useOrchestratorSession } from '@/lib/orchestrator/hooks/useOrchestratorSession'
import { ThinkingBlock } from '@/components/ui/molecules/ThinkingBlock'
import { StructureProgress } from '@/components/ui/molecules/StructureProgress'
import { MarkdownContent } from '@/components/ui/atoms/MarkdownContent'
import { ChatOptionPill } from '@/components/ui/atoms/ChatOptionPill'
import { TodoPanel } from '@/components/ui/organisms/TodoPanel'
import { SubagentActivity } from '@/components/ui/organisms/SubagentActivity'
import { ViewToggle, ViewToggleIcons } from '@/components/ui/atoms/ViewToggle'

// ============================================================
// Props Interface
// ============================================================

export interface OrchestratorPanelStreamingProps {
  userId: string
  sessionId?: string
  storyId?: string  // Canvas/project ID (from URL: /canvas?id=...)
                   // All story nodes on the same canvas share this orchestrator chat
  documentFormat?: string
  orchestratorNodeId?: string
  
  // Canvas/editor integration callbacks
  onStructureComplete?: (structure: StructureCreatedEvent) => void
  onSectionComplete?: (sectionId: string, content: string) => void
  onClarificationNeeded?: (clarification: ClarificationEvent) => void
  onCreateStoryNode?: (structure: any) => string | Promise<string> | void
  
  // Navigation callbacks - triggered when user asks to open/navigate
  onOpenDocument?: (nodeId: string, nodeName: string) => void
  onSelectSection?: (sectionId: string, sectionName: string) => void
  
  // Content streaming callbacks - for real-time document updates
  onContentChunk?: (sectionId: string, chunk: string, accumulated: string) => void
  onContentComplete?: (sectionId: string, wordCount: number) => void
  
  // Context from parent
  activeSegment?: any
  documentPanelOpen?: boolean
  canvasContext?: any
  structureItems?: any[]
  canvasNodes?: any[]
  canvasEdges?: any[]
  conversationHistory?: any[]
  currentStoryStructureNodeId?: string  // Active structure node for Librarian context
  activeSectionCard?: any  // Section card currently being viewed (for Librarian context)
  
  // Document panel toggle
  isDocumentViewOpen?: boolean
  onToggleDocumentView?: () => void
  
  className?: string

  /**
   * Optional: update the orchestrator canvas node UI (spinner/progress/status)
   * while streaming is running.
   */
  onOrchestratorNodeUpdate?: (updates: {
    isOrchestrating?: boolean
    orchestratorProgress?: number
    loadingText?: string
    orchestratorStage?: 'idle' | 'thinking' | 'structuring' | 'writing' | 'done' | 'error'
  }) => void
}

// ============================================================
// Main Component
// ============================================================

export function OrchestratorPanelStreaming({
  userId,
  sessionId,
  storyId,  // Canvas/project ID for persistence
  documentFormat = 'novel',
  orchestratorNodeId,
  onStructureComplete,
  onSectionComplete,
  onClarificationNeeded,
  onCreateStoryNode,
  onOpenDocument,
  onSelectSection,
  onContentChunk,
  onContentComplete,
  activeSegment,
  documentPanelOpen,
  canvasContext,
  structureItems,
  canvasNodes,
  canvasEdges,
  conversationHistory,
  currentStoryStructureNodeId,
  activeSectionCard,
  isDocumentViewOpen = false,
  onToggleDocumentView,
  className = '',
  onOrchestratorNodeUpdate,
}: OrchestratorPanelStreamingProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Track the most recently created structure node ID (updated synchronously)
  // This is used as a fallback when effectiveStoryStructureNodeId hasn't updated yet
  const lastCreatedStructureNodeIdRef = useRef<string | null>(null)
  
  // Track pending clarification state - when system asks a question
  // Options can be string array or object array depending on backend response
  const [pendingClarification, setPendingClarification] = useState<{
    originalAction: string;
    message: string;
    options?: unknown[];  // Can be strings or {id, label} objects
  } | null>(null)
  
  // Extended thinking toggle - shows Claude's chain-of-thought reasoning
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false)

  // ========== PERSISTENCE HOOK ==========
  // Load persisted dialogue messages (scoped to canvas/story)
  // Note: Persistence is enabled by default if userId and storyId are provided
  // Set NEXT_PUBLIC_USE_PERSISTENT_STATE=false to disable
  const persistenceEnabled = process.env.NEXT_PUBLIC_USE_PERSISTENT_STATE !== 'false'
  const {
    session,
    messages: persistedMessages,
    persistMessage,
    isEnabled: isPersistenceEnabled,
    isLoading: isLoadingPersisted
  } = useOrchestratorSession({
    userId,
    storyId,  // Scope session to canvas (storyId from URL = canvas ID)
    enabled: !!userId && !!storyId && persistenceEnabled
  })
  
  // Log persistence status for debugging
  useEffect(() => {
    if (isPersistenceEnabled) {
      console.log('💾 [Persistence] Enabled for canvas:', storyId, 'Session:', session?.id)
      console.log('💾 [Persistence] Loaded', persistedMessages.length, 'persisted messages')
    } else {
      console.log('⚠️ [Persistence] Disabled - userId:', !!userId, 'storyId:', !!storyId, 'env:', persistenceEnabled)
    }
  }, [isPersistenceEnabled, storyId, session?.id, persistedMessages.length, userId])

  // ========== CONVERT PERSISTED MESSAGES TO CHAT FORMAT ==========
  // Only load dialogue messages (user/assistant), skip thinking/progress
  const initialMessages: ChatMessage[] = React.useMemo(() => {
    if (!persistedMessages || persistedMessages.length === 0) {
      return []
    }
    
    return persistedMessages
      .filter(msg => {
        // Only include dialogue messages:
        // - USER type = user messages
        // - RESULT type = assistant messages (we save assistant messages as RESULT)
        // Note: We filter by type because that's what we saved
        const type = msg.type?.toUpperCase()
        return type === 'USER' || type === 'RESULT'
      })
      .map(msg => {
        const type = msg.type?.toUpperCase()
        return {
          id: msg.id,
          type: type === 'USER' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(msg.created_at),
          metadata: msg.metadata
        }
      })
  }, [persistedMessages])

  // Initialize the streaming hook
  const {
    messages,
    progress,
    todos,
    subagentActivities,
    isStreaming,
    startStream,
    clearMessages,
  } = useOrchestratorStream({
    streamUrl: process.env.NEXT_PUBLIC_ORCHESTRATOR_URL 
      ? `${process.env.NEXT_PUBLIC_ORCHESTRATOR_URL}/orchestrate/stream`
      : '/api/orchestrator/orchestrate/stream',
    
    // Load persisted dialogue messages on mount
    initialMessages,
    
    // Persist new dialogue messages (user/assistant only, skip thinking/progress)
    onMessageAdded: (message: ChatMessage) => {
      // Only persist dialogue messages - explicitly check for valid types
      if (!isPersistenceEnabled || !persistMessage) {
        if (message.type === 'user' || message.type === 'assistant') {
          console.log('⚠️ [Persistence] Message not persisted (disabled):', { 
            isPersistenceEnabled, 
            hasPersistMessage: !!persistMessage,
            type: message.type 
          })
        }
        return
      }
      
      // Strict type check - only persist 'user' and 'assistant'
      if (message.type !== 'user' && message.type !== 'assistant') {
        // Silently skip non-dialogue messages (thinking, progress, error, etc.)
        return
      }
      
      const role = message.type === 'user' ? 'user' : 'orchestrator'
      // Map message type to database type:
      // - 'user' → 'USER' (message type for user messages)
      // - 'assistant' → 'RESULT' (message type for assistant responses)
      // Note: The database 'type' field is for message types (USER, RESULT, ERROR, etc.),
      // NOT roles. Roles are stored in the 'role' field (user, orchestrator, system).
      const dbType = message.type === 'user' ? 'USER' : 'RESULT'
      
      console.log('💾 [Persistence] Saving message:', { 
        type: message.type, 
        role, 
        dbType, 
        contentLength: message.content.length,
        hasMetadata: !!message.metadata,
        messageId: message.id
      })
      
      // persistMessage returns a Promise - handle it properly
      persistMessage(role, message.content, dbType, message.metadata)
        .then(() => {
          console.log('✅ [Persistence] Message saved successfully:', message.id)
        })
        .catch(err => {
          console.error('❌ [Persistence] Failed to persist message in callback:', {
            messageId: message.id,
            type: message.type,
            dbType,
            role,
            error: err
          })
        })
    },
    
    onStructureComplete: async (structure) => {
      console.log('📐 [Streaming] Structure created:', structure.title, 'with', structure.sections?.length, 'sections')
      onStructureComplete?.(structure)
      
      // Capture backend-provided structure node id immediately (prevents OPEN_DOCUMENT race)
      if (structure.node_id) {
        lastCreatedStructureNodeIdRef.current = structure.node_id
      }

      // Also trigger canvas node creation if callback provided
      // IMPORTANT: Use the field names expected by handleCreateStoryNode:
      //   - label (not title) - Node display name
      //   - items (not sections) - Array of structure items
      //   - format - Document type (novel, podcast, etc.)
      //   - nodeId - Backend-generated ID for content storage alignment
      if (onCreateStoryNode) {
        const result = onCreateStoryNode({
          label: structure.title,           // ← "label" for node display
          items: structure.sections || [],  // ← "items" for structure data
          format: structure.format || 'novel',
          nodeId: structure.node_id,        // ← Backend-provided node ID
        })
        // Handle both sync and async returns
        const newNodeId = result instanceof Promise ? await result : result
        // Store the new node ID immediately for use in onOpenDocument
        // Use backend-provided ID if available, otherwise use returned ID
        const capturedNodeId = structure.node_id || (newNodeId && typeof newNodeId === 'string' ? newNodeId : null)
        if (capturedNodeId) {
          console.log('📌 [Streaming] Captured new structure node ID:', capturedNodeId)
          lastCreatedStructureNodeIdRef.current = capturedNodeId
        }
      }
    },
    
    onSectionComplete: (sectionId, content) => {
      console.log(`✅ [Streaming] Section ${sectionId} complete`)
      onSectionComplete?.(sectionId, content)
    },
    
    onClarificationNeeded: (clarification) => {
      console.log('❓ [Streaming] Clarification needed:', clarification.options)
      
      // Track the clarification state so typed responses are handled correctly
      setPendingClarification({
        originalAction: clarification.originalAction || 'create_structure',
        message: clarification.message || 'Please choose an option',
        options: clarification.options || []
      })
      
      onClarificationNeeded?.(clarification)
    },
    
    // Navigation callbacks
    onOpenDocument: (nodeId, nodeName) => {
      console.log('📂 [Streaming] Opening document:', nodeName, nodeId)
      
      // Fix: If this node was just created in this session (via create_structure),
      // skip the onSelectNode call. The document panel is already being opened
      // via onStoryNodeCreated, and React Flow's nodes state hasn't updated yet.
      // This prevents the race condition where onSelectNode fails to find the node.
      if (nodeId === lastCreatedStructureNodeIdRef.current) {
        console.log('⏭️ [Streaming] Skipping onSelectNode for just-created node:', nodeId)
        // Clear the ref so subsequent OPEN_DOCUMENT calls work normally
        lastCreatedStructureNodeIdRef.current = null
        return
      }
      
      // Also handle canvas ID fallback (for backward compatibility)
      let resolvedNodeId = nodeId;
      if (nodeId && !nodeId.startsWith('story-structure-')) {
        const fallbackNodeId = effectiveStoryStructureNodeId || lastCreatedStructureNodeIdRef.current;
        if (fallbackNodeId) {
          console.log('🔄 [Streaming] Resolving canvas ID to structure node:', nodeId, '->', fallbackNodeId)
          resolvedNodeId = fallbackNodeId;
        }
      }
      
      onOpenDocument?.(resolvedNodeId, nodeName)
    },
    
    onSelectSection: (sectionId, sectionName) => {
      console.log('📍 [Streaming] Selecting section:', sectionName, sectionId)
      onSelectSection?.(sectionId, sectionName)
    },
    
    // Content streaming - for real-time document updates
    onContentChunk: (sectionId, chunk, accumulated) => {
      // Forward chunk to parent for document panel display
      onContentChunk?.(sectionId, chunk, accumulated)
    },
    
    // Content complete - triggers document refresh after content is written to DB
    onContentComplete: (sectionId, wordCount) => {
      console.log('🔄 [Streaming] Content complete, triggering refresh for:', sectionId, wordCount, 'words')
      onContentComplete?.(sectionId, wordCount)
    },
    
    onComplete: () => {
      console.log('🎉 [Streaming] Generation complete')
    },
    
    onError: (error) => {
      console.error('❌ [Streaming] Error:', error)
    },
  })

  // ======================================================================
  // Canvas node status beacon (OrchestratorNode)
  // ======================================================================
  const lastNodeStatusRef = useRef<string>('')
  useEffect(() => {
    if (!onOrchestratorNodeUpdate) return

    const stage = progress?.stage || 'idle'
    const percent = typeof progress?.percentComplete === 'number' ? progress.percentComplete : 0
    const isActive = !!isStreaming

    let orchestratorStage: 'idle' | 'thinking' | 'structuring' | 'writing' | 'done' | 'error' = 'idle'
    let loadingText = 'ORCHESTRATOR'

    if (stage === 'error') {
      orchestratorStage = 'error'
      loadingText = 'ERROR'
    } else if (stage === 'complete') {
      orchestratorStage = 'done'
      loadingText = 'DONE'
    } else if (isActive || stage !== 'idle') {
      if (stage === 'planning') {
        orchestratorStage = 'thinking'
        loadingText = 'THINKING'
      } else if (stage === 'structuring') {
        orchestratorStage = 'structuring'
        loadingText = 'CREATING STRUCTURE'
      } else if (stage === 'writing') {
        orchestratorStage = 'writing'
        loadingText = progress?.currentSection ? `WRITING ${progress.currentSection}` : 'WRITING'
      } else {
        orchestratorStage = 'thinking'
        loadingText = 'WORKING'
      }
    }

    // Avoid spamming node updates; only update when something meaningful changed.
    const key = JSON.stringify({
      orchestratorStage,
      loadingText,
      isActive,
      percent: Math.round(percent),
    })
    if (key === lastNodeStatusRef.current) return
    lastNodeStatusRef.current = key

    onOrchestratorNodeUpdate({
      isOrchestrating: isActive,
      orchestratorProgress: Math.round(percent),
      loadingText: isActive || stage !== 'idle' ? loadingText : '',
      orchestratorStage,
    })
  }, [onOrchestratorNodeUpdate, isStreaming, progress?.stage, progress?.percentComplete, progress?.currentSection])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, progress])

  // Auto-detect story structure node if not explicitly set
  // This handles the case where user opens orchestrator panel without clicking on a story node first
  const { effectiveStoryStructureNodeId, effectiveStructureItems } = useMemo(() => {
    // If we have explicit values, use them
    if (currentStoryStructureNodeId && structureItems && structureItems.length > 0) {
      return { 
        effectiveStoryStructureNodeId: currentStoryStructureNodeId, 
        effectiveStructureItems: structureItems 
      }
    }
    
    // Find story structure nodes on canvas
    const storyNodes = canvasNodes?.filter((n: any) => 
      n.type === 'storyStructureNode' || n.data?.nodeType === 'story-structure'
    ) || []
    
    // If there's exactly one story structure, use it
    if (storyNodes.length === 1) {
      const node = storyNodes[0]
      const nodeItems = node.data?.items || []
      // NOTE: Don't console.log here - causes React state update during render
      return { 
        effectiveStoryStructureNodeId: node.id, 
        effectiveStructureItems: nodeItems 
      }
    }
    
    return { effectiveStoryStructureNodeId: null, effectiveStructureItems: [] }
  }, [currentStoryStructureNodeId, canvasNodes, structureItems])

  // Debug effective values (development only)
  useEffect(() => {
    console.log('📊 [Streaming] Effective values:', {
      effectiveStoryStructureNodeId,
      effectiveStructureItemsCount: effectiveStructureItems?.length || 0,
      sampleEffectiveIds: effectiveStructureItems?.slice(0, 3).map((i: any) => i?.id),
    })
  }, [effectiveStoryStructureNodeId, effectiveStructureItems])

  // Handle clarification option selection
  const handleOptionSelect = useCallback((optionId: string, originalAction?: string) => {
    console.log('🔘 [Clarification] Option selected:', { optionId, originalAction })
    
    // Send the selected option as a clarification response
    startStream({
      message: optionId,  // Show what was selected
      userId,
      sessionId,
      storyId,  // Canvas/project ID for context
      orchestratorNodeId,
      storyStructureNodeId: effectiveStoryStructureNodeId,  // Auto-detected or explicit
      documentFormat,
      activeSegment,
      documentPanelOpen,
      canvasContext,
      structureItems: effectiveStructureItems,
      canvasNodes,
      canvasEdges,
      conversationHistory,
      clarificationResponse: optionId,  // The option ID
      originalAction: originalAction || 'create_structure',  // Action that needed clarification
      activeSectionCard,  // Section card being viewed
      extendedThinking: extendedThinkingEnabled,  // Enable Claude's chain-of-thought
    })
  }, [
    startStream,
    userId,
    sessionId,
    storyId,
    orchestratorNodeId,
    effectiveStoryStructureNodeId,
    documentFormat,
    activeSegment,
    documentPanelOpen,
    canvasContext,
    effectiveStructureItems,
    canvasNodes,
    canvasEdges,
    conversationHistory,
    extendedThinkingEnabled,
  ])

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    const message = input.trim()
    setInput('')

    // Check if we're responding to a pending clarification
    if (pendingClarification) {
      console.log('🔘 [Clarification] Treating typed response as clarification:', message)
      
      // Clear pending clarification
      const { originalAction } = pendingClarification
      setPendingClarification(null)
      
      // Send as clarification response
      startStream({
        message,
        userId,
        sessionId,
        storyId,  // Canvas/project ID for context
        orchestratorNodeId,
        storyStructureNodeId: effectiveStoryStructureNodeId,  // Auto-detected or explicit
        documentFormat,
        activeSegment,
        documentPanelOpen,
        canvasContext,
        structureItems: effectiveStructureItems,
        canvasNodes,
        canvasEdges,
        conversationHistory,
        clarificationResponse: message,  // User's typed response
        originalAction,
        activeSectionCard,  // Section card being viewed
        extendedThinking: extendedThinkingEnabled,  // Enable Claude's chain-of-thought
      })
      return
    }

    // Normal message - start the stream with full context
    startStream({
      message,
      userId,
      sessionId,
      storyId,  // Canvas/project ID for context
      orchestratorNodeId,
      storyStructureNodeId: effectiveStoryStructureNodeId,  // Auto-detected or explicit
      documentFormat,
      activeSegment,
      documentPanelOpen,
      canvasContext,
      structureItems: effectiveStructureItems,
      canvasNodes,
      canvasEdges,
      conversationHistory,
      activeSectionCard,  // Section card being viewed
      extendedThinking: extendedThinkingEnabled,  // Enable Claude's chain-of-thought
    })
  }, [
    input, 
    isStreaming, 
    startStream, 
    userId, 
    sessionId,
    storyId,
    orchestratorNodeId,
    effectiveStoryStructureNodeId,
    documentFormat,
    activeSegment,
    documentPanelOpen,
    canvasContext,
    effectiveStructureItems,
    canvasNodes,
    canvasEdges,
    conversationHistory,
    pendingClarification,
    activeSectionCard,
    extendedThinkingEnabled,
  ])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className={`flex flex-col h-full  dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b-2 border-zinc-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
        
          
          {/* View Toggle - Canvas/Document */}
          {onToggleDocumentView && (
            <ViewToggle
              options={[
                { id: 'canvas', label: 'Canvas', icon: ViewToggleIcons.Canvas },
                { id: 'document', label: 'Document', icon: ViewToggleIcons.Document },
              ]}
              value={isDocumentViewOpen ? 'document' : 'canvas'}
              onChange={(value) => {
                if ((value === 'document') !== isDocumentViewOpen) {
                  onToggleDocumentView()
                }
              }}
            />
          )}
          
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-ping" />
              &nbsp;
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="bg-white bg-opacity-50 dark:bg-gray-800 flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages
            // Hide progress messages when TodoPanel is showing (avoids redundant indicators)
            .filter(message => {
              if (todos && todos.length > 0) {
                // Hide section-progress and thinking messages when todos show progress
                if (message.type === 'section-progress') return false
                if (message.type === 'thinking') return false
                if (message.type === 'progress') return false
              }
              return true
            })
            .map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                onOptionSelect={handleOptionSelect}
              />
            ))
        )}
        
        {/* Progress Panel - shows during creation */}
        {progress.isActive && progress.structure && (
          <StructureProgress
            structure={progress.structure}
            stage={progress.stage}
            percentComplete={progress.percentComplete}
            currentSection={progress.currentSection}
            error={progress.error}
            compact
          />
        )}
        
        {/* Todo Panel - shows agent's task plan */}
        {todos && todos.length > 0 && (() => {
          // Only allow collapsing when ALL tasks are complete (not in progress)
          const allComplete = todos.every(t => t.status === 'completed' || t.status === 'cancelled')
          return (
            <TodoPanel 
              todos={todos}
              title="Task Plan"
              collapsible={allComplete}
              defaultExpanded={true}
              className="mb-3"
            />
          )
        })()}
        
        {/* Subagent Activity Panel - shows subagent invocations */}
        {/* Only show if there are no todos (avoid duplicate task display) */}
        {(!todos || todos.length === 0) && subagentActivities && subagentActivities.length > 0 && (
          <SubagentActivity 
            activities={subagentActivities}
            title="Agent Activity"
            collapsible={true}
            defaultExpanded={true}
            className="mb-3"
          />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSubmit}
        className="pb-8 bg-zinc-50 dark:bg-gray-800 border-zinc-200 dark:border-gray-700 flex flex-col justify-end"
      >
       
        
        <div className="px-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              // Auto-resize: reset height then set to scrollHeight
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={isStreaming ? 'Creating your story...' : 'Plan, @ for context, / for commands'}
            disabled={isStreaming}
            className="border rounded-t-2xl border-b-0 w-full px-4 py-3 border-gray-300 dark:border-gray-600 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       placeholder-gray-200 dark:placeholder-gray-500
                       placeholder-italic focus:outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200 resize-none overflow-hidden
                       min-h-[44px] max-h-[200px]"
          />
        </div>
        
        {/* Toolbar: Pills + Submit/Voice Button */}
        <div className="flex items-center justify-between -mx-2 -mt-2 px-4 py-2 border-t border-gray-300 dark:border-gray-700">
          {/* Left: Pill Selectors */}
          <div className="flex items-center gap-1.5">
            {/* Agent Mode Pill */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                         bg-gray-200 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                         text-xs font-medium text-gray-700 dark:text-gray-300
                         transition-colors duration-150"
            >
              <LightningBoltIcon className="w-3 h-3" />
              <span>Agent</span>
              <ChevronDownIcon className="w-3 h-3 opacity-50" />
            </button>
            
            {/* Model Pill */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                         bg-gray-200 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                         text-xs font-medium text-gray-700 dark:text-gray-300
                         transition-colors duration-150"
            >
              <MixerHorizontalIcon className="w-3 h-3" />
              <span>Model</span>
              <ChevronDownIcon className="w-3 h-3 opacity-50" />
            </button>
            
            
          </div>
          
          {/* Right: Extended Thinking Toggle + Voice/Submit */}
          <div className="flex items-center gap-2">
            {/* Extended Thinking Toggle */}
            <button
              type="button"
              onClick={() => setExtendedThinkingEnabled(!extendedThinkingEnabled)}
              title={extendedThinkingEnabled ? 'Extended thinking ON - shows reasoning' : 'Extended thinking OFF'}
              className={`w-8 h-8 rounded-full flex items-center justify-center
                         transition-colors duration-150
                         ${extendedThinkingEnabled 
                           ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' 
                           : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500'}`}
            >
              <MagicWandIcon className="w-4 h-4" />
            </button>
            
            {/* Voice/Submit Button */}
            <button
              type="button"
              onClick={() => {
                if (input.trim()) {
                  handleSubmit({ preventDefault: () => {} } as React.FormEvent)
                }
                // Voice functionality placeholder
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center
                          transition-all duration-200 ${
                            input.trim()
                              ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-700'
                              : 'bg-gray-500 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-200 dark:text-gray-400'
                          }`}
            >
              {input.trim() ? (
                <PaperPlaneIcon className="w-4 h-4" />
              ) : (
                <SpeakerLoudIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </form>
      
      <div 
        className={`absolute bottom-0 left-0 right-0 flex justify-center items-center gap-1 pt-1 pb-2
                    ${isStreaming 
                      ? 'bg-gradient-to-r from-zinc-200 via-amber-100 to-zinc-200 bg-[length:200%_100%] animate-shimmer' 
                      : 'bg-zinc-200'}`}
      >
        <p className="text-zinc-600 text-[10px] uppercase tracking-wide">Intelligence Engineered by</p>
        <img src="/aiakaki_logo.svg" alt="AIAKAKI" className="h-2" />
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-12 h-12 mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
        <FileTextIcon className="w-6 h-6 text-indigo-500" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        Ready to create
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        Tell me what kind of story you&apos;d like to create and I&apos;ll help bring it to life.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {['A mystery thriller', 'A sci-fi adventure', 'A romantic comedy'].map((suggestion) => (
          <button
            key={suggestion}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 
                       text-gray-700 dark:text-gray-300 rounded-full
                       hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message, onOptionSelect }: { message: ChatMessage; onOptionSelect?: (option: string, originalAction?: string) => void }) {
  // User messages use bubble styling, everything else is full-width
  const userBubbleClasses = "px-4 py-3 rounded-md border border-zinc-200 dark:border-zinc-700 w-full animate-fadeIn"
  
  switch (message.type) {
    case 'user':
      return (
        <div className="flex justify-start">
          <div className={`${userBubbleClasses} bg-white text-zinc-700 text-sm`}>
            {message.content}
          </div>
        </div>
      )

    case 'assistant':
      // Check if this is a clarification message with options
      // Options are objects with {id, label, description}
      type ClarificationOption = { id: string; label: string; description?: string } | string;
      const clarificationMeta = message.metadata as { type?: string; options?: ClarificationOption[] } | undefined;
      const isClarification = clarificationMeta?.type === 'clarification';
      const options = clarificationMeta?.options || [];
      
      // Use full-width clean styling for clarification messages, bubble for regular
      if (isClarification && options.length > 0) {
        return (
          <div className="w-full animate-fadeIn">
            <div className="text-gray-900 dark:text-gray-100 mb-3">
              <MarkdownContent compact>{message.content}</MarkdownContent>
            </div>
            <div className="flex flex-col gap-2">
              {options.map((option, idx) => {
                const label = typeof option === 'string' ? option : option.label;
                const value = typeof option === 'string' ? option : option.id;
                const description = typeof option === 'string' ? undefined : option.description;
                const originalAction = (clarificationMeta as { originalAction?: string })?.originalAction;
                
                return (
                  <ChatOptionPill
                    key={value || idx}
                    number={idx + 1}
                    title={label}
                    description={description}
                    onClick={() => onOptionSelect?.(value, originalAction)}
                  />
                );
              })}
            </div>
          </div>
        )
      }
      
      // Regular assistant message - full width, clean styling
      return (
        <div className="w-full animate-fadeIn text-gray-900 dark:text-gray-100">
          <MarkdownContent compact>{message.content}</MarkdownContent>
        </div>
      )

    case 'progress':
      return (
        <div className="w-full animate-fadeIn flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm">
          <GearIcon className="w-4 h-4 flex-shrink-0 animate-spin text-indigo-500" />
          <span>{message.content}</span>
        </div>
      )

    case 'structure':
      return (
        <div className="w-full animate-fadeIn flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm">
          <FileTextIcon className="w-4 h-4 flex-shrink-0" />
          <span>{message.content}</span>
        </div>
      )

    case 'section-progress':
      return (
        <div className="w-full animate-fadeIn flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
          <Pencil1Icon className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>{message.content}</span>
        </div>
      )

    case 'thinking':
      const isToolComplete = message.metadata?.isComplete === true;
      return (
        <div className={`w-full animate-fadeIn text-sm flex items-start gap-2 ${
          isToolComplete 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-neutral-500 dark:text-neutral-400'
        }`}>
          {isToolComplete ? (
            <CheckCircledIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <GearIcon className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />
          )}
          <span>{message.content}</span>
        </div>
      )

    case 'reasoning':
      // Cursor-style collapsible thinking block using atomic design
      const startTime = message.metadata?.startTime 
        ? new Date(message.metadata.startTime as string) 
        : message.timestamp;
      const endTime = message.metadata?.endTime 
        ? new Date(message.metadata.endTime as string) 
        : undefined;
      const isActiveReasoning = message.metadata?.isStreaming as boolean || false;
      
      return (
        <div className="flex justify-start w-full">
          <div className="w-full">
            <ThinkingBlock
              content={message.content}
              startTime={startTime}
              endTime={endTime}
              isStreaming={isActiveReasoning}
              defaultCollapsed={!isActiveReasoning}
            />
          </div>
        </div>
      )

    case 'error':
      return (
        <div className="w-full animate-fadeIn flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          <span>{message.content}</span>
        </div>
      )

    default:
      return (
        <div className="w-full animate-fadeIn text-gray-900 dark:text-gray-100">
          <MarkdownContent compact>{message.content}</MarkdownContent>
        </div>
      )
  }
}

export default OrchestratorPanelStreaming