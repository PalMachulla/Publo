'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { CreateStoryNodeData } from '@/types/nodes'
import StoryFormatMenu, { StoryFormat } from '@/components/StoryFormatMenu'

interface CreateStoryNodeInternalData extends CreateStoryNodeData {
  onCreateStory?: (format: StoryFormat) => void
}

function CreateStoryNode({ data, selected }: NodeProps<CreateStoryNodeInternalData>) {
  const handleFormatSelect = (format: StoryFormat) => {
    if (data.onCreateStory) {
      data.onCreateStory(format)
    }
  }

  return (
    <div className="relative">
      {/* Handles on all sides for connections */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      <Handle type="target" position={Position.Right} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2 !border-2 !border-white" />
      
      {/* Story Format Menu */}
      <StoryFormatMenu onSelectFormat={handleFormatSelect} />
    </div>
  )
}

export default memo(CreateStoryNode)

