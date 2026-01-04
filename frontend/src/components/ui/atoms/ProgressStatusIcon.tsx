/**
 * ProgressStatusIcon Atom
 * 
 * Status icons for orchestrator progress messages.
 * Uses Radix icons instead of emojis for a cleaner look.
 */

import React from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircledIcon,
  FileTextIcon,
  Pencil1Icon,
  CursorArrowIcon,
  GearIcon,
  CrossCircledIcon,
  ReloadIcon,
} from '@radix-ui/react-icons'

export type ProgressStatus = 
  | 'thinking'      // Agent is working
  | 'structure'     // Structure created
  | 'writing'       // Content being written
  | 'complete'      // Task complete
  | 'navigate'      // Navigating to section
  | 'error'         // Error occurred
  | 'progress'      // Generic progress

export interface ProgressStatusIconProps {
  status: ProgressStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
  animate?: boolean
}

const sizeStyles = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export function ProgressStatusIcon({ 
  status, 
  size = 'md', 
  className,
  animate = false 
}: ProgressStatusIconProps) {
  const sizeClass = sizeStyles[size]
  
  const baseClasses = cn(sizeClass, className)
  
  switch (status) {
    case 'thinking':
      return (
        <GearIcon 
          className={cn(baseClasses, 'text-neutral-500', animate && 'animate-spin')} 
        />
      )
    
    case 'structure':
      return (
        <FileTextIcon 
          className={cn(baseClasses, 'text-indigo-500')} 
        />
      )
    
    case 'writing':
      return (
        <Pencil1Icon 
          className={cn(baseClasses, 'text-amber-500', animate && 'animate-pulse')} 
        />
      )
    
    case 'complete':
      return (
        <CheckCircledIcon 
          className={cn(baseClasses, 'text-green-500')} 
        />
      )
    
    case 'navigate':
      return (
        <CursorArrowIcon 
          className={cn(baseClasses, 'text-neutral-500')} 
        />
      )
    
    case 'error':
      return (
        <CrossCircledIcon 
          className={cn(baseClasses, 'text-red-500')} 
        />
      )
    
    case 'progress':
      return (
        <ReloadIcon 
          className={cn(baseClasses, 'text-indigo-500', animate && 'animate-spin')} 
        />
      )
    
    default:
      return null
  }
}

export default ProgressStatusIcon
