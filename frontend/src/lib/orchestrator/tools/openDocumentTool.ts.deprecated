/**
 * Open Document Tool
 * 
 * Opens a specific document node on the canvas, optionally selecting a section.
 */

import { BaseTool } from './BaseTool'
import type { ToolContext, ToolResult, ToolParameter, OpenDocumentInput, OpenDocumentOutput } from './types'

export class OpenDocumentTool extends BaseTool<OpenDocumentInput, OpenDocumentOutput> {
  name = 'open_document'
  description = 'Open a document node on the canvas. Use this when the user wants to view or work on a specific document.'
  category: 'navigation' = 'navigation'
  requiresConfirmation = false
  estimatedDuration = 500 // 0.5 seconds

  parameters: ToolParameter[] = [
    {
      name: 'nodeId',
      type: 'string',
      description: 'ID of the canvas node to open',
      required: true
    },
    {
      name: 'sectionId',
      type: 'string',
      description: 'Optional: ID of section to auto-select after opening',
      required: false
    }
  ]

  async execute(
    input: OpenDocumentInput,
    context: ToolContext
  ): Promise<ToolResult<OpenDocumentOutput>> {
    const { nodeId, sectionId } = input
    const { worldState } = context

    // Verify node exists
    const node = worldState.getNode(nodeId)
    if (!node) {
      return this.error(`Node with ID ${nodeId} not found`)
    }

    // TODO: In Phase 2, this tool will:
    // 1. Update WorldState to set active document
    // 2. If sectionId provided, set active section
    // 3. Trigger UI update via state observer
    //
    // For now, return placeholder indicating the operation

    return this.success({
      nodeId,
      nodeName: node.data?.label || node.data?.name || 'Untitled',
      sectionId,
      sectionName: sectionId ? 'Section' : undefined
    }, {
      nodeType: node.type
    })
  }
}

