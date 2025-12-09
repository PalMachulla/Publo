/**
 * Delete Node Tool
 * 
 * Deletes a node from the canvas (destructive action).
 */

import { BaseTool } from './BaseTool'
import type { ToolContext, ToolResult, ToolParameter, DeleteNodeInput, DeleteNodeOutput } from './types'

export class DeleteNodeTool extends BaseTool<DeleteNodeInput, DeleteNodeOutput> {
  name = 'delete_node'
  description = 'Delete a node from the canvas. Use this when the user explicitly wants to remove a document or node.'
  category: 'structure' = 'structure'
  requiresConfirmation = true // Destructive action
  estimatedDuration = 1000 // 1 second

  parameters: ToolParameter[] = [
    {
      name: 'nodeId',
      type: 'string',
      description: 'ID of the node to delete',
      required: true
    },
    {
      name: 'nodeName',
      type: 'string',
      description: 'Optional: Human-readable node name for confirmation',
      required: false
    }
  ]

  async execute(
    input: DeleteNodeInput,
    context: ToolContext
  ): Promise<ToolResult<DeleteNodeOutput>> {
    const { nodeId, nodeName } = input
    const { worldState } = context

    // Verify node exists
    const node = worldState.getNode(nodeId)
    if (!node) {
      return this.error(`Node with ID ${nodeId} not found`)
    }

    const actualNodeName = nodeName || node.data?.label || node.data?.name || 'Untitled'

    // TODO: In Phase 2, this tool will:
    // 1. Remove node from WorldState
    // 2. Remove associated edges
    // 3. Delete from database if persisted
    // 4. Trigger canvas update
    //
    // For now, return placeholder

    return this.success({
      nodeId,
      nodeName: actualNodeName
    }, {
      nodeType: node.type,
      hadContent: !!node.data?.contentMap
    })
  }
}

