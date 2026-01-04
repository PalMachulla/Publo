/**
 * Progressive Structure Rendering
 * 
 * This file contains components and types for progressive structure rendering.
 * Integrate these into your existing StoryStructureNode component.
 * 
 * Features:
 * - Skeleton loading states for sections
 * - Progressive reveal as sections complete
 * - Visual feedback during generation
 */

import React from 'react'
import { cn } from '@/lib/utils'

// ============================================================
// TYPES
// ============================================================

export interface ProgressiveStructureItem {
  id: string
  name: string
  level: number
  summary?: string | null
  isLoading?: boolean
  wordCount?: number
  children?: ProgressiveStructureItem[]
}

export interface ProgressiveStructureNodeData {
  label: string
  format: string
  template?: string
  logline?: string
  items: ProgressiveStructureItem[]
  isGenerating?: boolean  // Overall generation in progress
}

// ============================================================
// SKELETON COMPONENT
// ============================================================

export function Skeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-gray-700 rounded',
        className
      )} 
    />
  )
}

// ============================================================
// STRUCTURE ITEM COMPONENT (Progressive)
// ============================================================

interface StructureItemProps {
  item: ProgressiveStructureItem
  index: number
  isGenerating: boolean
  onClick?: () => void
}

export function ProgressiveStructureItem({ 
  item, 
  index, 
  isGenerating,
  onClick 
}: StructureItemProps) {
  const isLoading = item.isLoading || (isGenerating && !item.summary)
  const isComplete = !isLoading && !!item.summary
  const isPending = isGenerating && !item.isLoading && !item.summary
  
  return (
    <div 
      className={cn(
        'group relative p-3 rounded-lg border transition-all duration-300',
        isComplete && 'border-gray-200 dark:border-gray-700 hover:border-blue-300 cursor-pointer',
        isLoading && 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20',
        isPending && 'border-dashed border-gray-300 dark:border-gray-600 opacity-60'
      )}
      onClick={isComplete ? onClick : undefined}
    >
      {/* Header Row */}
      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
          isComplete && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
          isLoading && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
          isPending && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        )}>
          {isLoading ? (
            <LoadingSpinner className="w-4 h-4" />
          ) : isComplete ? (
            '✓'
          ) : (
            index + 1
          )}
        </div>
        
        {/* Name */}
        <span className={cn(
          'font-medium flex-1',
          isComplete && 'text-gray-900 dark:text-gray-100',
          isLoading && 'text-blue-700 dark:text-blue-300',
          isPending && 'text-gray-400 dark:text-gray-500'
        )}>
          {item.name}
        </span>
        
        {/* Word count (if available) */}
        {item.wordCount && item.wordCount > 0 && (
          <span className="text-xs text-gray-400">
            {item.wordCount.toLocaleString()} words
          </span>
        )}
      </div>
      
      {/* Summary or Skeleton */}
      <div className="mt-2 ml-8">
        {isLoading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ) : item.summary ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {item.summary}
          </p>
        ) : isPending ? (
          <p className="text-sm text-gray-400 italic">
            Waiting...
          </p>
        ) : null}
      </div>
      
      {/* Hover effect for complete items */}
      {isComplete && (
        <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}
    </div>
  )
}

// ============================================================
// LOADING SPINNER
// ============================================================

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg 
      className={cn('animate-spin', className)} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// ============================================================
// STRUCTURE LIST COMPONENT
// ============================================================

interface ProgressiveStructureListProps {
  items: ProgressiveStructureItem[]
  isGenerating: boolean
  onItemClick?: (item: ProgressiveStructureItem) => void
  className?: string
}

export function ProgressiveStructureList({
  items,
  isGenerating,
  onItemClick,
  className
}: ProgressiveStructureListProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item, index) => (
        <ProgressiveStructureItem
          key={item.id}
          item={item}
          index={index}
          isGenerating={isGenerating}
          onClick={() => onItemClick?.(item)}
        />
      ))}
      
      {/* Show overall progress */}
      {isGenerating && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400">
          <LoadingSpinner className="w-4 h-4" />
          <span>
            Generating structure... ({items.filter(i => i.summary).length}/{items.length})
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// HEADER COMPONENT (with generation status)
// ============================================================

interface ProgressiveStructureHeaderProps {
  title: string
  format: string
  logline?: string
  isGenerating: boolean
  totalSections: number
  completedSections: number
}

export function ProgressiveStructureHeader({
  title,
  format,
  logline,
  isGenerating,
  totalSections,
  completedSections
}: ProgressiveStructureHeaderProps) {
  const progress = totalSections > 0 ? (completedSections / totalSections) * 100 : 0
  
  return (
    <div className="space-y-2">
      {/* Title and Format */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
            {title || 'Generating...'}
          </h3>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {format}
          </span>
        </div>
        
        {isGenerating && (
          <div className="flex items-center gap-1 text-blue-500">
            <LoadingSpinner className="w-4 h-4" />
          </div>
        )}
      </div>
      
      {/* Logline */}
      {logline && (
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
          {logline}
        </p>
      )}
      
      {/* Progress bar (only during generation) */}
      {isGenerating && (
        <div className="space-y-1">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            {completedSections} of {totalSections} sections
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// USAGE EXAMPLE
// ============================================================

/**
 * Example integration into StoryStructureNode:
 * 
 * ```tsx
 * import { 
 *   ProgressiveStructureHeader, 
 *   ProgressiveStructureList,
 *   type ProgressiveStructureNodeData 
 * } from './ProgressiveStructureRendering'
 * 
 * function StoryStructureNode({ data }: { data: ProgressiveStructureNodeData }) {
 *   const completedCount = data.items.filter(i => i.summary).length
 *   
 *   return (
 *     <div className="story-structure-node">
 *       <ProgressiveStructureHeader
 *         title={data.label}
 *         format={data.format}
 *         logline={data.logline}
 *         isGenerating={data.isGenerating || false}
 *         totalSections={data.items.length}
 *         completedSections={completedCount}
 *       />
 *       
 *       <ProgressiveStructureList
 *         items={data.items}
 *         isGenerating={data.isGenerating || false}
 *         onItemClick={handleItemClick}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */