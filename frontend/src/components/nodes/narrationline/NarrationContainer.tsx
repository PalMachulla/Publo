'use client'

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { StoryStructureItem, AgentOption } from '@/types/nodes'
import { useNarrationZoom } from './useNarrationZoom'
import { getDocumentHierarchy } from '@/lib/documentHierarchy'
import StructureTrackLane from './StructureTrackLane'
import NarrationRuler from './NarrationRuler'
import ZoomControls from './ZoomControls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from '@/components/ui'
import { ChevronDownIcon, ReaderIcon } from '@radix-ui/react-icons'

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
  onAgentAssign
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
  const [isReaderExpanded, setIsReaderExpanded] = useState(false) // Track reader view expansion
  
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
    setZoom,
    pixelsPerUnit,
    totalWidth,
    fitToView,
    zoomToSegment
  } = useNarrationZoom({ totalUnits, viewportWidth: containerWidth })
  
  const prevZoomRef = useRef(zoom) // Track previous zoom for centered zooming
  const zoomCenterUnitsRef = useRef<number | null>(null) // Lock the center point during zoom
  const mouseCenterXRef = useRef<number | null>(null) // Store mouse X position for zoom-to-cursor
  const scrollLeftAtZoomStartRef = useRef<number | null>(null) // Store scroll position when zoom starts
  const intendedScrollLeftRef = useRef<number>(0) // Track intended scroll (with decimals) to avoid rounding errors
  const isZoomingRef = useRef(false) // Track if we're in an active zoom session
  const currentZoomRef = useRef(zoom) // Track current zoom for event handler
  const accumulatedDeltaRef = useRef(0) // Accumulate tiny trackpad deltaY values
  
  // Keep zoom ref in sync
  useEffect(() => {
    currentZoomRef.current = zoom
  }, [zoom])
  
  // Add native wheel event listener to handle preventDefault properly
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        // Shift+Wheel = Zoom
        e.stopPropagation() // Prevent ReactFlow from seeing zoom events
        e.preventDefault() // Prevent scroll during zoom
        
        // Capture mouse position AND scroll position at this exact moment
        const containerRect = container.getBoundingClientRect()
        const mouseX = e.clientX - containerRect.left
        mouseCenterXRef.current = mouseX
        
        // If this is the start of a zoom session, capture scroll position
        if (!isZoomingRef.current) {
          // Initialize intended scroll position from actual (rounded) position
          intendedScrollLeftRef.current = container.scrollLeft
          scrollLeftAtZoomStartRef.current = container.scrollLeft
          
          // Debug: Check element hierarchy and computed styles
          const containerStyles = window.getComputedStyle(container)
          
          // Find what segment is actually under the mouse
          const elementsUnderMouse = document.elementsFromPoint(e.clientX, e.clientY)
          const segmentUnderMouse = elementsUnderMouse.find(el => 
            el.classList.contains('group') && el.getAttribute('title')
          )
          
          console.log('📍 Starting zoom session:', {
            scrollLeft: container.scrollLeft,
            intendedScrollLeft: intendedScrollLeftRef.current,
            mouseX,
            mouseXFromBrowserEdge: e.clientX,
            containerWidth: container.clientWidth,
            containerBoundingLeft: containerRect.left,
            segmentUnderMouse: segmentUnderMouse?.getAttribute('title'),
            containerPaddingLeft: containerStyles.paddingLeft,
            containerPaddingRight: containerStyles.paddingRight
          })
        }
        
        // Mark that we're zooming
        isZoomingRef.current = true
        
        // DEBUG: See what trackpad actually sends
        console.log('🔍 Wheel Debug:', {
          deltaY: e.deltaY,
          deltaX: e.deltaX,
          deltaMode: e.deltaMode,
          deltaModeName: e.deltaMode === 0 ? 'PIXEL' : e.deltaMode === 1 ? 'LINE' : 'PAGE',
          wheelDelta: (e as any).wheelDelta,
          detail: (e as any).detail,
          mouseX: mouseX
        })
        
        const currentZoom = currentZoomRef.current
        
        // Mac trackpads send horizontal scroll in deltaX when Shift is held
        // Use deltaX if deltaY is zero/tiny
        const primaryDelta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
        
        // Normalize based on deltaMode for consistent behavior
        let normalizedDelta = primaryDelta
        
        switch (e.deltaMode) {
          case WheelEvent.DOM_DELTA_PIXEL: // 0x00 (most common for trackpads)
            normalizedDelta = primaryDelta
            break
          case WheelEvent.DOM_DELTA_LINE: // 0x01 (mouse wheel)
            normalizedDelta = primaryDelta * 16 // Approximate line height
            break
          case WheelEvent.DOM_DELTA_PAGE: // 0x02 (rare)
            normalizedDelta = primaryDelta * (container?.clientHeight || 100)
            break
        }
        
        // Zoom speed ONLY based on scroll velocity (not affected by current zoom level)
        // Use multiplicative zoom: zoom *= (1 + factor)
        const magnitude = Math.abs(normalizedDelta)
        
        // Calculate zoom factor based purely on scroll speed
        // Slow scroll: small factor (fine control)
        // Fast scroll: large factor (rapid zoom)
        const baseSpeed = 0.001 // Base zoom factor per pixel
        const speedBoost = Math.min(magnitude / 100, 3) // Up to 3x boost for fast scrolls
        const zoomFactor = magnitude * baseSpeed * (1 + speedBoost)
        
        // Direction: negative delta = zoom in, positive = zoom out
        const direction = Math.sign(normalizedDelta)
        
        // Apply multiplicative zoom (percentage-based, consistent at all zoom levels)
        let newZoom: number
        if (direction < 0) {
          // Zoom in: multiply by (1 + factor)
          newZoom = currentZoom * (1 + zoomFactor)
        } else {
          // Zoom out: divide by (1 + factor)
          newZoom = currentZoom / (1 + zoomFactor)
        }
        
        // Clamp to valid range
        newZoom = Math.max(0.001, Math.min(10, newZoom))
        
        // Ignore if change is too small (prevents micro-jitter)
        if (Math.abs(newZoom - currentZoom) < 0.0001) {
          console.log('⏭️  Change too small, ignoring')
          return
        }
        
        console.log('✅ Applying zoom:', { 
          oldZoom: currentZoom, 
          newZoom, 
          change: ((newZoom / currentZoom - 1) * 100).toFixed(1) + '%',
          magnitude,
          zoomFactor: zoomFactor.toFixed(4),
          direction: direction < 0 ? 'IN' : 'OUT',
          usedDeltaX: Math.abs(e.deltaX) > Math.abs(e.deltaY)
        })
        
        setZoom(newZoom)
      } else {
        // Regular wheel: Convert vertical scroll to horizontal pan
        e.preventDefault() // Prevent page scroll
        e.stopPropagation() // Prevent ReactFlow from seeing it
        
        // Use deltaY for vertical wheel or deltaX for horizontal trackpad scroll
        const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX
        
        // Update scroll position
        const newScrollLeft = container.scrollLeft + scrollAmount
        container.scrollLeft = newScrollLeft
        
        console.log('🖱️ Panning timeline:', {
          deltaY: e.deltaY,
          deltaX: e.deltaX,
          scrollAmount,
          oldScrollLeft: container.scrollLeft - scrollAmount,
          newScrollLeft: container.scrollLeft
        })
      }
    }

    // Use native listener WITHOUT capture - let browser handle scroll naturally
    // Only intercept when we actually need to (Shift+Wheel)
    container.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [setZoom])
  
  // Fit to view on mount and when items change
  useEffect(() => {
    if (items.length > 0) {
      // Small delay to ensure content is rendered
      setTimeout(() => {
        fitToView()
      }, 100)
    }
  }, [items, fitToView])
  
  // Auto-fit when container width changes (window resize, node resize, etc.)
  useEffect(() => {
    if (!containerRef.current || items.length === 0) return
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Debounce: only fit if width actually changed
        const newWidth = entry.contentRect.width
        if (Math.abs(newWidth - containerWidth) > 5) {
          fitToView()
        }
      }
    })
    
    resizeObserver.observe(containerRef.current)
    
    return () => resizeObserver.disconnect()
  }, [items.length, containerWidth, fitToView])
  
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
  
  // Handle segment single click - just mark/focus it
  const handleSegmentClick = useCallback((item: StoryStructureItem) => {
    console.log('Segment clicked (focus only):', item.name)
    setFocusedSegmentId(item.id)
  }, [])
  
  // Handle segment double click - zoom to segment and focus it
  const handleSegmentDoubleClick = useCallback((item: StoryStructureItem) => {
    const { startPos, width: wordCount } = calculateSegmentMetrics(item)
    
    console.log('Segment double-clicked (zoom):', {
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
  
  // Handle edit icon click - open AIDocument Panel with this segment's structure
  const handleEditSegment = useCallback((item: StoryStructureItem, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering segment click/zoom
    setFocusedSegmentId(item.id) // Focus the segment
    
    console.log('✏️ Edit button clicked:', {
      itemName: item.name,
      itemId: item.id,
      wordCount: item.wordCount,
      hasOnItemClick: !!onItemClick,
      allItems: items.length
    })
    
    // Open AIDocument Panel with the structure
    if (onItemClick) {
      onItemClick(item)
    } else {
      console.warn('⚠️ No onItemClick handler available!')
    }
  }, [onItemClick, items])
  
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
  
  // Centered zoom: adjust scroll position when zoom changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const prevZoom = prevZoomRef.current
    if (prevZoom === zoom) {
      // Zoom hasn't changed, we're done zooming
      isZoomingRef.current = false
      return
    }
    
    // Mark that we're in an active zoom session
    if (!isZoomingRef.current) {
      isZoomingRef.current = true
    }
    
    // Use mouse cursor position as zoom center (zoom-to-cursor behavior)
    const stickyLabelWidth = 64 // w-16
    // NOTE: Segments are positioned inside a pl-2 container, so their left values
    // are ALREADY relative to that padding. We should NOT subtract it here!
    const totalLeftOffset = stickyLabelWidth // Just the sticky label, not padding
    
    // Get the mouse X position relative to the content area (excluding sticky label)
    const mouseX = mouseCenterXRef.current || (container.clientWidth / 2)
    const contentMouseX = mouseX - totalLeftOffset
    
    // If this is the first zoom change in a sequence, capture the center point ONCE
    if (zoomCenterUnitsRef.current === null) {
      // Use the INTENDED scroll position (with decimals) to avoid rounding errors
      const startScrollLeft = intendedScrollLeftRef.current
      const mouseContentPosition = startScrollLeft + contentMouseX
      zoomCenterUnitsRef.current = mouseContentPosition / (50 * prevZoom)
      
      console.log('🔒 Locking zoom center:', {
        mouseX,
        stickyLabelWidth,
        totalLeftOffset: totalLeftOffset,
        contentMouseX,
        startScrollLeft,
        intendedScrollLeft: intendedScrollLeftRef.current,
        mouseContentPosition,
        centerUnits: zoomCenterUnitsRef.current,
        prevZoom,
        calculatedPixelPosition: zoomCenterUnitsRef.current * 50 * prevZoom,
        NOTE: 'Changed totalLeftOffset from 72px to 64px - segments are already relative to pl-2 padding'
      })
    }
    
    // Use the locked center point throughout the entire zoom session
    const centerUnits = zoomCenterUnitsRef.current
    
    // Calculate where this unit should be in pixels at the new zoom
    const newCenterContentPosition = centerUnits * 50 * zoom
    const newScrollLeft = newCenterContentPosition - contentMouseX
    
    const oldIntendedScrollLeft = intendedScrollLeftRef.current
    
    console.log('🎯 Applying zoom-to-cursor:', {
      direction: zoom > prevZoom ? '🔍 ZOOM IN' : '🔎 ZOOM OUT',
      centerUnits,
      prevZoom,
      newZoom: zoom,
      zoomRatio: zoom / prevZoom,
      newCenterContentPosition,
      contentMouseX,
      oldIntendedScrollLeft,
      newScrollLeft,
      scrollDelta: newScrollLeft - oldIntendedScrollLeft
    })
    
    // Store the intended position (with full decimal precision)
    intendedScrollLeftRef.current = Math.max(0, newScrollLeft)
    
    // Apply to browser (will be rounded to integer)
    container.scrollLeft = intendedScrollLeftRef.current
    
    // Log the actual result after setting
    requestAnimationFrame(() => {
      console.log('✨ After scroll set:', {
        intendedScrollLeft: intendedScrollLeftRef.current,
        actualScrollLeft: container.scrollLeft,
        roundingError: container.scrollLeft - intendedScrollLeftRef.current
      })
    })
    
    // Update prev zoom for next iteration
    prevZoomRef.current = zoom
  }, [zoom])
  
  // Clear the locked center point when zoom stabilizes (after user stops scrolling)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isZoomingRef.current) {
        console.log('🔓 Unlocking zoom center')
        isZoomingRef.current = false
        zoomCenterUnitsRef.current = null
        mouseCenterXRef.current = null
        scrollLeftAtZoomStartRef.current = null
        // Reset intended scroll to actual (for next zoom session)
        if (containerRef.current) {
          intendedScrollLeftRef.current = containerRef.current.scrollLeft
        }
      }
    }, 200) // Clear after 200ms of no zoom changes
    
    return () => clearTimeout(timer)
  }, [zoom])
  
  return (
    <div 
      className={`nodrag nopan relative mx-auto bg-white border border-gray-200 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      style={{ 
        width: containerWidth,
        boxShadow: 'var(--brand-shadow-md)',
        overflow: 'visible',
        borderRadius: '0.75rem', // rounded-xl equivalent
        touchAction: 'none' // Prevent touch gestures from reaching ReactFlow
      }}
      data-nodrag="true"
      onClick={(e) => e.stopPropagation()} // Prevent clicks from opening the side panel
      // Note: onMouseDownCapture removed to allow segment clicks to work
      // ReactFlow interference is prevented by nodrag/nopan classes and our wheel handler
    >
      {/* Left resize handle */}
      <div
        data-nodrag="true"
        className={`noDrag nodrag nopan absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-50 group ${isResizing ? 'bg-yellow-400/50' : 'hover:bg-amber-100/80'} transition-colors rounded-l-xl`}
        onMouseDownCapture={(e) => {
          e.stopPropagation()
          handleResizeStart(e, 'left')
        }}
        onMouseMoveCapture={(e) => e.stopPropagation()}
        onMouseUpCapture={(e) => e.stopPropagation()}
        onClickCapture={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        title="Drag to resize"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
      
      {/* Main content container */}
      <div className="w-full" style={{ overflow: 'visible' }}>
        {/* Header with controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 rounded-t-xl">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Narration Arrangement View
            </h3>
            
            {/* Level selector - only show if format has more than 3 levels */}
            {maxAvailableLevels > 3 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-500">Levels:</Label>
                <Select
                  value={maxVisibleLevels.toString()}
                  onValueChange={(value) => setMaxVisibleLevels(Number(value))}
                >
                  <SelectTrigger className="h-7 w-16 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxAvailableLevels }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-gray-400">of {maxAvailableLevels}</span>
              </div>
            )}
          </div>
          <ZoomControls
            zoom={zoom}
            onZoomChange={setZoom}
            onFitToView={() => {
              fitToView()
              setFocusedSegmentId(null) // Clear focus when fitting to view
            }}
          />
        </div>
        
        {/* Reader View - Expandable text preview */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setIsReaderExpanded(!isReaderExpanded)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50/50 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <ReaderIcon className="w-4 h-4 text-gray-600 group-hover:text-yellow-600 transition-colors" />
              <span className="text-xs font-medium text-gray-700">Reader View</span>
              <span className="text-xs text-gray-400">(Coming soon: Summarized segment text)</span>
            </div>
            <ChevronDownIcon 
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                isReaderExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          
          {/* Expandable content area */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isReaderExpanded ? 'max-h-96' : 'max-h-0'
            }`}
          >
            <div className="px-4 py-4 bg-gray-50/30">
              <div className="bg-white rounded-lg border border-gray-200 p-4 min-h-[200px] max-h-80 overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-500 italic text-center py-8">
                    Select a segment to view its content here.<br />
                    <span className="text-xs">Future: Auto-summarize all visible segments</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Ruler */}
        <NarrationRuler
          totalUnits={totalUnits}
          pixelsPerUnit={pixelsPerUnit}
          unitLabel={unitLabel}
          scrollLeft={scrollLeft}
        />
        
        {/* Scrollable viewport - horizontal scroll when content is wider than container */}
        <div
          ref={containerRef}
          className="nodrag nopan relative overflow-x-auto overflow-y-auto bg-white narration-scrollbar"
          style={{ 
            maxHeight: '300px',
            overscrollBehavior: 'contain', // Prevent scroll chaining to ReactFlow
            scrollBehavior: 'auto',
            touchAction: 'none' // Prevent touch gestures
          }}
          onMouseDownCapture={(e) => {
            e.stopPropagation()
            if (e.shiftKey) {
              e.preventDefault() // Prevent text selection during zoom
            }
          }}
          onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
          onClick={(e) => {
            // Clear focus if clicking on background (not on a segment)
            const target = e.target as HTMLElement
            if (target === e.currentTarget || target.classList.contains('narration-content-area')) {
              setFocusedSegmentId(null)
            }
          }}
        >
          <div className="narration-content-area" style={{ 
            width: `max(100%, ${totalWidth}px)`, // Fill viewport OR content width, whichever is larger
            minWidth: `max(100%, ${totalWidth}px)`, // Ensure scrollbar appears when needed
            overflow: 'visible',
            position: 'relative', // Ensure it's positioned relative for absolute children
            left: 0, // Explicitly anchor to left edge
            display: 'block' // Ensure block layout
          }}>
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
                onItemDoubleClick={handleSegmentDoubleClick}
                onEditItem={handleEditSegment}
                onColorChange={handleColorChange}
                levelName={getLevelName(level)}
                availableAgents={availableAgents}
                onAgentAssign={onAgentAssign}
              />
            ))}
            
            {/* Empty state if no items */}
            {items.length === 0 && (
              <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
                No structure items yet
              </div>
            )}
            
            {/* Placeholder rows - Carrier */}
            <div 
              className="relative bg-gray-50/50 border-b border-gray-100 flex"
              style={{ height: 32, width: '100%', minWidth: '100%' }}
            >
              {/* Label - sticky/fixed */}
              <div className="sticky left-0 w-16 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-40 flex-shrink-0">
                <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide truncate px-1 text-center">Carrier</span>
              </div>
              
              {/* Content area - empty for now */}
              <div className="relative flex-1 h-full overflow-visible">
                {/* Placeholder - will add functionality later */}
              </div>
            </div>
            
            {/* Placeholder rows - Sentiment */}
            <div 
              className="relative bg-gray-50/50 border-b border-gray-100 flex"
              style={{ height: 32, width: '100%', minWidth: '100%' }}
            >
              {/* Label - sticky/fixed */}
              <div className="sticky left-0 w-16 h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center z-40 flex-shrink-0">
                <span className="text-[10px] text-gray-600 font-medium uppercase tracking-wide truncate px-1 text-center">Sentiment</span>
              </div>
              
              {/* Content area - empty for now */}
              <div className="relative flex-1 h-full overflow-visible">
                {/* Placeholder - will add functionality later */}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer with controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <div className="text-xs text-gray-500">
            {/* Placeholder for future buttons/controls */}
          </div>
          <div className="flex items-center gap-2 h-16">
            {/* Placeholder for future actions */}
          </div>
        </div>
      </div>
      
      {/* Right resize handle */}
      <div
        data-nodrag="true"
        className={`noDrag nodrag nopan absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-50 group ${isResizing ? 'bg-yellow-400/50' : 'hover:bg-amber-100/80'} transition-colors rounded-r-xl`}
        onMouseDownCapture={(e) => {
          e.stopPropagation()
          handleResizeStart(e, 'right')
        }}
        onMouseMoveCapture={(e) => e.stopPropagation()}
        onMouseUpCapture={(e) => e.stopPropagation()}
        onClickCapture={(e) => e.stopPropagation()}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        title="Drag to resize"
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>
    </div>
  )
}

export default memo(NarrationContainer)

