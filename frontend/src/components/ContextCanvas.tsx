'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { useCanvas } from '@/contexts/CanvasContext'

export interface ContextCanvasData {
  placeholder?: string
}

interface Story {
  id: string
  title: string
  lastEdited: string
  preview: string
}

function ContextCanvas({ data }: NodeProps<ContextCanvasData>) {
  const { onPromptSubmit } = useCanvas()

  // Mock stories for now - will be replaced with real data later
  const stories: Story[] = [
    {
      id: '1',
      title: 'The Morning Glory Chronicles',
      lastEdited: '2 hours ago',
      preview: 'A tale of wonder and discovery in a world where dreams become reality...'
    },
    {
      id: '2',
      title: 'Untitled Story',
      lastEdited: 'Yesterday',
      preview: 'In the beginning, there was nothing but silence and the vast expanse of...'
    },
    {
      id: '3',
      title: 'Character Development Notes',
      lastEdited: '3 days ago',
      preview: 'Main character: Sarah - A curious investigator with a mysterious past...'
    }
  ]

  const handleCreateStory = () => {
    if (onPromptSubmit) {
      onPromptSubmit('Create a new story')
    }
  }

  const handleOpenStory = (story: Story) => {
    console.log('Opening story:', story.title)
    // TODO: Implement story opening logic
  }

  return (
    <div className="relative">
      {/* Only top connector to receive connections from story nodes */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white !opacity-0" />
      
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden" style={{ width: 700 }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-lg font-semibold text-gray-900">Story Explorer</h2>
          <p className="text-xs text-gray-500 mt-1">Choose a story or create a new one</p>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {/* Create New Story Card */}
          <button
            onClick={handleCreateStory}
            className="w-full mb-4 p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-yellow-400 hover:bg-yellow-50 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-400 group-hover:bg-yellow-500 flex items-center justify-center transition-colors">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-base font-semibold text-gray-900 group-hover:text-yellow-700 transition-colors">
                  Create New Story
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Start with a blank canvas or from a prompt
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400 group-hover:text-yellow-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 uppercase tracking-wide">Recent Stories</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Story List */}
          <div className="space-y-2">
            {stories.map((story) => (
              <button
                key={story.id}
                onClick={() => handleOpenStory(story)}
                className="w-full p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left group bg-white hover:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {story.title}
                      </h4>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {story.lastEdited}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {story.preview}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(ContextCanvas)

