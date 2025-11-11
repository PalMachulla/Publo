'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData } from '@/types/nodes'
import { getFormatIcon } from '@/components/StoryFormatMenu'
import { getPrimaryStructuralLevel } from '@/lib/documentHierarchy'
import { PencilIcon } from '@heroicons/react/24/outline'

function StoryStructureNode({ data, selected, id }: NodeProps<StoryStructureNodeData>) {
  const { format, items, label, onItemClick } = data
  const primaryLevel = format ? (getPrimaryStructuralLevel(format) || 'Item') : 'Item'
  
  // Get only top-level items (level 1)
  const topLevelItems = items?.filter(item => item.level === 1).sort((a, b) => a.order - b.order) || []
  const hasItems = topLevelItems.length > 0

  // Get format-specific icon
  const formatIcon = getFormatIcon(format)
  
  // Handle item click
  const handleItemClick = (item: typeof topLevelItems[0], event: React.MouseEvent) => {
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

      {/* Label above node with tab-like background - larger and with edit icon */}
      <div className="flex justify-center mb-0 relative z-10" style={{ width: nodeWidth }}>
        <div className="bg-gray-200 px-8 py-3 rounded-t-xl flex items-center gap-2 shadow-sm">
          <div className="text-xs text-gray-700 uppercase tracking-widest font-sans font-bold">
            {label || (format ? format.toUpperCase() : 'STORY')}
          </div>
          <PencilIcon className="w-4 h-4 text-gray-500" />
        </div>
      </div>

      {/* Bottom connector dot - positioned behind the shape */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ bottom: '-10px', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Main Container - positioned in front of connector dots */}
      <div
        className={`relative bg-gray-200 rounded-2xl shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{
          width: nodeWidth,
          height: 200,
          zIndex: 5,
          paddingLeft: `${sidePadding}px`,
          paddingRight: `${sidePadding}px`,
          paddingTop: '20px',
          paddingBottom: '20px'
        }}
      >
        {hasItems ? (
          /* Horizontal scrollable cards */
          <div className="flex gap-4 h-full overflow-x-auto">
            {topLevelItems.map((item, index) => (
              <div
                key={item.id}
                className="flex-shrink-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer group"
                style={{ width: 240, height: 160 }}
                onClick={(e) => handleItemClick(item, e)}
              >
                <div className="w-full h-full p-4 flex flex-col items-center justify-center gap-2">
                  <div className="text-sm font-bold text-gray-900 text-center">
                    {item.name}
                  </div>
                  {item.title && (
                    <div className="text-xs text-gray-600 text-center">
                      {item.title}
                    </div>
                  )}
                  {item.description && (
                    <div className="text-xs text-gray-500 text-center line-clamp-2 mt-2">
                      {item.description}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-auto">
                    Click to Write
                  </div>
                </div>
              </div>
            ))}
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

      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
    </div>
  )
}

export default memo(StoryStructureNode)

