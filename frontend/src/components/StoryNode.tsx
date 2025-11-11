'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { AnyNodeData, NodeType } from '@/types/nodes'
import { getNodeIcon, getNodeColor } from '@/lib/nodeIcons'

function StoryNode({ data, selected }: NodeProps<AnyNodeData>) {
  const nodeData = data as any
  const nodeType = nodeData.nodeType || 'story'
  const icon = getNodeIcon(nodeType as NodeType)
  const colorClass = getNodeColor(nodeType as NodeType)
  const label = nodeData.label || 'NODE'
  const image = nodeData.image
  const role = (nodeType === 'character' || nodeType === 'story') ? nodeData.role : null
  
  return (
    <div className="relative">
      {/* Label above card - fixed height container with text at bottom */}
      <div className="flex flex-col justify-end mb-2" style={{ width: 90, minHeight: 30 }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-sans text-left break-words leading-tight w-full">
          {label}
        </div>
        {role && (
          <div className="mt-1 inline-block w-fit">
            <div className="bg-yellow-400 text-black text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full" style={{ paddingTop: '1px', paddingBottom: '1px' }}>
              {role}
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom connector dot - half covered by card */}
      <div 
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Card */}
      <div
        className={`relative bg-white rounded-lg shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 90, height: 120, zIndex: 1 }}
      >
        {image ? (
          <div className="w-full h-full">
            <img src={image} alt={label} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-2">
            <div className={`w-12 h-12 ${colorClass}`}>
              {icon}
            </div>
            <div className="text-[9px] text-gray-400 font-light">
              Click to Edit
            </div>
          </div>
        )}
      </div>
      
      {/* Only bottom connector - invisible but functional */}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
    </div>
  )
}

export default memo(StoryNode)

