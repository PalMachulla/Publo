/**
 * useWorldState - React hook to subscribe to WorldState changes
 * 
 * Provides reactive access to WorldState for React components.
 * Automatically subscribes/unsubscribes on mount/unmount.
 * 
 * Usage:
 * ```tsx
 * const worldState = useWorldState(worldStateManager)
 * const { conversation, ui } = worldState || {}
 * ```
 */

import { useState, useEffect } from 'react'
import type { WorldStateManager, WorldState } from '@/lib/orchestrator/core/worldState'

export function useWorldState(
  worldStateManager: WorldStateManager | undefined
): WorldState | null {
  const [state, setState] = useState<WorldState | null>(() => 
    worldStateManager?.getState() || null
  )
  
  useEffect(() => {
    if (!worldStateManager) {
      setState(null)
      return
    }
    
    // Subscribe to state changes
    const unsubscribe = worldStateManager.subscribe((newState) => {
      setState(newState)
    })
    
    // Update state immediately in case it changed before subscription
    setState(worldStateManager.getState())
    
    return unsubscribe
  }, [worldStateManager])
  
  return state
}

