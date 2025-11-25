/**
 * Write Content Tool
 * 
 * Generates content for a specific section using an LLM.
 * This is the primary content generation tool.
 */

import { BaseTool } from './BaseTool'
import type { ToolContext, ToolResult, ToolParameter, WriteContentInput, WriteContentOutput } from './types'

export class WriteContentTool extends BaseTool<WriteContentInput, WriteContentOutput> {
  name = 'write_content'
  description = 'Generate content for a specific section in the document. Use this when the user wants to write, add, or generate text.'
  category: 'content' = 'content'
  requiresConfirmation = false
  estimatedDuration = 5000 // 5 seconds

  parameters: ToolParameter[] = [
    {
      name: 'sectionId',
      type: 'string',
      description: 'ID of the section to write content in',
      required: true
    },
    {
      name: 'prompt',
      type: 'string',
      description: 'Writing prompt or instructions for content generation',
      required: true
    },
    {
      name: 'model',
      type: 'string',
      description: 'Optional: specific model to use for generation',
      required: false
    },
    {
      name: 'streamingEnabled',
      type: 'boolean',
      description: 'Whether to stream the response',
      required: false,
      default: true
    }
  ]

  async execute(
    input: WriteContentInput,
    context: ToolContext
  ): Promise<ToolResult<WriteContentOutput>> {
    const { sectionId, prompt, model, streamingEnabled = true } = input
    const { worldState, userId } = context

    // Verify section exists
    const activeDoc = worldState.getActiveDocument()
    if (!activeDoc) {
      return this.error('No active document found')
    }

    // TODO: In Phase 2, this tool will:
    // 1. Call the LLM provider directly (not via UI callback)
    // 2. Stream responses and update WorldState in real-time
    // 3. Track tokens and costs
    // 4. Handle errors gracefully
    //
    // For now, we return a placeholder that indicates execution should happen

    return this.success({
      generatedContent: '[Tool will generate content here]',
      tokensUsed: 0,
      modelUsed: model || 'auto-selected',
      streamingChunks: streamingEnabled ? 0 : undefined
    }, {
      sectionId,
      prompt: prompt.substring(0, 100), // Log first 100 chars
      userId
    })
  }
}

