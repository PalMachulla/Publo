/**
 * TodoStatusIcon Atom
 * 
 * Status icons for todo items in the Deep Agent planning system.
 * Shows visual state: pending, in_progress, completed, cancelled.
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface TodoStatusIconProps {
  status: TodoStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export function TodoStatusIcon({ status, size = 'md', className }: TodoStatusIconProps) {
  const sizeClass = sizeStyles[size]
  
  switch (status) {
    case 'pending':
      return (
        <div 
          className={cn(
            'rounded-full border-2 border-neutral-300 bg-white',
            sizeClass,
            className
          )}
          title="Pending"
        />
      )
    
    case 'in_progress':
      return (
        <div 
          className={cn(
            'rounded-full border-2 border-indigo-500 bg-indigo-50 flex items-center justify-center',
            sizeClass,
            className
          )}
          title="In Progress"
        >
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
        </div>
      )
    
    case 'completed':
      return (
        <div 
          className={cn(
            'rounded-full bg-green-500 flex items-center justify-center',
            sizeClass,
            className
          )}
          title="Completed"
        >
          <svg 
            className="w-3 h-3 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={3} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
        </div>
      )
    
    case 'cancelled':
      return (
        <div 
          className={cn(
            'rounded-full bg-neutral-200 flex items-center justify-center',
            sizeClass,
            className
          )}
          title="Cancelled"
        >
          <svg 
            className="w-3 h-3 text-neutral-500" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </div>
      )
    
    default:
      return null
  }
}

export default TodoStatusIcon
