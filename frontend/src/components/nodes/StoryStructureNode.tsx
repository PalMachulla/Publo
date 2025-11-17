'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData, StoryStructureItem } from '@/types/nodes'
import { getFormatIcon } from '@/components/menus/StoryFormatMenu'
import { getPrimaryStructuralLevel, getDocumentHierarchy } from '@/lib/documentHierarchy'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { NarrationContainer } from './narrationline'

function StoryStructureNode({ data, selected, id }: NodeProps<StoryStructureNodeData>) {
  const { 
    format, 
    items = [], 
    label, 
    onItemClick, 
    onItemsUpdate, 
    onWidthUpdate, 
    isLoading = false, 
    customNarrationWidth = 1200,
    availableAgents = [],
    onAgentAssign
  } = data
  const primaryLevel = format ? (getPrimaryStructuralLevel(format) || 'Item') : 'Item'
  const [viewMode, setViewMode] = useState<'cards' | 'narration'>('narration')
  const [isExpanded, setIsExpanded] = useState(false) // Collapsed by default
  
  // Get only top-level items (level 1)
  const topLevelItems = items.filter(item => item.level === 1).sort((a, b) => a.order - b.order)
  const hasItems = topLevelItems.length > 0

  // Get format-specific icon
  const formatIcon = getFormatIcon(format)
  
  // Calculate total word count
  const totalWordCount = items.reduce((sum, item) => sum + (item.wordCount || 0), 0)
  
  // Format last updated date (placeholder for now)
  const lastUpdated = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
  
  // Handle narration width change
  const handleNarrationWidthChange = (newWidth: number) => {
    if (onWidthUpdate) {
      onWidthUpdate(newWidth)
    }
  }
  
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
  
  // Node width - uses custom width for narration view, dynamic for cards
  const nodeWidth = viewMode === 'narration' ? customNarrationWidth : (() => {
    const cardWidth = 240
    const levelGap = 20
    const sidePadding = 24
    
    if (!hasItems) return 200
    
    const countHorizontalCards = (): number => {
      let totalCards = 0
      
      const traverse = (parentId: string | undefined): number => {
        const children = items.filter(item => item.parentId === parentId)
        if (children.length === 0) return 0
        
        let horizontalSum = 0
        children.forEach(child => {
          horizontalSum += 1
          if (child.expanded) {
            horizontalSum += traverse(child.id)
          }
        })
        return horizontalSum
      }
      
      totalCards = topLevelItems.length
      topLevelItems.forEach(item => {
        if (item.expanded) {
          totalCards += traverse(item.id)
        }
      })
      return totalCards
    }
    
    const columns = countHorizontalCards()
    return (columns * cardWidth) + ((columns - 1) * levelGap) + (sidePadding * 2)
  })()
  
  const sidePadding = 24
  
  // Helper to get background color based on level
  const getBackgroundColor = (level: number): string => {
    switch (level) {
      case 1: return 'bg-white'
      case 2: return 'bg-gray-100'
      case 3: return 'bg-gray-200'
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
        width: isExpanded ? nodeWidth : 320
      }}>
        {/* Label above node with tab-like background */}
        <div className="flex justify-center -mb-1 transition-all duration-300 ease-in-out" style={{ width: isExpanded ? nodeWidth : 320 }}>
          <div className={`px-8 py-3 rounded-t-xl flex items-center gap-2 transition-all  ${isLoading ? 'bg-gray-200 animate-pulse' : 'bg-gray-400'}`}>
            <div className="text-sm text-gray-700 uppercase tracking-widest font-sans font-bold">
              {label || (format ? format.toUpperCase() : 'STORY')}
            </div>
            
            {/* Expand/Collapse toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="p-1 rounded hover:bg-gray-500 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label="Toggle expand"
            >
              {isExpanded ? (
                /* Collapse icon */
                <ChevronDownIcon className="w-4 h-4 text-gray-700" />
              ) : (
                /* Expand icon */
                <ChevronRightIcon className="w-4 h-4 text-gray-700" />
              )}
            </button>
            
            {/* View mode toggle - only show when expanded */}
            {isExpanded && hasItems && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setViewMode(viewMode === 'narration' ? 'cards' : 'narration')
                }}
                className="p-1 rounded hover:bg-gray-500 transition-colors"
                title={`Switch to ${viewMode === 'narration' ? 'card' : 'narration'} view`}
                aria-label="Toggle view mode"
              >
                {viewMode === 'narration' ? (
                  /* Cards icon */
                  <svg className="w-3.5 h-3.5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                ) : (
                  /* Timeline icon */
                  <svg className="w-3.5 h-3.5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
                    <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
                    <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            )}
            
            {/* Panel indicator icon - three dots vertical - clickable */}
            <button
              onClick={(e) => {
                // Don't stop propagation - let it bubble to React Flow's node click handler
              }}
              className="p-1 rounded hover:bg-gray-500 transition-colors"
              title="Open structure panel"
              aria-label="Open structure panel"
            >
              <svg 
                className="w-4 h-4 text-gray-700" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" 
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Container - positioned in front of connector dots */}
        <div
          className={`relative transition-all duration-300 ease-in-out ${
            isExpanded ? (
              viewMode === 'narration' 
                ? '' 
                : `rounded-2xl overflow-visible ${isLoading ? 'bg-gray-200 animate-pulse' : 'bg-gray-400'} ${selected ? 'shadow-2xl' : 'shadow-md'}`
            ) : `rounded-2xl overflow-visible ${isLoading ? 'bg-gray-200 animate-pulse' : 'bg-gray-400'} ${selected ? 'shadow-2xl' : 'shadow-md'}`
          }`}
          style={{
            width: isExpanded ? nodeWidth : 320,
            minHeight: isExpanded ? (viewMode === 'narration' ? 'auto' : 200) : 'auto',
            paddingLeft: isExpanded ? (viewMode === 'narration' ? 0 : sidePadding) : 24,
            paddingRight: isExpanded ? (viewMode === 'narration' ? 0 : sidePadding) : 24,
            paddingTop: isExpanded ? (viewMode === 'narration' ? 0 : 20) : 20,
            paddingBottom: isExpanded ? (viewMode === 'narration' ? 0 : 20) : 20,
            boxSizing: 'border-box'
          }}
        >
        {!isExpanded ? (
          /* Collapsed View - Simple Metadata Card */
          <div className="flex flex-col gap-4">
            {/* Cover Image Placeholder */}
            <div className="w-full aspect-[3/2] rounded-lg bg-gray-300 flex items-center justify-center border-2 border-gray-500">
              <div className="text-center text-gray-600">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                <div className="text-xs font-medium">Cover Image</div>
                <div className="text-xs opacity-60">(Coming Soon)</div>
              </div>
            </div>
            
            {/* Story Name */}
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Story Name</div>
              <div className="text-base font-bold text-gray-900">
                {label || (format ? `${format} Story` : 'Untitled Story')}
              </div>
            </div>
            
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Last Updated</div>
                <div className="text-sm font-medium text-gray-800">{lastUpdated}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Total Words</div>
                <div className="text-sm font-medium text-gray-800">{totalWordCount.toLocaleString()}</div>
              </div>
            </div>
            
            {/* Open Content Canvas Button */}
            <button
              onClick={(e) => {
                // Don't stop propagation - let it bubble to open the panel
              }}
              className="w-full py-2.5 px-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Open Content Canvas
            </button>
          </div>
        ) : viewMode === 'narration' ? (
          /* Narration Arrangement View - DAW-style horizontal layout */
          <NarrationContainer
            items={items}
            onItemClick={(item) => {
              if (onItemClick) {
                onItemClick(item, items, format, id)
              }
            }}
            onItemsChange={onItemsUpdate}
            unitLabel="Words"
            isLoading={isLoading}
            initialWidth={customNarrationWidth}
            onWidthChange={handleNarrationWidthChange}
            format={format}
            availableAgents={availableAgents}
            onAgentAssign={onAgentAssign}
          />
        ) : hasItems ? (
          /* Card View - Horizontal tree structure */
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

