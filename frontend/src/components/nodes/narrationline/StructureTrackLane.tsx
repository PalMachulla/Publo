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
  levelName?: string // e.g., "Acts", "Chapters", "Scenes"
}

function StructureTrackLane({
  level,
  items,
  pixelsPerUnit,
  totalUnits,
  activeItemId,
  onItemClick,
  levelName
}: StructureTrackLaneProps) {
  const trackHeight = {
    1: 40,  // Uniform height for all levels
    2: 40,  // Uniform height for all levels
    3: 40   // Uniform height for all levels
  }
  
  // Use provided level name or fall back to L1, L2, L3
  const displayLabel = levelName || `L${level}`
  
  // Calculate segment position and width based on word count
  const getSegmentMetrics = (item: StoryStructureItem, itemIndex: number) => {
    // Use actual word count if available, otherwise estimate
    const wordCount = item.wordCount || 1000 // Default 1000 words per section
    
    // If startPosition is not set, calculate it based on order
    let startPos = item.startPosition
    if (startPos === undefined || startPos === null) {
      // Calculate cumulative position: sum of word counts of all previous items at this level
      startPos = 0
      for (let i = 0; i < itemIndex; i++) {
        const prevItem = levelItems[i]
        startPos += (prevItem.wordCount || 1000)
      }
    }
    
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
        <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide text-center px-1">
          {displayLabel}
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

