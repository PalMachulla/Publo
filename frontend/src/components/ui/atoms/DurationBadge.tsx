/**
 * DurationBadge Atom
 * 
 * Displays elapsed time like Cursor's "Thought for 3s".
 * Updates live when isActive=true, shows final time when complete.
 * 
 * Formats:
 * - Under 60s: "3s"
 * - Over 60s: "1m 30s"
 * - Over 1h: "1h 5m"
 */

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface DurationBadgeProps {
  /** Start time of the duration */
  startTime: Date
  /** If true, updates every second. If false, shows static duration. */
  isActive?: boolean
  /** Optional end time (for completed durations) */
  endTime?: Date
  /** Optional prefix text (e.g., "Thought for") */
  prefix?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Formats duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`
  }
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`
}

export function DurationBadge({
  startTime,
  isActive = false,
  endTime,
  prefix,
  className
}: DurationBadgeProps) {
  const [elapsed, setElapsed] = useState<number>(0)
  
  useEffect(() => {
    // Calculate initial elapsed time
    const now = endTime || new Date()
    const initial = (now.getTime() - startTime.getTime()) / 1000
    setElapsed(Math.max(0, initial))
    
    // If active, update every second
    if (isActive && !endTime) {
      const interval = setInterval(() => {
        const current = (new Date().getTime() - startTime.getTime()) / 1000
        setElapsed(Math.max(0, current))
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [startTime, isActive, endTime])
  
  const formattedDuration = formatDuration(elapsed)
  
  return (
    <span 
      className={cn(
        'text-xs text-neutral-500 font-medium tabular-nums',
        isActive && 'animate-pulse',
        className
      )}
    >
      {prefix && <span className="mr-1">{prefix}</span>}
      {formattedDuration}
    </span>
  )
}

export default DurationBadge


