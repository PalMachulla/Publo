/**
 * WriteContentAction
 * 
 * Purpose: Handle 'write_content' intent by detecting target sections and generating content
 * 
 * Flow:
 * 1. Check for explicit section references in message (overrides active context)
 * 2. Try three detection strategies:
 *    a) Numeric: "Chapter 1", "Act 2", "Scene 3" (supports Roman numerals)
 *    b) Ordinal: "first scene", "second act", "opening chapter"
 *    c) Name-based: "write in the prologue", "add to introduction"
 * 3. Fall back to active context if no section found in message
 * 4. Auto-select section if different from active context
 * 5. Intelligently select writer model based on section complexity
 * 6. Generate content action with appropriate model
 * 
 * Dependencies:
 * - request.structureItems: Document structure for section detection
 * - request.activeContext: Currently selected section (fallback)
 * - request.message: User message with section reference
 * - request.modelMode: 'auto' or 'fixed' for model selection
 * - availableModels: Models user has API keys for
 * 
 * Source: orchestratorEngine.ts lines 772-1171
 * 
 * @module orchestrator/actions/content
 */

import { BaseAction } from '../base/BaseAction'
import type { IntentAnalysis } from '../../context/intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../context/contextProvider'
import { selectModelForTask, MODEL_TIERS, type TaskRequirements, type TieredModel } from '../../core/modelRouter'

export class WriteContentAction extends BaseAction {
  /**
   * Action type identifier
   */
  get actionType(): OrchestratorAction['type'] {
    return 'generate_content'
  }
  
