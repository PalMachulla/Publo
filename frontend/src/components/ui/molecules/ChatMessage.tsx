/**
 * ChatMessage Molecule
 * 
 * Simple chat message for user or orchestrator conversation
 * (not status messages like thinking/decision)
 */

import React from 'react'
import { MessageBadge } from '../atoms/MessageBadge'
import { MessageTimestamp } from '../atoms/MessageTimestamp'

export interface ChatMessageProps {
  role: 'user' | 'orchestrator'
  content: string | string[]
  timestamp: string | Date
  className?: string
}

export function ChatMessage({
  role,
  content,
  timestamp,
  className = ''
}: ChatMessageProps) {
  const isUser = role === 'user'
  const messages = Array.isArray(content) ? content : [content]
  
  return (
    <div 
      className={`p-3 rounded ${
        isUser ? 'bg-gray-100' : 'bg-white border border-gray-200'
      } ${className}`}
    >
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {isUser ? (
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MessageBadge type={role} />
            <MessageTimestamp timestamp={timestamp} />
          </div>
          
          {messages.length === 1 ? (
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
              {messages[0]}
            </p>
          ) : (
            <div className="text-sm text-gray-800 space-y-0.5">
              {messages.map((msg, idx) => (
                <p key={idx} className="whitespace-pre-wrap break-words">
                  {msg}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

