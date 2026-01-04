/**
 * TodoProgress Molecule
 * 
 * Progress bar showing completion percentage for todos.
 * Shows completed/total count and visual progress.
 */

import React from 'react'
import { cn } from '@/lib/utils'

export interface TodoStats {
  total: number
  completed: number
  in_progress: number
  pending: number
  cancelled: number
  percent_complete: number
}

export interface TodoProgressProps {
  stats: TodoStats
  showLabel?: boolean
  className?: string
}

export function TodoProgress({ stats, showLabel = true, className }: TodoProgressProps) {
  const { total, completed, in_progress, percent_complete } = stats
  
  // Don't render if no todos
  if (total === 0) {
    return null
  }
  
  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Label */}
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500 font-medium">
            {in_progress > 0 ? 'Working...' : completed === total ? 'Complete!' : 'Planning...'}
          </span>
          <span className="text-neutral-400">
            {completed}/{total} done
          </span>
        </div>
      )}
      
      {/* Progress bar */}
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        {/* Completed portion */}
        <div 
          className={cn(
            'h-full transition-all duration-300 ease-out',
            completed === total ? 'bg-green-500' : 'bg-indigo-500'
          )}
          style={{ width: `${percent_complete}%` }}
        />
      </div>
    </div>
  )
}

export default TodoProgress
