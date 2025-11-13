'use client'

import { memo, useRef, useEffect } from 'react'
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
}

function NarrationContainer({
  items,
  activeItemId,
  onItemClick,
  unitLabel = 'Pages',
  isLoading = false
}: NarrationContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
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
  } = useNarrationZoom({ totalUnits, viewportWidth: 1200 })
  
  // Fit to view on mount
  useEffect(() => {
    if (items.length > 0) {
      fitToView()
    }
  }, [items.length, fitToView])
  
  // Get unique levels present in items
  const levels = Array.from(new Set(items.map(i => i.level))).sort() as (1 | 2 | 3)[]
  
  return (
    <div className={`w-full ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
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
      
      {/* Scrollable viewport */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto overflow-y-hidden bg-gray-50"
        style={{ maxHeight: '300px' }}
      >
        <div style={{ width: Math.max(totalWidth + 100, '100%'), minWidth: '100%' }}>
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
  )
}

export default memo(NarrationContainer)

