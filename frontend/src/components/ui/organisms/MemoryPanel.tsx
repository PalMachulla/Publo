/**
 * MemoryPanel Organism
 * 
 * Panel showing all learned memory (preferences and patterns).
 * 
 * Composes: PreferenceChip, PatternCard
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { PreferenceChip } from '../atoms/PreferenceChip'
import { PatternCard, PatternData } from '../molecules/PatternCard'

export interface MemoryPanelProps {
  preferences: Record<string, unknown>
  patterns: PatternData[]
  title?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  className?: string
}

export function MemoryPanel({
  preferences,
  patterns,
  title = 'Agent Memory',
  collapsible = true,
  defaultExpanded = false,
  className
}: MemoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [activeTab, setActiveTab] = useState<'preferences' | 'patterns'>('preferences')
  
  // Filter out internal keys
  const displayPrefs = Object.entries(preferences).filter(([key]) => !key.startsWith('_'))
  
  // Don't render if no memory
  const hasMemory = displayPrefs.length > 0 || patterns.length > 0
  if (!hasMemory) {
    return null
  }
  
  return (
    <div 
      className={cn(
        'rounded-lg border border-neutral-200 bg-white overflow-hidden',
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
          <div className="w-5 h-5 rounded flex items-center justify-center bg-purple-100 text-purple-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
              />
            </svg>
          </div>
          
          {/* Title */}
          <span className="text-sm font-medium text-neutral-700">
            {title}
          </span>
          
          {/* Count badges */}
          <div className="flex items-center gap-1">
            {displayPrefs.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
                {displayPrefs.length} prefs
              </span>
            )}
            {patterns.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
                {patterns.length} patterns
              </span>
            )}
          </div>
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
      
      {/* Content */}
      {isExpanded && (
        <div className="border-t border-neutral-100">
          {/* Tabs */}
          <div className="flex border-b border-neutral-100">
            <button
              onClick={() => setActiveTab('preferences')}
              className={cn(
                'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                activeTab === 'preferences' 
                  ? 'text-purple-700 border-b-2 border-purple-500 bg-purple-50/50'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              Preferences ({displayPrefs.length})
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={cn(
                'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                activeTab === 'patterns' 
                  ? 'text-blue-700 border-b-2 border-blue-500 bg-blue-50/50'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              Patterns ({patterns.length})
            </button>
          </div>
          
          {/* Tab content */}
          <div className="p-3">
            {activeTab === 'preferences' && (
              <div className="space-y-2">
                {displayPrefs.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">
                    No preferences learned yet
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {displayPrefs.map(([key, value]) => (
                      <PreferenceChip 
                        key={key}
                        label={key.replace(/_/g, ' ')}
                        value={typeof value === 'string' ? value : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'patterns' && (
              <div className="space-y-2">
                {patterns.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">
                    No patterns saved yet
                  </p>
                ) : (
                  patterns.slice(0, 5).map((pattern, index) => (
                    <PatternCard 
                      key={pattern.id || pattern._saved_at || index}
                      pattern={pattern}
                      compact
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MemoryPanel
