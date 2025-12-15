/**
 * ContextFilesPanel Organism
 * 
 * Browser for agent's context files.
 * Shows files that the agent has created/used.
 * 
 * Composes: FileListItem
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { FileListItem } from '../molecules/FileListItem'

export interface ContextFile {
  name: string
  path: string
  size?: number
  modifiedAt?: string
}

export interface ContextFilesPanelProps {
  files: ContextFile[]
  title?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  onFileSelect?: (file: ContextFile) => void
  className?: string
}

export function ContextFilesPanel({
  files,
  title = 'Context Files',
  collapsible = true,
  defaultExpanded = false,
  onFileSelect,
  className
}: ContextFilesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  // Don't render if no files
  if (!files || files.length === 0) {
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
          <div className="w-5 h-5 rounded flex items-center justify-center bg-amber-100 text-amber-600">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            </svg>
          </div>
          
          {/* Title */}
          <span className="text-sm font-medium text-neutral-700">
            {title}
          </span>
          
          {/* Count badge */}
          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-neutral-100 text-neutral-600">
            {files.length} files
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
      
      {/* File list */}
      {isExpanded && (
        <div className="border-t border-neutral-100 divide-y divide-neutral-50">
          {files.map((file) => (
            <FileListItem
              key={file.path}
              name={file.name}
              path={file.path}
              size={file.size}
              onClick={onFileSelect ? () => onFileSelect(file) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ContextFilesPanel
