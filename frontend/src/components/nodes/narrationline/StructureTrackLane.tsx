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
  
  // Calculate segment position and width based on word count
  const getSegmentMetrics = (item: StoryStructureItem, itemIndex: number) => {
    // Use actual word count if available, otherwise estimate
    const wordCount = item.wordCount || 1000 // Default 1000 words per section
    const startPos = item.startPosition || 0
    
    const startPosition = startPos * pixelsPerUnit
    const width = wordCount * pixelsPerUnit
    
    return { startPosition, width }
  }
  
  const levelItems = items
    .filter(item => item.level === level)
    .sort((a, b) => a.order - b.order)
  
  return (
    <div 
      className="relative w-full bg-gray-100 border-b border-gray-300 flex"
      style={{ height: trackHeight[level] }}
    >
      {/* Track label - sticky/fixed */}
      <div className="sticky left-0 w-16 h-full bg-gray-200 border-r border-gray-300 flex items-center justify-center z-10 shadow-sm flex-shrink-0">
        <span className="text-xs text-gray-600 font-mono font-medium">
          {levelLabels[level]}
        </span>
      </div>
      
      {/* Narration segments - scrollable area */}
      <div className="relative flex-1 h-full px-1 py-1 overflow-visible">
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

