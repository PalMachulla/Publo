/**
 * ThinkingBlock Molecule
 * 
 * Minimal collapsible reasoning block.
 * Shows the AI's thinking process with:
 * - Collapsed: "Thought for Xs" with chevron
 * - Expanded: Italic content with streaming cursor
 * 
 * Composes: MessageIcon, DurationBadge, StreamingCursor
 */

import React, { useState, useEffect } from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
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
  
  // Auto-expand when active, auto-collapse when done
  useEffect(() => {
    if (isActive) {
      // Expand when reasoning starts
      setIsCollapsed(false)
    } else if (content) {
      // Collapse when reasoning ends (with small delay for smooth UX)
      const timer = setTimeout(() => setIsCollapsed(true), 500)
      return () => clearTimeout(timer)
    }
  }, [isActive, content])
  
  return (
    <div 
      className={cn(
        'rounded-md border border-zinc-100 bg-zinc-50/50 overflow-hidden',
        'transition-all duration-200',
        className
      )}
    >
      {/* Header - Always visible, clickable to expand/collapse */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'w-full px-3 py-1.5 flex items-center justify-between gap-2',
          'hover:bg-zinc-100/50 transition-colors',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-inset'
        )}
      >
        <div className="flex items-center gap-1.5">
          {/* "Thought for Xs" label */}
          <span className="text-xs italic text-zinc-500">
            {isActive ? 'Thinking' : 'Thought'}
          </span>
          
          <DurationBadge
            startTime={startTime}
            endTime={endTime}
            isActive={isActive}
            prefix="for"
            className="text-xs italic text-zinc-400"
          />
        </div>
        
        {/* Chevron */}
        <ChevronDownIcon
          className={cn(
            'w-3 h-3 text-zinc-400 transition-transform duration-200',
            !isCollapsed && 'rotate-180'
          )}
        />
      </button>
      
      {/* Content - Collapsible */}
      {!isCollapsed && (
        <div className="px-3 pb-2">
          <div 
            className={cn(
              'text-xs italic text-zinc-500 leading-relaxed',
              isActive ? 'max-h-96' : 'max-h-48',  // Double height when active
              'overflow-y-auto',
              'whitespace-pre-wrap break-words'
            )}
          >
            {content}
            {isActive && <StreamingCursor variant="line" colorClass="bg-zinc-400" />}
          </div>
        </div>
      )}
    </div>
  )
}

export default ThinkingBlock




