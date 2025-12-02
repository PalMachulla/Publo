/**
 * orchestrationService - Orchestration and content generation service
 * 
 * Handles orchestrated content generation including:
 * - Structure generation via multi-agent orchestrator
 * - Content generation for specified sections
 * - Model selection and configuration
 * - WorldState management for orchestrator
 * 
 * Architecture Notes:
 * - Uses MultiAgentOrchestrator for structure and content generation
 * - Manages WorldState synchronization with canvas state
 * - Handles model selection from user preferences or API
 * - Supports both new structure generation and content-only generation
 * 
 * Legacy Code:
 * - triggerAIGeneration (line 2072) - Original generation function
 *   Status: Marked as LEGACY with TODO
 *   Action: Investigate if still used, mark for deprecation if not
 * 
 * @see MultiAgentOrchestrator for orchestration logic
 * @see WorldState for state management
 * @see canvas/page.tsx for original implementation
 */

import { Node, Edge } from 'reactflow'
import { StoryFormat } from '@/types/nodes'
import { saveCanvas } from '@/lib/stories'
import type { WorldStateManager } from '@/lib/orchestrator/core/worldState'
import type { SupabaseClient } from '@supabase/supabase-js'

// Model tiers for validation (imported from orchestrator)
// TODO: Import from centralized location
const MODEL_TIERS: Array<{ id: string; tier: string; provider: string; displayName: string }> = []

export interface OrchestrationServiceDependencies {
  // State setters
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
  setCurrentStoryStructureNodeId: (id: string | null) => void
  setCurrentStructureItems: (items: any[]) => void
  setCurrentStructureFormat: (format: StoryFormat | undefined) => void
  setCurrentContentMap: (map: Record<string, string>) => void
  setIsAIDocPanelOpen: (open: boolean) => void
  
  // Refs
  worldStateRef: React.MutableRefObject<WorldStateManager | null>
  hasUnsavedChangesRef: React.MutableRefObject<boolean>
  isInferencingRef: React.MutableRefObject<boolean>
  
  // Context
  user: { id: string } | null
  nodes: Node[]
  edges: Edge[]
  storyId: string | null
  supabaseClient: SupabaseClient
  
  // Callbacks
  handleSave: () => Promise<void>
}

/**
 * Trigger orchestrated generation
 * 
 * Features:
 * - Structure generation via orchestrator
 * - Content generation for specified sections (if requested)
 * - Model selection from user preferences or API
 * - WorldState synchronization
 * - Real-time reasoning messages
 * 
 * Flow:
 * 1. Validate authentication and prompt
 * 2. Fetch user model preferences
 * 3. Create WorldState for orchestrator
 * 4. Initialize MultiAgentOrchestrator
 * 5. Generate structure (or use existing plan)
 * 6. Generate content (if tasks exist in plan)
 * 7. Update canvas and open document panel
 */
