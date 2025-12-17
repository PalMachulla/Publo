/**
 * SectionStatusIcon Atom
 * 
 * Status icons for structure sections during content generation.
 * Shows visual state: pending, writing, complete.
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type SectionStatus = 'pending' | 'writing' | 'complete'

export interface SectionStatusIconProps {
  status: SectionStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export function SectionStatusIcon({ status, size = 'md', className }: SectionStatusIconProps) {
  const sizeClass = sizeStyles[size]
  
  switch (status) {
    case 'pending':
      return (
        <div 
          className={cn(
            'rounded-full border-2 border-neutral-300 bg-white',
            sizeClass,
            className
          )}
          title="Pending"
        />
      )
    
    case 'writing':
      return (
        <div 
          className={cn(
            'rounded-full border-2 border-amber-500 bg-amber-50 flex items-center justify-center',
            sizeClass,
            className
          )}
          title="Writing"
        >
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        </div>
      )
    
    case 'complete':
      return (
        <div 
          className={cn(
            'rounded-full bg-green-500 flex items-center justify-center',
            sizeClass,
            className
          )}
          title="Complete"
        >
          <svg 
            className="w-3 h-3 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={3} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
        </div>
      )
    
    default:
      return null
  }
}

export default SectionStatusIcon
