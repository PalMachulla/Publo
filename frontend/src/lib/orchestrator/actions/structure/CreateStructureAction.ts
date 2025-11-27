/**
 * CreateStructureAction
 * 
 * Purpose: Handle 'create_structure' intent by generating document structures with LLM
 * 
 * Flow:
 * 1. Validate required fields (format, userKeyId)
 * 2. Validate format conventions (educate user if mismatch)
 * 3. Check canvas for existing documents (avoid duplicates)
 * 4. Generate structure plan with LLM (with fallback models)
 * 5. Analyze task complexity (single-step vs multi-step)
 * 6. Return generate_structure action with plan
 * 7. Optionally add generate_content actions for target sections
 * 
 * Complexity:
 * - LLM-based structure generation with structured outputs
 * - Multi-model fallback strategy
 * - Format validation and education
 * - Canvas awareness (existing documents)
 * - Task complexity analysis
 * - Progress tracking with blackboard
 * 
 * Dependencies:
 * - request.documentFormat: Target format (novel, screenplay, report, etc.)
 * - request.userKeyId: User's API key for LLM calls
 * - request.message: User's creative prompt
 * - request.canvasNodes: Existing canvas nodes (for duplicate detection)
 * - modelSelection: Selected LLM model
 * - availableModels: Models user has API keys for
 * - orchestratorEngine methods:
 *   * validateFormatConventions()
 *   * createStructurePlanWithFallback()
 *   * analyzeTaskComplexity()
 * 
 * Source: orchestratorEngine.ts lines 1175-1701
 * 
 * @module orchestrator/actions/structure
 */

import { BaseAction } from '../base/BaseAction'
import type { IntentAnalysis } from '../../intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../core/contextProvider'
import type { TieredModel } from '../../core/modelRouter'

/**
 * CreateStructureAction
 * 
 * Handles document structure generation with LLM assistance.
 * This is the most complex action, involving:
 * - Format validation and education
 * - Canvas awareness (duplicate detection)
 * - Multi-model fallback strategy
 * - Task complexity analysis
 * - Progress tracking
 */
export class CreateStructureAction extends BaseAction {
  /**
   * Reference to orchestrator engine for helper methods
   * (These will be extracted to separate utilities in Phase 2)
   */
  private orchestratorEngine: any
  
  constructor(orchestratorEngine: any) {
    super()
    this.orchestratorEngine = orchestratorEngine
  }
  
  /**
   * Action type identifier
   */
  get actionType(): OrchestratorAction['type'] {
    return 'generate_structure'
  }
  
