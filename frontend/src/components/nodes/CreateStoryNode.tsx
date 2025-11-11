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
    console.log('StoryFormatMenu selected format:', format)
    if (data.onCreateStory) {
      data.onCreateStory(format)
    } else {
      console.error('onCreateStory callback not found in node data')
    }
  }

  return (
    <div className="relative">
      {/* Handles on all sides for connections - invisible but functional */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="target" position={Position.Right} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      
      {/* Story Format Menu */}
      <StoryFormatMenu onSelectFormat={handleFormatSelect} />
    </div>
  )
}

export default memo(CreateStoryNode)

