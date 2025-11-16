import matter from 'gray-matter'
import type { StoryStructureItem } from '@/types/nodes'

export interface ParsedMarkdownStructure {
  items: StoryStructureItem[]
  contentMap: Map<string, string> // Maps structure item ID to its markdown content
}

interface YAMLStructureItem {
  id: string
  level: number
  name: string
  title?: string
  summary?: string
  parentId?: string
  wordCount?: number
  order?: number
}

/**
 * Parse markdown with YAML frontmatter to extract structure and content
 * 
 * Expected format:
 * ---
 * format: screenplay
 * title: My Story
 * structure:
 *   - id: act1
 *     level: 1
 *     name: Act I
 *     wordCount: 5000
 *   - id: act1_seq1
 *     level: 2
 *     name: Sequence 1
 *     parentId: act1
 *     wordCount: 2500
 * ---
 * 
 * # Act I
 * Content here...
 * 
 * ## Sequence 1
 * Content here...
 */
export function parseMarkdownStructure(markdown: string): ParsedMarkdownStructure {
  // Parse frontmatter
  const { data, content } = matter(markdown)
  
  const structure = data.structure as YAMLStructureItem[] | undefined
  
  if (!structure || !Array.isArray(structure)) {
    throw new Error('Markdown must contain a "structure" array in YAML frontmatter')
  }
  
  // Convert YAML structure to StoryStructureItems
  const items: StoryStructureItem[] = structure.map((item, index) => ({
    id: item.id,
    level: item.level,
    name: item.name,
    title: item.title,
    summary: item.summary, // AI-generated summary from YAML
    description: '',
    order: item.order ?? index,
    completed: false,
    content: '',
    parentId: item.parentId,
    wordCount: item.wordCount,
    expanded: item.level < 4, // Auto-expand first 3 levels
  }))
  
  // Parse content and map to structure items
  const contentMap = new Map<string, string>()
  
  // Split content by headers
  const lines = content.split('\n')
  let currentItemId: string | null = null
  let currentContent: string[] = []
  
  for (const line of lines) {
    // Check if line is a header that matches a structure item name
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    
    if (headerMatch) {
      const [, hashes, headerText] = headerMatch
      const level = hashes.length
      
      // Save previous content if any
      if (currentItemId && currentContent.length > 0) {
        contentMap.set(currentItemId, currentContent.join('\n').trim())
      }
      
      // Find matching structure item by name and level
      const matchingItem = items.find(item => {
        const nameMatch = headerText.includes(item.name) || headerText.includes(item.title || '')
        const levelMatch = item.level === level
        return nameMatch && levelMatch
      })
      
      if (matchingItem) {
        currentItemId = matchingItem.id
        currentContent = []
      } else {
        // If no match, continue adding to current content
        currentContent.push(line)
      }
    } else {
      // Add line to current content
      if (line.trim()) {
        currentContent.push(line)
      }
    }
  }
  
  // Save final content
  if (currentItemId && currentContent.length > 0) {
    contentMap.set(currentItemId, currentContent.join('\n').trim())
  }
  
  console.log('📄 Parsed markdown structure:', {
    itemsCount: items.length,
    contentMapSize: contentMap.size,
    items: items.map(i => ({ id: i.id, name: i.name, level: i.level })),
    contentKeys: Array.from(contentMap.keys()),
  })
  
  return { items, contentMap }
}

/**
 * Future: This function will be replaced/extended to generate markdown via Groq API
 * 
 * @param format - The story format (screenplay, novel, etc)
 * @param prompt - User's creative prompt
 * @param apiKey - Groq API key
 * @returns Generated markdown with structure
 */
export async function generateMarkdownWithAI(
  format: string,
  prompt: string,
  apiKey?: string
): Promise<string> {
  // TODO: Implement Groq API integration
  // For now, this is a placeholder
  throw new Error('AI generation not yet implemented. Use test node for now.')
}

