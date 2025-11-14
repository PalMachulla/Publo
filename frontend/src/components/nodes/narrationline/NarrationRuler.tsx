'use client'

import { memo, useMemo } from 'react'

export interface NarrationRulerProps {
  totalUnits: number
  pixelsPerUnit: number
  unitLabel?: string  // 'Words', 'Pages', etc.
  scrollLeft?: number  // Current scroll position
}

function NarrationRuler({ 
  totalUnits, 
  pixelsPerUnit,
  unitLabel = 'Words',
  scrollLeft = 0
}: NarrationRulerProps) {
  // Calculate marker intervals based on zoom level and total units
  // Aim for markers every 80-150 pixels for readability
  const markerInterval = useMemo(() => {
    const targetPixelSpacing = 100 // Target pixels between markers
    
    // Calculate ideal interval based on pixel spacing
    const idealInterval = targetPixelSpacing / pixelsPerUnit
    
    // Round to nice numbers based on magnitude
    if (idealInterval < 100) return 50
    if (idealInterval < 250) return 100
    if (idealInterval < 750) return 500
    if (idealInterval < 1500) return 1000
    if (idealInterval < 3500) return 2500
    if (idealInterval < 7500) return 5000
    if (idealInterval < 15000) return 10000
    if (idealInterval < 35000) return 25000
    if (idealInterval < 75000) return 50000
    return 100000
  }, [pixelsPerUnit])
  
  // Generate marker positions (always include 0)
  const markers = useMemo(() => {
    const count = Math.ceil(totalUnits / markerInterval)
    const markersArray = Array.from({ length: count + 1 }, (_, i) => i * markerInterval)
    // Ensure 0 is always included
    if (!markersArray.includes(0)) {
      markersArray.unshift(0)
    }
    return markersArray
  }, [totalUnits, markerInterval])
  
  return (
    <div className="relative h-8 bg-white border-b border-gray-200 flex">
      {/* Label area - sticky/fixed */}
      <div className="sticky left-0 w-16 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-40 flex-shrink-0">
        <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider truncate px-1 text-center">
          {unitLabel}
        </span>
      </div>
      
      {/* Ruler markers - scrollable area (offset by scrollLeft) */}
      <div className="relative flex-1 h-full overflow-hidden">
        {/* Show markers offset by scroll position */}
        {markers.map((unit) => {
          const markerPosition = unit * pixelsPerUnit - scrollLeft
          // Only render markers that are visible in viewport (with some buffer)
          if (markerPosition < -150 || markerPosition > 2500) return null
          
          return (
            <div
              key={unit}
              className="absolute top-0 h-full"
              style={{ left: markerPosition }}
            >
              {/* Tick mark */}
              <div className="w-px h-3 bg-gray-300" />
              
              {/* Unit number - using left alignment to prevent overflow on right */}
              <span className="text-[10px] text-gray-700 font-mono font-medium absolute top-3 left-0 -translate-x-1/2 whitespace-nowrap">
                {unit.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default memo(NarrationRuler)

