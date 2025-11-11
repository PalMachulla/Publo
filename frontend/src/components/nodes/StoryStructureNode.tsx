'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData } from '@/types/nodes'
import { getFormatIcon } from '@/components/StoryFormatMenu'
import { getPrimaryStructuralLevel } from '@/lib/documentHierarchy'

function StoryStructureNode({ data, selected }: NodeProps<StoryStructureNodeData>) {
  const { format, items, label } = data
  const primaryLevel = format ? (getPrimaryStructuralLevel(format) || 'Item') : 'Item'
  
  // Get only top-level items (level 1)
  const topLevelItems = items?.filter(item => item.level === 1).sort((a, b) => a.order - b.order) || []
  const hasItems = topLevelItems.length > 0

  // Get format-specific icon
  const formatIcon = getFormatIcon(format)

  // Calculate width based on number of items (minimum 200px for empty state)
  const cardWidth = 260 // Width per item card
  const cardPadding = 20 // Padding on sides
  const nodeWidth = hasItems ? (topLevelItems.length * cardWidth) + (cardPadding * 2) : 200

  return (
    <div className="relative">
      {/* Label above node */}
      <div className="flex flex-col justify-end mb-2" style={{ width: nodeWidth, minHeight: 30 }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-sans text-center break-words leading-tight w-full">
          {label || (format ? format.toUpperCase() : 'STORY')}
        </div>
      </div>

      {/* Top connector dot */}
      <div
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Bottom connector dot */}
      <div
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Main Container */}
      <div
        className={`relative bg-gray-200 rounded-2xl shadow-lg transition-all overflow-visible ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: nodeWidth, height: 200, zIndex: 1, padding: '20px' }}
      >
        {hasItems ? (
          /* Horizontal scrollable cards */
          <div className="flex gap-4 h-full overflow-x-auto">
            {topLevelItems.map((item, index) => (
              <div
                key={item.id}
                className="flex-shrink-0 bg-white rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer group"
                style={{ width: 240, height: 160 }}
                onClick={(e) => {
                  e.stopPropagation()
                  // This will be handled by the canvas to open AI Document Panel
                  console.log('Item clicked:', item)
                }}
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

