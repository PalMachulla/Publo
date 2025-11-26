/**
 * Write Content Tool
 * 
 * PHASE 2 + 3 INTEGRATION:
 * This tool delegates to the WriterCriticCluster (multi-agent system)
 * for high-quality content generation with iterative refinement.
 */

import { BaseTool } from './BaseTool'
import type { ToolContext, ToolResult, ToolParameter, WriteContentInput, WriteContentOutput } from './types'
import { WriterAgent } from '../agents/WriterAgent'
import { CriticAgent } from '../agents/CriticAgent'
import { WriterCriticCluster } from '../agents/clusters/WriterCriticCluster'
import type { AgentTask } from '../agents/types'
import { saveAgentContent } from '../agents/utils/contentPersistence'

export class WriteContentTool extends BaseTool<WriteContentInput, WriteContentOutput> {
  name = 'write_content'
  description = 'Generate content for a specific section in the document. Use this when the user wants to write, add, or generate text.'
  category: 'content' = 'content'
  requiresConfirmation = false
  estimatedDuration = 5000 // 5 seconds (base, may take longer with revisions)

  parameters: ToolParameter[] = [
    {
      name: 'sectionId',
      type: 'string',
      description: 'ID of the section to write content in',
      required: true
    },
    {
      name: 'sectionName',
      type: 'string',
      description: 'Name of the section (for context)',
      required: false
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
      name: 'useCluster',
      type: 'boolean',
      description: 'Whether to use writer-critic cluster for quality assurance',
      required: false,
      default: true
    },
    {
      name: 'storyStructureNodeId',
      type: 'string',
      description: 'Optional: ID of the story structure node (if not using active document)',
      required: false
    },
    {
      name: 'format',
      type: 'string',
      description: 'Optional: document format (novel, screenplay, etc.)',
      required: false
    }
  ]

  async execute(
    input: WriteContentInput,
    context: ToolContext
  ): Promise<ToolResult<WriteContentOutput>> {
    const { sectionId, sectionName, prompt, model, useCluster = true, storyStructureNodeId: inputNodeId, format: inputFormat } = input
    const { worldState, userId, userKeyId } = context

    // Get document info - prioritize input parameters over worldState
    // This handles cases where structure was just created and worldState hasn't updated yet
    let storyStructureNodeId: string | undefined
    let format: string
    
    if (inputNodeId) {
      // Use provided node ID (from action payload)
      storyStructureNodeId = inputNodeId
      format = inputFormat || 'novel'
      console.log(`🔧 [WriteContentTool] Using provided node ID: ${storyStructureNodeId}`)
    } else {
      // Fall back to active document from WorldState
      const activeDoc = worldState.getActiveDocument()
      if (!activeDoc || !activeDoc.nodeId) {
        return this.error('No active document found. Please provide storyStructureNodeId or ensure a document is active.')
      }
      storyStructureNodeId = activeDoc.nodeId
      format = activeDoc.format || 'novel'
      console.log(`🔧 [WriteContentTool] Using active document: ${storyStructureNodeId}`)
    }
    
    if (!storyStructureNodeId) {
      return this.error('Cannot determine target document. No storyStructureNodeId available.')
    }

    try {
      console.log(`🔧 [WriteContentTool] Executing for section "${sectionName || sectionId}"`)
      console.log(`   Using ${useCluster ? 'writer-critic cluster' : 'direct writer agent'}`)

      // Create agent task
      const task: AgentTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'write_chapter',
        payload: {
          taskId: '',
          action: 'write_chapter',
          context: {
            section: {
              id: sectionId,
              name: sectionName || sectionId,
              description: prompt
            },
            constraints: {
              tone: 'professional',
              style: 'engaging',
              targetAudience: 'general readers',
              length: 2000
            }
          },
          dependencies: []
        },
        dependencies: [],
        assignedTo: null,
        status: 'pending',
        priority: 'normal',
        createdAt: Date.now()
      }

      // Execute with writer-critic cluster or direct writer
      let content: string
      let tokensUsed = 0
      let iterations = 1
      let finalScore = 0

      if (useCluster) {
        // PHASE 3: Use writer-critic cluster for quality assurance
        const writer = new WriterAgent('writer-tool', userId, userKeyId)
        const critic = new CriticAgent('critic-tool', userId)
        const cluster = new WriterCriticCluster(writer, critic, 3, 7.0)

        const result = await cluster.generate(task, {
          blackboard: context.blackboard,
          dependencies: {},
          sessionId: `tool-${Date.now()}`,
          metadata: {
            storyStructureNodeId,
            format
          }
        })

        content = result.content
        tokensUsed = result.metadata.totalTokens
        iterations = result.iterations
        finalScore = result.finalScore

        console.log(`✅ [WriteContentTool] Cluster complete: ${iterations} iterations, score ${finalScore}/10`)
      } else {
        // Direct writer agent (no iterative refinement)
        const writer = new WriterAgent('writer-tool-direct', userId, userKeyId)
        
        const result = await writer.execute(task, {
          blackboard: context.blackboard,
          dependencies: {},
          sessionId: `tool-${Date.now()}`,
          metadata: {
            storyStructureNodeId,
            format
          }
        })

        content = result.data
        tokensUsed = result.tokensUsed

        console.log(`✅ [WriteContentTool] Direct write complete`)
      }

      // Save to database
      const saveResult = await saveAgentContent({
        storyStructureNodeId,
        sectionId,
        content,
        userId
      })

      if (!saveResult.success) {
        return this.error(`Content generated but save failed: ${saveResult.error}`)
      }

      console.log(`💾 [WriteContentTool] Content saved: ${saveResult.wordCount} words`)

      return this.success({
        generatedContent: content,
        tokensUsed,
        modelUsed: model || 'auto-selected',
        metadata: {
          iterations,
          finalScore,
          wordCount: saveResult.wordCount,
          savedToDatabase: true
        }
      }, {
        sectionId,
        sectionName,
        storyStructureNodeId,
        userId
      })

    } catch (error) {
      console.error(`❌ [WriteContentTool] Execution failed:`, error)
      return this.error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

