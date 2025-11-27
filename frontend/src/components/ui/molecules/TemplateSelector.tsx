/**
 * TemplateSelector Molecule
 * 
 * Displays a list of template options for a document format
 * Supports both click and number-based selection (1, 2, 3)
 */

import React, { useState } from 'react'
import { TemplatePill } from '../atoms/TemplatePill'
import type { Template } from '@/lib/orchestrator/schemas/templateRegistry'

export interface TemplateSelectorProps {
  format: string
  formatLabel: string
  templates: Template[]
  onSelect: (templateId: string, templateName: string) => void
  selectedTemplateId?: string
  className?: string
}

export function TemplateSelector({
  format,
  formatLabel,
  templates,
  onSelect,
  selectedTemplateId,
  className = ''
}: TemplateSelectorProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  
  if (templates.length === 0) {
    return null
  }
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-900">
          Choose a template for your {formatLabel}
        </h3>
      </div>
      
      {/* Instruction */}
      <p className="text-xs text-gray-600">
        Click a template or type its number (1, 2, 3...) to select
      </p>
      
      {/* Template Pills */}
      <div className="space-y-2">
        {templates.map((template, index) => (
          <TemplatePill
            key={template.id}
            number={index + 1}
            name={template.name}
            description={template.description}
            complexity={template.complexity}
            isSelected={selectedTemplateId === template.id}
            onClick={() => onSelect(template.id, template.name)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </div>
      
      {/* Recommended Info (if hovered) */}
      {hoveredIndex !== null && templates[hoveredIndex]?.recommendedFor && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-900 mb-0.5">Best for:</p>
              <p className="text-xs text-blue-700">{templates[hoveredIndex].recommendedFor}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

