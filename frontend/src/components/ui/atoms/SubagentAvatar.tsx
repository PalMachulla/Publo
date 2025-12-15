/**
 * SubagentAvatar Atom
 * 
 * Icon/avatar for each subagent type in the Deep Agent system.
 * Shows visual identity: critic (magnifying glass), researcher (book/search)
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type SubagentType = 'critic' | 'researcher' | 'unknown'

export interface SubagentAvatarProps {
  type: SubagentType
  size?: 'sm' | 'md' | 'lg'
  isActive?: boolean
  className?: string
}

const sizeStyles = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

const iconSizes = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export function SubagentAvatar({ type, size = 'md', isActive = false, className }: SubagentAvatarProps) {
  const sizeClass = sizeStyles[size]
  const iconSize = iconSizes[size]
  
  const getColors = () => {
    switch (type) {
      case 'critic':
        return isActive 
          ? 'bg-amber-100 text-amber-600 ring-amber-200' 
          : 'bg-amber-50 text-amber-500'
      case 'researcher':
        return isActive 
          ? 'bg-blue-100 text-blue-600 ring-blue-200' 
          : 'bg-blue-50 text-blue-500'
      default:
        return isActive 
          ? 'bg-gray-100 text-gray-600 ring-gray-200' 
          : 'bg-gray-50 text-gray-500'
    }
  }
  
  const renderIcon = () => {
    switch (type) {
      case 'critic':
        // Magnifying glass / review icon
        return (
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )
      case 'researcher':
        // Book / research icon
        return (
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        )
      default:
        // Generic agent icon
        return (
          <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        )
    }
  }
  
  return (
    <div 
      className={cn(
        'rounded-full flex items-center justify-center',
        'transition-all duration-200',
        sizeClass,
        getColors(),
        isActive && 'ring-2 animate-pulse',
        className
      )}
      title={type.charAt(0).toUpperCase() + type.slice(1)}
    >
      {renderIcon()}
    </div>
  )
}

export default SubagentAvatar
