/**
 * StatusMessage Molecule
 * 
 * Collapsible status message (thinking, decision, progress, etc.)
 * with colored background and border
 */

import React from 'react'
import { AccordionHeader } from './AccordionHeader'
import type { MessageType } from '../atoms/MessageIcon'

export interface StatusMessageProps {
  type: MessageType
  content: string | string[]
  timestamp: string | Date
  isActive?: boolean
  isCollapsed?: boolean
  isLastMessage?: boolean
  onToggleCollapse?: () => void
  className?: string
}

export function StatusMessage({
  type,
  content,
  timestamp,
  isActive = false,
  isCollapsed = false,
  isLastMessage = false,
  onToggleCollapse,
  className = ''
}: StatusMessageProps) {
  // Background colors for each type
  const bgColor = 
    type === 'thinking' ? 'bg-gray-50 bg-opacity-50' :
    type === 'progress' ? 'bg-gray-50 bg-opacity-50' :
    type === 'decision' ? 'bg-gray-50 bg-opacity-50' :
    type === 'task' ? 'bg-gray-50 bg-opacity-50' :
    type === 'result' ? 'bg-gray-50 bg-opacity-50' :
    type === 'warning' ? 'bg-orange-50 bg-opacity-50' :
    type === 'model' ? 'bg-gradient-to-r from-indigo-50 to-purple-50 bg-opacity-50 border-l-1 border-indigo-500' :
    'bg-red-50 bg-opacity-50 border-l-1 border-red-400'
  
  const messages = Array.isArray(content) ? content : [content]
  const showChevron = !isLastMessage || !isActive
  
  return (
    <div 
      className={`rounded ${bgColor} overflow-hidden ${
        isLastMessage && isActive ? 'animate-pulse' : ''
      } ${className}`}
    >
      <AccordionHeader
        type={type}
        timestamp={timestamp}
        isActive={isActive}
        isCollapsed={isCollapsed}
        isCollapsible={showChevron}
        onClick={showChevron ? onToggleCollapse : undefined}
      />
      
      {!isCollapsed && (
        <div className="px-3 pb-3">
          {messages.length === 1 ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
              {messages[0]}
              {isLastMessage && isActive && (
                <span className="inline-block ml-1 w-1.5 h-4 bg-indigo-600 animate-pulse" />
              )}
            </p>
          ) : (
            <div className="text-sm text-gray-800 space-y-0.5">
              {messages.map((msg, idx) => (
                <p key={idx} className="whitespace-pre-wrap break-words">
                  {msg}
                  {idx === messages.length - 1 && isLastMessage && isActive && (
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
}