  /**
   * Generate actions for create_structure intent
   * 
   * This is the most complex action generator:
   * 1. Validates format and educates user if needed
   * 2. Checks canvas for existing documents
   * 3. Generates structure plan with LLM (with fallback)
   * 4. Analyzes task complexity
   * 5. Returns structure action + optional content actions
   * 
   * @param intent - Analyzed intent from LLM
   * @param request - Original request with format, message, canvas state
   * @param context - Canvas context (not used directly)
   * @param additionalContext - Model selection and available models
   * @returns Array with generate_structure action and optional generate_content actions
   */
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext,
    additionalContext?: {
      ragContext?: any
      modelSelection?: any
      availableModels?: TieredModel[]
    }
  ): Promise<OrchestratorAction[]> {
    console.log('🏗️ [CreateStructureAction] Processing structure request:', {
      format: request.documentFormat,
      message: request.message
    })
    
    const actions: OrchestratorAction[] = []
    const blackboard = this.orchestratorEngine.blackboard
    
    // ============================================================
    // STEP 1: Validate required fields
    // ============================================================
    
    if (!request.documentFormat) {
      return [
        this.message('Unable to create structure: document format not specified', 'error')
      ]
    }
    
    if (!request.userKeyId) {
      return [
        this.message(
          'Unable to create structure: No API keys configured. Please add an API key in Settings to use AI features.',
          'error'
        )
      ]
    }
    
    // ============================================================
    // STEP 2: Validate format conventions (educate user)
    // ============================================================
    
    const formatValidation = this.orchestratorEngine.validateFormatConventions(
      request.documentFormat,
      request.message
    )
    
    console.log('🔍 [Format Validation]', {
      format: request.documentFormat,
      message: request.message,
      validation: formatValidation
    })
    
    if (!formatValidation.valid && formatValidation.mismatch && formatValidation.suggestion) {
      // Educational clarification
      const formatLabel = request.documentFormat.replace(/-/g, ' ')
      const clarificationMessage = `I'd love to help with your ${formatLabel}! Just to clarify - ${formatLabel}s typically use ${formatValidation.suggestion}s rather than ${formatValidation.mismatch}s. Did you mean ${formatValidation.suggestion.charAt(0).toUpperCase() + formatValidation.suggestion.slice(1)} 2? Or are you planning a different format (like a novel)?`
      
      // Add to blackboard for conversation history
      blackboard.addMessage({
        role: 'orchestrator',
        content: clarificationMessage,
        type: 'result'
      })
      
      return [
        this.message(clarificationMessage, 'info')
      ]
    }
    
    blackboard.addMessage({
      role: 'orchestrator',
      content: '🏗️ Generating story structure plan...',
      type: 'thinking'
    })
    
    // ============================================================
    // STEP 3: Check canvas for existing documents
    // ============================================================
    
    console.log('🔍 [Canvas Awareness] Raw canvasNodes:', request.canvasNodes?.length || 0)
    
    const existingDocs = (request.canvasNodes || [])
      .filter((node: any) => 
        node.type === 'storyStructureNode' && 
        node.data?.format &&
        node.data?.items?.length > 0
      )
      .map((node: any) => {
        // Check for content in both legacy contentMap and new document_data
        const contentMapKeys = Object.keys(node.data?.contentMap || {})
        const hasLegacyContent = contentMapKeys.length > 0 && 
          contentMapKeys.some(key => {
            const content = node.data.contentMap[key]
            return content && typeof content === 'string' && content.trim().length > 0
          })
        
        let hasHierarchicalContent = false
        if (node.data.document_data?.structure && Array.isArray(node.data.document_data.structure)) {
          hasHierarchicalContent = node.data.document_data.structure.some((seg: any) => {
            const hasDirectContent = seg.content && seg.content.length > 0
            const hasChildContent = seg.children && Array.isArray(seg.children) && 
              seg.children.some((child: any) => child.content && child.content.length > 0)
            return hasDirectContent || hasChildContent
          })
        }
        
        const hasContent = hasLegacyContent || hasHierarchicalContent
        
        return {
          label: node.data.label || 'Untitled',
          format: node.data.format,
          itemsCount: node.data.items?.length || 0,
          hasContent,
          wordsWritten: node.data.wordsWritten || 0
        }
      })
    
    console.log('🔍 [Canvas Awareness] Found existing documents:', existingDocs)
    
    if (existingDocs.length > 0) {
      const docsList = existingDocs
        .map(doc => `• ${doc.label} (${doc.format}, ${doc.itemsCount} sections, ${doc.wordsWritten} words${doc.hasContent ? ', has content' : ', empty'})`)
        .join('\n')
      
      const awarenessMessage = `📚 I noticed you already have ${existingDocs.length} document${existingDocs.length > 1 ? 's' : ''} on your canvas:\n\n${docsList}\n\nWould you like me to:\n1. Create a new ${request.documentFormat} (separate document)\n2. Add content to one of the existing documents\n3. Something else?`
      
      blackboard.addMessage({
        role: 'orchestrator',
        content: awarenessMessage,
        type: 'result'
      })
      
      return [
        this.message(awarenessMessage, 'info')
      ]
    }
    
    // ============================================================
    // STEP 4: Generate structure plan with LLM
    // ============================================================
    
    const modelSelection = additionalContext?.modelSelection
    const availableModels = additionalContext?.availableModels || []
    
    let structurePlan: any
    try {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `🎯 Attempting structure generation with ${modelSelection?.displayName || modelSelection?.modelId}...`,
        type: 'progress'
      })
      
      structurePlan = await this.orchestratorEngine.createStructurePlanWithFallback(
        request.message,
        request.documentFormat,
        modelSelection?.modelId || 'gpt-4o',
        request.userKeyId,
        availableModels
      )
      
      blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Structure generated successfully with ${modelSelection?.displayName || modelSelection?.modelId}`,
        type: 'result'
      })
    } catch (error: any) {
      console.error('❌ [CreateStructureAction] Structure generation failed:', error)
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Failed to generate structure: ${error.message}`,
        type: 'error'
      })
      
      return [
        this.message(`Structure generation failed: ${error.message}`, 'error')
      ]
    }
    
    // ============================================================
    // STEP 5: Add generate_structure action
    // ============================================================
    
    actions.push({
      type: 'generate_structure',
      payload: {
        format: request.documentFormat,
        structure: structurePlan.structure,
        tasks: structurePlan.tasks,
        reasoning: structurePlan.reasoning,
        metadata: structurePlan.metadata
      },
      status: 'pending'
    })
    
    blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Created ${request.documentFormat} structure with ${structurePlan.structure.length} sections`,
      type: 'result'
    })
    
    // ============================================================
    // STEP 6: Analyze task complexity
    // ============================================================
    
    const taskAnalysis = await this.orchestratorEngine.analyzeTaskComplexity(
      request.message,
      structurePlan.structure,
      intent,
      blackboard
    )
    
    console.log('🔍 [Task Analysis]', taskAnalysis)
    
    // ============================================================
    // STEP 7: Add content generation actions if multi-step
    // ============================================================
    
    if (taskAnalysis.isMultiStep && taskAnalysis.targetSections.length > 0) {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `📝 Orchestrator delegating to writer model with full story context...`,
        type: 'task'
      })
      
      for (const section of taskAnalysis.targetSections) {
        const contentAction: OrchestratorAction = {
          type: 'generate_content',
          payload: {
            sectionId: section.id,
            sectionName: section.name,
            prompt: `Write engaging content for "${section.name}" based on the user's request: ${request.message}`,
            autoStart: true
          },
          status: 'pending'
        }
        
        actions.push(contentAction)
        console.log(`✅ [CreateStructureAction] Added content generation for: ${section.name}`)
      }
    } else {
      console.log('ℹ️ [CreateStructureAction] Single-step task (structure only):', taskAnalysis.reasoning)
    }
    
    return actions
  }
}

