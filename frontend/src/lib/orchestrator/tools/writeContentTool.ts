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
      default: false // ⚠️ DISABLED: See PHASE3_COMPLETE.md "Known Limitations" section
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
    const { sectionId, sectionName, prompt, model, useCluster = false, storyStructureNodeId: inputNodeId, format: inputFormat } = input // ⚠️ Default to false (see PHASE3_COMPLETE.md)
    const { worldState, userId, userKeyId } = context

    // ✅ CHECK: Ensure worldState exists before accessing properties
    if (!worldState) {
      console.error('❌ [WriteContentTool] Context.worldState is undefined!')
      return this.error('System Error: WorldState not available in tool context.')
    }

    // Get document info - prioritize input parameters over worldState
    // This handles cases where structure was just created and worldState hasn't updated yet
    let storyStructureNodeId: string | undefined
    let format: string
    
    // ✅ DEBUG: Log WorldState status
    let activeDoc
    try {
      activeDoc = worldState.getActiveDocument()
      console.log('📊 [WriteContentTool] WorldState check:', {
        hasActiveDoc: !!activeDoc.nodeId,
        activeDocId: activeDoc.nodeId,
        activeDocFormat: activeDoc.format,
        providedNodeId: inputNodeId,
        providedFormat: inputFormat
      })
    } catch (e) {
      console.error('❌ [WriteContentTool] Error accessing active document:', e)
      activeDoc = { nodeId: null, format: null }
    }
    
    if (inputNodeId) {
      // Use provided node ID (from action payload)
      storyStructureNodeId = inputNodeId
      format = inputFormat || 'novel'
      console.log(`🔧 [WriteContentTool] Using provided node ID: ${storyStructureNodeId}`)
      // Only check WorldState if it exists
      if (activeDoc?.nodeId) {
        console.log(`   (WorldState has ${activeDoc.nodeId})`)
      } else {
        console.log(`   (WorldState has no active doc)`)
      }
    } else {
      // Fall back to active document from WorldState
      if (!worldState) {
        return this.error('WorldState not available. Cannot resolve active document.')
      }
      
      if (!activeDoc || !activeDoc.nodeId) {
        return this.error('No active document found. Please provide storyStructureNodeId or ensure a document is active.')
      }
      storyStructureNodeId = activeDoc.nodeId
      format = activeDoc.format || 'novel'
      console.log(`🔧 [WriteContentTool] Using active document from WorldState: ${storyStructureNodeId}`)
    }
    
    if (!storyStructureNodeId) {
      return this.error('Cannot determine target document. No storyStructureNodeId available.')
    }

    try {
      console.log(`🔧 [WriteContentTool] Executing for section "${sectionName || sectionId}"`)
      console.log(`   Using ${useCluster ? 'writer-critic cluster' : 'direct writer agent'}`)

      // ✅ FIX: Get structure and content context from WorldState FIRST
      const activeDoc = worldState.getActiveDocument()
      // ✅ FIX: Type assertion to include all StoryStructureItem properties
      const structureItems = (activeDoc.structure?.items || []) as Array<{
        id: string
        name: string
        level: number
        parentId: string | null
        order: number
        wordCount?: number
        summary?: string // Include summary property
        title?: string // Include title property
      }>
      const contentMap = activeDoc.content ? Object.fromEntries(activeDoc.content) : {}
      
      // ✅ DEBUG: Log all available section IDs
      console.log(`🔍 [WriteContentTool] Available section IDs in structure:`, structureItems.map(item => item.id))
      console.log(`🔍 [WriteContentTool] Looking for section ID: "${sectionId}"`)
      
      // ✅ CRITICAL: Find the structure item to get its summary
      const targetStructureItem = structureItems.find(item => item.id === sectionId)
      
      console.log(`📚 [WriteContentTool] Structure context:`, {
        structureItemsCount: structureItems.length,
        contentMapKeys: Object.keys(contentMap).length,
        targetSection: targetStructureItem?.name,
        hasSummary: !!targetStructureItem?.summary,
        summary: targetStructureItem?.summary?.substring(0, 100),
        requestedSectionId: sectionId,
        foundMatch: !!targetStructureItem
      })

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
              name: sectionName || targetStructureItem?.name || sectionId,
              description: prompt,
              summary: targetStructureItem?.summary || undefined, // ✅ CRITICAL: Include summary!
              title: targetStructureItem?.title || undefined,
              level: targetStructureItem?.level || undefined
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

      // ✅ NEW: Emit event to show progress indicator in document panel
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('content-generation-started', {
          detail: { 
            nodeId: storyStructureNodeId, 
            sectionId,
            sectionName: sectionName || sectionId,
            useCluster
          }
        }))
        console.log('📡 [WriteContentTool] Emitted content-generation-started event for', sectionName || sectionId)
      }

      if (useCluster) {
        // PHASE 3: Use writer-critic cluster for quality assurance
        // ✅ FIX: WriterAgent expects userKeyIds as string[] | undefined
        const writer = new WriterAgent('writer-tool', userId, userKeyId ? [userKeyId] : undefined)
        const critic = new CriticAgent('critic-tool', userId)
        const cluster = new WriterCriticCluster(writer, critic, 3, 7.0)

        const result = await cluster.generate(task, {
          blackboard: context.blackboard,
          dependencies: {
            structure: structureItems,
            contentMap: contentMap,
            previousContent: contentMap[sectionId] || null
          },
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
        // ✅ FIX: WriterAgent expects userKeyIds as string[] | undefined
        const writer = new WriterAgent('writer-tool-direct', userId, userKeyId ? [userKeyId] : undefined)
        
        const result = await writer.execute(task, {
          blackboard: context.blackboard,
          dependencies: {
            structure: structureItems,
            contentMap: contentMap,
            previousContent: contentMap[sectionId] || null
          },
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
      console.log('🔗 [WriteContentTool] Passing to saveAgentContent:', {
        storyStructureNodeId,
        sectionId,
        userId,
        contentLength: content.length
      })
      
      const saveResult = await saveAgentContent({
        storyStructureNodeId,
        sectionId,
        content,
        userId,
        supabaseClient: context.supabaseClient // ✅ FIX: Pass authenticated client
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

