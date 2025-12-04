/**
 * StatusMessage Molecule
 * 
 * Collapsible status message (thinking, decision, progress, etc.)
 * with colored background and border
 */

import React from 'react'
import { AccordionHeader } from './AccordionHeader'
import { MessageIcon } from '../atoms/MessageIcon'
import type { MessageType } from '../atoms/MessageIcon'

export interface StatusMessageProps {
  type: MessageType
  content: string | string[]
  timestamp: string | Date
  isActive?: boolean
  isCollapsed?: boolean
  isLastMessage?: boolean
  onToggleCollapse?: () => void
  className?: string
  metadata?: {
    structured?: boolean
    format?: 'progress_list' | 'simple_list' | 'steps'
  }
}

export function StatusMessage({
  type,
  content,
  timestamp,
  isActive = false,
  isCollapsed = false,
  isLastMessage = false,
  onToggleCollapse,
  className = '',
  metadata
}: StatusMessageProps) {
  // Background colors for each type
  const bgColor = 
    type === 'thinking' ? 'bg-gray-50 bg-opacity-50' :
    type === 'progress' ? 'bg-gray-50 bg-opacity-50' :
    type === 'decision' ? 'bg-gray-50 bg-opacity-50' :
    type === 'task' ? 'bg-gray-50 bg-opacity-50' :
    type === 'result' ? 'bg-gray-50 bg-opacity-50' :
    type === 'warning' ? 'bg-orange-50 bg-opacity-50' :
    type === 'model' ? 'bg-gradient-to-r from-indigo-50 to-purple-50 bg-opacity-50 border-l-1 border-indigo-500' :
    'bg-red-50 bg-opacity-50 border-l-1 border-red-400'
  
  const messages = Array.isArray(content) ? content : [content]
  const showChevron = !isLastMessage || !isActive
  
  // Parse structured content if metadata indicates it
  const renderStructuredContent = () => {
    // 🔍 DEBUG: Log metadata to help diagnose why structured content might not be showing
    if (metadata) {
      console.log('📋 [StatusMessage] Metadata received:', {
        structured: metadata.structured,
        format: metadata.format,
        hasMetadata: !!metadata,
        fullMetadata: metadata, // Show full metadata object
        messageCount: messages.length,
        lastMessagePreview: messages[messages.length - 1]?.substring(0, 100)
      })
    }
    
    // ✅ FALLBACK: Try to detect structured content even if metadata is missing
    // This handles cases where metadata is lost during message grouping
    // Check all messages (in case of grouping) to find structured content
    let shouldRenderStructured = false
    let detectedFormat: 'progress_list' | 'simple_list' | 'steps' | undefined
    let structuredMessage: string | null = null
    
    if (metadata?.structured && metadata?.format) {
      // Primary: Use metadata if available
      shouldRenderStructured = true
      detectedFormat = metadata.format
      structuredMessage = messages[messages.length - 1] // Use last message when metadata is present
    } else {
      // Fallback: Search through all messages to find structured content
      // Start from the end (most recent) and work backwards
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        try {
          const parsed = JSON.parse(msg)
          if (parsed.type === 'progress_list' && Array.isArray(parsed.items) && typeof parsed.currentStep === 'number') {
            shouldRenderStructured = true
            detectedFormat = 'progress_list'
            structuredMessage = msg
            console.log('🔍 [StatusMessage] Detected structured content from message content (metadata missing)', {
              messageIndex: i,
              totalMessages: messages.length,
              currentStep: parsed.currentStep
            })
            break // Use the most recent structured message
          }
        } catch (e) {
          // Not JSON, continue searching
        }
      }
    }
    
    if (!shouldRenderStructured || !detectedFormat || !structuredMessage) {
      // 🔍 DEBUG: Log why structured content isn't rendering
      console.log('⚠️ [StatusMessage] Structured content not rendering:', {
        hasMetadata: !!metadata,
        hasStructured: !!metadata?.structured,
        hasFormat: !!metadata?.format,
        structuredValue: metadata?.structured,
        formatValue: metadata?.format,
        messageCount: messages.length,
        foundStructuredMessage: !!structuredMessage,
        lastMessagePreview: messages[messages.length - 1]?.substring(0, 100)
      })
      return null
    }
    
    // TypeScript guard: structuredMessage is guaranteed to be non-null here
    const messageToParse = structuredMessage
    
    try {
      const structuredData = JSON.parse(messageToParse)
      console.log('✅ [StatusMessage] Parsed structured data:', {
        type: structuredData.type,
        itemsCount: structuredData.items?.length,
        currentStep: structuredData.currentStep,
        items: structuredData.items,
        detectedFormat
      })
      
      if (detectedFormat === 'progress_list' && structuredData.type === 'progress_list') {
        const { items, currentStep } = structuredData
        const isLastStep = currentStep === items.length - 1
        
        return (
          <div className="space-y-1.5">
            {items.map((item: string, index: number) => {
              const isCurrent = index === currentStep
              const isCompleted = index < currentStep
              const isPending = index > currentStep
              const isLastItem = index === items.length - 1
              
              return (
                <div key={index} className="flex items-center gap-2.5">
                  {/* Icon: Checkmark in circle for completed, spinner for current, empty circle for pending */}
                  {/* All icons use grey colors for consistent appearance - smaller, cleaner design */}
                  <div className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${
                    isLastItem && isCurrent ? 'animate-pulse' : ''
                  }`}>
                    {isCompleted ? (
                      // ✅ Completed: Checkmark in circle (grey) - smaller
                      <div className="relative w-4 h-4">
                        <div className="absolute inset-0 rounded-full bg-white border border-gray-400"></div>
                        <svg 
                          className="absolute inset-0 w-3 h-3 text-gray-600 m-0.5" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isCurrent ? (
                      // 🔄 Current: Spinner in circle (grey) - smaller
                      <div className="relative w-4 h-4">
                        <div className="absolute inset-0 rounded-full bg-white border border-gray-400"></div>
                        <svg 
                          className="absolute inset-0 w-3 h-3 text-gray-600 animate-spin m-0.5" 
                          fill="none" 
                          viewBox="0 0 24 24"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : (
                      // ⭕ Pending: Empty circle (grey) - smaller
                      <div className="w-4 h-4 rounded-full bg-white border border-gray-300"></div>
                    )}
                  </div>
                  
                  {/* Text content */}
                  <span className={`text-xs flex-1 ${
                    isCurrent 
                      ? 'text-gray-700 font-medium' 
                      : isCompleted 
                        ? 'text-gray-600' 
                        : 'text-gray-400'
                  }`}>
                    {item}
                  </span>
                </div>
              )
            })}
          </div>
        )
      }
    } catch (error) {
      // If parsing fails, fall back to regular rendering
      console.warn('Failed to parse structured content:', error)
      return null
    }
    
    return null
  }
  
  const structuredContent = renderStructuredContent()
  
  return (
    <div 
      className={`rounded ${bgColor} overflow-hidden ${
        isLastMessage && isActive ? 'animate-pulse' : ''
      } ${className}`}
    >
      <AccordionHeader
        type={type}
        timestamp={timestamp}
        isActive={isActive}
        isCollapsed={isCollapsed}
        isCollapsible={showChevron}
        onClick={showChevron ? onToggleCollapse : undefined}
      />
      
      {!isCollapsed && (
        <div className="px-3 pb-3">
          {structuredContent ? (
            // Render structured content (progress list, etc.)
            structuredContent
          ) : messages.length === 1 ? (
            // Single message
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
              {messages[0]}
              {isLastMessage && isActive && (
                <span className="inline-block ml-1 w-1.5 h-4 bg-indigo-600 animate-pulse" />
              )}
            </p>
          ) : (
            // Multiple messages
            <div className="text-sm text-gray-800 space-y-0.5">
              {messages.map((msg, idx) => (
                <p key={idx} className="whitespace-pre-wrap break-words">
                  {msg}
                  {idx === messages.length - 1 && isLastMessage && isActive && (
                    <span className="inline-block ml-1 w-1.5 h-4 bg-indigo-600 animate-pulse" />
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

