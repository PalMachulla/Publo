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
  StructureUpdatedEvent,
  SectionWritingEvent,
  SectionCompleteEvent,
  MessageEvent,
  ClarificationEvent,
  IntentEvent,
  PlanEvent,
  StrategyEvent,
  OpenDocumentEvent,
  SelectSectionEvent,
  CharacterCreatedEvent,
  // Deep Agent events
  TokenEvent,
  ToolStartEvent,
  ToolEndEvent,
  ContentChunkEvent,
  ContentCompleteEvent,
  NavigateEvent,
  PresentOptionsEvent,
  PlanUpdateEvent,
  SubagentStartEvent,
  SubagentEndEvent,
  MemoryUpdateEvent,
} from '@/types/orchestrator-streaming-types';

// Todo item for Deep Agent planning
export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  updated_at?: string;
}

// Subagent activity for Deep Agent subagent spawning
export interface SubagentActivity {
  id: string;
  name: 'critic' | 'researcher' | 'unknown';
  task: string;
  status: 'working' | 'complete' | 'error';
  result?: unknown;
  startTime: Date;
  endTime?: Date;
}

// Chat message for display
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'progress' | 'structure' | 'section-progress' | 'error' | 'thinking' | 'reasoning';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Streaming content for a section (accumulated chunks)
export interface StreamingContent {
  sectionId: string;
  content: string;
  isComplete: boolean;
}

interface UseOrchestratorStreamOptions {
  onStructureComplete?: (structure: StructureCreatedEvent) => void;
  onStructureUpdated?: (structure: StructureUpdatedEvent) => void;
  onCharacterComplete?: (character: CharacterCreatedEvent) => void;  // Character created/loaded
  onSectionComplete?: (sectionId: string, content: string) => void;
  onClarificationNeeded?: (clarification: ClarificationEvent) => void;
  onOpenDocument?: (nodeId: string, nodeName: string) => void;  // Navigation: open document
  onSelectSection?: (sectionId: string, sectionName: string) => void;  // Navigation: select section
  onContentChunk?: (sectionId: string, chunk: string, accumulated: string) => void;  // Streaming content chunk
  onContentComplete?: (sectionId: string, wordCount: number) => void;  // Content written - trigger refresh
  onPlanUpdate?: (todos: TodoItem[]) => void;  // Deep Agent planning - todo updates
  onSubagentStart?: (name: string, task: string) => void;  // Subagent spawned
  onSubagentEnd?: (name: string, result: unknown) => void;  // Subagent completed
  onMemoryUpdate?: (type: string, key: string, value: string) => void;  // Memory learned/updated
  onError?: (error: string) => void;
  onComplete?: () => void;
  streamUrl?: string;
  initialMessages?: ChatMessage[];  // Load persisted messages on mount
  onMessageAdded?: (message: ChatMessage) => void;  // Callback to persist dialogue messages
}

