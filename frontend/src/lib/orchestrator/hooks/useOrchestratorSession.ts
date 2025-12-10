/**
 * useOrchestratorSession Hook
 * 
 * Manages orchestrator session state with Supabase persistence.
 * Sessions are now scoped to story (canvas/project).
 * 
 * Updated: Added storyId parameter to scope chat history per canvas.
 * Updated: Type normalization to UPPERCASE for Supabase constraint.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ============================================================
// TYPES
// ============================================================

interface OrchestratorSession {
  id: string
  user_id: string
  story_id: string | null
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
}

interface OrchestratorMessage {
  id: string
  session_id: string
  role: 'user' | 'orchestrator' | 'system'
  content: string
  type: string
  created_at: string
  metadata?: Record<string, unknown>
}

interface UseOrchestratorSessionOptions {
  userId: string
  storyId?: string  // NEW: Scope session to story/canvas
  enabled?: boolean
  onSessionCreated?: (session: OrchestratorSession) => void
  onError?: (error: Error) => void
}

interface UseOrchestratorSessionReturn {
  session: OrchestratorSession | null
  messages: OrchestratorMessage[]
  isLoading: boolean
  error: Error | null
  persistMessage: (role: string, content: string, type: string, metadata?: Record<string, unknown>) => Promise<void>
  clearHistory: () => Promise<void>
  isEnabled: boolean
}

// ============================================================
// HOOK
// ============================================================

export function useOrchestratorSession({
  userId,
  storyId,
  enabled = true,
  onSessionCreated,
  onError
}: UseOrchestratorSessionOptions): UseOrchestratorSessionReturn {
  const [session, setSession] = useState<OrchestratorSession | null>(null)
  const [messages, setMessages] = useState<OrchestratorMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const supabaseRef = useRef(createClient())
  const initializingRef = useRef(false)

  // ========== INITIALIZE SESSION ==========
  useEffect(() => {
    if (!enabled || !userId || initializingRef.current) return
    
    const initSession = async () => {
      initializingRef.current = true
      setIsLoading(true)
      
      try {
        const supabase = supabaseRef.current
        
        // Build query to find existing session
        let query = supabase
          .from('orchestrator_sessions')
          .select('*')
          .eq('user_id', userId)
        
        // Scope to story if provided
        if (storyId) {
          query = query.eq('story_id', storyId)
        } else {
          query = query.is('story_id', null)
        }
        
        const { data: existingSessions, error: fetchError } = await query
          .order('updated_at', { ascending: false })
          .limit(1)
        
        if (fetchError) throw fetchError
        
        let activeSession: OrchestratorSession
        
        if (existingSessions && existingSessions.length > 0) {
          // Use existing session
          activeSession = existingSessions[0]
          console.log('📂 [Session] Found existing session:', activeSession.id)
        } else {
          // Create new session
          const { data: newSession, error: createError } = await supabase
            .from('orchestrator_sessions')
            .insert({
              user_id: userId,
              story_id: storyId || null,
              metadata: { 
                created_from: 'useOrchestratorSession',
                story_scoped: !!storyId
              }
            })
            .select()
            .single()
          
          if (createError) throw createError
          
          activeSession = newSession
          console.log('✨ [Session] Created new session:', activeSession.id, storyId ? `for story ${storyId}` : '(global)')
          onSessionCreated?.(activeSession)
        }
        
        setSession(activeSession)
        
        // Load messages for this session
        const { data: sessionMessages, error: messagesError } = await supabase
          .from('orchestrator_messages')
          .select('*')
          .eq('session_id', activeSession.id)
          .order('created_at', { ascending: true })
        
        if (messagesError) throw messagesError
        
        setMessages(sessionMessages || [])
        console.log('📝 [Session] Loaded', sessionMessages?.length || 0, 'messages')
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize session')
        console.error('❌ [Session] Error:', error)
        setError(error)
        onError?.(error)
      } finally {
        setIsLoading(false)
        initializingRef.current = false
      }
    }
    
    initSession()
  }, [userId, storyId, enabled, onSessionCreated, onError])
  
  // ========== RESET ON STORY CHANGE ==========
  useEffect(() => {
    // When storyId changes, reset session to trigger re-initialization
    if (storyId) {
      setSession(null)
      setMessages([])
      initializingRef.current = false
    }
  }, [storyId])

  // ========== PERSIST MESSAGE ==========
  const persistMessage = useCallback(async (
    role: string,
    content: string,
    type: string,
    metadata?: Record<string, unknown>
  ) => {
    if (!session) {
      console.warn('⚠️ [Session] Cannot persist message - no active session')
      return
    }
    
    try {
      const supabase = supabaseRef.current
      
      // Normalize type to UPPERCASE to match Supabase CHECK constraint
      const normalizedType = type.toUpperCase()
      
      // Log what we're trying to insert for debugging
      console.log('💾 [Session] Attempting to persist:', {
        role,
        type: normalizedType,
        contentLength: content.length,
        sessionId: session.id
      })
      
      const { data: newMessage, error } = await supabase
        .from('orchestrator_messages')
        .insert({
          session_id: session.id,
          role,
          content,
          type: normalizedType,
          metadata
        })
        .select()
        .single()
      
      if (error) {
        console.error('❌ [Session] Database error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          attemptedType: normalizedType,
          role,
          contentPreview: content.substring(0, 50)
        })
        throw error
      }
      
      // Update local state
      setMessages(prev => [...prev, newMessage])
      
      // Update session timestamp
      await supabase
        .from('orchestrator_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', session.id)
      
      console.log('💾 [Session] Message persisted:', newMessage.id, `(type: ${normalizedType})`)
      
    } catch (err) {
      console.error('❌ [Session] Failed to persist message:', err)
    }
  }, [session])

  // ========== CLEAR HISTORY ==========
  const clearHistory = useCallback(async () => {
    if (!session) return
    
    try {
      const supabase = supabaseRef.current
      
      const { error } = await supabase
        .from('orchestrator_messages')
        .delete()
        .eq('session_id', session.id)
      
      if (error) throw error
      
      setMessages([])
      console.log('🗑️ [Session] History cleared')
      
    } catch (err) {
      console.error('❌ [Session] Failed to clear history:', err)
    }
  }, [session])

  return {
    session,
    messages,
    isLoading,
    error,
    persistMessage,
    clearHistory,
    isEnabled: enabled
  }
}

export default useOrchestratorSession