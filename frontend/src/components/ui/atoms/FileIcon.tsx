/**
 * FileIcon Atom
 * 
 * Icon based on file type/extension
 */

import React from 'react'
import { cn } from '@/lib/utils'

export interface FileIconProps {
  filename: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export function FileIcon({ filename, size = 'md', className }: FileIconProps) {
  const sizeClass = sizeStyles[size]
  
  const getExtension = () => {
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop()?.toLowerCase() : ''
  }
  
  const ext = getExtension()
  
  const getColor = () => {
    switch (ext) {
      case 'json':
        return 'text-yellow-500'
      case 'txt':
      case 'md':
        return 'text-gray-500'
      case 'js':
      case 'ts':
        return 'text-blue-500'
      default:
        return 'text-gray-400'
    }
  }
  
  // Folder icon for directories
  if (!ext || filename.endsWith('/')) {
    return (
      <svg className={cn(sizeClass, 'text-amber-400', className)} fill="currentColor" viewBox="0 0 20 20">
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    )
  }
  
  // File icon
  return (
    <svg className={cn(sizeClass, getColor(), className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
      />
    </svg>
  )
}

export default FileIcon
