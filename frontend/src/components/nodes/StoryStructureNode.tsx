'use client'

import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { StoryStructureNodeData } from '@/types/nodes'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { NarrationContainer } from './narrationline'

function StoryStructureNode({ data, selected, id }: NodeProps<StoryStructureNodeData>) {
  const { 
    format, 
    items = [], 
    label,
    onItemClick,
    onItemsUpdate,
    onWidthUpdate,
    isLoading = false,
    customNarrationWidth = 1200,
    availableAgents = [],
    onAgentAssign
  } = data
  const [isExpanded, setIsExpanded] = useState(false) // Collapsed by default
  
  // Calculate total word count
  const totalWordCount = items.reduce((sum, item) => sum + (item.wordCount || 0), 0)
  
  // Format last updated date (placeholder for now)
  const lastUpdated = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
  
  // Handle narration width change
  const handleNarrationWidthChange = (newWidth: number) => {
    if (onWidthUpdate) {
      onWidthUpdate(newWidth)
    }
  }
  
  // Node width
  const nodeWidth = isExpanded ? customNarrationWidth : 320

  return (
    <div className="relative">
      {/* Top connector dot - positioned behind the shape */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ top: '-10px', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Bottom connector dot - positioned behind the shape */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gray-400 shadow-lg"
        style={{ bottom: '-10px', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Wrapper for tab + container with subtle selection state */}
      <div className="relative transition-all duration-300 ease-in-out flex-shrink-0" style={{ 
        borderRadius: '16px 16px 24px 24px',
        zIndex: 5,
        width: nodeWidth
      }}>
        {/* Label above node with tab-like background */}
        <div className="flex justify-center -mb-1 transition-all duration-300 ease-in-out" style={{ width: nodeWidth }}>
          <div className={`px-8 py-3 rounded-t-xl flex items-center gap-2 transition-all  ${isLoading ? 'bg-gray-200 animate-pulse' : 'bg-gray-400'}`}>
            <div className="text-sm text-gray-700 uppercase tracking-widest font-sans font-bold">
              {label || (format ? format.toUpperCase() : 'STORY')}
            </div>
            
            {/* Expand/Collapse toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="p-1 rounded hover:bg-gray-500 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand timeline'}
              aria-label="Toggle timeline"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-700" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-gray-700" />
              )}
            </button>
            
            {/* Edit Content Button - Opens Content Canvas */}
            <button
              onClick={(e) => {
                e.stopPropagation() // Stop it from opening structure panel
                // Open Content Canvas by triggering onItemClick with first item (or a dummy item to show full document)
                if (onItemClick && items.length > 0) {
                  // Get the first top-level item to open the document at the start
                  const firstItem = items.find(item => item.level === 1) || items[0]
                  onItemClick(firstItem, items, format, id)
                }
              }}
              className="p-1 rounded hover:bg-gray-500 transition-colors"
              title="Edit content in Content Canvas"
              aria-label="Edit content"
            >
              <svg 
                className="w-4 h-4 text-gray-700" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" 
                />
              </svg>
            </button>
            
            {/* Panel indicator icon - three dots vertical - clickable */}
            <button
              onClick={(e) => {
                // Don't stop propagation - let it bubble to React Flow's node click handler
              }}
              className="p-1 rounded hover:bg-gray-500 transition-colors"
              title="Open structure panel"
              aria-label="Open structure panel"
            >
              <svg 
                className="w-4 h-4 text-gray-700" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" 
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Container - positioned in front of connector dots */}
        <div
          className={`relative transition-all duration-300 ease-in-out ${
            isExpanded ? '' : `rounded-2xl overflow-visible ${isLoading ? 'bg-gray-200 animate-pulse' : 'bg-gray-400'} ${selected ? 'shadow-2xl' : 'shadow-md'}`
          }`}
          style={{
            width: nodeWidth,
            minHeight: isExpanded ? 'auto' : 'auto',
            paddingLeft: isExpanded ? 0 : 24,
            paddingRight: isExpanded ? 0 : 24,
            paddingTop: isExpanded ? 0 : 20,
            paddingBottom: isExpanded ? 0 : 20,
            boxSizing: 'border-box'
          }}
        >
        {!isExpanded ? (
          /* Collapsed View - Simple Metadata Card */
          <div className="flex flex-col gap-4">
            {/* Cover Image Placeholder */}
            <div className="w-full aspect-[3/2] rounded-lg bg-gray-300 flex items-center justify-center border-2 border-gray-500">
              <div className="text-center text-gray-600">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                <div className="text-xs font-medium">Cover Image</div>
                <div className="text-xs opacity-60">(Coming Soon)</div>
              </div>
            </div>
            
            {/* Story Name */}
            <div>
              <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Story Name</div>
              <div className="text-base font-bold text-gray-900">
                {label || (format ? `${format} Story` : 'Untitled Story')}
              </div>
            </div>
            
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Last Updated</div>
                <div className="text-sm font-medium text-gray-800">{lastUpdated}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-1">Total Words</div>
                <div className="text-sm font-medium text-gray-800">{totalWordCount.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ) : (
          /* Expanded View - Narration Timeline */
          <NarrationContainer
            items={items}
            onItemClick={(item) => {
              if (onItemClick) {
                onItemClick(item, items, format, id)
              }
            }}
            onItemsChange={onItemsUpdate}
            unitLabel="Words"
            isLoading={isLoading}
            initialWidth={customNarrationWidth}
            onWidthChange={handleNarrationWidthChange}
            format={format}
            availableAgents={availableAgents}
            onAgentAssign={onAgentAssign}
          />
        )}
        </div>
      </div>

      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
    </div>
  )
}

export default memo(StoryStructureNode)

