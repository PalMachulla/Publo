'use client'

import { memo } from 'react'

export interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToView: () => void
}

function ZoomControls({ 
  zoom, 
  onZoomIn, 
  onZoomOut, 
  onFitToView 
}: ZoomControlsProps) {
  const zoomPercent = Math.round(zoom * 100)
  
  return (
    <div className="flex items-center gap-2">
      {/* Zoom out */}
      <button
        onClick={onZoomOut}
        className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
        </svg>
      </button>
      
      {/* Zoom percentage */}
      <div className="text-xs font-mono text-gray-600 min-w-[3rem] text-center">
        {zoomPercent}%
      </div>
      
      {/* Zoom in */}
      <button
        onClick={onZoomIn}
        className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
      </button>
      
      {/* Divider */}
      <div className="w-px h-5 bg-gray-300" />
      
      {/* Fit to view */}
      <button
        onClick={onFitToView}
        className="px-2 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors text-xs font-medium"
        title="Fit to view"
      >
        Fit
      </button>
    </div>
  )
}

export default memo(ZoomControls)

