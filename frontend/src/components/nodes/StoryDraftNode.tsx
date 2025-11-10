'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryDraftNodeData } from '@/types/nodes'
import { getFormatIcon } from '@/components/StoryFormatMenu'

function StoryDraftNode({ data, selected }: NodeProps<StoryDraftNodeData>) {
  const { title, status, format } = data
  
  // Status badge colors
  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return (
          <div className="mt-1 inline-block w-fit">
            <div className="bg-blue-500 text-white text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full" style={{ paddingTop: '1px', paddingBottom: '1px' }}>
              ACTIVE
            </div>
          </div>
        )
      case 'published':
        return (
          <div className="mt-1 inline-block w-fit">
            <div className="bg-green-500 text-white text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full" style={{ paddingTop: '1px', paddingBottom: '1px' }}>
              PUBLISHED
            </div>
          </div>
        )
      case 'draft':
      default:
        return (
          <div className="mt-1 inline-block w-fit">
            <div className="bg-gray-400 text-white text-[8px] font-semibold uppercase tracking-wide px-2 rounded-full" style={{ paddingTop: '1px', paddingBottom: '1px' }}>
              DRAFT
            </div>
          </div>
        )
    }
  }

  return (
    <div className="relative">
      {/* Label above card - matching other node types */}
      <div className="flex flex-col justify-end mb-2" style={{ width: 90, minHeight: 30 }}>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-sans text-left break-words leading-tight w-full">
          {title || 'Untitled Story'}
        </div>
        {getStatusBadge()}
      </div>
      
      {/* Card - matching other node styling */}
      <div
        className={`bg-white rounded-lg shadow-lg transition-all overflow-hidden ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 90, height: 120 }}
      >
        <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center gap-2">
          {/* Format-specific icon */}
          <div className="w-12 h-12 text-gray-400">
            {format ? getFormatIcon(format) : (
              // Fallback for nodes without format
              <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
          
          <div className="text-[9px] text-gray-400 font-light">
            Click to Edit
          </div>
        </div>
      </div>
      
      {/* Only bottom connector - matching other nodes */}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
    </div>
  )
}

export default memo(StoryDraftNode)

