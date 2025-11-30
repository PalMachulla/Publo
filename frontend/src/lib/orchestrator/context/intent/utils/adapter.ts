/**
 * Adapter Layer
 * 
 * Maps between pipeline types and existing intentRouter types for backward compatibility.
 */

import type { IntentContext, IntentAnalysis } from '../../intentRouter'
import type { PipelineContext } from '../pipeline/types'
import { buildPipelineContext } from './contextBuilder'
import type { WorldStateManager } from '../../../core/worldState'
import type { Blackboard } from '../../../core/blackboard'
import { Node } from 'reactflow'

/**
 * Convert IntentContext to PipelineContext
 */
export function intentContextToPipelineContext(
  context: IntentContext,
  worldState?: WorldStateManager,
  blackboard?: Blackboard,
  canvasNodes?: Node[]
): PipelineContext {
  // Use contextBuilder if worldState is available
  if (worldState) {
    try {
      return buildPipelineContext(worldState, blackboard, canvasNodes, context.canvasContext)
    } catch (error) {
      console.warn('⚠️ [Adapter] Failed to build from worldState, using fallback:', error)
      // Fall through to fallback
    }
  }
  
  // Fallback: build from IntentContext directly
  return {
    documentPanelOpen: context.isDocumentViewOpen || false,
    activeSegment: context.hasActiveSegment ? {
      id: context.activeSegmentId || '',
      name: context.activeSegmentName || '',
      hasContent: context.activeSegmentHasContent || false
    } : undefined,
    documentFormat: context.documentFormat,
    canvasNodes: canvasNodes?.map(node => ({
      id: node.id,
      label: node.data?.label || node.id,
      type: node.type || 'default',
      metadata: node.data
    })),
    canvasContext: context.canvasContext,
    conversationHistory: context.conversationHistory,
    conversationState: undefined // Will be determined by ConversationTracker
  }
}

/**
 * Convert PipelineIntentAnalysis to IntentAnalysis (removes pipeline-specific fields)
 */
export function pipelineAnalysisToIntentAnalysis(
  analysis: any
): IntentAnalysis {
  // Remove pipeline-specific fields
  const { pipelineMetrics, totalTime, chainOfThought, ...intentAnalysis } = analysis
  
  return intentAnalysis as IntentAnalysis
}

