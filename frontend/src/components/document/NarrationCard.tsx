'use client'

import { memo } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { StarFilledIcon, LightningBoltIcon, PersonIcon, BellIcon, PlusIcon } from '@radix-ui/react-icons'
import type { StoryStructureItem } from '@/types/nodes'
import type { SectionCardDisplay } from '@/types/librarian'

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
  /** Section card from Librarian with resolved character details */
  sectionCard?: SectionCardDisplay
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
  indentLevel = 0,
  sectionCard,
}: NarrationCardProps) {
  const colors = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Yellow', value: '#F59E0B' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'White', value: '#FFFFFF' },
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
        group relative p-4 mb-2 rounded-lg  transition-all cursor-pointer
        ${isActive 
          ? 'shadow-md' 
          : 'hover:border-blue-300 hover:shadow-sm'
        }
      `}
    >
      {/* Header with Title and Action Buttons */}
      <div className="flex items-start justify-between mb-2 border-b border-gray-500 border-dashed border-opacity-40 pb-2">
        <h3 
          onClick={onClick}
          className={`font-semibold flex-1 ${isActive ? 'text-gray-900' : 'text-gray-900'}`}
        >
          {item.title || item.name}
        </h3>
        
        {/* Action Buttons (show on hover or when active) */}
        <div className={`flex items-center gap-1 ml-2 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {/* Color Picker Button - Radix Dropdown */}
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Change color"
              >
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: currentColor }}
                />
              </button>
            </DropdownMenuPrimitive.Trigger>
            
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content
                align="end"
                sideOffset={8}
                className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="grid grid-cols-4 gap-2">
                  {colors.map((color) => (
                    <DropdownMenuPrimitive.Item
                      key={color.value}
                      onSelect={() => onColorChange?.(item.id, color.value)}
                      className="outline-none"
                    >
                      <div
                        className="w-7 h-7 rounded-full border-2 border-gray-200 hover:border-gray-400 hover:scale-110 transition-all cursor-pointer"
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    </DropdownMenuPrimitive.Item>
                  ))}
                </div>
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>
          
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
      
      {/* Summary - prioritize section card data from Librarian */}
      <div onClick={onClick}>
        {sectionCard?.summary ? (
          <p className="text-sm text-gray-600 mb-3">
            {sectionCard.summary}
          </p>
        ) : item.summary ? (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {item.summary}
          </p>
        ) : item.description ? (
          <p className="text-sm text-gray-500 mb-3 italic">
            {item.description}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic mb-3">
            No summary yet — Ask orchestrator to create one
          </p>
        )}
        
        {/* Characters from section card (with avatars) */}
        {sectionCard?.characters && sectionCard.characters.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-800 bg-gray-800/5 px-2 py-1 w-fit rounded-md uppercase tracking-wide mb-2">Characters</p>
            <div className="flex flex-wrap gap-2 mb-3">
            {sectionCard.characters.slice(0, 5).map((char) => (
              <span 
                key={char.id} 
                className={`inline-flex items-center gap-2 text-xs pr-3 pl-1.5 py-1.5 rounded-lg border ${
                  char.role === 'protagonist' 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : char.role === 'antagonist'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-purple-50 border-purple-200 text-purple-700'
                }`}
                title={char.description || char.role}
              >
                {/* Character avatar */}
                {char.photoUrl ? (
                  <img
                    src={char.photoUrl}
                    alt={char.name}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {char.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-medium">{char.name}</span>
                {char.role === 'protagonist' && (
                  <StarFilledIcon className="w-3 h-3 text-yellow-500" />
                )}
                {char.role === 'antagonist' && (
                  <LightningBoltIcon className="w-3 h-3 text-red-500" />
                )}
              </span>
            ))}
            {sectionCard.characters.length > 5 && (
              <span className="text-xs text-gray-400 self-center">
                +{sectionCard.characters.length - 5} more
              </span>
            )}
            </div>
          </div>
        )}
        
        {/* New characters introduced (minor/supporting) */}
        {sectionCard?.newCharactersIntroduced && sectionCard.newCharactersIntroduced.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-amber-700 bg-amber-100/50 px-2 py-1 w-fit rounded-md uppercase tracking-wide mb-2">
              ✨ New Characters
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sectionCard.newCharactersIntroduced.map((newChar, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border border-dashed ${
                    newChar.promoted
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-amber-50 border-amber-300 text-amber-700'
                  }`}
                  title={newChar.description || `New character: ${newChar.name}`}
                >
                  {newChar.promoted ? '✓' : <PlusIcon className="w-3 h-3" />}
                  <span>{newChar.name}</span>
                </span>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 italic">
              Ask to expand into full character profiles
            </p>
          </div>
        )}
        
        {/* Key moments from section card */}
        {sectionCard?.keyMoments && sectionCard.keyMoments.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-800 bg-gray-800/5 px-2 py-1 w-fit rounded-md uppercase tracking-wide mb-2">Key Moments</p>
            <ul className="text-xs text-gray-600 space-y-1">
              {sectionCard.keyMoments.slice(0, 3).map((moment, i) => (
                <li key={i} className="flex items-start gap-2">
                  <BellIcon className="w-3.5 h-3.5 text-gray-800" />
                  <span>{moment}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Mood from section card */}
        {sectionCard?.mood && (
          <div className="mb-3">
             <p className="text-xs font-semibold text-gray-800 bg-gray-800/5 px-2 py-1 w-fit rounded-md uppercase tracking-wide mb-2">Mood Swings</p>
          <span className="inline-flex items-center text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mr-2">
            🎭 {sectionCard.mood}
          </span>
          </div>
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

    </div>
  )
}

export default memo(NarrationCard)

