// src/lib/orchestrator/context/intentAnalyzerWrapper.ts

/**
 * Intent Analyzer Wrapper
 * 
 * Switches between Python backend and TypeScript implementation
 * based on feature flag.
 */

import type { IntentAnalysis, IntentContext } from './intentRouter'
import type { PipelineContext } from './intent/pipeline/types'
import type { ConversationMessage as BlackboardConversationMessage } from '../core/blackboard'
import { analyzeIntent as analyzeIntentTS } from './intentRouter'
import { analyzeIntentViaBackend, isPythonBackendEnabled } from '../backendClient'

/**
 * Convert PipelineContext + message to IntentContext
 */
function pipelineContextToIntentContext(
  message: string,
  context: PipelineContext
): IntentContext {
  return {
    message,
    hasActiveSegment: !!context.activeSegment,
    activeSegmentName: context.activeSegment?.name,
    activeSegmentId: context.activeSegment?.id,
    activeSegmentHasContent: context.activeSegment?.hasContent,
    conversationHistory: context.conversationHistory?.map((msg, index): BlackboardConversationMessage => ({
      id: (msg as any).id || `msg-${Date.now()}-${index}`, // Generate ID if missing
      role: msg.role === 'assistant' ? 'orchestrator' : msg.role, // Map 'assistant' to 'orchestrator'
      content: msg.content,
      timestamp: msg.timestamp
    })),
    isDocumentViewOpen: context.documentPanelOpen,
    documentFormat: context.documentFormat,
    canvasContext: context.canvasContext,
    // Note: availableModels and corrections are not in PipelineContext
    // These would need to be passed separately if needed
  }
}

export async function analyzeIntent(
  message: string,
  context: PipelineContext
): Promise<IntentAnalysis> {
  if (isPythonBackendEnabled()) {
    console.log('🐍 [IntentAnalyzer] Using Python backend')
    return analyzeIntentViaBackend(message, context)
  } else {
    console.log('📘 [IntentAnalyzer] Using TypeScript implementation')
    // Convert PipelineContext to IntentContext
    const intentContext = pipelineContextToIntentContext(message, context)
    return analyzeIntentTS(intentContext)
  }
}