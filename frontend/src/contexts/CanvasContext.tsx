'use client'

import { createContext, useContext } from 'react'
import type { WorldStateManager } from '@/lib/orchestrator/core/worldState'

interface CanvasContextType {
  onPromptSubmit?: (prompt: string) => void
  worldState?: WorldStateManager
}

const CanvasContext = createContext<CanvasContextType>({})

export const CanvasProvider = CanvasContext.Provider

export const useCanvas = () => useContext(CanvasContext)

