/**
 * MemoryInsight Molecule
 * 
 * Inline indicator when agent uses/updates memory.
 * Shows briefly in chat to indicate personalization.
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type MemoryAction = 'learned' | 'using' | 'updated'

export interface MemoryInsightProps {
  action: MemoryAction
  label: string
  value?: string
  className?: string
}

export function MemoryInsight({ action, label, value, className }: MemoryInsightProps) {
  const getActionStyles = () => {
    switch (action) {
      case 'learned':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'using':
        return 'bg-purple-50 border-purple-200 text-purple-700'
      case 'updated':
        return 'bg-blue-50 border-blue-200 text-blue-700'
    }
  }
  
  const getIcon = () => {
    switch (action) {
      case 'learned':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
      case 'using':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'updated':
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )
    }
  }
  
  const getLabel = () => {
    switch (action) {
      case 'learned':
        return 'Learned'
      case 'using':
        return 'Using'
      case 'updated':
        return 'Updated'
    }
  }
  
  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs',
        getActionStyles(),
        className
      )}
    >
      {getIcon()}
      <span className="font-medium">{getLabel()}:</span>
      <span>{label}</span>
      {value && (
        <span className="opacity-75">= {value}</span>
      )}
    </div>
  )
}

export default MemoryInsight
