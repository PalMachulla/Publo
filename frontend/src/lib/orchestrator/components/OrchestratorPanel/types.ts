// src/lib/orchestrator/components/OrchestratorPanel/types.ts

/**
 * Types for OrchestratorPanel
 */

// ============================================================
// MESSAGE TYPES
// ============================================================

export type MessageType = 
  | 'user' 
  | 'thinking' 
  | 'decision' 
  | 'task' 
  | 'result' 
  | 'error' 
  | 'progress' 
  | 'warning'
  | 'options'

export interface MessageOption {
  id: string
  label?: string
  title?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface Message {
  id: string
  role: 'user' | 'orchestrator' | 'system'
  content: string
  type: MessageType
  timestamp: string
  options?: MessageOption[]
}

// ============================================================
// ACTION TYPES
// ============================================================

export interface ActionPayload {
  sectionId?: string
  sectionName?: string
  prompt?: string
  content?: string
  format?: string
  nodeId?: string
  node_id?: string
  nodeName?: string
  template?: string
  [key: string]: unknown
}

export interface Action {
  type: string
  payload: ActionPayload
  requiresUserInput?: boolean
  priority?: 'high' | 'normal' | 'low'
  status?: 'pending' | 'completed' | 'failed'
}

// ============================================================
// RESPONSE TYPES
// ============================================================

export interface OrchestrateResponseMessage {
  role: string
  content: string
  type: string
  options?: MessageOption[]
}

export interface OrchestrateResponseResult {
  sectionId: string
  content: string | Record<string, unknown>  // Can be string or structure object
  wordCount?: number
}

export interface OrchestrateResponse {
  success: boolean
  intent?: string
  confidence?: number
  reasoning?: string
  strategy?: string
  actions: Action[]
  messages: OrchestrateResponseMessage[]
  results: OrchestrateResponseResult[]
  
  // Clarification state
  needsClarification?: boolean
  clarificationOptions?: MessageOption[]
  clarificationMessage?: string
  originalAction?: string
  
  // Metadata
  iterationsUsed?: number
  criticApproved?: boolean
  error?: string
}

// ============================================================
// CONTENT RESULT TYPES (for useOrchestratorActions)
// ============================================================

export interface ContentResult {
  sectionId: string
  content: string | Record<string, unknown>  // Allow both string and object
  wordCount?: number
}

// ============================================================
// STORY STRUCTURE TYPES
// ============================================================

export interface StoryStructureItem {
  id: string
  name: string
  level: number
  summary?: string
  wordCount?: number
  children?: StoryStructureItem[]
}

export interface CreateStoryNodeData {
  format: string
  label: string
  items: StoryStructureItem[]
  logline?: string
  template?: string
  isGenerating?: boolean
  nodeId?: string  // Backend-generated node ID for content storage alignment
}

// ============================================================
// PANEL PROPS
// ============================================================

export interface ActiveSegment {
  id: string
  name: string
  level?: number
  hasContent?: boolean
}

export interface CanvasNode {
  id: string
  type: string
  data: Record<string, unknown>
  position?: { x: number; y: number }
}

export interface OrchestratorPanelProps {
  // User
  userId?: string
  
  // Story/Canvas context
  storyId?: string  // Story ID for scoping chat history
  
  // Document context
  activeSegment?: ActiveSegment
  documentPanelOpen?: boolean
  documentFormat?: string
  
  // Canvas context
  canvasContext?: string
  structureItems?: Array<{ id: string; name: string; level: number }>
  canvasNodes?: CanvasNode[]
  storyStructureNodeId?: string
  orchestratorNodeId?: string  // ID of orchestrator node for edge creation
  
  // Callbacks - content
  onContentGenerated?: (sectionId: string, content: string) => void
  onExecuteAction?: (action: Action) => void
  onStructureUpdate?: (structure: Record<string, unknown>) => void
  
  // Callback to create story node on canvas
  onCreateStoryNode?: (data: CreateStoryNodeData) => string | void  // Changed from void to string | void
  
  // Callbacks - navigation
  onToggleDocumentPanel?: (open: boolean) => void
  onNavigateToSection?: (sectionId: string) => void
  onOpenDocument?: (nodeId: string) => void
  onDeleteNode?: (nodeId: string) => void
  
  // Styling
  className?: string
}