'use client'

import { memo } from 'react'
import { StoryStructureItem, AgentOption } from '@/types/nodes'

interface AgentAssignmentRowProps {
  item: StoryStructureItem
  level: 1 | 2 | 3
  startPosition: number
  width: number
  availableAgents: AgentOption[]
  onAgentAssign: (itemId: string, agentId: string | null) => void
}

function AgentAssignmentRow({
  item,
  level,
  startPosition,
  width,
  availableAgents,
  onAgentAssign
}: AgentAssignmentRowProps) {
  const hasAgent = !!item.assignedAgentId
  const agentName = item.assignedAgentNumber 
    ? `AG${String(item.assignedAgentNumber).padStart(3, '0')}`
    : null

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newAgentId = e.target.value || null
    console.log('Agent assignment change:', {
      itemId: item.id,
      itemName: item.name,
      newAgentId,
      currentAssignment: item.assignedAgentId,
      availableAgents: availableAgents.length
    })
    onAgentAssign(item.id, newAgentId)
  }

  console.log('AgentAssignmentRow render:', {
    itemId: item.id,
    assignedAgentId: item.assignedAgentId,
    assignedAgentColor: item.assignedAgentColor,
    hasAgent
  })

  return (
    <div
      className="absolute top-0 h-full flex items-center justify-center px-2"
      style={{
        left: startPosition,
        width: Math.max(width, 20),
      }}
    >
      <select
        value={item.assignedAgentId || ''}
        onChange={handleChange}
        className="text-xs px-2 py-1 rounded border border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-400 cursor-pointer transition-colors w-full max-w-full truncate"
        style={{
          backgroundColor: hasAgent ? item.assignedAgentColor + '33' : 'white', // 33 = 20% opacity
          color: '#374151',
          minWidth: 0
        }}
        title={hasAgent ? `Assigned to ${agentName}` : 'No agent assigned'}
      >
        <option value="">No Agent</option>
        {availableAgents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            AG{String(agent.agentNumber).padStart(3, '0')} - {agent.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default memo(AgentAssignmentRow)

