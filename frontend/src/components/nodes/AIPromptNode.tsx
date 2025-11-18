'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { AIPromptNodeData } from '@/types/nodes'
import { MagicWandIcon } from '@radix-ui/react-icons'

const AIPromptNode = memo(({ data, selected }: NodeProps<AIPromptNodeData>) => {
  const isActive = data.isActive ?? true
  const label = data.label || 'AI'
  
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        id="ai-prompt-input"
        className="!w-3 !h-3 !bg-purple-300 !border-2 !border-purple-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="ai-prompt-output"
        className="!w-3 !h-3 !bg-purple-300 !border-2 !border-purple-500"
      />

      {/* Circular node */}
      <div
        className={`relative bg-gradient-to-br from-purple-600 to-purple-800 rounded-full shadow-lg transition-all overflow-hidden cursor-pointer hover:shadow-2xl ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        }`}
        style={{ width: 100, height: 100, zIndex: 1 }}
      >
        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
          <MagicWandIcon className="w-12 h-12 text-purple-100" />
          <div className="text-[9px] font-medium tracking-wider text-purple-100">
            AI PROMPT
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
      </div>
      
      {/* Bottom connector dot */}
      <div 
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-lg bg-purple-600"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
    </div>
  )
})

AIPromptNode.displayName = 'AIPromptNode'

export default AIPromptNode
