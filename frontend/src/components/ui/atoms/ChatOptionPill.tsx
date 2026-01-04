/**
 * ChatOptionPill Atom
 * 
 * Sleek horizontal pill with number circle on left, label on right
 * Designed to be inline with chat messages
 */

import React from 'react'

export interface ChatOptionPillProps {
  number: number
  title: string
  description?: string
  isSelected?: boolean
  isHovered?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
}

export function ChatOptionPill({
  number,
  title,
  description,
  isSelected = false,
  isHovered = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className = ''
}: ChatOptionPillProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        group relative w-full text-left
        flex items-center gap-3 px-3 py-2.5
        rounded-full border transition-all
        ${isSelected || isHovered
          ? 'bg-indigo-50 border-indigo-300 shadow-sm' 
          : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
        }
        ${className}
      `}
    >
      {/* Number Circle */}
      <div className={`
        flex-shrink-0 w-6 h-6 rounded-full
        flex items-center justify-center
        text-xs font-bold transition-colors
        ${isSelected || isHovered
          ? 'bg-indigo-600 text-white' 
          : 'bg-gray-300 text-gray-700 group-hover:bg-gray-400'
        }
      `}>
        {number}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium transition-colors ${
          isSelected || isHovered ? 'text-indigo-900' : 'text-gray-900'
        }`}>
          {title}
        </div>
        {description && (
          <div className="text-xs text-gray-500 mt-0.5">
            {description}
          </div>
        )}
      </div>
      
      {/* Selection Indicator (subtle checkmark) */}
      {isSelected && (
        <div className="flex-shrink-0">
          <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  )
}
