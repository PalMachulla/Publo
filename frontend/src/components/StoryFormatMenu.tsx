'use client'

import { useState, useRef, useEffect } from 'react'

export type StoryFormat = 'novel' | 'report' | 'short-story' | 'article' | 'screenplay' | 'essay'

interface StoryFormatOption {
  type: StoryFormat
  label: string
  description: string
  icon: JSX.Element
}

interface StoryFormatMenuProps {
  onSelectFormat: (format: StoryFormat) => void
}

const storyFormats: StoryFormatOption[] = [
  {
    type: 'novel',
    label: 'Novel',
    description: 'Long-form narrative fiction',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    )
  },
  {
    type: 'short-story',
    label: 'Short Story',
    description: 'Brief narrative fiction',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    )
  },
  {
    type: 'report',
    label: 'Report',
    description: 'Structured analysis document',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    type: 'article',
    label: 'Article',
    description: 'Editorial or blog post',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    )
  },
  {
    type: 'screenplay',
    label: 'Screenplay',
    description: 'Script for film or TV',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    )
  },
  {
    type: 'essay',
    label: 'Essay',
    description: 'Opinion or argumentative piece',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  }
]

export default function StoryFormatMenu({ onSelectFormat }: StoryFormatMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleFormatSelect = (format: StoryFormat) => {
    onSelectFormat(format)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Yellow Circle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500
          flex items-center justify-center
          border-2 border-white shadow-lg
          transition-all duration-200 cursor-pointer
          hover:scale-105 hover:from-yellow-400 hover:to-yellow-600 hover:shadow-xl
          ${isOpen ? 'ring-4 ring-yellow-400 ring-opacity-50' : ''}
        `}
        style={{ width: 60, height: 60 }}
        title="Create Story"
      >
        <svg
          className="w-7 h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Label below */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        <div className="text-xs font-semibold text-gray-700">
          Create Story
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-8 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">Choose Story Format</h3>
            <p className="text-xs text-gray-500 mt-0.5">Select a template to start writing</p>
          </div>

          <div className="max-h-96 overflow-y-auto py-2">
            {storyFormats.map((format) => (
              <button
                key={format.type}
                onClick={() => handleFormatSelect(format.type)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center text-yellow-600">
                  {format.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{format.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{format.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

