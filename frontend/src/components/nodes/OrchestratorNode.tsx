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
              width="190"
              height="210"
              viewBox="0 0 190 210"
              className="w-full h-full"
              style={{ transform: 'scale(1.2)' }}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M182.193 0C186.162 1.56361e-05 189.38 3.21764 189.38 7.18652V202.016C189.38 205.984 186.162 209.201 182.193 209.201C178.225 209.201 175.007 205.984 175.007 202.016V7.18652C175.007 3.21763 178.224 -1.73486e-07 182.193 0Z"
                fill="black"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M72.7695 34.5264C86.5332 34.5264 98.9345 37.5923 109.973 43.7246C121.011 49.7206 129.664 58.306 135.933 69.4805C142.337 80.5186 145.54 93.3967 145.54 108.114C145.54 122.695 142.337 135.574 135.933 146.748C129.664 157.922 121.011 166.576 109.973 172.708C98.9345 178.704 86.5332 181.702 72.7695 181.702C59.0061 181.702 46.6054 178.704 35.5674 172.708C24.5293 166.576 15.8072 157.922 9.40234 146.748C3.13378 135.574 2.8205e-05 122.695 0 108.114C0 93.3967 3.13378 80.5186 9.40234 69.4805C15.8072 58.306 24.5292 49.7207 35.5674 43.7246C46.6054 37.5924 59.0061 34.5264 72.7695 34.5264ZM72.3613 47.6084C61.4594 47.6084 51.6473 49.9931 42.9258 54.7627C34.3407 59.5322 27.5953 66.4822 22.6895 75.6123C17.7836 84.7426 15.3301 95.5771 15.3301 108.114C15.3301 120.788 17.7837 131.689 22.6895 140.819C27.7315 149.813 34.5449 156.695 43.1299 161.465C51.8513 166.234 61.7315 168.619 72.7695 168.619C83.8077 168.619 93.6198 166.234 102.205 161.465C110.926 156.695 117.74 149.813 122.646 140.819C127.688 131.689 130.209 120.788 130.209 108.114C130.209 95.3045 127.62 84.3344 122.441 75.2041C117.399 66.0738 110.45 59.1919 101.592 54.5586C92.8704 49.9253 83.1268 47.6085 72.3613 47.6084Z"
                fill="black"
              />
            </svg>
          </div>
          
          {/* Loading text below logo - always uppercase */}
          <div className="text-[9px] text-gray-600 font-light text-center px-4 uppercase bg-gray-100 rounded-full p-1">
            {loadingText || 'Orchestrator'}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default memo(OrchestratorNode)

