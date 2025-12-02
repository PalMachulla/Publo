/**
 * OpenDocumentAction
 * 
 * Purpose: Handle 'open_and_write' intent by identifying and opening canvas nodes
 * 
 * Flow:
 * 1. Extract node type from user message (novel, screenplay, report, podcast)
 * 2. Resolve which specific node to open using resolveNode()
 * 3. Filter candidate nodes based on type
 * 4. Handle three scenarios:
 *    - No matches: Error message
 *    - Single match: Open the document
 *    - Multiple matches: Request clarification with options
 * 
 * Dependencies:
 * - canvasContext: All canvas nodes for searching
 * - resolveNode: Helper to identify target node
 * - blackboard: For node resolution context
 * 
 * Source: orchestratorEngine.ts lines 1697-1780
 * 
 * Example Usage:
 * ```typescript
 * const action = new OpenDocumentAction()
 * const result = await action.generate(intent, request, context)
 * ```
 * 
 * @module orchestrator/actions/navigation
 */

import { BaseAction } from '../base/BaseAction'
import type { IntentAnalysis } from '../../context/intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../context/contextProvider'
import { resolveNode } from '../../context/contextProvider'
import type { Blackboard } from '../../core/blackboard'

export class OpenDocumentAction extends BaseAction {
  private blackboard: Blackboard
  
  constructor(blackboard: Blackboard) {
    super()
    this.blackboard = blackboard
  }
  
  /**
   * Action type identifier
   */
  get actionType(): OrchestratorAction['type'] {
    return 'open_document'
  }
  
