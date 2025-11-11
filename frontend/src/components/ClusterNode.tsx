'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { ClusterNodeData } from '@/types/nodes'
import { getNodeIcon, getNodeColor } from '@/lib/nodeIcons'

function ClusterNode({ data, selected }: NodeProps<ClusterNodeData>) {
  const icon = getNodeIcon('cluster')
  const colorClass = getNodeColor('cluster')
  const label = data.label || 'CLUSTER'
  const nodeCount = data.clusterNodes?.length || 0
  
  return (
    <div className="relative">
      {/* Label above node */}
      <div className="flex flex-col items-center mb-2" style={{ width: 100 }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-sans text-center break-words leading-tight w-full">
          {label}
        </div>
        {nodeCount > 0 && (
          <div className="mt-1 inline-block">
            <div className="bg-orange-100 text-orange-700 text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full" style={{ paddingTop: '1px', paddingBottom: '1px' }}>
              {nodeCount} {nodeCount === 1 ? 'NODE' : 'NODES'}
            </div>
          </div>
        )}
      </div>
      
      {/* Top handle for incoming connections */}
      <Handle type="target" position={Position.Top} className="!bg-orange-400 !w-2 !h-2 !border-2 !border-white" />
      
      {/* Circular node */}
      <div
        className={`bg-white rounded-full shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-orange-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 100, height: 100 }}
      >
        <div className="w-full h-full bg-gradient-to-br from-orange-50 to-orange-100 flex flex-col items-center justify-center gap-1">
          <div className={`w-10 h-10 ${colorClass}`}>
            {icon}
          </div>
          <div className="text-[9px] text-gray-400 font-light">
            Click to Edit
          </div>
        </div>
      </div>
      
      {/* Bottom handle for outgoing connections */}
      <Handle type="source" position={Position.Bottom} className="!bg-orange-400 !w-2 !h-2 !border-2 !border-white" />
    </div>
  )
}

export default memo(ClusterNode)

