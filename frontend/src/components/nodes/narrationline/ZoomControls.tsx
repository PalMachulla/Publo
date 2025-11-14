'use client'

import { memo } from 'react'
import { Button } from '@/components/ui'
import { MagnifyingGlassIcon, ZoomInIcon, ZoomOutIcon, PersonIcon } from '@radix-ui/react-icons'

export interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToView: () => void
  showAgentRows?: boolean
  onToggleAgentRows?: () => void
}

function ZoomControls({ 
  zoom, 
  onZoomIn, 
  onZoomOut, 
  onFitToView,
  showAgentRows = false,
  onToggleAgentRows
}: ZoomControlsProps) {
  const zoomPercent = Math.round(zoom * 100)
  
  return (
    <div className="flex items-center gap-2">
      {/* Zoom out */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomOut}
        className="h-7 w-7 p-0"
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOutIcon className="w-4 h-4" />
      </Button>
      
      {/* Zoom percentage */}
      <div className="text-xs font-mono text-gray-700 min-w-[3rem] text-center font-medium">
        {zoomPercent}%
      </div>
      
      {/* Zoom in */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onZoomIn}
        className="h-7 w-7 p-0"
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomInIcon className="w-4 h-4" />
      </Button>
      
      {/* Divider */}
      <div className="w-px h-5 bg-gray-200" />
      
      {/* Fit to view */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onFitToView}
        className="h-7 px-2 text-xs"
        title="Fit to view"
      >
        <MagnifyingGlassIcon className="w-3.5 h-3.5 mr-1" />
        Fit
      </Button>
      
      {/* Agent rows toggle */}
      {onToggleAgentRows && (
        <>
          {/* Divider */}
          <div className="w-px h-5 bg-gray-200" />
          
          <Button
            variant={showAgentRows ? "default" : "ghost"}
            size="sm"
            onClick={onToggleAgentRows}
            className="h-7 px-2 text-xs"
            title={showAgentRows ? 'Hide agent assignments' : 'Show agent assignments'}
          >
            <PersonIcon className="w-3.5 h-3.5 mr-1" />
            {showAgentRows ? 'Hide' : 'Show'} Agents
          </Button>
        </>
      )}
    </div>
  )
}

export default memo(ZoomControls)

