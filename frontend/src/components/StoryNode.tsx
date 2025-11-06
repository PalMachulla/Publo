'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { AnyNodeData, NodeType } from '@/types/nodes'
import { getNodeIcon, getNodeColor } from '@/lib/nodeIcons'

function StoryNode({ data, selected }: NodeProps<AnyNodeData>) {
  const nodeType = (data as any).nodeType || 'story'
  const icon = getNodeIcon(nodeType as NodeType)
  const colorClass = getNodeColor(nodeType as NodeType)
  
  return (
    <div className="relative">
      {/* Label above card */}
      <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-sans text-center">
        {data.label}
      </div>
      
      {/* Card */}
      <div
        className={`bg-white rounded-lg shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 90, height: 120 }}
      >
        {data.image ? (
          <div className="w-full h-full">
            <img src={data.image} alt={data.label} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
            <div className={`w-12 h-12 ${colorClass}`}>
              {icon}
            </div>
          </div>
        )}
      </div>
      
      {/* Only bottom connector */}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
    </div>
  )
}

export default memo(StoryNode)

