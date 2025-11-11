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
      
      {/* Top connector dot - yellow theme */}
      <div 
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-yellow-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Bottom connector dot - yellow theme */}
      <div 
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-yellow-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Circular Ghostwriter Node */}
      <div
        className={`relative bg-white rounded-full shadow-lg transition-all overflow-hidden cursor-pointer ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 120, height: 120, zIndex: 1 }}
      >
        <div className="w-full h-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex flex-col items-center justify-center gap-1">
          {/* Magical wand icon */}
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <div className="text-xs font-bold text-white tracking-wide">
            GHOSTWRITER
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(CreateStoryNode)

