// src/lib/orchestrator/stateClient.ts

/**
 * Client for Orchestrator State Management
 * 
 * Handles session creation, message persistence, and state retrieval.
 */

export interface Session {
    id: string
    user_id: string
    created_at: string
    is_active: boolean
    metadata: Record<string, any>
  }
  
  export interface Message {
    id: string
    session_id: string
    role: 'user' | 'orchestrator' | 'system'
    content: string
    type: string
    created_at: string
    metadata: Record<string, any>
  }
  
  /**
   * Get or create an active session for a user
   */
  export async function getOrCreateSession(userId: string, canvasId?: string): Promise<Session> {
    // First, try to get existing active session
    // const existingResponse = await fetch(`/api/orchestrator/state/sessions/${userId}/active`)
    const existingResponse = await fetch(`/api/orchestrator/state/users/${userId}/active`)
    
    if (existingResponse.ok) {
      const existing = await existingResponse.json()
      if (existing) {
        console.log('📂 [StateClient] Found existing session:', existing.id)
        return existing
      }
    }
    
    // No active session, create new one
    const createResponse = await fetch('/api/orchestrator/state/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        canvas_id: canvasId || null,
        metadata: {}
      }),
    })
    
    if (!createResponse.ok) {
      throw new Error('Failed to create session')
    }
    
    const newSession = await createResponse.json()
    console.log('✨ [StateClient] Created new session:', newSession.id)
    return newSession
  }
  
  /**
   * Add a message to the current session
   */
  export async function addMessage(
    sessionId: string,
    role: 'user' | 'orchestrator' | 'system',
    content: string,
    type: string = 'message',
    metadata: Record<string, any> = {}
  ): Promise<Message> {
    const response = await fetch('/api/orchestrator/state/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        role,
        content,
        type,
        metadata
      }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to add message')
    }
    
    return response.json()
  }
  
  /**
   * Load messages for a session
   */
  export async function loadMessages(sessionId: string, limit: number = 50): Promise<Message[]> {
    const response = await fetch(`/api/orchestrator/state/sessions/${sessionId}/messages?limit=${limit}`)
    
    if (!response.ok) {
      throw new Error('Failed to load messages')
    }
    
    const data = await response.json()
    return data.messages || []
  }