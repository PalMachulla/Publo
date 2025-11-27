/**
 * TemplatePill Atom
 * 
 * Displays a single template option as a clickable pill with number badge
 */

import React from 'react'

export interface TemplatePillProps {
  number: number
  name: string
  description: string
  complexity?: 'simple' | 'moderate' | 'complex'
  isSelected?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
}

export function TemplatePill({
  number,
  name,
  description,
  complexity,
  isSelected = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className = ''
}: TemplatePillProps) {
  const complexityColor = 
    complexity === 'simple' ? 'text-green-600 bg-green-50' :
    complexity === 'moderate' ? 'text-blue-600 bg-blue-50' :
    complexity === 'complex' ? 'text-purple-600 bg-purple-50' :
    'text-gray-600 bg-gray-50'
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        group relative w-full text-left p-3 rounded-lg border-2 transition-all
        ${isSelected 
          ? 'border-indigo-500 bg-indigo-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
        }
        ${className}
      `}
    >
      {/* Number Badge */}
      <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">
        {number}
      </div>
      
      <div className="flex items-start gap-3 ml-2">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded ${isSelected ? 'bg-indigo-100' : 'bg-gray-100 group-hover:bg-indigo-50'}`}>
          <svg className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-gray-600 group-hover:text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
              {name}
            </h4>
            {complexity && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${complexityColor}`}>
                {complexity}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {description}
          </p>
        </div>
        
        {/* Selection Indicator */}
        {isSelected && (
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    </button>
  )
}

