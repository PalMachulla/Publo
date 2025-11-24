'use client'

import { memo, useMemo, useState } from 'react'
import type { StoryStructureItem } from '@/types/nodes'
import NarrationCard from './NarrationCard'

interface DocumentCardViewProps {
  structureItems: StoryStructureItem[]
  activeSectionId: string | null
  onSectionClick: (itemId: string) => void
  onColorChange?: (itemId: string, color: string) => void
  onAddSubAgent?: (itemId: string) => void
  onEdit?: (itemId: string) => void
  themeColors?: Record<string, string>
}

function DocumentCardView({ 
  structureItems, 
  activeSectionId, 
  onSectionClick,
  onColorChange,
  onAddSubAgent,
  onEdit,
  themeColors = {}
}: DocumentCardViewProps) {
  
  // Find the active item
  const activeItem = useMemo(() => {
    return structureItems.find(item => item.id === activeSectionId)
  }, [structureItems, activeSectionId])
  
  // Get inherited color for active item (walk up the tree to find a color)
  const getInheritedColor = (itemId: string): string | undefined => {
    const item = structureItems.find(i => i.id === itemId)
    if (!item) return undefined
    
    // If this item has a color, use it
    if (themeColors[itemId]) {
      return themeColors[itemId]
    }
    
    // Otherwise, check parent
    if (item.parentId) {
      return getInheritedColor(item.parentId)
    }
    
    return undefined
  }
  
  // Calculate stats for the active item
  const activeStats = useMemo(() => {
    if (!activeItem) return { childCount: 0, wordCount: 0 }
    
    const calculateWordCount = (itemId: string): number => {
      const currentItem = structureItems.find(i => i.id === itemId)
      if (!currentItem) return 0
      
      const ownWords = currentItem.wordCount || 0
      const childrenWords = structureItems
        .filter(child => child.parentId === itemId)
        .reduce((sum, child) => sum + calculateWordCount(child.id), 0)
      
      return ownWords + childrenWords
    }
    
    const children = structureItems.filter(child => child.parentId === activeItem.id)
    return {
      childCount: children.length,
      wordCount: calculateWordCount(activeItem.id)
    }
  }, [activeItem, structureItems])
  
  if (structureItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-lg text-gray-500 mb-2">
          No story structure yet
        </p>
        <p className="text-sm text-gray-400">
          Create your first section to begin writing
        </p>
      </div>
    )
  }
  
  if (!activeItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <p className="text-lg text-gray-500 mb-2">
          Select a section to view
        </p>
        <p className="text-sm text-gray-400">
          Click on a section in the sidebar to see its details
        </p>
      </div>
    )
  }
  
  const activeItemColor = activeItem ? getInheritedColor(activeItem.id) : undefined
  
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="w-full max-w-4xl">
        <NarrationCard
          item={activeItem}
          isActive={true}
          onClick={() => onSectionClick(activeItem.id)}
          childCount={activeStats.childCount}
          wordCount={activeStats.wordCount}
          onColorChange={onColorChange}
          onAddSubAgent={onAddSubAgent}
          onEdit={onEdit}
          themeColor={activeItemColor}
          indentLevel={0}
        />
      </div>
    </div>
  )
}

export default memo(DocumentCardView)

