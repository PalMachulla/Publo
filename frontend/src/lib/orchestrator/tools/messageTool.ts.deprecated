/**
 * Message Tool
 * 
 * Displays a message to the user (informational, thinking, error, etc.)
 */

import { BaseTool } from './BaseTool'
import type { ToolContext, ToolResult, ToolParameter, MessageInput, MessageOutput } from './types'

export class MessageTool extends BaseTool<MessageInput, MessageOutput> {
  name = 'send_message'
  description = 'Display a message to the user. Use this for thinking updates, results, errors, or progress indicators.'
  category: 'system' = 'system'
  requiresConfirmation = false
  estimatedDuration = 100 // 0.1 seconds

  parameters: ToolParameter[] = [
    {
      name: 'content',
      type: 'string',
      description: 'Message content to display',
      required: true
    },
    {
      name: 'type',
      type: 'string',
      description: 'Type of message',
      required: true,
      validation: {
        enum: ['thinking', 'result', 'error', 'progress']
      }
    }
  ]

  async execute(
    input: MessageInput,
    context: ToolContext
  ): Promise<ToolResult<MessageOutput>> {
    const { content, type } = input

    if (!content || content.trim().length === 0) {
      return this.error('Message content cannot be empty')
    }

    // TODO: In Phase 2, this tool will:
    // 1. Add message to chat/reasoning panel
    // 2. Update UI in real-time
    // 3. Handle different message types with appropriate styling
    //
    // For now, just log to console

    console.log(`[MessageTool] ${type.toUpperCase()}: ${content}`)

    return this.success({
      displayed: true
    }, {
      messageLength: content.length,
      type
    })
  }
}

