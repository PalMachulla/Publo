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
      
      {/* Large connector dot with plus sign */}
      <div 
        className="absolute -top-8 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gray-400 border-2 border-white shadow-lg z-10 flex items-center justify-center"
        style={{ pointerEvents: 'none' }}
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      
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

