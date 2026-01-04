/**
 * PreferenceChip Atom
 * 
 * Small tag showing a learned preference (e.g., "dialogue-heavy")
 */

import React from 'react'
import { cn } from '@/lib/utils'

export interface PreferenceChipProps {
  label: string
  value?: string
  onRemove?: () => void
  className?: string
}

export function PreferenceChip({ label, value, onRemove, className }: PreferenceChipProps) {
  return (
    <span 
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        'bg-purple-100 text-purple-700 border border-purple-200',
        className
      )}
    >
      <span className="font-medium">{label}</span>
      {value && (
        <>
          <span className="text-purple-400">:</span>
          <span className="text-purple-600">{value}</span>
        </>
      )}
      {onRemove && (
        <button 
          onClick={onRemove}
          className="ml-1 hover:text-purple-900 transition-colors"
          title="Remove preference"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}

export default PreferenceChip
