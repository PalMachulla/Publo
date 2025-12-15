/**
 * TodoPanel Organism
 * 
 * Collapsible panel showing the agent's task plan.
 * Displays all todos with progress tracking.
 * 
 * Composes: TodoItem, TodoProgress
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { TodoItem, TodoItemData } from '../molecules/TodoItem'
import { TodoProgress, TodoStats } from '../molecules/TodoProgress'

export interface TodoPanelProps {
  todos: TodoItemData[]
  stats?: TodoStats
  title?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  className?: string
}

export function TodoPanel({ 
  todos, 
  stats,
  title = 'Task Plan',
  collapsible = true,
  defaultExpanded = true,
  className 
}: TodoPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  // Don't render if no todos
  if (!todos || todos.length === 0) {
    return null
  }
  
  // Calculate stats if not provided
  const computedStats: TodoStats = stats || {
    total: todos.length,
    completed: todos.filter(t => t.status === 'completed').length,
    in_progress: todos.filter(t => t.status === 'in_progress').length,
    pending: todos.filter(t => t.status === 'pending').length,
    cancelled: todos.filter(t => t.status === 'cancelled').length,
    percent_complete: Math.round(
      (todos.filter(t => t.status === 'completed').length / todos.length) * 100
    )
  }
  
  const isComplete = computedStats.completed === computedStats.total
  
  return (
    <div 
      className={cn(
        'rounded-lg border overflow-hidden',
        isComplete ? 'border-green-200 bg-green-50/30' : 'border-neutral-200 bg-white',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
        disabled={!collapsible}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5',
          'text-left transition-colors',
          collapsible && 'hover:bg-neutral-50 cursor-pointer',
          !collapsible && 'cursor-default'
        )}
      >
        <div className="flex items-center gap-2">
          {/* Icon */}
          <div className={cn(
            'w-5 h-5 rounded flex items-center justify-center',
            isComplete ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'
          )}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
              />
            </svg>
          </div>
          
          {/* Title */}
          <span className="text-sm font-medium text-neutral-700">
            {title}
          </span>
        </div>
        
        {/* Expand/collapse indicator */}
        {collapsible && (
          <svg 
            className={cn(
              'w-4 h-4 text-neutral-400 transition-transform',
              isExpanded && 'rotate-180'
            )}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      
      {/* Progress bar (always visible) */}
      <div className="px-3 pb-2">
        <TodoProgress stats={computedStats} showLabel={false} />
      </div>
      
      {/* Todo list */}
      {isExpanded && (
        <div className="border-t border-neutral-100">
          <div className="divide-y divide-neutral-50">
            {todos.map((todo) => (
              <TodoItem 
                key={todo.id} 
                todo={todo}
                isActive={todo.status === 'in_progress'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TodoPanel
