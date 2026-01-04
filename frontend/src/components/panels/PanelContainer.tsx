/**
 * PanelContainer
 * 
 * 2024-12-14: Extracted from NodeDetailsPanel.tsx as part of panel architecture refactor
 * 
 * Reusable sliding panel container with:
 * - Slide in/out animation
 * - Resizable width
 * - Dotted background pattern
 */
'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'

interface PanelContainerProps {
  isOpen: boolean
  onWidthChange?: (width: number) => void
  children: ReactNode
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
}

export default function PanelContainer({
  isOpen,
  onWidthChange,
  children,
  initialWidth = 384,
  minWidth = 320,
  maxWidth = 800,
}: PanelContainerProps) {
  const [panelWidth, setPanelWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const onWidthChangeRef = useRef(onWidthChange)
  
  // Keep callback ref in sync without triggering re-renders
  useEffect(() => {
    onWidthChangeRef.current = onWidthChange
  }, [onWidthChange])
  
  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      setPanelWidth(Math.min(Math.max(newWidth, minWidth), maxWidth))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth])

  // Notify parent when panel width changes
  useEffect(() => {
    onWidthChangeRef.current?.(panelWidth)
  }, [panelWidth])
  
  return (
    <div
      className={`fixed top-16 right-0 bottom-0 bg-gray-50/95 border-l border-t border-gray-200 shadow-sm backdrop-blur-sm transform transition-all duration-300 ease-in-out z-50 ${
        isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{ 
        width: `${panelWidth}px`,
        backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }}
    >
      {/* Resize Handle - Left Border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 hover:bg-yellow-400 cursor-ew-resize transition-colors z-10"
        onMouseDown={(e) => {
          e.preventDefault()
          setIsResizing(true)
        }}
      >
        {/* Handle Grip - Middle of border */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-16 flex items-center justify-center">
          <div className="w-2.5 h-10 rounded-full bg-gray-300 hover:bg-yellow-400 flex items-center justify-center shadow-md transition-colors group">
            <svg className="w-2.5 h-2.5 text-gray-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </div>
        </div>
      </div>
      
      <div className="h-full flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
