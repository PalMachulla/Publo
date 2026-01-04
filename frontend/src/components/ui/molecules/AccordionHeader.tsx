/**
 * AccordionHeader Molecule
 * 
 * Collapsible header for status messages with icon, badge, timestamp, and chevron
 */

import React from 'react'
import { MessageIcon, type MessageType } from '../atoms/MessageIcon'
import { MessageBadge } from '../atoms/MessageBadge'
import { MessageTimestamp } from '../atoms/MessageTimestamp'

export interface AccordionHeaderProps {
  type: MessageType
  timestamp: string | Date
  isActive?: boolean
  isCollapsed?: boolean
  isCollapsible?: boolean
  onClick?: () => void
  className?: string
}

export function AccordionHeader({
  type,
  timestamp,
  isActive = false,
  isCollapsed = false,
  isCollapsible = true,
  onClick,
  className = ''
}: AccordionHeaderProps) {
  const Component = onClick ? 'button' : 'div'
  
  return (
    <Component
      onClick={onClick}
      className={`w-full p-2 flex items-center justify-between ${
        onClick ? 'hover:opacity-80 transition-opacity cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">
          <MessageIcon type={type} isActive={isActive} />
        </div>
        <MessageBadge type={type} />
        <MessageTimestamp timestamp={timestamp} />
      </div>
      
      {isCollapsible && (
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isCollapsed ? '' : 'rotate-180'
          }`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </Component>
  )
}

