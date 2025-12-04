/**
 * OrchestratorEngine Clarification Handling
 * 
 * Handles user responses to clarification requests (request_clarification actions).
 * 
 * Architecture:
 * - These are helper functions that take dependencies as parameters
 * - The main OrchestratorEngine class wraps these with protected methods
 * - This separation allows for better testing and organization
 * 
 * Key Features:
 * - Direct pattern matching (exact label, number, partial match) for fast responses
 * - LLM fallback for natural language interpretation
 * - Multiple fallback strategies for robust option matching
 * - Action building based on original action type
 */

import type { Blackboard } from './blackboard'
import type { OrchestratorRequest, OrchestratorResponse, OrchestratorAction } from './orchestratorEngine.types'
import type { TieredModel, ModelSelection } from './modelRouter'
import { selectModel, MODEL_TIERS } from './modelRouter'
import { filterAvailableModels } from '../utils/modelFilter'
import { buildCanvasContext } from '../context/contextProvider'
import type { BaseAction } from '../actions/base/BaseAction'

/**
 * Find clarification match using direct pattern matching strategies
 * Returns matched option or null if no direct match found
 */
export function findClarificationMatch(
  message: string,
  options: Array<{ id: string; label: string; description: string }>
): { id: string; label: string; description: string } | null {
  const normalizedMessage = message.toLowerCase().trim()
  
  // Strategy 1: Exact label match (e.g., "TV Pilot" -> "TV Pilot")
  let directMatch = options.find(opt => 
    opt.label.toLowerCase().trim() === normalizedMessage
  )
  
  // Strategy 2: Number match (e.g., "2" -> option at index 1)
  if (!directMatch) {
    const numberMatch = normalizedMessage.match(/^#?(\d+)$/)
    if (numberMatch) {
      const optionIndex = parseInt(numberMatch[1]) - 1
      if (optionIndex >= 0 && optionIndex < options.length) {
        directMatch = options[optionIndex]
        console.log('✅ [Clarification] Direct number match:', {
          number: numberMatch[1],
          matchedOption: directMatch.label,
          matchedId: directMatch.id
        })
      }
    }
  }
  
  // Strategy 3: Partial label match (e.g., "pilot" matches "TV Pilot")
  if (!directMatch) {
    directMatch = options.find(opt => {
      const normalizedLabel = opt.label.toLowerCase().trim()
      return normalizedLabel.includes(normalizedMessage) ||
             normalizedMessage.includes(normalizedLabel) ||
             normalizedLabel.replace(/\s+/g, '') === normalizedMessage.replace(/\s+/g, '')
    })
    if (directMatch) {
      console.log('✅ [Clarification] Direct label match:', {
        userMessage: message,
        matchedOption: directMatch.label,
        matchedId: directMatch.id
      })
    }
  }
  
  return directMatch || null
}

/**
 * Interpret clarification response using LLM
 * Returns the selected option ID or null if interpretation fails
 */
export async function interpretClarificationWithLLM(
  message: string,
  clarificationContext: {
    question: string
    options: Array<{ id: string; label: string; description: string }>
  },
  availableModels: TieredModel[] | undefined,
  availableProviders: string[] | undefined
): Promise<string | null> {
  // Build formatted options list for LLM context
  const optionsList = clarificationContext.options
    .map((opt, idx) => `${idx + 1}. [${opt.id}] ${opt.label} - ${opt.description}`)
    .join('\n')
  
  // System prompt instructs LLM to act as an option selector
  const systemPrompt = `You are an intelligent option selector. Parse the user's natural language response to determine which option they selected from a list.

Available options:
${optionsList}

Return ONLY the option ID (e.g., "use_podcast", "create_new", "use_screenplay") with NO additional text, explanation, or formatting.

Examples:
- User: "#1" or "1" or "first" → Return: ${clarificationContext.options[0]?.id}
- User: "Go with the first option" → Return: ${clarificationContext.options[0]?.id}
- User: "Let's use the podcast" → Return: use_podcast (if that's option 1)
- User: "Create something new" → Return: create_new`

  const userPrompt = `Original question: "${clarificationContext.question}"

User's response: "${message}"

Which option did the user select? Return ONLY the option ID.`

  try {
    // Use model router to select appropriate fast model
    const modelsToUse: TieredModel[] = availableModels && availableModels.length > 0
      ? filterAvailableModels(availableModels)
      : MODEL_TIERS.filter(m => (availableProviders || ['openai', 'groq', 'anthropic', 'google']).includes(m.provider))
    
    const modelSelection = selectModel(
      'simple',
      'speed',
      availableProviders || ['openai', 'groq', 'anthropic', 'google'],
      modelsToUse,
      false
    )
    
    // Use the model router's API endpoint
    const response = await fetch('/api/intent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to interpret clarification: ${response.statusText}`)
    }

    const data = await response.json()
    return data.content.trim()
  } catch (error) {
    console.error('❌ [Clarification] LLM interpretation error:', error)
    return null
  }
}

/**
 * Find fallback match using multiple strategies
 * Used when LLM returns an ID that doesn't match any option
 */
export function findFallbackMatch(
  message: string,
  llmReturnedId: string,
  options: Array<{ id: string; label: string; description: string }>
): { id: string; label: string; description: string } | undefined {
  const lowerMessage = message.toLowerCase().trim()
  const normalizedLlmId = llmReturnedId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  
  // Strategy 1: Match by label
  let fallbackOption = options.find(opt => {
    const normalizedLabel = opt.label.toLowerCase().trim()
    return normalizedLabel === lowerMessage || 
           normalizedLabel.includes(lowerMessage) ||
           lowerMessage.includes(normalizedLabel)
  })
  
  // Strategy 2: Match by ID with normalization
  if (!fallbackOption) {
    fallbackOption = options.find(opt => {
      const normalizedId = opt.id.toLowerCase().replace(/[^a-z0-9-]/g, '')
      const normalizedMessage = lowerMessage.replace(/[^a-z0-9-]/g, '')
      return normalizedId === normalizedMessage ||
             normalizedId === normalizedLlmId ||
             normalizedMessage.includes(normalizedId) ||
             normalizedId.includes(normalizedMessage)
    })
  }
  
  // Strategy 3: Match by number
  if (!fallbackOption) {
    const numberMatch = lowerMessage.match(/^#?(\d+)$/)
    if (numberMatch) {
      const optionIndex = parseInt(numberMatch[1]) - 1
      if (optionIndex >= 0 && optionIndex < options.length) {
        fallbackOption = options[optionIndex]
      }
    }
  }
  
  // Strategy 4: Match LLM returned ID with normalized option IDs
  if (!fallbackOption && normalizedLlmId) {
    fallbackOption = options.find(opt => {
      const normalizedId = opt.id.toLowerCase().replace(/[^a-z0-9-]/g, '')
      return normalizedId === normalizedLlmId
    })
  }
  
  return fallbackOption
}

/**
 * Handle clarification response - main entry point
 * Processes user's clarification response and returns appropriate actions
 */
export async function handleClarificationResponseHelper(
  request: OrchestratorRequest,
  blackboard: Blackboard,
  buildActionFromClarification: (
    originalAction: string,
    selectedOption: { id: string; label: string; description: string },
    payload: any,
    request: OrchestratorRequest
  ) => Promise<OrchestratorResponse>
): Promise<OrchestratorResponse> {
  const { clarificationContext, message, availableModels, availableProviders } = request
  
  if (!clarificationContext) {
    throw new Error('handleClarificationResponse called without clarificationContext')
  }
  
  blackboard.addMessage({
    role: 'orchestrator',
    content: `🔍 Interpreting clarification response...`,
    type: 'thinking'
  })
  
  // Try direct matching first (fast and reliable)
  const directMatch = findClarificationMatch(message, clarificationContext.options)
  
  if (directMatch) {
    console.log('✅ [Clarification] Using direct match, skipping LLM call')
    blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Understood: "${directMatch.label}"`,
      type: 'decision'
    })
    
    const updatedPayload = {
      ...clarificationContext.payload,
      selectedOptionId: directMatch.id
    }
    
    return buildActionFromClarification(
      clarificationContext.originalAction,
      directMatch,
      updatedPayload,
      request
    )
  }
  
  // LLM fallback for natural language interpretation
  const selectedOptionId = await interpretClarificationWithLLM(
    message,
    clarificationContext,
    availableModels,
    availableProviders
  )
  
  if (!selectedOptionId) {
    blackboard.addMessage({
      role: 'orchestrator',
      content: `❌ Error interpreting response`,
      type: 'error'
    })
    
    return {
      intent: 'general_chat',
      confidence: 0.2,
      reasoning: 'Error processing clarification response',
      modelUsed: 'none',
      actions: [],
      canvasChanged: false,
      requiresUserInput: true,
      estimatedCost: 0
    }
  }
  
  // Validate options array exists
  if (!clarificationContext.options || !Array.isArray(clarificationContext.options)) {
    console.error('❌ [Clarification] options is undefined or not an array:', clarificationContext)
    blackboard.addMessage({
      role: 'orchestrator',
      content: `❌ Error: Clarification context is invalid`,
      type: 'error'
    })
    
    return {
      intent: 'general_chat',
      confidence: 0.3,
      reasoning: 'Invalid clarification context',
      modelUsed: 'none',
      actions: [],
      canvasChanged: false,
      requiresUserInput: true,
      estimatedCost: 0
    }
  }
  
  // Find the selected option
  let selectedOption = clarificationContext.options.find(opt => opt.id === selectedOptionId)
  
  // Try fallback matching if direct match failed
  if (!selectedOption) {
    console.log('⚠️ [Clarification] LLM returned ID not found in options, trying fallback matching')
    selectedOption = findFallbackMatch(message, selectedOptionId, clarificationContext.options)
    
    if (!selectedOption) {
      console.error('❌ [Clarification] No match found after all strategies')
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ I didn't understand "${message}". Please choose by number (e.g., "1") or by name.`,
        type: 'error'
      })
      
      return {
        intent: 'general_chat',
        confidence: 0.3,
        reasoning: 'Failed to interpret clarification response',
        modelUsed: 'none',
        actions: [],
        canvasChanged: false,
        requiresUserInput: true,
        estimatedCost: 0
      }
    }
  }
  
  blackboard.addMessage({
    role: 'orchestrator',
    content: `✅ Understood: "${selectedOption.label}"`,
    type: 'decision'
  })
  
  const updatedPayload = {
    ...clarificationContext.payload,
    selectedOptionId: selectedOption.id
  }
  
  return buildActionFromClarification(
    clarificationContext.originalAction,
    selectedOption,
    updatedPayload,
    request
  )
}

