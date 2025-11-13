'use client'

import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { StoryStructureItem } from '@/types/nodes'
import { useNarrationZoom } from './useNarrationZoom'
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
}

function NarrationContainer({
  items,
  activeItemId,
  onItemClick,
  unitLabel = 'Pages',
  isLoading = false,
  initialWidth = 1200,
  onWidthChange
}: NarrationContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeDirection = useRef<'left' | 'right'>('right')
  
  // Calculate total units (for now, count items at deepest level)
  const totalUnits = Math.max(
    items.filter(i => i.level === 1).length * 10, // Rough estimate
    20 // Minimum
  )
  
  const {
    zoom,
    pixelsPerUnit,
    totalWidth,
    fitToView,
    zoomIn,
    zoomOut
  } = useNarrationZoom({ totalUnits, viewportWidth: containerWidth })
  
  // Fit to view on mount
  useEffect(() => {
    if (items.length > 0) {
      fitToView()
    }
  }, [items.length, fitToView])
  
  // Get unique levels present in items
  const levels = Array.from(new Set(items.map(i => i.level))).sort() as (1 | 2 | 3)[]
  
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
      className={`relative mx-auto rounded-2xl bg-gray-400 shadow-lg overflow-hidden ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ width: containerWidth }}
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
          <div style={{ width: totalWidth + 100, minWidth: containerWidth }}>
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

