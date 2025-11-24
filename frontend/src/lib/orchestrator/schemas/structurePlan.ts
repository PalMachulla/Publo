/**
 * Zod Schema for Structure Plan
 * 
 * Used for native structured outputs with:
 * - OpenAI: json_schema
 * - Anthropic: tool use
 * - Google: function calling
 */

import { z } from 'zod'

// ============================================================
// ZOD SCHEMAS
// ============================================================

export const StructureItemSchema = z.object({
  id: z.string().describe('Unique identifier (e.g., "act1", "seq1")'),
  level: z.number().int().min(1).max(5).describe('Hierarchy level: 1=top, 2=sub-section, etc.'),
  name: z.string().min(1).max(200).describe('Section name (e.g., "Act I - Setup")'),
  parentId: z.string().nullable().describe('Parent section ID, null for top-level'),
  wordCount: z.number().int().min(0).describe('Estimated word count for this section'),
  summary: z.string().min(10).max(500).describe('Brief description of this section\'s purpose and content')
})

export const TaskSchema = z.object({
  id: z.string().describe('Unique task identifier'),
  type: z.enum(['write_section', 'edit_section', 'review_section']).describe('Type of task to perform'),
  sectionId: z.string().describe('ID of the section this task relates to'),
  description: z.string().min(10).max(300).describe('What needs to be done')
})

export const MetadataSchema = z.object({
  totalWordCount: z.number().int().min(0).describe('Total estimated word count for entire work'),
  estimatedTime: z.string().describe('Estimated completion time (e.g., "20 hours")'),
  recommendedModels: z.array(z.string()).describe('Suggested AI models for writing tasks')
})

export const StructurePlanSchema = z.object({
  reasoning: z.string().min(50).max(1000).describe('Brief analysis of the prompt and structural decisions (max 1000 chars)'),
  structure: z.array(StructureItemSchema)
    .min(3)
    .max(20)
    .describe('Hierarchical structure with 3-20 sections'),
  tasks: z.array(TaskSchema)
    .min(1)
    .describe('Writing tasks to complete the work'),
  metadata: MetadataSchema.optional().describe('Additional metadata about the project')
})

// ============================================================
// TYPESCRIPT TYPES (inferred from Zod)
// ============================================================

export type StructureItem = z.infer<typeof StructureItemSchema>
export type Task = z.infer<typeof TaskSchema>
export type Metadata = z.infer<typeof MetadataSchema>
export type StructurePlan = z.infer<typeof StructurePlanSchema>

// ============================================================
// JSON SCHEMA (for API calls)
// ============================================================

/**
 * JSON Schema for StructurePlan (used by OpenAI/Anthropic/Google)
 */
export function getStructurePlanJsonSchema() {
  return {
    type: 'object',
    properties: {
      reasoning: {
        type: 'string',
        description: 'Brief analysis of the prompt and structural decisions (max 1000 chars)',
        minLength: 50,
        maxLength: 1000
      },
      structure: {
        type: 'array',
        description: 'Hierarchical structure with 3-20 sections',
        minItems: 3,
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique identifier (e.g., "act1", "seq1")' },
            level: { type: 'integer', minimum: 1, maximum: 5, description: 'Hierarchy level: 1=top, 2=sub-section, etc.' },
            name: { type: 'string', minLength: 1, maxLength: 200, description: 'Section name (e.g., "Act I - Setup")' },
            parentId: { type: ['string', 'null'], description: 'Parent section ID, null for top-level' },
            wordCount: { type: 'integer', minimum: 0, description: 'Estimated word count for this section' },
            summary: { type: 'string', minLength: 10, maxLength: 500, description: 'Brief description of this section\'s purpose and content' }
          },
          required: ['id', 'level', 'name', 'parentId', 'wordCount', 'summary'],
          additionalProperties: false
        }
      },
      tasks: {
        type: 'array',
        description: 'Writing tasks to complete the work',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique task identifier' },
            type: { type: 'string', enum: ['write_section', 'edit_section', 'review_section'], description: 'Type of task to perform' },
            sectionId: { type: 'string', description: 'ID of the section this task relates to' },
            description: { type: 'string', minLength: 10, maxLength: 300, description: 'What needs to be done' }
          },
          required: ['id', 'type', 'sectionId', 'description'],
          additionalProperties: false
        }
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata about the project',
        properties: {
          totalWordCount: { type: 'integer', minimum: 0, description: 'Total estimated word count for entire work' },
          estimatedTime: { type: 'string', description: 'Estimated completion time (e.g., "20 hours")' },
          recommendedModels: { type: 'array', items: { type: 'string' }, description: 'Suggested AI models for writing tasks' }
        },
        required: ['totalWordCount', 'estimatedTime', 'recommendedModels'],
        additionalProperties: false
      }
    },
    required: ['reasoning', 'structure', 'tasks'],
    additionalProperties: false
  }
}

/**
 * Get OpenAI-compatible response_format
 */
export function getOpenAIResponseFormat() {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'structure_plan',
      strict: true,
      schema: getStructurePlanJsonSchema()
    }
  }
}

/**
 * Get Anthropic-compatible tool definition
 */
export function getAnthropicToolDefinition() {
  return {
    name: 'create_structure_plan',
    description: 'Generate a hierarchical story structure plan with sections and tasks',
    input_schema: getStructurePlanJsonSchema()
  }
}

/**
 * Get Google-compatible function declaration
 */
export function getGoogleFunctionDeclaration() {
  return {
    name: 'createStructurePlan',
    description: 'Generate a hierarchical story structure plan',
    parameters: getStructurePlanJsonSchema()
  }
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate and parse a structure plan
 */
export function validateStructurePlan(data: unknown): { success: true, data: StructurePlan } | { success: false, error: string } {
  try {
    const validated = StructurePlanSchema.parse(data)
    return { success: true, data: validated }
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Invalid structure plan format' 
    }
  }
}

/**
 * Safely validate structure plan (returns null on error)
 */
export function safeValidateStructurePlan(data: unknown): StructurePlan | null {
  const result = StructurePlanSchema.safeParse(data)
  return result.success ? result.data : null
}

