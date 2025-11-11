'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { ClusterNodeData } from '@/types/nodes'
import { getNodeIcon, getNodeColor } from '@/lib/nodeIcons'

function ClusterNode({ data, selected }: NodeProps<ClusterNodeData>) {
  const icon = getNodeIcon('cluster')
  const colorClass = getNodeColor('cluster')
  
  return (
    <div className="relative">
      {/* Top handle for incoming connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      
      {/* Circular node */}
      <div
        className={`bg-white rounded-full shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 100, height: 100 }}
      >
        <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-1">
          <div className={`w-12 h-12 ${colorClass}`}>
            {icon}
          </div>
          <div className="text-[9px] text-gray-500 font-medium tracking-wider">
            CLUSTER
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(ClusterNode)

