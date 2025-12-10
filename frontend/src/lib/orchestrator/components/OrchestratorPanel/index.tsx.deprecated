// src/lib/orchestrator/components/OrchestratorPanel/index.tsx

'use client'

/**
 * OrchestratorPanel - Streaming Version
 * 
 * =============================================================================
 * STREAMING IMPLEMENTATION
 * =============================================================================
 * 
 * This component uses Server-Sent Events (SSE) to receive real-time updates
 * from the Python backend. This enables:
 * - Immediate acknowledgment of user requests
 * - Progressive structure generation (sections appear as they're created)
 * - Real-time status updates in chat
 * 
 * @see streamClient.ts for SSE consumption
 * @see routes_stream.py for Python SSE endpoint
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useOrchestratorSession } from '../../hooks/useOrchestratorSession'
import { orchestrateStream, type StreamCallbacks, type PartialStructure, type ClarificationData } from '../../streamClient'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { 
  OrchestratorPanelProps, 
  Message, 
  OrchestrateResponse,
  CreateStoryNodeData
} from './types'

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function createMessage(
  role: Message['role'],
  content: string,
  type: Message['type'],
  options?: Message['options']
): Message {
  return {
    id: generateMessageId(),
    role,
    content,
    type,
    timestamp: new Date().toISOString(),
    options
  }
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function OrchestratorPanel({
  userId: propUserId,
  storyId,
  activeSegment,
  documentPanelOpen = false,
  documentFormat,
  canvasContext,
  structureItems = [],
  canvasNodes = [],
  storyStructureNodeId,
  orchestratorNodeId,
  onContentGenerated,
  onExecuteAction,
  onStructureUpdate,
  onCreateStoryNode,
  onUpdateStoryNode,  // NEW: For progressive updates
  onToggleDocumentPanel,
  onNavigateToSection,
  onOpenDocument,
  onDeleteNode,
  className
}: OrchestratorPanelProps & {
  onUpdateStoryNode?: (nodeId: string, updates: Partial<CreateStoryNodeData>) => void
}) {
  
  // ========== USER STATE ==========
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null)
  
  useEffect(() => {
    if (currentUserId) return
    
    const supabase = createClient()
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          console.log('👤 [Panel] User loaded:', user.id)
          setCurrentUserId(user.id)
        }
      } catch (error) {
        console.error('❌ [Panel] Failed to get user:', error)
      }
    }
    getUser()
  }, [currentUserId])
  
  // ========== MESSAGE STATE ==========
  const [messages, setMessages] = useState<Message[]>([])
  
  // ========== LOADING/ERROR STATE ==========
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // ========== CLARIFICATION STATE ==========
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [pendingClarification, setPendingClarification] = useState<{
    messageId: string
    originalAction: string
  } | null>(null)
  
  // ========== CURRENT STRUCTURE STATE (for progressive updates) ==========
  const [currentStructureNodeId, setCurrentStructureNodeId] = useState<string | null>(null)
  const structureNodeIdRef = useRef<string | null>(null)
  
  // ========== CLARIFICATION DATA REF (to handle race condition) ==========
  // onClarification fires before onMessage creates the options message,
  // so we store the originalAction here and use it when the message is created
  const pendingClarificationDataRef = useRef<string | null>(null)
  
  // ========== PERSISTENCE HOOK ==========
  const {
    session,
    messages: persistedMessages,
    persistMessage,
    clearHistory,
    isEnabled: isPersistenceEnabled
  } = useOrchestratorSession({
    userId: currentUserId || '',
    storyId,
    enabled: !!currentUserId && process.env.NEXT_PUBLIC_USE_PERSISTENT_STATE === 'true'
  })
  
  // ========== MESSAGE HANDLING ==========
  const addMessage = useCallback((
    role: Message['role'],
    content: string,
    type: Message['type'],
    options?: Message['options']
  ) => {
    const message = createMessage(role, content, type, options)
    setMessages(prev => [...prev, message])
    
    // If this is an options message and we have pending clarification data, set it up
    if (type === 'options' && pendingClarificationDataRef.current) {
      setPendingClarification({
        messageId: message.id,
        originalAction: pendingClarificationDataRef.current
      })
      pendingClarificationDataRef.current = null
      console.log('🔗 [Panel] Linked clarification to message:', message.id)
    }
    
    if (isPersistenceEnabled && persistMessage && type !== 'options' && type !== 'thinking' && type !== 'progress') {
      persistMessage(role, content, type)
    }
    
    return message
  }, [isPersistenceEnabled, persistMessage])
  
  // ========== UPDATE LAST MESSAGE (for streaming) ==========
  const updateLastMessage = useCallback((content: string) => {
    setMessages(prev => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        content
      }
      return updated
    })
  }, [])
  
  // ========== STREAM CALLBACKS ==========
  const createStreamCallbacks = useCallback((): StreamCallbacks => ({
    onMessage: (msg) => {
      console.log('📨 [Panel] Stream message:', msg.type, msg.content.substring(0, 50))
      
      if (msg.type === 'options' && msg.options) {
        // Add options message - addMessage will link it to pending clarification
        addMessage(msg.role, msg.content, 'options', msg.options)
      } else if (msg.type === 'thinking' && process.env.NODE_ENV === 'production') {
        // Skip thinking in production
      } else {
        addMessage(msg.role, msg.content, msg.type as Message['type'])
      }
    },
    
    onPlan: (plan) => {
      console.log('📐 [Panel] Structure plan:', plan.title, plan.sectionCount, 'sections')
      // Plan is informational - actual structure comes in onStructurePartial
    },
    
    onStructurePartial: (structure) => {
      console.log('🏗️ [Panel] Structure skeleton:', structure.title, structure.items.length, 'items')
      
      // Create node on canvas with skeleton structure
      if (onCreateStoryNode) {
        const nodeData: CreateStoryNodeData = {
          format: structure.format,
          label: structure.title,
          items: structure.items.map(item => ({
            id: item.id,
            name: item.name,
            level: item.level,
            summary: item.summary || undefined,
            isLoading: item.isLoading
          })),
          logline: structure.logline,
          template: structure.template,
          isGenerating: true
        }
        
        // Store node ID for updates
        const nodeId = onCreateStoryNode?.(nodeData)
        if (nodeId) {
          structureNodeIdRef.current = nodeId
          setCurrentStructureNodeId(nodeId)
        }
      }
    },
    
    onSectionUpdate: (index, section) => {
      console.log('✍️ [Panel] Section complete:', index, section.name)
      
      // Update the node with completed section
      if (structureNodeIdRef.current && onUpdateStoryNode) {
        onUpdateStoryNode(structureNodeIdRef.current, {
          // This should update just the specific section
          // Implementation depends on how your canvas handles updates
        })
      }
    },
    
    onStructureComplete: (structure) => {
      console.log('✅ [Panel] Structure complete:', structure.title, structure.items?.length, 'items')
      
      // If we already have a node (from progressive generation), update it
      if (structureNodeIdRef.current && onUpdateStoryNode) {
        onUpdateStoryNode(structureNodeIdRef.current, {
          items: structure.items.map(item => ({
            id: item.id,
            name: item.name,
            level: item.level,
            summary: item.summary || undefined
          })),
          isGenerating: false
        } as any)
        structureNodeIdRef.current = null
      } 
      // Otherwise, create a new node (single-shot generation)
      else if (onCreateStoryNode) {
        const nodeData: CreateStoryNodeData = {
          format: structure.format,
          label: structure.title,
          items: structure.items.map(item => ({
            id: item.id,
            name: item.name,
            level: item.level,
            summary: item.summary || undefined
          })),
          logline: structure.logline,
          template: structure.template,
          isGenerating: false
        }
        
        const nodeId = onCreateStoryNode(nodeData)
        console.log('🎉 [Panel] Created story node:', nodeId)
      }
    },
    
    onClarification: (data) => {
      console.log('❓ [Panel] Clarification needed:', data.originalAction)
      
      // Store the originalAction - will be linked to message in addMessage
      pendingClarificationDataRef.current = data.originalAction || 'create_structure'
    },
    
    onAction: (action) => {
      console.log('⚡ [Panel] Action:', action.type)
      onExecuteAction?.({ type: action.type, payload: action.payload } as any)
    },
    
    onIntent: (intent) => {
      console.log('🎯 [Panel] Intent:', intent.intent, `(${Math.round((intent.confidence || 0) * 100)}%)`)
    },
    
    onError: (errorMsg) => {
      console.error('❌ [Panel] Stream error:', errorMsg)
      setError(new Error(errorMsg))
      addMessage('system', `Error: ${errorMsg}`, 'error')
    },
    
    onDone: (result) => {
      console.log('🏁 [Panel] Stream done:', result.success)
      setIsLoading(false)
      
      // Persist a result message if we completed successfully
      if (result.success && isPersistenceEnabled && persistMessage) {
        persistMessage('orchestrator', 'Request completed', 'result')
      }
    }
  }), [addMessage, onCreateStoryNode, onUpdateStoryNode, onExecuteAction, isPersistenceEnabled, persistMessage])
  
  // ========== SEND MESSAGE (Streaming) ==========
  const handleSend = useCallback(async (message: string) => {
    if (!currentUserId) {
      addMessage('system', 'User not authenticated. Please log in.', 'error')
      return
    }
    
    // Add user message
    addMessage('user', message, 'user')
    
    // Start loading
    setIsLoading(true)
    setError(null)
    
    // Stream the response
    await orchestrateStream(
      {
        message,
        userId: currentUserId,
        storyId: storyId || undefined,
        canvasNodes,
        currentStoryStructureNodeId: storyStructureNodeId,
        isDocumentViewOpen: documentPanelOpen,
        activeContext: activeSegment ? {
          type: 'section',
          id: activeSegment.id,
          name: activeSegment.name
        } : undefined,
        documentFormat: documentFormat || undefined
      },
      createStreamCallbacks()
    )
    
  }, [
    currentUserId,
    storyId,
    canvasNodes,
    storyStructureNodeId,
    documentPanelOpen,
    activeSegment,
    documentFormat,
    addMessage,
    createStreamCallbacks
  ])
  
  // ========== OPTION SELECTION ==========
  const handleOptionSelect = useCallback(async (
    optionId: string, 
    optionTitle: string, 
    messageId: string
  ) => {
    console.log('🎯 [Panel] Option selected:', { optionId, optionTitle, messageId })
    
    // Mark option as selected
    setSelectedOptions(prev => ({ ...prev, [messageId]: optionId }))
    
    // Convert the options message to a result message
    setMessages(prev => prev.map(m => 
      m.id === messageId 
        ? { ...m, type: 'result' as const, content: `Selected: ${optionTitle}`, options: undefined }
        : m
    ))
    
    // If we have pending clarification, send it back
    if (pendingClarification && pendingClarification.messageId === messageId) {
      setIsLoading(true)
      
      console.log('📤 [Panel] Sending clarification response:', {
        optionId,
        originalAction: pendingClarification.originalAction
      })
      
      await orchestrateStream(
        {
          message: `User selected: ${optionTitle}`,
          userId: currentUserId!,
          storyId: storyId || undefined,
          canvasNodes,
          currentStoryStructureNodeId: storyStructureNodeId,
          isDocumentViewOpen: documentPanelOpen,
          activeContext: activeSegment ? {
            type: 'section',
            id: activeSegment.id,
            name: activeSegment.name
          } : undefined,
          clarificationResponse: {
            optionId,
            originalAction: pendingClarification.originalAction
          }
        },
        createStreamCallbacks()
      )
      
      setPendingClarification(null)
    } else {
      console.log('⚠️ [Panel] No pending clarification for message:', messageId)
      // Direct selection without pending clarification
      if (onOpenDocument) {
        onOpenDocument(optionId)
      }
    }
  }, [
    pendingClarification,
    currentUserId,
    storyId,
    canvasNodes,
    storyStructureNodeId,
    documentPanelOpen,
    activeSegment,
    createStreamCallbacks,
    onOpenDocument
  ])
  
  // ========== COMBINED MESSAGES ==========
  const allMessages = useMemo(() => {
    const persisted = (persistedMessages || []).map(m => ({
      id: m.id,
      role: m.role as Message['role'],
      content: m.content,
      type: (m.type || 'result') as Message['type'],
      timestamp: m.created_at
    }))
    
    const seen = new Set(persisted.map(m => `${m.role}:${m.content}`))
    const unique = messages.filter(m => !seen.has(`${m.role}:${m.content}`))
    
    return [...persisted, ...unique]
  }, [persistedMessages, messages])
  
  // ========== RENDER ==========
  return (
    <div className={cn(
      'flex flex-col h-full bg-white dark:bg-gray-900',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Orchestrator
          </h2>
          {isLoading && (
            <span className="text-xs text-blue-500 animate-pulse">
              Streaming...
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {activeSegment && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
              📍 {activeSegment.name}
            </span>
          )}
          {isPersistenceEnabled && (
            <span title="Session persistence enabled">💾</span>
          )}
          <span title="Streaming enabled" className="text-green-500">📡</span>
          {!currentUserId && (
            <span className="text-yellow-500" title="User not loaded">⚠️</span>
          )}
        </div>
      </div>
      
      {/* Messages */}
      <MessageList
        messages={allMessages}
        isLoading={isLoading}
        className="flex-1"
        onOptionSelect={handleOptionSelect}
        selectedOptions={selectedOptions}
      />
      
      {/* Error display */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error.message}
        </div>
      )}
      
      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        disabled={!currentUserId}
        placeholder={
          !currentUserId
            ? 'Loading user...'
            : pendingClarification
              ? 'Select an option above or type to continue...'
              : activeSegment
                ? `Write about ${activeSegment.name}...`
                : 'Chat with the orchestrator...'
        }
      />
    </div>
  )
}

export default OrchestratorPanel