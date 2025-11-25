/**
 * Orchestrator Engine - Main Orchestration Logic
 * 
 * Unified orchestration system that:
 * 1. Analyzes user intent (via intentRouter)
 * 2. Resolves context (via contextProvider + blackboard)
 * 3. Selects optimal model (via modelRouter)
 * 4. Executes actions (via capabilities)
 * 5. Learns from patterns (via blackboard)
 * 
 * Inspired by Agentic Flow's swarm coordination and model routing
 * @see https://github.com/ruvnet/agentic-flow
 */

import { Blackboard } from './blackboard'
import { buildCanvasContext, resolveNode, formatCanvasContextForLLM, type CanvasContext } from './contextProvider'
import { 
  selectModel, 
  assessTaskComplexity, 
  selectModelForTask,
  isFrontierModel,
  MODEL_TIERS,
  type ModelPriority, 
  type ModelSelection,
  type TaskRequirements,
  type TieredModel
} from './modelRouter'
import { analyzeIntent, type IntentAnalysis, type UserIntent } from '../intentRouter'
import { enhanceContextWithRAG } from '../ragIntegration'
import { Node, Edge } from 'reactflow'
import { getDocumentHierarchy, DOCUMENT_HIERARCHY } from '@/lib/documentHierarchy'

// ============================================================
// TYPES
// ============================================================

export interface OrchestratorConfig {
  userId: string
  modelPriority?: ModelPriority
  enableRAG?: boolean
  enablePatternLearning?: boolean
  maxConversationDepth?: number
}

export interface OrchestratorRequest {
  message: string
  canvasNodes: Node[]
  canvasEdges: Edge[]
  activeContext?: {
    id: string
    name: string
  }
  isDocumentViewOpen?: boolean
  documentFormat?: string
  structureItems?: any[]
  contentMap?: Record<string, string>
  currentStoryStructureNodeId?: string | null
  // Model selection preferences
  modelMode?: 'automatic' | 'fixed'
  fixedModeStrategy?: 'consistent' | 'loose'
  fixedModelId?: string | null
  // Available providers (from user's API keys)
  availableProviders?: string[]
  // PHASE 1.2: Dynamic model availability
  // Models actually available to the user (from /api/models/available)
  // If provided, orchestrator will use these instead of filtering MODEL_TIERS
  availableModels?: TieredModel[]
  // Structure generation (for create_structure intent)
  userKeyId?: string // API key ID for structure generation
  // Clarification response context (when user is responding to a request_clarification action)
  clarificationContext?: {
    originalAction: string // 'create_structure', 'open_and_write', 'delete_node'
    question: string // The question that was asked
    options: Array<{id: string, label: string, description: string}>
    payload: any // Original action payload (documentFormat, userMessage, existingDocs, etc.)
  }
}

export interface OrchestratorResponse {
  intent: UserIntent
  confidence: number
  reasoning: string
  modelUsed: string
  actions: OrchestratorAction[]
  canvasChanged: boolean
  requiresUserInput: boolean
  estimatedCost: number
  thinkingSteps?: Array<{ content: string; type: string }> // NEW: Detailed thinking from blackboard
}

export interface OrchestratorAction {
  type: 'message' | 'open_document' | 'select_section' | 'generate_content' | 'modify_structure' | 'delete_node' | 'request_clarification' | 'generate_structure'
  payload: any
  status: 'pending' | 'executing' | 'completed' | 'failed'
  error?: string
}

// Structure generation types (for create_structure intent)
export interface StructurePlan {
  reasoning: string
  structure: Array<{
    id: string
    level: number
    name: string
    parentId: string | null
    wordCount: number
    summary: string
  }>
  tasks: Array<{
    id: string
    type: string
    sectionId: string
    description: string
  }>
  metadata?: {
    totalWordCount: number
    estimatedTime: string
    recommendedModels: string[]
  }
}

// ============================================================
// ORCHESTRATOR ENGINE CLASS
// ============================================================

export class OrchestratorEngine {
  private blackboard: Blackboard
  private config: Required<OrchestratorConfig>
  
  constructor(config: OrchestratorConfig) {
    this.blackboard = new Blackboard(config.userId)
    this.config = {
      userId: config.userId,
      modelPriority: config.modelPriority || 'balanced',
      enableRAG: config.enableRAG !== false,
      enablePatternLearning: config.enablePatternLearning !== false,
      maxConversationDepth: config.maxConversationDepth || 50
    }
    
    console.log('🎯 [Orchestrator] Initialized', {
      userId: config.userId,
      priority: this.config.modelPriority,
      rag: this.config.enableRAG,
      learning: this.config.enablePatternLearning
    })
  }
  
