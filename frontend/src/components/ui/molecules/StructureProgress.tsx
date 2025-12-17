/**
 * StructureProgress Molecule
 * 
 * Progress panel showing structure generation with section-by-section status.
 * Displays title, overall progress, section list with status, and stage indicator.
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { SectionStatusIcon, type SectionStatus } from '../atoms/SectionStatusIcon'
import {
  CheckCircledIcon,
  GearIcon,
  Pencil1Icon,
  FileTextIcon,
  MagnifyingGlassIcon,
  CrossCircledIcon,
  ClockIcon,
} from '@radix-ui/react-icons'

// ============================================================
// Types
// ============================================================

export interface StructureSection {
  id: string
  title: string
  status: SectionStatus
  wordCount?: number
  preview?: string
}

export interface StructureProgressData {
  title: string
  sections: StructureSection[]
}

export type ProgressStage = 'idle' | 'planning' | 'structuring' | 'writing' | 'reviewing' | 'complete' | 'error'

export interface StructureProgressProps {
  /** Structure data with title and sections */
  structure: StructureProgressData
  /** Current stage of generation */
  stage: ProgressStage
  /** Overall completion percentage (0-100) */
  percentComplete: number
  /** Currently active section title */
  currentSection?: string
  /** Error message if stage is 'error' */
  error?: string
  /** Additional CSS classes */
  className?: string
  /** Show compact version without previews */
  compact?: boolean
}

// ============================================================
// Helper Components
// ============================================================

interface SectionItemProps {
  section: StructureSection
  index: number
  isActive: boolean
  compact?: boolean
}

function SectionItem({ section, index, isActive, compact }: SectionItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-lg transition-all duration-300',
        section.status === 'complete' && 'bg-green-50 dark:bg-green-900/20',
        section.status === 'writing' && 'bg-amber-50 dark:bg-amber-900/20',
        section.status === 'pending' && 'bg-neutral-50 dark:bg-neutral-800/50',
        isActive && 'ring-2 ring-amber-400 ring-offset-1'
      )}
    >
      {/* Status icon */}
      <SectionStatusIcon status={section.status} size="md" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-sm font-medium truncate',
            section.status === 'pending' ? 'text-neutral-400' : 'text-neutral-900 dark:text-neutral-100'
          )}>
            {index}. {section.title}
          </span>
          {section.wordCount && (
            <span className="text-xs text-neutral-400 flex-shrink-0">
              {section.wordCount}w
            </span>
          )}
        </div>
        
        {/* Preview text (only in non-compact mode) */}
        {!compact && section.preview && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1">
            {section.preview}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Stage Messages
// ============================================================

interface StageInfo {
  icon: React.ReactNode
  message: string
  color: string
}

function getStageInfo(stage: ProgressStage, currentSection?: string, error?: string): StageInfo {
  switch (stage) {
    case 'idle':
      return {
        icon: <ClockIcon className="w-3.5 h-3.5" />,
        message: 'Ready to start...',
        color: 'text-neutral-500',
      }
    case 'planning':
      return {
        icon: <GearIcon className="w-3.5 h-3.5 animate-spin" />,
        message: 'Planning structure...',
        color: 'text-neutral-500',
      }
    case 'structuring':
      return {
        icon: <FileTextIcon className="w-3.5 h-3.5" />,
        message: 'Building outline...',
        color: 'text-indigo-500',
      }
    case 'writing':
      return {
        icon: <Pencil1Icon className="w-3.5 h-3.5 animate-pulse" />,
        message: `Writing: ${currentSection || '...'}`,
        color: 'text-amber-500',
      }
    case 'reviewing':
      return {
        icon: <MagnifyingGlassIcon className="w-3.5 h-3.5" />,
        message: 'Reviewing content...',
        color: 'text-neutral-500',
      }
    case 'complete':
      return {
        icon: <CheckCircledIcon className="w-3.5 h-3.5" />,
        message: 'All sections complete!',
        color: 'text-green-500',
      }
    case 'error':
      return {
        icon: <CrossCircledIcon className="w-3.5 h-3.5" />,
        message: error || 'An error occurred',
        color: 'text-red-500',
      }
    default:
      return {
        icon: null,
        message: '',
        color: 'text-neutral-500',
      }
  }
}

// ============================================================
// Main Component
// ============================================================

export function StructureProgress({
  structure,
  stage,
  percentComplete,
  currentSection,
  error,
  className,
  compact = false,
}: StructureProgressProps) {
  const completedCount = structure.sections.filter(s => s.status === 'complete').length
  const totalCount = structure.sections.length
  const isComplete = stage === 'complete'

  return (
    <div className={cn(
      'bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileTextIcon className="w-5 h-5 text-indigo-500" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {structure.title}
            </span>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-sm font-medium',
            isComplete ? 'text-green-600 dark:text-green-400' : 'text-neutral-500'
          )}>
            {isComplete && <CheckCircledIcon className="w-4 h-4" />}
            <span>{isComplete ? 'Complete' : `${completedCount}/${totalCount}`}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            isComplete ? 'bg-green-500' : 'bg-indigo-500'
          )}
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Sections list */}
      <div className={cn(
        'p-3 space-y-2 overflow-y-auto',
        compact ? 'max-h-48' : 'max-h-64'
      )}>
        {structure.sections.map((section, index) => (
          <SectionItem
            key={section.id}
            section={section}
            index={index + 1}
            isActive={section.title === currentSection}
            compact={compact}
          />
        ))}
      </div>

      {/* Footer status */}
      {(() => {
        const stageInfo = getStageInfo(stage, currentSection, error)
        return (
          <div className="px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-700">
            <div className={cn('flex items-center gap-2 text-xs', stageInfo.color)}>
              {stageInfo.icon}
              <span>{stageInfo.message}</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default StructureProgress
