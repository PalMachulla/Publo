/**
 * Tool System Types
 * 
 * Defines the interfaces for executable tools that the orchestrator can invoke.
 * Replaces JSON action plans with direct tool execution.
 */

import type { WorldStateManager } from '../core/worldState'
import type { Blackboard } from '../core/blackboard'

// ============================================================
// CORE TOOL INTERFACES
// ============================================================

/**
 * Tool execution context - provides access to state and capabilities
 */
export interface ToolContext {
  /** Unified application state */
  worldState: WorldStateManager
  /** User ID for permissions and tracking */
  userId: string
  /** Optional user API key ID for external services */
  userKeyId?: string
  /** PHASE 3: Blackboard for agent coordination and message logging */
  blackboard: Blackboard
}

/**
 * Tool execution result
 */
export interface ToolResult<T = any> {
  /** Whether the tool executed successfully */
  success: boolean
  /** Result data (structure varies by tool) */
  data?: T
  /** Error message if failed */
  error?: string
  /** Side effects (state changes, API calls, etc.) */
  sideEffects?: ToolSideEffect[]
  /** Metadata about execution (duration, tokens used, etc.) */
  metadata?: Record<string, any>
}

/**
 * Side effects that tools can produce
 */
export interface ToolSideEffect {
  type: 'state_update' | 'api_call' | 'ui_update' | 'database_write' | 'file_write'
  description: string
  timestamp: number
  data?: any
}

/**
 * Tool parameter definition (for schema and validation)
 */
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: any
  validation?: {
    min?: number
    max?: number
    pattern?: RegExp
    enum?: any[]
  }
}

/**
 * Base Tool interface - all tools must implement this
 */
export interface Tool<TInput = any, TOutput = any> {
  /** Unique tool identifier (e.g., 'write_content', 'create_structure') */
  name: string
  
  /** Human-readable description for LLM */
  description: string
  
  /** Parameter schema (for validation and LLM function calling) */
  parameters: ToolParameter[]
  
  /** Category for organization */
  category: 'content' | 'structure' | 'navigation' | 'analysis' | 'system'
  
  /** Whether this tool requires user confirmation */
  requiresConfirmation: boolean
  
  /** Estimated execution time in ms (for UI feedback) */
  estimatedDuration?: number
  
  /**
   * Execute the tool with given input
   * @param input - Tool-specific input parameters
   * @param context - Execution context (state, user, etc.)
   * @returns Promise<ToolResult>
   */
  execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>
  
  /**
   * Validate input before execution (optional)
   * @param input - Tool-specific input parameters
   * @returns Validation errors or null if valid
   */
  validate?(input: TInput): string[] | null
  
  /**
   * Format tool for LLM function calling schema
   * @returns OpenAI-compatible function definition
   */
  toFunctionSchema(): {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required: string[]
    }
  }
}

// ============================================================
// TOOL REGISTRY
// ============================================================

/**
 * Tool Registry - manages all available tools
 */
export interface ToolRegistry {
  /** Register a new tool */
  register(tool: Tool): void
  
  /** Get a tool by name */
  get(name: string): Tool | undefined
  
  /** Get all tools */
  getAll(): Tool[]
  
  /** Get tools by category */
  getByCategory(category: Tool['category']): Tool[]
  
  /** Get all tools as LLM function schemas */
  toFunctionSchemas(): Array<ReturnType<Tool['toFunctionSchema']>>
  
  /** Execute a tool by name */
  execute<TInput = any, TOutput = any>(
    toolName: string,
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>>
}

// ============================================================
// TOOL-SPECIFIC INPUT/OUTPUT TYPES
// ============================================================

/**
 * Write Content Tool
 */
export interface WriteContentInput {
  sectionId: string
  prompt: string
  model?: string
  streamingEnabled?: boolean
}

export interface WriteContentOutput {
  generatedContent: string
  tokensUsed: number
  modelUsed: string
  streamingChunks?: number
}

/**
 * Create Structure Tool
 */
export interface CreateStructureInput {
  format: 'screenplay' | 'novel' | 'report' | 'notes'
  userPrompt?: string
  sourceDocumentId?: string
  reportType?: string
}

export interface CreateStructureOutput {
  structureId: string
  nodeCount: number
  plan: any
}

/**
 * Answer Question Tool
 */
export interface AnswerQuestionInput {
  question: string
  useRAG?: boolean
  model?: string
}

export interface AnswerQuestionOutput {
  answer: string
  sources?: string[]
  confidence: number
}

/**
 * Open Document Tool
 */
export interface OpenDocumentInput {
  nodeId: string
  sectionId?: string
}

export interface OpenDocumentOutput {
  nodeId: string
  nodeName: string
  sectionId?: string
  sectionName?: string
}

/**
 * Select Section Tool
 */
export interface SelectSectionInput {
  sectionId: string
  sectionName?: string
}

export interface SelectSectionOutput {
  sectionId: string
  sectionName: string
  level: number
}

/**
 * Delete Node Tool
 */
export interface DeleteNodeInput {
  nodeId: string
  nodeName?: string
}

export interface DeleteNodeOutput {
  nodeId: string
  nodeName: string
}

/**
 * Message Tool (display message to user)
 */
export interface MessageInput {
  content: string
  type: 'thinking' | 'result' | 'error' | 'progress'
}

export interface MessageOutput {
  displayed: boolean
}

