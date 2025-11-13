'use client'

import { memo } from 'react'
import { StoryStructureItem } from '@/types/nodes'

export interface NarrationSegmentProps {
  item: StoryStructureItem
  level: number // Support any level depth
  startPosition: number  // In pixels
  width: number          // In pixels
  isActive: boolean
  isFocused?: boolean // Whether this segment is currently zoomed/focused
  onClick: () => void
  onEdit?: (e: React.MouseEvent) => void // Handler for edit icon click
}

function NarrationSegment({
  item,
  level,
  startPosition,
  width,
  isActive,
  isFocused = false,
  onClick,
  onEdit
}: NarrationSegmentProps) {
  // Lighter color palette for better visibility
  const levelColors: Record<number, any> = {
    1: {
      bg: 'bg-gray-200',
      border: 'border-gray-300',
      text: 'text-gray-800',
      hover: 'hover:bg-gray-300'
    },
    2: {
      bg: 'bg-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-700',
      hover: 'hover:bg-gray-200'
    },
    3: {
      bg: 'bg-gray-50',
      border: 'border-gray-100',
      text: 'text-gray-600',
      hover: 'hover:bg-gray-100'
    },
    // Additional levels for deeper hierarchies
    4: {
      bg: 'bg-slate-50',
      border: 'border-slate-100',
      text: 'text-slate-600',
      hover: 'hover:bg-slate-100'
    },
    5: {
      bg: 'bg-zinc-50',
      border: 'border-zinc-100',
      text: 'text-zinc-600',
      hover: 'hover:bg-zinc-100'
    },
    6: {
      bg: 'bg-neutral-50',
      border: 'border-neutral-100',
      text: 'text-neutral-600',
      hover: 'hover:bg-neutral-100'
    },
    7: {
      bg: 'bg-stone-50',
      border: 'border-stone-100',
      text: 'text-stone-600',
      hover: 'hover:bg-stone-100'
    }
  }
  
  const colors = levelColors[level] || levelColors[1] // Fallback to level 1 colors
  const minWidthForText = 60 // Only show text if segment is wide enough
  const minWidthForEditIcon = 80 // Show edit icon if segment is wide enough
  
  return (
    <div
      className={`
        absolute top-0 h-full
        ${isFocused ? 'bg-yellow-400' : 'bg-gray-100'} 
        ${colors.border} 
        ${isFocused ? 'text-gray-900' : 'text-gray-700'}
        ${isFocused ? '' : 'hover:bg-gray-200'}
        ${isActive ? 'ring-2 ring-yellow-400 z-10' : 'border'}
        ${isFocused ? 'shadow-2xl z-30' : ''}
        cursor-pointer
        transition-all duration-200
        hover:shadow-lg hover:z-20
        overflow-hidden
        rounded-br
        group
      `}
      style={{
        left: startPosition,
        width: Math.max(width, 20), // Min width 20px for visibility
      }}
      onClick={onClick}
      title={item.name} // Tooltip for narrow segments
    >
      {/* Segment label - only show if wide enough */}
      {width >= minWidthForText && (
        <div className="h-full px-2 flex items-center justify-between gap-2">
          <div className="text-xs font-medium truncate flex-1">
            {item.name}
          </div>
          
          {/* Edit icon - only show when focused AND segment is wide enough */}
          {isFocused && width >= minWidthForEditIcon && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(e)
              }}
              className="flex-shrink-0 p-1 rounded hover:bg-yellow-400/30 transition-colors"
              title="Edit content"
              aria-label="Edit content"
            >
              <svg 
                className="w-4 h-4 text-gray-700" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" 
                />
              </svg>
            </button>
          )}
        </div>
      )}
      
      {/* Completed indicator */}
      {item.completed && !isFocused && (
        <div className="absolute top-1 right-1">
          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default memo(NarrationSegment)

