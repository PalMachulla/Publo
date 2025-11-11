'use client'

import { useState, useRef, useEffect } from 'react'
import { NodeType } from '@/types/nodes'

interface NodeTypeOption {
  type: NodeType
  label: string
  description: string
  icon: JSX.Element
}

const nodeTypes: NodeTypeOption[] = [
  {
    type: 'story',
    label: 'Story Book',
    description: 'Add a public domain book',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    type: 'docs',
    label: 'Documents',
    description: 'Upload PDFs, text files',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    type: 'character',
    label: 'Character',
    description: 'Create a persona',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    type: 'location',
    label: 'Location',
    description: 'Set a place on the map',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    type: 'research',
    label: 'Research',
    description: 'AI-powered web research',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
      </svg>
    ),
  },
  {
    type: 'cluster',
    label: 'Node Cluster',
    description: 'Group related nodes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="6" cy="5" r="1.5" strokeWidth={0} fill="currentColor" />
        <circle cx="12" cy="5" r="1.5" strokeWidth={0} fill="currentColor" />
        <circle cx="18" cy="5" r="1.5" strokeWidth={0} fill="currentColor" />
        <circle cx="12" cy="19" r="2" strokeWidth={0} fill="currentColor" />
        <line x1="12" y1="17" x2="12" y2="11" strokeWidth={2} strokeLinecap="round" />
        <line x1="12" y1="11" x2="6" y2="6.5" strokeWidth={2} strokeLinecap="round" />
        <line x1="12" y1="11" x2="12" y2="6.5" strokeWidth={2} strokeLinecap="round" />
        <line x1="12" y1="11" x2="18" y2="6.5" strokeWidth={2} strokeLinecap="round" />
      </svg>
    ),
  },
]

interface NodeTypeMenuProps {
  onSelectNodeType: (type: NodeType) => void
}

export default function NodeTypeMenu({ onSelectNodeType }: NodeTypeMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as HTMLElement)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (type: NodeType) => {
    onSelectNodeType(type)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Vertical expanding menu - single unified element */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header with button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-2 w-full hover:bg-gray-50 transition-colors"
        >
          {/* Small round button with 2px padding around it */}
          <div className="w-8 h-8 rounded-full border-2 border-yellow-400 bg-white flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          
          {/* Text */}
          <div className="text-xs font-semibold text-gray-700 pr-2">Add Node</div>
        </button>

        {/* Expanded node types */}
        {isOpen && (
          <div className="border-t border-gray-200">
            {nodeTypes.map((nodeType) => (
              <button
                key={nodeType.type}
                onClick={() => handleSelect(nodeType.type)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-start gap-3 group"
              >
                <div className="mt-0.5 text-gray-500 group-hover:text-yellow-500 transition-colors">
                  {nodeType.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 group-hover:text-yellow-600 transition-colors">
                    {nodeType.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {nodeType.description}
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

