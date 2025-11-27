/**
 * DeleteNodeAction
 * 
 * Purpose: Handle 'delete_node' intent by identifying and deleting canvas nodes
 * 
 * Flow:
 * 1. Extract node type from user message (novel, screenplay, report, podcast)
 * 2. Resolve which specific node to delete using resolveNode()
 * 3. Filter candidate nodes based on type
 * 4. Handle three scenarios:
 *    - No matches: Error message
 *    - Single match: Proceed with deletion
 *    - Multiple matches: Request clarification with options
 * 
 * Dependencies:
 * - canvasContext: All canvas nodes for searching
 * - resolveNode: Helper to identify target node
 * - blackboard: For node resolution context
 * 
 * Source: orchestratorEngine.ts lines 1780-1863
 * 
 * Example Usage:
 * ```typescript
 * const action = new DeleteNodeAction()
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

export class DeleteNodeAction extends BaseAction {
  private blackboard: Blackboard
  
  constructor(blackboard: Blackboard) {
    super()
    this.blackboard = blackboard
  }
  
  /**
   * Action type identifier
   */
  get actionType(): OrchestratorAction['type'] {
    return 'delete_node'
  }
  
  /**
   * Generate actions for delete_node intent
   * 
   * Handles node deletion with smart type detection and clarification:
   * - Detects node type from message (novel, screenplay, etc.)
   * - Uses resolveNode() to identify specific target
   * - Filters candidates by type
   * - Requests clarification if multiple matches
   * 
   * @param intent - Analyzed intent from LLM
   * @param request - Original request with user message
   * @param context - Canvas context with all nodes
   * @returns Array with delete_node, message, or request_clarification action
   */
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext
  ): Promise<OrchestratorAction[]> {
    console.log(`🗑️ [DeleteNodeAction] Processing deletion request: "${request.message}"`)
    
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
    
    console.log(`🔍 [DeleteNodeAction] Detected target type: ${targetType || 'none (will use all nodes)'}`)
    
    // ============================================================
    // STEP 2: Resolve which specific node to delete
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
    
    console.log('🗑️ [DeleteNodeAction] Search results:', {
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
      console.log(`❌ [DeleteNodeAction] No matching nodes found`)
      
      return [
        this.message(
          `I couldn't find any ${targetType || 'matching'} nodes. Could you be more specific?`,
          'error'
        )
      ]
    } else if (candidateNodes.length === 1) {
      // Scenario 2: Single match - proceed with deletion
      console.log(`✅ [DeleteNodeAction] Single match found: ${candidateNodes[0].label}`)
      
      return [{
        type: 'delete_node',
        payload: {
          nodeId: candidateNodes[0].nodeId,
          nodeName: candidateNodes[0].label
        },
        status: 'pending'
      }]
    } else {
      // Scenario 3: Multiple matches - request clarification with options
      console.log(`🤔 [DeleteNodeAction] Multiple matches found (${candidateNodes.length}), requesting clarification`)
      
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
          message: `🤔 I found ${candidateNodes.length} ${targetType || candidateNodes[0].nodeType} node(s). Which one would you like to remove?`,
          originalAction: 'delete_node',
          options
        },
        status: 'pending'
      }]
    }
  }
}

