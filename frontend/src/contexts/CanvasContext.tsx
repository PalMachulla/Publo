'use client'

import { createContext, useContext } from 'react'

interface CanvasContextType {
  onPromptSubmit?: (prompt: string) => void
}

const CanvasContext = createContext<CanvasContextType>({})

export const CanvasProvider = CanvasContext.Provider

export const useCanvas = () => useContext(CanvasContext)

