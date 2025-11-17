'use client'

import React, { memo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AgentOption } from '@/types/nodes'
import { PersonIcon, Cross2Icon } from '@radix-ui/react-icons'

export interface AgentSelectorProps {
  selectedAgentId?: string | null
  availableAgents: AgentOption[]
  onAgentSelect: (agentId: string | null) => void
  isOpen?: boolean
  onToggle?: (open: boolean) => void
}

function AgentSelector({
  selectedAgentId,
  availableAgents,
  onAgentSelect,
  isOpen: controlledIsOpen,
  onToggle
}: AgentSelectorProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const setIsOpen = onToggle || setInternalIsOpen
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (onToggle) {
          onToggle(false)
        } else {
          setInternalIsOpen(false)
        }
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onToggle])
  
  const selectedAgent = availableAgents.find(a => a.id === selectedAgentId)
  
  // Group agents by assignment mode
  const manualAgents = availableAgents.filter(a => a.assignmentMode !== 'autonomous')
  const autonomousAgents = availableAgents.filter(a => a.assignmentMode === 'autonomous')
  
  // Get agent number from the data or generate from name
  const getAgentNumber = (agent: AgentOption): string => {
    // If agent has an agentNumber, use it
    if ((agent as any).agentNumber) {
      return `AG${String((agent as any).agentNumber).padStart(3, '0')}`
    }
    // Otherwise, try to extract from name or use a placeholder
    return 'AG000'
  }
  
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = React.useState({ top: 0, left: 0 })
  const [mounted, setMounted] = React.useState(false)

  // Track when component is mounted for portal
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate dropdown position when opened
  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (!buttonRef.current) return
        
        const rect = buttonRef.current.getBoundingClientRect()
        const dropdownWidth = 220
        
        // Calculate position relative to viewport
        setDropdownPosition({
          top: rect.bottom + 4,
          left: Math.max(8, Math.min(rect.left, window.innerWidth - dropdownWidth - 8))
        })
      }
      
      updatePosition()
      
      // Update position on scroll
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true)
        window.removeEventListener('resize', updatePosition)
      }
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation()
          if (onToggle) {
            onToggle(!isOpen)
          } else {
            setInternalIsOpen(!isOpen)
          }
        }}
        className={`p-1 rounded transition-colors ${
          selectedAgent 
            ? 'bg-yellow-400/20 hover:bg-yellow-400/30' 
            : 'hover:bg-gray-200'
        }`}
        title={selectedAgent ? `Assigned to ${selectedAgent.label}` : 'Assign agent'}
        aria-label="Assign agent"
      >
        <PersonIcon className={`w-4 h-4 ${selectedAgent ? 'text-yellow-600' : 'text-gray-700'}`} />
      </button>
      
      {/* Dropdown - using portal to render at body level */}
      {isOpen && mounted && createPortal(
        <div 
          className="fixed bg-white border border-gray-200 rounded-lg shadow-xl min-w-[220px] max-h-64 overflow-y-auto"
          style={{ 
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            zIndex: 99999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* No Agent option */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAgentSelect(null)
              if (onToggle) {
                onToggle(false)
              } else {
                setInternalIsOpen(false)
              }
            }}
            className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm flex items-center gap-2 ${
              !selectedAgentId ? 'bg-gray-50' : ''
            }`}
          >
            <Cross2Icon className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600 font-medium">No Agent</span>
          </button>
          
          {/* Divider */}
          {availableAgents.length > 0 && (
            <div className="border-t border-gray-100 my-1" />
          )}
          
          {/* Manual Agent options */}
          {manualAgents.map((agent) => {
            const isSelected = agent.id === selectedAgentId
            const agentNumber = getAgentNumber(agent)
            const isActive = (agent as any).isActive !== false
            
            return (
              <button
                key={agent.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onAgentSelect(agent.id)
                  if (onToggle) {
                    onToggle(false)
                  } else {
                    setInternalIsOpen(false)
                  }
                }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm flex items-center gap-2 ${
                  isSelected ? 'bg-yellow-50' : ''
                }`}
                title={!isActive ? 'Agent is inactive' : undefined}
              >
                {/* Agent pill with color and number */}
                <div 
                  className={`
                    flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold
                    ${isActive ? '' : 'opacity-50'}
                  `}
                  style={{ 
                    backgroundColor: agent.color || '#9ca3af',
                    color: '#ffffff'
                  }}
                >
                  {agentNumber}
                </div>
                
                {/* Agent name */}
                <span className={`flex-1 font-medium truncate ${
                  isActive ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {agent.label}
                </span>
                
                {/* Selected indicator */}
                {isSelected && (
                  <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
          
          {/* Autonomous agents separator and list */}
          {autonomousAgents.length > 0 && (
            <>
              <div className="border-t border-gray-200 my-1" />
              <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Autonomous
              </div>
              
              {autonomousAgents.map((agent) => {
                const isSelected = agent.id === selectedAgentId
                const agentNumber = getAgentNumber(agent)
                const isActive = (agent as any).isActive !== false
                
                return (
                  <div
                    key={agent.id}
                    className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 opacity-40 cursor-not-allowed"
                    title="This agent is in autonomous mode and cannot be manually assigned"
                  >
                    {/* Agent pill with color and number */}
                    <div 
                      className={`
                        flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold
                        ${isActive ? '' : 'opacity-50'}
                      `}
                      style={{ 
                        backgroundColor: agent.color || '#9ca3af',
                        color: '#ffffff'
                      }}
                    >
                      {agentNumber}
                    </div>
                    
                    {/* Agent name */}
                    <span className={`flex-1 font-medium truncate ${
                      isActive ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {agent.label}
                    </span>
                    
                    {/* Autonomous indicator */}
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                )
              })}
            </>
          )}
          
          {/* Empty state */}
          {availableAgents.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              No agents available
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export default memo(AgentSelector)

