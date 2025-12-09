/**
 * SaveTool: Unified persistence mechanism for orchestrator-driven saves
 * 
 * PHILOSOPHY:
 * - ONE tool for all orchestrator persistence needs
 * - Works like clicking "Save Changes" but programmatically
 * - Uses admin client via API to bypass RLS issues
 * - Logs to Blackboard for visibility
 * 
 * WHEN TO USE:
 * 1. After structure creation → Save node.data + document_data
 * 2. After content generation → Update document_data
 * 3. When WorldState changes → Persist changes
 * 
 * Note: Manual "Save Changes" button still uses saveCanvas() for nodes + edges
 */

import { BaseTool } from './BaseTool'
import type { Tool, ToolContext, ToolResult, ToolParameter } from './types'

export interface SaveToolInput {
  nodeId: string
  storyId: string
  updates: {
    data?: any              // Node metadata (structure, format, items)
    document_data?: any     // Hierarchical document content
    position_x?: number     // Canvas position
    position_y?: number     // Canvas position
  }
  reason?: string           // Why are we saving? (for logging)
}

export interface SaveToolOutput {
  nodeId: string
  fieldsSaved: string[]     // Which fields were updated
  timestamp: string
}

export class SaveTool extends BaseTool implements Tool<SaveToolInput, SaveToolOutput> {
  name = 'save'
  description = 'Save node changes to database (unified persistence)'
  category: 'persistence' = 'persistence'
  requiresConfirmation = false
  
  parameters: ToolParameter[] = [
    {
      name: 'nodeId',
      type: 'string',
      description: 'ID of the node to save',
      required: true
    },
    {
      name: 'storyId',
      type: 'string',
      description: 'Story ID (for ownership verification)',
      required: true
    },
    {
      name: 'updates',
      type: 'object',
      description: 'Fields to update (data, document_data, position_x, position_y)',
      required: true
    },
    {
      name: 'reason',
      type: 'string',
      description: 'Reason for saving (for logging)',
      required: false
    }
  ]

  async execute(
    input: SaveToolInput,
    context: ToolContext
  ): Promise<ToolResult<SaveToolOutput>> {
    const { nodeId, storyId, updates, reason } = input
    
    try {
      console.log('💾 [SaveTool] Saving node:', {
        nodeId,
        storyId,
        fieldsToUpdate: Object.keys(updates),
        reason: reason || 'No reason provided'
      })
      
      // Log to Blackboard for UI visibility
      context.blackboard?.addMessage({
        role: 'orchestrator',
        content: `💾 Saving ${reason || 'changes'} to database...`,
        type: 'progress'
      })
      
      // Call unified save endpoint (uses admin client to bypass RLS)
      const response = await fetch('/api/node/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          storyId,
          updates,
          userId: context.userId
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Save failed: ${errorData.error || response.statusText}`)
      }
      
      const result = await response.json()
      
      console.log('✅ [SaveTool] Save successful:', {
        nodeId: result.nodeId,
        fieldsSaved: result.fieldsSaved
      })
      
      // Log success to Blackboard
      context.blackboard?.addMessage({
        role: 'orchestrator',
        content: `✅ Saved ${result.fieldsSaved.join(', ')} to database`,
        type: 'result'
      })
      
      return {
        success: true,
        data: {
          nodeId: result.nodeId,
          fieldsSaved: result.fieldsSaved,
          timestamp: new Date().toISOString()
        }
      }
      
    } catch (error) {
      console.error('❌ [SaveTool] Save failed:', error)
      
      // Log error to Blackboard
      context.blackboard?.addMessage({
        role: 'orchestrator',
        content: `❌ Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown save error'
      }
    }
  }
}

