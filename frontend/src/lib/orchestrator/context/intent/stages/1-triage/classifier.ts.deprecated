/**
 * Pattern-based Intent Classifier
 * 
 * Fast pattern matching to classify simple intents.
 * Returns IntentAnalysis for high-confidence matches, null otherwise.
 */

import type { UserIntent, IntentAnalysis } from '../../../intentRouter'
import type { PipelineContext } from '../../pipeline/types'
import { SIMPLE_PATTERNS, COMPLEX_PATTERNS, STRUCTURE_PATTERNS } from './patterns'

/**
 * Try to classify intent using pattern matching
 * Returns IntentAnalysis if high-confidence match, null if needs deeper analysis
 */
export function classifyWithPatterns(
  message: string,
  context: PipelineContext
): IntentAnalysis | null {
  const normalized = message.toLowerCase().trim()
  const hasActiveSegment = !!context.activeSegment
  const documentPanelOpen = context.documentPanelOpen
  
  // PRIORITY 0: Navigation (when document is open)
  if (documentPanelOpen) {
    if (SIMPLE_PATTERNS.navigate.some(p => p.test(message))) {
      return {
        intent: 'navigate_section',
        confidence: 0.95,
        reasoning: `User wants to navigate to a specific section within the currently open ${context.documentFormat || 'document'}`,
        suggestedAction: `Find and select the requested section: "${message}"`,
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
  // PRIORITY 1: Write content (when segment is selected)
  if (hasActiveSegment) {
    if (SIMPLE_PATTERNS.write.some(p => p.test(message))) {
      return {
        intent: 'write_content',
        confidence: 0.95,
        reasoning: `User explicitly requested content generation for "${context.activeSegment.name}" with keywords like "write", "expand", or "continue"`,
        suggestedAction: `Generate content for the selected section: "${context.activeSegment.name}"`,
        requiresContext: true,
        suggestedModel: 'writer'
      }
    }
    
    // Rewrite with coherence
    if (SIMPLE_PATTERNS.rewriteCoherence.some(p => p.test(message))) {
      return {
        intent: 'rewrite_with_coherence',
        confidence: 0.95,
        reasoning: `User wants multi-section operation: modify "${context.activeSegment.name}" and/or other sections (coherence/batch generation)`,
        suggestedAction: `Analyze dependencies, write/rewrite sections, and ensure story consistency`,
        requiresContext: true,
        suggestedModel: 'orchestrator'
      }
    }
    
    // Improve content
    if (SIMPLE_PATTERNS.improve.some(p => p.test(message))) {
      return {
        intent: 'improve_content',
        confidence: 0.9,
        reasoning: `User wants to improve existing content in "${context.activeSegment.name}"`,
        suggestedAction: `Refine and enhance the content in: "${context.activeSegment.name}"`,
        requiresContext: true,
        suggestedModel: 'editor'
      }
    }
  }
  
  // PRIORITY 2: Delete node
  if (SIMPLE_PATTERNS.delete.some(p => p.test(message))) {
    return {
      intent: 'delete_node',
      confidence: 0.9,
      reasoning: 'User wants to delete/remove a canvas node',
      suggestedAction: 'Identify which node to delete and confirm with user',
      requiresContext: false,
      suggestedModel: 'orchestrator'
    }
  }
  
  // PRIORITY 3: Answer question (regardless of context)
  if (SIMPLE_PATTERNS.answer.some(p => p.test(message))) {
    return {
      intent: 'answer_question',
      confidence: 0.9,
      reasoning: 'User is asking for explanation or information based on interrogative patterns',
      suggestedAction: 'Answer the user\'s question using orchestrator model in chat',
      requiresContext: false,
      suggestedModel: 'orchestrator'
    }
  }
  
  // PRIORITY 4: Open and write (when canvas node is referenced)
  if (!documentPanelOpen && !hasActiveSegment && context.canvasContext) {
    if (SIMPLE_PATTERNS.openAndWrite.some(p => p.test(message))) {
      return {
        intent: 'open_and_write',
        confidence: 0.95,
        reasoning: 'User wants to write content in an existing canvas node - will auto-open document',
        suggestedAction: 'Open the referenced document and prepare for content writing',
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
  // PRIORITY 5: Structure creation (only when document panel is closed)
  if (!documentPanelOpen && !hasActiveSegment) {
    if (STRUCTURE_PATTERNS.some(p => p.test(message))) {
      return {
        intent: 'create_structure',
        confidence: 0.9,
        reasoning: 'User wants to create a new story structure from scratch (document panel is closed)',
        suggestedAction: 'Generate a complete story structure using orchestrator model',
        requiresContext: false,
        suggestedModel: 'orchestrator'
      }
    }
  }
  
  // PRIORITY 6: Modify structure
  if (SIMPLE_PATTERNS.modifyStructure.some(p => p.test(message))) {
    return {
      intent: 'modify_structure',
      confidence: 0.85,
      reasoning: 'User wants to modify the existing story structure',
      suggestedAction: 'Update the story structure based on user request',
      requiresContext: false,
      suggestedModel: 'orchestrator'
    }
  }
  
  // Check for complex patterns (needs deeper analysis)
  if (COMPLEX_PATTERNS.some(p => p.test(message))) {
    return null // Needs deeper analysis
  }
  
  // No pattern match - needs deeper analysis
  return null
}

