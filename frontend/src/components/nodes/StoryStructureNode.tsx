'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData } from '@/types/nodes'

// Format colors for the pill
const FORMAT_COLORS: Record<string, { bg: string; text: string }> = {
  novel: { bg: 'bg-indigo-500', text: 'text-white' },
  screenplay: { bg: 'bg-amber-500', text: 'text-white' },
  podcast: { bg: 'bg-emerald-500', text: 'text-white' },
  interview: { bg: 'bg-rose-500', text: 'text-white' },
  article: { bg: 'bg-sky-500', text: 'text-white' },
  default: { bg: 'bg-gray-500', text: 'text-white' },
}

function StoryStructureNode({ data, selected }: NodeProps<StoryStructureNodeData>) {
  const { 
    format, 
    label,
    isLoading = false,
  } = data
  
  // Get format color
  const formatKey = format?.toLowerCase() || 'default'
  const formatColor = FORMAT_COLORS[formatKey] || FORMAT_COLORS.default

  return (
    <div className="relative">
      {/* Top connector dot */}
      <div 
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Card - Cover with format color */}
      <div
        className={`relative rounded-lg shadow-lg transition-all overflow-hidden cursor-pointer ${formatColor.bg} ${
          selected ? 'ring-2 ring-yellow-400 shadow-xl' : 'shadow-md'
        } ${isLoading ? 'animate-pulse' : ''}`}
        style={{ width: 90, height: 120, zIndex: 1 }}
      >
        {/* Cover image placeholder */}
        <div className="w-full h-full flex items-center justify-center">
          <svg className="w-12 h-12 text-white/50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
      </div>
      
      {/* Format pill below card */}
      <div className="mt-2 flex justify-start" style={{ width: 90 }}>
        <span className={`${formatColor.bg} ${formatColor.text} text-[8px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full`}>
          {format || 'Story'}
        </span>
      </div>
      
      {/* Title below pill - full title, wrap between words only */}
      <div 
        className="mt-1 text-[10px] text-gray-500 uppercase tracking-widest font-sans leading-tight"
        style={{ width: 90, wordBreak: 'keep-all', overflowWrap: 'normal' }}
      >
        {label || 'Untitled Story'}
      </div>
      
      {/* Handle for connections */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
    </div>
  )
}

export default memo(StoryStructureNode)

