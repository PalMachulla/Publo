/**
 * Context Builder
 * 
 * Maps worldState and other sources to PipelineContext
 */

import type { PipelineContext, CanvasNode } from '../pipeline/types'
import type { WorldStateManager } from '../../../core/worldState'
import type { Blackboard } from '../../../core/blackboard'
import { Node } from 'reactflow'
import type { ConversationMessage } from '../../llmIntentAnalyzer'

/**
 * Build PipelineContext from worldState and other sources
 */
export function buildPipelineContext(
  worldState: WorldStateManager,
  blackboard?: Blackboard,
  canvasNodes?: Node[],
  canvasContext?: string
): PipelineContext {
  // Get document panel state
  const documentPanelOpen = worldState.get('ui.documentPanelOpen') || false
  
  // Get active document info
  const activeDocument = worldState.get('activeDocument')
  const selectedSectionId = activeDocument?.selectedSectionId
  
  // Build active segment if document is open and section is selected
  let activeSegment: PipelineContext['activeSegment'] = undefined
  if (documentPanelOpen && selectedSectionId && activeDocument?.structure) {
    const structure = activeDocument.structure
    const section = findSectionInStructure(structure, selectedSectionId)
    if (section) {
      activeSegment = {
        id: selectedSectionId,
        name: section.name,
        title: section.name,
        hasContent: !!(activeDocument.content?.get(selectedSectionId))
      }
    }
  }
  
  // Get document format
  const documentFormat = activeDocument?.format || undefined
  
  // Convert canvas nodes to pipeline format
  const pipelineCanvasNodes: CanvasNode[] | undefined = canvasNodes?.map(node => ({
    id: node.id,
    label: node.data?.label || node.id,
    type: node.type || 'default',
    metadata: node.data
  }))
  
  // Get conversation history from blackboard or worldState
  let conversationHistory: ConversationMessage[] | undefined = undefined
  if (blackboard) {
    const messages = blackboard.getMessages()
    conversationHistory = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp
    }))
  } else {
    // Fallback to worldState conversation
    const worldStateMessages = worldState.get('conversation.messages') || []
    conversationHistory = worldStateMessages
      .filter(msg => msg.role === 'user' || msg.role === 'orchestrator')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }))
  }
  
  // Determine conversation state
  const conversationState = determineConversationState(worldState, blackboard)
  
  return {
    documentPanelOpen,
    activeSegment,
    documentFormat,
    canvasNodes: pipelineCanvasNodes,
    canvasContext,
    conversationHistory,
    conversationState
  }
}

/**
 * Find a section in the document structure
 */
function findSectionInStructure(
  structure: any,
  sectionId: string
): { id: string; name: string; level: number } | null {
  if (!structure || !Array.isArray(structure)) {
    return null
  }
  
  // Recursive search
  function search(items: any[]): { id: string; name: string; level: number } | null {
    for (const item of items) {
      if (item.id === sectionId) {
        return {
          id: item.id,
          name: item.name,
          level: item.level || 1
        }
      }
      if (item.children && Array.isArray(item.children)) {
        const found = search(item.children)
        if (found) return found
      }
    }
    return null
  }
  
  return search(structure)
}

/**
 * Determine conversation state from worldState/blackboard
 */
function determineConversationState(
  worldState: WorldStateManager,
  blackboard?: Blackboard
): PipelineContext['conversationState'] {
  // Check for pending clarification
  const pendingClarification = worldState.get('ui.pendingClarification')
  if (pendingClarification) {
    return {
      type: 'awaiting_clarification',
      question: pendingClarification.question,
      options: pendingClarification.options?.map(opt => opt.label) || []
    }
  }
  
  // Default to initial state
  return { type: 'initial' }
}

