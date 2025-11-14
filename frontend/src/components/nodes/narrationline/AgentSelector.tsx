'use client'

import { memo, useState, useRef, useEffect } from 'react'
import { AgentOption } from '@/types/nodes'
import { PersonIcon, Cross2Icon } from '@radix-ui/react-icons'

export interface AgentSelectorProps {
  selectedAgentId?: string | null
  availableAgents: AgentOption[]
  onAgentSelect: (agentId: string | null) => void
}

function AgentSelector({
  selectedAgentId,
  availableAgents,
  onAgentSelect
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  const selectedAgent = availableAgents.find(a => a.id === selectedAgentId)
  
  // Get agent number from the data or generate from name
  const getAgentNumber = (agent: AgentOption): string => {
    // If agent has an agentNumber, use it
    if ((agent as any).agentNumber) {
      return `AG${String((agent as any).agentNumber).padStart(3, '0')}`
    }
    // Otherwise, try to extract from name or use a placeholder
    return 'AG000'
  }
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
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
      
      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[220px] max-h-64 overflow-y-auto z-[9999]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* No Agent option */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAgentSelect(null)
              setIsOpen(false)
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
          
          {/* Agent options */}
          {availableAgents.map((agent) => {
            const isSelected = agent.id === selectedAgentId
            const agentNumber = getAgentNumber(agent)
            const isActive = (agent as any).isActive !== false
            
            return (
              <button
                key={agent.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onAgentSelect(agent.id)
                  setIsOpen(false)
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
          
          {/* Empty state */}
          {availableAgents.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              No agents available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(AgentSelector)

