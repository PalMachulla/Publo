'use client'

import { memo } from 'react'
import { StoryStructureItem } from '@/types/nodes'

export interface NarrationSegmentProps {
  item: StoryStructureItem
  level: number // Support any level depth
  startPosition: number  // In pixels
  width: number          // In pixels
  isActive: boolean
  onClick: () => void
}

function NarrationSegment({
  item,
  level,
  startPosition,
  width,
  isActive,
  onClick
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
  
  return (
    <div
      className={`
        absolute top-0 h-full
        ${colors.bg} ${colors.border} ${colors.text}
        ${colors.hover}
        ${isActive ? 'ring-2 ring-yellow-400 z-10' : 'border'}
        cursor-pointer
        transition-all duration-200
        hover:shadow-lg hover:z-20
        overflow-hidden
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
        <div className="h-full px-2 flex items-center">
          <div className="text-xs font-medium truncate">
            {item.name}
          </div>
        </div>
      )}
      
      {/* Completed indicator */}
      {item.completed && (
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