export function useOrchestratorStream(options: UseOrchestratorStreamOptions = {}) {
  const {
    onStructureComplete,
    onStructureUpdated,
    onCharacterComplete,
    onSectionComplete,
    onClarificationNeeded,
    onOpenDocument,
    onSelectSection,
    onContentChunk,
    onContentComplete,
    onPlanUpdate,
    onSubagentStart,
    onSubagentEnd,
    onMemoryUpdate,
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
  // Todos are ephemeral - cleared on refresh
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [subagentActivities, setSubagentActivities] = useState<SubagentActivity[]>([]);
  const [memoryUpdates, setMemoryUpdates] = useState<Array<{type: string; key: string; value: string}>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Streaming content state - tracks content being written in real-time
  const [streamingContent, setStreamingContent] = useState<Record<string, StreamingContent>>({});
  // Accumulate content in a ref so callbacks can run outside React state updaters
  // (prevents setState-during-render warnings when parent updates canvas state).
  const streamingContentAccumRef = useRef<Record<string, string>>({});
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdCounter = useRef(0);
  const clarificationSentRef = useRef(false);  // Dedupe clarifications
  
  // Track streaming reasoning message (for token-by-token updates)
  const reasoningMessageIdRef = useRef<string | null>(null);
  
  // Track tool thinking message (for updating on completion)
  const toolThinkingMessageIdRef = useRef<string | null>(null);
  
  // Track initial progress message (for updating to "Done!" on completion)
  const progressMessageIdRef = useRef<string | null>(null);
  
  // Track simulated thinking indicator (shows time before first token)
  const thinkingIndicatorIdRef = useRef<string | null>(null);
  const thinkingStartTimeRef = useRef<Date | null>(null);
  
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

  // Add a message to the chat (returns the message ID for tracking)
  const addMessage = useCallback((
    type: ChatMessage['type'],
    content: string,
    metadata?: Record<string, unknown>
  ): string => {
    const id = generateId();
    const message: ChatMessage = {
      id,
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
    
    return id;
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
          
          // Mark thinking indicator as complete (first token received)
          if (thinkingIndicatorIdRef.current) {
            updateMessage(thinkingIndicatorIdRef.current, {
              metadata: {
                isStreaming: false,
                endTime: new Date().toISOString()
              }
            });
            thinkingIndicatorIdRef.current = null;
          }
        }
        // Don't update state on every token - wait for DONE
        break;
      
      case 'TOOL_START':
        /**
         * Tool execution starting
         */
        const toolStartData = event.data as ToolStartEvent;
        console.log('🔧 [Tool Start]', toolStartData.tool);
        
        // CRITICAL: Flush accumulated content before tool starts
        // This prevents the assistant message from being cut off mid-sentence
        if (assistantMessageIdRef.current && accumulatedContentRef.current) {
          const msgId = assistantMessageIdRef.current;
          const flushedContent = accumulatedContentRef.current;
          setMessages(prev => prev.map(msg =>
            msg.id === msgId
              ? { ...msg, content: flushedContent, metadata: { isStreaming: false } }
              : msg
          ));
          // Don't clear refs yet - DONE will finalize
        }
        
        // Mark thinking indicator as complete (tool starting means thinking is done)
        if (thinkingIndicatorIdRef.current) {
          updateMessage(thinkingIndicatorIdRef.current, {
            metadata: {
              isStreaming: false,
              endTime: new Date().toISOString()
            }
          });
          thinkingIndicatorIdRef.current = null;
        }
        
        // Show thinking indicator for long-running tools
        if (['write_section', 'create_structure'].includes(toolStartData.tool)) {
          const thinkingContent = toolStartData.tool === 'write_section' 
            ? 'Writing content...' 
            : 'Creating structure...';
          const msgId = addMessage('thinking', `${thinkingContent}`, { 
            tool: toolStartData.tool,
            isComplete: false 
          });
          toolThinkingMessageIdRef.current = msgId;
        }
        break;
      
      case 'TOOL_END':
        /**
         * Tool execution complete
         */
        const toolEndData = event.data as ToolEndEvent;
        console.log('✅ [Tool End]', toolEndData.tool);
        
        // Update the thinking message to show completion
        if (toolThinkingMessageIdRef.current && ['write_section', 'create_structure'].includes(toolEndData.tool)) {
          const completionContent = toolEndData.tool === 'write_section'
            ? 'Content written'
            : 'Structure created';
          updateMessage(toolThinkingMessageIdRef.current, {
            content: completionContent,
            metadata: { tool: toolEndData.tool, isComplete: true }
          });
          toolThinkingMessageIdRef.current = null;
        }
        break;
      
      case 'CONTENT_CHUNK':
        /**
         * Streaming content chunk from write_section
         * Accumulate chunks and notify parent for real-time display
         */
        const chunkData = event.data as ContentChunkEvent;
        console.log('📝 [CONTENT_CHUNK] Received:', {
          sectionId: chunkData.section_id,
          chunkLength: chunkData.chunk?.length,
          chunk: chunkData.chunk?.substring(0, 50)
        });
        
        // Accumulate content in a ref (stable + synchronous), then update React state.
        const prevContent = streamingContentAccumRef.current[chunkData.section_id] || '';
        const newContent = prevContent + chunkData.chunk;
        streamingContentAccumRef.current[chunkData.section_id] = newContent;

        console.log('📝 [CONTENT_CHUNK] Accumulated:', {
          sectionId: chunkData.section_id,
          totalLength: newContent.length
        });

        setStreamingContent(prev => ({
          ...prev,
          [chunkData.section_id]: {
            sectionId: chunkData.section_id,
            content: newContent,
            isComplete: false,
          }
        }));

        // Defer callback to avoid updating parent state during a React render flush.
        if (onContentChunk) {
          setTimeout(() => onContentChunk(chunkData.section_id, chunkData.chunk, newContent), 0);
        }
        break;
      
      case 'CONTENT_COMPLETE':
        /**
         * Section writing complete - TRIGGER DOCUMENT REFRESH
         */
        const contentCompleteData = event.data as ContentCompleteEvent;
        console.log('✅ [Content Complete]', contentCompleteData.section_id, contentCompleteData.word_count, 'words');
        
        // Mark streaming content as complete
        setStreamingContent(prev => {
          const existing = prev[contentCompleteData.section_id];
          if (existing) {
            return {
              ...prev,
              [contentCompleteData.section_id]: {
                ...existing,
                isComplete: true,
              }
            };
          }
          return prev;
        });

        // Keep the accumulator ref in sync (optional cleanup)
        delete streamingContentAccumRef.current[contentCompleteData.section_id];
        
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
        
        // Notify parent to refresh document from DB
        onContentComplete?.(contentCompleteData.section_id, contentCompleteData.word_count);
        break;
      
      case 'NAVIGATE':
        /**
         * Navigate to a section (Deep Agent version)
         */
        const navigateData = event.data as NavigateEvent;
        console.log('📍 [Navigate]', navigateData.section_name || navigateData.section_id);
        
        addMessage('assistant', `Navigating to "${navigateData.section_name || navigateData.section_id}"...`);
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
      
      case 'PLAN_UPDATE':
        /**
         * Deep Agent planning - todo list updates
         */
        const planUpdateData = event.data as PlanUpdateEvent;
        console.log('📋 [Plan Update]', planUpdateData.todos.length, 'todos,', planUpdateData.stats.percent_complete + '% complete');
        
        // Update todos state
        setTodos(planUpdateData.todos);
        
        // Notify parent component
        onPlanUpdate?.(planUpdateData.todos);
        break;
      
      case 'SUBAGENT_START':
        /**
         * Subagent spawned - add to activities
         */
        const subagentStartData = event.data as SubagentStartEvent;
        console.log('🤖 [Subagent Start]', subagentStartData.name, '-', subagentStartData.task);
        
        const newActivity: SubagentActivity = {
          id: `subagent-${Date.now()}`,
          name: (subagentStartData.name as SubagentActivity['name']) || 'unknown',
          task: subagentStartData.task,
          status: 'working',
          startTime: new Date()
        };
        
        setSubagentActivities(prev => [...prev, newActivity]);
        onSubagentStart?.(subagentStartData.name, subagentStartData.task);
        break;
      
      case 'SUBAGENT_END':
        /**
         * Subagent completed - update activity status
         */
        const subagentEndData = event.data as SubagentEndEvent;
        console.log('✅ [Subagent End]', subagentEndData.name);
        
        setSubagentActivities(prev => {
          // Find the most recent working activity with this name
          const index = prev.findIndex(a => a.name === subagentEndData.name && a.status === 'working');
          if (index === -1) return prev;
          
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: 'complete',
            result: subagentEndData.result,
            endTime: new Date()
          };
          return updated;
        });
        onSubagentEnd?.(subagentEndData.name, subagentEndData.result);
        break;
      
      case 'MEMORY_UPDATE':
        /**
         * Memory learned/updated
         */
        const memoryData = event.data as MemoryUpdateEvent;
        console.log('🧠 [Memory Update]', memoryData.type, '-', memoryData.key);
        
        setMemoryUpdates(prev => [...prev, {
          type: memoryData.type,
          key: memoryData.key,
          value: memoryData.value
        }]);
        onMemoryUpdate?.(memoryData.type, memoryData.key, memoryData.value);
        break;
      
      // ============================================================
      // LEGACY EVENTS (Backwards Compatibility)
      // ============================================================
      
      case 'REASONING_TOKEN':
        /**
         * Token-by-token reasoning streaming
         * 
         * Stream reasoning tokens to UI in a collapsible ThinkingBlock.
         * If we have a simulated thinking indicator, reuse it. Otherwise create new.
         */
        const token = (event.data as { token: string }).token || '';
        const isComplete = (event.data as { is_complete?: boolean }).is_complete || false;
        
        // If we have a simulated thinking indicator, reuse it for real reasoning
        if (thinkingIndicatorIdRef.current && !reasoningMessageIdRef.current) {
          reasoningMessageIdRef.current = thinkingIndicatorIdRef.current;
          thinkingIndicatorIdRef.current = null;  // Hand off to reasoning ref
        }
        
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
          // Update existing message with accumulated content
          updateMessage(reasoningMessageIdRef.current, {
            content: token,  // Backend sends accumulated content
            metadata: { 
              isStreaming: !isComplete,
              ...(isComplete ? { endTime: new Date().toISOString() } : {})
            }
          });
        }
        
        // If complete, clear the ref
        if (isComplete) {
          reasoningMessageIdRef.current = null;
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

        // Callback (defer to avoid setState-during-render warnings when parent updates canvas state)
        if (onStructureComplete) {
          setTimeout(() => onStructureComplete(structureData), 0);
        }
        break;

      case 'STRUCTURE_UPDATED':
        const updatedStructureData = event.data as StructureUpdatedEvent;
        
        // Add message showing what changed
        const changes = updatedStructureData.changes_made || {};
        const addedCount = changes.added?.length || 0;
        const removedCount = changes.removed?.length || 0;
        const modifiedCount = changes.modified?.length || 0;
        
        let changesSummary = `📝 Updated "${updatedStructureData.title}"`;
        if (addedCount > 0) changesSummary += ` (+${addedCount} new)`;
        if (removedCount > 0) changesSummary += ` (-${removedCount} removed)`;
        if (modifiedCount > 0) changesSummary += ` (~${modifiedCount} modified)`;
        
        addMessage('structure', changesSummary, { structure: updatedStructureData });
        
        // Show sections needing revision
        const needsRevision = updatedStructureData.sections_needing_revision || [];
        if (needsRevision.length > 0) {
          const revisionList = needsRevision
            .map(s => `• **${s.name}**: ${s.reason}`)
            .join('\n');
          addMessage('assistant', `**Sections that may need revision:**\n${revisionList}`);
        }
        
        // Show storyline impact
        if (updatedStructureData.storyline_impact) {
          addMessage('assistant', `**Impact:** ${updatedStructureData.storyline_impact}`);
        }
        
        // Callback to refresh canvas
        onStructureUpdated?.(updatedStructureData);
        break;

      case 'CHARACTER_CREATED':
        const characterData = event.data as CharacterCreatedEvent;
        console.log('🎭 [Stream] CHARACTER_CREATED received:', characterData);
        
        // Add visual message
        const charAction = characterData.is_existing ? 'Added' : 'Created';
        addMessage(
          'assistant',
          `🎭 ${charAction} character **${characterData.name}** (${characterData.role || 'Active'})`
        );
        
        // Callback to create node on canvas
        console.log('🎭 [Stream] onCharacterComplete callback exists:', !!onCharacterComplete);
        if (onCharacterComplete) {
          console.log('🎭 [Stream] Calling onCharacterComplete with:', characterData.name, characterData.node_id);
          setTimeout(() => onCharacterComplete(characterData), 0);
        }
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

        // Update the existing thinking message with section-specific content
        // This consolidates "Writing content..." + "Writing 'Section'" into one message
        if (toolThinkingMessageIdRef.current) {
          updateMessage(toolThinkingMessageIdRef.current, {
            type: 'section-progress',
            content: `Writing "${writingData.title}"...`,
            metadata: { sectionId: writingData.section_id, isComplete: false }
          });
        }
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
         * NOTE: No message shown - would be too noisy during writing
         */
        const openDocData = event.data as OpenDocumentEvent;
        console.log('📂 [Stream] Opening document:', openDocData.node_name, openDocData.node_id);
        
        // Trigger the callback to actually open the document (no message - too noisy)
        // Defer to avoid setState-during-render if this arrives during a render flush.
        if (onOpenDocument) {
          setTimeout(() => onOpenDocument(openDocData.node_id, openDocData.node_name), 0);
        }
        break;

      case 'SELECT_SECTION':
        /**
         * Backend requests to navigate to a specific section.
         * This triggers the parent component to scroll/focus the section.
         * NOTE: Do NOT stop streaming here - writing continues after navigation!
         */
        const selectData = event.data as SelectSectionEvent;
        console.log('📍 [Stream] Selecting section:', selectData.section_name, selectData.section_id);
        
        // Trigger the callback to actually select the section (no message - too noisy)
        if (onSelectSection) {
          setTimeout(() => onSelectSection(selectData.section_id, selectData.section_name), 0);
        }
        // Do NOT setIsStreaming(false) - writing is in progress!
        break;

      case 'CRITIC':
        if (!event.data.approved) {
          addMessage('thinking', '🔄 Revising based on feedback...');
        }
        break;

      case 'DONE':
        // Mark thinking indicator as complete if still active
        if (thinkingIndicatorIdRef.current) {
          updateMessage(thinkingIndicatorIdRef.current, {
            metadata: {
              isStreaming: false,
              endTime: new Date().toISOString()
            }
          });
          thinkingIndicatorIdRef.current = null;
        }
        
        // Finalize streaming assistant message if exists
        if (assistantMessageIdRef.current) {
          // Use final_response from server if available (more reliable than accumulated content)
          const doneData = event.data as { final_response?: string };
          const serverFinalResponse = doneData.final_response || '';
          const finalContent = serverFinalResponse || accumulatedContentRef.current;
          const msgId = assistantMessageIdRef.current;
          
          setMessages(prev => prev.map(msg =>
            msg.id === msgId
              ? { ...msg, content: finalContent, metadata: { isStreaming: false } }
              : msg
          ));
          
          // Persist the finalized streaming message to database
          if (onMessageAdded && finalContent.trim()) {
            const finalMessage: ChatMessage = {
              id: msgId,
              type: 'assistant',
              content: finalContent,
              timestamp: new Date(),
              metadata: { isStreaming: false }
            };
            onMessageAdded(finalMessage);
          }
          
          assistantMessageIdRef.current = null;
          accumulatedContentRef.current = '';
        }
        
        setProgress(prev => ({
          ...prev,
          stage: 'complete',
          percentComplete: 100,
        }));
        
        // Update initial progress message to show completion
        if (progressMessageIdRef.current) {
          updateMessage(progressMessageIdRef.current, {
            type: 'thinking',  // Reuse thinking type which shows checkmark when complete
            content: 'Done!',
            metadata: { isComplete: true }
          });
          progressMessageIdRef.current = null;
        }
        
        onComplete?.();
        break;

      case 'ERROR':
        // Mark thinking indicator as complete on error
        if (thinkingIndicatorIdRef.current) {
          updateMessage(thinkingIndicatorIdRef.current, {
            metadata: {
              isStreaming: false,
              endTime: new Date().toISOString()
            }
          });
          thinkingIndicatorIdRef.current = null;
        }
        
        setProgress(prev => ({
          ...prev,
          stage: 'error',
          error: event.data.error,
        }));
        
        // Clear the progress message on error (error message will show instead)
        if (progressMessageIdRef.current) {
          updateMessage(progressMessageIdRef.current, {
            type: 'error',
            content: event.data.error,
          });
          progressMessageIdRef.current = null;
        } else {
          addMessage('error', event.data.error);
        }
        
        onError?.(event.data.error);
        break;
    }
  }, [addMessage, updateMessage, progress.structure, onStructureComplete, onStructureUpdated, onCharacterComplete, onSectionComplete, onClarificationNeeded, onOpenDocument, onSelectSection, onError, onComplete]);

  // Start streaming
  const startStream = useCallback(async (request: {
    message: string;
    userId: string;
    sessionId?: string;
    storyId?: string;  // Canvas/project ID (same as canvasId in URL)
    orchestratorNodeId?: string;  // Orchestrator node ID (for connection-based context)
    storyStructureNodeId?: string;  // Active structure node ID for Librarian context
    documentFormat?: string;
    activeSegment?: unknown;
    documentPanelOpen?: boolean;
    canvasContext?: unknown;
    structureItems?: unknown[];
    canvasNodes?: unknown[];
    canvasEdges?: unknown[];
    conversationHistory?: unknown[];
    clarificationResponse?: string;
    originalAction?: string;  // The action that needed clarification (e.g., 'create_structure')
    activeSectionCard?: unknown;  // Section card currently being viewed (for Librarian context)
    [key: string]: unknown;
  }) => {
    // Abort any existing stream
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    clarificationSentRef.current = false;  // Reset for new stream
    reasoningMessageIdRef.current = null;  // Reset reasoning message ref for new stream
    assistantMessageIdRef.current = null;  // Reset assistant message ref for new stream
    accumulatedContentRef.current = '';    // Reset accumulated content for new stream
    thinkingIndicatorIdRef.current = null; // Reset thinking indicator for new stream

    // Reset state
    setIsStreaming(true);
    setProgress({
      isActive: true,
      stage: 'planning',
      percentComplete: 0,
    });
    streamingContentAccumRef.current = {};

    // Add user message
    addMessage('user', request.message);
    
    // Add initial progress message first (shows above thinking)
    progressMessageIdRef.current = addMessage('progress', 'Working on that...');
    
    // Create thinking indicator (shows below progress)
    const thinkingStartTime = new Date();
    thinkingStartTimeRef.current = thinkingStartTime;
    const thinkingId = generateId();
    thinkingIndicatorIdRef.current = thinkingId;
    
    const thinkingMessage: ChatMessage = {
      id: thinkingId,
      type: 'reasoning',
      content: '',  // Empty content - just shows "Thinking..."
      timestamp: thinkingStartTime,
      metadata: {
        startTime: thinkingStartTime.toISOString(),
        isStreaming: true
      }
    };
    setMessages(prev => [...prev, thinkingMessage]);

    // Build conversation history from internal messages state
    // Filter for user and assistant messages, convert to backend format
    const builtConversationHistory = messages
      .filter(msg => msg.type === 'user' || msg.type === 'assistant')
      .map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
    
    // Use built history if no explicit history was passed
    const conversationHistory = request.conversationHistory || builtConversationHistory;
    
    console.log('📜 [Stream] Conversation history:', {
      builtCount: builtConversationHistory.length,
      passedCount: Array.isArray(request.conversationHistory) ? request.conversationHistory.length : undefined,
      usingBuilt: !Array.isArray(request.conversationHistory),
      lastMessages: Array.isArray(conversationHistory)
        ? conversationHistory.slice(-3).map(m => {
            // Null safety for unknown array element type
            if (
              typeof m === 'object' &&
              m !== null &&
              'role' in m &&
              'content' in m &&
              typeof (m as { role: unknown }).role === 'string' &&
              typeof (m as { content: unknown }).content === 'string'
            ) {
              return {
                role: (m as { role: string }).role,
                preview: (m as { content: string }).content.slice(0, 50),
              }
            } else {
              return { role: 'unknown', preview: '[Invalid message]' }
            }
          })
        : [],
    });

    // Debug canvas snapshot being sent (helps verify character nodes are present)
    try {
      const nodes = Array.isArray(request.canvasNodes) ? request.canvasNodes : []
      const edges = Array.isArray(request.canvasEdges) ? request.canvasEdges : []
      const characterNodes = nodes.filter((n: any) => {
        const nodeType = n?.data?.nodeType
        return nodeType === 'character'
      })
      console.log('🧩 [Stream] Canvas snapshot:', {
        orchestratorNodeId: request.orchestratorNodeId,
        nodes: nodes.length,
        edges: edges.length,
        characterNodes: characterNodes.length,
        sampleCharacters: characterNodes.slice(0, 5).map((n: any) => ({
          id: n?.id,
          label: n?.data?.label,
          characterId: n?.data?.characterId,
          role: n?.data?.role,
          hasBio: !!n?.data?.bio,
        })),
      })
    } catch (e) {
      console.warn('🧩 [Stream] Canvas snapshot debug failed:', e)
    }

    // Convert camelCase to snake_case for Python backend
    const snakeCaseRequest = {
      message: request.message,
      user_id: request.userId,
      session_id: request.sessionId,
      story_id: request.storyId,  // Canvas/project ID for persistence and context
      orchestrator_node_id: request.orchestratorNodeId,
      story_structure_node_id: request.storyStructureNodeId,  // Active structure node ID
      document_format: request.documentFormat,
      active_segment: request.activeSegment,
      document_panel_open: request.documentPanelOpen,
      canvas_context: request.canvasContext,
      structure_items: request.structureItems,
      canvas_nodes: request.canvasNodes,
      canvas_edges: request.canvasEdges,
      conversation_history: conversationHistory,
      clarification_response: request.clarificationResponse,
      original_action: request.originalAction,
      active_section_card: request.activeSectionCard,  // Section card currently being viewed
      extended_thinking: request.extendedThinking,  // Enable Claude's chain-of-thought reasoning
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
    thinkingIndicatorIdRef.current = null; // Reset thinking indicator ref
  }, [messages.length]);

  // Clear streaming content for a section (after it's been saved to DB)
  const clearStreamingContent = useCallback((sectionId: string) => {
    setStreamingContent(prev => {
      const { [sectionId]: _, ...rest } = prev;
      return rest;
    });
    delete streamingContentAccumRef.current[sectionId];
  }, []);

  return {
    messages,
    progress,
    todos,
    subagentActivities,
    memoryUpdates,
    isStreaming,
    streamingContent,  // Real-time streaming content by section ID
    startStream,
    stopStream,
    clearMessages,
    clearStreamingContent,  // Clear after content is saved
    addMessage,
  };
}