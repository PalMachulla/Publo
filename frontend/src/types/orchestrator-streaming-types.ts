// ============================================================
// ORCHESTRATOR STREAMING EVENT TYPES
// ============================================================
// Enhanced event types for progressive UI feedback

export type OrchestratorEventType =
  | 'INTENT'
  | 'STRATEGY'
  | 'MESSAGE'
  | 'ACTION'
  | 'RESULT'
  | 'CLARIFICATION'
  | 'CRITIC'
  | 'STRUCTURE_CREATED'
  | 'SECTION_WRITING'
  | 'SECTION_COMPLETE'
  | 'PROGRESS'
  | 'REASONING_TOKEN'  // NEW: Token-by-token reasoning streaming (like Claude.ai)
  | 'DONE'
  | 'ERROR';

// Intent analysis result
export interface IntentEvent {
  intent: string;
  confidence: number;
  reasoning?: string;
}

// Strategy selection
export interface StrategyEvent {
  strategy: 'sequential' | 'parallel' | 'adaptive';
}

// Chat message
export interface MessageEvent {
  role: 'assistant' | 'orchestrator' | 'system';
  content: string;
  type?: 'thinking' | 'result' | 'progress' | 'info';
}

// Action to be executed
export interface ActionEvent {
  type: string;
  payload?: {
    sectionId?: string;
    title?: string;
    [key: string]: unknown;
  };
}

// Result (content generated)
export interface ResultEvent {
  section_id: string;
  content: string;
}

// Clarification needed
export interface ClarificationEvent {
  message?: string;
  options: string[];
  originalAction?: string;
}

// Critic feedback
export interface CriticEvent {
  approved: boolean;
  feedback?: string;
}

// ============================================================
// NEW: Reasoning Token Streaming (Token-by-Token)
// ============================================================
// Emitted as LLM generates reasoning tokens in real-time
// This provides Claude.ai/Cursor-like streaming experience
// where users see reasoning appear token-by-token

export interface ReasoningTokenEvent {
  /**
   * Accumulated reasoning text (all tokens received so far)
   * Frontend should update the message content with this value
   */
  token: string;
  
  /**
   * Whether this is the final token (reasoning complete)
   * When true, frontend can finalize the message
   */
  is_complete?: boolean;
}

// ============================================================
// NEW: Progressive Structure Events
// ============================================================

// Emitted when structure JSON is parsed
export interface StructureCreatedEvent {
  title: string;
  section_count: number;
  sections: Array<{
    id: string;
    title: string;
    type?: string;
  }>;
  format?: string;
}

// Emitted when starting to write a section
export interface SectionWritingEvent {
  section_id: string;
  title: string;
}

// Emitted when section content is complete
export interface SectionCompleteEvent {
  section_id: string;
  preview: string;
  word_count: number;
}

// Overall progress
export interface ProgressEvent {
  percent: number;
  stage: 'planning' | 'structuring' | 'writing' | 'reviewing' | 'complete';
  current_section?: string;
}

// Done
export interface DoneEvent {
  success: boolean;
}

// Error
export interface ErrorEvent {
  error: string;
}

// ============================================================
// Union type for all events
// ============================================================

export type OrchestratorEvent =
  | { type: 'INTENT'; data: IntentEvent }
  | { type: 'STRATEGY'; data: StrategyEvent }
  | { type: 'MESSAGE'; data: MessageEvent }
  | { type: 'ACTION'; data: ActionEvent }
  | { type: 'RESULT'; data: ResultEvent }
  | { type: 'CLARIFICATION'; data: ClarificationEvent }
  | { type: 'CRITIC'; data: CriticEvent }
  | { type: 'STRUCTURE_CREATED'; data: StructureCreatedEvent }
  | { type: 'SECTION_WRITING'; data: SectionWritingEvent }
  | { type: 'SECTION_COMPLETE'; data: SectionCompleteEvent }
  | { type: 'PROGRESS'; data: ProgressEvent }
  | { type: 'REASONING_TOKEN'; data: ReasoningTokenEvent }  // NEW: Token-by-token reasoning
  | { type: 'DONE'; data: DoneEvent }
  | { type: 'ERROR'; data: ErrorEvent };

// ============================================================
// State for tracking creation progress
// ============================================================

export interface CreationProgress {
  isActive: boolean;
  stage: 'idle' | 'planning' | 'structuring' | 'writing' | 'reviewing' | 'complete' | 'error';
  structure?: {
    title: string;
    sections: Array<{
      id: string;
      title: string;
      status: 'pending' | 'writing' | 'complete';
      preview?: string;
      wordCount?: number;
    }>;
  };
  percentComplete: number;
  currentSection?: string;
  error?: string;
}

export const initialCreationProgress: CreationProgress = {
  isActive: false,
  stage: 'idle',
  percentComplete: 0,
};