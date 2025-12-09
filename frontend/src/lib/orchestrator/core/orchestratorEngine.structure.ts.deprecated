/**
 * OrchestratorEngine Structure Generation
 * 
 * Handles structure plan generation for create_structure intent.
 * 
 * Architecture:
 * - These are helper functions that take dependencies as parameters
 * - The main OrchestratorEngine class wraps these with protected methods
 * - This separation allows for better testing and organization
 * 
 * Key Features:
 * - Model fallback with automatic retry logic
 * - Structured output support (OpenAI, Anthropic, Google)
 * - JSON parsing fallback for models without structured output
 * - Zod validation for structure plans
 * - Progress tracking and heartbeat messages
 */

import type { Blackboard } from './blackboard'
import type { StructurePlan } from './orchestratorEngine.types'
import type { TieredModel } from './modelRouter'
import { MODEL_TIERS } from './modelRouter'
import { extractErrorReason } from '../utils/errorUtils'
import { getFormatInstructions } from '../schemas/formatInstructions'
import { getStructureGenerationPrompt, getReportWarning } from '../prompts/structureGeneration'
import { STRUCTURE_GENERATION_CONFIG } from './orchestratorEngine.constants'

/**
 * Filter and prioritize models for structure generation
 * Returns sorted list of models with structured output support
 */
export function filterAndPrioritizeStructureModels(
  availableModels: TieredModel[],
  primaryModelId: string
): TieredModel[] {
  // Filter for structured output support (not just reasoning models)
  // Structure generation needs models with structured output, not necessarily reasoning
  const structuredOutputModels = availableModels
    .filter(m => {
      // Include models with full or json-mode structured output support
      const hasStructuredOutput = m.structuredOutput === 'full' || m.structuredOutput === 'json-mode'
      
      // ✅ DEBUG: Log why models are included/excluded
      if (!hasStructuredOutput) {
        console.log(`⏭️ [Structure Gen] Excluding ${m.id}: structuredOutput=${m.structuredOutput} (needs 'full' or 'json-mode')`)
      } else {
        console.log(`✅ [Structure Gen] Including ${m.id}: structuredOutput=${m.structuredOutput}`)
      }
      
      return hasStructuredOutput
    })
    .sort((a, b) => {
      // ✅ DYNAMIC: Use metadata to prioritize instead of hardcoded values
      
      // 0. Priority: Boost primaryModelId if it's available (user preference)
      const isAPrimary = a.id === primaryModelId
      const isBPrimary = b.id === primaryModelId
      if (isAPrimary && !isBPrimary) return -1
      if (!isAPrimary && isBPrimary) return 1
      
      // 1. Priority: Structured output support (full > json-mode > none)
      const structuredOutputPriority: Record<string, number> = {
        'full': 100,
        'json-mode': 50,
        'none': 0
      }
      const aStructured = structuredOutputPriority[a.structuredOutput] || 0
      const bStructured = structuredOutputPriority[b.structuredOutput] || 0
      if (aStructured !== bStructured) return bStructured - aStructured
      
      // 2. Priority: Actual speed from metadata (if available)
      const enrichedA = a as any
      const enrichedB = b as any
      const aSpeedTokens = enrichedA.speed_tokens_per_sec
      const bSpeedTokens = enrichedB.speed_tokens_per_sec
      
      if (aSpeedTokens && bSpeedTokens) {
        // Both have actual speed data - use it directly
        if (aSpeedTokens !== bSpeedTokens) return bSpeedTokens - aSpeedTokens
      } else if (aSpeedTokens && !bSpeedTokens) {
        // A has speed data, B doesn't - prefer A
        return -1
      } else if (!aSpeedTokens && bSpeedTokens) {
        // B has speed data, A doesn't - prefer B
        return 1
      } else {
        // Neither has speed data - fallback to categorical speed
        const speedPriority: Record<string, number> = {
          'instant': 100,
          'fast': 80,
          'medium': 50,
          'slow': 20
        }
        const aSpeed = speedPriority[a.speed] || 0
        const bSpeed = speedPriority[b.speed] || 0
        if (aSpeed !== bSpeed) return bSpeed - aSpeed
      }
      
      // 3. Priority: Tier (frontier > premium > standard > fast)
      const tierOrder: Record<string, number> = { 
        frontier: 4, 
        premium: 3, 
        standard: 2, 
        fast: 1 
      }
      const aTier = tierOrder[a.tier] || 0
      const bTier = tierOrder[b.tier] || 0
      if (aTier !== bTier) return bTier - aTier
      
      // 4. Priority: Cost (cheaper is better for structure generation)
      // Use actual cost from metadata if available
      const aCost = enrichedA.cost_per_1k_tokens_input
      const bCost = enrichedB.cost_per_1k_tokens_input
      
      if (aCost && bCost) {
        // Both have actual cost - prefer cheaper
        if (aCost !== bCost) return aCost - bCost
      } else {
        // Fallback to categorical cost
        const costPriority: Record<string, number> = {
          'cheap': 1,
          'moderate': 2,
          'expensive': 3
        }
        const aCostCat = costPriority[a.cost] || 2
        const bCostCat = costPriority[b.cost] || 2
        if (aCostCat !== bCostCat) return aCostCat - bCostCat
      }
      
      // 5. Final tiebreaker: Model ID (alphabetical for consistency)
      return a.id.localeCompare(b.id)
    })
  
  return structuredOutputModels
}

