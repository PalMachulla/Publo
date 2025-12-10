// ============================================================
// useOrchestratorStream Hook
// ============================================================
// Manages SSE connection and progressive UI state

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  OrchestratorEvent,
  CreationProgress,
  initialCreationProgress,
  StructureCreatedEvent,
  SectionWritingEvent,
  SectionCompleteEvent,
  MessageEvent,
  ClarificationEvent,
} from '@/types/orchestrator-streaming-types';

// Chat message for display
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'progress' | 'structure' | 'section-progress' | 'error' | 'thinking';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface UseOrchestratorStreamOptions {
  onStructureComplete?: (structure: StructureCreatedEvent) => void;
  onSectionComplete?: (sectionId: string, content: string) => void;
  onClarificationNeeded?: (clarification: ClarificationEvent) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  streamUrl?: string;
  initialMessages?: ChatMessage[];  // Load persisted messages on mount
  onMessageAdded?: (message: ChatMessage) => void;  // Callback to persist dialogue messages
}

export function useOrchestratorStream(options: UseOrchestratorStreamOptions = {}) {
  const {
    onStructureComplete,
    onSectionComplete,
    onClarificationNeeded,
    onError,
    onComplete,
    streamUrl = '/api/orchestrator/orchestrate/stream',
    initialMessages = [],
    onMessageAdded,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [progress, setProgress] = useState<CreationProgress>({
    isActive: false,
    stage: 'idle',
    percentComplete: 0,
  });
  const [isStreaming, setIsStreaming] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdCounter = useRef(0);
  const clarificationSentRef = useRef(false);  // Dedupe clarifications
  
  // Track streaming reasoning message (for token-by-token updates)
  const reasoningMessageIdRef = useRef<string | null>(null);
  
  // Track if we've loaded initial messages to avoid overwriting during active streams
  const hasLoadedInitialMessages = useRef(false);
  
  // Sync initialMessages when they load asynchronously (e.g., from persistence)
  // Only update once when initialMessages become available and messages are empty
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0 && !hasLoadedInitialMessages.current) {
      console.log('💾 [useOrchestratorStream] Loading', initialMessages.length, 'persisted messages')
      setMessages(initialMessages)
      hasLoadedInitialMessages.current = true
    }
  }, [initialMessages, messages.length])
  
  // Generate unique message ID
  const generateId = () => `msg-${++messageIdCounter.current}-${Date.now()}`;

  // Add a message to the chat
  const addMessage = useCallback((
    type: ChatMessage['type'],
    content: string,
    metadata?: Record<string, unknown>
  ) => {
    const message: ChatMessage = {
      id: generateId(),
      type,
      content,
      timestamp: new Date(),
      metadata,
    };
    setMessages(prev => [...prev, message]);
    
    // Persist dialogue messages (user/assistant) but skip thinking/progress
    if (onMessageAdded && (type === 'user' || type === 'assistant')) {
      onMessageAdded(message);
    }
    
    return message.id;
  }, [onMessageAdded]);

  // Update an existing message
  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  }, []);

  // Handle incoming events
  const handleEvent = useCallback((event: OrchestratorEvent) => {
    switch (event.type) {
      case 'REASONING_TOKEN':
        /**
         * Token-by-token reasoning streaming (like Claude.ai/Cursor)
         * 
         * This event is sent as the LLM generates reasoning tokens.
         * We accumulate tokens and update a single "thinking" message
         * to show progressive reasoning in real-time.
         */
        const tokenData = event.data as { token: string; is_complete?: boolean };
        
        if (!reasoningMessageIdRef.current) {
          // Create new reasoning message on first token
          const messageId = addMessage('thinking', `💭 ${tokenData.token}`);
          reasoningMessageIdRef.current = messageId;
          console.log('🧠 [Stream] Started reasoning stream');
        } else {
          // Update existing reasoning message with accumulated tokens
          updateMessage(reasoningMessageIdRef.current, {
            content: `💭 ${tokenData.token}`
          });
        }
        
        // If reasoning is complete, clear the ref for next stream
        if (tokenData.is_complete) {
          console.log('✅ [Stream] Reasoning stream complete');
          reasoningMessageIdRef.current = null;
        }
        break;

      case 'INTENT':
        /**
         * Intent analysis complete
         * 
         * Clear reasoning message ref since intent analysis is done.
         * The reasoning tokens have already been streamed via REASONING_TOKEN events.
         */
        console.log('🎯 Intent:', event.data);
        reasoningMessageIdRef.current = null;  // Clear reasoning ref
        break;

      case 'STRATEGY':
        // Silent - internal
        console.log('📋 Strategy:', event.data.strategy);
        break;

      case 'MESSAGE':
        const msgData = event.data as MessageEvent;
        if (msgData.type === 'thinking') {
          addMessage('thinking', msgData.content);
        } else {
          addMessage('assistant', msgData.content);
        }
        break;

      case 'STRUCTURE_CREATED':
        const structureData = event.data as StructureCreatedEvent;
        
        // Update progress state
        setProgress(prev => ({
          ...prev,
          isActive: true,
          stage: 'structuring',
          structure: {
            title: structureData.title,
            sections: structureData.sections.map(s => ({
              id: s.id,
              title: s.title,
              status: 'pending' as const,
            })),
          },
          percentComplete: 10,
        }));

        // Add visual message
        addMessage(
          'structure',
          `📐 Creating "${structureData.title}" with ${structureData.section_count} sections`,
          { structure: structureData }
        );

        // Callback
        onStructureComplete?.(structureData);
        break;

      case 'SECTION_WRITING':
        const writingData = event.data as SectionWritingEvent;
        
        // Update section status
        setProgress(prev => {
          if (!prev.structure) return prev;
          
          const totalSections = prev.structure.sections.length;
          const currentIndex = prev.structure.sections.findIndex(s => s.id === writingData.section_id);
          const basePercent = 10; // After structure created
          const writingPercent = 80; // Writing takes 80% of progress
          const sectionPercent = writingPercent / totalSections;
          
          return {
            ...prev,
            stage: 'writing',
            currentSection: writingData.title,
            percentComplete: basePercent + (currentIndex * sectionPercent),
            structure: {
              ...prev.structure,
              sections: prev.structure.sections.map(s =>
                s.id === writingData.section_id
                  ? { ...s, status: 'writing' as const }
                  : s
              ),
            },
          };
        });

        // Add visual message
        addMessage(
          'section-progress',
          `✍️ Writing "${writingData.title}"...`,
          { sectionId: writingData.section_id }
        );
        break;

      case 'SECTION_COMPLETE':
        const completeData = event.data as SectionCompleteEvent;
        
        // Update section status
        setProgress(prev => {
          if (!prev.structure) return prev;
          
          const completedCount = prev.structure.sections.filter(
            s => s.status === 'complete' || s.id === completeData.section_id
          ).length;
          const totalSections = prev.structure.sections.length;
          const percent = 10 + (completedCount / totalSections) * 80;
          
          return {
            ...prev,
            percentComplete: Math.min(percent, 90),
            structure: {
              ...prev.structure,
              sections: prev.structure.sections.map(s =>
                s.id === completeData.section_id
                  ? {
                      ...s,
                      status: 'complete' as const,
                      preview: completeData.preview,
                      wordCount: completeData.word_count,
                    }
                  : s
              ),
            },
          };
        });
        break;

      case 'RESULT':
        // This carries the actual content - callback for canvas/editor
        onSectionComplete?.(event.data.section_id, event.data.content);
        break;

      case 'CLARIFICATION':
        // Deduplicate - only show clarification once per stream
        if (clarificationSentRef.current) {
          console.log('⏭️ Skipping duplicate clarification');
          break;
        }
        clarificationSentRef.current = true;
        
        const clarificationData = event.data as ClarificationEvent;
        
        // Add message with the options embedded for display
        addMessage(
          'assistant', 
          clarificationData.message || 'I need some clarification:',
          { 
            type: 'clarification',
            options: clarificationData.options,
            originalAction: clarificationData.originalAction 
          }
        );
        
        // Also call the external callback if provided
        onClarificationNeeded?.(clarificationData);
        
        // Stop streaming - we're waiting for user input
        setIsStreaming(false);
        setProgress(prev => ({
          ...prev,
          stage: 'idle',
          isActive: false,
        }));
        break;

      case 'CRITIC':
        if (!event.data.approved) {
          addMessage('thinking', '🔄 Revising based on feedback...');
        }
        break;

      case 'DONE':
        setProgress(prev => ({
          ...prev,
          stage: 'complete',
          percentComplete: 100,
        }));
        addMessage('assistant', '✅ Structure ready!');
        onComplete?.();
        break;

      case 'ERROR':
        setProgress(prev => ({
          ...prev,
          stage: 'error',
          error: event.data.error,
        }));
        addMessage('error', `❌ ${event.data.error}`);
        onError?.(event.data.error);
        break;
    }
  }, [addMessage, onStructureComplete, onSectionComplete, onClarificationNeeded, onError, onComplete]);

  // Start streaming
  const startStream = useCallback(async (request: {
    message: string;
    userId: string;
    sessionId?: string;
    documentFormat?: string;
    activeSegment?: unknown;
    documentPanelOpen?: boolean;
    canvasContext?: unknown;
    structureItems?: unknown[];
    canvasNodes?: unknown[];
    conversationHistory?: unknown[];
    clarificationResponse?: string;
    originalAction?: string;  // The action that needed clarification (e.g., 'create_structure')
    [key: string]: unknown;
  }) => {
    // Abort any existing stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    clarificationSentRef.current = false;  // Reset for new stream
    reasoningMessageIdRef.current = null;  // Reset reasoning message ref for new stream

    // Reset state
    setIsStreaming(true);
    setProgress({
      isActive: true,
      stage: 'planning',
      percentComplete: 0,
    });

    // Add user message
    addMessage('user', request.message);
    
    // Add initial progress message
    addMessage('progress', '🤖 Let me help you with that...');

    // Convert camelCase to snake_case for Python backend
    const snakeCaseRequest = {
      message: request.message,
      user_id: request.userId,
      session_id: request.sessionId,
      document_format: request.documentFormat,
      active_segment: request.activeSegment,
      document_panel_open: request.documentPanelOpen,
      canvas_context: request.canvasContext,
      structure_items: request.structureItems,
      canvas_nodes: request.canvasNodes,
      conversation_history: request.conversationHistory,
      clarification_response: request.clarificationResponse,
      original_action: request.originalAction,
    };

    // Debug: Log if this is a clarification response
    if (request.clarificationResponse) {
      console.log('📤 [Stream] Sending clarification response:', {
        clarification_response: snakeCaseRequest.clarification_response,
        original_action: snakeCaseRequest.original_action,
      })
    }

    try {
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snakeCaseRequest),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEventType = '';
        
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && currentEventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleEvent({ type: currentEventType as any, data });
            } catch (e) {
              console.error('Failed to parse event data:', e);
            }
            currentEventType = '';
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Stream aborted');
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      handleEvent({ type: 'ERROR', data: { error: errorMessage } });
    } finally {
      setIsStreaming(false);
    }
  }, [streamUrl, addMessage, handleEvent]);

  // Stop streaming
  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Clear messages (UI only - persisted messages will reload on refresh)
  const clearMessages = useCallback(() => {
    setMessages([]);
    setProgress({
      isActive: false,
      stage: 'idle',
      percentComplete: 0,
    });
    reasoningMessageIdRef.current = null;  // Reset reasoning message ref
  }, []);

  return {
    messages,
    progress,
    isStreaming,
    startStream,
    stopStream,
    clearMessages,
    addMessage,
  };
}