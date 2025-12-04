// src/lib/orchestrator/backendClient.ts

/**
 * Client for the Python Orchestrator Backend
 * 
 * Uses Next.js API route as proxy to avoid CORS issues.
 * The actual Python backend URL is configured server-side.
 */

import type { IntentAnalysis } from './context/intentRouter'
import type { PipelineContext } from './context/intent/pipeline/types'

export async function analyzeIntentViaBackend(
  message: string,
  context: Partial<PipelineContext>
): Promise<IntentAnalysis> {
  try {
    const requestBody = {
      message,
      activeSegment: context.activeSegment || null,
      documentPanelOpen: context.documentPanelOpen || false,
      documentFormat: context.documentFormat || null,
      canvasContext: null,
      conversationHistory: context.conversationHistory || [],
    }
    
    // Debug: Log what we're sending
    console.log('📤 [BackendClient] Sending to Python:', JSON.stringify(requestBody, null, 2))
    
    const response = await fetch('/api/orchestrator/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      console.error('❌ [BackendClient] Error response:', error)
      throw new Error(error.detail || `Backend error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('❌ [BackendClient] Failed to call Python backend:', error)
    throw error
  }
}

export function isPythonBackendEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_PYTHON_BACKEND === 'true'
}