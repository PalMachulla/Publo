'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData, StoryStructureItem } from '@/types/nodes'
import { getFormatIcon } from '@/components/menus/StoryFormatMenu'
import { getPrimaryStructuralLevel, getDocumentHierarchy } from '@/lib/documentHierarchy'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

function StoryStructureNode({ data, selected, id }: NodeProps<StoryStructureNodeData>) {
  const { format, items = [], label, onItemClick, onItemsUpdate, isLoading = false } = data
  const primaryLevel = format ? (getPrimaryStructuralLevel(format) || 'Item') : 'Item'
  
  // Get only top-level items (level 1)
  const topLevelItems = items.filter(item => item.level === 1).sort((a, b) => a.order - b.order)
  const hasItems = topLevelItems.length > 0

  // Get format-specific icon
  const formatIcon = getFormatIcon(format)
  
  // Helper function to get children of an item
  const getChildren = (parentId: string): StoryStructureItem[] => {
    return items
      .filter(item => item.parentId === parentId)
      .sort((a, b) => a.order - b.order)
  }
  
  // Helper function to check if item has children
  const hasChildren = (itemId: string): boolean => {
    return items.some(item => item.parentId === itemId)
  }
  
  // Toggle expanded state of an item
  const toggleExpanded = (itemId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, expanded: !item.expanded } : item
    )
    
    if (onItemsUpdate) {
      onItemsUpdate(updatedItems)
    }
  }
  
  // Handle item click
  const handleItemClick = (item: StoryStructureItem, event: React.MouseEvent) => {
    event.stopPropagation()
    console.log('Story structure item clicked:', { item, nodeId: id, allItems: items })
    
    // Call the callback if provided
    if (onItemClick) {
      onItemClick(item, items, format, id) // Pass node ID as 4th parameter
    }
  }
  
  // Calculate total width by counting all visible cards horizontally
  const calculateTotalWidth = (): number => {
    const cardWidth = 240
    const levelGap = 20 // Gap between hierarchy levels (gap-5 = 20px)
    const sidePadding = 24
    
    if (!hasItems) return 200
    
    // Count total horizontal cards in linear flow
    const countHorizontalCards = (): number => {
      let totalCards = 0
      
      const traverse = (parentId: string | undefined): number => {
        const children = items.filter(item => item.parentId === parentId)
        
        if (children.length === 0) {
          return 0
        }
        
        let horizontalSum = 0
        
        children.forEach(child => {
          // Count this child
          horizontalSum += 1
          
          // If expanded, add its children horizontally
          if (child.expanded) {
            const childWidth = traverse(child.id)
            horizontalSum += childWidth
          }
        })
        
        return horizontalSum
      }
      
      // Count top level items
      totalCards = topLevelItems.length
      
      // Add all expanded children
      topLevelItems.forEach(item => {
        if (item.expanded) {
          totalCards += traverse(item.id)
        }
      })
      
      return totalCards
    }
    
    const columns = countHorizontalCards()
    
    // Width = (number of columns * card width) + (gaps between columns) + padding
    return (columns * cardWidth) + ((columns - 1) * levelGap) + (sidePadding * 2)
  }
  
  const nodeWidth = calculateTotalWidth()
  const sidePadding = 24
  
  // Helper to get background color based on level
  const getBackgroundColor = (level: number): string => {
    switch (level) {
      case 1: return 'bg-white'
      case 2: return 'bg-gray-50'
      case 3: return 'bg-gray-100'
      default: return 'bg-gray-100'
    }
  }
  
  // Helper to get level name from document hierarchy
  const getLevelName = (level: number): string => {
    if (!format) return 'Item'
    const hierarchy = getDocumentHierarchy(format)
    if (!hierarchy || level > hierarchy.length) return 'Item'
    return hierarchy[level - 1]?.name || 'Item'
  }
  
  // Recursive component to render item with its children horizontally
  const renderHorizontalTree = (item: StoryStructureItem): JSX.Element => {
    const children = getChildren(item.id)
    const itemHasChildren = children.length > 0
    const canHaveChildren = item.level < 3
    const nextLevelName = canHaveChildren ? getLevelName(item.level + 1) : ''
    
    return (
      <div key={item.id} className="flex flex-nowrap gap-5 items-start transition-all duration-300 ease-in-out flex-shrink-0">
        {/* Current item card */}
        <div
          className={`flex-shrink-0 ${getBackgroundColor(item.level)} rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer group`}
          style={{ width: 240, minHeight: 160 }}
        >
          <div className="w-full h-full p-4 flex flex-col gap-2">
            {/* Header with chevron */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1" onClick={(e) => handleItemClick(item, e)}>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-gray-900 flex-1">
                    {item.name}
                  </div>
                </div>
                {item.title && (
                  <div className="text-xs text-gray-600 mt-1">
                    {item.title}
                  </div>
                )}
              </div>
              {(itemHasChildren || canHaveChildren) && (
                <button
                  onClick={(e) => toggleExpanded(item.id, e)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                >
                  <ChevronRightIcon className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${
                    item.expanded ? 'rotate-90' : ''
                  }`} />
                </button>
              )}
            </div>
            
            {/* Description and action */}
            <div onClick={(e) => handleItemClick(item, e)} className="flex-1 flex flex-col">
              {item.description && (
                <div className="text-xs text-gray-500 line-clamp-2 mb-2">
                  {item.description}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-auto">
                Click to Write
              </div>
            </div>
          </div>
        </div>
        
        {/* Children rendered to the right - slide in/out */}
        {item.expanded && (
          <div className="flex flex-row flex-nowrap gap-5 flex-shrink-0 items-start animate-in slide-in-from-left-2 duration-200">
            {itemHasChildren ? (
              // Render existing children horizontally
              children.map((child) => renderHorizontalTree(child))
            ) : canHaveChildren ? (
              // Show placeholder to add first child
              <div 
                className={`flex-shrink-0 ${getBackgroundColor(item.level + 1)} rounded-xl border-2 border-dashed border-gray-300 hover:border-yellow-400 transition-all cursor-pointer`}
                style={{ width: 240, minHeight: 160 }}
                onClick={(e) => {
                  e.stopPropagation()
                  // This will be handled by the panel - for now just show message
                  console.log(`Add ${nextLevelName} to ${item.name}`)
                }}
              >
                <div className="w-full h-full p-4 flex flex-col items-center justify-center gap-2">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <div className="text-sm font-medium text-gray-600 text-center">
                    Add {nextLevelName}
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    Click to create
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Top connector dot - positioned behind the shape */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ top: '-10px', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Bottom connector dot - positioned behind the shape */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ bottom: '-10px', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Wrapper for tab + container with subtle selection state */}
      <div className="relative transition-all duration-300 ease-in-out flex-shrink-0" style={{ 
        borderRadius: '16px 16px 24px 24px',
        zIndex: 5,
        width: nodeWidth
      }}>
        {/* Label above node with tab-like background */}
        <div className="flex justify-center -mb-1 transition-all duration-300 ease-in-out" style={{ width: nodeWidth }}>
          <div className={`px-8 py-3 rounded-t-xl flex items-center gap-2 transition-all  ${isLoading ? 'bg-gray-200 animate-pulse' : 'bg-gray-400'}`}>
            <div className="text-sm text-gray-700 uppercase tracking-widest font-sans font-bold">
              {label || (format ? format.toUpperCase() : 'STORY')}
            </div>
            {/* Panel indicator icon - three dots vertical */}
            <svg 
              className="w-4 h-4 text-gray-700" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5"
              viewBox="0 0 24 24"
              aria-label="Opens panel"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" 
              />
            </svg>
          </div>
        </div>

        {/* Main Container - positioned in front of connector dots */}
        <div
          className={`relative rounded-2xl transition-all duration-300 ease-in-out overflow-visible ${isLoading ? 'bg-gray-200 animate-pulse' : 'bg-gray-400'} ${
            selected ? ' shadow-2xl' : ' shadow-md'
          }`}
          style={{
            width: nodeWidth,
            minHeight: 200,
            paddingLeft: sidePadding,
            paddingRight: sidePadding,
            paddingTop: 20,
            paddingBottom: 20,
            boxSizing: 'border-box'
          }}
        >
        {hasItems ? (
          /* Horizontal tree structure - no scrolling, all cards visible */
          <div className="flex flex-nowrap gap-4 items-start">
            {topLevelItems.map((item) => renderHorizontalTree(item))}
          </div>
        ) : (
          /* Empty state - show format icon */
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 text-yellow-600">
              <div className="w-full h-full flex items-center justify-center scale-[2.4]">
                {formatIcon}
              </div>
            </div>
            <div className="text-[9px] text-gray-600 font-medium text-center">
              Click to Add {primaryLevel}s
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
    </div>
  )
}

export default memo(StoryStructureNode)

