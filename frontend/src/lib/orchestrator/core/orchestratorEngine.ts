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
import { selectModel, assessTaskComplexity, type ModelPriority, type ModelSelection } from './modelRouter'
import { analyzeIntent, type IntentAnalysis, type UserIntent } from '../intentRouter'
import { enhanceContextWithRAG } from '../ragIntegration'
import { Node, Edge } from 'reactflow'
import { selectModelForTask, isFrontierModel, MODEL_TIERS, type TaskRequirements, type TieredModel } from './modelTiers'

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
}

export interface OrchestratorAction {
  type: 'message' | 'open_document' | 'select_section' | 'generate_content' | 'modify_structure' | 'delete_node' | 'request_clarification'
  payload: any
  status: 'pending' | 'executing' | 'completed' | 'failed'
  error?: string
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
    
    const modelSelection = selectModel(
      taskComplexity,
      this.config.modelPriority,
      availableProviders
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
      modelSelection
    )
    
    // Step 11: Build response
    const response: OrchestratorResponse = {
      intent: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      reasoning: intentAnalysis.reasoning,
      modelUsed: modelSelection.modelId,
      actions,
      canvasChanged,
      requiresUserInput: intentAnalysis.needsClarification || false,
      estimatedCost: modelSelection.estimatedCost
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
    modelSelection: any
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
          
          // Try to extract section name from message
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
          
          if (request.modelMode === 'fixed' && request.fixedModeStrategy === 'consistent') {
            // CONSISTENT: Use the fixed model for writing too (expensive but uniform)
            writerModel = {
              modelId: request.fixedModelId || modelSelection.modelId,
              provider: modelSelection.provider,
              reasoning: 'Fixed mode (Consistent): Using selected model for all tasks'
            }
            console.log('🎯 [Consistent Strategy] Using fixed model for writing:', writerModel.modelId)
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
            
            // Filter MODEL_TIERS by user's available providers
            const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
            const availableModels = MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
            
            // Select best model for this task from AVAILABLE models only
            const selectedModel = selectModelForTask(
              {
                type: taskType,
                wordCount: sectionWordCount,
                contextNeeded: 8000, // Typical scene context
                priority: 'balanced' // Balance quality, speed, and cost
              },
              availableModels // Only models user has API keys for!
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
        actions.push({
          type: 'modify_structure',
          payload: {
            action: 'create',
            format: request.documentFormat || 'novel',
            prompt: request.message
          },
          status: 'pending'
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

