'use client'

import { memo } from 'react'
import { StoryStructureItem } from '@/types/nodes'
import NarrationSegment from './NarrationSegment'

export interface StructureTrackLaneProps {
  level: 1 | 2 | 3
  items: StoryStructureItem[]
  pixelsPerUnit: number
  totalUnits: number
  activeItemId?: string
  onItemClick: (item: StoryStructureItem) => void
}

function StructureTrackLane({
  level,
  items,
  pixelsPerUnit,
  totalUnits,
  activeItemId,
  onItemClick
}: StructureTrackLaneProps) {
  const trackHeight = {
    1: 48,  // Tallest for top level
    2: 36,  // Medium for chapters
    3: 28   // Shortest for scenes
  }
  
  const levelLabels = {
    1: 'L1',
    2: 'L2',
    3: 'L3'
  }
  
  // Calculate segment position and width
  const getSegmentMetrics = (item: StoryStructureItem, itemIndex: number) => {
    // For now, distribute items evenly
    // In production, use actual page counts
    const itemsAtLevel = items.filter(i => i.level === level)
    const segmentWidth = (totalUnits / itemsAtLevel.length) * pixelsPerUnit
    const startPosition = itemIndex * segmentWidth
    
    return { startPosition, width: segmentWidth }
  }
  
  const levelItems = items
    .filter(item => item.level === level)
    .sort((a, b) => a.order - b.order)
  
  return (
    <div 
      className="relative w-full bg-gray-100 border-b border-gray-300"
      style={{ height: trackHeight[level] }}
    >
      {/* Track label */}
      <div className="absolute left-0 top-0 w-16 h-full bg-gray-200 border-r border-gray-300 flex items-center justify-center z-10">
        <span className="text-xs text-gray-600 font-mono font-medium">
          {levelLabels[level]}
        </span>
      </div>
      
      {/* Narration segments */}
      <div className="absolute left-16 right-0 h-full px-1 py-1">
        {levelItems.map((item, index) => {
          const { startPosition, width } = getSegmentMetrics(item, index)
          return (
            <NarrationSegment
              key={item.id}
              item={item}
              level={level}
              startPosition={startPosition}
              width={width}
              isActive={item.id === activeItemId}
              onClick={() => onItemClick(item)}
            />
          )
        })}
      </div>
    </div>
  )
}

export default memo(StructureTrackLane)

