'use client'

import { memo, useMemo } from 'react'

export interface NarrationRulerProps {
  totalUnits: number
  pixelsPerUnit: number
  unitLabel?: string  // 'Words', 'Pages', etc.
}

function NarrationRuler({ 
  totalUnits, 
  pixelsPerUnit,
  unitLabel = 'Words'
}: NarrationRulerProps) {
  // Calculate marker intervals based on zoom level (for words)
  const markerInterval = useMemo(() => {
    if (pixelsPerUnit > 0.1) return 100     // Every 100 words
    if (pixelsPerUnit > 0.02) return 500    // Every 500 words
    if (pixelsPerUnit > 0.01) return 1000   // Every 1000 words
    if (pixelsPerUnit > 0.004) return 2500  // Every 2500 words
    return 5000                              // Every 5000 words
  }, [pixelsPerUnit])
  
  // Generate marker positions
  const markers = useMemo(() => {
    const count = Math.ceil(totalUnits / markerInterval)
    return Array.from({ length: count }, (_, i) => i * markerInterval)
  }, [totalUnits, markerInterval])
  
  return (
    <div className="relative h-8 bg-gray-50 border-b border-gray-300 flex">
      {/* Label area - sticky/fixed */}
      <div className="sticky left-0 w-16 h-full bg-gray-200 border-r border-gray-300 flex items-center justify-center z-10 shadow-sm flex-shrink-0">
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide truncate px-1 text-center">
          {unitLabel}
        </span>
      </div>
      
      {/* Ruler markers - scrollable area */}
      <div className="relative flex-1 h-full overflow-visible">
        {markers.map((unit) => (
          <div
            key={unit}
            className="absolute top-0 h-full"
            style={{ left: unit * pixelsPerUnit }}
          >
            {/* Tick mark */}
            <div className="w-px h-3 bg-gray-400" />
            
            {/* Unit number */}
            <span className="text-[10px] text-gray-600 font-mono absolute top-3 -translate-x-1/2 whitespace-nowrap">
              {unit.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(NarrationRuler)

