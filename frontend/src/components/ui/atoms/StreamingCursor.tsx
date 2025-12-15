/**
 * StreamingCursor Atom
 * 
 * A blinking cursor for token-by-token streaming display.
 * Mimics the typing cursor seen in Claude.ai and Cursor.
 * 
 * Variants:
 * - block: Solid rectangle cursor (█)
 * - line: Thin vertical line (|)
 */

import React from 'react'
import { cn } from '@/lib/utils'

export interface StreamingCursorProps {
  /** Cursor style variant */
  variant?: 'block' | 'line'
  /** Whether the cursor is visible/blinking */
  isActive?: boolean
  /** Custom color class (defaults to indigo) */
  colorClass?: string
  className?: string
}

export function StreamingCursor({
  variant = 'block',
  isActive = true,
  colorClass = 'bg-indigo-600',
  className
}: StreamingCursorProps) {
  if (!isActive) return null
  
  if (variant === 'line') {
    return (
      <span 
        className={cn(
          'inline-block w-0.5 h-4 ml-0.5 animate-pulse',
          colorClass,
          className
        )}
        aria-hidden="true"
      />
    )
  }
  
  // Block cursor
  return (
    <span 
      className={cn(
        'inline-block w-2 h-4 ml-0.5 animate-pulse rounded-sm',
        colorClass,
        className
      )}
      aria-hidden="true"
    />
  )
}

export default StreamingCursor




