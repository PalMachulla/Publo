'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { AIPromptNodeData } from '@/types/nodes'
import { MagicWandIcon } from '@radix-ui/react-icons'

const AIPromptNode = memo(({ data }: NodeProps<AIPromptNodeData>) => {
  return (
    <div className="relative w-32 h-32 rounded-full shadow-xl bg-gradient-to-br from-purple-600 to-purple-800 border-4 border-purple-400 flex items-center justify-center cursor-pointer hover:shadow-2xl transition-shadow">
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

      {/* Icon and Label */}
      <div className="flex flex-col items-center justify-center text-white">
        <MagicWandIcon className="w-12 h-12 text-purple-100 mb-2" />
        <div className="text-xs font-bold text-purple-100 uppercase tracking-wide text-center">
          {data.label || 'AI'}
        </div>
      </div>
    </div>
  )
})

AIPromptNode.displayName = 'AIPromptNode'

export default AIPromptNode
