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

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useOrchestratorStream, ChatMessage } from '@/hooks/useOrchestratorStream'
import { StructureCreatedEvent, ClarificationEvent, CreationProgress } from '@/types/orchestrator-streaming-types'
import { useOrchestratorSession } from '@/lib/orchestrator/hooks/useOrchestratorSession'
import { ThinkingBlock } from '@/components/ui/molecules/ThinkingBlock'
import { MarkdownContent } from '@/components/ui/atoms/MarkdownContent'

// ============================================================
// Props Interface
// ============================================================

export interface OrchestratorPanelStreamingProps {
  userId: string
  sessionId?: string
  storyId?: string  // Canvas/project ID (from URL: /canvas?id=...)
                   // All story nodes on the same canvas share this orchestrator chat
  documentFormat?: string
  
  // Canvas/editor integration callbacks
  onStructureComplete?: (structure: StructureCreatedEvent) => void
  onSectionComplete?: (sectionId: string, content: string) => void
  onClarificationNeeded?: (clarification: ClarificationEvent) => void
  onCreateStoryNode?: (structure: any) => void
  
  // Navigation callbacks - triggered when user asks to open/navigate
  onOpenDocument?: (nodeId: string, nodeName: string) => void
  onSelectSection?: (sectionId: string, sectionName: string) => void
  
  // Context from parent
  activeSegment?: any
  documentPanelOpen?: boolean
  canvasContext?: any
  structureItems?: any[]
  canvasNodes?: any[]
  conversationHistory?: any[]
  
  className?: string
}

// ============================================================
// Main Component
// ============================================================

export function OrchestratorPanelStreaming({
  userId,
  sessionId,
  storyId,  // Canvas/project ID for persistence
  documentFormat = 'novel',
  onStructureComplete,
  onSectionComplete,
  onClarificationNeeded,
  onCreateStoryNode,
  onOpenDocument,
  onSelectSection,
  activeSegment,
  documentPanelOpen,
  canvasContext,
  structureItems,
  canvasNodes,
  conversationHistory,
  className = '',
}: OrchestratorPanelStreamingProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Track pending clarification state - when system asks a question
  // Options can be string array or object array depending on backend response
  const [pendingClarification, setPendingClarification] = useState<{
    originalAction: string;
    message: string;
    options?: unknown[];  // Can be strings or {id, label} objects
  } | null>(null)

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
    
    onStructureComplete: (structure) => {
      console.log('📐 [Streaming] Structure created:', structure.title, 'with', structure.sections?.length, 'sections')
      onStructureComplete?.(structure)
      
      // Also trigger canvas node creation if callback provided
      // IMPORTANT: Use the field names expected by handleCreateStoryNode:
      //   - label (not title) - Node display name
      //   - items (not sections) - Array of structure items
      //   - format - Document type (novel, podcast, etc.)
      if (onCreateStoryNode) {
        onCreateStoryNode({
          label: structure.title,           // ← "label" for node display
          items: structure.sections || [],  // ← "items" for structure data
          format: structure.format || 'novel',
        })
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
      onOpenDocument?.(nodeId, nodeName)
    },
    
    onSelectSection: (sectionId, sectionName) => {
      console.log('📍 [Streaming] Selecting section:', sectionName, sectionId)
      onSelectSection?.(sectionId, sectionName)
    },
    
    onComplete: () => {
      console.log('🎉 [Streaming] Generation complete')
    },
    
    onError: (error) => {
      console.error('❌ [Streaming] Error:', error)
    },
  })

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, progress])

  // Handle clarification option selection
  const handleOptionSelect = useCallback((optionId: string, originalAction?: string) => {
    console.log('🔘 [Clarification] Option selected:', { optionId, originalAction })
    
    // Send the selected option as a clarification response
    startStream({
      message: optionId,  // Show what was selected
      userId,
      sessionId,
      storyId,  // Canvas/project ID for context
      documentFormat,
      activeSegment,
      documentPanelOpen,
      canvasContext,
      structureItems,
      canvasNodes,
      conversationHistory,
      clarificationResponse: optionId,  // The option ID
      originalAction: originalAction || 'create_structure',  // Action that needed clarification
    })
  }, [
    startStream,
    userId,
    sessionId,
    storyId,
    documentFormat,
    activeSegment,
    documentPanelOpen,
    canvasContext,
    structureItems,
    canvasNodes,
    conversationHistory,
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
        documentFormat,
        activeSegment,
        documentPanelOpen,
        canvasContext,
        structureItems,
        canvasNodes,
        conversationHistory,
        clarificationResponse: message,  // User's typed response
        originalAction,
      })
      return
    }

    // Normal message - start the stream with full context
    startStream({
      message,
      userId,
      sessionId,
      storyId,  // Canvas/project ID for context
      documentFormat,
      activeSegment,
      documentPanelOpen,
      canvasContext,
      structureItems,
      canvasNodes,
      conversationHistory,
    })
  }, [
    input, 
    isStreaming, 
    startStream, 
    userId, 
    sessionId,
    storyId,
    documentFormat,
    activeSegment,
    documentPanelOpen,
    canvasContext,
    structureItems,
    canvasNodes,
    conversationHistory,
    pendingClarification,
  ])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            Crazy Assistant
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Creating...
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              onOptionSelect={handleOptionSelect}
            />
          ))
        )}
        
        {/* Progress Panel - shows during creation */}
        {progress.isActive && progress.structure && (
          <ProgressPanel progress={progress} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSubmit}
        className="p-4 border-t border-gray-200 dark:border-gray-700"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'Creating your story...' : 'Create a story about...'}
            disabled={isStreaming}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all duration-200"
          >
            {isStreaming ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </span>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="text-4xl mb-4">📖</div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        Ready to create
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        Tell me what kind of story you'd like to create and I'll help bring it to life.
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
  const baseClasses = "px-4 py-3 rounded-2xl max-w-[85%] animate-fadeIn"
  
  switch (message.type) {
    case 'user':
      return (
        <div className="flex justify-end">
          <div className={`${baseClasses} bg-blue-600 text-white`}>
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
      
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100`}>
            <MarkdownContent compact>{message.content}</MarkdownContent>
            {isClarification && options.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {options.map((option, idx) => {
                  // Handle both object and string options
                  const label = typeof option === 'string' ? option : option.label;
                  const value = typeof option === 'string' ? option : option.id;
                  const description = typeof option === 'string' ? undefined : option.description;
                  const originalAction = (clarificationMeta as { originalAction?: string })?.originalAction;
                  
                  return (
                    <button
                      key={value || idx}
                      onClick={() => onOptionSelect?.(value, originalAction)}
                      title={description}
                      className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 
                                 text-blue-700 dark:text-blue-300 rounded-full
                                 hover:bg-blue-200 dark:hover:bg-blue-900/50 
                                 transition-colors cursor-pointer"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )

    case 'progress':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800`}>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse mr-2" />
            {message.content}
          </div>
        </div>
      )

    case 'structure':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800`}>
            {message.content}
          </div>
        </div>
      )

    case 'section-progress':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-sm`}>
            {message.content}
          </div>
        </div>
      )

    case 'thinking':
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-gray-50 dark:bg-gray-800/50 w-full text-gray-500 dark:text-gray-400 text-sm italic`}>
            💭 {message.content}
          </div>
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
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800`}>
            {message.content}
          </div>
        </div>
      )

    default:
      return (
        <div className="flex justify-start">
          <div className={`${baseClasses} bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100`}>
            <MarkdownContent compact>{message.content}</MarkdownContent>
          </div>
        </div>
      )
  }
}

