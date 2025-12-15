/**
 * useWorldStateSync - WorldState synchronization hook
 * 
 * CRITICAL: This hook maintains the one-way data flow from ReactFlow state to WorldState.
 * 
 * Architecture:
 * - ReactFlow State = Source of truth for canvas UI (required by ReactFlow library)
 * - WorldState = Derived state for orchestrator (built from ReactFlow state)
 * - One-way flow: ReactFlow → WorldState (no conflicts)
 * 
 * This hook:
 * 1. Initializes WorldState from ReactFlow state when ready
 * 2. Rebuilds WorldState when ReactFlow state changes
 * 3. Preserves conversation messages during rebuilds (critical for chat continuity)
 * 
 * Why rebuild instead of update?
 * - WorldState is built from ReactFlow state via buildWorldStateFromReactFlow()
 * - Rebuilding ensures WorldState always matches ReactFlow state exactly
 * - Conversation messages are preserved to maintain chat history
 * 
 * @see buildWorldStateFromReactFlow for conversion logic
 * @see useCanvasState for ReactFlow state management
 */

import { useEffect, useRef, useState } from 'react'
import { Node, Edge } from 'reactflow'
import type { WorldStateManager } from '@/lib/orchestrator/core/worldState'
import { buildWorldStateFromReactFlow } from '@/lib/orchestrator/core/worldState'

export interface UseWorldStateSyncOptions {
  /**
   * ReactFlow nodes array
   * Changes to this trigger WorldState rebuild
   */
  nodes: Node[]
  
  /**
   * ReactFlow edges array
   * Changes to this trigger WorldState rebuild
   */
  edges: Edge[]
  
  /**
   * Currently active document node ID (if any)
   * Used to set activeDocument in WorldState
   */
  currentStoryStructureNodeId: string | null
  
  /**
   * Whether document panel is open
   * Used to set UI state in WorldState
   */
  isAIDocPanelOpen: boolean
  
  /**
   * User ID for WorldState initialization
   */
  userId: string
  
  /**
   * Available API providers (optional)
   * Used for model selection in WorldState
   */
  availableProviders?: string[]
  
  /**
   * Available models (optional)
   * Used for model selection in WorldState
   */
  availableModels?: any[]
  
  /**
   * Model preferences (optional)
   * Used for model selection in WorldState
   */
  modelPreferences?: {
    modelMode?: 'automatic' | 'fixed'
    fixedModelId?: string | null
    fixedModeStrategy?: 'consistent' | 'loose'
  }
  
  /**
   * Orchestrator API key ID (optional)
   */
  orchestratorKeyId?: string
}

export interface UseWorldStateSyncReturn {
  /**
   * Ref to WorldStateManager instance
   * Use this for direct WorldState operations (e.g., addMessage)
   */
  worldStateRef: React.MutableRefObject<WorldStateManager | null>
  
  /**
   * WorldState instance for React components
   * Use this with useWorldState hook for reactive updates
   */
  worldStateInstance: WorldStateManager | null
}

/**
 * Hook for synchronizing WorldState with ReactFlow state
 * 
 * CRITICAL: This maintains the single source of truth architecture.
 * ReactFlow state drives WorldState, not the other way around.
 */
export function useWorldStateSync(
  options: UseWorldStateSyncOptions
): UseWorldStateSyncReturn {
  const {
    nodes,
    edges,
    currentStoryStructureNodeId,
    isAIDocPanelOpen,
    userId,
    availableProviders = [],
    availableModels = [],
    modelPreferences = {
      modelMode: 'automatic',
      fixedModelId: null,
      fixedModeStrategy: 'loose'
    },
    orchestratorKeyId
  } = options
  
  // WorldState instance (persisted via ref, exposed via state for React reactivity)
  const worldStateRef = useRef<WorldStateManager | null>(null)
  const [worldStateInstance, setWorldStateInstance] = useState<WorldStateManager | null>(null)
  
  /**
   * Initialize WorldState from ReactFlow state when ready
   * 
   * Runs once when:
   * - User is available
   * - Nodes are loaded (nodes.length > 0)
   * - WorldState hasn't been initialized yet
   */
  useEffect(() => {
    if (userId && nodes.length > 0 && !worldStateRef.current) {
      const ws = buildWorldStateFromReactFlow(
        nodes,
        edges,
        userId,
        {
          activeDocumentNodeId: currentStoryStructureNodeId,
          isDocumentPanelOpen: isAIDocPanelOpen,
          availableProviders,
          availableModels,
          modelPreferences,
          orchestratorKeyId
        }
      )
      worldStateRef.current = ws
      setWorldStateInstance(ws)
      console.log('✅ [useWorldStateSync] WorldState initialized for conversation management')
    }
  }, [userId, nodes.length > 0]) // Only run when user/nodes become available
  
  /**
   * Rebuild WorldState when ReactFlow state changes
   * 
   * CRITICAL: Preserves conversation messages during rebuild
   * This ensures chat history is maintained even when canvas changes
   * 
   * Rebuilds when:
   * - Nodes change (add/remove/update)
   * - Edges change (add/remove/update)
   * - Active document changes
   * - Document panel opens/closes
   */
  useEffect(() => {
    if (worldStateRef.current && nodes.length > 0) {
      // Preserve conversation messages before rebuild
      const conversationMessages = worldStateRef.current.getState().conversation.messages
      
      // Rebuild WorldState with updated ReactFlow state
      const ws = buildWorldStateFromReactFlow(
        nodes,
        edges,
        userId,
        {
          activeDocumentNodeId: currentStoryStructureNodeId,
          isDocumentPanelOpen: isAIDocPanelOpen,
          availableProviders,
          availableModels,
          modelPreferences,
          orchestratorKeyId
        }
      )
      
      // Restore conversation messages (preserve chat history)
      conversationMessages.forEach(msg => {
        ws.addMessage({
          content: msg.content,
          type: msg.type,
          role: msg.role
        })
      })
      
      // Update WorldState instance
      worldStateRef.current = ws
      setWorldStateInstance(ws)
      
      console.log('🔄 [useWorldStateSync] WorldState rebuilt, preserved', conversationMessages.length, 'conversation messages')
    }
  }, [
    nodes,
    edges,
    currentStoryStructureNodeId,
    isAIDocPanelOpen,
    userId,
    // Note: availableProviders, availableModels, modelPreferences, orchestratorKeyId
    // are intentionally not in deps to avoid unnecessary rebuilds
    // They're only used during initialization
  ])
  
  return {
    worldStateRef,
    worldStateInstance
  }
}

