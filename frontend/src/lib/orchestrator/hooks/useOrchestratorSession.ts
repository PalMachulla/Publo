// src/lib/orchestrator/hooks/useOrchestratorSession.ts

import { useEffect, useState, useCallback } from 'react'
import { getOrCreateSession, addMessage, loadMessages, Session, Message } from '../stateClient'

interface UseOrchestratorSessionOptions {
  userId: string
  canvasId?: string
  enabled?: boolean  // Feature flag
}

export function useOrchestratorSession({ 
  userId, 
  canvasId, 
  enabled = true 
}: UseOrchestratorSessionOptions) {
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Initialize session on mount
  useEffect(() => {
    if (!enabled || !userId) {
      setIsLoading(false)
      return
    }

    async function init() {
      try {
        setIsLoading(true)
        console.log('🔄 [Session] Initializing for user:', userId)
        
        const sess = await getOrCreateSession(userId, canvasId)
        setSession(sess)
        
        // Load existing messages
        const msgs = await loadMessages(sess.id)
        setMessages(msgs)
        console.log(`📂 [Session] Loaded ${msgs.length} messages`)
        
      } catch (err) {
        console.error('❌ [Session] Init error:', err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [userId, canvasId, enabled])

  // Persist a new message
  const persistMessage = useCallback(async (
    role: 'user' | 'orchestrator' | 'system',
    content: string,
    type: string = 'message',
    metadata: Record<string, any> = {}
  ) => {
    if (!session || !enabled) return null

    try {
      const msg = await addMessage(session.id, role, content, type, metadata)
      setMessages(prev => [...prev, msg])
      console.log('💾 [Session] Message persisted:', msg.id)
      return msg
    } catch (err) {
      console.error('❌ [Session] Failed to persist message:', err)
      return null
    }
  }, [session, enabled])

  return {
    session,
    messages,
    isLoading,
    error,
    persistMessage,
    isEnabled: enabled && !!session
  }
}