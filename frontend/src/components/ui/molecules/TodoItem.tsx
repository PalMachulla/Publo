/**
 * TodoItem Molecule
 * 
 * A single todo item in the Deep Agent planning system.
 * Shows status icon, content, and optional timestamp.
 * 
 * Composes: TodoStatusIcon
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { TodoStatusIcon, TodoStatus } from '../atoms/TodoStatusIcon'

export interface TodoItemData {
  id: string
  content: string
  status: TodoStatus
  updated_at?: string
}

export interface TodoItemProps {
  todo: TodoItemData
  isActive?: boolean
  className?: string
}

export function TodoItem({ todo, isActive = false, className }: TodoItemProps) {
  const { content, status } = todo
  
  const isCompleted = status === 'completed'
  const isCancelled = status === 'cancelled'
  const isInProgress = status === 'in_progress'
  
  return (
    <div 
      className={cn(
        'flex items-start gap-3 py-2 px-3 rounded-md',
        'transition-colors duration-150',
        isInProgress && 'bg-gradient-to-r from-indigo-50 via-white to-indigo-50 bg-[length:200%_100%] animate-shimmer',
        isCompleted && 'bg-green-50/30',
        isCancelled && 'opacity-50',
        isActive && 'ring-1 ring-indigo-200',
        className
      )}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        <TodoStatusIcon status={status} size="sm" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <span 
          className={cn(
            'text-sm leading-snug',
            isCompleted && 'text-neutral-500 line-through',
            isCancelled && 'text-neutral-400 line-through',
            isInProgress && 'text-neutral-800 font-medium',
            !isCompleted && !isCancelled && !isInProgress && 'text-neutral-600'
          )}
        >
          {content}
        </span>
      </div>
    </div>
  )
}

export default TodoItem
