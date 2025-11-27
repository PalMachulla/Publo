/**
 * MessageTimestamp Atom
 * 
 * Displays formatted timestamp for messages
 */

import React from 'react'

export interface MessageTimestampProps {
  timestamp: string | Date
  className?: string
}

export function MessageTimestamp({ timestamp, className = '' }: MessageTimestampProps) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  
  const formattedTime = date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit'
  })
  
  return (
    <span className={`text-[10px] text-gray-400 ${className}`}>
      {formattedTime}
    </span>
  )
}

