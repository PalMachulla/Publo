'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { CreateStoryNodeData } from '@/types/nodes'

function CreateStoryNode({ data, selected }: NodeProps<CreateStoryNodeData>) {
  return (
    <div className="relative">
      {/* Handles on all sides for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      <Handle type="target" position={Position.Right} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      
      {/* Circular node */}
      <div
        className={`
          rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500
          flex items-center justify-center
          border-2 border-white shadow-lg
          transition-all duration-200 cursor-pointer
          hover:scale-105 hover:from-yellow-400 hover:to-yellow-600 hover:shadow-xl
          ${selected ? 'ring-4 ring-yellow-400 ring-opacity-50' : ''}
        `}
        style={{ width: 100, height: 100 }}
      >
        {/* Plus icon */}
        <svg 
          className="w-10 h-10 text-white" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={3} 
            d="M12 4v16m8-8H4" 
          />
        </svg>
      </div>
      
      {/* Label below */}
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <div className="text-xs font-semibold text-gray-700">
          Create Story
        </div>
      </div>
    </div>
  )
}

export default memo(CreateStoryNode)

