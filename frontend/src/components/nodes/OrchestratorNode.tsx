'use client'

import { memo } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { CreateStoryNodeData } from '@/types/nodes'

function OrchestratorNode({ data, selected }: NodeProps<CreateStoryNodeData>) {
  const { isOrchestrating = false, orchestratorProgress = 0, loadingText = '' } = data
  
  // Determine if this is AI inference based on loading text
  const isInferring = loadingText.toLowerCase().includes('inference')
  
  return (
    <div className="relative">
      {/* Keyframes for spinner rotation */}
      <style>{`
        @keyframes orchestratorSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
      <div className="relative">
      {/* Handles on all sides for connections - invisible but functional */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="target" position={Position.Right} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !w-3 !h-3 !border-0 opacity-0" />
      
      {/* Top connector dot */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gray-400"
        style={{ top: '-8px', pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Bottom connector dot */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gray-400"
        style={{ bottom: '-8px', pointerEvents: 'none', zIndex: 0 }}
      />
      
      {/* Orchestrator Node */}
      <div
        className="relative cursor-pointer transition-all"
        style={{ width: 180, height: 180, zIndex: 1 }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          className="absolute inset-0"
          style={{ 
            filter: selected ? 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.12))' : 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.08))',
            transform: 'rotate(-90deg)' // Start progress from top
          }}
        >
          {/* Outer gray ring (background) */}
          <circle
            cx="90"
            cy="90"
            r="85"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="8"
          />
          
          {/* White inner circle */}
          <circle
            cx="90"
            cy="90"
            r="86"
            fill="white"
            stroke="none"
          />
          
          {/* Animated spinner ring - pink during AI inference, yellow during other orchestration */}
          {isOrchestrating && (
            <circle
              cx="90"
              cy="90"
              r="80"
              fill="none"
              stroke={isInferring ? "#ec4899" : "#fbbf24"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${Math.PI * 75 * 0.75} ${Math.PI * 75 * 1.25}`}
              style={{
                animation: 'orchestratorSpin 1.5s linear infinite',
                transformOrigin: '90px 90px'
              }}
            />
          )}
        </svg>
        
        {/* Content centered over circle */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-4">
          {/* Publo Logo */}
          <div className="w-14 h-14 flex items-center justify-center">
            <svg
              viewBox="0 0 163 210"
              className="w-full h-full"
              style={{ transform: 'scale(1.2)' }}
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M162.906 7.18631C162.906 3.21742 159.688 0 155.719 0C151.751 0 148.533 3.21742 148.533 7.18631L148.533 202.015C148.533 205.984 151.751 209.202 155.719 209.202C159.688 209.202 162.906 205.984 162.906 202.015V7.18631ZM2.04411 179.658C3.40684 181.021 5.24654 181.702 7.56319 181.702C10.0161 181.702 11.924 181.021 13.2867 179.658C14.6494 178.159 15.3308 176.115 15.3308 173.526V132.235H61.5276C80.0608 132.235 94.2333 128.214 104.045 120.174C113.993 111.998 118.967 100.415 118.967 85.4245C118.967 52.8551 99.548 36.5704 60.71 36.5704H25.9602C17.7837 36.5704 11.3789 38.7508 6.74555 43.1115C2.24852 47.4723 0 53.4683 0 61.0997V173.526C0 176.115 0.681369 178.159 2.04411 179.658ZM92.1892 111.589C84.9667 116.767 74.7462 119.357 61.5276 119.357H15.3308V61.0997C15.3308 57.5565 16.2847 54.6948 18.1925 52.5144C20.2367 50.334 22.894 49.2438 26.1646 49.2438H61.732C75.2231 49.2438 85.5118 52.1056 92.598 57.8291C99.6843 63.4163 103.227 72.6148 103.227 85.4245C103.227 97.6892 99.548 106.411 92.1892 111.589Z"
                fill="black"
              />
            </svg>
          </div>
          
          {/* Loading text below logo - always uppercase */}
          <div className="text-[9px] text-gray-600 font-light text-center px-4 uppercase">
            {loadingText || 'Orchestrator'}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default memo(OrchestratorNode)

