'use client'

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { StoryStructureItem, AgentOption } from '@/types/nodes'
import { useNarrationZoom } from './useNarrationZoom'
import { getDocumentHierarchy } from '@/lib/documentHierarchy'
import StructureTrackLane from './StructureTrackLane'
import NarrationRuler from './NarrationRuler'
import ZoomControls from './ZoomControls'

export interface NarrationContainerProps {
  items: StoryStructureItem[]
  activeItemId?: string
  onItemClick: (item: StoryStructureItem) => void
  onItemsChange?: (items: StoryStructureItem[]) => void // Callback to update items
  unitLabel?: string
  isLoading?: boolean
  initialWidth?: number
  onWidthChange?: (width: number) => void
  format?: string // Story format to determine hierarchy level names
  availableAgents?: AgentOption[]
  onAgentAssign?: (itemId: string, agentId: string | null) => void
  showAgentRows?: boolean
  onToggleAgentRows?: () => void
}

function NarrationContainer({
  items,
  activeItemId,
  onItemClick,
  onItemsChange,
  unitLabel = 'Pages',
  isLoading = false,
  initialWidth = 1200,
  onWidthChange,
  format,
  availableAgents = [],
  onAgentAssign,
  showAgentRows = false,
  onToggleAgentRows
}: NarrationContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeDirection = useRef<'left' | 'right'>('right')
  const [maxVisibleLevels, setMaxVisibleLevels] = useState(3) // Default to 3 levels
  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null) // Track zoomed segment
  const [scrollLeft, setScrollLeft] = useState(0) // Track scroll position for ruler
  
  // Calculate total word count from Level 1 items only
  // Level 1 represents the max extent (e.g., Season with 1000 words)
  // Lower levels (Episodes, Segments) are subdivisions within that total
  const totalWords = useMemo(() => {
    if (items.length === 0) return 10000 // Default 10k words
    
    // Sum up only level 1 items - they define the total extent
    const level1Items = items.filter(item => item.level === 1)
    if (level1Items.length === 0) return 10000 // Fallback if no level 1 items
    
    const calculated = level1Items.reduce((sum, item) => {
      return sum + (item.wordCount || 1000) // Default 1000 words per section
    }, 0)
    
    return Math.max(calculated, 1000) // Minimum 1000 words
  }, [items])
  
  const totalUnits = totalWords
  
  const {
    zoom,
    pixelsPerUnit,
    totalWidth,
    fitToView,
    zoomToSegment,
    zoomIn,
    zoomOut
  } = useNarrationZoom({ totalUnits, viewportWidth: containerWidth })
  
  // Fit to view on mount and when items change
  useEffect(() => {
    if (items.length > 0) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        fitToView()
      }, 100)
    }
  }, [items, fitToView])
  
  // Get unique levels present in items
  const allLevels = Array.from(new Set(items.map(i => i.level))).sort()
  
  // Get hierarchy level names based on format
  const hierarchy = format ? getDocumentHierarchy(format) : null
  const maxAvailableLevels = hierarchy ? hierarchy.length : 3
  
  // Filter levels to show based on user selection
  const levels = allLevels.filter(level => level <= maxVisibleLevels)
  const getLevelName = (level: number): string | undefined => {
    if (!hierarchy || level > hierarchy.length) return undefined
    return hierarchy[level - 1]?.name
  }
  
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
  
  // Calculate segment's start position and width in words within the timeline
  const calculateSegmentMetrics = useCallback((item: StoryStructureItem): { startPos: number; width: number } => {
    // If explicitly set, use it
    if (item.startPosition !== undefined && item.startPosition !== null) {
      return { startPos: item.startPosition, width: item.wordCount || 1000 }
    }
    
    let startPos = 0
    let width = item.wordCount || 1000
    
    if (item.parentId) {
      // This is a child item - calculate parent's metrics first
      const parent = items.find(i => i.id === item.parentId)
      if (parent) {
        const parentMetrics = calculateSegmentMetrics(parent) // Recursive call for parent
        startPos = parentMetrics.startPos
        
        // Get siblings and find this item's index
        const siblings = items
          .filter(i => i.parentId === item.parentId && i.level === item.level)
          .sort((a, b) => a.order - b.order)
        
        const siblingIndex = siblings.findIndex(s => s.id === item.id)
        // Child items divide parent's width equally
        width = parentMetrics.width / siblings.length
        startPos += siblingIndex * width
      }
    } else {
      // Top-level item - sum previous siblings' word counts
      const topLevelSiblings = items
        .filter(i => !i.parentId && i.level === item.level)
        .sort((a, b) => a.order - b.order)
      
      const siblingIndex = topLevelSiblings.findIndex(s => s.id === item.id)
      for (let i = 0; i < siblingIndex; i++) {
        startPos += (topLevelSiblings[i].wordCount || 1000)
      }
    }
    
    return { startPos, width }
  }, [items])
  
  // Handle segment click - zoom to segment and focus it
  const handleSegmentClick = useCallback((item: StoryStructureItem) => {
    const { startPos, width: wordCount } = calculateSegmentMetrics(item)
    
    console.log('Segment clicked:', {
      name: item.name,
      level: item.level,
      startPos,
      wordCount,
      parentId: item.parentId
    })
    
    // Zoom to fit this segment in the viewport (returns the new zoom level)
    const newZoom = zoomToSegment(startPos, wordCount)
    
    console.log('Zoom calculated:', { newZoom, pixelsPerUnit: 50 * newZoom })
    
    // Set as focused segment
    setFocusedSegmentId(item.id)
    
    // Scroll to position segment at left edge (x=0) after zoom applies
    setTimeout(() => {
      if (!containerRef.current || !newZoom) return
      
      // Calculate NEW pixelsPerUnit based on the zoom that was just set
      const baseWidth = 50 // Must match the base in useNarrationZoom
      const newPixelsPerUnit = baseWidth * newZoom
      
      // Calculate segment start position in pixels with the NEW pixelsPerUnit
      const segmentPixelStart = startPos * newPixelsPerUnit
      
      // No padding to account for now
      const scrollPosition = Math.max(0, segmentPixelStart)
      
      console.log('Scrolling to:', {
        segmentPixelStart,
        scrollPosition,
        viewportWidth: containerRef.current.offsetWidth
      })
      
      // Scroll to position the segment at the left edge
      containerRef.current.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      })
    }, 50)
  }, [zoomToSegment, calculateSegmentMetrics])
  
  // Handle edit icon click - open panel
  const handleEditSegment = useCallback((item: StoryStructureItem, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering segment click/zoom
    onItemClick(item) // This opens the AI Document Panel
  }, [onItemClick])
  
  // Handle color change for a segment and propagate to descendants
  const handleColorChange = useCallback((itemId: string, color: string | null) => {
    if (!onItemsChange) return
    
    // Find all descendants of this item
    const findDescendants = (parentId: string): string[] => {
      const children = items.filter(item => item.parentId === parentId)
      return [
        ...children.map(child => child.id),
        ...children.flatMap(child => findDescendants(child.id))
      ]
    }
    
    const descendantIds = findDescendants(itemId)
    
    // Helper function to lighten a hex color
    const lightenColor = (hex: string, depth: number): string => {
      // Remove # if present
      const cleanHex = hex.replace('#', '')
      
      // Parse RGB
      const r = parseInt(cleanHex.substr(0, 2), 16)
      const g = parseInt(cleanHex.substr(2, 2), 16)
      const b = parseInt(cleanHex.substr(4, 2), 16)
      
      // Gradually lighten based on depth (blend towards white)
      // depth 1: 70% color + 30% white
      // depth 2: 50% color + 50% white
      // depth 3+: 30% color + 70% white
      const factor = depth === 1 ? 0.3 : depth === 2 ? 0.5 : 0.7
      
      const newR = Math.round(r + (255 - r) * factor)
      const newG = Math.round(g + (255 - g) * factor)
      const newB = Math.round(b + (255 - b) * factor)
      
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
    }
    
    // Calculate depth for each descendant
    const getDepthFromAncestor = (childId: string): number => {
      let depth = 0
      let currentId = childId
      
      while (currentId !== itemId) {
        const parent = items.find(item => item.id === currentId)
        if (!parent || !parent.parentId) break
        depth++
        currentId = parent.parentId
      }
      
      return depth
    }
    
    // Update items with new colors
    const updatedItems = items.map(item => {
      if (item.id === itemId) {
        // Update the source item's color
        return { ...item, backgroundColor: color || undefined }
      }
      
      if (descendantIds.includes(item.id) && color) {
        // Update descendants with progressively lighter colors
        const depth = getDepthFromAncestor(item.id)
        return { ...item, backgroundColor: lightenColor(color, depth) }
      }
      
      // If clearing color, also clear descendant colors
      if (descendantIds.includes(item.id) && !color) {
        return { ...item, backgroundColor: undefined }
      }
      
      return item
    })
    
    onItemsChange(updatedItems)
  }, [items, onItemsChange])
  
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
      className={`relative mx-auto rounded-2xl bg-gray-400 shadow-lg overflow-hidden border-2 border-gray-400 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ width: containerWidth }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        // Allow the event to bubble if not resizing, but prevent opening panel
        if (!isResizing) {
          e.stopPropagation()
        }
      }}
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
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-600 font-medium">
              Narration Line
            </div>
            
            {/* Level selector - only show if format has more than 3 levels */}
            {maxAvailableLevels > 3 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Levels:</span>
                <select
                  value={maxVisibleLevels}
                  onChange={(e) => setMaxVisibleLevels(Number(e.target.value))}
                  className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 cursor-pointer transition-colors"
                >
                  {Array.from({ length: maxAvailableLevels }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">of {maxAvailableLevels}</span>
              </div>
            )}
          </div>
          <ZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onFitToView={() => {
              fitToView()
              setFocusedSegmentId(null) // Clear focus when fitting to view
            }}
            showAgentRows={showAgentRows}
            onToggleAgentRows={onToggleAgentRows}
          />
        </div>
        
        {/* Ruler */}
        <NarrationRuler
          totalUnits={totalUnits}
          pixelsPerUnit={pixelsPerUnit}
          unitLabel={unitLabel}
          scrollLeft={scrollLeft}
        />
        
        {/* Scrollable viewport - horizontal scroll when content is wider than container */}
        <style>{`
          .narration-scrollbar::-webkit-scrollbar {
            height: 14px;
          }
          .narration-scrollbar::-webkit-scrollbar-track {
            background: #f3f4f6;
            border-radius: 8px;
          }
          .narration-scrollbar::-webkit-scrollbar-thumb {
            background: #9ca3af;
            border-radius: 8px;
            border: 2px solid #f3f4f6;
          }
          .narration-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #6b7280;
          }
        `}</style>
        <div
          ref={containerRef}
          className="narration-scrollbar relative overflow-x-auto overflow-y-hidden bg-gray-50"
          style={{ maxHeight: '300px' }}
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
          onClick={(e) => {
            // Clear focus if clicking on background (not on a segment)
            const target = e.target as HTMLElement
            if (target === e.currentTarget || target.classList.contains('narration-content-area')) {
              setFocusedSegmentId(null)
            }
          }}
        >
          <div className="narration-content-area" style={{ width: Math.max(totalWidth, containerWidth - 64) }}>
            {/* Structure tracks */}
            {levels.map((level) => (
              <StructureTrackLane
                key={level}
                level={level}
                items={items}
                pixelsPerUnit={pixelsPerUnit}
                totalUnits={totalUnits}
                activeItemId={activeItemId}
                focusedItemId={focusedSegmentId}
                onItemClick={handleSegmentClick}
                onEditItem={handleEditSegment}
                onColorChange={handleColorChange}
                levelName={getLevelName(level)}
                showAgentRows={showAgentRows}
                availableAgents={availableAgents}
                onAgentAssign={onAgentAssign}
              />
            ))}
            
            {/* Empty state if no items */}
            {items.length === 0 && (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                No structure items yet
              </div>
            )}
            
            {/* Placeholder rows - Carrier */}
            <div 
              className="relative w-full bg-gray-50 border-b border-gray-200 flex"
              style={{ height: 32 }}
            >
              {/* Label - sticky/fixed */}
              <div className="sticky left-0 w-16 h-full bg-gray-100 border-r border-gray-200 border-b border-gray-200 flex items-center justify-center z-40 shadow-sm flex-shrink-0">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide truncate px-1 text-center">Carrier</span>
              </div>
              
              {/* Content area - empty for now */}
              <div className="relative flex-1 h-full overflow-visible">
                {/* Placeholder - will add functionality later */}
              </div>
            </div>
            
            {/* Placeholder rows - Sentiment */}
            <div 
              className="relative w-full bg-gray-50 border-b border-gray-200 flex"
              style={{ height: 32 }}
            >
              {/* Label - sticky/fixed */}
              <div className="sticky left-0 w-16 h-full bg-gray-100 border-r border-gray-200 border-b border-gray-200 flex items-center justify-center z-40 shadow-sm flex-shrink-0">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide truncate px-1 text-center">Sentiment</span>
              </div>
              
              {/* Content area - empty for now */}
              <div className="relative flex-1 h-full overflow-visible">
                {/* Placeholder - will add functionality later */}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer with controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-t border-gray-200">
          <div className="text-xs text-gray-600 font-medium">
            {/* Placeholder for future buttons/controls */}
          </div>
          <div className="flex items-center gap-2">
            {/* Placeholder for future actions */}
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

