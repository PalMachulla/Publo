'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData } from '@/types/nodes'
import { getFormatIcon } from '@/components/StoryFormatMenu'
import { getPrimaryStructuralLevel } from '@/lib/documentHierarchy'

function StoryStructureNode({ data, selected }: NodeProps<StoryStructureNodeData>) {
  const { format, items, label } = data
  const primaryLevel = format ? (getPrimaryStructuralLevel(format) || 'Item') : 'Item'
  const itemCount = items?.length || 0

  // Get format-specific icon (getFormatIcon handles undefined)
  const formatIcon = getFormatIcon(format)

  return (
    <div className="relative">
      {/* Label above node */}
      <div className="flex flex-col justify-end mb-2" style={{ width: 200, minHeight: 30 }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-sans text-left break-words leading-tight w-full">
          {label || (format ? format.toUpperCase() : 'STORY')}
        </div>
        <div className="mt-1 inline-block w-fit">
          <div className="bg-yellow-400 text-black text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full" style={{ paddingTop: '1px', paddingBottom: '1px' }}>
            {itemCount} {primaryLevel}{itemCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Top connector dot - half covered by card */}
      <div
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Bottom connector dot - half covered by card */}
      <div
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Main Card - Horizontal layout */}
      <div
        className={`relative bg-white rounded-lg shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 200, height: 120, zIndex: 1 }}
      >
        <div className="w-full h-full bg-gradient-to-br from-yellow-50 to-yellow-100 flex flex-col items-center justify-center gap-2 p-4">
          {/* Format-specific icon */}
          <div className="w-12 h-12 text-yellow-600">
            <div className="w-full h-full flex items-center justify-center scale-[2.4]">
              {formatIcon}
            </div>
          </div>

          <div className="text-[9px] text-gray-600 font-medium text-center">
            Click to Structure
          </div>
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

