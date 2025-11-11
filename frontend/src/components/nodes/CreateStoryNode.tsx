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
      
      {/* Hexagon Ghostwriter Node */}
      <div
        className="relative cursor-pointer transition-all"
        style={{ width: 140, height: 140, zIndex: 1 }}
      >
        {/* SVG Hexagon with rounded corners */}
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          className="absolute inset-0"
          style={{ filter: selected ? 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' : 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
        >
          <defs>
            <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          {/* Hexagon path with rounded corners */}
          <path
            d="M 70 5 L 115 32.5 Q 122 37 122 45 L 122 95 Q 122 103 115 107.5 L 70 135 Q 70 135 70 135 L 25 107.5 Q 18 103 18 95 L 18 45 Q 18 37 25 32.5 L 70 5 Z"
            fill="url(#yellowGradient)"
            stroke={selected ? '#facc15' : 'none'}
            strokeWidth={selected ? '3' : '0'}
          />
        </svg>
        
        {/* Content centered over hexagon */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
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

