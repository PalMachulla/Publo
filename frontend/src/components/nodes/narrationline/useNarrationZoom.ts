import { useState, useMemo, useCallback } from 'react'

export interface ZoomState {
  level: number           // 0.1x to 10x
  pixelsPerUnit: number   // Pixels per page/section
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
    const newZoom = (viewportWidth - 100) / (totalUnits * 50)
    setZoom(Math.max(0.1, Math.min(newZoom, 10)))
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
    setZoom(z => Math.max(z / 1.5, 0.1))
  }, [])
  
  // Set to specific zoom level
  const setZoomLevel = useCallback((level: number) => {
    setZoom(Math.max(0.1, Math.min(level, 10)))
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

