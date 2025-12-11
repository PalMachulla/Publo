/**
 * ProcessStep Molecule
 * 
 * Single step in a process list, showing:
 * - Icon based on step type
 * - Description text
 * - Duration badge
 * - Status indicator (pending/running/complete)
 * 
 * Example:
 * [magnifying glass] Searched "content generation flow"     2s
 * [file icon] Read orchestrate.py L755-794                  1s
 * [brain] Analyzed writer_node structure                    3s
 * 
 * Composes: ProcessStepIcon, DurationBadge
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { ProcessStepIcon, ProcessStepType } from '../atoms/ProcessStepIcon'
import { DurationBadge } from '../atoms/DurationBadge'

export type ProcessStepStatus = 'pending' | 'running' | 'complete' | 'error'

export interface ProcessStepProps {
  /** Icon type for this step */
  type: ProcessStepType
  /** Description of what this step does */
  description: string
  /** Current status of this step */
  status: ProcessStepStatus
  /** When this step started (for duration) */
  startTime?: Date
  /** When this step completed */
  endTime?: Date
  /** Additional details (shown on hover or below) */
  details?: string
  /** Whether to show the duration */
  showDuration?: boolean
  className?: string
}

export function ProcessStep({
  type,
  description,
  status,
  startTime,
  endTime,
  details,
  showDuration = true,
  className
}: ProcessStepProps) {
  const isActive = status === 'running'
  const isComplete = status === 'complete'
  const isPending = status === 'pending'
  const isError = status === 'error'
  
  // Determine which icon to show based on status
  const iconType: ProcessStepType = 
    isPending ? 'pending' : 
    isActive ? 'running' : 
    isComplete ? 'check' : 
    type
  
  return (
    <div 
      className={cn(
        'flex items-center gap-2.5 py-1.5 px-2 rounded-md',
        'transition-colors duration-150',
        isActive && 'bg-indigo-50/50',
        isComplete && 'bg-green-50/30',
        isError && 'bg-red-50/50',
        className
      )}
    >
      {/* Step icon */}
      <div className="flex-shrink-0">
        <ProcessStepIcon 
          type={iconType} 
          isActive={isActive}
          size="sm"
        />
      </div>
      
      {/* Description */}
      <div className="flex-1 min-w-0">
        <span 
          className={cn(
            'text-sm',
            isPending && 'text-neutral-400',
            isActive && 'text-neutral-700 font-medium',
            isComplete && 'text-neutral-600',
            isError && 'text-red-600'
          )}
        >
          {description}
        </span>
        
        {/* Details (if provided) */}
        {details && (
          <p className="text-xs text-neutral-400 mt-0.5 truncate">
            {details}
          </p>
        )}
      </div>
      
      {/* Duration badge */}
      {showDuration && startTime && (isActive || isComplete) && (
        <div className="flex-shrink-0">
          <DurationBadge
            startTime={startTime}
            endTime={endTime}
            isActive={isActive}
            className={cn(
              isActive && 'text-indigo-500',
              isComplete && 'text-neutral-400'
            )}
          />
        </div>
      )}
    </div>
  )
}

/**
 * ProcessStepList - Container for multiple ProcessSteps
 */
export interface ProcessStepListProps {
  children: React.ReactNode
  className?: string
}

export function ProcessStepList({ children, className }: ProcessStepListProps) {
  return (
    <div 
      className={cn(
        'rounded-lg border border-neutral-100 bg-neutral-50/50 overflow-hidden',
        'divide-y divide-neutral-100',
        className
      )}
    >
      {children}
    </div>
  )
}

export default ProcessStep