/**
 * Build action from clarification selection
 * Creates appropriate action based on original action type and selected option
 */
export async function buildActionFromClarificationHelper(
  originalAction: string,
  selectedOption: { id: string; label: string; description: string },
  payload: any,
  request: OrchestratorRequest,
  blackboard: Blackboard,
  actionGenerators: Map<string, BaseAction>
): Promise<OrchestratorResponse> {
  if (originalAction === 'create_structure') {
    const { documentFormat, userMessage, existingDocs, reportTypeRecommendations, sourceDocumentLabel, sourceDocumentFormat, format, prompt, userKeyId } = payload
    
    // Handle template selection
    const templateIds = [
      'three-act', 'heros-journey', 'freytag', 'save-the-cat', 'blank',
      'classic', 'flash-fiction', 'twist-ending',
      'business', 'research', 'technical',
      'standard', 'detailed',
      'executive', 'analytical',
      'thematic', 'structural',
      'how-to', 'listicle', 'opinion', 'feature',
      'tv-pilot', 'short-film',
      'argumentative', 'narrative', 'compare-contrast',
      'interview', 'co-hosted', 'storytelling'
    ]
    
    if (templateIds.includes(selectedOption.id)) {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Generating ${documentFormat} structure with ${selectedOption.label} template...`,
        type: 'result'
      })
      
      const createStructureAction = actionGenerators.get('create_structure')
      if (!createStructureAction) {
        throw new Error('CreateStructureAction not found in action generators')
      }
      
      const intentWithTemplate = {
        intent: 'create_structure' as const,
        confidence: 0.95,
        reasoning: `User selected ${selectedOption.label} template`,
        suggestedAction: `Generate structure with ${selectedOption.label} template`,
        requiresContext: false,
        suggestedModel: 'orchestrator' as const,
        extractedEntities: {
          suggestedTemplate: selectedOption.id
        }
      }
      
      const canvasContext = buildCanvasContext(
        'context',
        request.canvasNodes || [],
        request.canvasEdges || []
      )
      
      const actions = await createStructureAction.generate(
        intentWithTemplate,
        {
          ...request,
          documentFormat: format || documentFormat,
          message: prompt || userMessage,
          userKeyId: userKeyId,
          clarificationContext: request.clarificationContext ? {
            originalAction: request.clarificationContext.originalAction || 'create_structure',
            question: request.clarificationContext.question || '',
            options: request.clarificationContext.options || [],
            payload: {
              ...request.clarificationContext.payload,
              selectedOptionId: selectedOption.id
            }
          } : undefined
        },
        canvasContext,
        {
          modelSelection: request.fixedModelId ? { modelId: request.fixedModelId, displayName: request.fixedModelId } : undefined,
          availableModels: request.availableModels
        }
      )
      
      return {
        intent: 'create_structure',
        confidence: 0.95,
        reasoning: `Generated structure with ${selectedOption.label} template`,
        modelUsed: 'gpt-4o',
        actions,
        canvasChanged: false,
        requiresUserInput: false,
        estimatedCost: 0.01
      }
    }
    
    // Handle report type selection
    if (reportTypeRecommendations && sourceDocumentLabel) {
      const selectedReportType = reportTypeRecommendations.find((r: any) => r.id === selectedOption.id)
      
      if (selectedReportType) {
        blackboard.addMessage({
          role: 'orchestrator',
          content: `✅ Creating ${selectedReportType.label} based on "${sourceDocumentLabel}"...`,
          type: 'result'
        })
        
        const enhancedPrompt = `Create a ${selectedReportType.label.toLowerCase()} based on "${sourceDocumentLabel}"`
        
        return {
          intent: 'create_structure',
          confidence: 0.95,
          reasoning: `User selected ${selectedReportType.label} for analyzing ${sourceDocumentFormat}`,
          modelUsed: 'none',
          actions: [{
            type: 'message',
            payload: {
              content: `✅ Generating ${selectedReportType.label} structure...`,
              intent: 'create_structure',
              format: selectedReportType.formatKey,
              prompt: enhancedPrompt
            },
            status: 'pending'
          }],
          canvasChanged: false,
          requiresUserInput: false,
          estimatedCost: 0
        }
      }
    }
    
    // Handle create_new option
    if (selectedOption.id === 'create_new') {
      const effectiveFormat = documentFormat || format || request.documentFormat
      
      if (!effectiveFormat) {
        blackboard.addMessage({
          role: 'orchestrator',
          content: `⚠️ Unable to determine document format. Please specify the format.`,
          type: 'error'
        })
        return {
          intent: 'create_structure',
          confidence: 0.5,
          reasoning: 'Format not specified in clarification',
          modelUsed: 'none',
          actions: [],
          canvasChanged: false,
          requiresUserInput: true,
          estimatedCost: 0
        }
      }
      
      blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Creating new ${effectiveFormat} from scratch...`,
        type: 'result'
      })
      
      return {
        intent: 'create_structure',
        confidence: 0.95,
        reasoning: `User chose to create new ${effectiveFormat} from scratch`,
        modelUsed: 'none',
        actions: [{
          type: 'message',
          payload: {
            content: `✅ Creating new ${effectiveFormat} from scratch...`,
            intent: 'create_structure',
            format: effectiveFormat,
            prompt: `${userMessage} from scratch`
          },
          status: 'pending'
        }],
        canvasChanged: false,
        requiresUserInput: false,
        estimatedCost: 0
      }
    }
    
    // Handle use_existing option
    if (selectedOption.id === 'use_existing') {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Opening existing document...`,
        type: 'result'
      })
      
      if (existingDocs && existingDocs.length === 1) {
        const docToOpen = existingDocs[0]
        return {
          intent: 'open_and_write',
          confidence: 0.95,
          reasoning: `User chose to use existing ${docToOpen.format}`,
          modelUsed: 'none',
          actions: [{
            type: 'open_document',
            payload: {
              nodeId: docToOpen.id,
              sectionId: null
            },
            status: 'pending'
          }],
          canvasChanged: false,
          requiresUserInput: false,
          estimatedCost: 0
        }
      } else if (existingDocs && existingDocs.length > 1) {
        return {
          intent: 'open_and_write',
          confidence: 0.95,
          reasoning: 'User wants to use existing document, but multiple exist',
          modelUsed: 'none',
          actions: [{
            type: 'request_clarification',
            payload: {
              question: 'Which document would you like to open?',
              context: existingDocs.map((d: any) => `• ${d.label} (${d.format})`).join('\n'),
              options: existingDocs.map((d: any) => ({
                id: d.id,
                label: d.label,
                description: `${d.format} document`
              })),
              originalIntent: 'open_and_write',
              originalPayload: {}
            },
            status: 'pending'
          }],
          canvasChanged: false,
          requiresUserInput: true,
          estimatedCost: 0
        }
      } else {
        blackboard.addMessage({
          role: 'orchestrator',
          content: `⚠️ No existing documents found. Creating new ${documentFormat} instead...`,
          type: 'error'
        })
        
        return {
          intent: 'create_structure',
          confidence: 0.95,
          reasoning: 'User chose use_existing but no docs found, creating new instead',
          modelUsed: 'none',
          actions: [{
            type: 'message',
            payload: {
              content: `✅ Creating new ${documentFormat}...`,
              intent: 'create_structure',
              format: documentFormat,
              prompt: userMessage
            },
            status: 'pending'
          }],
          canvasChanged: false,
          requiresUserInput: false,
          estimatedCost: 0
        }
      }
    }
    
    // Handle use_<docId> option (base on existing doc)
    const selectedDocId = selectedOption.id.replace('use_', '')
    const selectedDoc = existingDocs?.find((d: any) => d.id === selectedDocId)
    
    if (selectedDoc) {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Creating ${documentFormat} based on "${selectedDoc.name}" (${selectedDoc.format})...`,
        type: 'result'
      })
      
      const enhancedPrompt = `${userMessage} based on ${selectedDoc.name}`
      
      return {
        intent: 'create_structure',
        confidence: 0.95,
        reasoning: `User chose to base ${documentFormat} on ${selectedDoc.format}`,
        modelUsed: 'none',
        actions: [{
          type: 'message',
          payload: {
            content: `✅ Creating ${documentFormat} based on "${selectedDoc.name}"...`,
            intent: 'create_structure',
            format: documentFormat,
            prompt: enhancedPrompt,
            referenceDoc: selectedDocId
          },
          status: 'pending'
        }],
        canvasChanged: false,
        requiresUserInput: false,
        estimatedCost: 0
      }
    }
  } else if (originalAction === 'open_and_write') {
    blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Opening "${selectedOption.label}"...`,
      type: 'result'
    })
    
    return {
      intent: 'open_and_write',
      confidence: 0.95,
      reasoning: `User selected node to open: ${selectedOption.label}`,
      modelUsed: 'none',
      actions: [{
        type: 'open_document',
        payload: {
          nodeId: selectedOption.id,
          sectionId: null
        },
        status: 'pending'
      }],
      canvasChanged: false,
      requiresUserInput: false,
      estimatedCost: 0
    }
  } else if (originalAction === 'delete_node') {
    blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Deleting "${selectedOption.label}"...`,
      type: 'result'
    })
    
    return {
      intent: 'delete_node',
      confidence: 0.95,
      reasoning: `User confirmed deletion of: ${selectedOption.label}`,
      modelUsed: 'none',
      actions: [{
        type: 'delete_node',
        payload: {
          nodeId: selectedOption.id,
          nodeName: selectedOption.label
        },
        status: 'pending'
      }],
      canvasChanged: true,
      requiresUserInput: false,
      estimatedCost: 0
    }
  }
  
  // Fallback
  return {
    intent: 'general_chat',
    confidence: 0.5,
    reasoning: `Unknown original action: ${originalAction}`,
    modelUsed: 'none',
    actions: [],
    canvasChanged: false,
    requiresUserInput: false,
    estimatedCost: 0
  }
}

