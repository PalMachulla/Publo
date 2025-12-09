/**
 * OrchestratorEngine Helpers
 * 
 * WorldState access helpers for backward-compatible state access.
 * These functions provide a clean interface for reading state from WorldState
 * or falling back to request props.
 * 
 * Priority: WorldState > Request Props
 * 
 * Architecture:
 * - These are pure functions that take dependencies as parameters
 * - The main OrchestratorEngine class wraps these with protected methods
 * - This separation allows for better testing and organization
 */

import type { Node, Edge } from 'reactflow'
import type { WorldStateManager } from './worldState'
import type { OrchestratorRequest } from './orchestratorEngine.types'
import type { TieredModel } from './modelRouter'

/**
 * Get canvas nodes from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getCanvasNodesHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): Node[] {
  if (worldState) {
    return worldState.getAllNodes().map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data
    }))
  }
  return request.canvasNodes || []
}

/**
 * Get canvas edges from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getCanvasEdgesHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): Edge[] {
  if (worldState) {
    return worldState.getAllEdges().map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      data: e.data
    }))
  }
  return request.canvasEdges || []
}

/**
 * Get active context (section) from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getActiveContextHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): { id: string; name: string } | undefined {
  if (worldState) {
    const sectionId = worldState.getActiveSectionId()
    const doc = worldState.getActiveDocument()
    if (sectionId && doc.structure) {
      const section = doc.structure.items.find(item => item.id === sectionId)
      if (section) {
        return { id: section.id, name: section.name }
      }
    }
    return undefined
  }
  return request.activeContext
}

/**
 * Check if document view is open
 * Priority: WorldState > Request Props
 */
export function isDocumentViewOpenHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): boolean {
  if (worldState) {
    return worldState.isDocumentPanelOpen()
  }
  return request.isDocumentViewOpen || false
}

/**
 * Get document format from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getDocumentFormatHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): string | undefined {
  if (worldState) {
    return worldState.getActiveDocument().format || undefined
  }
  return request.documentFormat
}

/**
 * Get structure items from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getStructureItemsHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): any[] | undefined {
  if (worldState) {
    return worldState.getActiveDocument().structure?.items
  }
  return request.structureItems
}

/**
 * Get content map from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getContentMapHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): Record<string, string> | undefined {
  if (worldState) {
    const contentMap: Record<string, string> = {}
    worldState.getActiveDocument().content.forEach((content, id) => {
      contentMap[id] = content
    })
    return contentMap
  }
  return request.contentMap
}

/**
 * Get available providers from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getAvailableProvidersHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): string[] | undefined {
  if (worldState) {
    return worldState.getState().user.availableProviders
  }
  return request.availableProviders
}

/**
 * Get available models from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getAvailableModelsHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): TieredModel[] | undefined {
  if (worldState) {
    return worldState.getState().user.availableModels
  }
  return request.availableModels
}

/**
 * Get model preferences from WorldState or request
 * Priority: WorldState > Request Props
 */
export function getModelPreferencesHelper(
  worldState: WorldStateManager | undefined,
  request: OrchestratorRequest
): {
  modelMode?: 'automatic' | 'fixed'
  fixedModelId?: string | null
  fixedModeStrategy?: 'consistent' | 'loose'
} {
  if (worldState) {
    return worldState.getUserPreferences()
  }
  return {
    modelMode: request.modelMode,
    fixedModelId: request.fixedModelId,
    fixedModeStrategy: request.fixedModeStrategy
  }
}

