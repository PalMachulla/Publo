'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData, StoryStructureItem } from '@/types/nodes'
import { getFormatIcon } from '@/components/StoryFormatMenu'
import { getPrimaryStructuralLevel } from '@/lib/documentHierarchy'
import { Bars3Icon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

function StoryStructureNode({ data, selected, id }: NodeProps<StoryStructureNodeData>) {
  const { format, items = [], label, onItemClick, onItemsUpdate } = data
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
    console.log('Story structure item clicked:', { item, nodeId: id, allItems: topLevelItems })
    
    // Call the callback if provided
    if (onItemClick) {
      onItemClick(item, topLevelItems, format)
    }
  }
  
  // Calculate total width including all expanded children
  const calculateTotalWidth = (): number => {
    const cardWidth = 240
    const cardGap = 16
    const sidePadding = 24
    const columnGap = 20 // Gap between levels
    
    if (!hasItems) return 200
    
    // Count columns needed (max depth of expanded items)
    let maxColumns = 1 // At least top level
    
    const countExpandedDepth = (parentId: string | undefined, currentDepth: number): number => {
      const children = items.filter(item => item.parentId === parentId)
      if (children.length === 0) return currentDepth
      
      const expandedChildren = children.filter(item => item.expanded)
      if (expandedChildren.length === 0) return currentDepth
      
      let maxDepth = currentDepth + 1
      expandedChildren.forEach(child => {
        const childDepth = countExpandedDepth(child.id, currentDepth + 1)
        maxDepth = Math.max(maxDepth, childDepth)
      })
      
      return maxDepth
    }
    
    maxColumns = countExpandedDepth(undefined, 1)
    
    // Calculate width: (columns * cardWidth) + (gaps between columns) + padding
    return (maxColumns * cardWidth) + ((maxColumns - 1) * columnGap) + (sidePadding * 2)
  }
  
  const nodeWidth = calculateTotalWidth()
  
  // Helper to get background color based on level
  const getBackgroundColor = (level: number): string => {
    switch (level) {
      case 1: return 'bg-white'
      case 2: return 'bg-gray-50'
      case 3: return 'bg-gray-100'
      default: return 'bg-gray-100'
    }
  }
  
  // Recursive component to render item with its children horizontally
  const renderHorizontalTree = (item: StoryStructureItem): JSX.Element => {
    const children = getChildren(item.id)
    const itemHasChildren = children.length > 0
    const canHaveChildren = item.level < 3
    
    return (
      <div key={item.id} className="flex gap-5">
        {/* Current item card */}
        <div className="flex flex-col gap-2">
          <div
            className={`flex-shrink-0 ${getBackgroundColor(item.level)} rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer group relative`}
            style={{ width: 240, minHeight: 160 }}
          >
            <div className="w-full h-full p-4 flex flex-col gap-2">
              {/* Header with chevron */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1" onClick={(e) => handleItemClick(item, e)}>
                  <div className="text-sm font-bold text-gray-900">
                    {item.name}
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
                    <ChevronRightIcon className={`w-4 h-4 text-gray-600 transition-transform ${
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
        </div>
        
        {/* Children rendered to the right */}
        {item.expanded && children.length > 0 && (
          <div className="flex flex-col gap-2">
            {children.map((child) => renderHorizontalTree(child))}
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
      <div className="relative transition-all" style={{ 
        borderRadius: '16px 16px 24px 24px',
        zIndex: 5
      }}>
        {/* Label above node with tab-like background - larger and with hamburger icon */}
        <div className="flex justify-center mb-0" style={{ width: nodeWidth }}>
          <div className={`px-8 py-3 rounded-t-xl flex items-center gap-2 transition-all ${
            selected ? 'bg-gray-100 shadow-md' : 'bg-gray-200 shadow-sm'
          }`}>
            <div className="text-xs text-gray-700 uppercase tracking-widest font-sans font-bold">
              {label || (format ? format.toUpperCase() : 'STORY')}
            </div>
            <Bars3Icon className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        {/* Main Container - positioned in front of connector dots */}
        <div
          className={`relative rounded-2xl transition-all overflow-visible ${
            selected ? 'bg-gray-100 shadow-2xl' : 'bg-gray-200 shadow-md'
          }`}
          style={{
            width: nodeWidth,
            minHeight: 200,
            paddingLeft: '24px',
            paddingRight: '24px',
            paddingTop: '20px',
            paddingBottom: '20px'
          }}
        >
        {hasItems ? (
          /* Horizontal tree structure */
          <div className="flex gap-4 h-full overflow-x-auto overflow-y-hidden">
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

