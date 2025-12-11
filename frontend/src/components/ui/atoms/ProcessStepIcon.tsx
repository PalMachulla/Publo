/**
 * ProcessStepIcon Atom
 * 
 * Icons for different process/action steps in the orchestrator flow.
 * Extends the MessageIcon pattern with additional step-specific icons.
 * 
 * Step types:
 * - search: Magnifying glass (searching codebase/docs)
 * - read: Document icon (reading files)
 * - analyze: Brain/gear icon (analyzing content)
 * - write: Pencil icon (writing content)
 * - check: Checkmark (verification/complete)
 * - plan: Clipboard (planning)
 * - navigate: Compass (navigation)
 * - pending: Empty circle (not started)
 * - running: Spinner (in progress)
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type ProcessStepType = 
  | 'search'
  | 'read'
  | 'analyze'
  | 'write'
  | 'check'
  | 'plan'
  | 'navigate'
  | 'pending'
  | 'running'

export interface ProcessStepIconProps {
  type: ProcessStepType
  /** Show spinning animation for running states */
  isActive?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5'
}

export function ProcessStepIcon({ 
  type, 
  isActive = false, 
  size = 'md',
  className 
}: ProcessStepIconProps) {
  const baseClasses = cn(sizeClasses[size], className)
  
  switch (type) {
    case 'search':
      return (
        <svg 
          className={cn(baseClasses, 'text-indigo-600')} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
          />
        </svg>
      )
    
    case 'read':
      return (
        <svg 
          className={cn(baseClasses, 'text-blue-600')} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
      )
    
    case 'analyze':
      return (
        <svg 
          className={cn(baseClasses, 'text-purple-600', isActive && 'animate-pulse')} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
          />
        </svg>
      )
    
    case 'write':
      return (
        <svg 
          className={cn(baseClasses, 'text-amber-600', isActive && 'animate-pulse')} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
          />
        </svg>
      )
    
    case 'check':
      return (
        <svg 
          className={cn(baseClasses, 'text-green-600')} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      )
    
    case 'plan':
      return (
        <svg 
          className={cn(baseClasses, 'text-teal-600')} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" 
          />
        </svg>
      )
    
    case 'navigate':
      return (
        <svg 
          className={cn(baseClasses, 'text-cyan-600')} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
          />
        </svg>
      )
    
    case 'pending':
      return (
        <div 
          className={cn(
            baseClasses, 
            'rounded-full border-2 border-neutral-300 bg-white'
          )} 
        />
      )
    
    case 'running':
      return (
        <svg 
          className={cn(baseClasses, 'text-indigo-600 animate-spin')} 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="3"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )
    
    default:
      return null
  }
}

export default ProcessStepIcon


