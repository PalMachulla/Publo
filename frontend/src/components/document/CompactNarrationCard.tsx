'use client'

import { memo, useState } from 'react'
import type { StoryStructureItem } from '@/types/nodes'

interface CompactNarrationCardProps {
  item: StoryStructureItem
  isActive: boolean
  onClick: () => void
  onColorChange?: (itemId: string, color: string) => void
  onAddSubAgent?: (itemId: string) => void
  onEdit?: (itemId: string) => void
  themeColor?: string
  indentLevel?: number
  hasChildren?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

function CompactNarrationCard({ 
  item, 
  isActive, 
  onClick, 
  onColorChange,
  onAddSubAgent,
  onEdit,
  themeColor,
  indentLevel = 0,
  hasChildren = false,
  isCollapsed = false,
  onToggleCollapse
}: CompactNarrationCardProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  
  const colors = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Yellow', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Gray', value: '#6B7280' },
  ]
  
  const currentColor = themeColor || '#6B7280'
  
  // Border width based on level
  const getBorderWidth = () => {
    switch (item.level) {
      case 1: return '4px'
      case 2: return '3px'
      case 3: return '2px'
      default: return '1px'
    }
  }
  
  // Convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 107, g: 117, b: 128 } // default gray
  }
  
  // Get background color with opacity based on level
  const getBackgroundColor = () => {
    if (!themeColor) return isActive ? 'rgba(219, 234, 254, 0.5)' : 'transparent' // blue-100 with opacity
    
    const rgb = hexToRgb(themeColor)
    
    // Opacity decreases with each level: Level 1 = 0.15, Level 2 = 0.10, Level 3 = 0.07, Level 4+ = 0.04
    let opacity = 0.15
    switch (item.level) {
      case 1: opacity = isActive ? 0.20 : 0.15; break
      case 2: opacity = isActive ? 0.15 : 0.10; break
      case 3: opacity = isActive ? 0.12 : 0.07; break
      default: opacity = isActive ? 0.08 : 0.04; break
    }
    
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
  }
  
  // Get section label with number
  const getSectionLabel = () => {
    const order = item.order || ''
    switch (item.level) {
      case 1: return `ACT ${order}`
      case 2: return `SEQUENCE ${order}`
      case 3: return `SCENE ${order}`
      case 4: return `BEAT ${order}`
      default: return `SECTION ${order}`
    }
  }
  
  // Remove section prefix from title (e.g., "Sequence 1 - " or "Act I - ")
  const getCleanTitle = () => {
    const fullTitle = item.title || item.name
    
    // Remove common prefixes like "Act I - ", "Sequence 1 - ", "Scene 1 - ", "Beat 1 - "
    const prefixPatterns = [
      /^Act\s+[IVX0-9]+\s*[-–—:]\s*/i,
      /^Sequence\s+\d+\s*[-–—:]\s*/i,
      /^Scene\s+\d+\s*[-–—:]\s*/i,
      /^Beat\s+\d+\s*[-–—:]\s*/i,
    ]
    
    for (const pattern of prefixPatterns) {
      const cleaned = fullTitle.replace(pattern, '')
      if (cleaned !== fullTitle) {
        return cleaned
      }
    }
    
    return fullTitle
  }
  
  const borderColor = isActive ? currentColor : '#D1D5DB'
  const backgroundColor = getBackgroundColor()
  
  return (
    <div
      style={{ 
        borderLeft: `${getBorderWidth()} solid ${borderColor}`,
        backgroundColor: backgroundColor,
      }}
      className={`
        group relative pl-2 pr-2 py-1.5 transition-all cursor-pointer
        ${isActive ? 'text-gray-900' : 'text-gray-700 hover:bg-gray-100/50'}
      `}
    >
      <div className="flex items-start gap-1.5">
        {/* Chevron (if has children) */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse?.()
            }}
            className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded transition-colors mt-0.5"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className={`w-3 h-3 text-gray-500 transition-transform ${
                isCollapsed ? '' : 'rotate-90'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-4 flex-shrink-0" />
        )}
        
        {/* Content */}
        <div className="flex-1 min-w-0" onClick={onClick}>
          {/* Section Label */}
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
            {getSectionLabel()}
          </div>
          
          {/* Title (cleaned of section prefix) */}
          <h3 className="font-medium text-sm truncate">
            {getCleanTitle()}
          </h3>
        </div>
        
        {/* Action Buttons (show on hover or when active) */}
        <div className={`flex-shrink-0 flex items-center gap-0.5 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {/* Color Picker Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowColorPicker(!showColorPicker)
              }}
              className="p-0.5 hover:bg-gray-200 rounded transition-colors"
              title="Change color"
            >
              <div 
                className="w-3 h-3 rounded-full border border-gray-300"
                style={{ backgroundColor: currentColor }}
              />
            </button>
            
            {/* Color Picker Dropdown */}
            {showColorPicker && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50">
                <div className="grid grid-cols-4 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={(e) => {
                        e.stopPropagation()
                        onColorChange?.(item.id, color.value)
                        setShowColorPicker(false)
                      }}
                      className="w-5 h-5 rounded-full border-2 border-gray-200 hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Add Sub-Agent Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddSubAgent?.(item.id)
            }}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
            title="Add sub-agent"
          >
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {/* Edit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.(item.id)
            }}
            className="p-0.5 hover:bg-gray-200 rounded transition-colors"
            title="Edit summary"
          >
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(CompactNarrationCard)