/**
 * Create structure plan with fallback retry logic
 * Attempts to generate structure with primary model, falls back to alternatives if it fails
 */
export async function createStructurePlanWithFallbackHelper(
  userPrompt: string,
  format: string,
  primaryModelId: string,
  userKeyId: string,
  availableModels: TieredModel[],
  blackboard: Blackboard,
  createStructurePlan: (
    userPrompt: string,
    format: string,
    modelId: string,
    userKeyId: string
  ) => Promise<StructurePlan>,
  maxRetries: number = STRUCTURE_GENERATION_CONFIG.MAX_RETRIES
): Promise<StructurePlan> {
  const attemptedModels: string[] = []
  let lastError: Error | null = null
  
  // ✅ DEBUG: Log what models we received BEFORE filtering
  console.log(`🔍 [createStructurePlanWithFallback] DEBUG START:`, {
    primaryModelId,
    availableModelsCount: availableModels?.length || 0,
    availableModels: availableModels?.map(m => ({
      id: m.id,
      provider: m.provider,
      reasoning: m.reasoning,
      structuredOutput: m.structuredOutput,
      tier: m.tier,
      // Check enriched fields
      enrichedReasoning: (m as any).supports_reasoning,
      enrichedStructuredOutput: (m as any).supports_structured_output
    })) || []
  })
  
  // Filter and prioritize models
  const structuredOutputModels = filterAndPrioritizeStructureModels(availableModels, primaryModelId)
  
  // ✅ FIX: Only use primaryModelId if it's actually available to the user!
  const isPrimaryAvailable = structuredOutputModels.some(m => m.id === primaryModelId)
  
  // ✅ Models are already sorted by metadata-based priority above
  // Build final list: primaryModelId first (if available), then others by metadata priority
  const modelList = structuredOutputModels.map(m => m.id)
  
  // Remove duplicates while preserving order
  const modelsToTry = [...new Set(modelList)]
  
  // ✅ DEBUG: Log what models passed the filter
  console.log(`🔍 [createStructurePlanWithFallback] After filter:`, {
    structuredOutputModelsCount: structuredOutputModels.length,
    structuredOutputModels: structuredOutputModels.map(m => ({
      id: m.id,
      structuredOutput: m.structuredOutput,
      reasoning: m.reasoning
    }))
  })
  
  console.log(`🎯 [Model Selection] Primary model: ${primaryModelId} (available: ${isPrimaryAvailable})`)
  console.log(`🔄 [Fallback] Primary model: ${primaryModelId} (available: ${isPrimaryAvailable})`)
  console.log(`🔄 [Fallback] Models to try: ${modelsToTry.join(', ')}`)
  console.log(`🔄 [Fallback] Structured output models available: ${structuredOutputModels.length}, Total available models: ${availableModels.length}`)
  
  // ✅ DEBUG: Log prioritization details for first few models
  if (structuredOutputModels.length > 0) {
    console.log(`🔍 [Fallback] Top 3 prioritized models:`, structuredOutputModels.slice(0, 3).map(m => {
      const enriched = m as any
      return {
        id: m.id,
        structuredOutput: m.structuredOutput,
        speed_tokens_per_sec: enriched.speed_tokens_per_sec || 'N/A',
        cost_per_1k: enriched.cost_per_1k_tokens_input || 'N/A',
        tier: m.tier,
        speed: m.speed
      }
    }))
  }
  
  // ✅ CRITICAL: Check if we have any models to try
  if (modelsToTry.length === 0) {
    // ✅ FIX: More accurate error message
    const errorMsg = structuredOutputModels.length === 0
      ? `No models with structured output support available. Found ${availableModels?.length || 0} total models, but none support structured outputs (full or json-mode). Please add an API key for a model that supports structured outputs (e.g., GPT-4o, GPT-4.1, Claude Sonnet, or Groq models with JSON mode).`
      : 'No models available for structure generation.'
    
    // ✅ DEBUG: Log detailed breakdown for debugging
    console.error(`❌ [createStructurePlanWithFallback] No models available:`, {
      totalAvailable: availableModels?.length || 0,
      withStructuredOutput: structuredOutputModels.length,
      availableModelDetails: availableModels?.map(m => ({
        id: m.id,
        structuredOutput: m.structuredOutput,
        reasoning: m.reasoning,
        whyExcluded: m.structuredOutput !== 'full' && m.structuredOutput !== 'json-mode' 
          ? `structuredOutput=${m.structuredOutput}` 
          : 'should be included'
      })) || []
    })
    
    blackboard.addMessage({
      role: 'orchestrator',
      content: `❌ ${errorMsg}`,
      type: 'error'
    })
    
    throw new Error(errorMsg)
  }
  
  for (let i = 0; i < Math.min(modelsToTry.length, maxRetries); i++) {
    const modelId = modelsToTry[i]
    attemptedModels.push(modelId)
    
    try {
      // Log which model we're attempting
      blackboard.addMessage({
        role: 'orchestrator',
        content: i === 0 
          ? `🎯 Attempting structure generation with ${modelId}...`
          : `🔄 Retrying with ${modelId} (attempt ${i + 1}/${maxRetries})...`,
        type: 'progress'
      })
      
      const result = await createStructurePlan(userPrompt, format, modelId, userKeyId)
      
      // Success!
      blackboard.addMessage({
        role: 'orchestrator',
        content: i === 0
          ? `✅ Structure generated successfully with ${modelId}`
          : `✅ Structure generation succeeded with ${modelId} after ${i} ${i === 1 ? 'retry' : 'retries'}`,
        type: 'result'
      })
      
      return result
    } catch (error: any) {
      lastError = error
      const errorReason = extractErrorReason(error)
      
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Attempt ${i + 1} failed (${modelId}): ${errorReason}`,
        type: 'warning'
      })
      
      console.warn(`❌ [Fallback] Attempt ${i + 1} failed with ${modelId}:`, errorReason)
      
      // If this was the last attempt, throw
      if (i === Math.min(modelsToTry.length, maxRetries) - 1) {
        blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ All ${attemptedModels.length} model(s) failed. Last error: ${errorReason}`,
          type: 'error'
        })
        throw new Error(`Structure generation failed after ${attemptedModels.length} attempts. Last error: ${errorReason}`)
      }
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Structure generation failed')
}

