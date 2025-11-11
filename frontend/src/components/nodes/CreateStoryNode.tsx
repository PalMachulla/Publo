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
      
      {/* Top connector dot - centered at top of circle */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ top: '-10px', pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Bottom connector dot - centered at bottom of circle */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ top: '150px', pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Circular Ghostwriter Node */}
      <div
        className="relative cursor-pointer transition-all"
        style={{ width: 160, height: 160, zIndex: 1 }}
      >
        {/* SVG Circle */}
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          className="absolute inset-0"
          style={{ filter: selected ? 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
        >
          {/* Circle - solid gray background and outline */}
          <circle
            cx="80"
            cy="80"
            r="79"
            fill="#9ca3af"
            stroke="#9ca3af"
            strokeWidth="2"
          />
        </svg>
        
        {/* Content centered over circle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Magical wand icon - white, enlarged */}
          <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default memo(CreateStoryNode)

