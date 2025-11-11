'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { CreateStoryNodeData } from '@/types/nodes'

function CreateStoryNode({ data, selected }: NodeProps<CreateStoryNodeData>) {
  return (
    <div className="relative">
      {/* Handles on all sides for connections - invisible but functional */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="target" position={Position.Right} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      
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
      
      {/* Create Story Button */}
      <div className="relative" style={{ zIndex: 1 }}>
        <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50 transition-colors">
            {/* Small round button with yellow border */}
            <div className={`w-8 h-8 rounded-full border-2 ${selected ? 'border-yellow-500 bg-yellow-50' : 'border-yellow-400 bg-white'} flex items-center justify-center flex-shrink-0`}>
              <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>

            {/* Text */}
            <div className="text-xs font-semibold text-gray-700 pr-2 whitespace-nowrap">Create Story</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(CreateStoryNode)

