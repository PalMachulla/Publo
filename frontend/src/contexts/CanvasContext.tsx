'use client'

/**
 * CanvasContext - Provides canvas-level utilities to child components
 * 
 * @updated 2024-12-11 - Removed WorldState (legacy frontend orchestration)
 * Deep agent architecture uses SSE streaming, not frontend WorldState
 */

import { createContext, useContext } from 'react'

interface CanvasContextType {
  onPromptSubmit?: (prompt: string) => void
  // 2024-12-11: Removed worldState - was legacy frontend orchestration
}

const CanvasContext = createContext<CanvasContextType>({})

export const CanvasProvider = CanvasContext.Provider

export const useCanvas = () => useContext(CanvasContext)

