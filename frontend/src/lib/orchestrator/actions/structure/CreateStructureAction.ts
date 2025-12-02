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
 *   * createStructurePlanWithFallback()
 *   * analyzeTaskComplexity()
 * 
 * NOTE: Format validation is now handled by the intent system (validation rules)
 * 
 * Source: orchestratorEngine.ts lines 1175-1701
 * 
 * @module orchestrator/actions/structure
 */

import { BaseAction } from '../base/BaseAction'
import type { IntentAnalysis } from '../../context/intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../context/contextProvider'
import type { TieredModel } from '../../core/modelRouter'
import { getTemplateById } from '../../schemas/templateRegistry'
import { getFormatLabel } from '../../schemas/formatMetadata'

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
    console.log('🚀 [CreateStructureAction] STARTING generate() method')
    console.log('   Intent:', intent.intent)
    console.log('   Message:', request.message)
    console.log('   Format:', request.documentFormat)
    console.log('   ClarificationContext:', !!request.clarificationContext)
    console.log('   Extracted entities:', intent.extractedEntities)
    
    // ============================================================
    // TEMPLATE SELECTION LOGIC
    // ============================================================
    // 
    // Template selection happens in TWO scenarios:
    // 
    // 1. EXPLICIT KEYWORDS (High Confidence):
    //    - User mentions specific template keywords (e.g., "podcast interview", "hero's journey novel")
    //    - Intent analysis extracts suggestedTemplate from message
    //    - Example: "Create a podcast interview" → suggestedTemplate: "interview"
    //    - Result: Proceed directly with structure generation (no clarification needed)
    // 
    // 2. VAGUE REQUEST (Low Confidence):
    //    - User only mentions format (e.g., "Create a podcast", "Write a novel")
    //    - Intent analysis leaves suggestedTemplate undefined
    //    - Result: Return request_clarification with template options (user selects from UI)
    // 
    // 3. CLARIFICATION RESPONSE:
    //    - User selected a template from clarification options
    //    - clarificationContext.payload.selectedOptionId contains the selected template ID
    //    - Result: Use selected template and proceed with structure generation
    // 
    // This logic ensures:
    // - High confidence (explicit keywords) → auto-proceed
    // - Low confidence (vague request) → ask user to choose
    // - User choice (clarification) → proceed with their selection
    // 
    // See: OrchestratorPanel.tsx for UI handling of request_clarification actions
    
    // Check if user selected a template from clarification
    let selectedTemplate = intent.extractedEntities?.suggestedTemplate
    console.log('🎯 [CreateStructureAction] Template sources:', {
      fromIntent: intent.extractedEntities?.suggestedTemplate,
      hasClarification: !!request.clarificationContext,
      clarificationPayload: request.clarificationContext?.payload || null
    })

    if (request.clarificationContext) {
      // User selected a template from clarification options
      const clarification = request.clarificationContext
      const selectedOptionId = clarification.payload?.selectedOptionId
      
      // Try multiple ways to find the selected option
      let selectedOption = selectedOptionId 
        ? clarification.options?.find(opt => opt.id === selectedOptionId)
        : null
      
      // Fallback: check if the option ID is directly in the payload
      if (!selectedOption && selectedOptionId) {
        selectedOption = clarification.options?.find(opt => 
          opt.id === selectedOptionId || 
          opt.label.toLowerCase() === selectedOptionId.toLowerCase()
        )
      }
      
      if (selectedOption) {
        selectedTemplate = selectedOption.id
        console.log('✅ [CreateStructureAction] User selected template from clarification:', {
          templateId: selectedTemplate,
          templateLabel: selectedOption.label,
          selectedOptionId: selectedOptionId
        })
      } else {
        console.warn('⚠️ [CreateStructureAction] Clarification context but no matching option found:', {
          selectedOptionId,
          availableOptions: clarification.options?.map(o => o.id),
          payload: clarification.payload
        })
      }
    }

    const templateInfo = selectedTemplate && request.documentFormat
      ? getTemplateById(request.documentFormat, selectedTemplate)
      : null

    console.log('🏗️ [CreateStructureAction] Processing structure request:', {
      format: request.documentFormat,
      message: request.message,
      selectedTemplate: templateInfo ? `${templateInfo.name} (${templateInfo.id})` : 'none',
      selectedTemplateRaw: selectedTemplate, // ✅ DEBUG: Show raw value
      hasSelectedTemplate: !!selectedTemplate, // ✅ DEBUG: Boolean check
      clarificationContext: request.clarificationContext, // ✅ DEBUG: Check clarification
      intentExtractedEntities: intent.extractedEntities // ✅ DEBUG: Full entities
    })
    
    const actions: OrchestratorAction[] = []
    const blackboard = this.orchestratorEngine.blackboard
    
    // ============================================================
    // STEP 1: Validate required fields
    // ============================================================
    
    // ✅ FIX: For create_structure, prioritize format from intent extraction
    // This handles "Write a screenplay based upon the novel" correctly
    // When user wants to create a NEW document, the format from their message takes priority
    // over the active document's format (which might be the source document they're referencing)
    let effectiveFormat = request.documentFormat
    if (intent.extractedEntities?.documentFormat) {
      effectiveFormat = intent.extractedEntities.documentFormat
      console.log('🎯 [CreateStructureAction] Using format from intent extraction:', {
        extractedFormat: intent.extractedEntities.documentFormat,
        requestFormat: request.documentFormat,
        reason: 'Creating new document - user message format takes priority over active document'
      })
    }
    
    if (!effectiveFormat) {
      return [
        this.message('Unable to create structure: document format not specified', 'error')
      ]
    }
    
    // Update request.documentFormat to use the effective format
    request.documentFormat = effectiveFormat
    
    if (!request.userKeyId) {
      return [
        this.message(
          'Unable to create structure: No API keys configured. Please add an API key in Settings to use AI features.',
          'error'
        )
      ]
    }
    
    // ============================================================
    // STEP 1.5: Check if template selection is needed
    // ============================================================
    // 
    // This step determines whether to proceed with structure generation or request clarification.
    // 
    // Decision Logic:
    // - If selectedTemplate exists → User was explicit (e.g., "podcast interview")
    //   → Skip to structure generation (high confidence, no clarification needed)
    // 
    // - If selectedTemplate is undefined AND format has templates → User was vague (e.g., "podcast")
    //   → Return request_clarification with template options (user needs to choose)
    // 
    // - If selectedTemplate is undefined AND format has NO templates → No template needed
    //   → Skip to structure generation (format doesn't require template selection)
    // 
    // Examples:
    // - "Create a podcast interview" → selectedTemplate: "interview" → Proceed ✅
    // - "Create a podcast" → selectedTemplate: undefined → Show options ✅
    // - "Write a novel" → selectedTemplate: undefined → Show options (if templates exist) ✅
    // 
    // Note: This logic is in the orchestrator layer (not UI) to maintain architectural separation.
    // The UI only displays the request_clarification action, it doesn't make the decision.
    
    console.log('🔍 [STEP 1.5] Template selection check:', {
      hasSelectedTemplate: !!selectedTemplate,
      selectedTemplate,
      hasDocumentFormat: !!request.documentFormat,
      documentFormat: request.documentFormat,
      willCheckTemplates: !selectedTemplate && request.documentFormat
    })
    
    if (!selectedTemplate && effectiveFormat) {
      console.log('✅ [STEP 1.5] No template selected, checking for available templates for format:', effectiveFormat)
      const { getTemplatesForFormat } = await import('../../schemas/templateRegistry')
      const availableTemplates = getTemplatesForFormat(effectiveFormat)

      console.log('📋 [STEP 1.5] Available templates:', {
        count: availableTemplates.length,
        templates: availableTemplates.map((t: any) => ({ id: t.id, name: t.name })),
        willShowOptions: availableTemplates.length > 0
      })

      if (availableTemplates.length > 0) {
        console.log('🎨 [CreateStructureAction] No template specified, showing options:', {
          format: effectiveFormat,
          availableTemplates: availableTemplates.map((t: any) => t.id)
        })
        
        // Return request_clarification with template options
        // ✅ FIX: Use effectiveFormat (from intent extraction) instead of request.documentFormat
        // This ensures the clarification question asks about the correct format (e.g., "screenplay" not "novel")
        return [
          {
            type: 'request_clarification',
            status: 'pending',
            payload: {
              question: `What type of ${effectiveFormat} would you like to create?`,
              context: 'Select a template structure:',
              options: availableTemplates.map((template: any) => ({
                id: template.id,
                label: template.name,
                description: template.description
              })),
              originalIntent: 'create_structure',
              originalPayload: {
                format: effectiveFormat,
                prompt: request.message,
                userKeyId: request.userKeyId
              },
              message: `I'd be happy to help you create a ${effectiveFormat}! What structure would you like?`
            }
          }
        ]
      } else {
        console.log('⚠️ [STEP 1.5] No available templates for format:', request.documentFormat)
        // Format has no templates → proceed without template selection
        // This is expected for formats that don't require template selection
      }
    } else {
      console.log('⏭️ [STEP 1.5] Skipping template selection:', {
        reason: selectedTemplate ? 'Template already selected' : 'No document format',
        selectedTemplate,
        documentFormat: request.documentFormat
      })
      // Template already selected (from explicit keywords or clarification) → proceed to structure generation
    }
    
    // ============================================================
    // STEP 2: Format validation (moved to intent system)
    // ============================================================
    // 
    // At this point, we have one of three scenarios:
    // 1. selectedTemplate exists → Proceed with structure generation using the template
    // 2. selectedTemplate is undefined AND format has no templates → Proceed without template
    // 3. selectedTemplate is undefined AND format has templates → Already returned request_clarification above
    // 
    // The rest of this function handles structure generation for scenarios 1 and 2.
    
    // NOTE: Format validation is now handled by the intent system's validation rules
    // (see frontend/src/lib/orchestrator/context/intent/stages/4-validation/rules.ts)
    // The intent system will detect format mismatches and ask for clarification if needed.
    // No need to validate here - the intent analysis already did it.
    
    console.log('✅ [Format Validation] Format validation handled by intent system:', {
      format: request.documentFormat,
      message: request.message
    })
    
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
        node.data?.format
        // Note: Don't require items.length > 0 - even empty documents should trigger clarification
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
      
      // Use centralized format label helper
      const formatLabel = getFormatLabel(request.documentFormat)
      
      // Return request_clarification action with structured options
      return [
        {
          type: 'request_clarification',
          status: 'pending',
          payload: {
            question: `I noticed you already have ${existingDocs.length} document${existingDocs.length > 1 ? 's' : ''} on your canvas`,
            context: docsList,
            options: [
              {
                id: 'create_new',
                label: `Create a new ${formatLabel}`,
                description: 'Separate document'
              },
              {
                id: 'use_existing',
                label: 'Add content to existing document',
                description: 'Open one of your current documents'
              },
              {
                id: 'something_else',
                label: 'Something else',
                description: 'Tell me what you need'
              }
            ],
            originalIntent: 'create_structure',
            originalPayload: {
              format: request.documentFormat,
              userMessage: request.message
            }
          }
        } as OrchestratorAction
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
    
    // ✅ CRITICAL: Include ALL required fields in payload
    // UI handler (OrchestratorPanel.tsx) expects: plan, format, prompt, userKeyId
    actions.push({
      type: 'generate_structure',
      payload: {
        plan: structurePlan,       // ✅ Structure plan with sections
        format: request.documentFormat,  // ✅ Document format (podcast, novel, etc.)
        prompt: request.message,   // ✅ User's original prompt
        userKeyId: request.userKeyId // ✅ User's API key (for future use)
      },
      status: 'pending'
    })
    
    blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Created ${request.documentFormat} structure with ${structurePlan.structure.length} sections`,
      type: 'result'
    })
    
    // ============================================================
    // STEP 6: Analyze task complexity and check for auto-generation
    // ============================================================
    
    // Check if user wants to auto-generate specific sections (e.g., "write act1 & 2")
    // Parse from targetSegment or message for multiple sections
    const targetSegment = intent.extractedEntities?.targetSegment
    const userMessage = request.message.toLowerCase()
    
    // Parse targetSegment for multiple sections (e.g., "act1 & 2" or "act 1 and act 2")
    let sectionsToGenerate: string[] = []
    if (targetSegment) {
      // Try to parse "act1 & 2" or "act 1 and act 2" patterns
      const andPattern = /(?:and|&)\s*(act|chapter|scene|episode|section)\s*(\d+)/i
      const match = targetSegment.match(andPattern)
      if (match) {
        const firstSection = targetSegment.split(/\s*(?:and|&)\s*/i)[0]?.trim()
        const secondSection = `${match[1]} ${match[2]}`
        if (firstSection) sectionsToGenerate.push(firstSection)
        sectionsToGenerate.push(secondSection)
      } else {
        sectionsToGenerate.push(targetSegment)
      }
    } else if (userMessage.includes('write') && (userMessage.includes('act') || userMessage.includes('chapter'))) {
      // Fallback: Parse from message directly (e.g., "write act1 & 2")
      const actPattern = /(?:write|write out)\s+(act|chapter|scene|episode|section)\s*(\d+)(?:\s*(?:and|&)\s*(act|chapter|scene|episode|section)\s*(\d+))?/i
      const messageMatch = userMessage.match(actPattern)
      if (messageMatch) {
        sectionsToGenerate.push(`${messageMatch[1]} ${messageMatch[2]}`)
        if (messageMatch[3] && messageMatch[4]) {
          sectionsToGenerate.push(`${messageMatch[3]} ${messageMatch[4]}`)
        }
      }
    }
    
    const taskAnalysis = {
      isMultiStep: sectionsToGenerate.length > 0,
      targetSections: [] as Array<{id: string, name: string}>,
      complexity: sectionsToGenerate.length > 0 ? 'moderate' : 'simple',
      reasoning: sectionsToGenerate.length > 0 
        ? `User wants to generate content for: ${sectionsToGenerate.join(', ')}`
        : 'Simple structure-only task'
    }

    console.log('🔍 [Task Analysis]', {
      ...taskAnalysis,
      targetSegment,
      sectionsToGenerate,
      userMessage
    })
    
    // ============================================================
    // STEP 7: Add content generation actions if multi-step
    // ============================================================
    
    if (taskAnalysis.isMultiStep && sectionsToGenerate.length > 0 && structurePlan?.structure) {
      // Find matching sections in the generated structure
      const structureItems = structurePlan.structure as Array<{id: string, name: string, level: number}>
      
      for (const sectionRef of sectionsToGenerate) {
        // Try to find matching section by name (fuzzy match)
        const normalizedRef = sectionRef.toLowerCase().trim()
        const matchingSection = structureItems.find(item => {
          const normalizedName = item.name.toLowerCase()
          // Check if section name contains the reference (e.g., "Act 1" matches "act1")
          return normalizedName.includes(normalizedRef) || 
                 normalizedRef.includes(normalizedName) ||
                 normalizedName.replace(/\s+/g, '').includes(normalizedRef.replace(/\s+/g, ''))
        })
        
        if (matchingSection) {
          taskAnalysis.targetSections.push({
            id: matchingSection.id,
            name: matchingSection.name
          })
        } else {
          console.warn(`⚠️ [CreateStructureAction] Could not find section matching "${sectionRef}" in structure`)
        }
      }
    }
    
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