function ProgressPanel({ progress }: { progress: CreationProgress }) {
  if (!progress.structure) return null

  const { structure, percentComplete, stage, currentSection } = progress

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="font-semibold">{structure.title}</span>
          </div>
          <span className="text-sm opacity-90">
            {stage === 'complete' ? '✓ Complete' : `${Math.round(percentComplete)}%`}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Sections list */}
      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
        {structure.sections.map((section, index) => (
          <div
            key={section.id}
            className={`
              flex items-center gap-3 p-2 rounded-lg transition-all duration-300
              ${section.status === 'complete' 
                ? 'bg-green-50 dark:bg-green-900/20' 
                : section.status === 'writing'
                  ? 'bg-amber-50 dark:bg-amber-900/20'
                  : 'bg-gray-50 dark:bg-gray-800/50'
              }
            `}
          >
            {/* Status icon */}
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium
              ${section.status === 'complete'
                ? 'text-green-600 dark:text-green-400'
                : section.status === 'writing'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-400'
              }
            `}>
              {section.status === 'complete' && '✓'}
              {section.status === 'writing' && <span className="animate-pulse">●</span>}
              {section.status === 'pending' && '○'}
            </div>

            {/* Title */}
            <span className={`flex-1 text-sm ${
              section.status === 'pending' 
                ? 'text-gray-400' 
                : 'text-gray-900 dark:text-gray-100'
            }`}>
              {index + 1}. {section.title}
            </span>

            {/* Word count */}
            {section.wordCount && (
              <span className="text-xs text-gray-400">
                {section.wordCount}w
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        {stage === 'planning' && '🤔 Planning structure...'}
        {stage === 'structuring' && '📐 Building outline...'}
        {stage === 'writing' && `✍️ Writing: ${currentSection || '...'}`}
        {stage === 'reviewing' && '🔍 Reviewing...'}
        {stage === 'complete' && '✅ All sections complete!'}
        {stage === 'error' && `❌ ${progress.error}`}
      </div>
    </div>
  )
}

export default OrchestratorPanelStreaming