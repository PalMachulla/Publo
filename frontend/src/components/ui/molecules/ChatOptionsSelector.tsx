/**
 * ChatOptionsSelector Molecule
 * 
 * Generic numbered options selector for any orchestrator choice
 * Supports both click and number-based selection (1, 2, 3)
 * 
 * Use cases:
 * - Template selection
 * - Clarification questions (which document?)
 * - Multiple choice questions
 * - Any numbered list from orchestrator
 */

import React, { useState } from 'react'
import { ChatOptionPill } from '../atoms/ChatOptionPill'

export interface ChatOption {
  id: string
  title: string
  description?: string
  badge?: string
  badgeColor?: 'green' | 'blue' | 'purple' | 'orange' | 'gray'
  icon?: React.ReactNode
  metadata?: Record<string, any> // For additional data (e.g., template complexity, document format)
}

export interface ChatOptionsSelectorProps {
  title: string
  subtitle?: string
  options: ChatOption[]
  onSelect: (optionId: string, optionTitle: string) => void
  selectedOptionId?: string
  showNumberHint?: boolean // Show "type 1, 2, 3" hint
  className?: string
}

export function ChatOptionsSelector({
  title,
  subtitle,
  options,
  onSelect,
  selectedOptionId,
  showNumberHint = true,
  className = ''
}: ChatOptionsSelectorProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  
  if (options.length === 0) {
    return null
  }
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-900">
          {title}
        </h3>
      </div>
      
      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-gray-600">
          {subtitle}
        </p>
      )}
      
      {/* Number Hint */}
      {showNumberHint && (
        <p className="text-xs text-gray-600">
          Click an option or type its number (1, 2, 3...)
        </p>
      )}
      
      {/* Option Pills */}
      <div className="space-y-2">
        {options.map((option, index) => (
          <ChatOptionPill
            key={option.id}
            number={index + 1}
            title={option.title}
            description={option.description}
            badge={option.badge}
            badgeColor={option.badgeColor}
            icon={option.icon}
            isSelected={selectedOptionId === option.id}
            onClick={() => onSelect(option.id, option.title)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>
      
      {/* Hover Info (if option has metadata.recommendedFor) */}
      {hoveredIndex !== null && options[hoveredIndex]?.metadata?.recommendedFor && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-900 mb-0.5">Best for:</p>
              <p className="text-xs text-blue-700">{options[hoveredIndex].metadata.recommendedFor}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Helper: Convert template to ChatOption
 */
export function templateToChatOption(template: any): ChatOption {
  return {
    id: template.id,
    title: template.name,
    description: template.description,
    badge: template.complexity,
    badgeColor: 
      template.complexity === 'simple' ? 'green' :
      template.complexity === 'moderate' ? 'blue' :
      template.complexity === 'complex' ? 'purple' :
      'gray',
    metadata: {
      recommendedFor: template.recommendedFor
    }
  }
}
