/**
 * MessageBadge Atom
 * 
 * Displays the type label for orchestrator messages (THINKING, DECISION, etc.)
 */

import React from 'react'
import type { MessageType } from './MessageIcon'

export interface MessageBadgeProps {
  type: MessageType | 'user' | 'orchestrator'
  className?: string
}

export function MessageBadge({ type, className = '' }: MessageBadgeProps) {
  const label = type === 'user' ? 'PUBLO' : 
                type === 'orchestrator' ? 'ORCHESTRATOR' :
                type === 'model' ? 'MODEL' :
                type.toUpperCase()
  
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wide text-gray-600 ${className}`}>
      {label}
    </span>
  )
}