export async function triggerOrchestratedGeneration(
  structureNodeId: string,
  format: StoryFormat,
  dependencies: OrchestrationServiceDependencies,
  options?: {
    aiPromptNode?: Node | null
    orchestratorNodeId?: string
    userPromptDirect?: string
    existingPlan?: any
  }
): Promise<void> {
  const {
    setNodes,
    setEdges,
    setCurrentStoryStructureNodeId,
    setCurrentStructureItems,
    setCurrentStructureFormat,
    setCurrentContentMap,
    setIsAIDocPanelOpen,
    worldStateRef,
    hasUnsavedChangesRef,
    isInferencingRef,
    user,
    nodes,
    edges,
    storyId,
    supabaseClient,
    handleSave
  } = dependencies
  
  const {
    aiPromptNode = null,
    orchestratorNodeId = 'context',
    userPromptDirect,
    existingPlan
  } = options || {}
  
  console.log('═══════════════════════════════════════════════')
  console.log('🎬 ORCHESTRATION STARTED')
  console.log('═══════════════════════════════════════════════')
  console.log('Structure Node ID:', structureNodeId)
  console.log('Format:', format)
  console.log('Has AI Prompt Node:', !!aiPromptNode)
  console.log('Orchestrator ID:', orchestratorNodeId)
  console.log('Has Existing Plan:', !!existingPlan)
  console.log('═══════════════════════════════════════════════')
  
  // ✅ FIX: Create WorldState early (needed for both existing plan and new generation paths)
  const { buildWorldStateFromReactFlow } = await import('@/lib/orchestrator/core/worldState')
  let worldStateForOrchestrator = buildWorldStateFromReactFlow(
    nodes,
    edges,
    user?.id || '',
    {
      activeDocumentNodeId: structureNodeId,
      availableProviders: [],
      modelPreferences: {
        modelMode: 'automatic',
        fixedModelId: null
      }
    }
  )
  
  // ✅ FIX: If plan already exists, skip structure generation
  if (existingPlan) {
    console.log('✅ [triggerOrchestratedGeneration] Plan already provided, skipping structure generation')
    const structureItems = existingPlan.structure || []
    const plan = existingPlan // Use existing plan directly
    
    // Update WorldState with existing structure
    worldStateForOrchestrator.setActiveDocument(structureNodeId, format, structureItems)
    console.log('✅ [triggerOrchestratedGeneration] WorldState updated with existing structure')
    
    // Update node with structure items
    setNodes((nds) => {
      return nds.map((n) => {
        if (n.id === structureNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              items: structureItems,
              isLoading: false,
              document_data: {
                ...(n.data.document_data || {}),
                structure: structureItems
              }
            }
          }
        }
        return n
      })
    })
    
    // Save canvas with updated structure
    hasUnsavedChangesRef.current = true
    try {
      await handleSave()
      console.log('✅ [triggerOrchestratedGeneration] Canvas saved with existing structure')
    } catch (saveError) {
      console.error('❌ [triggerOrchestratedGeneration] Failed to save canvas:', saveError)
    }
    
    // Check if content generation is needed
    if (plan.tasks && plan.tasks.length > 0) {
      console.log('🎯 [triggerOrchestratedGeneration] Plan has tasks, proceeding with content generation only')
      // Content generation will continue below
    } else {
      console.log('ℹ️ [triggerOrchestratedGeneration] No tasks in plan, opening document panel')
      // Open document panel and exit
      setCurrentStoryStructureNodeId(structureNodeId)
      setCurrentStructureItems(structureItems)
      setCurrentStructureFormat(format)
      setCurrentContentMap({})
      setIsAIDocPanelOpen(true)
      return // Exit early - structure done, no content needed
    }
  }
  
  // ✅ FIX: Wrap everything in try/catch (both existingPlan and new generation paths)
  try {
    // Check authentication
    if (!user) {
      isInferencingRef.current = false
      alert('❌ You must be logged in to generate content.')
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === structureNodeId) {
            return { ...n, data: { ...n.data, isLoading: false } }
          } else if (n.id === orchestratorNodeId) {
            return { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
          }
          return n
        })
      )
      return
    }
    
    // Determine user prompt source (priority: direct > AI Prompt node)
    let userPrompt = ''
    
    if (userPromptDirect) {
      // Priority 1: Direct chat input
      userPrompt = userPromptDirect
      console.log('✅ Using direct chat prompt:', userPrompt)
    } else if (aiPromptNode) {
      // Priority 2: AI Prompt node
      const isActive = (aiPromptNode.data as any).isActive !== false
      userPrompt = (aiPromptNode.data as any).userPrompt || ''
      
      if (isActive && !userPrompt.trim()) {
        alert('Please enter a prompt in the AI Prompt node first, or set it to Passive mode.')
        return
      }
      console.log('✅ Using AI Prompt node:', userPrompt)
    } else if (!existingPlan) {
      alert('Please use the chat input in the panel or connect an AI Prompt node.')
      return
    }
    
    if (!userPrompt.trim() && !existingPlan) {
      alert('Please enter a prompt first.')
      return
    }
    
    // Set inference flag
    isInferencingRef.current = true
    
    // Initialize reasoning messages array
    const reasoningMessages: Array<{
      timestamp: string
      content: string
      type: 'thinking' | 'decision' | 'task' | 'result' | 'error'
    }> = []
    
    // Reasoning callback to update WorldState conversation
    const onReasoning = (message: string, type: any) => {
      const msg = {
        id: `reasoning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        content: message,
        type,
        role: 'orchestrator' as const
      }
      reasoningMessages.push(msg)
      
      // ✅ MIGRATION: Update WorldState instead of canvasChatHistory
      if (worldStateRef.current) {
        worldStateRef.current.addMessage({
          content: message,
          type: type,
          role: 'orchestrator'
        })
      }
      
      // Also update orchestrator node for backward compatibility
      setNodes((nds) =>
        nds.map((n) =>
          n.id === orchestratorNodeId
            ? { ...n, data: { ...n.data, reasoningMessages: [...reasoningMessages] } }
            : n
        )
      )
    }
    
    // Update orchestrator to show it's working and clear chat prompt for next generation
    setNodes((nds) =>
      nds.map((n) =>
        n.id === orchestratorNodeId
          ? { ...n, data: { ...n.data, isOrchestrating: true, loadingText: 'Orchestrating', reasoningMessages: [], chatPrompt: undefined } }
          : n
      )
    )
    
    onReasoning('🚀 Initializing orchestrator engine...', 'thinking')
    
    // Announce the format selected by user
    const formatLabel = format.charAt(0).toUpperCase() + format.slice(1).replace(/-/g, ' ')
    onReasoning(`📖 User selected format: ${formatLabel}`, 'decision')
    onReasoning(`💭 Analyzing prompt for ${formatLabel} structure...`, 'thinking')
    
    // Fetch user's orchestrator/writer preferences
    let orchestratorModelId: string | null = null
    let writerModelIds: string[] = []
    let userKeyId: string | null = null
    
    // Fetch ALL API keys and find first configured orchestrator
    const prefsResponse = await fetch('/api/user/api-keys')
    const prefsData = await prefsResponse.json()
    
    console.log('📦 API keys response:', {
      success: prefsData.success,
      keyCount: prefsData.keys?.length,
      keys: prefsData.keys?.map((k: any) => ({
        id: k.id,
        provider: k.provider,
        orchestrator: k.orchestrator_model_id,
        writers: k.writer_model_ids
      }))
    })
    
    if (prefsData.success && prefsData.keys?.length > 0) {
      // Find first key with orchestrator configured
      const configuredKey = prefsData.keys.find((k: any) => k.orchestrator_model_id)
      
      if (configuredKey) {
        orchestratorModelId = configuredKey.orchestrator_model_id
        writerModelIds = configuredKey.writer_model_ids || []
        userKeyId = configuredKey.id
        console.log('✅ Found configured orchestrator:', {
          orchestrator: orchestratorModelId,
          writers: writerModelIds.length,
          keyId: userKeyId,
          provider: configuredKey.provider
        })
      } else {
        // No explicit orchestrator configured (Auto-select mode)
        // Use first available API key for authentication
        const firstKey = prefsData.keys[0]
        userKeyId = firstKey.id
        writerModelIds = firstKey.writer_model_ids || []
        console.log('⚡ Auto-select mode: Using first API key:', {
          keyId: userKeyId,
          provider: firstKey.provider,
          writers: writerModelIds.length
        })
      }
    } else {
      console.log('❌ No API keys found')
    }
    
    console.log('📋 User preferences:', {
      orchestratorModelId,
      writerModelIds,
      userKeyId
    })
    
    // Get unified orchestrator instance (PHASE 3: Use multi-agent orchestrator!)
    const { getMultiAgentOrchestrator, createDefaultToolRegistry } = await import('@/lib/orchestrator')
    
    // ✅ FIX: Create and pass toolRegistry for content generation
    const toolRegistry = createDefaultToolRegistry()
    
    // ✅ FIX: Extract availableProviders BEFORE using it in WorldState
    const availableProviders = prefsData.keys
      ?.map((k: any) => k.provider)
      .filter(Boolean) || []
    
    // ✅ FIX: Declare model variables before WorldState creation
    // These will be populated below, but need to exist for WorldState initialization
    let availableModels: string[] = []
    let finalOrchestratorModel: string | null = null
    
    // ✅ FIX: Update WorldState for agents (using temporary values, will be updated in orchestrate call)
    worldStateForOrchestrator = buildWorldStateFromReactFlow(
      nodes,
      edges,
      user.id,
      {
        activeDocumentNodeId: structureNodeId,
        availableProviders: availableProviders,
        modelPreferences: {
          modelMode: 'automatic', // Will be set correctly in orchestrate() call
          fixedModelId: null // Will be set correctly in orchestrate() call
        },
        orchestratorKeyId: userKeyId || undefined
      }
    )
    
    const orchestrator = getMultiAgentOrchestrator(user.id, {
      modelPriority: 'balanced',
      enableRAG: false, // Canvas doesn't need RAG for structure generation
      enablePatternLearning: true,
      toolRegistry // ✅ FIX: Pass toolRegistry for parallel/cluster execution
    }, worldStateForOrchestrator)
    console.log('🤖 [triggerOrchestratedGeneration] Using MultiAgentOrchestrator with', toolRegistry.getStats().totalTools, 'tools')
    
    // Determine available models (populate variables declared above)
    // Priority 1: Use configured orchestrator model from Profile (with validation)
    if (orchestratorModelId) {
      // ✅ FIX: Validate configured model exists in MODEL_TIERS
      // Note: MODEL_TIERS should be imported from centralized location
      const isValidModel = MODEL_TIERS.length === 0 || MODEL_TIERS.some(m => m.id === orchestratorModelId)
      
      if (isValidModel) {
        finalOrchestratorModel = orchestratorModelId
        availableModels = [orchestratorModelId]
        onReasoning(`✓ Using configured orchestrator: ${orchestratorModelId}`, 'decision')
        console.log('[Canvas] Using Profile orchestrator:', orchestratorModelId)
      } else {
        // Invalid model in database - fall back to auto-select
        onReasoning(`⚠️ Configured model "${orchestratorModelId}" is no longer available. Auto-selecting...`, 'decision')
        console.warn('[Canvas] Invalid orchestrator model in database:', orchestratorModelId)
        orchestratorModelId = null // Trigger auto-select below
      }
    } 
    // Priority 2: Fetch from API as fallback
    else {
      onReasoning('🔍 No model configured, fetching available models...', 'thinking')
      
      try {
        const modelsResponse = await fetch('/api/models')
        const modelsData = await modelsResponse.json()
        
        console.log('[Canvas] Models API response:', modelsData)
        
        // API returns 'grouped' not 'groups'
        const groups = modelsData.grouped || modelsData.groups || []
        
        if (modelsData.success && Array.isArray(groups) && groups.length > 0) {
          // Get first orchestrator-capable model from first provider
          const firstGroup = groups[0]
          
          if (firstGroup.models && Array.isArray(firstGroup.models) && firstGroup.models.length > 0) {
            // VALIDATE: Only use models that exist in MODEL_TIERS
            const validModelIds = MODEL_TIERS.length > 0 ? MODEL_TIERS.map(m => m.id) : firstGroup.models.map((m: any) => m.id)
            const validModels = firstGroup.models.filter((m: any) => 
              m.id && validModelIds.includes(m.id)
            )
            
            console.log('[Canvas] Model validation:', {
              total: firstGroup.models.length,
              valid: validModels.length,
              validModelIds,
              firstGroupModels: firstGroup.models.map((m: any) => m.id)
            })
            
            if (validModels.length === 0) {
              onReasoning(`⚠️ No valid models found in your preferences. Using default...`, 'decision')
              // Use the first frontier or premium model from MODEL_TIERS that user has access to
              const defaultModel = MODEL_TIERS.length > 0 ? MODEL_TIERS.find(m => 
                (m.tier === 'frontier' || m.tier === 'premium') && 
                firstGroup.provider === m.provider
              ) : validModels[0]
              if (defaultModel) {
                finalOrchestratorModel = defaultModel.id
                availableModels = [defaultModel.id]
                onReasoning(`✓ Using default: ${defaultModel.displayName || defaultModel.id}`, 'decision')
              } else {
                throw new Error(`No valid models available for ${firstGroup.provider}. Please update your model preferences.`)
              }
            } else {
              // Prefer frontier/premium models from validated list
              const orchestratorModels = validModels.filter((m: any) => {
                const tierModel = MODEL_TIERS.find(tm => tm.id === m.id)
                return !tierModel || tierModel.tier === 'frontier' || tierModel.tier === 'premium'
              })
              
              if (orchestratorModels.length > 0) {
                finalOrchestratorModel = orchestratorModels[0].id
                availableModels = [orchestratorModels[0].id]
                onReasoning(`✓ Auto-selected: ${orchestratorModels[0].name || orchestratorModels[0].id}`, 'decision')
                console.log('[Canvas] Auto-selected orchestrator:', finalOrchestratorModel)
              } else {
                // Fallback to any valid model
                finalOrchestratorModel = validModels[0].id
                availableModels = [validModels[0].id]
                onReasoning(`✓ Using: ${validModels[0].name || validModels[0].id}`, 'decision')
                console.log('[Canvas] Fallback orchestrator:', finalOrchestratorModel)
              }
            }
          }
        } else {
          console.warn('[Canvas] Invalid models API response:', modelsData)
        }
      } catch (error) {
        console.error('[Canvas] Error fetching models:', error)
        onReasoning(`⚠️ Could not fetch models from API`, 'error')
      }
    }
    
    // Add writer models if configured
    if (writerModelIds.length > 0) {
      availableModels.push(...writerModelIds)
      onReasoning(`✓ Writer models: ${writerModelIds.length}`, 'decision')
    }
    
    console.log('🎯 Available models:', availableModels)
    console.log('🎯 Final orchestrator:', finalOrchestratorModel)
    
    // Log to UI for visibility
    onReasoning(`🎯 Selected model: ${finalOrchestratorModel}`, 'decision')
    onReasoning(`🎯 Available models: ${availableModels.join(', ')}`, 'thinking')
    
    // Validate we have at least one model
    if (availableModels.length === 0 || !finalOrchestratorModel) {
      const errorMsg = 'No models available. Please:\n\n1. Go to Profile page\n2. Add an API key (Groq, OpenAI, or Anthropic)\n3. Click "Model Configuration"\n4. Select an orchestrator model\n5. Save your preferences\n6. Try generating again'
      onReasoning(`❌ ${errorMsg}`, 'error')
      throw new Error(errorMsg)
    }
    
    // ✅ FIX: Skip orchestrator call if plan already exists
    let plan: any
    let structureItems: any[] = []
    let effectivePrompt = ''
    
    if (existingPlan) {
      // Use existing plan - skip structure generation
      plan = existingPlan
      structureItems = plan.structure || []
      console.log('✅ [triggerOrchestratedGeneration] Using existing plan, skipping structure generation')
      console.log('   Structure items:', structureItems.length)
      console.log('   Tasks:', plan.tasks?.length || 0)
    } else {
      // Build effective prompt (already validated above)
      effectivePrompt = userPrompt
      
      onReasoning(`📝 Analyzing prompt: "${effectivePrompt.substring(0, 100)}..."`, 'thinking')
      onReasoning(`🔑 Available providers: ${availableProviders.join(', ')}`, 'thinking')
      
      // Call unified orchestrator to create structure
      const response = await orchestrator.orchestrate({
        message: effectivePrompt,
        canvasNodes: nodes,
        canvasEdges: edges,
        documentFormat: format,
        currentStoryStructureNodeId: structureNodeId, // ✅ FIX: Pass node ID so agents can save content
        userKeyId: userKeyId || undefined,
        fixedModelId: finalOrchestratorModel || undefined,
        availableProviders,
        modelMode: finalOrchestratorModel ? 'fixed' : 'automatic',
        supabaseClient: supabaseClient // ✅ FIX: Pass SAME authenticated client instance
      })
      
      // Extract plan from generate_structure action
      console.log('🔍 [triggerOrchestratedGeneration] Response actions:', response.actions.map((a: any) => ({ type: a.type, status: a.status })))
      
      // ✅ NEW: Check for clarification/educational messages first
      const clarificationAction = response.actions.find((a: any) => 
        a.type === 'message' && a.status === 'pending' && a.payload?.type === 'result'
      )
      
      if (clarificationAction) {
        console.log('💬 [triggerOrchestratedGeneration] Orchestrator needs clarification')
        onReasoning(clarificationAction.payload.content, 'result')
        // Don't throw error - just return early and let user respond
        return
      }
      
      const structureAction = response.actions.find((a: any) => a.type === 'generate_structure')
      
      if (!structureAction) {
        console.error('❌ [triggerOrchestratedGeneration] No generate_structure action found')
        console.log('Available actions:', response.actions)
        
        // Check if there's an error message action instead
        const errorAction = response.actions.find((a: any) => a.type === 'message' && a.status === 'failed')
        if (errorAction) {
          onReasoning(`❌ ${errorAction.payload.content}`, 'error')
          throw new Error(errorAction.payload.content)
        }
        
        throw new Error(`Orchestrator did not return a structure plan. Intent was: ${response.intent}. Actions: ${response.actions.map((a: any) => a.type).join(', ')}`)
      }
      
      if (!structureAction.payload?.plan) {
        console.error('❌ [triggerOrchestratedGeneration] Structure action found but no plan in payload:', structureAction)
        throw new Error('Structure action found but plan is missing from payload')
      }
      
      plan = structureAction.payload.plan
      structureItems = plan.structure || []
      console.log('✅ [triggerOrchestratedGeneration] Plan extracted successfully')
      
      // Display orchestrator's thinking steps (only when structure was generated)
      if (response.thinkingSteps && response.thinkingSteps.length > 0) {
        response.thinkingSteps.forEach((step: any) => {
          onReasoning(step.content, step.type as any)
        })
      }
    }
    
    onReasoning(`✅ Plan created: ${plan.structure.length} sections, ${plan.tasks.length} tasks`, 'result')
    
    // Convert plan to structure items (if not already converted)
    if (!structureItems || structureItems.length === 0) {
      structureItems = plan.structure.map((section: any) => ({
        id: section.id,
        level: section.level,
        name: section.name,
        parentId: section.parentId,
        wordCount: section.wordCount,
        summary: section.summary || ''
      }))
    }
    
    // ✅ DEBUG: Log structure and task IDs for verification
    console.log('🔍 [triggerOrchestratedGeneration] Structure IDs:', structureItems.map((s: any) => s.id))
    console.log('🔍 [triggerOrchestratedGeneration] Task section IDs:', plan.tasks.map((t: any) => t.sectionId))
    
    // ✅ CRITICAL FIX: Validate that all task sectionIds exist in structure
    const validSectionIds = new Set(structureItems.map((s: any) => s.id))
    const invalidTasks = plan.tasks.filter((task: any) => !validSectionIds.has(task.sectionId))
    
    if (invalidTasks.length > 0) {
      console.warn('⚠️ [triggerOrchestratedGeneration] Found tasks with invalid sectionIds:', {
        invalidTasks: invalidTasks.map((t: any) => ({ taskId: t.id, sectionId: t.sectionId })),
        validSectionIds: Array.from(validSectionIds)
      })
      
      // Remove invalid tasks to prevent "section not found" errors
      plan.tasks = plan.tasks.filter((task: any) => validSectionIds.has(task.sectionId))
      
      onReasoning(`⚠️ Removed ${invalidTasks.length} invalid tasks (section IDs don't match structure)`, 'decision')
    }
    
    console.log('✅ [triggerOrchestratedGeneration] Task validation complete:', {
      totalTasks: plan.tasks.length,
      validTasks: plan.tasks.length,
      removedTasks: invalidTasks.length
    })
    
    // Update structure node with initial structure
    // ✅ CRITICAL: Store updated nodes in a variable so we can save them immediately
    let updatedNodes: Node[] = []
    setNodes((nds) => {
      updatedNodes = nds.map((n) => {
        if (n.id === structureNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              items: structureItems,
              contentMap: {},
              format,
              isLoading: false
            }
          }
        }
        return n
      })
      return updatedNodes
    })
    
    onReasoning(`📊 Structure initialized with ${structureItems.length} sections`, 'result')
    onReasoning('✅ Hierarchical document system ready', 'result')
    
    // ✅ CRITICAL FIX: Save canvas with UPDATED nodes AND edges (not stale closure)
    console.log('💾 [triggerOrchestratedGeneration] Saving canvas with updated structure...')
    hasUnsavedChangesRef.current = true
    
    // ✅ FIX: Capture updated edges from state (includes the new edge created in handleCreateStory)
    let updatedEdges: Edge[] = []
    setEdges((currentEdges) => {
      updatedEdges = currentEdges
      return currentEdges // Don't modify, just capture
    })
    
    // Save using the updated nodes and edges
    if (storyId) {
      try {
        await saveCanvas(storyId, updatedNodes, updatedEdges)
        console.log('✅ [triggerOrchestratedGeneration] Canvas saved with structure and edges:', {
          nodesCount: updatedNodes.length,
          edgesCount: updatedEdges.length
        })
      } catch (saveError) {
        console.error('❌ [triggerOrchestratedGeneration] Failed to save canvas:', saveError)
        onReasoning('⚠️ Warning: Structure created but canvas save failed', 'error')
      }
    }
    
    // ✨ PHASE 3 FIX: Update WorldState with newly created node
    console.log('🔄 [triggerOrchestratedGeneration] Updating WorldState with new node')
    worldStateForOrchestrator.setActiveDocument(structureNodeId, format, structureItems)
    console.log('✅ [triggerOrchestratedGeneration] WorldState updated')
    
    // ✨ PHASE 3 FIX: Check if content generation was requested
    const hasContentActions = plan.tasks && plan.tasks.length > 0
    
    if (hasContentActions) {
      console.log('🎯 [triggerOrchestratedGeneration] Plan has tasks, triggering content generation')
      onReasoning('🎯 Multi-step task detected: Generating content...', 'decision')
      
      try {
        // ✅ CRITICAL FIX: Use updated nodes and edges (not stale closure)
        console.log('🔄 [triggerOrchestratedGeneration] Using updated canvas state for content generation:', {
          updatedNodesCount: updatedNodes.length,
          updatedEdgesCount: updatedEdges.length,
          structureNodeId
        })
        
        // Build prompt for content generation (use original prompt or task-based prompt)
        const contentPrompt = effectivePrompt || userPrompt || 'Generate content for the specified sections'
        
        // Trigger second orchestration with node ID now available
        const contentResponse = await orchestrator.orchestrate({
          message: contentPrompt,
          canvasNodes: updatedNodes, // ✅ Use updated nodes (includes structure node)
          canvasEdges: updatedEdges, // ✅ Use updated edges (includes connection)
          documentFormat: format,
          currentStoryStructureNodeId: structureNodeId, // ✅ NOW we have the node ID!
          structureItems: structureItems,
          contentMap: {},
          userKeyId: userKeyId || undefined,
          fixedModelId: finalOrchestratorModel || undefined,
          availableProviders,
          modelMode: finalOrchestratorModel ? 'fixed' : 'automatic',
          supabaseClient: supabaseClient
        })
        
        // Display agent execution messages
        if (contentResponse.thinkingSteps && contentResponse.thinkingSteps.length > 0) {
          contentResponse.thinkingSteps.forEach((step: any) => {
            onReasoning(step.content, step.type as any)
          })
        }
        
        onReasoning('✅ Content generation complete', 'result')
        console.log('✅ [triggerOrchestratedGeneration] Content generation orchestration complete')
      } catch (contentError) {
        console.error('❌ [triggerOrchestratedGeneration] Content generation failed:', contentError)
        onReasoning(`⚠️ Content generation failed: ${contentError instanceof Error ? contentError.message : 'Unknown error'}`, 'error')
      }
    } else {
      console.log('ℹ️ [triggerOrchestratedGeneration] No content generation requested (structure only)')
    }
    
    // ✅ CRITICAL FIX: Automatically open the document panel after structure creation
    console.log('📂 [triggerOrchestratedGeneration] Opening document panel for new structure')
    setCurrentStoryStructureNodeId(structureNodeId)
    setCurrentStructureItems(structureItems)
    setCurrentStructureFormat(format)
    setCurrentContentMap({}) // Will be populated by content generation
    setIsAIDocPanelOpen(true)
    
    // Clear inference flag
    isInferencingRef.current = false
    
    // Update orchestrator to clear loading
    setNodes((nds) =>
      nds.map((n) =>
        n.id === orchestratorNodeId
          ? { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
          : n
      )
    )
    
    onReasoning('✅ Orchestration complete! Document panel opened.', 'result')
    
    alert(`✅ ${format.charAt(0).toUpperCase() + format.slice(1)} structure generated with orchestrator!`)
  } catch (error: any) {
    console.error('❌ Orchestrated generation failed:', error)
    
    isInferencingRef.current = false
    
    alert(`Failed to generate structure:\n\n${error.message}`)
    
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === structureNodeId) {
          return { ...n, data: { ...n.data, isLoading: false } }
        } else if (n.id === orchestratorNodeId) {
          return { ...n, data: { ...n.data, isOrchestrating: false, loadingText: '' } }
        }
        return n
      })
    )
  }
}

/**
 * LEGACY: Original generation function (kept for backward compatibility)
 * 
 * Status: Marked as LEGACY with TODO
 * Action: Investigate if still used, mark for deprecation if not
 * 
 * This function is the original AI generation implementation before
 * the multi-agent orchestrator system was introduced.
 * 
 * @deprecated Use triggerOrchestratedGeneration instead
 */
export async function triggerAIGeneration(
  structureNodeId: string,
  format: StoryFormat,
  aiPromptNode: Node,
  orchestratorNodeId: string,
  dependencies: OrchestrationServiceDependencies
): Promise<void> {
  // TODO: Investigate if this function is still used
  // If not, mark for removal in next major version
  console.warn('⚠️ triggerAIGeneration is LEGACY and should be replaced with triggerOrchestratedGeneration')
  
  // Implementation would go here, but it's marked as legacy
  // Keeping the signature for backward compatibility
  throw new Error('triggerAIGeneration is deprecated. Use triggerOrchestratedGeneration instead.')
}

