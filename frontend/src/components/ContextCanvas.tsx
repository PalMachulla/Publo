'use client'

import { memo, useState, useEffect } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'

export interface ContextCanvasData {
  placeholder?: string
  onSubmitPrompt?: (prompt: string) => void
}

function ContextCanvas({ data }: NodeProps<ContextCanvasData>) {
  const [input, setInput] = useState('')
  const [showMessage, setShowMessage] = useState(false)

  const handleSubmit = () => {
    if (input.trim()) {
      // Call the onSubmitPrompt callback if provided
      if (data.onSubmitPrompt) {
        data.onSubmitPrompt(input)
        setInput('') // Clear input after submitting
      } else {
        setShowMessage(true)
        // Auto-hide after 3 seconds
        setTimeout(() => {
          setShowMessage(false)
        }, 3000)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="relative">
      {/* Only top connector to receive connections from story nodes */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white !opacity-0" />
      
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200" style={{ width: 600 }}>
        <div className="relative flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={data.placeholder || "What's your story, Morning Glory?"}
            className="flex-1 px-5 py-4 bg-gray-50 rounded-xl text-gray-700 placeholder-gray-400 italic focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-gray-200"
          />
          <button 
            onClick={handleSubmit}
            className="bg-yellow-400 hover:bg-yellow-500 p-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center"
          >
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

      {/* Message Card */}
      {showMessage && (
        <div 
          className="absolute top-1/2 -translate-y-1/2 -right-4 translate-x-full bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-64 animate-fade-in"
          style={{ zIndex: 1000 }}
        >
          <p className="text-gray-600 text-center italic">
            Patience, stories will come soon...
          </p>
        </div>
      )}
    </div>
  )
}

export default memo(ContextCanvas)

