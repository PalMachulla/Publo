/**
 * Format Instructions Generator
 * 
 * Generates format-specific instructions for structure generation prompts
 */

import { getDocumentHierarchy, DOCUMENT_HIERARCHY, getFormatGuidance } from './documentHierarchy'

/**
 * Get format-specific instructions for structure generation
 * 
 * @param format - Document format (novel, screenplay, report, etc.)
 * @returns Formatted instructions string for LLM prompt
 */
export function getFormatInstructions(format: string): string {
  // Normalize format (e.g., 'short-story' -> 'short_story')
  const normalizedFormat = format.toLowerCase().replace(/-/g, '_')
  const hierarchy = getDocumentHierarchy(normalizedFormat)
  const docType = DOCUMENT_HIERARCHY.document_types[normalizedFormat]
  
  if (!hierarchy || !docType) {
    // Fallback for unknown formats
    return `For ${format.toUpperCase()} format:
- Create a logical hierarchical structure appropriate for this type of document
- Use clear parent-child relationships between sections
- Provide realistic word count estimates`
  }
  
  // Build format-specific instructions from documentHierarchy.ts
  const formatLabel = format.toUpperCase().replace(/-/g, ' ')
  let instructions = `For ${formatLabel} format:\n`
  instructions += `Description: ${docType.description}\n\n`
  instructions += `REQUIRED HIERARCHY (follow this structure exactly):\n`
  
  hierarchy.forEach((level, index) => {
    const optionalLabel = level.optional ? ' (optional)' : ' (REQUIRED)'
    instructions += `- Level ${level.level}: ${level.name}${optionalLabel}`
    if (level.description) {
      instructions += ` - ${level.description}`
    }
    instructions += '\n'
  })
  
  // Add format-specific guidance (from centralized documentHierarchy)
  const formatGuidance = getFormatGuidance(format)
  if (formatGuidance) {
    instructions += '\n' + formatGuidance
  }
  
  instructions += '\n\nIMPORTANT: Only generate structure items for the FIRST 3-4 hierarchy levels. Do not include individual paragraphs, sentences, or lines in your structure plan.'
  
  return instructions
}

