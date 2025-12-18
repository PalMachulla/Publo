// ============================================================
// ORCHESTRATOR STREAMING EVENT TYPES
// ============================================================
// Enhanced event types for progressive UI feedback
// 
// Architecture: Deep Agent (new) vs Legacy Workflow
// - Deep Agent: TOKEN, TOOL_START, TOOL_END, CONTENT_CHUNK, etc.
// - Legacy: INTENT, STRATEGY, ACTION, RESULT, etc.
// 
// Both are supported for backwards compatibility.

export type OrchestratorEventType =
  // ============================================
  // Deep Agent Events (New Architecture)
  // ============================================
  | 'TOKEN'            // Streaming text token from LLM
  | 'TOOL_START'       // Tool execution beginning
  | 'TOOL_END'         // Tool execution complete
  | 'CONTENT_CHUNK'    // Streaming content from write_section
  | 'CONTENT_COMPLETE' // Section writing finished
  | 'NAVIGATE'         // Navigate frontend to section
  | 'PRESENT_OPTIONS'  // Show option selector UI
  | 'PLAN_UPDATE'      // Todo list updated (for complex tasks)
  | 'SUBAGENT_START'   // Subagent spawned
  | 'SUBAGENT_END'     // Subagent completed
  
  // ============================================
  // Legacy Events (Backwards Compatibility)
  // ============================================
  | 'INTENT'
  | 'PLAN'             // Planner created a task plan
  | 'STRATEGY'
  | 'MESSAGE'
  | 'ACTION'
  | 'RESULT'
  | 'CLARIFICATION'
  | 'CRITIC'
  | 'STRUCTURE_CREATED'
  | 'STRUCTURE_UPDATED'
  | 'CHARACTER_CREATED'
  | 'SECTION_WRITING'
  | 'SECTION_COMPLETE'
  | 'PROGRESS'
  | 'REASONING_TOKEN'  // Token-by-token reasoning streaming (like Claude.ai)
  | 'OPEN_DOCUMENT'    // Navigation: Open a document node
  | 'SELECT_SECTION'   // Navigation: Navigate to a section
  | 'DONE'
  | 'ERROR';

// Intent analysis result
export interface IntentEvent {
  intent: string;
  confidence: number;
  reasoning?: string;
}

// Plan created by Deep Agent Planner
export interface PlanEvent {
  task: string;                    // What the user asked for
  intent: string;                  // Detected intent
  step_count: number;              // Number of steps in the plan
  steps: PlanStep[];               // The actual steps
}

export interface PlanStep {
  id: string;
  description: string;
  action_type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
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
  node_id?: string;  // Backend-generated node ID for content storage
}

// Emitted when an existing structure is modified
export interface StructureUpdatedEvent {
  title: string;
  section_count: number;
  sections: Array<{
    id: string;
    title: string;
    type?: string;
  }>;
  format?: string;
  node_id: string;
  changes_made: {
    added?: string[];
    removed?: string[];
    modified?: string[];
  };
  sections_needing_revision: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
  storyline_impact?: string;
}

// ============================================================
// CHARACTER EVENTS
// ============================================================

