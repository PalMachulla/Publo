'use client'

import { useState, useRef, useEffect } from 'react'
import { StoryFormat } from '@/types/nodes'
// ✅ SINGLE SOURCE OF TRUTH: Import format metadata from schemas
import { FORMAT_METADATA, getFormatIcon } from '@/lib/orchestrator/schemas/formatMetadata'

interface StoryFormatMenuProps {
  onSelectFormat: (format: StoryFormat) => void
}

// Use format metadata from schemas (single source of truth)
// Map icons to w-5 h-5 for this component's smaller size
const storyFormats = FORMAT_METADATA.map(format => ({
  ...format,
  icon: getFormatIcon(format.type, 'w-5 h-5')
}))

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

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleFormatSelect = (format: StoryFormat) => {
    onSelectFormat(format)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Vertical expanding menu - single unified pill-shaped element */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header with button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-2 w-full hover:bg-gray-50 transition-colors"
        >
          {/* Small round button with yellow border */}
          <div className="w-8 h-8 rounded-full border-2 border-yellow-400 bg-white flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          
          {/* Text */}
          <div className="text-xs font-semibold text-gray-700 pr-2 whitespace-nowrap">Create Story</div>
        </button>

        {/* Expanded format types - positioned absolutely to not affect layout */}
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50">
            {storyFormats.map((format) => (
              <button
                key={format.type}
                onClick={() => handleFormatSelect(format.type)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 group"
              >
                <div className="mt-0.5 text-gray-500 group-hover:text-yellow-500 transition-colors">
                  {format.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 group-hover:text-yellow-600 transition-colors">
                    {format.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {format.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Export helper function to get icon for a specific format
// Re-export from schemas for backward compatibility
export { getFormatIcon }

