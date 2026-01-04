/**
 * PatternCard Molecule
 * 
 * Shows a learned pattern with context and description.
 * 
 * Composes: PatternIcon
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { PatternIcon, PatternType } from '../atoms/PatternIcon'

export interface PatternData {
  id?: string
  type: string
  description: string
  context?: string
  _saved_at?: string
}

export interface PatternCardProps {
  pattern: PatternData
  compact?: boolean
  className?: string
}

export function PatternCard({ pattern, compact = false, className }: PatternCardProps) {
  const patternType = (pattern.type as PatternType) || 'unknown'
  
  const formatDate = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return ''
    }
  }
  
  if (compact) {
    return (
      <div 
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded bg-neutral-50',
          className
        )}
      >
        <PatternIcon type={patternType} size="sm" />
        <span className="text-xs text-neutral-600 truncate flex-1">
          {pattern.description}
        </span>
      </div>
    )
  }
  
  return (
    <div 
      className={cn(
        'rounded-lg border border-neutral-200 p-3 bg-white',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <PatternIcon type={patternType} size="md" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-800 capitalize">
              {pattern.type.replace(/_/g, ' ')}
            </span>
            {pattern._saved_at && (
              <span className="text-xs text-neutral-400">
                {formatDate(pattern._saved_at)}
              </span>
            )}
          </div>
          
          <p className="text-sm text-neutral-600 mt-1">
            {pattern.description}
          </p>
          
          {pattern.context && (
            <p className="text-xs text-neutral-400 mt-1.5 italic">
              Context: {pattern.context}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default PatternCard
