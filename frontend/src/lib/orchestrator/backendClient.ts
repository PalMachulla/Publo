/**
 * Client for the Python Orchestrator Backend
 * 
 * =============================================================================
 * POST-PYTHON MIGRATION
 * =============================================================================
 * 
 * This client communicates with the Python orchestrator backend via Next.js
 * API routes (to avoid CORS issues). The actual Python backend URL is
 * configured server-side in the API routes.
 * 
 * Flow:
 * 1. Frontend calls functions in this file
 * 2. These call Next.js API routes (/api/orchestrator/*)
 * 3. API routes proxy to Python backend (FastAPI)
 * 4. Python returns response, which flows back to frontend
 * 
 * @see /api/orchestrator/intent/route.ts - Intent analysis proxy
 * @see /api/orchestrator/orchestrate/route.ts - Main orchestration proxy
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES - Defined inline since we deprecated the old type files
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intent analysis result from Python backend
 * Matches Python: orchestrator/models.py IntentAnalysis
 */
export interface IntentAnalysis {
  intent: string
  confidence: number
  entities?: Record<string, string | string[]>
  documentFormat?: string
  template?: string
  requiresTemplateSelection?: boolean
  suggestedActions?: string[]
}

/**
 * Context passed to intent analysis
 */
export interface PipelineContext {
  activeSegment?: {
    id: string
    name: string
    type: 'section' | 'segment'
  } | null
  documentPanelOpen?: boolean
  documentFormat?: string | null
  canvasContext?: any
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

/**
 * Request to the orchestrate endpoint
 */
export interface OrchestrateRequest {
  message: string
  userId: string
  storyId?: string
  canvasNodes?: any[]
  canvasEdges?: any[]
  currentStoryStructureNodeId?: string | null
  isDocumentViewOpen?: boolean
  activeContext?: {
    type: 'section' | 'segment'
    id: string
    name: string
  } | null
  clarificationResponse?: {
    optionId: string
    originalAction: string
  }
}

/**
 * Response from the orchestrate endpoint
 */
export interface OrchestrateResponse {
  success: boolean
  message: string
  intent?: string
  confidence?: number
  actions: OrchestratorAction[]
  options?: Array<{
    id: string
    label: string
    description?: string
    icon?: string
  }>
  requiresClarification?: boolean
  error?: string
}

/**
 * Action returned by orchestrator
 */
export interface OrchestratorAction {
  type: string
  status: 'pending' | 'completed' | 'failed'
  payload: Record<string, any>
  description?: string
  error?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze intent via Python backend
 * 
 * @param message - User's message
 * @param context - Current context (document state, conversation history, etc.)
 * @returns Intent analysis from Python
 */
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

/**
 * Main orchestration call via Python backend
 * 
 * @param request - Orchestration request
 * @returns Orchestration response with actions
 */
export async function orchestrate(
  request: OrchestrateRequest
): Promise<OrchestrateResponse> {
  try {
    console.log('📤 [BackendClient] Orchestrate request:', {
      message: request.message.substring(0, 100),
      userId: request.userId,
      storyId: request.storyId,
      hasClarification: !!request.clarificationResponse
    })
    
    const response = await fetch('/api/orchestrator/orchestrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      console.error('❌ [BackendClient] Orchestrate error:', error)
      throw new Error(error.detail || `Backend error: ${response.status}`)
    }
    
    const result = await response.json()
    console.log('📥 [BackendClient] Orchestrate response:', {
      success: result.success,
      intent: result.intent,
      actionsCount: result.actions?.length,
      requiresClarification: result.requiresClarification
    })
    
    return result
  } catch (error) {
    console.error('❌ [BackendClient] Orchestrate failed:', error)
    throw error
  }
}

/**
 * Check if Python backend is enabled via environment variable
 * 
 * @deprecated Always returns true now - Python backend is the only option
 */
export function isPythonBackendEnabled(): boolean {
  // Legacy check - Python backend is now always used
  return true
}