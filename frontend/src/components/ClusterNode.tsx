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
      {/* Top handle for incoming connections - invisible but functional */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      
      {/* Large connector dot behind node - half covered */}
      <div 
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Circular node */}
      <div
        className={`relative bg-white rounded-full shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 100, height: 100, zIndex: 1 }}
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

