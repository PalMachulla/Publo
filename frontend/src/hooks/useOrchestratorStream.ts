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
  IntentEvent,
  PlanEvent,
  StrategyEvent,
  OpenDocumentEvent,
  SelectSectionEvent,
  // Deep Agent events
  TokenEvent,
  ToolStartEvent,
  ToolEndEvent,
  ContentChunkEvent,
  ContentCompleteEvent,
  NavigateEvent,
  PresentOptionsEvent,
} from '@/types/orchestrator-streaming-types';

// Chat message for display
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'progress' | 'structure' | 'section-progress' | 'error' | 'thinking' | 'reasoning';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface UseOrchestratorStreamOptions {
  onStructureComplete?: (structure: StructureCreatedEvent) => void;
  onSectionComplete?: (sectionId: string, content: string) => void;
  onClarificationNeeded?: (clarification: ClarificationEvent) => void;
  onOpenDocument?: (nodeId: string, nodeName: string) => void;  // Navigation: open document
  onSelectSection?: (sectionId: string, sectionName: string) => void;  // Navigation: select section
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
    onOpenDocument,
    onSelectSection,
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

  // Track streaming assistant message (for token-by-token updates)
  const assistantMessageIdRef = useRef<string | null>(null);
  
  // Accumulate content to avoid React batching issues
  const accumulatedContentRef = useRef<string>('');
  
  // Handle incoming events
  const handleEvent = useCallback((event: OrchestratorEvent) => {
    switch (event.type) {
      // ============================================================
      // DEEP AGENT EVENTS (New Architecture)
      // ============================================================
      
      case 'TOKEN':
        /**
         * Streaming text token from Deep Agent
         * 
         * FIX: Only accumulate in ref during streaming.
         * State updates happen on DONE to avoid React batching issues.
         * Show placeholder during streaming for UX.
         */
        const tokenContent = (event.data as TokenEvent).content || '';
        
        // Accumulate in ref (always succeeds, no batching issues)
        accumulatedContentRef.current += tokenContent;
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/590edda1-d2cc-4e7e-b43e-dfdf13ca907f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOrchestratorStream.ts:145',message:'TOKEN received',data:{tokenLength:tokenContent.length,accumulatedLength:accumulatedContentRef.current.length,hasAssistantMsg:!!assistantMessageIdRef.current},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H'})}).catch(()=>{});
        // #endregion

        if (!assistantMessageIdRef.current) {
          // First token - create placeholder message
          const messageId = generateId();
          assistantMessageIdRef.current = messageId;

          const assistantMessage: ChatMessage = {
            id: messageId,
            type: 'assistant',
            content: accumulatedContentRef.current,
            timestamp: new Date(),
            metadata: { isStreaming: true }
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        // Don't update state on every token - wait for DONE
        break;
      
      case 'TOOL_START':
        /**
         * Tool execution starting
         */
        const toolStartData = event.data as ToolStartEvent;
        console.log('🔧 [Tool Start]', toolStartData.tool);
        
        // Show thinking indicator for long-running tools
        if (['write_section', 'create_structure'].includes(toolStartData.tool)) {
          addMessage('thinking', `🔧 ${toolStartData.tool === 'write_section' ? 'Writing content...' : 'Creating structure...'}`);
        }
        break;
      
      case 'TOOL_END':
        /**
         * Tool execution complete
         */
        const toolEndData = event.data as ToolEndEvent;
        console.log('✅ [Tool End]', toolEndData.tool);
        break;
      
      case 'CONTENT_CHUNK':
        /**
         * Streaming content chunk from write_section
         */
        const chunkData = event.data as ContentChunkEvent;
        // Content chunks are handled separately in the editor
        // Just log for debugging
        console.log('📝 [Content Chunk]', chunkData.section_id, chunkData.chunk.length, 'chars');
        break;
      
      case 'CONTENT_COMPLETE':
        /**
         * Section writing complete
         */
        const contentCompleteData = event.data as ContentCompleteEvent;
        console.log('✅ [Content Complete]', contentCompleteData.section_id, contentCompleteData.word_count, 'words');
        
        // Update progress
        setProgress(prev => {
          if (!prev.structure) return prev;
          
          return {
            ...prev,
            structure: {
              ...prev.structure,
              sections: prev.structure.sections.map(s =>
                s.id === contentCompleteData.section_id
                  ? { ...s, status: 'complete' as const, wordCount: contentCompleteData.word_count }
                  : s
              ),
            },
          };
        });
        break;
      
      case 'NAVIGATE':
        /**
         * Navigate to a section (Deep Agent version)
         */
        const navigateData = event.data as NavigateEvent;
        console.log('📍 [Navigate]', navigateData.section_name || navigateData.section_id);
        
        addMessage('assistant', `📍 Navigating to "${navigateData.section_name || navigateData.section_id}"...`);
        onSelectSection?.(navigateData.section_id, navigateData.section_name || '');
        break;
      
      case 'PRESENT_OPTIONS':
        /**
         * Present options to user (Deep Agent version)
         */
        const optionsData = event.data as PresentOptionsEvent;
        console.log('❓ [Present Options]', optionsData.prompt, optionsData.options.length, 'options');
        
        // Add as clarification message
        addMessage(
          'assistant',
          optionsData.prompt,
          {
            type: 'clarification',
            options: optionsData.options,
          }
        );
        break;
      
      // ============================================================
      // LEGACY EVENTS (Backwards Compatibility)
      // ============================================================
      
      case 'REASONING_TOKEN':
        /**
         * Token-by-token reasoning streaming
         * 
         * Stream reasoning tokens to UI in a collapsible ThinkingBlock.
         * Creates a 'reasoning' message on first token, appends on subsequent tokens.
         */
        const token = (event.data as { token: string }).token || '';
        
        if (!reasoningMessageIdRef.current) {
          // First token - create new reasoning message
          const messageId = generateId();
          reasoningMessageIdRef.current = messageId;
          
          const reasoningMessage: ChatMessage = {
            id: messageId,
            type: 'reasoning',
            content: token,
            timestamp: new Date(),
            metadata: {
              startTime: new Date().toISOString(),
              isStreaming: true
            }
          };
          setMessages(prev => [...prev, reasoningMessage]);
        } else {
          // Subsequent tokens - append to existing message
          updateMessage(reasoningMessageIdRef.current, {
            content: token,  // Backend sends accumulated content, not just new token
            metadata: { isStreaming: true }
          });
        }
        break;

      case 'INTENT':
        /**
         * Intent analysis complete - mark reasoning as finished
         */
        console.log('🎯 Intent:', event.data);
        
        // Mark reasoning message as complete
        if (reasoningMessageIdRef.current) {
          updateMessage(reasoningMessageIdRef.current, {
            metadata: { 
              isStreaming: false,
              endTime: new Date().toISOString()
            }
          });
          reasoningMessageIdRef.current = null;
        }
        
        // Don't show intent to users - it's internal
        break;

      case 'PLAN':
        /**
         * Plan created by Deep Agent Planner
         * Show a clean, user-friendly summary of what will happen
         */
        const planData = event.data as PlanEvent;
        console.log('📋 Plan:', planData);
        
        // Skip if no steps
        if (!planData.steps || planData.steps.length === 0) break;
        
        // Create a clean, user-friendly plan message
        const stepsFormatted = planData.steps
          .slice(0, 5)  // Limit to first 5 steps for brevity
          .map((step, i) => {
            const icon = step.action_type === 'generate_structure' ? '📐' :
                        step.action_type === 'generate_content' ? '✍️' :
                        step.action_type === 'select_section' ? '📍' :
                        step.action_type === 'open_document' ? '📂' : '•';
            // Clean up the description - truncate if too long
            const desc = step.description.length > 60 
              ? step.description.substring(0, 57) + '...'
              : step.description;
            return `${icon} ${desc}`;
          })
          .join('\n');
        
        addMessage('thinking', `📋 **Plan:**\n${stepsFormatted}`);
        break;

      case 'STRATEGY':
        // Silent - don't show strategy to users, it's internal
        console.log('📋 [Internal] Strategy:', event.data.strategy);
        break;

      case 'MESSAGE':
        const msgData = event.data as MessageEvent;
        // Filter out internal "thinking" messages with technical content
        if (msgData.type === 'thinking') {
          // Only show if it's a user-friendly message, not internal details
          const content = msgData.content.toLowerCase();
          const isInternal = content.includes('created plan') || 
                            content.includes('generated') ||
                            content.includes('action(s)') ||
                            content.includes('strategy:') ||
                            content.includes('intent:') ||
                            content.startsWith('```');
          if (!isInternal) {
            addMessage('thinking', msgData.content);
          } else {
            console.log('💭 [Internal]', msgData.content);
          }
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
        
        // Skip if no valid section info
        if (!writingData.title || writingData.title === 'Section') {
          console.log('⏭️ [Stream] Skipping generic section writing event');
          break;
        }
        
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

        // Only show one writing message (update existing instead of creating new)
        // Find existing section-progress message and update it
        setMessages(prev => {
          const existingIdx = prev.findIndex(m => m.type === 'section-progress');
          if (existingIdx >= 0) {
            // Update existing message
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              content: `✍️ Writing "${writingData.title}"...`,
              metadata: { sectionId: writingData.section_id }
            };
            return updated;
          } else {
            // Create new message
            return [...prev, {
              id: `msg_section_${Date.now()}`,
              type: 'section-progress' as const,
              content: `✍️ Writing "${writingData.title}"...`,
              timestamp: new Date(),
              metadata: { sectionId: writingData.section_id }
            }];
          }
        });
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
        break;

      // ============================================================
      // NAVIGATION EVENTS - Trigger UI actions
      // ============================================================

      case 'OPEN_DOCUMENT':
        /**
         * Backend requests to open a document node on the canvas.
         * This triggers the parent component to:
         * 1. Select the node
         * 2. Open the document panel
         */
        const openDocData = event.data as OpenDocumentEvent;
        console.log('📂 [Stream] Opening document:', openDocData.node_name, openDocData.node_id);
        
        // Show friendly message
        addMessage('assistant', `📂 Opening "${openDocData.node_name}"...`);
        
        // Trigger the callback to actually open the document
        onOpenDocument?.(openDocData.node_id, openDocData.node_name);
        break;

      case 'SELECT_SECTION':
        /**
         * Backend requests to navigate to a specific section.
         * This triggers the parent component to scroll/focus the section.
         */
        const selectData = event.data as SelectSectionEvent;
        console.log('📍 [Stream] Selecting section:', selectData.section_name, selectData.section_id);
        
        // Show friendly message
        addMessage('assistant', `📍 Navigating to "${selectData.section_name}"...`);
        
        // Trigger the callback to actually select the section
        onSelectSection?.(selectData.section_id, selectData.section_name);
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/590edda1-d2cc-4e7e-b43e-dfdf13ca907f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOrchestratorStream.ts:580',message:'DONE event received',data:{hasAssistantMsg:!!assistantMessageIdRef.current,eventDataKeys:Object.keys(event.data || {}),rawFinalResponse:(event.data as { final_response?: string })?.final_response?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        // Finalize streaming assistant message if exists
        if (assistantMessageIdRef.current) {
          // Use final_response from server if available (more reliable than accumulated content)
          const doneData = event.data as { final_response?: string };
          const serverFinalResponse = doneData.final_response || '';
          const finalContent = serverFinalResponse || accumulatedContentRef.current;
          const msgId = assistantMessageIdRef.current;
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/590edda1-d2cc-4e7e-b43e-dfdf13ca907f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOrchestratorStream.ts:583',message:'DONE - setting final content',data:{finalContentLength:finalContent.length,serverResponseLength:serverFinalResponse.length,accumulatedLength:accumulatedContentRef.current.length,msgId:msgId},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
          
          setMessages(prev => prev.map(msg =>
            msg.id === msgId
              ? { ...msg, content: finalContent, metadata: { isStreaming: false } }
              : msg
          ));
          assistantMessageIdRef.current = null;
          accumulatedContentRef.current = '';
        }
        
        setProgress(prev => ({
          ...prev,
          stage: 'complete',
          percentComplete: 100,
        }));
        
        // Only add "Structure ready!" if we actually created a structure
        if (progress.structure) {
          addMessage('assistant', '✅ Structure ready!');
        }
        
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
  }, [addMessage, updateMessage, progress.structure, onStructureComplete, onSectionComplete, onClarificationNeeded, onOpenDocument, onSelectSection, onError, onComplete]);

  // Start streaming
  const startStream = useCallback(async (request: {
    message: string;
    userId: string;
    sessionId?: string;
    storyId?: string;  // Canvas/project ID (same as canvasId in URL)
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
    assistantMessageIdRef.current = null;  // Reset assistant message ref for new stream
    accumulatedContentRef.current = '';    // Reset accumulated content for new stream

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
      story_id: request.storyId,  // Canvas/project ID for persistence and context
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
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/590edda1-d2cc-4e7e-b43e-dfdf13ca907f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOrchestratorStream.ts:705',message:'SSE event parsed',data:{eventType:currentEventType,dataKeys:Object.keys(data)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'I'})}).catch(()=>{});
              // #endregion
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