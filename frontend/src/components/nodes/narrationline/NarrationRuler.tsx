'use client'

import { memo, useMemo } from 'react'

export interface NarrationRulerProps {
  totalUnits: number
  pixelsPerUnit: number
  unitLabel?: string  // 'Pages', 'Sections', 'Minutes', etc.
}

function NarrationRuler({ 
  totalUnits, 
  pixelsPerUnit,
  unitLabel = 'Pages'
}: NarrationRulerProps) {
  // Calculate marker intervals based on zoom level
  const markerInterval = useMemo(() => {
    if (pixelsPerUnit > 100) return 1    // Show every unit
    if (pixelsPerUnit > 20) return 5     // Every 5 units
    if (pixelsPerUnit > 5) return 10     // Every 10 units
    if (pixelsPerUnit > 2) return 25     // Every 25 units
    return 50                             // Every 50 units
  }, [pixelsPerUnit])
  
  // Generate marker positions
  const markers = useMemo(() => {
    const count = Math.ceil(totalUnits / markerInterval)
    return Array.from({ length: count }, (_, i) => i * markerInterval)
  }, [totalUnits, markerInterval])
  
  return (
    <div className="relative h-8 bg-gray-50 border-b border-gray-300">
      {/* Label area */}
      <div className="absolute left-0 top-0 w-16 h-full bg-gray-200 border-r border-gray-300 flex items-center justify-center">
        <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
          {unitLabel}
        </span>
      </div>
      
      {/* Ruler markers - overflow hidden to crop numbers at edges */}
      <div className="absolute left-16 right-0 h-full overflow-hidden">
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
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default memo(NarrationRuler)

