// src/lib/orchestrator/components/OrchestratorPanel/MessageList.tsx

'use client'

import React, { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChatOptionsSelector, type ChatOption } from '@/components/ui/molecules/ChatOptionsSelector'
import type { Message, MessageType } from './types'

// ============================================================
// MESSAGE STYLING
// ============================================================

const messageStyles: Record<MessageType, { icon: string; bgClass: string; textClass: string }> = {
  user: {
    icon: '👤',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    textClass: 'text-blue-900 dark:text-blue-100'
  },
  thinking: {
    icon: '🤔',
    bgClass: 'bg-gray-50 dark:bg-gray-800/50',
    textClass: 'text-gray-600 dark:text-gray-400'
  },
  decision: {
    icon: '🎯',
    bgClass: 'bg-purple-50 dark:bg-purple-900/20',
    textClass: 'text-purple-900 dark:text-purple-100'
  },
  task: {
    icon: '📋',
    bgClass: 'bg-amber-50 dark:bg-amber-900/20',
    textClass: 'text-amber-900 dark:text-amber-100'
  },
  result: {
    icon: '✅',
    bgClass: 'bg-green-50 dark:bg-green-900/20',
    textClass: 'text-green-900 dark:text-green-100'
  },
  error: {
    icon: '❌',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    textClass: 'text-red-900 dark:text-red-100'
  },
  progress: {
    icon: '⏳',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    textClass: 'text-blue-900 dark:text-blue-100'
  },
  warning: {
    icon: '⚠️',
    bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
    textClass: 'text-yellow-900 dark:text-yellow-100'
  },
  options: {
    icon: '🤔',
    bgClass: 'bg-indigo-50 dark:bg-indigo-900/20',
    textClass: 'text-indigo-900 dark:text-indigo-100'
  }
}

// ============================================================
// MESSAGE ITEM
// ============================================================

interface MessageItemProps {
  message: Message
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onOptionSelect?: (optionId: string, optionTitle: string) => void
  selectedOptionId?: string
}

function MessageItem({ 
  message, 
  isCollapsed, 
  onToggleCollapse,
  onOptionSelect,
  selectedOptionId
}: MessageItemProps) {
  const style = messageStyles[message.type] || messageStyles.result
  const isThinking = message.type === 'thinking'
  const hasOptions = message.type === 'options' && message.options && message.options.length > 0
  
  // Format timestamp
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Convert message options to ChatOption format
  const chatOptions: ChatOption[] = hasOptions 
    ? message.options!.map(opt => ({
        id: opt.id,
        title: opt.label || opt.title || opt.id,
        description: opt.description,
        metadata: opt.metadata
      }))
    : []
  
  return (
    <div
      className={cn(
        'rounded-lg p-3 mb-2 transition-all',
        style.bgClass,
        isThinking && 'opacity-70'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{style.icon}</span>
          <span className={cn('text-xs font-medium uppercase', style.textClass)}>
            {message.role === 'user' ? 'You' : message.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{time}</span>
          {isThinking && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {isCollapsed ? '▶' : '▼'}
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      {!isCollapsed && (
        <div className={cn('text-sm', style.textClass)}>
          {message.content}
        </div>
      )}
      
      {/* Options (for request_clarification) */}
      {!isCollapsed && hasOptions && onOptionSelect && (
        <div className="mt-3">
          <ChatOptionsSelector
            options={chatOptions}
            onSelect={onOptionSelect}
            selectedOptionId={selectedOptionId}
            showNumberHint={!selectedOptionId}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================
// MESSAGE LIST
// ============================================================

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
  className?: string
  /** Whether to auto-collapse thinking messages */
  autoCollapseThinking?: boolean
  /** Callback when user selects an option from request_clarification */
  onOptionSelect?: (optionId: string, optionTitle: string, messageId: string) => void
  /** Track which options have been selected */
  selectedOptions?: Record<string, string>  // messageId -> optionId
}

export function MessageList({
  messages,
  isLoading,
  className,
  autoCollapseThinking = true,
  onOptionSelect,
  selectedOptions = {}
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [collapsedMessages, setCollapsedMessages] = React.useState<Set<string>>(new Set())
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])
  
  // Auto-collapse old thinking messages
  useEffect(() => {
    if (!autoCollapseThinking) return
    
    const thinkingMessages = messages.filter(m => m.type === 'thinking')
    if (thinkingMessages.length > 2) {
      // Collapse all but the last 2 thinking messages
      const toCollapse = thinkingMessages.slice(0, -2).map(m => m.id)
      setCollapsedMessages(prev => new Set([...prev, ...toCollapse]))
    }
  }, [messages, autoCollapseThinking])
  
  const toggleCollapse = (id: string) => {
    setCollapsedMessages(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }
  
  const handleOptionSelect = (optionId: string, optionTitle: string, messageId: string) => {
    onOptionSelect?.(optionId, optionTitle, messageId)
  }
  
  return (
    <div
      ref={containerRef}
      className={cn(
        'flex-1 overflow-y-auto p-4 space-y-2',
        className
      )}
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <div className="text-4xl mb-2">🤖</div>
          <p className="text-sm">Start a conversation with the orchestrator</p>
        </div>
      ) : (
        <>
          {messages.map(message => (
            <MessageItem
              key={message.id}
              message={message}
              isCollapsed={collapsedMessages.has(message.id)}
              onToggleCollapse={
                message.type === 'thinking' 
                  ? () => toggleCollapse(message.id)
                  : undefined
              }
              onOptionSelect={
                message.type === 'options'
                  ? (optionId, optionTitle) => handleOptionSelect(optionId, optionTitle, message.id)
                  : undefined
              }
              selectedOptionId={selectedOptions[message.id]}
            />
          ))}
          
          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="animate-pulse">⏳</div>
              <span className="text-sm text-gray-500">Processing...</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}