// Emitted when a character is created or loaded onto the canvas
export interface CharacterCreatedEvent {
  character_id: string;
  node_id: string;
  name: string;
  bio?: string;
  role?: 'Main' | 'Active' | 'Included' | 'Involved' | 'Passive';
  photo_url?: string | null;
  visibility?: 'private' | 'shared' | 'public';
  attributes?: Record<string, unknown>;
  profilerChat?: Array<{
    question: string;
    answer: string;
  }>;
  is_existing?: boolean; // True if loaded from DB, false if newly created
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

// ============================================================
// NAVIGATION EVENTS
// ============================================================

// Emitted when user requests to open a document node
export interface OpenDocumentEvent {
  node_id: string;
  node_name: string;
}

// Emitted when user requests to navigate to a section
export interface SelectSectionEvent {
  section_id: string;
  section_name: string;
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
  final_response?: string;
}

// Error
export interface ErrorEvent {
  error: string;
}

// ============================================================
// NEW: Deep Agent Events
// ============================================================

// Streaming token from LLM
export interface TokenEvent {
  content: string;
}

// Tool execution starting
export interface ToolStartEvent {
  tool: string;
  input?: Record<string, unknown>;
}

// Tool execution complete
export interface ToolEndEvent {
  tool: string;
  output?: unknown;
}

// Content chunk from write_section
export interface ContentChunkEvent {
  section_id: string;
  chunk: string;
}

// Section content complete
export interface ContentCompleteEvent {
  section_id: string;
  word_count: number;
  preview?: string;  // Optional preview of the content
}

// Navigation event
export interface NavigateEvent {
  section_id: string;
  section_name?: string;
}

// Present options to user
export interface PresentOptionsEvent {
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  allow_multiple?: boolean;
}

// Subagent spawned
export interface SubagentStartEvent {
  name: string;
  task: string;
}

// Subagent completed
export interface SubagentEndEvent {
  name: string;
  result?: unknown;
}

// Plan update (Deep Agent todos)
export interface PlanUpdateEvent {
  todos: Array<{
    id: string;
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    updated_at?: string;
  }>;
  stats: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    cancelled: number;
    percent_complete: number;
  };
}

// Memory update (Deep Agent learning)
export interface MemoryUpdateEvent {
  type: 'preference' | 'pattern';
  key: string;
  value: string;
}

// ============================================================
// Union type for all events
// ============================================================

export type OrchestratorEvent =
  // Deep Agent events
  | { type: 'TOKEN'; data: TokenEvent }
  | { type: 'TOOL_START'; data: ToolStartEvent }
  | { type: 'TOOL_END'; data: ToolEndEvent }
  | { type: 'CONTENT_CHUNK'; data: ContentChunkEvent }
  | { type: 'CONTENT_COMPLETE'; data: ContentCompleteEvent }
  | { type: 'NAVIGATE'; data: NavigateEvent }
  | { type: 'PRESENT_OPTIONS'; data: PresentOptionsEvent }
  | { type: 'PLAN_UPDATE'; data: PlanUpdateEvent }
  | { type: 'MEMORY_UPDATE'; data: MemoryUpdateEvent }
  | { type: 'SUBAGENT_START'; data: SubagentStartEvent }
  | { type: 'SUBAGENT_END'; data: SubagentEndEvent }
  
  // Legacy events (backwards compatibility)
  | { type: 'INTENT'; data: IntentEvent }
  | { type: 'PLAN'; data: PlanEvent }
  | { type: 'STRATEGY'; data: StrategyEvent }
  | { type: 'MESSAGE'; data: MessageEvent }
  | { type: 'ACTION'; data: ActionEvent }
  | { type: 'RESULT'; data: ResultEvent }
  | { type: 'CLARIFICATION'; data: ClarificationEvent }
  | { type: 'CRITIC'; data: CriticEvent }
  | { type: 'STRUCTURE_CREATED'; data: StructureCreatedEvent }
  | { type: 'STRUCTURE_UPDATED'; data: StructureUpdatedEvent }
  | { type: 'CHARACTER_CREATED'; data: CharacterCreatedEvent }
  | { type: 'SECTION_WRITING'; data: SectionWritingEvent }
  | { type: 'SECTION_COMPLETE'; data: SectionCompleteEvent }
  | { type: 'PROGRESS'; data: ProgressEvent }
  | { type: 'REASONING_TOKEN'; data: ReasoningTokenEvent }  // Token-by-token reasoning
  | { type: 'OPEN_DOCUMENT'; data: OpenDocumentEvent }      // Navigation: open document
  | { type: 'SELECT_SECTION'; data: SelectSectionEvent }    // Navigation: select section
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