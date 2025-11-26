/**
 * Orchestrator Tools
 * 
 * Executable tools that the orchestrator can invoke directly.
 * Replaces JSON action plans with direct tool execution.
 */

// Core types and interfaces
export * from './types'

// Tool registry
export { ToolRegistry, createToolRegistry } from './ToolRegistry'

// Base tool implementation
export { BaseTool } from './BaseTool'

// Core tools
export { WriteContentTool } from './writeContentTool'
export { CreateStructureTool } from './createStructureTool'
export { AnswerQuestionTool } from './answerQuestionTool'
export { OpenDocumentTool } from './openDocumentTool'
export { SelectSectionTool } from './selectSectionTool'
export { DeleteNodeTool } from './deleteNodeTool'
export { MessageTool } from './messageTool'
export { SaveTool } from './saveTool'

/**
 * Create a default tool registry with all core tools registered
 */
import { createToolRegistry as createRegistry } from './ToolRegistry'
import { WriteContentTool } from './writeContentTool'
import { CreateStructureTool } from './createStructureTool'
import { AnswerQuestionTool } from './answerQuestionTool'
import { OpenDocumentTool } from './openDocumentTool'
import { SelectSectionTool } from './selectSectionTool'
import { DeleteNodeTool } from './deleteNodeTool'
import { MessageTool } from './messageTool'
import { SaveTool } from './saveTool'

export function createDefaultToolRegistry() {
  const registry = createRegistry()
  
  // Register all tools
  registry.register(new WriteContentTool())
  registry.register(new CreateStructureTool())
  registry.register(new AnswerQuestionTool())
  registry.register(new OpenDocumentTool())
  registry.register(new SelectSectionTool())
  registry.register(new DeleteNodeTool())
  registry.register(new MessageTool())
  registry.register(new SaveTool()) // 🆕 Unified persistence
  
  console.log('[ToolRegistry] Default registry created with', registry.getStats().totalTools, 'tools')
  
  return registry
}