/**
 * Generate structure plan for create_structure intent
 * Uses native structured outputs when available
 */
export async function createStructurePlanHelper(
  userPrompt: string,
  format: string,
  modelId: string,
  userKeyId: string,
  blackboard: Blackboard
): Promise<StructurePlan> {
  // ✅ CRITICAL DEBUG: Log that we're entering the function
  console.log('🚀🚀🚀 [Structure Generation] createStructurePlanHelper CALLED!', {
    userPrompt: userPrompt.substring(0, 50),
    format,
    modelId,
    hasBlackboard: !!blackboard
  })
  
  // ✅ CRITICAL: Define startTime BEFORE any async operations
  // This ensures the heartbeat interval can access it correctly
  const startTime = Date.now()
  
  // Progress steps for structured display (can be updated dynamically)
  const progressSteps = [
    'Initializing structure generation',
    'Preparing format and validation',
    'Calling AI model',
    'Validating structure plan'
  ]
  
  console.log('🚀 [Structure Generation] Starting with progress steps:', progressSteps)
  
  // Helper function to send structured progress messages
  // Optionally accepts custom step description to include dynamic information (e.g., model name)
  const sendProgressMessage = (currentStep: number, customStepDescription?: string) => {
    // Update the step description if custom description provided
    const displaySteps = [...progressSteps]
    if (customStepDescription !== undefined && currentStep < displaySteps.length) {
      displaySteps[currentStep] = customStepDescription
    }
    
    const structuredContent = {
      type: 'progress_list',
      items: displaySteps,
      currentStep: currentStep,
      elapsedSeconds: Math.floor((Date.now() - startTime) / 1000)
    }
    
    // ✅ CRITICAL DEBUG: Log before adding message
    console.log('📤 [Structure Generation] About to add message with metadata:', {
      currentStep,
      stepName: displaySteps[currentStep],
      structuredContent: structuredContent,
      metadata: {
        structured: true,
        format: 'progress_list'
      }
    })
    
    blackboard.addMessage({
      role: 'orchestrator',
      content: JSON.stringify(structuredContent),
      type: 'progress',
      metadata: {
        structured: true,
        format: 'progress_list'
      }
    })
    
    console.log('✅ [Structure Generation] Message added to blackboard with metadata:', {
      currentStep,
      stepName: displaySteps[currentStep],
      structured: true,
      customDescription: customStepDescription || 'default',
      messageContent: JSON.stringify(structuredContent).substring(0, 100)
    })
  }
  
  // Step 0: Initializing structure generation (structured content)
  sendProgressMessage(0)
  
  // Check if model supports structured outputs
  const model = MODEL_TIERS.find(m => m.id === modelId)
  const useStructuredOutput = model?.structuredOutput === 'full'
  
  // Step 1: Preparing format and validation (structured content)
  // Include dynamic info about structured output support
  const formatDescription = `Preparing ${useStructuredOutput ? 'structured output' : 'JSON parsing'} format`
  sendProgressMessage(1, formatDescription)
  
  // Import schema utilities
  const { getOpenAIResponseFormat, getAnthropicToolDefinition, validateStructurePlan } = await import('../schemas/structurePlan')
  
  // Build format-specific instructions and system prompt
  const formatInstructions = getFormatInstructions(format)
  const reportWarning = getReportWarning(format)
  const systemPrompt = getStructureGenerationPrompt(formatInstructions, reportWarning)

  const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/-/g, ' ')
  const userMessage = `The user wants to create a ${formatLabel}.\n\nUser's creative prompt:\n${userPrompt}\n\nIMPORTANT: You MUST analyze the user's creative prompt and create a structure plan where EVERY scene/section description directly relates to and incorporates their specific theme/topic. Do NOT use generic template descriptions. Make each scene description specific to the user's request about "${userPrompt.replace(/create a screenplay about/i, '').trim()}".`
  
  // Call generation API with structured output if supported
  const requestBody: any = {
    mode: 'orchestrator',
    model: modelId,
    system_prompt: systemPrompt,
    user_prompt: userMessage,
    max_completion_tokens: STRUCTURE_GENERATION_CONFIG.MAX_COMPLETION_TOKENS,
    user_key_id: userKeyId,
    stream: false
  }
  
  // Add structured output format based on provider
  if (useStructuredOutput && model) {
    if (model.provider === 'openai') {
      requestBody.response_format = getOpenAIResponseFormat()
      blackboard.addMessage({
        role: 'orchestrator',
        content: '✅ Using OpenAI native JSON schema validation',
        type: 'thinking'
      })
    } else if (model.provider === 'anthropic') {
      requestBody.tools = [getAnthropicToolDefinition()]
      requestBody.tool_choice = { type: 'tool', name: 'create_structure_plan' }
      blackboard.addMessage({
        role: 'orchestrator',
        content: '✅ Using Anthropic tool use (forced)',
        type: 'thinking'
      })
    } else if (model.provider === 'google') {
      // Google function calling will be handled in the API route
      requestBody.use_function_calling = true
      blackboard.addMessage({
        role: 'orchestrator',
        content: '✅ Using Google function calling',
        type: 'thinking'
      })
    }
  } else if (model?.structuredOutput === 'json-mode') {
    requestBody.response_format = { type: 'json_object' }
    blackboard.addMessage({
      role: 'orchestrator',
      content: '⚠️ Using JSON mode (no schema validation)',
      type: 'thinking'
    })
  }
  
  // Add timeout and progress heartbeat for long-running API calls
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    console.error(`⏰ [Structure Generation] Request timed out after ${STRUCTURE_GENERATION_CONFIG.TIMEOUT_MS / 1000}s`)
    controller.abort()
  }, STRUCTURE_GENERATION_CONFIG.TIMEOUT_MS)
  
  // Heartbeat: Update structured progress list every 5 seconds
  // Rotates through progress steps to show activity during long-running API calls
  const heartbeat = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000)
    const currentStep = Math.min(
      Math.floor(elapsedSeconds / 2), // Rotate step every 2 seconds
      progressSteps.length - 1
    )
    
    // Use the same helper function to send structured progress updates
    sendProgressMessage(currentStep)
    
    console.log('💓 [Structure Generation] Heartbeat - Updated progress:', {
      currentStep,
      stepName: progressSteps[currentStep],
      elapsedSeconds
    })
  }, STRUCTURE_GENERATION_CONFIG.HEARTBEAT_INTERVAL_MS)
  
  console.log('🚀 [Structure Generation] Starting API call...', {
    endpoint: '/api/generate',
    model: modelId,
    useStructuredOutput,
    hasResponseFormat: !!requestBody.response_format,
    hasTools: !!requestBody.tools
  })
  
  // Step 2: Calling AI model (structured content)
  // Include dynamic model name in the step description
  const modelDescription = `Calling ${model?.displayName || modelId}...`
  sendProgressMessage(2, modelDescription)
  
  let response: Response
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })
    
    clearTimeout(timeout)
    clearInterval(heartbeat)
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorData.message || errorMessage
        
        // Preserve detailed error information
        if (errorData.details) {
          errorMessage += ` (${errorData.details})`
        }
      } catch (parseError) {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text()
          if (errorText) errorMessage = errorText.substring(0, 200)
        } catch {
          // Use default error message
        }
      }
      
      console.error('❌ [Structure Generation] API error:', {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        modelId
      })
      
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Structure generation failed: ${errorMessage}`,
        type: 'error'
      })
      throw new Error(errorMessage)
    }
  } catch (error: any) {
    clearTimeout(timeout)
    clearInterval(heartbeat)
    
    console.error('❌ [Structure Generation] API call failed:', {
      errorName: error.name,
      errorMessage: error.message,
      isAbortError: error.name === 'AbortError',
      fullError: error
    })
    
    if (error.name === 'AbortError') {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Structure generation timed out after ${STRUCTURE_GENERATION_CONFIG.TIMEOUT_MS / 1000} seconds`,
        type: 'error'
      })
      throw new Error('Structure generation timed out - trying next model')
    }
    
    // Preserve the original error message
    const errorMessage = error.message || error.toString() || 'Unknown error'
    
    // Add more context to the error
    blackboard.addMessage({
      role: 'orchestrator',
      content: `❌ Structure generation error: ${errorMessage}`,
      type: 'error'
    })
    
    // Preserve the original error with its message
    const enhancedError = new Error(errorMessage)
    enhancedError.name = error.name || 'StructureGenerationError'
    if (error.stack) enhancedError.stack = error.stack
    throw enhancedError
  }
  
  // Step 3: Validating structure plan (structured content)
  sendProgressMessage(3)
  
  const data = await response.json()
  
  // DEBUG: Log to console what we actually received
  console.log('🔍 [Structure Generation] API Response:', {
    keys: Object.keys(data),
    fullData: data, // Show everything
    hasContent: !!data.content,
    hasStructuredOutput: !!data.structured_output,
    contentType: typeof data.content,
    contentPreview: typeof data.content === 'string' ? data.content.substring(0, 200) : data.content
  })
  
  let planData: any
  
  // Log what we received for debugging
  blackboard.addMessage({
    role: 'orchestrator',
    content: `📦 Received response with keys: ${Object.keys(data).join(', ')}`,
    type: 'thinking'
  })
  
  // Handle different response formats
  if (useStructuredOutput) {
    // Structured output - response is already parsed JSON object
    if (model?.provider === 'anthropic' && data.tool_calls) {
      // Anthropic tool use format
      planData = data.tool_calls[0]?.input
      blackboard.addMessage({
        role: 'orchestrator',
        content: '✅ Extracted from Anthropic tool use',
        type: 'thinking'
      })
    } else if (data.structured_output) {
      // Unified structured output format
      planData = data.structured_output
      blackboard.addMessage({
        role: 'orchestrator',
        content: '✅ Received validated structured output',
        type: 'thinking'
      })
    } else if (typeof data.content === 'string') {
      // OpenAI returns JSON as string in content field
      try {
        planData = JSON.parse(data.content)
        blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Parsed JSON from content string',
          type: 'thinking'
        })
      } catch (e) {
        blackboard.addMessage({
          role: 'orchestrator',
          content: `⚠️ Failed to parse content as JSON: ${e}`,
          type: 'thinking'
        })
        planData = data.content
      }
    } else if (typeof data.content === 'object') {
      // Content is already an object
      planData = data.content
      blackboard.addMessage({
        role: 'orchestrator',
        content: '✅ Using content object directly',
        type: 'thinking'
      })
    } else {
      // Last resort fallback
      planData = data
      blackboard.addMessage({
        role: 'orchestrator',
        content: '⚠️ Using entire response as planData',
        type: 'thinking'
      })
    }
  } else {
    // String-based JSON - need to parse manually
    let rawContent = data.content || data.text || ''
    
    blackboard.addMessage({
      role: 'orchestrator',
      content: `📊 Received ${rawContent.length} characters, parsing...`,
      type: 'thinking'
    })
    
    // Extract JSON from markdown code blocks if present
    let jsonContent = rawContent.trim()
    
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim()
    }
    
    // Remove any leading/trailing non-JSON content
    const jsonStart = jsonContent.indexOf('{')
    const jsonEnd = jsonContent.lastIndexOf('}')
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd + 1)
    }
    
    try {
      planData = JSON.parse(jsonContent)
    } catch (parseError: any) {
      blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ JSON parse error: ${parseError.message}`,
        type: 'error'
      })
      blackboard.addMessage({
        role: 'orchestrator',
        content: `First 500 chars: ${rawContent.substring(0, 500)}`,
        type: 'thinking'
      })
      blackboard.addMessage({
        role: 'orchestrator',
        content: `Last 500 chars: ${rawContent.substring(Math.max(0, rawContent.length - 500))}`,
        type: 'thinking'
      })
      throw new Error(`Failed to parse JSON: ${parseError.message}`)
    }
  }
  
  // Validate with Zod schema
  const validation = validateStructurePlan(planData)
  
  if (!validation.success) {
    blackboard.addMessage({
      role: 'orchestrator',
      content: `❌ Validation failed: ${validation.error}`,
      type: 'error'
    })
    throw new Error(`Invalid structure plan: ${validation.error}`)
  }
  
  const plan = validation.data
  
  blackboard.addMessage({
    role: 'orchestrator',
    content: `✅ Structure plan validated: ${plan.structure.length} sections, ${plan.tasks.length} tasks`,
    type: 'result'
  })
  
  return plan
}