  /**
   * Generate actions for open_and_write intent
   * 
   * Handles document opening with smart type detection and clarification:
   * - Detects node type from message (novel, screenplay, etc.)
   * - Uses resolveNode() to identify specific target
   * - Filters candidates by type
   * - Requests clarification if multiple matches
   * 
   * @param intent - Analyzed intent from LLM
   * @param request - Original request with user message
   * @param context - Canvas context with all nodes
   * @returns Array with open_document, message, or request_clarification action
   */
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext
  ): Promise<OrchestratorAction[]> {
    console.log(`📂 [OpenDocumentAction] Processing open request: "${request.message}"`)
    
    // ============================================================
    // STEP 1: Extract node type from message
    // ============================================================
    
    const lowerMessage = request.message.toLowerCase()
    let targetType: string | null = null
    
    // Extract node type from message
    if (lowerMessage.includes('novel')) targetType = 'novel'
    else if (lowerMessage.includes('screenplay')) targetType = 'screenplay'
    else if (lowerMessage.includes('report')) targetType = 'report'
    else if (lowerMessage.includes('podcast')) targetType = 'podcast'
    
    console.log(`🔍 [OpenDocumentAction] Detected target type: ${targetType || 'none (will use all nodes)'}`)
    
    // ============================================================
    // STEP 2: Resolve which specific node to open
    // ============================================================
    
    const targetNode = await resolveNode(request.message, context, this.blackboard)
    
    // ============================================================
    // STEP 3: Filter candidate nodes based on type
    // ============================================================
    
    // Search ALL nodes on canvas (not just connected ones)
    let candidateNodes = context.allNodes
    
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
      candidateNodes = candidateNodes.filter(n => 
        n.nodeType.toLowerCase() === targetNode.nodeType.toLowerCase()
      )
    }
    
    console.log('📂 [OpenDocumentAction] Search results:', {
      targetType,
      allNodesCount: context.allNodes.length,
      candidatesCount: candidateNodes.length,
      candidates: candidateNodes.map(n => ({ 
        label: n.label, 
        type: n.nodeType, 
        format: n.detailedContext?.format 
      }))
    })
    
    // ============================================================
    // STEP 4: Handle three scenarios
    // ============================================================
    
    if (candidateNodes.length === 0) {
      // Scenario 1: No matching nodes found
      console.log(`❌ [OpenDocumentAction] No matching nodes found`)
      
      return [
        this.message(
          `I couldn't find any ${targetType || 'matching'} nodes. Could you be more specific?`,
          'error'
        )
      ]
    } else if (candidateNodes.length === 1) {
      // Scenario 2: Single match - proceed with opening
      console.log(`✅ [OpenDocumentAction] Single match found: ${candidateNodes[0].label}`)
      
      // ✅ Extract targetSegment from intent if available (for auto-writing after opening)
      const targetSegment = intent.extractedEntities?.targetSegment
      console.log(`📝 [OpenDocumentAction] Target segment from intent: ${targetSegment || 'none'}`)
      
      const actions: OrchestratorAction[] = [{
        type: 'open_document',
        payload: {
          nodeId: candidateNodes[0].nodeId,
          sectionId: null, // Will be resolved after document opens
          targetSegment: targetSegment || undefined // Pass through for UI reference
        },
        status: 'pending'
      }]
      
      // ✅ ORCHESTRATOR LOGIC: If targetSegment is provided AND structureItems are available,
      // generate content actions that depend on open_document completing first
      // This keeps the logic in the orchestrator layer, not UI
      if (targetSegment && request.structureItems && request.structureItems.length > 0) {
        console.log(`📝 [OpenDocumentAction] Generating content actions for: ${targetSegment}`)
        
        // Parse targetSegment (e.g., "chapter 1, chapter 2, chapter 3")
        const sectionRefs = targetSegment.split(',').map(s => s.trim())
        
        // Type guard: structureItems is guaranteed to be defined here
        const structureItems = request.structureItems
        
        // Helper: Normalize text for fuzzy matching (reused from WriteContentAction pattern)
        const normalizeText = (text: string) => 
          text
            .toLowerCase()
            .replace(/^\d+\.?\d*\s*/, '') // Remove leading numbers
            .replace(/&/g, 'and')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        
        // Helper: Find section by reference (supports numeric, ordinal, and name-based)
        const findSectionByRef = (ref: string): any => {
          const normalizedRef = ref.toLowerCase().trim()
          
          // Strategy 1: Try numeric pattern (e.g., "chapter 1", "chapter 2")
          const numericPattern = /(chapter|act|scene|section|episode|sequence|beat)\s+(\d+|i+|ii+|iii+|iv+|v+|vi+|vii+|viii+|ix+|x+)/i
          const numericMatch = normalizedRef.match(numericPattern)
          
          if (numericMatch) {
            const type = numericMatch[1].toLowerCase()
            const numberStr = numericMatch[2].toLowerCase()
            
            // Convert Roman numerals
            const romanToNumber: Record<string, number> = {
              'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
              'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
            }
            
            const targetNumber = romanToNumber[numberStr] || parseInt(numberStr, 10)
            
            // Find matching sections by type
            const matchingSections = structureItems.filter((item: any) => {
              const itemName = (item.name || '').toLowerCase()
              if (type === 'chapter') return /(chapter|ch\.?)\s+(\d+|i+)/i.test(itemName)
              if (type === 'act') return /^act\s+(i+|[0-9]+)/i.test(itemName)
              if (type === 'scene') return /scene\s+(\d+|i+)/i.test(itemName)
              if (type === 'section') return /section\s+(\d+|i+)/i.test(itemName)
              if (type === 'episode') return /episode\s+(\d+|i+)/i.test(itemName)
              if (type === 'sequence') return /sequence\s+(\d+|i+)/i.test(itemName)
              if (type === 'beat') return /beat\s+(\d+|i+)/i.test(itemName)
              return itemName.includes(type)
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
              console.log(`✅ [OpenDocumentAction] Found section by numeric pattern: ${targetSection.name}`)
              return targetSection
            }
          }
          
          // Strategy 2: Try ordinal pattern (e.g., "first chapter", "second scene")
          const ordinalPattern = /(?:the\s+)?(first|second|third|1st|2nd|3rd|opening|initial)\s+(chapter|act|scene|section|episode|sequence|beat)/i
          const ordinalMatch = normalizedRef.match(ordinalPattern)
          
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
            const matchingSections = structureItems.filter((item: any) => {
              const itemName = (item.name || '').toLowerCase()
              if (type === 'chapter') return /(chapter|ch\.?)/i.test(itemName)
              if (type === 'act') return /^act\s+/i.test(itemName)
              if (type === 'scene') return /\bscene\b/i.test(itemName)
              if (type === 'section') return /\bsection\b/i.test(itemName)
              if (type === 'episode') return /\bepisode\b/i.test(itemName)
              if (type === 'sequence') return /\bsequence\b/i.test(itemName)
              if (type === 'beat') return /\bbeat\b/i.test(itemName)
              return itemName.includes(type)
            }).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            
            if (matchingSections[targetIndex]) {
              console.log(`✅ [OpenDocumentAction] Found section by ordinal pattern: ${matchingSections[targetIndex].name}`)
              return matchingSections[targetIndex]
            }
          }
          
          // Strategy 3: Try fuzzy name matching
          const normalizedSearch = normalizeText(ref)
          const foundSection = structureItems.find((item: any) => {
            const normalizedName = normalizeText(item.name || '')
            return normalizedName === normalizedSearch ||
                   normalizedName.includes(normalizedSearch) ||
                   normalizedSearch.includes(normalizedName)
          })
          
          if (foundSection) {
            console.log(`✅ [OpenDocumentAction] Found section by name match: ${foundSection.name}`)
            return foundSection
          }
          
          // Also check children recursively
          const findInChildren = (items: any[]): any => {
            for (const item of items) {
              if (item.children) {
                const found = findInChildren(item.children)
                if (found) return found
              }
            }
            return null
          }
          
          const foundInChildren = findInChildren(structureItems)
          if (foundInChildren) return foundInChildren
          
          return null
        }
        
        // Find all matching sections
        const sectionsToWrite = sectionRefs
          .map(ref => findSectionByRef(ref))
          .filter(Boolean) // Remove nulls
        
        if (sectionsToWrite.length > 0) {
          console.log(`✅ [OpenDocumentAction] Found ${sectionsToWrite.length} sections to write:`, sectionsToWrite.map(s => s.name))
          
          // Generate content actions for each section
          // These depend on open_document completing first (orchestrator handles sequencing)
          for (const section of sectionsToWrite) {
            actions.push({
              type: 'generate_content',
              payload: {
                sectionId: section.id,
                sectionName: section.name,
                prompt: request.message || `Write content for ${section.name}`
              },
              status: 'pending',
              dependsOn: ['open_document'], // ✅ Critical: Wait for document to open first
              autoExecute: true, // ✅ Auto-execute after dependency is met (orchestrator logic)
              requiresUserInput: false // ✅ No UI interaction needed
            })
          }
        } else {
          console.warn('⚠️ [OpenDocumentAction] Could not find sections matching:', sectionRefs)
        }
      }
      
      return actions
    } else {
      // Scenario 3: Multiple matches - request clarification with options
      console.log(`🤔 [OpenDocumentAction] Multiple matches found (${candidateNodes.length}), requesting clarification`)
      
      const options = candidateNodes.map(n => {
        const wordCount = n.detailedContext?.wordsWritten || 0
        return {
          id: n.nodeId,
          label: n.label,
          description: `${wordCount.toLocaleString()} words`
        }
      })
      
      return [{
        type: 'request_clarification',
        payload: {
          message: `🤔 I found ${candidateNodes.length} ${targetType || candidateNodes[0].nodeType} node(s). Which one would you like to open?`,
          originalAction: 'open_and_write',
          options
        },
        status: 'pending'
      }]
    }
  }
}

