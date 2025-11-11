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
      
      {/* Top connector dot */}
      <div 
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Bottom connector dot */}
      <div 
        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Story Format Menu */}
      <div className="relative" style={{ zIndex: 1 }}>
        <StoryFormatMenu onSelectFormat={handleFormatSelect} />
      </div>
    </div>
  )
}

export default memo(CreateStoryNode)

