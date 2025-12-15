/**
 * FileListItem Molecule
 * 
 * File with icon, name, and optional metadata.
 * 
 * Composes: FileIcon
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { FileIcon } from '../atoms/FileIcon'

export interface FileListItemProps {
  name: string
  path?: string
  size?: number
  modifiedAt?: string
  onClick?: () => void
  className?: string
}

export function FileListItem({ 
  name, 
  path, 
  size, 
  modifiedAt, 
  onClick, 
  className 
}: FileListItemProps) {
  const isFolder = name.endsWith('/') || !name.includes('.')
  
  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md',
        'text-left transition-colors',
        'hover:bg-neutral-100',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <FileIcon filename={name} size="sm" />
      
      <div className="flex-1 min-w-0">
        <span className="text-sm text-neutral-700 truncate block">
          {name}
        </span>
        {path && path !== name && (
          <span className="text-xs text-neutral-400 truncate block">
            {path}
          </span>
        )}
      </div>
      
      {(size || modifiedAt) && (
        <div className="flex-shrink-0 text-right">
          {size !== undefined && (
            <span className="text-xs text-neutral-400">
              {formatSize(size)}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

export default FileListItem
