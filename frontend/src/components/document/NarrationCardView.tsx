'use client'

import { memo, useMemo, useState } from 'react'
import type { StoryStructureItem } from '@/types/nodes'
import CompactNarrationCard from './CompactNarrationCard'

interface NarrationCardViewProps {
  structureItems: StoryStructureItem[]
  activeSectionId: string | null
  onSectionClick: (itemId: string) => void
  onColorChange?: (itemId: string, color: string) => void
  onAddSubAgent?: (itemId: string) => void
  onEdit?: (itemId: string) => void
  themeColors?: Record<string, string>
}

function NarrationCardView({ 
  structureItems, 
  activeSectionId, 
  onSectionClick,
  onColorChange,
  onAddSubAgent,
  onEdit,
  themeColors = {}
}: NarrationCardViewProps) {
  
  // Track which items are collapsed
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set())
  
  // Build hierarchical tree structure
  const buildTree = (parentId: string | null | undefined): StoryStructureItem[] => {
    return structureItems
      .filter(item => {
        if (parentId === null || parentId === undefined) {
          return !item.parentId || item.parentId === ''
        }
        return item.parentId === parentId
      })
      .sort((a, b) => a.order - b.order)
  }
  
  // Calculate stats for each item
  const calculateStats = useMemo(() => {
    const stats: Record<string, { childCount: number; wordCount: number }> = {}
    
    const calculateWordCount = (itemId: string): number => {
      const currentItem = structureItems.find(i => i.id === itemId)
      if (!currentItem) return 0
      
      const ownWords = currentItem.wordCount || 0
      const childrenWords = structureItems
        .filter(child => child.parentId === itemId)
        .reduce((sum, child) => sum + calculateWordCount(child.id), 0)
      
      return ownWords + childrenWords
    }
    
    structureItems.forEach(item => {
      const children = structureItems.filter(child => child.parentId === item.id)
      stats[item.id] = {
        childCount: children.length,
        wordCount: calculateWordCount(item.id)
      }
    })
    
    return stats
  }, [structureItems])
  
  // Render cards recursively with color inheritance
  const renderCards = (items: StoryStructureItem[], indentLevel: number = 0, parentColor?: string): JSX.Element[] => {
    return items.flatMap(item => {
      const stats = calculateStats[item.id] || { childCount: 0, wordCount: 0 }
      const isCollapsed = collapsedItems.has(item.id)
      const children = buildTree(item.id)
      const hasChildren = children.length > 0
      
      // Use item's own color if set, otherwise inherit from parent
      const itemColor = themeColors[item.id] || parentColor
      
      return [
        <CompactNarrationCard
          key={item.id}
          item={item}
          isActive={activeSectionId === item.id}
          onClick={() => onSectionClick(item.id)}
          onColorChange={onColorChange}
          onAddSubAgent={onAddSubAgent}
          onEdit={onEdit}
          themeColor={itemColor}
          indentLevel={indentLevel}
          hasChildren={hasChildren}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => {
            setCollapsedItems(prev => {
              const newSet = new Set(prev)
              if (newSet.has(item.id)) {
                newSet.delete(item.id)
              } else {
                newSet.add(item.id)
              }
              return newSet
            })
          }}
        />,
        ...(hasChildren && !isCollapsed ? renderCards(children, indentLevel + 1, itemColor) : [])
      ]
    })
  }
  
  const rootItems = buildTree(null)
  
  if (structureItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm text-gray-500 mb-1">
          No structure yet
        </p>
        <p className="text-xs text-gray-400">
          Create structure to see narration cards
        </p>
      </div>
    )
  }
  
  return (
    <div className="flex-1 overflow-y-auto py-2">
      {renderCards(rootItems)}
    </div>
  )
}

export default memo(NarrationCardView)

