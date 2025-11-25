/**
 * Base Tool Implementation
 * 
 * Abstract base class that implements common Tool functionality.
 * Concrete tools should extend this class.
 */

import type { Tool, ToolParameter, ToolResult, ToolContext } from './types'

export abstract class BaseTool<TInput = any, TOutput = any> implements Tool<TInput, TOutput> {
  abstract name: string
  abstract description: string
  abstract parameters: ToolParameter[]
  abstract category: Tool['category']
  abstract requiresConfirmation: boolean
  estimatedDuration?: number

  /**
   * Execute the tool (must be implemented by subclass)
   */
  abstract execute(input: TInput, context: ToolContext): Promise<ToolResult<TOutput>>

  /**
   * Default validation implementation
   * Checks required parameters and basic type validation
   */
  validate(input: TInput): string[] | null {
    const errors: string[] = []
    const inputObj = input as Record<string, any>

    for (const param of this.parameters) {
      // Check required parameters
      if (param.required && !(param.name in inputObj)) {
        errors.push(`Missing required parameter: ${param.name}`)
        continue
      }

      const value = inputObj[param.name]
      if (value === undefined || value === null) {
        continue
      }

      // Type validation
      const actualType = Array.isArray(value) ? 'array' : typeof value
      if (actualType !== param.type) {
        errors.push(`Parameter ${param.name} must be of type ${param.type}, got ${actualType}`)
      }

      // Number validation
      if (param.type === 'number' && param.validation) {
        if (param.validation.min !== undefined && value < param.validation.min) {
          errors.push(`Parameter ${param.name} must be >= ${param.validation.min}`)
        }
        if (param.validation.max !== undefined && value > param.validation.max) {
          errors.push(`Parameter ${param.name} must be <= ${param.validation.max}`)
        }
      }

      // String validation
      if (param.type === 'string' && param.validation) {
        if (param.validation.pattern && !param.validation.pattern.test(value)) {
          errors.push(`Parameter ${param.name} does not match required pattern`)
        }
        if (param.validation.enum && !param.validation.enum.includes(value)) {
          errors.push(`Parameter ${param.name} must be one of: ${param.validation.enum.join(', ')}`)
        }
      }
    }

    return errors.length > 0 ? errors : null
  }

  /**
   * Convert tool to OpenAI function calling schema
   */
  toFunctionSchema(): {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required: string[]
    }
  } {
    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const param of this.parameters) {
      properties[param.name] = {
        type: param.type,
        description: param.description
      }

      if (param.validation?.enum) {
        properties[param.name].enum = param.validation.enum
      }

      if (param.default !== undefined) {
        properties[param.name].default = param.default
      }

      if (param.required) {
        required.push(param.name)
      }
    }

    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties,
        required
      }
    }
  }

  /**
   * Helper to create a success result
   */
  protected success<T>(data: T, metadata?: Record<string, any>): ToolResult<T> {
    return {
      success: true,
      data,
      metadata: {
        ...metadata,
        toolName: this.name
      }
    }
  }

  /**
   * Helper to create an error result
   */
  protected error(message: string, metadata?: Record<string, any>): ToolResult<TOutput> {
    return {
      success: false,
      error: message,
      metadata: {
        ...metadata,
        toolName: this.name
      }
    }
  }

  /**
   * Helper to record a side effect
   */
  protected recordSideEffect(
    type: 'state_update' | 'api_call' | 'ui_update' | 'database_write' | 'file_write',
    description: string,
    data?: any
  ) {
    return {
      type,
      description,
      timestamp: Date.now(),
      data
    }
  }
}

