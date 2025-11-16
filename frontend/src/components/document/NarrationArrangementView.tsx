'use client'

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { StoryStructureItem } from '@/types/nodes'
import { DocumentSection } from '@/types/document'
import { useNarrationZoom } from '../nodes/narrationline/useNarrationZoom'
import { getDocumentHierarchy } from '@/lib/documentHierarchy'
import StructureTrackLane from '../nodes/narrationline/StructureTrackLane'
import NarrationRuler from '../nodes/narrationline/NarrationRuler'
import ZoomControls from '../nodes/narrationline/ZoomControls'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Label } from '@/components/ui'
import { ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons'
import type { Edge, Node } from 'reactflow'

export interface NarrationArrangementViewProps {
  sections: DocumentSection[]
  structureItems: StoryStructureItem[]
  activeSectionId: string | null
  onSectionClick: (section: DocumentSection) => void
  format?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  canvasEdges?: Edge[]
  canvasNodes?: Node[]
}

function NarrationArrangementView({
  sections,
  structureItems,
  activeSectionId,
  onSectionClick,
  format,
  isCollapsed = false,
  onToggleCollapse,
  canvasEdges = [],
  canvasNodes = [],
}: NarrationArrangementViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [maxVisibleLevels, setMaxVisibleLevels] = useState(3)
  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null)
  const [scrollLeft, setScrollLeft] = useState(0)

  // Calculate total word count from Level 1 items
  const totalWords = useMemo(() => {
    if (structureItems.length === 0) return 10000
    const level1Items = structureItems.filter(item => item.level === 1)
    if (level1Items.length === 0) return 10000
    const calculated = level1Items.reduce((sum, item) => sum + (item.wordCount || 1000), 0)
    return Math.max(calculated, 1000)
  }, [structureItems])

  const totalUnits = totalWords
  const unitLabel = 'Words'

  // Use zoom hook
  const { zoom, setZoom, pixelsPerUnit, totalWidth, fitToView, zoomToSegment } = useNarrationZoom({
    totalUnits,
    viewportWidth: containerRef.current?.clientWidth || 1200,
  })

  // Fit to view on mount
  useEffect(() => {
    if (structureItems.length > 0 && !isCollapsed) {
      setTimeout(() => fitToView(), 100)
    }
  }, [structureItems, fitToView, isCollapsed])

  // Handle section click
  const handleSegmentClick = useCallback((item: StoryStructureItem) => {
    const section = sections.find(s => s.structure_item_id === item.id)
    if (section) {
      setFocusedSegmentId(item.id)
      onSectionClick(section)
    }
  }, [sections, onSectionClick])

  // Handle zoom to segment
  const handleSegmentDoubleClick = useCallback((item: StoryStructureItem) => {
    zoomToSegment(item.id, structureItems)
  }, [zoomToSegment, structureItems])

  // Calculate connection counts
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    if (!canvasEdges || !canvasNodes) return counts

    structureItems.forEach(item => {
      const count = canvasEdges.filter(edge =>
        edge.targetHandle === item.id ||
        edge.target.includes(item.id)
      ).length
      if (count > 0) {
        counts.set(item.id, count)
      }
    })

    return counts
  }, [canvasEdges, canvasNodes, structureItems])

  // Get unique levels
  const allLevels = Array.from(new Set(structureItems.map(i => i.level))).sort()
  const hierarchy = format ? getDocumentHierarchy(format) : null
  const maxAvailableLevels = hierarchy ? hierarchy.length : 3
  const levels = allLevels.filter(level => level <= maxVisibleLevels)

  const getLevelName = (level: number): string | undefined => {
    if (!hierarchy || level > hierarchy.length) return undefined
    return hierarchy[level - 1]?.name
  }

  // Handle wheel events for zoom
  const prevZoomRef = useRef(zoom)
  const zoomCenterUnitsRef = useRef<number | null>(null)
  const mouseCenterXRef = useRef<number | null>(null)
  const scrollLeftAtZoomStartRef = useRef<number>(0)
  const isZoomingRef = useRef(false)
  const currentZoomRef = useRef(zoom)
  const intendedScrollLeftRef = useRef<number>(0)

  useEffect(() => {
    currentZoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()

        const containerRect = container.getBoundingClientRect()
        const mouseX = e.clientX - containerRect.left
        mouseCenterXRef.current = mouseX

        if (!isZoomingRef.current) {
          intendedScrollLeftRef.current = container.scrollLeft
          scrollLeftAtZoomStartRef.current = container.scrollLeft
        }

        isZoomingRef.current = true

        const currentZoom = currentZoomRef.current
        const primaryDelta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX

        let normalizedDelta = primaryDelta
        switch (e.deltaMode) {
          case WheelEvent.DOM_DELTA_LINE:
            normalizedDelta = primaryDelta * 16
            break
          case WheelEvent.DOM_DELTA_PAGE:
            normalizedDelta = primaryDelta * (container?.clientHeight || 100)
            break
        }

        const magnitude = Math.abs(normalizedDelta)
        const baseSpeed = 0.001
        const speedBoost = Math.min(magnitude / 100, 3)
        const zoomFactor = magnitude * baseSpeed * (1 + speedBoost)
        const direction = Math.sign(normalizedDelta)

        let newZoom: number
        if (direction < 0) {
          newZoom = currentZoom * (1 + zoomFactor)
        } else {
          newZoom = currentZoom / (1 + zoomFactor)
        }

        newZoom = Math.max(0.001, Math.min(10, newZoom))

        if (Math.abs(newZoom - currentZoom) >= 0.0001) {
          setZoom(newZoom)
        }
      } else {
        e.preventDefault()
        e.stopPropagation()
        const scrollAmount = e.deltaY !== 0 ? e.deltaY : e.deltaX
        container.scrollLeft += scrollAmount
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [setZoom])

  // Centered zoom logic
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const prevZoom = prevZoomRef.current
    if (prevZoom === zoom) {
      isZoomingRef.current = false
      return
    }

    if (!isZoomingRef.current) {
      isZoomingRef.current = true
    }

    const stickyLabelWidth = 64
    const totalLeftOffset = stickyLabelWidth
    const mouseX = mouseCenterXRef.current || (container.clientWidth / 2)
    const contentMouseX = mouseX - totalLeftOffset

    if (zoomCenterUnitsRef.current === null) {
      const startScrollLeft = intendedScrollLeftRef.current
      const mouseContentPosition = startScrollLeft + contentMouseX
      const centerUnits = mouseContentPosition / (prevZoom * 50)
      zoomCenterUnitsRef.current = centerUnits
    }

    const centerUnits = zoomCenterUnitsRef.current
    const newContentPosition = centerUnits * zoom * 50
    const newScrollLeft = newContentPosition - contentMouseX

    requestAnimationFrame(() => {
      intendedScrollLeftRef.current = newScrollLeft
      container.scrollLeft = Math.round(newScrollLeft)
    })

    prevZoomRef.current = zoom
  }, [zoom])

  // Clear zoom lock
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isZoomingRef.current) {
        zoomCenterUnitsRef.current = null
        mouseCenterXRef.current = null
        isZoomingRef.current = false
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [zoom])

  return (
    <div className="border-t-2 border-gray-300 bg-white">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title={isCollapsed ? "Expand view" : "Collapse view"}
          >
            {isCollapsed ? (
              <ChevronUpIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
          <h3 className="text-sm font-semibold text-gray-900">Narration Arrangement View</h3>
          <span className="text-xs text-gray-500">
            {totalWords.toLocaleString()}w • {structureItems.length} sections
          </span>
        </div>

        {!isCollapsed && (
          <div className="flex items-center gap-3">
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

            <ZoomControls
              zoom={zoom}
              onZoomChange={setZoom}
              onFitToView={() => {
                fitToView()
                setFocusedSegmentId(null)
              }}
            />
          </div>
        )}
      </div>

      {/* Timeline Content */}
      {!isCollapsed && (
        <div className="relative bg-white" style={{ height: 250 }}>
          {/* Ruler */}
          <NarrationRuler
            totalUnits={totalUnits}
            pixelsPerUnit={pixelsPerUnit}
            unitLabel={unitLabel}
            scrollLeft={scrollLeft}
          />

          {/* Scrollable viewport */}
          <div
            ref={containerRef}
            className="nodrag nopan relative overflow-x-auto overflow-y-auto bg-white narration-scrollbar"
            style={{
              maxHeight: '200px',
              overscrollBehavior: 'contain',
              scrollBehavior: 'auto',
              touchAction: 'none'
            }}
            onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
            onClick={(e) => {
              const target = e.target as HTMLElement
              if (target === e.currentTarget || target.classList.contains('narration-content-area')) {
                setFocusedSegmentId(null)
              }
            }}
          >
            <div
              className="narration-content-area"
              style={{
                width: `max(100%, ${totalWidth}px)`,
                minWidth: `max(100%, ${totalWidth}px)`,
                overflow: 'visible',
                position: 'relative',
                left: 0,
                display: 'block'
              }}
            >
              {/* Structure tracks */}
              {levels.map((level) => (
                <StructureTrackLane
                  key={level}
                  level={level}
                  items={structureItems}
                  pixelsPerUnit={pixelsPerUnit}
                  totalUnits={totalUnits}
                  activeItemId={activeSectionId ? 
                    sections.find(s => s.id === activeSectionId)?.structure_item_id : 
                    undefined
                  }
                  focusedItemId={focusedSegmentId}
                  onItemClick={handleSegmentClick}
                  onItemDoubleClick={handleSegmentDoubleClick}
                  onEditItem={() => {}} // Not used in document panel
                  onColorChange={() => {}} // Not used in document panel
                  levelName={getLevelName(level)}
                  availableAgents={[]}
                  onAgentAssign={() => {}} // Not used in document panel
                  connectionCounts={connectionCounts}
                />
              ))}

              {/* Empty state */}
              {structureItems.length === 0 && (
                <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
                  No structure items yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(NarrationArrangementView)

