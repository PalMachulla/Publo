/**
 * Tool Registry Implementation
 * 
 * Central registry for managing all executable tools.
 * Handles registration, lookup, and execution.
 */

import type { Tool, ToolRegistry as IToolRegistry, ToolContext, ToolResult } from './types'

export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, Tool> = new Map()

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Tool "${tool.name}" already registered, overwriting...`)
    }
    this.tools.set(tool.name, tool)
    console.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.category})`)
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tools by category
   */
  getByCategory(category: Tool['category']): Tool[] {
    return this.getAll().filter(tool => tool.category === category)
  }

  /**
   * Get all tools as LLM function schemas
   */
  toFunctionSchemas(): Array<ReturnType<Tool['toFunctionSchema']>> {
    return this.getAll().map(tool => tool.toFunctionSchema())
  }

  /**
   * Execute a tool by name
   */
  async execute<TInput = any, TOutput = any>(
    toolName: string,
    input: TInput,
    context: ToolContext
  ): Promise<ToolResult<TOutput>> {
    const tool = this.get(toolName)

    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found in registry`,
        metadata: {
          availableTools: Array.from(this.tools.keys())
        }
      }
    }

    // Validate input if tool has validation
    if (tool.validate) {
      const errors = tool.validate(input)
      if (errors && errors.length > 0) {
        return {
          success: false,
          error: `Validation failed: ${errors.join(', ')}`,
          metadata: {
            validationErrors: errors
          }
        }
      }
    }

    // Execute tool
    const startTime = Date.now()
    try {
      const result = await tool.execute(input, context)
      const duration = Date.now() - startTime

      return {
        ...result,
        metadata: {
          ...result.metadata,
          toolName,
          duration,
          timestamp: Date.now()
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[ToolRegistry] Tool "${toolName}" execution failed:`, error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        metadata: {
          toolName,
          duration,
          timestamp: Date.now(),
          errorStack: error instanceof Error ? error.stack : undefined
        }
      }
    }
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear()
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number
    byCategory: Record<string, number>
    toolNames: string[]
  } {
    const byCategory: Record<string, number> = {}
    const tools = this.getAll()

    tools.forEach(tool => {
      byCategory[tool.category] = (byCategory[tool.category] || 0) + 1
    })

    return {
      totalTools: tools.length,
      byCategory,
      toolNames: tools.map(t => t.name)
    }
  }
}

/**
 * Create and return a default tool registry instance
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry()
}