  /**
   * Generate actions for write_content intent
   * 
   * Complex section detection with three strategies:
   * 1. Numeric pattern matching (Chapter 1, Act II)
   * 2. Ordinal matching (first scene, second act)
   * 3. Name-based fuzzy matching (prologue, introduction)
   * 
   * Intelligent model selection based on:
   * - Section level (acts/sequences = complex)
   * - Section name keywords (climax, action, dialogue)
   * - Word count targets
   * - User's model mode (auto vs fixed)
   * 
   * @param intent - Analyzed intent from LLM
   * @param request - Original request with message, structure, and model preferences
   * @param context - Canvas context (not used for this action)
   * @param additionalContext - Available models and model selection
   * @returns Array with select_section and generate_content actions, or error message
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
    console.log('📝 [WriteContentAction] Processing write request:', {
      hasActiveContext: !!request.activeContext,
      activeContextId: request.activeContext?.id,
      message: request.message,
      hasStructureItems: !!request.structureItems?.length
    })
    
    const actions: OrchestratorAction[] = []
    let targetSectionId = request.activeContext?.id
    
    // ============================================================
    // STEP 1: Check message for explicit section references
    // ============================================================
    
    if (request.structureItems && request.structureItems.length > 0) {
      const lowerMessage = request.message.toLowerCase()
      let messageTargetSectionId: string | null = null
      
      // Helper: Normalize text for fuzzy matching
      const normalizeText = (text: string) => 
        text
          .toLowerCase()
          .replace(/^\d+\.?\d*\s*/, '') // Remove leading numbers
          .replace(/&/g, 'and')
          .replace(/[^\w\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      
      // Helper: Find section by name (fuzzy match)
      const findSectionByName = (items: any[], searchTerm: string): any => {
        const normalizedSearch = normalizeText(searchTerm)
        
        for (const item of items) {
          const normalizedName = normalizeText(item.name || '')
          
          if (normalizedName === normalizedSearch ||
              normalizedName.includes(normalizedSearch) ||
              normalizedSearch.includes(normalizedName)) {
            return item
          }
          
          if (item.children) {
            const found = findSectionByName(item.children, searchTerm)
            if (found) return found
          }
        }
        return null
      }
      
      // ============================================================
      // STEP 2: Try numeric pattern matching
      // ============================================================
      
      const numericPattern = /(act|scene|chapter|section|sequence|beat)\s+(\d+|i+|ii+|iii+|iv+|v+|vi+|vii+|viii+|ix+|x+)/i
      const numericMatch = request.message.match(numericPattern)
      
      if (numericMatch) {
        const type = numericMatch[1].toLowerCase()
        const numberStr = numericMatch[2].toLowerCase()
        
        console.log(`🔍 [Numeric Detection] Detected: ${type} ${numberStr}`)
        
        // Convert Roman numerals
        const romanToNumber: Record<string, number> = {
          'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
          'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
        }
        
        const targetNumber = romanToNumber[numberStr] || parseInt(numberStr, 10)
        
        // Find matching sections by type
        const matchingSections = request.structureItems.filter((item: any) => {
          const itemName = item.name || ''
          
          if (type === 'act') return /^act\s+(i+|[0-9]+)/i.test(itemName)
          if (type === 'scene') return /scene\s+(\d+|i+)/i.test(itemName)
          if (type === 'chapter') return /(chapter|ch\.?)\s+(\d+|i+)/i.test(itemName)
          if (type === 'section') return /section\s+(\d+|i+)/i.test(itemName)
          if (type === 'sequence') return /sequence\s+(\d+|i+)/i.test(itemName)
          if (type === 'beat') return /beat\s+(\d+|i+)/i.test(itemName)
          
          return itemName.toLowerCase().includes(type) && itemName.toLowerCase().includes(numberStr)
        })
        
        // Find the section with matching number
        const targetSection = matchingSections.find((item: any) => {
          const itemNumberMatch = item.name.match(/(\d+|i+|ii+|iii+|iv+|v+|vi+|vii+|viii+|ix+|x+)/i)
          if (itemNumberMatch) {
            const itemNumberStr = itemNumberMatch[1].toLowerCase()
            const itemNumber = romanToNumber[itemNumberStr] || parseInt(itemNumberStr, 10)
            return itemNumber === targetNumber
          }
          return false
        })
        
        if (targetSection) {
          messageTargetSectionId = targetSection.id
          console.log('✅ [Numeric Detection] Found:', targetSection.name)
        }
      }
      
      // ============================================================
      // STEP 3: Try ordinal pattern matching
      // ============================================================
      
      if (!messageTargetSectionId) {
        const ordinalPattern = /(?:start with|write|begin with)?\s*(?:the\s+)?(first|second|third|1st|2nd|3rd|opening|initial)\s+(scene|act|sequence|chapter|section|beat)/i
        const ordinalMatch = request.message.match(ordinalPattern)
        
        if (ordinalMatch) {
          const position = ordinalMatch[1].toLowerCase()
          const type = ordinalMatch[2].toLowerCase()
          
          const ordinalMap: Record<string, number> = {
            'first': 0, '1st': 0, 'opening': 0, 'initial': 0,
            'second': 1, '2nd': 1,
            'third': 2, '3rd': 2
          }
          
          const targetIndex = ordinalMap[position] ?? 0
          
          // Find matching sections by type
          const matchingSections = request.structureItems.filter((item: any) => {
            const itemName = item.name?.toLowerCase() || ''
            
            if (type === 'scene') return itemName.startsWith('scene:') || /\bscene\b/i.test(item.name || '')
            if (type === 'act') return /^act\s+/i.test(item.name || '')
            if (type === 'sequence') return /^sequence\s+/i.test(item.name || '') || itemName.includes('sequence')
            if (type === 'beat') return itemName.includes('beat')
            return itemName.includes(type)
          }).sort((a: any, b: any) => a.order - b.order)
          
          if (matchingSections[targetIndex]) {
            messageTargetSectionId = matchingSections[targetIndex].id
            console.log('✅ [Ordinal Detection] Found:', matchingSections[targetIndex].name)
          }
        }
      }
      
      // ============================================================
      // STEP 4: Try name-based pattern matching (with multi-section support)
      // ============================================================
      
      /**
       * MULTI-SECTION HANDLING:
       * 
       * When the user requests multiple sections (e.g., "write the next chapter, and chapter 5"),
       * the intent analysis extracts them as a comma-separated string in targetSegment.
       * 
       * This step:
       * 1. Checks if targetSegment contains multiple sections (comma-separated)
       * 2. Parses each section reference (handles "next chapter", "chapter 5", etc.)
       * 3. Generates multiple generate_content actions (one per section)
       * 4. Returns early with all actions - MultiAgentOrchestrator will decide execution strategy
       * 
       * If only one section is found, falls through to single-section logic below.
       */
      
      if (!messageTargetSectionId) {
        // First, check if intent analysis extracted a targetSegment
        if (intent.extractedEntities?.targetSegment) {
          const targetSegment = intent.extractedEntities.targetSegment
          console.log(`🔍 [TargetSegment] Using extracted targetSegment: "${targetSegment}"`)
          
          // ✅ MULTI-SECTION: Check if targetSegment contains multiple sections (comma-separated)
          // Examples: "chapter 1, chapter 2, chapter 3" or "next chapter, chapter 5"
          const segmentParts = targetSegment.split(',').map(s => s.trim()).filter(s => s.length > 0)
          
          if (segmentParts.length > 1) {
            // MULTIPLE SECTIONS DETECTED - Process each one separately
            console.log(`📝 [Multi-Section] Detected ${segmentParts.length} sections:`, segmentParts)
            
            const foundSections: Array<{ id: string; name: string }> = []
            
            // Process each section reference
            for (const segmentPart of segmentParts) {
              let section: any = null
              
              // ✅ HANDLE "NEXT CHAPTER" / "NEXT SECTION" LOGIC
              // When user says "next chapter", we need to find the current chapter and get the next sequential one
              if (/next\s+(chapter|section|scene|act)/i.test(segmentPart)) {
                console.log(`🔍 [Next Section] Detected "next" reference: "${segmentPart}"`)
                
                // Find the current section (from active context)
                const currentSection = request.activeContext?.id 
                  ? request.structureItems?.find((item: any) => item.id === request.activeContext?.id)
                  : null
                
                if (currentSection) {
                  // Determine what type of section we're looking for (chapter, scene, act, etc.)
                  const sectionType = segmentPart.match(/(chapter|section|scene|act)/i)?.[1]?.toLowerCase() || 'chapter'
                  
                  // Find all sections of this type, sorted by order
                  const allSectionsOfType = request.structureItems
                    ?.filter((item: any) => {
                      const itemName = (item.name || '').toLowerCase()
                      return itemName.includes(sectionType)
                    })
                    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                  
                  if (allSectionsOfType && allSectionsOfType.length > 0) {
                    // Find current section's index in the sorted list
                    const currentIndex = allSectionsOfType.findIndex((s: any) => s.id === currentSection.id)
                    
                    if (currentIndex >= 0 && currentIndex < allSectionsOfType.length - 1) {
                      // Found the next section
                      section = allSectionsOfType[currentIndex + 1]
                      console.log(`✅ [Next Section] Found: ${section.name} (after ${currentSection.name})`)
                    } else {
                      console.log(`⚠️ [Next Section] Current section not found or is last in sequence`)
                    }
                  } else {
                    console.log(`⚠️ [Next Section] No ${sectionType} sections found in structure`)
                  }
                } else {
                  console.log(`⚠️ [Next Section] No active context to determine "next" from`)
                }
              } else {
                // ✅ REGULAR SECTION LOOKUP: Try to find section by name/number
                // This handles patterns like "chapter 5", "act 2", "scene 3", etc.
                section = findSectionByName(request.structureItems, segmentPart)
                if (section) {
                  console.log(`✅ [TargetSegment Match] Found: ${section.name}`)
                }
              }
              
              // Add found section to our list
              if (section) {
                foundSections.push({ id: section.id, name: section.name })
              } else {
                console.log(`⚠️ [TargetSegment] Could not find section matching "${segmentPart}"`)
              }
            }
            
            // ✅ GENERATE ACTIONS FOR ALL FOUND SECTIONS
            // MultiAgentOrchestrator will analyze these actions and decide:
            // - Sequential: Execute one after another (safe, slower)
            // - Parallel: Execute simultaneously using DAG (fast, efficient for independent sections)
            // - Cluster: Writer-Critic collaboration (best quality, slower)
            if (foundSections.length > 0) {
              const allActions: OrchestratorAction[] = []
              
              console.log(`📝 [Multi-Section] Generating actions for ${foundSections.length} sections:`, 
                foundSections.map(s => s.name).join(', '))
              
              // Generate one generate_content action per section
              for (const { id: sectionId, name: sectionName } of foundSections) {
                // Get section metadata for model selection
                const activeStructureItem = request.structureItems?.find((item: any) => item.id === sectionId)
                const sectionLevel = activeStructureItem?.level || 3
                const sectionNameLower = activeStructureItem?.name?.toLowerCase() || ''
                const sectionWordCount = activeStructureItem?.wordCount || 0
                
                // Determine task complexity (same logic as single section)
                // This helps select the right model for each section
                let taskType: TaskRequirements['type'] = 'simple-scene'
                if (sectionLevel <= 2) {
                  taskType = 'complex-scene'
                } else if (sectionNameLower.includes('climax') || sectionNameLower.includes('confrontation') || 
                           sectionNameLower.includes('revelation') || sectionNameLower.includes('finale')) {
                  taskType = 'complex-scene'
                } else if (sectionWordCount > 1000) {
                  taskType = 'complex-scene'
                } else if (sectionNameLower.includes('dialogue') || sectionNameLower.includes('conversation') || 
                           sectionNameLower.includes('talk')) {
                  taskType = 'dialogue'
                } else if (sectionNameLower.includes('action') || sectionNameLower.includes('fight') || 
                           sectionNameLower.includes('chase') || sectionNameLower.includes('battle')) {
                  taskType = 'action'
                }
                
                // Select model for this specific section
                const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
                const modelsForWriter = additionalContext?.availableModels || MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
                
                const selectedModel = selectModelForTask(
                  {
                    type: taskType,
                    wordCount: sectionWordCount,
                    contextNeeded: 8000,
                    priority: 'balanced'
                  },
                  modelsForWriter
                )
                
                const writerModel = {
                  modelId: selectedModel?.id || 'llama-3.3-70b-versatile',
                  provider: selectedModel?.provider || 'groq',
                  reasoning: `Intelligent delegation: ${taskType} task → ${selectedModel?.displayName || 'Llama 3.3 70B'}`
                }
                
                // ✅ DEPENDENCY HANDLING:
                // For multiple sections, we only need ONE select_section action (for the first section)
                // Subsequent sections don't need navigation - they're independent content generation tasks
                const needsSelection = !request.activeContext?.id || request.activeContext.id !== sectionId
                const isFirstSection = allActions.length === 0
                
                if (needsSelection && isFirstSection) {
                  // Only add select_section for the first section that needs navigation
                  allActions.push({
                    type: 'select_section',
                    payload: {
                      sectionId: sectionId,
                      sectionName: sectionName
                    },
                    status: 'pending',
                    autoExecute: true,
                    requiresUserInput: false
                  })
                  console.log(`📍 [Multi-Section] Added select_section for first section: ${sectionName}`)
                }
                
                // Generate content action for this section
                // Note: Only the first action depends on select_section (if navigation was needed)
                // Other actions are independent and can be executed in parallel
                allActions.push({
                  type: 'generate_content',
                  payload: {
                    sectionId: sectionId,
                    sectionName: sectionName,
                    prompt: request.message,
                    model: writerModel.modelId,
                    provider: writerModel.provider
                  },
                  status: 'pending',
                  dependsOn: needsSelection && isFirstSection ? ['select_section'] : undefined,
                  autoExecute: true,
                  requiresUserInput: false
                })
              }
              
              console.log(`✅ [WriteContentAction] Created ${allActions.length} actions for ${foundSections.length} sections`)
              console.log(`   Sections: ${foundSections.map(s => s.name).join(', ')}`)
              console.log(`   📊 MultiAgentOrchestrator will analyze and decide execution strategy:`)
              console.log(`      - Sequential: Safe, one-by-one execution`)
              console.log(`      - Parallel: Fast, simultaneous execution (likely for ${foundSections.length} independent sections)`)
              console.log(`      - Cluster: High-quality iterative refinement`)
              
              // Return early - MultiAgentOrchestrator will handle execution strategy
              return allActions
            } else {
              // No sections found - fall through to single-section logic below
              console.log(`⚠️ [Multi-Section] No sections found, falling back to single-section logic`)
            }
          } else {
            // ✅ SINGLE SECTION: Use existing logic (backward compatible)
            const foundSection = findSectionByName(request.structureItems, targetSegment)
            if (foundSection) {
              messageTargetSectionId = foundSection.id
              console.log('✅ [TargetSegment Match] Found:', foundSection.name)
            } else {
              console.log(`⚠️ [TargetSegment] Could not find section matching "${targetSegment}"`)
            }
          }
        }
        
        // Fallback to pattern matching if targetSegment didn't work
        if (!messageTargetSectionId) {
        const patterns = [
            /(?:write|add|put|insert).*(?:the\s+)?(.+?)\s+section/i,
            /(?:write|add|put|insert).*(?:in|to|into)\s+(?:the\s+)?(.+?)(?:\s+(?:section|part|chapter|scene|act|sequence))?$/i,
            /(?:write|add|put|insert)\s+(?:some\s+)?(?:text|content|words).*?(?:to|in|into)\s+(?:the\s+)?(.+?)$/i,
        ]
        
        let sectionName: string | null = null
        for (const pattern of patterns) {
          const match = request.message.match(pattern)
          if (match && match[1]) {
              sectionName = match[1].trim()
              // Remove common trailing words
              sectionName = sectionName.replace(/\s+(section|part|chapter|scene|act|sequence|of the report|of the document)$/i, '').trim()
            break
          }
        }
        
        if (sectionName) {
            console.log(`🔍 [Pattern Match] Extracted section name: "${sectionName}"`)
          const foundSection = findSectionByName(request.structureItems, sectionName)
          if (foundSection) {
            messageTargetSectionId = foundSection.id
            console.log('✅ [Name Detection] Found:', foundSection.name)
            }
          }
        }
      }
      
      // Use section from message if found (overrides active context)
      if (messageTargetSectionId) {
        targetSectionId = messageTargetSectionId
        console.log('✅ [Section Override] Using section from message')
      }
    }
    
    // ============================================================
    // STEP 5: Fall back to active context
    // ============================================================
    
    if (!targetSectionId) {
      targetSectionId = request.activeContext?.id
      if (targetSectionId) {
        console.log('ℹ️ [Section Fallback] Using active context')
      }
    }
    
    // ============================================================
    // STEP 6: Generate actions if section found
    // ============================================================
    
    if (!targetSectionId) {
      return [
        this.message(
          `I want to add content, but I need you to select a section first. Which section would you like me to write in?`,
          'error'
        )
      ]
    }
    
    // Auto-select section if different from active context
    let selectSectionAction: OrchestratorAction | null = null
    if (!request.activeContext?.id || request.activeContext.id !== targetSectionId) {
      selectSectionAction = {
        type: 'select_section',
        payload: {
          sectionId: targetSectionId
        },
        status: 'pending',
        autoExecute: true, // Navigation should happen automatically
        requiresUserInput: false
      }
      actions.push(selectSectionAction)
      console.log('🎯 [Auto-Select] Selecting section:', targetSectionId)
    }
    
    // ============================================================
    // STEP 7: Determine which model to use
    // ============================================================
    
    const modelSelection = additionalContext?.modelSelection
    const availableModels = additionalContext?.availableModels
    const validatedFixedModelId = request.fixedModeStrategy ? modelSelection?.modelId : null
    
    let writerModel: any
    
    if (request.modelMode === 'fixed' && request.fixedModeStrategy === 'consistent' && validatedFixedModelId) {
      // CONSISTENT: Use the fixed model for writing
      const fixedModel = MODEL_TIERS.find(m => m.id === validatedFixedModelId)
      writerModel = {
        modelId: validatedFixedModelId,
        provider: fixedModel?.provider || modelSelection.provider,
        reasoning: `Fixed mode (Consistent): Using ${fixedModel?.displayName || validatedFixedModelId} for all tasks`
      }
      console.log('🎯 [Consistent Strategy] Using fixed model:', writerModel.modelId)
    } else {
      // AUTOMATIC or LOOSE: Intelligently select writer based on section complexity
      const activeStructureItem = request.structureItems?.find(item => item.id === targetSectionId)
      const sectionLevel = activeStructureItem?.level || 3
      const sectionName = activeStructureItem?.name?.toLowerCase() || ''
      const sectionWordCount = activeStructureItem?.wordCount || 0
      
      // Determine task complexity
      let taskType: TaskRequirements['type'] = 'simple-scene'
      
      if (sectionLevel <= 2) {
        taskType = 'complex-scene'
      } else if (sectionName.includes('climax') || 
                 sectionName.includes('confrontation') ||
                 sectionName.includes('revelation') ||
                 sectionName.includes('finale')) {
        taskType = 'complex-scene'
      } else if (sectionWordCount > 1000) {
        taskType = 'complex-scene'
      } else if (sectionName.includes('dialogue') || 
                 sectionName.includes('conversation') ||
                 sectionName.includes('talk')) {
        taskType = 'dialogue'
      } else if (sectionName.includes('action') || 
                 sectionName.includes('fight') ||
                 sectionName.includes('chase') ||
                 sectionName.includes('battle')) {
        taskType = 'action'
      }
      
      // Select best model for this task
      const availableProviders = request.availableProviders || ['openai', 'groq', 'anthropic', 'google']
      const modelsForWriter = availableModels || MODEL_TIERS.filter(m => availableProviders.includes(m.provider))
      
      const selectedModel = selectModelForTask(
        {
          type: taskType,
          wordCount: sectionWordCount,
          contextNeeded: 8000,
          priority: 'balanced'
        },
        modelsForWriter
      )
      
      writerModel = {
        modelId: selectedModel?.id || 'llama-3.3-70b-versatile',
        provider: selectedModel?.provider || 'groq',
        reasoning: `Intelligent delegation: ${taskType} task → ${selectedModel?.displayName || 'Llama 3.3 70B'}`
      }
      
      console.log('💡 [Intelligent Delegation]', {
        section: activeStructureItem?.name,
        level: sectionLevel,
        taskType,
        selectedModel: writerModel.modelId
      })
    }
    
    // Generate content action with dependency metadata
    // ✅ NEW: Mark generate_content as depending on select_section and auto-executable
    actions.push({
      type: 'generate_content',
      payload: {
        sectionId: targetSectionId,
        prompt: request.message,
        model: writerModel.modelId,
        provider: writerModel.provider
      },
      status: 'pending',
      dependsOn: selectSectionAction ? ['select_section'] : undefined, // Depends on navigation if it was needed
      autoExecute: true, // Should execute automatically after dependencies are met
      requiresUserInput: false // No user confirmation needed
    })
    
    console.log('✅ [WriteContentAction] Created actions:', {
      section: targetSectionId,
      model: writerModel.modelId,
      provider: writerModel.provider
    })
    
    return actions
  }
}

