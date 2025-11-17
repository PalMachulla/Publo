'use client'

import { memo, useCallback } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { AIPromptNodeData } from '@/types/nodes'
import { MagicWandIcon } from '@radix-ui/react-icons'

const AIPromptNode = memo(({ data, id }: NodeProps<AIPromptNodeData>) => {
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (data.onUpdate) {
      data.onUpdate(id, { userPrompt: e.target.value })
    }
  }, [data, id])

  const handleMaxTokensChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value) && data.onUpdate) {
      data.onUpdate(id, { maxTokens: Math.min(Math.max(value, 100), 16000) })
    }
  }, [data, id])

  return (
    <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-xl border-2 border-purple-400 min-w-[320px] max-w-[400px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-400/30 bg-purple-600/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-400/30 flex items-center justify-center">
            <MagicWandIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-white text-sm">AI Prompt</div>
            <div className="text-xs text-purple-100">Generate with AI</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="nodrag p-4 space-y-3">
        {/* User Prompt */}
        <div>
          <label className="block text-xs font-medium text-purple-100 mb-1.5">
            Your Prompt
          </label>
          <textarea
            value={data.userPrompt || ''}
            onChange={handlePromptChange}
            placeholder="Describe your story... (e.g., A thriller about AI gone wrong)"
            className="nodrag w-full px-3 py-2 bg-white/10 border border-purple-300/30 rounded-lg text-sm text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-xs font-medium text-purple-100 mb-1.5">
            Max Tokens
          </label>
          <input
            type="number"
            value={data.maxTokens || 2000}
            onChange={handleMaxTokensChange}
            min={100}
            max={16000}
            step={100}
            className="nodrag w-full px-3 py-2 bg-white/10 border border-purple-300/30 rounded-lg text-sm text-white placeholder-purple-200/50 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent"
          />
          <div className="text-xs text-purple-200/70 mt-1">
            Default: 2000 • Max: 16000
          </div>
        </div>

        {/* Last Generation Info */}
        {data.lastGeneration && (
          <div className="pt-2 border-t border-purple-400/20">
            <div className="text-xs text-purple-100/70">
              Last generated: {new Date(data.lastGeneration.timestamp).toLocaleString()}
            </div>
            <div className="text-xs text-purple-100/70">
              Model: {data.lastGeneration.model}
            </div>
          </div>
        )}
      </div>

      {/* Connection Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="ai-prompt-output"
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
      />
    </div>
  )
})

AIPromptNode.displayName = 'AIPromptNode'

export default AIPromptNode

