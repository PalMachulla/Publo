/**
 * ViewToggle
 * 
 * A pill-shaped toggle button for switching between two views.
 * Designed to match the Tree/Cards toggle style.
 */
import React from 'react'
import { cn } from '@/lib/utils'

export interface ViewToggleOption {
  id: string
  label: string
  icon?: React.ReactNode
}

export interface ViewToggleProps {
  options: [ViewToggleOption, ViewToggleOption]
  value: string
  onChange: (value: string) => void
  className?: string
  size?: 'sm' | 'md'
}

export function ViewToggle({
  options,
  value,
  onChange,
  className,
  size = 'sm'
}: ViewToggleProps) {
  const sizeClasses = {
    sm: 'text-xs py-1.5 px-2.5 gap-1.5',
    md: 'text-sm py-2 px-3 gap-2'
  }

  return (
    <div 
      className={cn(
        'inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'inline-flex items-center font-medium rounded-md transition-all duration-150',
            sizeClasses[size],
            value === option.id
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          )}
        >
          {option.icon && (
            <span className="flex-shrink-0">
              {option.icon}
            </span>
          )}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

// Pre-defined icons for common views
export const ViewToggleIcons = {
  // List/Tree icon (three horizontal lines)
  Tree: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  
  // Grid/Cards icon (four squares)
  Cards: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  
  // Canvas icon (artboard/frame)
  Canvas: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 8l8 8" />
    </svg>
  ),
  
  // Document icon (paper with lines)
  Document: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  
  // Lock icon (for locked/private)
  Lock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
}

export default ViewToggle
