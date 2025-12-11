/**
 * ThinkingBlock Molecule
 * 
 * Cursor-style collapsible reasoning block.
 * Shows the AI's thinking process with:
 * - Collapsed: "Thought for Xs" with chevron
 * - Expanded: Monospace content with streaming cursor
 * 
 * Composes: MessageIcon, DurationBadge, StreamingCursor, CollapsibleSection
 */

import React, { useState } from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import { MessageIcon } from '../atoms/MessageIcon'
import { DurationBadge } from '../atoms/DurationBadge'
import { StreamingCursor } from '../atoms/StreamingCursor'

export interface ThinkingBlockProps {
  /** The reasoning/thinking content to display */
  content: string
  /** When thinking started (for duration display) */
  startTime: Date
  /** When thinking ended (undefined if still active) */
  endTime?: Date
  /** Whether content is still being streamed */
  isStreaming?: boolean
  /** Initial collapsed state */
  defaultCollapsed?: boolean
  /** Additional CSS classes */
  className?: string
}

export function ThinkingBlock({
  content,
  startTime,
  endTime,
  isStreaming = false,
  defaultCollapsed = false,
  className
}: ThinkingBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  
  const isActive = isStreaming && !endTime
  
  return (
    <div 
      className={cn(
        'rounded-lg border border-violet-100 bg-violet-50/50 overflow-hidden',
        'transition-all duration-200',
        className
      )}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'w-full px-3 py-2.5 flex items-center justify-between gap-3',
          'hover:bg-violet-100/50 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-inset'
        )}
      >
        <div className="flex items-center gap-2.5">
          {/* Thinking icon */}
          <MessageIcon 
            type="thinking" 
            isActive={isActive} 
            className="flex-shrink-0"
          />
          
          {/* "Thought for Xs" label */}
          <span className="text-sm font-medium text-violet-700">
            {isActive ? 'Thinking' : 'Thought'}
          </span>
          
          <DurationBadge
            startTime={startTime}
            endTime={endTime}
            isActive={isActive}
            prefix="for"
            className="text-violet-500"
          />
        </div>
        
        {/* Chevron */}
        <ChevronDownIcon
          className={cn(
            'w-4 h-4 text-violet-400 transition-transform duration-200',
            !isCollapsed && 'rotate-180'
          )}
        />
      </button>
      
      {/* Content - Collapsible */}
      {!isCollapsed && (
        <div className="px-3 pb-3 pt-1">
          <div 
            className={cn(
              'p-3 rounded-md bg-white border border-violet-100',
              'font-mono text-xs text-neutral-700 leading-relaxed',
              'max-h-64 overflow-y-auto',
              'whitespace-pre-wrap break-words'
            )}
          >
            {content}
            {isActive && <StreamingCursor variant="line" colorClass="bg-violet-600" />}
          </div>
        </div>
      )}
    </div>
  )
}

export default ThinkingBlock


