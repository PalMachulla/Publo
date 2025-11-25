'use client'

import { memo, useState } from 'react'
import type { StoryStructureItem } from '@/types/nodes'

interface NarrationCardProps {
  item: StoryStructureItem
  isActive: boolean
  onClick: () => void
  childCount: number
  wordCount: number
  onColorChange?: (itemId: string, color: string) => void
  onAddSubAgent?: (itemId: string) => void
  onEdit?: (itemId: string) => void
  themeColor?: string
  indentLevel?: number
}

function NarrationCard({ 
  item, 
  isActive, 
  onClick, 
  childCount, 
  wordCount,
  onColorChange,
  onAddSubAgent,
  onEdit,
  themeColor,
  indentLevel = 0
}: NarrationCardProps) {
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
  
  // Convert hex color to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 107, g: 117, b: 128 }
  }
  
  // Get background color with tint
  const getBackgroundColor = () => {
    if (!themeColor) return 'white'
    
    const rgb = hexToRgb(themeColor)
    // Lighter tint for the main card view (0.05 opacity)
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`
  }
  
  const borderColor = themeColor || (isActive ? '#3B82F6' : '#E5E7EB')
  
  return (
    <div
      style={{ 
        marginLeft: `${indentLevel * 12}px`,
        backgroundColor: getBackgroundColor(),
        borderColor: borderColor
      }}
      className={`
        group relative p-4 mb-2 rounded-lg border-2 transition-all cursor-pointer
        ${isActive 
          ? 'shadow-md' 
          : 'hover:border-blue-300 hover:shadow-sm'
        }
      `}
    >
      {/* Header with Title and Action Buttons */}
      <div className="flex items-start justify-between mb-2">
        <h3 
          onClick={onClick}
          className={`font-semibold flex-1 ${isActive ? 'text-blue-900' : 'text-gray-900'}`}
        >
          {item.title || item.name}
        </h3>
        
        {/* Action Buttons (show on hover or when active) */}
        <div className={`flex items-center gap-1 ml-2 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {/* Color Picker Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowColorPicker(!showColorPicker)
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Change color"
            >
              <div 
                className="w-4 h-4 rounded-full border border-gray-300"
                style={{ backgroundColor: currentColor }}
              />
            </button>
            
            {/* Color Picker Dropdown */}
            {showColorPicker && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                <div className="grid grid-cols-4 gap-1">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={(e) => {
                        e.stopPropagation()
                        onColorChange?.(item.id, color.value)
                        setShowColorPicker(false)
                      }}
                      className="w-6 h-6 rounded-full border-2 border-gray-200 hover:border-gray-400 transition-colors"
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
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Add sub-agent"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {/* Edit Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.(item.id)
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Edit summary"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Summary */}
      <div onClick={onClick}>
        {item.summary ? (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {item.summary}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic mb-3">
            No summary yet — Ask orchestrator to create one
          </p>
        )}
      </div>
      
      {/* Stats Bar */}
      <div onClick={onClick} className="flex items-center gap-4 text-xs text-gray-500">
        {childCount > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            {childCount} {childCount === 1 ? 'section' : 'sections'}
          </span>
        )}
        {wordCount > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {wordCount.toLocaleString()}w
          </span>
        )}
      </div>
      
      {/* Active indicator stripe (left edge) */}
      {isActive && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" 
          style={{ backgroundColor: currentColor }}
        />
      )}
    </div>
  )
}

export default memo(NarrationCard)

