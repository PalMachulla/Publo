'use client'

import React, { memo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { StoryStructureItem, AgentOption } from '@/types/nodes'
import AgentSelector from './AgentSelector'

// Pastel color palette - soft, muted colors
export const PASTEL_COLORS = [
  { hex: '#fde2e2', name: 'Rose' },      // Soft rose
  { hex: '#fef3c7', name: 'Honey' },     // Soft yellow
  { hex: '#d1fae5', name: 'Mint' },      // Soft mint
  { hex: '#dbeafe', name: 'Sky' },       // Soft blue
  { hex: '#e9d5ff', name: 'Lavender' },  // Soft purple
  { hex: '#fed7aa', name: 'Peach' },     // Soft peach
  { hex: '#fce7f3', name: 'Pink' },      // Soft pink
  { hex: '#cffafe', name: 'Cyan' },      // Soft cyan
]

export interface NarrationSegmentProps {
  item: StoryStructureItem
  level: number // Support any level depth
  startPosition: number  // In pixels
  width: number          // In pixels
  isActive: boolean
  isFocused?: boolean // Whether this segment is currently zoomed/focused
  agentColor?: string // Color of assigned agent (for top border)
  agentIsActive?: boolean // Whether the assigned agent is active (affects border style)
  onClick: () => void
  onDoubleClick?: () => void // Handler for double click (zoom)
  onEdit?: (e: React.MouseEvent) => void // Handler for edit icon click
  onColorChange?: (color: string | null) => void // Handler for color picker
  availableAgents?: AgentOption[] // Available agents for assignment
  onAgentAssign?: (agentId: string | null) => void // Handler for agent assignment
}

function NarrationSegment({
  item,
  level,
  startPosition,
  width,
  isActive,
  isFocused = false,
  agentColor,
  agentIsActive = true,
  onClick,
  onDoubleClick,
  onEdit,
  onColorChange,
  availableAgents = [],
  onAgentAssign
}: NarrationSegmentProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showAgentSelector, setShowAgentSelector] = useState(false)
  const colorButtonRef = useRef<HTMLButtonElement>(null)
  const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  // Track when component is mounted for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate color picker position when opened
  useEffect(() => {
    if (showColorPicker && colorButtonRef.current) {
      const updatePosition = () => {
        if (!colorButtonRef.current) return
        
        const rect = colorButtonRef.current.getBoundingClientRect()
        const dropdownWidth = 128 // w-32 = 128px
        
        // Calculate position relative to viewport
        setColorPickerPosition({
          top: rect.bottom + 4,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - dropdownWidth - 8))
        })
      }
      
      updatePosition()
      
      // Update position on scroll
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [showColorPicker])
  
  // Calculate background color with inheritance
  // If item has backgroundColor, use it; otherwise it inherits from parent
  // The color gets lighter/more transparent at deeper levels
  const getBackgroundColor = () => {
    // If item has a custom background color
    if (item.backgroundColor) {
      return item.backgroundColor
    }
    
    // Default gray background
    return '#f3f4f6' // gray-100
  }
  
  // Lighter color palette for better visibility
  const levelColors: Record<number, any> = {
    1: {
      bg: 'bg-gray-200',
      border: 'border-gray-300',
      text: 'text-gray-800',
      hover: 'hover:bg-gray-300'
    },
    2: {
      bg: 'bg-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-700',
      hover: 'hover:bg-gray-200'
    },
    3: {
      bg: 'bg-gray-50',
      border: 'border-gray-100',
      text: 'text-gray-600',
      hover: 'hover:bg-gray-100'
    },
    // Additional levels for deeper hierarchies
    4: {
      bg: 'bg-slate-50',
      border: 'border-slate-100',
      text: 'text-slate-600',
      hover: 'hover:bg-slate-100'
    },
    5: {
      bg: 'bg-zinc-50',
      border: 'border-zinc-100',
      text: 'text-zinc-600',
      hover: 'hover:bg-zinc-100'
    },
    6: {
      bg: 'bg-neutral-50',
      border: 'border-neutral-100',
      text: 'text-neutral-600',
      hover: 'hover:bg-neutral-100'
    },
    7: {
      bg: 'bg-stone-50',
      border: 'border-stone-100',
      text: 'text-stone-600',
      hover: 'hover:bg-stone-100'
    }
  }
  
  const colors = levelColors[level] || levelColors[1] // Fallback to level 1 colors
  const minWidthForText = 40 // Only show text if segment is wide enough
  const minWidthForButtons = 40 // Show action buttons if segment is wide enough (reduced from 80)
  
  const backgroundColor = getBackgroundColor()
  
  return (
    <div
      className={`
        absolute top-0 h-full
        border-l border-r border-b border-gray-300
        ${isFocused ? 'text-gray-800' : 'text-gray-700'}
        ${isActive ? 'shadow-[inset_0_0_0_2px_#fbbf24] z-10' : ''}
        ${isFocused ? 'shadow-md z-40' : ''}
        cursor-pointer
        transition-all duration-200
        rounded-br-lg
        group
      `}
      style={{
        left: startPosition,
        width: Math.max(width, 20), // Min width 20px for visibility
        backgroundColor,
        borderTopWidth: agentColor ? '3px' : '1px',
        borderTopColor: agentColor || '#d1d5db', // Agent color or gray-300
        borderTopStyle: agentColor && !agentIsActive ? 'dashed' : 'solid', // Dashed if agent is passive
      }}
      onMouseEnter={(e) => {
        if (!isFocused && !item.backgroundColor) {
          e.currentTarget.style.backgroundColor = '#e5e7eb' // gray-200 on hover
        }
      }}
      onMouseLeave={(e) => {
        if (!isFocused) {
          e.currentTarget.style.backgroundColor = backgroundColor
        }
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={item.name} // Tooltip for narrow segments
    >
      {/* Segment label - only show if wide enough */}
      {width >= minWidthForText && (
        <div className="h-full px-2 flex items-center justify-between gap-2">
          <div className="text-xs font-medium truncate flex-1">
            {item.name}
          </div>
          
          {/* Action buttons - only show when focused AND segment is wide enough */}
          {isFocused && width >= minWidthForButtons && (
            <div className="flex items-center gap-1 flex-shrink-0 relative">
              {/* Agent selector */}
              {onAgentAssign && (
                <AgentSelector
                  selectedAgentId={item.assignedAgentId}
                  availableAgents={availableAgents}
                  onAgentSelect={onAgentAssign}
                  isOpen={showAgentSelector}
                  onToggle={(open) => {
                    setShowAgentSelector(open)
                    if (open) setShowColorPicker(false) // Close color picker when opening agent selector
                  }}
                />
              )}
              
              {/* Color picker button */}
              {onColorChange && (
                <div className="relative">
                  <button
                    ref={colorButtonRef}
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowColorPicker(!showColorPicker)
                      if (!showColorPicker) setShowAgentSelector(false) // Close agent selector when opening color picker
                    }}
                    className="p-1 rounded hover:bg-gray-200 transition-colors"
                    title="Set color"
                    aria-label="Set color"
                  >
                    <svg 
                      className="w-4 h-4 text-gray-700" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" 
                      />
                    </svg>
                  </button>
                  
                  {/* Color picker dropdown - using portal to render at body level */}
                  {showColorPicker && mounted && createPortal(
                    <div 
                      className="fixed bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-32"
                      style={{ 
                        top: `${colorPickerPosition.top}px`,
                        left: `${colorPickerPosition.left}px`,
                        zIndex: 99999
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {PASTEL_COLORS.map((color) => {
                          const isSelected = item.backgroundColor === color.hex
                          return (
                            <button
                              key={color.hex}
                              onClick={(e) => {
                                e.stopPropagation()
                                onColorChange(color.hex)
                                setShowColorPicker(false)
                              }}
                              className={`w-6 h-6 rounded border-2 hover:scale-110 transition-transform relative ${
                                isSelected ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color.hex }}
                              title={color.name}
                              aria-label={`Select ${color.name} color`}
                            >
                              {isSelected && (
                                <svg className="w-4 h-4 absolute inset-0 m-auto text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {/* Clear color button */}
                      {item.backgroundColor && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onColorChange(null)
                            setShowColorPicker(false)
                          }}
                          className="w-full text-xs text-gray-600 hover:text-gray-900 px-2 py-1 hover:bg-gray-100 rounded"
                        >
                          Clear color
                        </button>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
              )}
              
              {/* Edit icon */}
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(e)
                  }}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                  title="Edit content"
                  aria-label="Edit content"
                >
                  <svg 
                    className="w-4 h-4 text-gray-700" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" 
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Completed indicator */}
      {item.completed && !isFocused && (
        <div className="absolute top-1 right-1">
          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  )
}

export default memo(NarrationSegment)

