/**
 * Message Parser
 * 
 * Detects and parses structured content in orchestrator messages
 * - Numbered lists (1., 2., 3. or 1), 2), 3))
 * - Options for ChatOptionsSelector
 */

export interface ParsedOption {
  number: number
  title: string
  description?: string
}

export interface ParsedMessage {
  hasOptions: boolean
  preamble?: string // Text before the options
  options: ParsedOption[]
  postamble?: string // Text after the options
}

/**
 * Detect if message contains a numbered list
 */
export function hasNumberedList(message: string): boolean {
  // Match patterns like:
  // 1. Something
  // 2. Another thing
  // OR
  // 1) Something
  // 2) Another thing
  const pattern = /^\s*\d+[.)]\s+.+$/gm
  const matches = message.match(pattern)
  return matches !== null && matches.length >= 2 // At least 2 options
}

/**
 * Parse numbered list from message
 */
export function parseNumberedList(message: string): ParsedMessage {
  const lines = message.split('\n')
  const options: ParsedOption[] = []
  let preamble: string[] = []
  let postamble: string[] = []
  let inOptions = false
  let afterOptions = false
  
  for (const line of lines) {
    // Match numbered list item: "1. Something" or "1) Something"
    const match = line.match(/^\s*(\d+)[.)]\s+(.+)$/)
    
    if (match) {
      const number = parseInt(match[1])
      const title = match[2].trim()
      
      // Check if next line is a description (indented or starts with dash)
      inOptions = true
      options.push({ number, title })
    } else if (inOptions && !afterOptions) {
      // Check if this is a description for the previous option
      const trimmed = line.trim()
      if (trimmed && options.length > 0) {
        // If line starts with dash or is indented, it's likely a description
        if (trimmed.startsWith('-') || trimmed.startsWith('•') || line.startsWith('  ')) {
          const lastOption = options[options.length - 1]
          lastOption.description = (lastOption.description || '') + ' ' + trimmed.replace(/^[-•]\s*/, '')
        } else if (trimmed.length > 0) {
          // Not a description, we're after options now
          afterOptions = true
          postamble.push(line)
        }
      }
    } else if (afterOptions) {
      postamble.push(line)
    } else if (!inOptions) {
      preamble.push(line)
    }
  }
  
  return {
    hasOptions: options.length >= 2,
    preamble: preamble.join('\n').trim() || undefined,
    options,
    postamble: postamble.join('\n').trim() || undefined
  }
}

/**
 * Extract question/title from preamble
 * 
 * Looks for common question patterns:
 * - "Would you like me to:"
 * - "What would you like to do?"
 * - "Choose an option:"
 */
export function extractQuestionFromPreamble(preamble?: string): string {
  if (!preamble) return 'Choose an option'
  
  // Look for question marks
  const sentences = preamble.split(/[.!?]/).map(s => s.trim()).filter(Boolean)
  const lastSentence = sentences[sentences.length - 1]
  
  // If last sentence ends with colon, it's likely the question
  if (lastSentence && lastSentence.endsWith(':')) {
    return lastSentence.slice(0, -1).trim()
  }
  
  // If last sentence is a question
  if (preamble.includes('?')) {
    const questionMatch = preamble.match(/([^.!?]*\?)/g)
    if (questionMatch) {
      return questionMatch[questionMatch.length - 1].trim()
    }
  }
  
  // Default: use last sentence or first 100 chars
  if (lastSentence && lastSentence.length < 100) {
    return lastSentence
  }
  
  return preamble.substring(0, 100).trim() + (preamble.length > 100 ? '...' : '')
}

/**
 * Convert parsed options to ChatOption format
 */
export function parsedOptionsToChatOptions(parsedOptions: ParsedOption[]): Array<{
  id: string
  title: string
  description?: string
}> {
  return parsedOptions.map(opt => ({
    id: `option-${opt.number}`,
    title: opt.title,
    description: opt.description
  }))
}

