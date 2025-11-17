'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps, useEdges } from 'reactflow'
import { ClusterNodeData } from '@/types/nodes'
import { getNodeIcon } from '@/lib/nodeIcons'

// Helper function to determine if a color is light or dark
function isLightColor(color: string): boolean {
  // Convert hex to RGB
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

function ClusterNode({ data, selected, id }: NodeProps<ClusterNodeData>) {
  const edges = useEdges()
  const icon = getNodeIcon('cluster')
  const bgColor = data.color || '#9ca3af'
  const isLight = isLightColor(bgColor)
  const textColor = isLight ? '#374151' : '#ffffff'
  const label = data.label || 'CLUSTER'
  const isActive = data.isActive ?? true
  const agentName = data.agentNumber ? `AG${String(data.agentNumber).padStart(3, '0')}` : 'AGENT'
  
  // Calculate connected resources (incoming edges from non-orchestrator nodes)
  const connectedResourceCount = edges.filter(
    edge => edge.target === id && edge.source !== 'orchestrator'
  ).length
  
  const showResourceBadge = !data.showConnectedResources && connectedResourceCount > 0
  
  return (
    <div className="relative">
      {/* Top handle for incoming connections - invisible but functional */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      
      {/* Large connector dot behind node - half covered */}
      <div 
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0, backgroundColor: bgColor }}
      />
      
      {/* Circular node */}
      <div
        className={`relative bg-white rounded-full shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 100, height: 100, zIndex: 1 }}
      >
        <div 
          className="w-full h-full flex flex-col items-center justify-center gap-1"
          style={{ backgroundColor: bgColor }}
        >
          <div className="w-12 h-12" style={{ color: textColor }}>
            {icon}
          </div>
          <div className="text-[9px] font-medium tracking-wider" style={{ color: textColor }}>
            {agentName}
          </div>
        </div>
      </div>
      
      {/* Label below node */}
      <div className="flex flex-col items-center mt-2" style={{ width: 100 }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-sans text-center break-words leading-tight w-full">
          {label}
        </div>
        {/* Status badge */}
        <div className="mt-1 inline-block">
          <div 
            className={`text-white text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full ${
              isActive ? 'bg-green-500' : 'bg-gray-500'
            }`} 
            style={{ paddingTop: '1px', paddingBottom: '1px' }}
          >
            {isActive ? 'ACTIVE' : 'PASSIVE'}
          </div>
        </div>
        
        {/* Connected Resources Badge (shown when resources are hidden) */}
        {showResourceBadge && (
          <div className="mt-2 flex justify-center">
            <div 
              className="w-12 h-12 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-gray-300"
              title={`${connectedResourceCount} connected ${connectedResourceCount === 1 ? 'resource' : 'resources'}`}
            >
              {connectedResourceCount}
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom handle for outgoing connections - invisible but functional */}
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
    </div>
  )
}

export default memo(ClusterNode)

