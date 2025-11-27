/**
 * ChatOptionsSelector Molecule
 * 
 * Minimal inline options selector for chat messages
 * Displays as a list of sleek horizontal pills
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
  metadata?: Record<string, any>
}

export interface ChatOptionsSelectorProps {
  title?: string
  subtitle?: string
  options: ChatOption[]
  onSelect: (optionId: string, optionTitle: string) => void
  selectedOptionId?: string
  showNumberHint?: boolean
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
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  
  if (options.length === 0) {
    return null
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Title (optional, usually comes from chat message) */}
      {title && (
        <p className="text-sm font-medium text-gray-700 mb-2">
          {title}
        </p>
      )}
      
      {/* Subtitle (optional) */}
      {subtitle && (
        <p className="text-xs text-gray-500 mb-2">
          {subtitle}
        </p>
      )}
      
      {/* Option Pills */}
      <div className="space-y-1.5">
        {options.map((option, index) => (
          <ChatOptionPill
            key={option.id}
            number={index + 1}
            title={option.title}
            description={option.description}
            isSelected={selectedOptionId === option.id}
            isHovered={hoveredId === option.id}
            onClick={() => onSelect(option.id, option.title)}
            onMouseEnter={() => setHoveredId(option.id)}
            onMouseLeave={() => setHoveredId(null)}
          />
        ))}
      </div>
      
      {/* Number Hint (subtle) */}
      {showNumberHint && (
        <p className="text-xs text-gray-400 mt-2 pl-1">
          💡 Tip: Click or type the number (1, 2, 3...)
        </p>
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
