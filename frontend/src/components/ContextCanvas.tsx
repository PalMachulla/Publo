'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export interface ContextCanvasData {
  placeholder?: string
}

function ContextCanvas({ data }: NodeProps<ContextCanvasData>) {
  const [input, setInput] = useState('')

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200" style={{ width: 600 }}>
        <div className="relative flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={data.placeholder || "What's your story, Morning Glory?"}
            className="flex-1 px-5 py-4 bg-gray-50 rounded-xl text-gray-700 placeholder-gray-400 italic focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-gray-200"
          />
          <button className="bg-yellow-400 hover:bg-yellow-500 p-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center">
            <svg 
              className="w-5 h-5 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M14 5l7 7m0 0l-7 7m7-7H3" 
              />
            </svg>
          </button>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
    </div>
  )
}

export default memo(ContextCanvas)

