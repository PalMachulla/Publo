/**
 * Pattern Matching Rules for Intent Triage
 * 
 * Extracted from intentRouter.ts for fast, pattern-based classification.
 * These patterns handle 80% of simple requests instantly.
 */

import type { UserIntent, IntentAnalysis } from '../../../intentRouter'

/**
 * Simple patterns that indicate clear, unambiguous intents
 */
export const SIMPLE_PATTERNS = {
  // Write content (when segment is selected)
  write: [
    /^write/i,
    /^expand/i,
    /^continue/i,
    /^add (more|content)/i,
    /^fill in/i,
    /^develop/i,
    /more (content|writing|text)/i,
    /^extend/i,
    /^flesh out/i,
  ],
  
  // Delete/remove node
  delete: [
    /^(remove|delete|get rid of|discard|trash|eliminate).*(the |this |that )?(novel|screenplay|report|podcast|story|node)/i,
    /(remove|delete).*(node|document|story)/i,
    /^(remove|delete)/i,
  ],
  
  // Answer question
  answer: [
    /^what/i,
    /^why/i,
    /^how/i,
    /^when/i,
    /^who/i,
    /^where/i,
    /^explain/i,
    /^describe/i,
    /^tell me (about|why|how|what)/i,
    /^can you (tell|explain|describe)/i,
    /^help me (figure out|understand|with)/i,
    /what (is|are|does|was|were)/i,
    /what.*all about/i,
    /\?$/,
  ],
  
  // Navigate section (when document is open)
  navigate: [
    /^(go to|jump to|navigate to|show me|open|scroll to|take me to)\s+(the\s+)?(chapter|section|scene|act|part|sequence|beat)/i,
    /^(go to|jump to|navigate to|show me)\s+(chapter|section|scene|act|part|beat)\s+\d+/i,
    /^(scene|beat)\s+\d+/i,
    /^(open|show|go to)\s+(scene|beat)/i,
    /^(chapter|section|scene|act|part|sequence|beat)\s+\d+/i,
  ],
  
  // Open and write (when canvas node is referenced)
  openAndWrite: [
    /^(open|show|display|view).*(the|that|this|my|our) (novel|screenplay|report|podcast|document|node)/i,
    /^let'?s (open|work on|edit).*(the|that|this|my|our) (novel|screenplay|report|podcast|document)/i,
    // CRITICAL: "write [sections] in [our/the/my] [document]" pattern
    /(write|craft|fill|expand|develop).*(the|first|second|third|three|two|1|2|3).*(chapter|act|scene|section|episode).*(in |to |for )(our|the|that|this|my) (novel|screenplay|report|podcast|document)/i,
    /(craft|write|fill|expand|develop).*(in |to )(that|the|this|my|our) (node|document|podcast|screenplay|novel|report)/i,
    /(add|put|insert|write|get).*(content|text|words).*(in |to |for )(that|the|this|my|our)/i,
    /(work on|edit|improve).*(that|the|this|my|our) (node|document|podcast|screenplay|novel|report)/i,
    /help (me )?(craft|write|fill|expand).*(node|document|podcast|screenplay|novel|report)/i,
    /(get|add|create|generate).*(content|text|words).*(to|for|in) (my|the|that|this|our) (podcast|screenplay|novel|report|document)/i,
    /help (me )?(get|add|create).*(my|the|that|our) (podcast|screenplay|novel|report|document)/i,
    /help (me )?with (the|my|that|this|our) (podcast|screenplay|novel|report|document)/i,
  ],
  
  // Improve content (when segment is selected)
  improve: [
    /^improve/i,
    /^refine/i,
    /^polish/i,
    /^edit/i,
    /^revise/i,
    /^enhance/i,
    /make (it )?better/i,
    /more (vivid|descriptive|engaging)/i,
  ],
  
  // Rewrite with coherence (when segment is selected)
  rewriteCoherence: [
    /keep (it |the story |everything )?coherent/i,
    /maintain consistency/i,
    /(update|fix|adjust|revise) (earlier|previous|other|related) (sections?|parts?|chapters?)/i,
    /and (also )?(update|change|fix|adjust|rewrite) (earlier|previous|related)/i,
    /make sure (it |everything )?makes sense/i,
    /(rewrite|change).*(and|then) (update|fix|adjust)/i,
    /fix (any )?continuity/i,
    /keep (the )?story consistent/i,
  ],
  
  // Modify structure
  modifyStructure: [
    /add (a |an )?(chapter|section|act|scene)/i,
    /remove (this |the )?(chapter|section|act|scene)/i,
    /rename/i,
    /reorder/i,
    /move (this |the )?section/i,
  ],
}

/**
 * Complex patterns that indicate multi-step or ambiguous requests
 * These need deeper analysis
 */
export const COMPLEX_PATTERNS = [
  /based\s+on/i,
  /using\s+the/i,
  /interview.*characters/i,
  /\band\s+(then|also)\b/i, // Multi-step indicators
  /create.*and.*write/i,
  /write.*and.*update/i,
  /make.*and.*fill/i,
]

/**
 * Structure creation patterns (only when document panel is closed)
 */
export const STRUCTURE_PATTERNS = [
  /create (a |an )?story/i,
  /create (a |an )?(novel|screenplay|article|report|podcast|interview)/i,
  /generate (a )?structure/i,
  /plan (a )?story/i,
  /outline/i,
  /^i want to (write|create)/i,
  /make (a |an )?interview/i,
  /interview (the )?characters/i,
  /base(d)? (this|it) on/i,
  /using (the |our )?screenplay/i,
  /adapt (the |our )?(screenplay|story|novel)/i,
]

