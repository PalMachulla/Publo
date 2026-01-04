/**
 * SubagentStatusBadge Atom
 * 
 * Status badge showing subagent state: working, complete, error
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type SubagentStatus = 'working' | 'complete' | 'error'

export interface SubagentStatusBadgeProps {
  status: SubagentStatus
  className?: string
}

export function SubagentStatusBadge({ status, className }: SubagentStatusBadgeProps) {
  const getStyles = () => {
    switch (status) {
      case 'working':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      case 'complete':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200'
    }
  }
  
  const getLabel = () => {
    switch (status) {
      case 'working':
        return 'Working...'
      case 'complete':
        return 'Complete'
      case 'error':
        return 'Error'
    }
  }
  
  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border',
        getStyles(),
        className
      )}
    >
      {status === 'working' && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {status === 'complete' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'error' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {getLabel()}
    </span>
  )
}

export default SubagentStatusBadge
