'use client'

import { memo } from 'react'

export type SidebarView = 'tree' | 'narration'

interface SidebarViewToggleProps {
  value: SidebarView
  onChange: (view: SidebarView) => void
}

function SidebarViewToggle({ value, onChange }: SidebarViewToggleProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onChange('tree')}
        className={`
          flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all
          ${value === 'tree'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
          }
        `}
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Tree
        </span>
      </button>
      <button
        onClick={() => onChange('narration')}
        className={`
          flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all
          ${value === 'narration'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
          }
        `}
      >
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Cards
        </span>
      </button>
    </div>
  )
}

export default memo(SidebarViewToggle)

