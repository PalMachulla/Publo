/**
 * AIPromptPanel
 * 
 * 2024-12-14: Extracted from NodeDetailsPanel.tsx as part of panel architecture refactor
 * 
 * Configuration panel for AI Prompt nodes. Allows users to configure:
 * - Active/Passive mode
 * - User prompt text
 * - Max tokens
 * - View last generation info
 */
'use client'

import { Node } from 'reactflow'
import { AIPromptNodeData } from '@/types/nodes'

interface AIPromptPanelProps {
  node: Node<AIPromptNodeData>
  onUpdate: (nodeId: string, data: any) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

export default function AIPromptPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: AIPromptPanelProps) {
  const nodeData = node.data
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-purple-500 flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{nodeData.label || 'AI Prompt'}</h2>
            <p className="text-sm text-purple-600">Configure AI generation</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Active/Passive Toggle */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Mode</h4>
              <p className="text-xs text-gray-600">
                {nodeData.isActive !== false 
                  ? 'Active: User prompt will be sent to AI' 
                  : 'Passive: Only system prompt (no user input)'}
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className={`text-sm font-medium ${
                nodeData.isActive !== false ? 'text-green-600' : 'text-gray-500'
              }`}>
                {nodeData.isActive !== false ? 'Active' : 'Passive'}
              </span>
              <button
                onClick={() => onUpdate(node.id, { isActive: !(nodeData.isActive !== false) })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  nodeData.isActive !== false ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    nodeData.isActive !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* User Prompt */}
        <div className={`${nodeData.isActive === false ? 'opacity-50' : ''}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Prompt
          </label>
          <textarea
            value={nodeData.userPrompt || ''}
            onChange={(e) => onUpdate(node.id, { userPrompt: e.target.value })}
            disabled={nodeData.isActive === false}
            placeholder="Describe your story... (e.g., A thriller about AI gone wrong in a small coastal town)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={6}
          />
          <p className="mt-2 text-xs text-gray-500">
            {nodeData.isActive !== false 
              ? 'This prompt will be sent to the AI model to generate your story structure.' 
              : 'Disabled in passive mode. AI will generate based on system prompt only.'}
          </p>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Tokens
          </label>
          <input
            type="number"
            value={nodeData.maxTokens || 2000}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10)
              if (!isNaN(value)) {
                onUpdate(node.id, { maxTokens: Math.min(Math.max(value, 100), 16000) })
              }
            }}
            min={100}
            max={16000}
            step={100}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Recommended: 2000-4000 for detailed structures
            </p>
            <p className="text-xs text-gray-400">
              Max: 16,000
            </p>
          </div>
        </div>

        {/* Last Generation Info */}
        {nodeData.lastGeneration && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-purple-900 mb-2">Last Generation</h4>
            <div className="space-y-1 text-xs text-purple-700">
              <div className="flex justify-between">
                <span className="text-purple-600">Timestamp:</span>
                <span className="font-medium">
                  {new Date(nodeData.lastGeneration.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-600">Model:</span>
                <span className="font-medium">{nodeData.lastGeneration.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-600">Format:</span>
                <span className="font-medium capitalize">
                  {nodeData.lastGeneration.format}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">How to Use</h4>
          <ol className="space-y-2 text-xs text-blue-700">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>Connect this node to an <strong>Orchestrator</strong> node</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">2.</span>
              <span>Enter your story prompt above</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">3.</span>
              <span>Click the Orchestrator to select a model and format</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">4.</span>
              <span>Click <strong>&quot;Generate Structure&quot;</strong> in the Orchestrator panel</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 space-y-3">
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          Close
        </button>
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this AI Prompt node?')) {
              onDelete(node.id)
              onClose()
            }
          }}
          className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Node
        </button>
      </div>
    </div>
  )
}
