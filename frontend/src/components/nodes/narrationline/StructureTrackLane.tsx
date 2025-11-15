'use client'

import { memo } from 'react'
import { StoryStructureItem, AgentOption } from '@/types/nodes'
import NarrationSegment from './NarrationSegment'

export interface StructureTrackLaneProps {
  level: number // Support any level depth
  items: StoryStructureItem[]
  pixelsPerUnit: number
  totalUnits: number
  activeItemId?: string
  focusedItemId?: string | null // The segment that's currently zoomed/focused
  onItemClick: (item: StoryStructureItem) => void
  onItemDoubleClick?: (item: StoryStructureItem) => void
  onEditItem?: (item: StoryStructureItem, e: React.MouseEvent) => void
  onColorChange?: (itemId: string, color: string | null) => void
  levelName?: string // e.g., "Acts", "Chapters", "Scenes"
  availableAgents?: AgentOption[]
  onAgentAssign?: (itemId: string, agentId: string | null) => void
}

function StructureTrackLane({
  level,
  items,
  pixelsPerUnit,
  totalUnits,
  activeItemId,
  focusedItemId,
  onItemClick,
  onItemDoubleClick,
  onEditItem,
  onColorChange,
  levelName,
  availableAgents = [],
  onAgentAssign
}: StructureTrackLaneProps) {
  // Uniform height for all track levels
  const trackHeight = 40
  
  // Use provided level name or fall back to L1, L2, L3
  const displayLabel = levelName || `L${level}`
  
  // Recursive function to get parent's position and width
  const getParentMetrics = (parentId: string): { start: number; width: number } => {
    const parent = items.find(i => i.id === parentId)
    if (!parent) return { start: 0, width: 1000 }
    
    // If parent has explicit position, use it
    if (parent.startPosition !== undefined && parent.startPosition !== null) {
      return {
        start: parent.startPosition,
        width: parent.wordCount || 1000
      }
    }
    
    // If parent also has a parent, recursively get its position
    if (parent.parentId) {
      const grandparentMetrics = getParentMetrics(parent.parentId)
      const parentSiblings = items
        .filter(i => i.parentId === parent.parentId && i.level === parent.level)
        .sort((a, b) => a.order - b.order)
      
      const parentIndex = parentSiblings.findIndex(s => s.id === parent.id)
      const childWidth = grandparentMetrics.width / parentSiblings.length
      const childStart = grandparentMetrics.start + (parentIndex * childWidth)
      
      return { start: childStart, width: childWidth }
    }
    
    // Parent is top-level - calculate its position
    const topLevelSiblings = items
      .filter(i => !i.parentId && i.level === parent.level)
      .sort((a, b) => a.order - b.order)
    
    let startPos = 0
    const siblingIndex = topLevelSiblings.findIndex(s => s.id === parent.id)
    for (let i = 0; i < siblingIndex; i++) {
      startPos += (topLevelSiblings[i].wordCount || 1000)
    }
    
    return { start: startPos, width: parent.wordCount || 1000 }
  }
  
  // Calculate segment position and width based on hierarchical structure
  // IMPROVED: Reduces rounding errors by keeping calculations in word count space longer
  const getSegmentMetrics = (item: StoryStructureItem, itemIndex: number) => {
    // Use actual word count if available, otherwise estimate
    const wordCount = item.wordCount || 1000 // Default 1000 words per section
    
    // If startPosition is explicitly set, use it
    if (item.startPosition !== undefined && item.startPosition !== null) {
      const startPosition = item.startPosition * pixelsPerUnit
      const width = wordCount * pixelsPerUnit
      return { startPosition, width }
    }
    
    // Calculate position based on hierarchy
    let startPos = 0
    let itemWidth = wordCount
    
    if (item.parentId) {
      // This is a child item - position within parent's range PROPORTIONALLY by word count
      const parentMetrics = getParentMetrics(item.parentId)
      
      // Get all siblings (including this item)
      const siblings = items
        .filter(i => i.parentId === item.parentId && i.level === item.level)
        .sort((a, b) => a.order - b.order)
      
      // Calculate total word count of all siblings
      const totalSiblingsWordCount = siblings.reduce((sum, s) => 
        sum + (s.wordCount || 1000), 0)
      
      // IMPROVED: Calculate proportion of parent width
      const proportion = wordCount / totalSiblingsWordCount
      
      // Calculate width in pixels (parent's pixel width * proportion)
      const parentPixelWidth = parentMetrics.width * pixelsPerUnit
      const itemPixelWidth = Math.round(parentPixelWidth * proportion)
      
      // IMPROVED: Calculate offset by summing actual pixel widths of previous siblings
      // This prevents accumulated float errors
      const siblingIndex = siblings.findIndex(s => s.id === item.id)
      let pixelOffset = 0
      for (let i = 0; i < siblingIndex; i++) {
        const siblingProportion = (siblings[i].wordCount || 1000) / totalSiblingsWordCount
        const siblingPixelWidth = Math.round(parentPixelWidth * siblingProportion)
        pixelOffset += siblingPixelWidth
      }
      
      // Start position in pixels
      const parentPixelStart = Math.round(parentMetrics.start * pixelsPerUnit)
      const startPixelPosition = parentPixelStart + pixelOffset
      
      console.log(`📊 Child segment [${item.name}]:`, {
        wordCount,
        totalSiblingsWordCount,
        proportion: (proportion * 100).toFixed(1) + '%',
        parentPixelWidth,
        itemPixelWidth,
        startPixelPosition,
        siblings: siblings.map(s => ({ name: s.name, wordCount: s.wordCount }))
      })
      
      return { 
        startPosition: startPixelPosition, 
        width: itemPixelWidth 
      }
    }
    
    // Top-level item - calculate based on previous siblings at same level
    const topLevelSiblings = items
      .filter(i => !i.parentId && i.level === item.level)
      .sort((a, b) => a.order - b.order)
    
    const siblingIndex = topLevelSiblings.findIndex(s => s.id === item.id)
    for (let i = 0; i < siblingIndex; i++) {
      startPos += (topLevelSiblings[i].wordCount || 1000)
    }
    
    // Round pixel values to reduce sub-pixel errors
    const startPosition = Math.round(startPos * pixelsPerUnit)
    const width = Math.round(itemWidth * pixelsPerUnit)
    
    console.log(`📊 Top-level segment [${item.name}]:`, {
      wordCount,
      startPos,
      startPosition,
      width,
      allTopLevel: topLevelSiblings.map(s => ({ name: s.name, wordCount: s.wordCount }))
    })
    
    return { startPosition, width }
  }
  
  const levelItems = items
    .filter(item => item.level === level)
    .sort((a, b) => a.order - b.order)
  
  return (
    <>
      {/* Main track with segments */}
      <div 
        className="relative bg-white border-b border-gray-100 flex"
        style={{ 
          height: trackHeight,
          width: '100%',
          minWidth: '100%'
        }}
      >
        {/* Track label - sticky/fixed */}
        <div className="sticky left-0 w-16 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-50 flex-shrink-0">
          <span className="text-[10px] text-gray-700 font-semibold uppercase tracking-wider text-center px-1 truncate">
            {displayLabel}
          </span>
        </div>
        
        {/* Narration segments - scrollable area */}
        <div className="relative flex-1 h-full overflow-hidden pl-2">
          {levelItems.map((item, index) => {
            const { startPosition, width } = getSegmentMetrics(item, index)
            // Find the agent's active status if one is assigned
            const assignedAgent = item.assignedAgentId 
              ? availableAgents.find(a => a.id === item.assignedAgentId)
              : null
            const agentIsActive = assignedAgent ? (assignedAgent as any).isActive !== false : true
            
            return (
              <NarrationSegment
                key={item.id}
                item={item}
                level={level}
                startPosition={startPosition}
                width={width}
                isActive={item.id === activeItemId}
                isFocused={item.id === focusedItemId}
                agentColor={item.assignedAgentColor}
                agentIsActive={agentIsActive}
                onClick={() => onItemClick(item)}
                onDoubleClick={onItemDoubleClick ? () => onItemDoubleClick(item) : undefined}
                onEdit={onEditItem ? (e) => onEditItem(item, e) : undefined}
                onColorChange={onColorChange ? (color) => onColorChange(item.id, color) : undefined}
                availableAgents={availableAgents}
                onAgentAssign={onAgentAssign ? (agentId) => onAgentAssign(item.id, agentId) : undefined}
              />
            )
          })}
        </div>
      </div>
    </>
  )
}

export default memo(StructureTrackLane)

