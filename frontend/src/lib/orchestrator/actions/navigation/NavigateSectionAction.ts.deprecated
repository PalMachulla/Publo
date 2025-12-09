/**
 * NavigateSectionAction
 * 
 * Purpose: Handle 'navigate_section' intent by finding and selecting document sections
 * 
 * Flow:
 * 1. Extract section identifier from user message
 * 2. Try three matching strategies:
 *    a) Number matching: "Chapter 1", "Scene 2", "Act 3"
 *    b) Short form matching: "scene 1", "go to beat 2"
 *    c) Name matching: "Chapter 1: The Beginning"
 * 3. Return select_section action if found, error message if not
 * 
 * Dependencies:
 * - request.structureItems: Document structure for searching
 * - request.message: User message with section reference
 * 
 * Source: orchestratorEngine.ts lines 1869-2025
 * 
 * Example Usage:
 * ```typescript
 * const action = new NavigateSectionAction()
 * const result = await action.generate(intent, request, context)
 * ```
 * 
 * @module orchestrator/actions/navigation
 */

import { BaseAction } from '../base/BaseAction'
import type { IntentAnalysis } from '../../context/intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../context/contextProvider'

export class NavigateSectionAction extends BaseAction {
  /**
   * Action type identifier
   */
  get actionType(): OrchestratorAction['type'] {
    return 'select_section'
  }
  
  /**
   * Generate actions for navigate_section intent
   * 
   * Uses three matching strategies to find the target section:
   * 1. Number matching: Matches "Chapter 1", "Scene 2", etc.
   * 2. Short form: Matches "scene 1", "go to beat 2", etc.
   * 3. Name matching: Matches section names with fuzzy matching
   * 
   * @param intent - Analyzed intent from LLM
   * @param request - Original request with user message and structure
   * @param context - Canvas context (not used for this action)
   * @returns Array with select_section or message action
   */
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext
  ): Promise<OrchestratorAction[]> {
    console.log(`🧭 [NavigateSectionAction] Processing navigation request: "${request.message}"`)
    
    const lowerMessage = request.message.toLowerCase()
    let targetSectionId: string | null = null
    let targetSectionName: string | null = null
    
    // ============================================================
    // STEP 1: Validate structure items exist
    // ============================================================
    
    if (!request.structureItems || request.structureItems.length === 0) {
      console.log(`❌ [NavigateSectionAction] No structure items available`)
      return [
        this.message(
          `I couldn't find that section. Could you be more specific about which section you want to navigate to?`,
          'error'
        )
      ]
    }
    
    // ============================================================
    // STEP 2: Try number matching (e.g., "Chapter 1", "Scene 2")
    // ============================================================
    
    const numberMatch = lowerMessage.match(/(chapter|section|scene|act|part|sequence|beat)\s+(\d+)/i)
    if (numberMatch) {
      const sectionType = numberMatch[1].toLowerCase()
      const sectionNumber = parseInt(numberMatch[2])
      
      console.log('🔍 [NavigateSectionAction] Searching by number:', { sectionType, sectionNumber })
      
      // Recursive function to find section by number and type
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
        console.log('✅ [NavigateSectionAction] Found by number:', foundSection.name)
      }
    }
    
    // ============================================================
    // STEP 3: Try short form matching (e.g., "scene 1", "go to beat 2")
    // ============================================================
    
    if (!targetSectionId) {
      const shortMatch = lowerMessage.match(/(?:go to |jump to |open |show |navigate to )?(scene|beat|chapter|section)\s+(\d+)/i)
      if (shortMatch) {
        const type = shortMatch[1].toLowerCase()
        const num = parseInt(shortMatch[2])
        
        console.log('🔍 [NavigateSectionAction] Short form search:', { type, num })
        
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
          console.log('✅ [NavigateSectionAction] Found by short form:', foundSection.name)
        }
      }
    }
    
    // ============================================================
    // STEP 4: Try name matching (e.g., "Chapter 1: The Beginning")
    // ============================================================
    
    if (!targetSectionId) {
      const namePattern = /(chapter|section|scene|act|part|sequence|beat)\s+\d+:?\s*(.+?)$/i
      const nameMatch = lowerMessage.match(namePattern)
      
      if (nameMatch && nameMatch[2]) {
        const searchTerm = nameMatch[2].trim().toLowerCase()
        
        console.log('🔍 [NavigateSectionAction] Searching by name:', searchTerm)
        
        // Normalize text for fuzzy matching
        const normalizeText = (text: string) => 
          text
            .toLowerCase()
            .replace(/^\d+\.?\d*\s*/, '')
            .replace(/&/g, 'and')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        
        const normalizedSearch = normalizeText(searchTerm)
        
        const findByName = (items: any[]): any => {
          for (const item of items) {
            const normalizedName = normalizeText(item.name || '')
            
            if (normalizedName === normalizedSearch || 
                normalizedName.includes(normalizedSearch) || 
                normalizedSearch.includes(normalizedName)) {
              return item
            }
            if (item.children) {
              const found = findByName(item.children)
              if (found) return found
            }
          }
          return null
        }
        
        const foundSection = findByName(request.structureItems)
        if (foundSection) {
          targetSectionId = foundSection.id
          targetSectionName = foundSection.name
          console.log('✅ [NavigateSectionAction] Found by name:', foundSection.name)
        }
      }
    }
    
    // ============================================================
    // STEP 5: Return result
    // ============================================================
    
    console.log('🧭 [NavigateSectionAction] Search results:', {
      message: request.message,
      targetSectionId,
      targetSectionName,
      hasStructure: !!request.structureItems?.length
    })
    
    if (targetSectionId) {
      // Found the section - navigate to it
      return [{
        type: 'select_section',
        payload: {
          sectionId: targetSectionId,
          sectionName: targetSectionName
        },
        status: 'pending'
      }]
    } else {
      // Could not find the section
      return [
        this.message(
          `I couldn't find that section. Could you be more specific about which section you want to navigate to?`,
          'error'
        )
      ]
    }
  }
}

