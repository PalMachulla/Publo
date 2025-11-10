'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryDraftNodeData } from '@/types/nodes'

function StoryDraftNode({ data, selected }: NodeProps<StoryDraftNodeData>) {
  const { title, status } = data
  
  // Status colors
  const getBorderColor = () => {
    switch (status) {
      case 'draft':
        return 'border-gray-400'
      case 'active':
        return 'border-blue-500'
      case 'published':
        return 'border-green-500'
      default:
        return 'border-gray-400'
    }
  }
  
  const getStatusColor = () => {
    switch (status) {
      case 'draft':
        return 'bg-gray-400'
      case 'active':
        return 'bg-blue-500'
      case 'published':
        return 'bg-green-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="relative">
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      
      {/* Circular node */}
      <div
        className={`
          rounded-full bg-white bg-gradient-to-br from-white to-gray-50
          flex items-center justify-center relative
          border-3 ${getBorderColor()}
          transition-all duration-200 cursor-pointer
          hover:shadow-lg
          ${selected ? 'ring-4 ring-blue-400 ring-opacity-50 shadow-xl' : 'shadow-md'}
        `}
        style={{ 
          width: 70, 
          height: 70,
          borderWidth: '3px'
        }}
      >
        {/* Document icon background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        
        {/* Title */}
        <div className="text-[10px] font-medium text-gray-900 text-center px-2 leading-tight line-clamp-3 relative z-10">
          {title || 'Untitled'}
        </div>
        
        {/* Status badge */}
        <div 
          className={`absolute top-0 right-0 ${getStatusColor()} rounded-full`}
          style={{ 
            width: 8, 
            height: 8,
            transform: 'translate(2px, -2px)'
          }}
          title={status.charAt(0).toUpperCase() + status.slice(1)}
        />
      </div>
    </div>
  )
}

export default memo(StoryDraftNode)

