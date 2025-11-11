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

  // Calculate width based on number of items (minimum 200px for empty state)
  const cardWidth = 240 // Width per item card
  const cardGap = 16 // Gap between cards (4 in Tailwind = 16px)
  const sidePadding = 24 // Equal padding on both sides
  const nodeWidth = hasItems 
    ? (topLevelItems.length * cardWidth) + ((topLevelItems.length - 1) * cardGap) + (sidePadding * 2)
    : 200

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
          className={`relative rounded-2xl transition-all overflow-hidden ${
            selected ? 'bg-gray-100 shadow-2xl' : 'bg-gray-200 shadow-md'
          }`}
          style={{
            width: nodeWidth,
            height: 200,
            paddingLeft: `${sidePadding}px`,
            paddingRight: `${sidePadding}px`,
            paddingTop: '20px',
            paddingBottom: '20px'
          }}
        >
        {hasItems ? (
          /* Horizontal scrollable cards with hierarchical structure */
          <div className="flex gap-4 h-full overflow-x-auto">
            {topLevelItems.map((item) => {
              const itemHasChildren = hasChildren(item.id)
              const children = item.expanded ? getChildren(item.id) : []
              
              return (
                <div key={item.id} className="flex-shrink-0 flex flex-col gap-2" style={{ width: 240 }}>
                  {/* Top-level item card */}
                  <div
                    className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer group"
                    style={{ minHeight: 160 }}
                  >
                    <div className="w-full p-4 flex flex-col gap-2">
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
                        {itemHasChildren && (
                          <button
                            onClick={(e) => toggleExpanded(item.id, e)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                          >
                            {item.expanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
                            )}
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
                      
                      {/* Level 2 children (only show if expanded and level < 3) */}
                      {item.expanded && children.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                          {children.map((child) => {
                            const childHasChildren = hasChildren(child.id)
                            const grandChildren = child.expanded ? getChildren(child.id) : []
                            
                            return (
                              <div key={child.id} className="text-xs">
                                {/* Level 2 item */}
                                <div className="flex items-center justify-between gap-1 p-2 hover:bg-gray-50 rounded cursor-pointer group/child">
                                  <div className="flex-1" onClick={(e) => handleItemClick(child, e)}>
                                    <div className="font-medium text-gray-800">{child.name}</div>
                                    {child.title && <div className="text-gray-500 text-[10px]">{child.title}</div>}
                                  </div>
                                  {childHasChildren && child.level < 3 && (
                                    <button
                                      onClick={(e) => toggleExpanded(child.id, e)}
                                      className="p-0.5 hover:bg-gray-100 rounded"
                                    >
                                      {child.expanded ? (
                                        <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                                      ) : (
                                        <ChevronRightIcon className="w-3 h-3 text-gray-500" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                
                                {/* Level 3 children (only show if expanded) */}
                                {child.expanded && grandChildren.length > 0 && (
                                  <div className="ml-3 mt-1 space-y-1 pl-2 border-l-2 border-gray-200">
                                    {grandChildren.map((grandChild) => (
                                      <div
                                        key={grandChild.id}
                                        className="p-1.5 hover:bg-gray-50 rounded cursor-pointer text-[10px]"
                                        onClick={(e) => handleItemClick(grandChild, e)}
                                      >
                                        <div className="font-medium text-gray-700">{grandChild.name}</div>
                                        {grandChild.title && <div className="text-gray-500">{grandChild.title}</div>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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

