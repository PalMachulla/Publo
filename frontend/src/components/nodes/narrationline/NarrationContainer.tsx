'use client'

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { StoryStructureItem } from '@/types/nodes'
import { useNarrationZoom } from './useNarrationZoom'
import { getDocumentHierarchy } from '@/lib/documentHierarchy'
import StructureTrackLane from './StructureTrackLane'
import NarrationRuler from './NarrationRuler'
import ZoomControls from './ZoomControls'

export interface NarrationContainerProps {
  items: StoryStructureItem[]
  activeItemId?: string
  onItemClick: (item: StoryStructureItem) => void
  unitLabel?: string
  isLoading?: boolean
  initialWidth?: number
  onWidthChange?: (width: number) => void
  format?: string // Story format to determine hierarchy level names
}

function NarrationContainer({
  items,
  activeItemId,
  onItemClick,
  unitLabel = 'Pages',
  isLoading = false,
  initialWidth = 1200,
  onWidthChange,
  format
}: NarrationContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeDirection = useRef<'left' | 'right'>('right')
  
  // Calculate total word count from Level 1 items only
  // Level 1 represents the max extent (e.g., Season with 1000 words)
  // Lower levels (Episodes, Segments) are subdivisions within that total
  const totalWords = useMemo(() => {
    if (items.length === 0) return 10000 // Default 10k words
    
    // Sum up only level 1 items - they define the total extent
    const level1Items = items.filter(item => item.level === 1)
    if (level1Items.length === 0) return 10000 // Fallback if no level 1 items
    
    const calculated = level1Items.reduce((sum, item) => {
      return sum + (item.wordCount || 1000) // Default 1000 words per section
    }, 0)
    
    return Math.max(calculated, 1000) // Minimum 1000 words
  }, [items])
  
  const totalUnits = totalWords
  
  const {
    zoom,
    pixelsPerUnit,
    totalWidth,
    fitToView,
    zoomIn,
    zoomOut
  } = useNarrationZoom({ totalUnits, viewportWidth: containerWidth })
  
  // Fit to view on mount and when items change
  useEffect(() => {
    if (items.length > 0) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        fitToView()
      }, 100)
    }
  }, [items, fitToView])
  
  // Get unique levels present in items
  const levels = Array.from(new Set(items.map(i => i.level))).sort() as (1 | 2 | 3)[]
  
  // Get hierarchy level names based on format
  const hierarchy = format ? getDocumentHierarchy(format) : null
  const getLevelName = (level: number): string | undefined => {
    if (!hierarchy || level > hierarchy.length) return undefined
    return hierarchy[level - 1]?.name
  }
  
  // Handle resize start - prevent node dragging
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    setIsResizing(true)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = containerWidth
    resizeDirection.current = direction
  }, [containerWidth])
  
  // Handle resize move
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    
    const deltaX = e.clientX - resizeStartX.current
    const direction = resizeDirection.current
    
    let newWidth: number
    if (direction === 'right') {
      newWidth = resizeStartWidth.current + deltaX
    } else {
      newWidth = resizeStartWidth.current - deltaX
    }
    
    // Clamp width between 600 and 2400
    newWidth = Math.max(600, Math.min(2400, newWidth))
    setContainerWidth(newWidth)
    
    // Notify parent of width change
    if (onWidthChange) {
      onWidthChange(newWidth)
    }
  }, [isResizing, onWidthChange])
  
  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])
  
  // Add/remove mouse event listeners for resize
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])
  
  return (
    <div 
      className={`relative mx-auto rounded-2xl bg-gray-400 shadow-lg overflow-hidden border-2 border-gray-400 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ width: containerWidth }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        // Allow the event to bubble if not resizing, but prevent opening panel
        if (!isResizing) {
          e.stopPropagation()
        }
      }}
    >
      {/* Left resize handle */}
      <div
        data-nodrag="true"
        className={`noDrag nodrag absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 group ${isResizing ? 'bg-yellow-400/50' : 'hover:bg-gray-300/50'} transition-colors rounded-l-2xl`}
        onMouseDown={(e) => handleResizeStart(e, 'left')}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        title="Drag to resize"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
      
      {/* Main content container */}
      <div className="w-full">
        {/* Header with controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-300">
          <div className="text-xs text-gray-600 font-medium">
            Narration Line
          </div>
          <ZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFitToView={fitToView}
          />
        </div>
        
        {/* Ruler */}
        <NarrationRuler
          totalUnits={totalUnits}
          pixelsPerUnit={pixelsPerUnit}
          unitLabel={unitLabel}
        />
        
        {/* Scrollable viewport - horizontal scroll when content is wider than container */}
        <div
          ref={containerRef}
          className="relative overflow-x-auto overflow-y-hidden bg-gray-50"
          style={{ maxHeight: '300px' }}
        >
          <div style={{ width: Math.max(totalWidth, containerWidth - 64) }}>
            {/* Structure tracks */}
            {levels.map((level) => (
              <StructureTrackLane
                key={level}
                level={level}
                items={items}
                pixelsPerUnit={pixelsPerUnit}
                totalUnits={totalUnits}
                activeItemId={activeItemId}
                onItemClick={onItemClick}
                levelName={getLevelName(level)}
              />
            ))}
            
            {/* Empty state if no items */}
            {items.length === 0 && (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                No structure items yet
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right resize handle */}
      <div
        data-nodrag="true"
        className={`noDrag nodrag absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-30 group ${isResizing ? 'bg-yellow-400/50' : 'hover:bg-gray-300/50'} transition-colors rounded-r-2xl`}
        onMouseDown={(e) => handleResizeStart(e, 'right')}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        title="Drag to resize"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
    </div>
  )
}

export default memo(NarrationContainer)

