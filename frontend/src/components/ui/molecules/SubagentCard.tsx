/**
 * SubagentCard Molecule
 * 
 * Shows subagent name, status, and current task.
 * Displays inline in chat when a subagent is spawned.
 * 
 * Composes: SubagentAvatar, SubagentStatusBadge
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { SubagentAvatar, SubagentType } from '../atoms/SubagentAvatar'
import { SubagentStatusBadge, SubagentStatus } from '../atoms/SubagentStatusBadge'

export interface SubagentCardProps {
  name: SubagentType
  task: string
  status: SubagentStatus
  result?: unknown
  className?: string
}

export function SubagentCard({ name, task, status, result, className }: SubagentCardProps) {
  const isComplete = status === 'complete'
  const hasResult = Boolean(result && typeof result === 'object')
  
  return (
    <div 
      className={cn(
        'rounded-lg border p-3',
        'transition-colors duration-200',
        status === 'working' && 'border-indigo-200 bg-indigo-50/50',
        status === 'complete' && 'border-green-200 bg-green-50/30',
        status === 'error' && 'border-red-200 bg-red-50/50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <SubagentAvatar 
          type={name} 
          size="sm" 
          isActive={status === 'working'} 
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-800 capitalize">
              {name}
            </span>
            <SubagentStatusBadge status={status} />
          </div>
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {task}
          </p>
        </div>
      </div>
      
      {/* Result preview (if complete and has result) */}
      {isComplete && hasResult && (
        <div className="mt-2 pt-2 border-t border-neutral-100">
          <SubagentResult result={result} />
        </div>
      )}
    </div>
  )
}

/**
 * SubagentResult - Displays subagent output
 */
interface SubagentResultProps {
  result: unknown
}

function SubagentResult({ result }: SubagentResultProps) {
  if (!result || typeof result !== 'object') {
    return null
  }
  
  const data = result as Record<string, unknown>
  
  // Critic-specific rendering
  if ('overall_score' in data || 'strengths' in data) {
    return (
      <div className="space-y-1">
        {data.overall_score !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Score:</span>
            <span className="text-sm font-medium text-amber-600">
              {String(data.overall_score)}/10
            </span>
          </div>
        )}
        {Array.isArray(data.strengths) && data.strengths.length > 0 && (
          <div className="text-xs text-neutral-600">
            <span className="text-green-600">✓</span> {String(data.strengths[0])}
          </div>
        )}
        {Array.isArray(data.improvements) && data.improvements.length > 0 && (
          <div className="text-xs text-neutral-600">
            <span className="text-amber-600">→</span> {String(data.improvements[0])}
          </div>
        )}
      </div>
    )
  }
  
  // Researcher-specific rendering
  if ('key_facts' in data || 'topic' in data) {
    return (
      <div className="space-y-1">
        {data.topic !== undefined && data.topic !== null && (
          <div className="text-xs font-medium text-neutral-700">
            📚 {String(data.topic)}
          </div>
        )}
        {Array.isArray(data.key_facts) && data.key_facts.length > 0 && (
          <ul className="text-xs text-neutral-600 space-y-0.5">
            {data.key_facts.slice(0, 3).map((fact, i) => (
              <li key={i}>• {String(fact)}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }
  
  // Generic result (show raw_response if present)
  if ('raw_response' in data) {
    const response = String(data.raw_response)
    return (
      <div className="text-xs text-neutral-600 line-clamp-3">
        {response.slice(0, 200)}{response.length > 200 ? '...' : ''}
      </div>
    )
  }
  
  // Fallback
  return (
    <div className="text-xs text-neutral-500 italic">
      Subagent completed
    </div>
  )
}

export default SubagentCard
