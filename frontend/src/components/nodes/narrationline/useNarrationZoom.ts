import { useState, useMemo, useCallback } from 'react'

export interface ZoomState {
  level: number           // 0.001x to 10x (0.1% to 1000%)
  pixelsPerUnit: number   // Pixels per word/unit
  visibleRange: [number, number]
}

export interface UseNarrationZoomProps {
  totalUnits: number      // Total pages or sections
  viewportWidth?: number  // Default 1200px
}

export function useNarrationZoom({ 
  totalUnits, 
  viewportWidth = 1200 
}: UseNarrationZoomProps) {
  const [zoom, setZoom] = useState(1)
  
  // Calculate pixels per unit based on zoom
  const pixelsPerUnit = useMemo(() => {
    const baseWidth = 50 // Base: 50px = 1 unit at 1x zoom
    return baseWidth * zoom
  }, [zoom])
  
  // Calculate total width of narration line
  const totalWidth = useMemo(() => {
    return totalUnits * pixelsPerUnit
  }, [totalUnits, pixelsPerUnit])
  
  // Fit entire narration to viewport
  const fitToView = useCallback(() => {
    if (totalUnits === 0) return
    // Available width = viewport - sticky label (64px) - small margin (8px)
    const availableWidth = viewportWidth - 64 - 8
    const basePixelsPerUnit = 50 // Base width per unit
    // Calculate zoom to make bars stretch exactly end-to-end
    // newZoom = availableWidth / (totalUnits * basePixelsPerUnit)
    const newZoom = availableWidth / (totalUnits * basePixelsPerUnit)
    // Allow any zoom level needed to fit - no minimum constraint
    // Only cap at maximum 10x zoom for sanity
    setZoom(Math.min(newZoom, 10))
  }, [totalUnits, viewportWidth])
  
  // Zoom to specific range
  const zoomToRange = useCallback((startUnit: number, endUnit: number) => {
    const unitRange = endUnit - startUnit
    if (unitRange === 0) return
    const newZoom = (viewportWidth - 100) / (unitRange * 50)
    setZoom(Math.max(0.1, Math.min(newZoom, 10)))
  }, [viewportWidth])
  
  // Zoom in (1.5x)
  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(z * 1.5, 10))
  }, [])
  
  // Zoom out (1.5x)
  const zoomOut = useCallback(() => {
    setZoom(z => Math.max(z / 1.5, 0.001)) // Allow zooming out to 0.1% (0.001x)
  }, [])
  
  // Set to specific zoom level
  const setZoomLevel = useCallback((level: number) => {
    setZoom(Math.max(0.001, Math.min(level, 10))) // Allow down to 0.1% (0.001x)
  }, [])
  
  return {
    zoom,
    setZoom: setZoomLevel,
    pixelsPerUnit,
    totalWidth,
    fitToView,
    zoomToRange,
    zoomIn,
    zoomOut
  }
}

