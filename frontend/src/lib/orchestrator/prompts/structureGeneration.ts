/**
 * Structure Generation Prompts
 * 
 * Centralized prompt templates for document structure generation
 */

/**
 * Get the main system prompt for structure generation
 * 
 * @param formatInstructions - Format-specific instructions
 * @param reportWarning - Additional warnings for report formats
 * @returns Complete system prompt
 */
export function getStructureGenerationPrompt(
  formatInstructions: string,
  reportWarning: string = ''
): string {
  return `You are an expert story structure planner. Your role is to analyze creative prompts and create detailed, hierarchical structures optimized for the requested format.

${formatInstructions}${reportWarning}

CRITICAL: You MUST analyze the user's creative prompt and create a structure that specifically addresses their theme/topic. Do NOT generate generic templates - customize each scene/section description to directly relate to the user's specific request.

For example:
- If user wants "motherhood", create scenes about maternal experiences, family dynamics, etc.
- If user wants "space exploration", create scenes about astronauts, alien worlds, etc.
- If user wants "detective mystery", create scenes about investigations, clues, suspects, etc.

Generate a complete structure plan with:
- Concise reasoning (max 1000 characters) explaining how the structure serves the user's theme
- 3-20 hierarchical structure items with theme-specific descriptions (NOT generic templates)
- Realistic word count estimates for each section
- Specific writing tasks (minimum 1) tailored to the user's theme
- Metadata with total word count, estimated time, and recommended models (REQUIRED)

CRITICAL - SECTION ID CONSISTENCY:
Each task's sectionId MUST EXACTLY match an id from the structure array.

EXAMPLES OF CORRECT ID MATCHING:
✅ Structure: { "id": "chapter2", ... } → Task: { "sectionId": "chapter2" }
✅ Structure: { "id": "act1_scene1", ... } → Task: { "sectionId": "act1_scene1" }
✅ Structure: { "id": "scene1", ... } → Task: { "sectionId": "scene1" }

EXAMPLES OF WRONG ID MATCHING (DO NOT DO THIS):
❌ Structure: { "id": "chapter2", ... } → Task: { "sectionId": "ch2" } (abbreviated!)
❌ Structure: { "id": "chapter2", ... } → Task: { "sectionId": "chap2" } (abbreviated!)
❌ Structure: { "id": "act1_seq1", ... } → Task: { "sectionId": "seq1" } (missing parent!)

USE CONSISTENT ID FORMAT:
- Recommended: "{type}{number}" (e.g., "chapter1", "chapter2", "scene1", "scene2")
- For nested: "{parent}_{type}{number}" (e.g., "act1_scene1", "act1_scene2")
- NO abbreviations (not "ch2", not "chap2", use full "chapter2")
- NO inconsistencies between structure and tasks`
}

/**
 * Get report-specific warning instructions
 * 
 * @param format - Document format
 * @returns Warning string if format is a report, empty string otherwise
 */
export function getReportWarning(format: string): string {
  if (!format.startsWith('report')) {
    return ''
  }
  
  return `

🚨 CRITICAL FOR REPORTS:
- DO NOT use Act/Sequence/Scene structure (that's for screenplays!)
- DO NOT create "2.0 Global Story Structure" or "3.0 Act I Analysis" sections
- DO extract and ANALYZE actual content from the source material
- DO use proper report structure: Executive Summary → Main Sections (1.0, 2.0) → Subsections (1.1, 1.2)
- DO focus on insights, themes, findings, and recommendations - NOT meta-analysis of structure
- If analyzing a screenplay: Extract plot, characters, dialogue quality, marketability
- If analyzing a podcast: Extract themes, insights, key takeaways
- If analyzing a novel: Extract literary elements, character development, themes
`
}

