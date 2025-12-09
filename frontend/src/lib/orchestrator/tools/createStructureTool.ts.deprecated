/**
 * Create Structure Tool
 * 
 * Creates a new document structure (screenplay, novel, report, etc.)
 * Uses AI to generate hierarchical content plans.
 */

import { BaseTool } from './BaseTool'
import type { ToolContext, ToolResult, ToolParameter, CreateStructureInput, CreateStructureOutput } from './types'

export class CreateStructureTool extends BaseTool<CreateStructureInput, CreateStructureOutput> {
  name = 'create_structure'
  description = 'Create a new document structure (screenplay, novel, report, notes). Use this when the user wants to create a new story or document.'
  category: 'structure' = 'structure'
  requiresConfirmation = false
  estimatedDuration = 8000 // 8 seconds

  parameters: ToolParameter[] = [
    {
      name: 'format',
      type: 'string',
      description: 'Document format to create',
      required: true,
      validation: {
        enum: ['screenplay', 'novel', 'report', 'notes']
      }
    },
    {
      name: 'userPrompt',
      type: 'string',
      description: 'Optional: user description or requirements for the structure',
      required: false
    },
    {
      name: 'sourceDocumentId',
      type: 'string',
      description: 'Optional: ID of document to base this structure on',
      required: false
    },
    {
      name: 'reportType',
      type: 'string',
      description: 'Optional: specific report type (analysis, summary, etc.)',
      required: false
    }
  ]

  async execute(
    input: CreateStructureInput,
    context: ToolContext
  ): Promise<ToolResult<CreateStructureOutput>> {
    const { format, userPrompt, sourceDocumentId, reportType } = input
    const { worldState, userId, userKeyId } = context

    // Validate format
    const validFormats = ['screenplay', 'novel', 'report', 'notes']
    if (!validFormats.includes(format)) {
      return this.error(`Invalid format: ${format}. Must be one of: ${validFormats.join(', ')}`)
    }

    // Check if user has API key for structure generation
    if (!userKeyId) {
      return this.error('User API key required for structure generation')
    }

    // TODO: In Phase 2, this tool will:
    // 1. Call /api/orchestrator/structure with the plan
    // 2. Stream progress updates
    // 3. Create nodes on canvas via WorldState updates
    // 4. Track execution and costs
    //
    // For now, we return a placeholder

    return this.success({
      structureId: `structure_${Date.now()}`,
      nodeCount: 0,
      plan: {
        format,
        userPrompt,
        sourceDocumentId,
        reportType
      }
    }, {
      userId,
      userKeyId
    })
  }
}

