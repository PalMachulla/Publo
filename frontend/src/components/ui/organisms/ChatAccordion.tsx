/**
 * ChatAccordion Organism
 * 
 * Complete chat message list with automatic grouping and collapsing
 * Combines ChatMessage and StatusMessage components
 */

import React, { useState, useEffect } from 'react'
import { ChatMessage } from '../molecules/ChatMessage'
import { StatusMessage } from '../molecules/StatusMessage'
import type { MessageType } from '../atoms/MessageIcon'

export interface ChatMessageData {
  id: string
  role?: 'user' | 'orchestrator'
  content: string
  type: 'user' | 'thinking' | 'decision' | 'progress' | 'task' | 'result' | 'error' | 'warning' | 'model'
  timestamp: string
}

export interface ChatAccordionProps {
  messages: ChatMessageData[]
  isStreaming?: boolean
  className?: string
}

export function ChatAccordion({ 
  messages, 
  isStreaming = false,
  className = '' 
}: ChatAccordionProps) {
  const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(new Set())
  
  // Auto-collapse older thinking/decision/error messages when new ones arrive
  useEffect(() => {
    const statusMessages = messages.filter(msg => 
      ['thinking', 'decision', 'error'].includes(msg.type)
    )
    
    if (statusMessages.length > 1) {
      // Auto-collapse all except the most recent one
      const toCollapse = new Set(
        statusMessages.slice(0, -1).map(msg => msg.id)
      )
      setCollapsedMessages(toCollapse)
    }
  }, [messages])
  
  // Group consecutive messages of same type within 5 seconds
  const groupedMessages: Array<{
    role: 'user' | 'orchestrator'
    type: string
    timestamp: string
    messages: ChatMessageData[]
    isLast: boolean
  }> = []
  
  messages.forEach((msg, i) => {
    const prevGroup = groupedMessages[groupedMessages.length - 1]
    const msgRole = msg.role || 'orchestrator' // Default to orchestrator if not specified
    const isSameGroup = prevGroup &&
      prevGroup.role === msgRole &&
      prevGroup.type === msg.type &&
      Math.abs(new Date(prevGroup.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 5000
    
    if (isSameGroup) {
      prevGroup.messages.push(msg)
      prevGroup.isLast = i === messages.length - 1
    } else {
      groupedMessages.push({
        role: msgRole,
        type: msg.type,
        timestamp: msg.timestamp,
        messages: [msg],
        isLast: i === messages.length - 1
      })
    }
  })
  
  return (
    <div className={`space-y-2 ${className}`}>
      {groupedMessages.map((group, groupIndex) => {
        const firstMsg = group.messages[0]
        const isUserMessage = group.role === 'user'
        const isOrchestratorMessage = group.role === 'orchestrator' && group.type === 'user'
        const isStatusMessage = ['thinking', 'decision', 'task', 'result', 'error', 'warning', 'progress', 'model'].includes(group.type)
        
        // Regular chat message (user or orchestrator conversational)
        if (isUserMessage || (isOrchestratorMessage && !isStatusMessage)) {
          return (
            <ChatMessage
              key={groupIndex}
              role={group.role}
              content={group.messages.map(m => m.content)}
              timestamp={group.timestamp}
            />
          )
        }
        
        // Status message (thinking, decision, etc.)
        const messageId = firstMsg.id
        const isCollapsed = collapsedMessages.has(messageId) && !group.isLast
        
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
        
        return (
          <StatusMessage
            key={groupIndex}
            type={group.type as MessageType}
            content={group.messages.map(m => m.content)}
            timestamp={group.timestamp}
            isActive={group.isLast && isStreaming}
            isCollapsed={isCollapsed}
            isLastMessage={group.isLast}
            onToggleCollapse={toggleCollapse}
          />
        )
      })}
    </div>
  )
}

