/**
 * Select Section Tool
 * 
 * Selects a specific section within the active document.
 */

import { BaseTool } from './BaseTool'
import type { ToolContext, ToolResult, ToolParameter, SelectSectionInput, SelectSectionOutput } from './types'

export class SelectSectionTool extends BaseTool<SelectSectionInput, SelectSectionOutput> {
  name = 'select_section'
  description = 'Navigate to and select a specific section in the document. Use this when the user wants to focus on a particular section.'
  category: 'navigation' = 'navigation'
  requiresConfirmation = false
  estimatedDuration = 300 // 0.3 seconds

  parameters: ToolParameter[] = [
    {
      name: 'sectionId',
      type: 'string',
      description: 'ID of the section to select',
      required: true
    },
    {
      name: 'sectionName',
      type: 'string',
      description: 'Optional: Human-readable section name',
      required: false
    }
  ]

  async execute(
    input: SelectSectionInput,
    context: ToolContext
  ): Promise<ToolResult<SelectSectionOutput>> {
    const { sectionId, sectionName } = input
    const { worldState } = context

    // Get active document
    const activeDoc = worldState.getActiveDocument()
    if (!activeDoc || !activeDoc.structure) {
      return this.error('No active document with structure found')
    }

    // Verify section exists in document
    const section = activeDoc.structure.items.find(item => item.id === sectionId)
    if (!section) {
      return this.error(`Section ${sectionId} not found in active document`)
    }

    // TODO: In Phase 2, this tool will:
    // 1. Update WorldState to set active section
    // 2. Trigger UI scroll to section
    // 3. Update section selection state
    //
    // For now, return placeholder

    return this.success({
      sectionId,
      sectionName: sectionName || section.title || section.name || 'Untitled Section',
      level: section.level || 1
    })
  }
}

