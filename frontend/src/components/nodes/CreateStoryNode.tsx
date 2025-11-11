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
      
      {/* Top connector dot - centered at handle connection point */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ top: '-10px', pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Bottom connector dot - centered at handle connection point */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ top: '150px', pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Hexagon Ghostwriter Node */}
      <div
        className="relative cursor-pointer transition-all"
        style={{ width: 160, height: 160, zIndex: 1 }}
      >
        {/* SVG Hexagon with rounded corners */}
        <svg
          width="160"
          height="160"
          viewBox="0 0 160 160"
          className="absolute inset-0"
          style={{ filter: selected ? 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
        >
          {/* Hexagon path with rounded corners - gray background with gray outline */}
          <path
            d="M 80 0 L 132 30 Q 140 35 140 44 L 140 116 Q 140 125 132 130 L 80 160 Q 80 160 80 160 L 28 130 Q 20 125 20 116 L 20 44 Q 20 35 28 30 L 80 0 Z"
            fill="#f3f4f6"
            stroke="#9ca3af"
            strokeWidth="2"
          />
        </svg>
        
        {/* Content centered over hexagon */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
          {/* Magical wand icon - yellow */}
          <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <div className="text-xs font-bold text-gray-500 tracking-wide">
            GHOSTWRITER
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(CreateStoryNode)

