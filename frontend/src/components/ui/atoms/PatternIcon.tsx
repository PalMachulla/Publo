/**
 * PatternIcon Atom
 * 
 * Icon for pattern types (style, structure, pacing)
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type PatternType = 'structure_template' | 'writing_style' | 'pacing' | 'unknown'

export interface PatternIconProps {
  type: PatternType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export function PatternIcon({ type, size = 'md', className }: PatternIconProps) {
  const sizeClass = sizeStyles[size]
  
  const getColor = () => {
    switch (type) {
      case 'structure_template':
        return 'text-blue-500'
      case 'writing_style':
        return 'text-purple-500'
      case 'pacing':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }
  
  const renderIcon = () => {
    switch (type) {
      case 'structure_template':
        // Grid/structure icon
        return (
          <svg className={cn(sizeClass, getColor())} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        )
      case 'writing_style':
        // Pen/style icon
        return (
          <svg className={cn(sizeClass, getColor())} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )
      case 'pacing':
        // Clock/pace icon
        return (
          <svg className={cn(sizeClass, getColor())} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className={cn(sizeClass, getColor())} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        )
    }
  }
  
  return renderIcon()
}

export default PatternIcon
