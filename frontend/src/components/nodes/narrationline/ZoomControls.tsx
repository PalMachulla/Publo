'use client'

import { memo } from 'react'
import { Button, Slider } from '@/components/ui'
import { MagnifyingGlassIcon, ZoomOutIcon, ZoomInIcon } from '@radix-ui/react-icons'

export interface ZoomControlsProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  onFitToView: () => void
}

function ZoomControls({ 
  zoom, 
  onZoomChange,
  onFitToView
}: ZoomControlsProps) {
  // Convert zoom to logarithmic slider value (0.001 to 10 -> -3 to 1)
  const zoomToSlider = (z: number) => Math.log10(z)
  // Convert slider value back to zoom
  const sliderToZoom = (s: number) => Math.pow(10, s)
  
  const handleSliderChange = (value: number[]) => {
    const newZoom = sliderToZoom(value[0])
    onZoomChange(newZoom)
  }
  
  return (
    <div className="flex items-center gap-2">
      {/* Zoom out icon */}
      <ZoomOutIcon className="w-4 h-4 text-gray-500" />
      
      {/* Zoom slider */}
      <div className="w-32">
        <Slider
          value={[zoomToSlider(zoom)]}
          onValueChange={handleSliderChange}
          min={-3}  // 10^-3 = 0.001 (0.1%)
          max={1}   // 10^1 = 10 (1000%)
          step={0.01}
          className="cursor-pointer"
          aria-label="Zoom level"
        />
      </div>
      
      {/* Zoom in icon */}
      <ZoomInIcon className="w-4 h-4 text-gray-500" />
      
      {/* Divider */}
      <div className="w-px h-5 bg-gray-200 ml-1" />
      
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
    </div>
  )
}

export default memo(ZoomControls)