  /**
   * Main orchestration method
   */
  async orchestrate(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now()
    
    // NEW: Handle clarification responses (user responding to request_clarification)
    if (request.clarificationContext) {
      return await this.handleClarificationResponse(request)
    }
    
    // Step 1: Update blackboard with current state
    this.blackboard.updateCanvas(request.canvasNodes, request.canvasEdges)
    
    if (request.currentStoryStructureNodeId && request.contentMap) {
      this.blackboard.updateDocument(request.currentStoryStructureNodeId, {
        format: request.documentFormat || 'unknown',
        structureItems: request.structureItems || [],
        contentMap: request.contentMap,
        wordsWritten: Object.values(request.contentMap).reduce(
          (sum, content) => sum + content.split(/\s+/).length,
          0
        )
      })
    }
    
    // Step 2: Add user message to blackboard
    this.blackboard.addMessage({
      role: 'user',
      content: request.message,
      type: 'user'
    })
    
    // Step 3: Build canvas context
    const canvasContext = buildCanvasContext(
      'context',
      request.canvasNodes,
      request.canvasEdges,
      request.currentStoryStructureNodeId && request.contentMap
        ? { [request.currentStoryStructureNodeId]: { contentMap: request.contentMap } }
        : undefined
    )
    
    // Step 4: Check for canvas changes
    const canvasChanged = this.blackboard.hasCanvasChanged(startTime - 5000)
    
    // Step 5: Enhance with RAG if enabled
    let ragContext: any = null
    if (this.config.enableRAG && canvasContext.connectedNodes.length > 0) {
      const conversationHistory = this.blackboard.getRecentMessages(5)
      ragContext = await enhanceContextWithRAG(
        request.message,
        canvasContext,
        undefined,
        conversationHistory.map(m => ({ role: m.role, content: m.content }))
      )
    }
    
    // Step 6: Analyze intent
    const conversationHistory = this.blackboard.getRecentMessages(10)
    const intentAnalysis = await analyzeIntent({
      message: request.message,
      hasActiveSegment: !!request.activeContext,
      activeSegmentName: request.activeContext?.name,
      activeSegmentId: request.activeContext?.id,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role === 'orchestrator' ? 'assistant' : (m.role === 'system' ? 'assistant' : m.role),
        content: m.content,
        timestamp: m.timestamp
      })),
      documentStructure: request.structureItems,
      isDocumentViewOpen: request.isDocumentViewOpen,
      documentFormat: request.documentFormat,
      useLLM: true,
      canvasContext: ragContext?.hasRAG
        ? this.buildRAGEnhancedPrompt(ragContext, canvasContext)
        : formatCanvasContextForLLM(canvasContext)
    })
    
    // Step 7: Record intent in blackboard
    this.blackboard.setIntent(intentAnalysis.intent, intentAnalysis.confidence)
    
    // Step 8: Assess task complexity and select model
    const taskComplexity = assessTaskComplexity(
      intentAnalysis.intent,
      request.message.length + (ragContext?.ragContent?.length || 0),
      intentAnalysis.intent === 'rewrite_with_coherence'
    )
    
    // Use user's available providers (from API keys) or fallback to common ones
    const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
    
    // PHASE 1.2: Determine which models to use
    // If availableModels is provided (from /api/models/available), use those
    // Otherwise fall back to filtering MODEL_TIERS by providers
    const modelsToUse: TieredModel[] = request.availableModels || 
      MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
    
    console.log(`🎯 [Orchestrator] Using ${request.availableModels ? 'dynamic' : 'static'} model list: ${modelsToUse.length} models available`)
    
    // VALIDATE fixedModelId against available models
    let validatedFixedModelId: string | null = null
    if (request.modelMode === 'fixed' && request.fixedModelId) {
      const isValidModel = modelsToUse.some(m => m.id === request.fixedModelId)
      
      if (isValidModel) {
        validatedFixedModelId = request.fixedModelId
        console.log('✅ [Orchestrator] Fixed model is valid:', validatedFixedModelId)
      } else {
        console.warn(`⚠️ [Orchestrator] Configured model "${request.fixedModelId}" not found in available models. Auto-selecting...`)
        
        // Add message to blackboard to inform user
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `⚠️ Configured model "${request.fixedModelId}" is no longer available. Auto-selecting the best model for this task instead.`,
          type: 'decision'
        })
        
        validatedFixedModelId = null
      }
    }
    
    // PHASE 2: Determine if this task requires reasoning
    // Orchestrator's own operations (planning, analysis, coordination) need reasoning
    // Content generation will be delegated to writer models later
    const requiresReasoning = 
      intentAnalysis.intent === 'create_structure' || // Structure planning needs reasoning
      intentAnalysis.intent === 'rewrite_with_coherence' || // Complex editing needs reasoning
      taskComplexity === 'reasoning' || // Complex reasoning tasks
      taskComplexity === 'complex' // Complex orchestration tasks
    
    const modelSelection = selectModel(
      taskComplexity,
      this.config.modelPriority,
      availableProviders,
      modelsToUse, // PHASE 1.2: Pass actual available models
      requiresReasoning // PHASE 2: Require reasoning for orchestrator operations
    )
    
    // Step 9: Log reasoning to blackboard
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🧠 ${intentAnalysis.reasoning}`,
      type: 'thinking',
      metadata: {
        intent: intentAnalysis.intent,
        confidence: intentAnalysis.confidence,
        modelUsed: modelSelection.modelId
      }
    })
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🤖 ${modelSelection.reasoning}`,
      type: 'decision'
    })
    
    // Step 10: Generate actions based on intent
    const actions = await this.generateActions(
      intentAnalysis,
      request,
      canvasContext,
      ragContext,
      modelSelection,
      validatedFixedModelId,
      modelsToUse // PHASE 2: Pass available models for writer delegation
    )
    
    // Step 11: Build response
    // Extract thinking steps from blackboard (last 10 orchestrator messages)
    const recentMessages = this.blackboard.getRecentMessages(10)
    const thinkingSteps = recentMessages
      .filter(m => m.role === 'orchestrator' && (m.type === 'thinking' || m.type === 'decision'))
      .map(m => ({ content: m.content, type: m.type || 'thinking' }))
    
    const response: OrchestratorResponse = {
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      reasoning: intentAnalysis.reasoning,
      modelUsed: modelSelection.modelId,
      actions,
      canvasChanged,
      requiresUserInput: intentAnalysis.needsClarification || false,
      estimatedCost: modelSelection.estimatedCost,
      thinkingSteps // Include detailed thinking from blackboard
    }
    
    // Step 11: Learn pattern if enabled
    if (this.config.enablePatternLearning && intentAnalysis.confidence > 0.8) {
      const pattern = this.extractPattern(request.message, intentAnalysis, canvasContext)
      if (pattern) {
        await this.blackboard.storePattern(
          pattern.pattern,
          pattern.action,
          'intent_detection'
        )
      }
    }
    
    // Step 12: Record action
    this.blackboard.recordAction(intentAnalysis.intent, {
      confidence: intentAnalysis.confidence,
      modelUsed: modelSelection.modelId,
      taskComplexity,
      elapsedMs: Date.now() - startTime
    })
    
    console.log('✅ [Orchestrator] Completed', {
      intent: response.intent,
      confidence: response.confidence,
      model: response.modelUsed,
      cost: response.estimatedCost,
      time: Date.now() - startTime
    })
    
    return response
  }
  
  /**
   * Resolve which node the user is referring to
   */
  async resolveNodeReference(
    message: string,
    canvasContext: CanvasContext
  ): Promise<any> {
    return await resolveNode(message, canvasContext, this.blackboard)
  }
  
  /**
   * Get blackboard state
   */
  getBlackboard(): Blackboard {
    return this.blackboard
  }
  
  /**
   * Create temporal snapshot
   */
  async createSnapshot(): Promise<void> {
    await this.blackboard.createSnapshot()
  }
  
  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.blackboard.reset()
    console.log('🔄 [Orchestrator] Reset')
  }
  
  // ============================================================
  // PRIVATE HELPERS
  // ============================================================
  
  /**
   * Generate actions based on intent
   */
  private async generateActions(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    canvasContext: CanvasContext,
    ragContext: any,
    modelSelection: any,
    validatedFixedModelId: string | null = null,
    availableModels?: TieredModel[] // PHASE 2: Available models for writer delegation
  ): Promise<OrchestratorAction[]> {
    const actions: OrchestratorAction[] = []
    
    switch (intent.intent) {
      case 'answer_question': {
        // Build context-aware prompt with ALL canvas nodes
        let enhancedPrompt = `User Question: ${request.message}\n\n`
        
        if (canvasContext.connectedNodes.length > 0) {
          enhancedPrompt += `Available Context from Canvas:\n`
          
          canvasContext.connectedNodes.forEach(node => {
            enhancedPrompt += `\n--- ${node.label} (${node.nodeType}) ---\n`
            enhancedPrompt += `Summary: ${node.summary}\n`
            
            if (node.detailedContext?.structure) {
              enhancedPrompt += `Structure:\n${node.detailedContext.structure}\n`
            }
            
            // Include content if available
            if (node.detailedContext?.contentMap) {
              const contentEntries = Object.entries(node.detailedContext.contentMap)
              if (contentEntries.length > 0) {
                enhancedPrompt += `\nContent (${contentEntries.length} sections):\n`
                contentEntries.slice(0, 5).forEach(([sectionId, content]: [string, any]) => {
                  if (content && typeof content === 'string' && content.trim()) {
                    const truncated = content.length > 500 
                      ? content.substring(0, 500) + '...' 
                      : content
                    enhancedPrompt += `\n${truncated}\n`
                  }
                })
              }
            }
          })
        }
        
        // Add RAG content if available
        if (ragContext?.hasRAG && ragContext.ragContent) {
          enhancedPrompt += `\n\nAdditional Relevant Content (from semantic search):\n${ragContext.ragContent}`
        }
        
        actions.push({
          type: 'generate_content',
          payload: {
            prompt: enhancedPrompt,
            model: modelSelection.modelId,
            isAnswer: true
          },
          status: 'pending'
        })
        break
      }
      
      case 'write_content': {
        console.log('📝 [generateActions] write_content:', {
          hasActiveContext: !!request.activeContext,
          activeContextId: request.activeContext?.id,
          message: request.message,
          selectedModel: modelSelection.modelId,
          modelMode: request.modelMode,
          fixedModeStrategy: request.fixedModeStrategy,
          hasStructureItems: !!request.structureItems?.length
        })
        
        let targetSectionId = request.activeContext?.id
        
        // If no active context, try to detect section from message
        if (!targetSectionId && request.structureItems && request.structureItems.length > 0) {
          const lowerMessage = request.message.toLowerCase()
          
          // Helper to find section by name (case-insensitive, partial match)
          const findSectionByName = (items: any[], searchTerm: string): any => {
            for (const item of items) {
              if (item.name?.toLowerCase().includes(searchTerm)) {
                return item
              }
              if (item.children) {
                const found = findSectionByName(item.children, searchTerm)
                if (found) return found
              }
            }
            return null
          }
          
          // ✅ NEW: Handle ordinal/positional references (first scene, second act, etc.)
          const ordinalPattern = /(?:start with|write|begin with)?\s*(?:the\s+)?(first|second|third|1st|2nd|3rd|opening|initial)\s+(scene|act|sequence|chapter|section|beat)/i
          const ordinalMatch = request.message.match(ordinalPattern)
          
          if (ordinalMatch) {
            const position = ordinalMatch[1].toLowerCase()
            const type = ordinalMatch[2].toLowerCase()
            
            // Map ordinals to numbers
            const ordinalMap: Record<string, number> = {
              'first': 0, '1st': 0, 'opening': 0, 'initial': 0,
              'second': 1, '2nd': 1,
              'third': 2, '3rd': 2
            }
            
            const targetIndex = ordinalMap[position] ?? 0
            
            // ✅ FIX: StoryStructureItems are a FLAT array (no children field)
            // Search by name pattern - scenes have "SCENE:" prefix, acts have "Act", etc.
            const matchingSections = request.structureItems.filter((item: any) => {
              const itemName = item.name?.toLowerCase() || ''
              
              // Match by type keyword in the name
              if (type === 'scene') {
                // Scenes typically start with "SCENE:" or contain "scene" at word boundary
                return itemName.startsWith('scene:') || /\bscene\b/i.test(item.name || '')
              } else if (type === 'act') {
                // Acts typically start with "Act " or "ACT "
                return /^act\s+/i.test(item.name || '')
              } else if (type === 'sequence') {
                // Sequences typically start with "Sequence " or contain "sequence"
                return /^sequence\s+/i.test(item.name || '') || itemName.includes('sequence')
              } else if (type === 'beat') {
                // Beats contain the word "beat"
                return itemName.includes('beat')
              } else {
                // Generic fallback: just check if name includes the type
                return itemName.includes(type)
              }
            }).sort((a: any, b: any) => a.order - b.order) // Sort by order to ensure first=first
            
            console.log('🔍 [Ordinal Detection] Debug:', {
              searchType: type,
              position,
              targetIndex,
              totalStructureItems: request.structureItems.length,
              matchingSectionsCount: matchingSections.length,
              matchedNames: matchingSections.map((s: any) => s.name).slice(0, 5), // Show first 5
              allItemNames: request.structureItems.map((s: any) => s.name).slice(0, 10) // Show first 10 items
            })
            
            if (matchingSections[targetIndex]) {
              targetSectionId = matchingSections[targetIndex].id
              console.log('🎯 [Ordinal Detection] Found section:', {
                position,
                type,
                targetIndex,
                foundSection: matchingSections[targetIndex].name,
                sectionId: targetSectionId
              })
            } else {
              console.warn('⚠️ [Ordinal Detection] No match found at index', targetIndex, 'for type', type)
            }
          }
          
          // Try to extract section name from message (if ordinal didn't match)
          if (!targetSectionId) {
            // Patterns: "add to X", "write in X", "add text to X", "write X"
            const patterns = [
              /(?:add|write|put|insert).*(?:to|in|into)\s+(?:the\s+)?(.+?)(?:\s+(?:section|part|chapter|scene|act|sequence))?$/i,
              /(?:add|write|put|insert)\s+(?:some\s+)?(?:text|content|words).*?(?:to|in|into)\s+(?:the\s+)?(.+?)$/i,
            ]
            
            let sectionName: string | null = null
            for (const pattern of patterns) {
              const match = request.message.match(pattern)
              if (match && match[1]) {
                sectionName = match[1].trim().toLowerCase()
                break
              }
            }
            
            if (sectionName) {
              const foundSection = findSectionByName(request.structureItems, sectionName)
              if (foundSection) {
                targetSectionId = foundSection.id
                console.log('🎯 [Smart Section Detection] Found section:', {
                  searchTerm: sectionName,
                  foundSection: foundSection.name,
                  sectionId: targetSectionId
                })
              }
            }
          }
        }
        
        if (targetSectionId) {
          // If we detected a section from the message (not already selected), auto-select it first
          if (!request.activeContext?.id || request.activeContext.id !== targetSectionId) {
            actions.push({
              type: 'select_section',
              payload: {
                sectionId: targetSectionId
              },
              status: 'pending'
            })
            console.log('🎯 [Auto-Select] Selecting section:', targetSectionId)
          }
          
          // Determine which model to use based on mode and strategy
          let writerModel: any
          
          if (request.modelMode === 'fixed' && request.fixedModeStrategy === 'consistent' && validatedFixedModelId) {
            // CONSISTENT: Use the fixed model for writing too (expensive but uniform)
            // ONLY if it's a valid model from MODEL_TIERS
            const fixedModel = MODEL_TIERS.find(m => m.id === validatedFixedModelId)
            writerModel = {
              modelId: validatedFixedModelId,
              provider: fixedModel?.provider || modelSelection.provider,
              reasoning: `Fixed mode (Consistent): Using ${fixedModel?.displayName || validatedFixedModelId} for all tasks`
            }
            console.log('🎯 [Consistent Strategy] Using validated fixed model for writing:', writerModel.modelId)
          } else {
            // AUTOMATIC or LOOSE: Intelligently select writer based on scene complexity
            const activeStructureItem = request.structureItems?.find(item => item.id === targetSectionId)
            const sectionLevel = activeStructureItem?.level || 3
            const sectionName = activeStructureItem?.name?.toLowerCase() || ''
            const sectionWordCount = activeStructureItem?.wordCount || 0
            
            // Determine task complexity based on section characteristics
            let taskType: TaskRequirements['type'] = 'simple-scene'
            
            // Level 1 (Acts) or Level 2 (Sequences) = Complex scenes
            if (sectionLevel <= 2) {
              taskType = 'complex-scene'
            }
            // Keywords indicating complexity
            else if (sectionName.includes('climax') || 
                     sectionName.includes('confrontation') ||
                     sectionName.includes('revelation') ||
                     sectionName.includes('finale')) {
              taskType = 'complex-scene'
            }
            // High word count target
            else if (sectionWordCount > 1000) {
              taskType = 'complex-scene'
            }
            // Dialogue-heavy scenes
            else if (sectionName.includes('dialogue') || 
                     sectionName.includes('conversation') ||
                     sectionName.includes('talk')) {
              taskType = 'dialogue'
            }
            // Action scenes
            else if (sectionName.includes('action') || 
                     sectionName.includes('fight') ||
                     sectionName.includes('chase') ||
                     sectionName.includes('battle')) {
              taskType = 'action'
            }
            
            // PHASE 2: Use available models passed from orchestrate() or filter MODEL_TIERS
            const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
            const modelsForWriter = availableModels || MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
            
            // Select best model for this task from AVAILABLE models only
            // Note: selectModelForTask does NOT require reasoning (writer models can be smaller/faster)
            const selectedModel = selectModelForTask(
              {
                type: taskType,
                wordCount: sectionWordCount,
                contextNeeded: 8000, // Typical scene context
                priority: 'balanced' // Balance quality, speed, and cost
              },
              modelsForWriter // Only models user has API keys for!
            )
            
            writerModel = {
              modelId: selectedModel?.id || 'llama-3.3-70b-versatile', // Fallback
              provider: selectedModel?.provider || 'groq',
              reasoning: `Intelligent delegation: ${taskType} task → ${selectedModel?.displayName || 'Llama 3.3 70B'}`
            }
            
            console.log('💡 [Intelligent Delegation]', {
              section: activeStructureItem?.name,
              level: sectionLevel,
              taskType,
              selectedModel: writerModel.modelId,
              reasoning: writerModel.reasoning
            })
          }
          
          actions.push({
            type: 'generate_content',
            payload: {
              sectionId: targetSectionId,
              prompt: request.message,
              model: writerModel.modelId,
              provider: writerModel.provider
            },
            status: 'pending'
          })
          console.log('✅ [generateActions] Created write_content action:', {
            section: targetSectionId,
            model: writerModel.modelId,
            provider: writerModel.provider,
            strategy: request.modelMode === 'fixed' ? request.fixedModeStrategy : 'automatic'
          })
        } else {
          console.warn('⚠️ [generateActions] No section found for write_content! Message:', request.message)
          // Return a helpful message instead of failing silently
          actions.push({
            type: 'message',
            payload: {
              content: `I want to add content, but I need you to select a section first. Which section would you like me to write in?`,
              type: 'result'
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'create_structure': {
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '🏗️ Generating story structure plan...',
          type: 'thinking'
        })
        
        // Validate required fields
        if (!request.documentFormat) {
          throw new Error('documentFormat is required for create_structure intent')
        }
        if (!request.userKeyId) {
          throw new Error('userKeyId is required for create_structure intent')
        }
        
        // ✅ PROACTIVE CANVAS AWARENESS: Check for existing documents
        console.log('🔍 [Canvas Awareness] Raw canvasNodes:', request.canvasNodes?.length || 0)
        
        const existingDocs = (request.canvasNodes || [])
          .filter((node: any) => 
            node.type === 'storyStructureNode' && 
            node.data?.format &&
            node.data?.items?.length > 0
          )
          .map((node: any) => {
            const allDataKeys = Object.keys(node.data || {})
            console.log(`🔍 [Canvas Awareness] Checking node "${node.data?.label}":`)
            console.log(`  type: ${node.type}`)
            console.log(`  dataKeys (${allDataKeys.length}):`, allDataKeys.join(', '))
            console.log(`  itemsCount: ${node.data?.items?.length || 0}`)
            console.log(`  format: ${node.data?.format}`)
            console.log(`  hasContentMapKey: ${allDataKeys.includes('contentMap')}`)
            
            // ✅ FIX: Check BOTH legacy contentMap AND new document_data for content
            const contentMapKeys = Object.keys(node.data?.contentMap || {})
            console.log(`  contentMapKeys (${contentMapKeys.length}):`, contentMapKeys.slice(0, 5).join(', '))
            
            const hasLegacyContent = contentMapKeys.length > 0 && 
              contentMapKeys.some(key => {
                const content = node.data.contentMap[key]
                return content && typeof content === 'string' && content.trim().length > 0
              })
            
            // ✅ FIX: Ensure boolean result (not undefined)
            let hasHierarchicalContent = false
            if (node.data.document_data?.structure && Array.isArray(node.data.document_data.structure)) {
              hasHierarchicalContent = node.data.document_data.structure.some((seg: any) => {
                // Check if segment has content (recursively check children too)
                const hasDirectContent = seg.content && seg.content.length > 0
                const hasChildContent = seg.children && Array.isArray(seg.children) && 
                  seg.children.some((child: any) => child.content && child.content.length > 0)
                return hasDirectContent || hasChildContent
              })
            }
            
            // Debug: Log what we found for this node
            console.log(`🔍 [Canvas Awareness] Content check for "${node.data.label}":`, {
              hasLegacy: hasLegacyContent,
              hasHierarchical: hasHierarchicalContent,
              hasDocData: !!node.data.document_data,
              hasStructure: !!node.data.document_data?.structure,
              structureLength: node.data.document_data?.structure?.length || 0,
              contentMapKeys: contentMapKeys.length,
              contentMapSample: contentMapKeys.length > 0 ? {
                key: contentMapKeys[0],
                hasValue: !!node.data.contentMap[contentMapKeys[0]],
                valueLength: node.data.contentMap[contentMapKeys[0]]?.length || 0
              } : null
            })
            
            return {
              id: node.id,
              name: node.data.label || node.data.name || 'Untitled',
              format: node.data.format,
              hasContent: hasLegacyContent || hasHierarchicalContent // ✅ Now always boolean
            }
          })
        
        // If creating a new document while others exist, offer to base it on existing content
        if (existingDocs.length > 0 && !request.message.toLowerCase().includes('based on') && !request.message.toLowerCase().includes('from scratch')) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `📋 I notice you have ${existingDocs.length} other document(s) on the canvas: ${existingDocs.map(d => `"${d.name}" (${d.format})`).join(', ')}`,
            type: 'thinking'
          })
          
          console.log('🔍 [Canvas Awareness] Existing docs:', existingDocs)
          
          // ✅ SIMPLIFIED: Don't check for content (nodes don't have it loaded)
          // Just ask when creating a DIFFERENT format than what exists
          const differentFormats = existingDocs.filter(d => d.format !== request.documentFormat)
          
          console.log('🔍 [Canvas Awareness] Different format docs:', differentFormats)
          
          if (differentFormats.length > 0) {
            const docNames = differentFormats.map(d => `"${d.name}" (${d.format})`).join(', ')
            
            console.log('✅ [Canvas Awareness] Requesting clarification - different formats exist!')
            
            // Build options: one for each existing format + "create new"
            const options = [
              ...differentFormats.map((doc, idx) => ({
                id: `use_${doc.id}`,
                label: `Base it on ${doc.format}`,
                description: `Use "${doc.name}" as inspiration`
              })),
              { 
                id: 'create_new', 
                label: 'Create something new', 
                description: 'Start from scratch' 
              }
            ]
            
            // Build message with numbered list
            const optionsList = options.map((opt, idx) => `${idx + 1}. ${opt.label} - ${opt.description}`).join('\n')
            
            actions.push({
              type: 'request_clarification',
              payload: {
                originalAction: 'create_structure',
                message: `I see you already have ${differentFormats.map(d => d.format).join(' and ')} on the canvas (${docNames}).\n\nWould you like me to:\n\n${optionsList}\n\nWhat's your preference?`,
                options,
                documentFormat: request.documentFormat,
                userMessage: request.message,
                existingDocs: differentFormats
              },
              status: 'pending'
            })
            
            this.blackboard.addMessage({
              role: 'orchestrator',
              content: '❓ Requesting user clarification before proceeding...',
              type: 'decision'
            })
            
            console.log('🔙 [Canvas Awareness] Returning early with clarification action')
            
            // ✅ CRITICAL: Return early to prevent further action generation
            return actions
          } else {
            console.log('⚠️ [Canvas Awareness] Same format or no conflicts, continuing with generation')
          }
        }
        
        // Import structured output helper
        const { getModelsWithStructuredOutput, supportsStructuredOutput } = await import('./modelRouter')
        
        // PREFER models with full structured output support
        let availableModels = MODEL_TIERS.filter(m => 
          request.availableProviders?.includes(m.provider) && 
          m.tier === 'frontier' &&
          m.structuredOutput === 'full' // Prioritize full structured output
        )
        
        // Fallback: If no frontier models with full support, allow json-mode
        if (availableModels.length === 0) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: '⚠️ No frontier models with full structured output, trying json-mode...',
            type: 'thinking'
          })
          
          availableModels = MODEL_TIERS.filter(m => 
            request.availableProviders?.includes(m.provider) && 
            m.tier === 'frontier' &&
            m.structuredOutput !== 'none'
          )
        }
        
        // Final fallback: Any frontier model
        if (availableModels.length === 0) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: '⚠️ Falling back to any available frontier model',
            type: 'thinking'
          })
          
          availableModels = MODEL_TIERS.filter(m => 
            request.availableProviders?.includes(m.provider) && 
            m.tier === 'frontier'
          )
        }
        
        if (availableModels.length === 0) {
          throw new Error('No frontier models available for structure generation')
        }
        
        const selectedModel = availableModels[0]
        const structuredSupportLabel = selectedModel.structuredOutput === 'full' 
          ? '✅ Full structured output' 
          : selectedModel.structuredOutput === 'json-mode'
          ? '⚠️ JSON mode (basic)'
          : '❌ No structured output'
        
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `🎯 Using ${selectedModel.displayName} (${structuredSupportLabel})`,
          type: 'decision'
        })
        
        // PHASE 3: Generate structure plan with automatic fallback
        // Pass ALL available models (from parameter), not just filtered frontier models
        const allAvailableModels = availableModels || MODEL_TIERS.filter(m => 
          request.availableProviders?.includes(m.provider)
        )
        
        const plan = await this.createStructurePlanWithFallback(
          request.message,
          request.documentFormat,
          selectedModel.id,
          request.userKeyId,
          allAvailableModels, // Pass ALL models for fallback (not just frontier)
          3 // Max retries
        )
        
        // Return as action
        actions.push({
          type: 'generate_structure',
          payload: {
            plan,
            format: request.documentFormat,
            prompt: request.message
          },
          status: 'completed'
        })
        break
      }
      
      case 'open_and_write': {
        // Try to detect the node type from the message
        const lowerMessage = request.message.toLowerCase()
        let targetType: string | null = null
        
        // Extract node type from message
        if (lowerMessage.includes('novel')) targetType = 'novel'
        else if (lowerMessage.includes('screenplay')) targetType = 'screenplay'
        else if (lowerMessage.includes('report')) targetType = 'report'
        else if (lowerMessage.includes('podcast')) targetType = 'podcast'
        
        // Resolve which specific node to open
        const targetNode = await resolveNode(request.message, canvasContext, this.blackboard)
        
        // Search ALL nodes on canvas (not just connected ones)
        let candidateNodes = canvasContext.allNodes
        if (targetType) {
          // For story-structure nodes, check the format field (novel, screenplay, etc.)
          // For other nodes, check the nodeType directly
          candidateNodes = candidateNodes.filter(n => {
            if (n.nodeType === 'story-structure') {
              return n.detailedContext?.format?.toLowerCase() === targetType
            }
            return n.nodeType.toLowerCase() === targetType
          })
        } else if (targetNode) {
          // Fall back to using the resolved node's type
          candidateNodes = candidateNodes.filter(n => n.nodeType.toLowerCase() === targetNode.nodeType.toLowerCase())
        }
        
        console.log('📂 [open_and_write] Search results:', {
          targetType,
          allNodesCount: canvasContext.allNodes.length,
          candidatesCount: candidateNodes.length,
          candidates: candidateNodes.map(n => ({ 
            label: n.label, 
            type: n.nodeType, 
            format: n.detailedContext?.format 
          }))
        })
        
        if (candidateNodes.length === 0) {
          // No matching nodes found
          actions.push({
            type: 'message',
            payload: {
              content: `I couldn't find any ${targetType || 'matching'} nodes. Could you be more specific?`,
              type: 'error'
            },
            status: 'pending'
          })
        } else if (candidateNodes.length === 1) {
          // Single match - proceed with opening
          actions.push({
            type: 'open_document',
            payload: {
              nodeId: candidateNodes[0].nodeId,
              sectionId: null
            },
            status: 'pending'
          })
        } else {
          // Multiple matches - request clarification with options
          const options = candidateNodes.map(n => {
            const wordCount = n.detailedContext?.wordsWritten || 0
            return {
              id: n.nodeId,
              label: n.label,
              description: `${wordCount.toLocaleString()} words`
            }
          })
          
          actions.push({
            type: 'request_clarification',
            payload: {
              message: `🤔 I found ${candidateNodes.length} ${targetType || candidateNodes[0].nodeType} node(s). Which one would you like to open?`,
              originalAction: 'open_and_write',
              options
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'delete_node': {
        // Try to detect the node type from the message
        const lowerMessage = request.message.toLowerCase()
        let targetType: string | null = null
        
        // Extract node type from message
        if (lowerMessage.includes('novel')) targetType = 'novel'
        else if (lowerMessage.includes('screenplay')) targetType = 'screenplay'
        else if (lowerMessage.includes('report')) targetType = 'report'
        else if (lowerMessage.includes('podcast')) targetType = 'podcast'
        
        // Resolve which specific node to delete
        const targetNode = await resolveNode(request.message, canvasContext, this.blackboard)
        
        // Search ALL nodes on canvas (not just connected ones)
        let candidateNodes = canvasContext.allNodes
        if (targetType) {
          // For story-structure nodes, check the format field (novel, screenplay, etc.)
          // For other nodes, check the nodeType directly
          candidateNodes = candidateNodes.filter(n => {
            if (n.nodeType === 'story-structure') {
              return n.detailedContext?.format?.toLowerCase() === targetType
            }
            return n.nodeType.toLowerCase() === targetType
          })
        } else if (targetNode) {
          // Fall back to using the resolved node's type
          candidateNodes = candidateNodes.filter(n => n.nodeType.toLowerCase() === targetNode.nodeType.toLowerCase())
        }
        
        console.log('🗑️ [delete_node] Search results:', {
          targetType,
          allNodesCount: canvasContext.allNodes.length,
          candidatesCount: candidateNodes.length,
          candidates: candidateNodes.map(n => ({ 
            label: n.label, 
            type: n.nodeType, 
            format: n.detailedContext?.format 
          }))
        })
        
        if (candidateNodes.length === 0) {
          // No matching nodes found
          actions.push({
            type: 'message',
            payload: {
              content: `I couldn't find any ${targetType || 'matching'} nodes. Could you be more specific?`,
              type: 'error'
            },
            status: 'pending'
          })
        } else if (candidateNodes.length === 1) {
          // Single match - proceed with deletion
          actions.push({
            type: 'delete_node',
            payload: {
              nodeId: candidateNodes[0].nodeId,
              nodeName: candidateNodes[0].label
            },
            status: 'pending'
          })
        } else {
          // Multiple matches - request clarification with options
          const options = candidateNodes.map(n => {
            const wordCount = n.detailedContext?.wordsWritten || 0
            return {
              id: n.nodeId,
              label: n.label,
              description: `${wordCount.toLocaleString()} words`
            }
          })
          
          actions.push({
            type: 'request_clarification',
            payload: {
              message: `🤔 I found ${candidateNodes.length} ${targetType || candidateNodes[0].nodeType} node(s). Which one would you like to remove?`,
              originalAction: 'delete_node',
              options
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'navigate_section': {
        // User wants to navigate to a section within the current open document
        const lowerMessage = request.message.toLowerCase()
        
        // Extract section identifier (chapter number, section name, etc.)
        let targetSectionId: string | null = null
        let targetSectionName: string | null = null
        
        if (request.structureItems && request.structureItems.length > 0) {
          // Try to match by chapter/section/scene/beat number
          const numberMatch = lowerMessage.match(/(chapter|section|scene|act|part|sequence|beat)\s+(\d+)/i)
          if (numberMatch) {
            const sectionType = numberMatch[1].toLowerCase()
            const sectionNumber = parseInt(numberMatch[2])
            
            console.log('🔍 [navigate_section] Searching for:', { sectionType, sectionNumber })
            
            // Find section by number and type
            const findByNumber = (items: any[], type: string, num: number, count: { value: number }): any => {
              for (const item of items) {
                const itemName = item.name?.toLowerCase() || ''
                // Match by type keyword in name
                if (itemName.includes(type)) {
                  count.value++
                  console.log(`  Checking: "${item.name}" (count: ${count.value}, target: ${num})`)
                  if (count.value === num) {
                    return item
                  }
                }
                if (item.children) {
                  const found = findByNumber(item.children, type, num, count)
                  if (found) return found
                }
              }
              return null
            }
            
            const counter = { value: 0 }
            const foundSection = findByNumber(request.structureItems, sectionType, sectionNumber, counter)
            if (foundSection) {
              targetSectionId = foundSection.id
              targetSectionName = foundSection.name
              console.log('✅ [navigate_section] Found by number:', foundSection.name)
            }
          }
          
          // If number matching failed, try short forms with optional prefix ("scene 1", "go to scene 1", "open beat 2")
          if (!targetSectionId) {
            const shortMatch = lowerMessage.match(/(?:go to |jump to |open |show |navigate to )?(scene|beat|chapter|section)\s+(\d+)/i)
            if (shortMatch) {
              const type = shortMatch[1].toLowerCase()
              const num = parseInt(shortMatch[2])
              
              console.log('🔍 [navigate_section] Short form search:', { type, num })
              
              const findByType = (items: any[]): any => {
                let count = 0
                for (const item of items) {
                  const itemName = item.name?.toLowerCase() || ''
                  if (itemName.includes(type)) {
                    count++
                    console.log(`  Checking: "${item.name}" (count: ${count}, target: ${num})`)
                    if (count === num) return item
                  }
                  if (item.children) {
                    const found = findByType(item.children)
                    if (found) return found
                  }
                }
                return null
              }
              
              const foundSection = findByType(request.structureItems)
              if (foundSection) {
                targetSectionId = foundSection.id
                targetSectionName = foundSection.name
                console.log('✅ [navigate_section] Found by short form:', foundSection.name)
              }
            }
          }
          
          // If number matching failed, try name matching
          if (!targetSectionId) {
            const namePattern = /(chapter|section|scene|act|part|sequence|beat)\s+\d+:?\s*(.+?)$/i
            const nameMatch = lowerMessage.match(namePattern)
            
            if (nameMatch && nameMatch[2]) {
              const searchTerm = nameMatch[2].trim().toLowerCase()
              
              const findByName = (items: any[], term: string): any => {
                for (const item of items) {
                  if (item.name?.toLowerCase().includes(term)) {
                    return item
                  }
                  if (item.children) {
                    const found = findByName(item.children, term)
                    if (found) return found
                  }
                }
                return null
              }
              
              const foundSection = findByName(request.structureItems, searchTerm)
              if (foundSection) {
                targetSectionId = foundSection.id
                targetSectionName = foundSection.name
              }
            }
          }
        }
        
        console.log('🧭 [navigate_section] Search results:', {
          message: request.message,
          targetSectionId,
          targetSectionName,
          hasStructure: !!request.structureItems?.length
        })
        
        if (targetSectionId) {
          // Found the section - navigate to it
          actions.push({
            type: 'select_section',
            payload: {
              sectionId: targetSectionId,
              sectionName: targetSectionName
            },
            status: 'pending'
          })
        } else {
          // Could not find the section
          actions.push({
            type: 'message',
            payload: {
              content: `I couldn't find that section. Could you be more specific about which section you want to navigate to?`,
              type: 'error'
            },
            status: 'pending'
          })
        }
        break
      }
      
      case 'general_chat':
      default: {
        // Similar to answer_question but more conversational
        actions.push({
          type: 'message',
          payload: {
            content: `Let me help you with that...`,
            type: 'thinking'
          },
          status: 'pending'
        })
        break
      }
    }
    
    return actions
  }
  
  private extractPattern(
    message: string,
    intent: IntentAnalysis,
    canvasContext: CanvasContext
  ): { pattern: string; action: string } | null {
    // Extract learnable patterns
    const lowerMessage = message.toLowerCase()
    
    // Pattern: User asks about "the plot" after discussing a specific document
    if (lowerMessage.includes('plot') && canvasContext.connectedNodes.length > 0) {
      const recentNodes = this.blackboard.getRecentlyReferencedNodes()
      if (recentNodes.length > 0) {
        return {
          pattern: 'user asks about "the plot" after discussing a document',
          action: `resolve to recently discussed node: ${recentNodes[0]}`
        }
      }
    }
    
    // Pattern: User says "it" or "this" referring to previous context
    if ((lowerMessage.includes(' it ') || lowerMessage.includes('this ')) && 
        intent.intent === 'answer_question') {
      return {
        pattern: 'user uses pronoun "it" or "this" in question',
        action: 'resolve to most recently discussed node'
      }
    }
    
    // Pattern: User wants to write in existing node
    if (intent.intent === 'open_and_write') {
      return {
        pattern: `user says "${message.substring(0, 30)}..." to write in existing node`,
        action: 'open_and_write intent detected'
      }
    }
    
    return null
  }
  
  private buildRAGEnhancedPrompt(ragContext: any, canvasContext: CanvasContext): string {
    let prompt = formatCanvasContextForLLM(canvasContext)
    
    if (ragContext.hasRAG && ragContext.ragContent) {
      prompt += `\n\nRelevant Content (from semantic search):\n${ragContext.ragContent}`
    }
    
    return prompt
  }

  /**
   * PHASE 3: Retry wrapper for createStructurePlan with automatic fallback
   * Attempts to generate structure with primary model, falls back to alternatives if it fails
   */
  private async createStructurePlanWithFallback(
    userPrompt: string,
    format: string,
    primaryModelId: string,
    userKeyId: string,
    availableModels: TieredModel[],
    maxRetries: number = 3
  ): Promise<StructurePlan> {
    const attemptedModels: string[] = []
    let lastError: Error | null = null
    
    // Filter to reasoning models only (for structure generation)
    const reasoningModels = availableModels
      .filter(m => m.reasoning)
      .sort((a, b) => {
        // Sort by tier: frontier > premium > standard > fast
        const tierOrder: Record<string, number> = { frontier: 4, premium: 3, standard: 2, fast: 1 }
        return (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0)
      })
    
    // Start with primary model
    const modelsToTry = [primaryModelId, ...reasoningModels.map(m => m.id).filter(id => id !== primaryModelId)]
    
    console.log(`🔄 [Fallback] Available reasoning models for retry: ${modelsToTry.join(', ')}`)
    
    for (let i = 0; i < Math.min(modelsToTry.length, maxRetries); i++) {
      const modelId = modelsToTry[i]
      attemptedModels.push(modelId)
      
      try {
        if (i > 0) {
          // This is a retry
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `🔄 Retrying with ${modelId}...`,
            type: 'progress'
          })
        }
        
        const result = await this.createStructurePlan(userPrompt, format, modelId, userKeyId)
        
        if (i > 0) {
          // Success after retry
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `✅ Structure generation succeeded with ${modelId}`,
            type: 'result'
          })
        }
        
        return result
      } catch (error: any) {
        lastError = error
        const errorReason = this.extractErrorReason(error)
        
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `⚠️ ${modelId}: ${errorReason}`,
          type: 'warning'
        })
        
        console.warn(`❌ [Fallback] Attempt ${i + 1} failed with ${modelId}:`, errorReason)
        
        // If this was the last attempt, throw
        if (i === Math.min(modelsToTry.length, maxRetries) - 1) {
          this.blackboard.addMessage({
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
   * PHASE 3: Extract human-readable error reason from API error
   */
  private extractErrorReason(error: any): string {
    const message = error.message || ''
    
    if (message.includes('insufficient_quota') || message.includes('quota')) {
      return 'Insufficient credits'
    }
    if (message.includes('does not exist') || message.includes('not found')) {
      return 'Model not available'
    }
    if (message.includes('rate_limit') || message.includes('429')) {
      return 'Rate limit exceeded'
    }
    if (message.includes('authentication') || message.includes('401')) {
      return 'Invalid API key'
    }
    if (message.includes('access') || message.includes('permission')) {
      return 'No access to this model'
    }
    if (message.includes('500')) {
      return 'Server error (model might not be available)'
    }
    
    return message.substring(0, 100) // Truncate long messages
  }

  /**
   * Generate structure plan for create_structure intent
   * Uses native structured outputs when available
   */
  private async createStructurePlan(
    userPrompt: string,
    format: string,
    modelId: string,
    userKeyId: string
  ): Promise<StructurePlan> {
    // Progress tracking
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: '🔄 Step 1/4: Initializing structure generation...',
      type: 'progress'
    })
    
    // Check if model supports structured outputs
    const model = MODEL_TIERS.find(m => m.id === modelId)
    const useStructuredOutput = model?.structuredOutput === 'full'
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔄 Step 2/4: Preparing ${useStructuredOutput ? '✅ structured output' : '⚠️ JSON parsing'} format...`,
      type: 'progress'
    })
    
    // Import schema utilities
    const { getOpenAIResponseFormat, getAnthropicToolDefinition, validateStructurePlan } = await import('../schemas/structurePlan')
    
    // Build format-specific instructions
    const formatInstructions = this.getFormatInstructions(format)
    
    const systemPrompt = `You are an expert story structure planner. Your role is to analyze creative prompts and create detailed, hierarchical structures optimized for the requested format.

${formatInstructions}

Generate a complete structure plan with:
- Concise reasoning (max 1000 characters)
- 3-20 hierarchical structure items with clear parent-child relationships
- Realistic word count estimates for each section
- Specific writing tasks (minimum 1)
- Metadata with total word count, estimated time, and recommended models (REQUIRED)`

    const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/-/g, ' ')
    const userMessage = `The user wants to create a ${formatLabel}.\n\nUser's creative prompt:\n${userPrompt}\n\nAnalyze this prompt and create a detailed structure plan optimized for the ${formatLabel} format.`
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔄 Step 3/4: Calling ${model?.displayName || modelId}...`,
      type: 'progress'
    })
    
    // Call generation API with structured output if supported
    const requestBody: any = {
      mode: 'orchestrator',
      model: modelId,
      system_prompt: systemPrompt,
      user_prompt: userMessage,
      max_completion_tokens: 4000,
      user_key_id: userKeyId,
      stream: false
    }
    
    // Add structured output format based on provider
    if (useStructuredOutput && model) {
      if (model.provider === 'openai') {
        requestBody.response_format = getOpenAIResponseFormat()
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using OpenAI native JSON schema validation',
          type: 'thinking'
        })
      } else if (model.provider === 'anthropic') {
        requestBody.tools = [getAnthropicToolDefinition()]
        requestBody.tool_choice = { type: 'tool', name: 'create_structure_plan' }
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using Anthropic tool use (forced)',
          type: 'thinking'
        })
      } else if (model.provider === 'google') {
        // Google function calling will be handled in the API route
        requestBody.use_function_calling = true
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using Google function calling',
          type: 'thinking'
        })
      }
    } else if (model?.structuredOutput === 'json-mode') {
      requestBody.response_format = { type: 'json_object' }
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: '⚠️ Using JSON mode (no schema validation)',
        type: 'thinking'
      })
    }
    
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Structure generation failed: ${errorData.error}`,
        type: 'error'
      })
      throw new Error(errorData.error || 'Structure generation API call failed')
    }
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: '🔄 Step 4/4: Validating structure plan...',
      type: 'progress'
    })
    
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
    this.blackboard.addMessage({
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
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Extracted from Anthropic tool use',
          type: 'thinking'
        })
      } else if (data.structured_output) {
        // Unified structured output format
        planData = data.structured_output
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Received validated structured output',
          type: 'thinking'
        })
      } else if (typeof data.content === 'string') {
        // OpenAI returns JSON as string in content field
        try {
          planData = JSON.parse(data.content)
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: '✅ Parsed JSON from content string',
            type: 'thinking'
          })
        } catch (e) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `⚠️ Failed to parse content as JSON: ${e}`,
            type: 'thinking'
          })
          planData = data.content
        }
      } else if (typeof data.content === 'object') {
        // Content is already an object
        planData = data.content
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '✅ Using content object directly',
          type: 'thinking'
        })
      } else {
        // Last resort fallback
        planData = data
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: '⚠️ Using entire response as planData',
          type: 'thinking'
        })
      }
    } else {
      // String-based JSON - need to parse manually
      let rawContent = data.content || data.text || ''
      
      this.blackboard.addMessage({
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
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ JSON parse error: ${parseError.message}`,
          type: 'error'
        })
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `First 500 chars: ${rawContent.substring(0, 500)}`,
          type: 'thinking'
        })
        this.blackboard.addMessage({
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
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Validation failed: ${validation.error}`,
        type: 'error'
      })
      throw new Error(`Invalid structure plan: ${validation.error}`)
    }
    
    const plan = validation.data
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `✅ Structure plan validated: ${plan.structure.length} sections, ${plan.tasks.length} tasks`,
      type: 'result'
    })
    
    return plan
  }

  /**
   * Get format-specific instructions for structure generation
   */
  private getFormatInstructions(format: string): string {
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
    
    // Add format-specific guidance
    const wordCountGuidance: Record<string, string> = {
      'novel': '\nTarget: 60,000-100,000 words total. Chapters: 2,000-4,000 words each.',
      'short_story': '\nTarget: 1,000-7,500 words total.',
      'screenplay': '\nTarget: 90-120 pages (90-120 scenes). Each scene: 1-3 pages.',
      'report': '\nFocus on clarity, scanability, and logical flow.',
      'article': '\nTarget: 800-2,000 words total. Clear introduction and conclusion.',
      'essay': '\nTarget: 1,000-5,000 words. Strong thesis and supporting arguments.',
      'podcast': '\nTarget: 20-60 minutes (3,000-9,000 words). Conversational and engaging.'
    }
    
    instructions += wordCountGuidance[normalizedFormat] || ''
    
    instructions += '\n\nIMPORTANT: Only generate structure items for the FIRST 3-4 hierarchy levels. Do not include individual paragraphs, sentences, or lines in your structure plan.'
    
    return instructions
  }

  /**
   * Handle clarification response (user responding to request_clarification action)
   * Uses LLM reasoning to interpret natural language responses like "Go with the first option"
   */
  private async handleClarificationResponse(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const { clarificationContext, message } = request
    
    if (!clarificationContext) {
      throw new Error('handleClarificationResponse called without clarificationContext')
    }
    
    this.blackboard.addMessage({
      role: 'orchestrator',
      content: `🔍 Interpreting clarification response...`,
      type: 'thinking'
    })
    
    // Build context for LLM to understand which option user selected
    const optionsList = clarificationContext.options
      .map((opt, idx) => `${idx + 1}. [${opt.id}] ${opt.label} - ${opt.description}`)
      .join('\n')
    
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
      // Use fast model for simple classification
      const response = await fetch('/api/intent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: userPrompt,
          temperature: 0.1 // Low temp for consistent classification
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to interpret clarification: ${response.statusText}`)
      }

      const data = await response.json()
      const selectedOptionId = data.content.trim()
      
      // Find the selected option
      const selectedOption = clarificationContext.options.find(opt => opt.id === selectedOptionId)
      
      if (!selectedOption) {
        // Fallback: Try to match by content
        const lowerMessage = message.toLowerCase()
        const fallbackOption = clarificationContext.options.find(opt =>
          lowerMessage.includes(opt.label.toLowerCase()) ||
          lowerMessage.includes(opt.id.toLowerCase()) ||
          lowerMessage.match(/^#?(\d+)$/)?.[1] === String(clarificationContext.options.indexOf(opt) + 1)
        )
        
        if (fallbackOption) {
          console.log('⚠️ [Clarification] LLM returned invalid ID, using fallback match')
          return this.buildActionFromClarification(
            clarificationContext.originalAction,
            fallbackOption,
            clarificationContext.payload,
            request
          )
        }
        
        // If still no match, return error
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `❌ I didn't understand "${message}". Please choose by number (e.g., "1") or by name.`,
          type: 'error'
        })
        
        return {
          intent: 'general_chat',
          confidence: 0.3,
          reasoning: 'Failed to interpret clarification response',
          modelUsed: 'llama-3.1-8b-instant',
          actions: [],
          canvasChanged: false,
          requiresUserInput: true,
          estimatedCost: 0.0001
        }
      }
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `✅ Understood: "${selectedOption.label}"`,
        type: 'decision'
      })
      
      // Build appropriate action based on original action type
      return this.buildActionFromClarification(
        clarificationContext.originalAction,
        selectedOption,
        clarificationContext.payload,
        request
      )
      
    } catch (error) {
      console.error('❌ [Clarification] Error:', error)
      
      this.blackboard.addMessage({
        role: 'orchestrator',
        content: `❌ Error interpreting response: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  }

  /**
   * Build appropriate action based on clarification selection
   */
  private async buildActionFromClarification(
    originalAction: string,
    selectedOption: {id: string, label: string, description: string},
    payload: any,
    request: OrchestratorRequest
  ): Promise<OrchestratorResponse> {
    
    if (originalAction === 'create_structure') {
      const { documentFormat, userMessage, existingDocs } = payload
      
      if (selectedOption.id === 'create_new') {
        // User wants to create something new (ignore existing docs)
        this.blackboard.addMessage({
          role: 'orchestrator',
          content: `✅ Creating new ${documentFormat} from scratch...`,
          type: 'result'
        })
        
        // Return action to create new structure (add "from scratch" to bypass future clarification)
        const enhancedPrompt = `${userMessage} from scratch`
        
        return {
          intent: 'create_structure',
          confidence: 0.95,
          reasoning: `User chose to create new ${documentFormat} from scratch`,
          modelUsed: 'none',
          actions: [{
            type: 'message',
            payload: {
              content: `✅ Creating new ${documentFormat} from scratch...`,
              intent: 'create_structure',
              format: documentFormat,
              prompt: enhancedPrompt
            },
            status: 'pending'
          }],
          canvasChanged: false, // Canvas change will happen when UI executes onCreateStory
          requiresUserInput: false,
          estimatedCost: 0
        }
      } else {
        // User wants to base it on an existing doc
        const selectedDocId = selectedOption.id.replace('use_', '')
        const selectedDoc = existingDocs.find((d: any) => d.id === selectedDocId)
        
        if (selectedDoc) {
          this.blackboard.addMessage({
            role: 'orchestrator',
            content: `✅ Creating ${documentFormat} based on "${selectedDoc.name}" (${selectedDoc.format})...`,
            type: 'result'
          })
          
          // Return action to create structure with reference to existing doc
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
            canvasChanged: false, // Canvas change will happen when UI executes onCreateStory
            requiresUserInput: false,
            estimatedCost: 0
          }
        }
      }
    } else if (originalAction === 'open_and_write') {
      // User selected which node to open
      this.blackboard.addMessage({
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
      // User selected which node to delete
      this.blackboard.addMessage({
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
}

// ============================================================
// FACTORY FUNCTIONS
// ============================================================

const orchestrators = new Map<string, OrchestratorEngine>()

export function getOrchestrator(userId: string, config?: Partial<OrchestratorConfig>): OrchestratorEngine {
  if (!orchestrators.has(userId)) {
    orchestrators.set(userId, new OrchestratorEngine({
      userId,
      ...config
    }))
  }
  return orchestrators.get(userId)!
}

export function createOrchestrator(config: OrchestratorConfig): OrchestratorEngine {
  const orchestrator = new OrchestratorEngine(config)
  orchestrators.set(config.userId, orchestrator)
  return orchestrator
}

