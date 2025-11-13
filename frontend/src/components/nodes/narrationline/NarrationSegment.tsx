'use client'

import { memo } from 'react'
import { StoryStructureItem } from '@/types/nodes'

export interface NarrationSegmentProps {
  item: StoryStructureItem
  level: 1 | 2 | 3
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
  // Sleek color palette matching app design
  const levelColors = {
    1: {
      bg: 'bg-gray-400',
      border: 'border-gray-500',
      text: 'text-gray-900',
      hover: 'hover:bg-gray-500'
    },
    2: {
      bg: 'bg-gray-300',
      border: 'border-gray-400',
      text: 'text-gray-800',
      hover: 'hover:bg-gray-400'
    },
    3: {
      bg: 'bg-gray-200',
      border: 'border-gray-300',
      text: 'text-gray-700',
      hover: 'hover:bg-gray-300'
    }
  }
  
  const colors = levelColors[level]
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

