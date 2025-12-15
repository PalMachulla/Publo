/**
 * SubagentActivity Organism
 * 
 * Timeline of subagent invocations in current session.
 * Shows all subagent activity with collapsible details.
 * 
 * Composes: SubagentCard
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { SubagentCard } from '../molecules/SubagentCard'
import { SubagentType } from '../atoms/SubagentAvatar'
import { SubagentStatus } from '../atoms/SubagentStatusBadge'

export interface SubagentActivityItem {
  id: string
  name: SubagentType
  task: string
  status: SubagentStatus
  result?: unknown
  startTime?: Date
  endTime?: Date
}

export interface SubagentActivityProps {
  activities: SubagentActivityItem[]
  title?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  className?: string
}

export function SubagentActivity({
  activities,
  title = 'Agent Activity',
  collapsible = true,
  defaultExpanded = true,
  className
}: SubagentActivityProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  // Don't render if no activities
  if (!activities || activities.length === 0) {
    return null
  }
  
  const workingCount = activities.filter(a => a.status === 'working').length
  const completeCount = activities.filter(a => a.status === 'complete').length
  
  return (
    <div 
      className={cn(
        'rounded-lg border border-neutral-200 bg-white overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
        disabled={!collapsible}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5',
          'text-left transition-colors',
          collapsible && 'hover:bg-neutral-50 cursor-pointer',
          !collapsible && 'cursor-default'
        )}
      >
        <div className="flex items-center gap-2">
          {/* Icon */}
          <div className="w-5 h-5 rounded flex items-center justify-center bg-purple-100 text-purple-600">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
              />
            </svg>
          </div>
          
          {/* Title */}
          <span className="text-sm font-medium text-neutral-700">
            {title}
          </span>
          
          {/* Count badges */}
          <div className="flex items-center gap-1">
            {workingCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-indigo-100 text-indigo-700">
                {workingCount} active
              </span>
            )}
            {completeCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
                {completeCount} done
              </span>
            )}
          </div>
        </div>
        
        {/* Expand/collapse indicator */}
        {collapsible && (
          <svg 
            className={cn(
              'w-4 h-4 text-neutral-400 transition-transform',
              isExpanded && 'rotate-180'
            )}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      
      {/* Activity list */}
      {isExpanded && (
        <div className="border-t border-neutral-100 p-3 space-y-2">
          {activities.map((activity) => (
            <SubagentCard
              key={activity.id}
              name={activity.name}
              task={activity.task}
              status={activity.status}
              result={activity.result}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default SubagentActivity
