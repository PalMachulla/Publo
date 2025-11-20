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
 * Attempt to repair common YAML indentation issues
 * AI models sometimes generate YAML with inconsistent spacing
 */
function repairYAMLIndentation(markdown: string): string {
  console.log('🔧 Starting YAML repair...')
  
  const lines = markdown.split('\n')
  const fixed: string[] = []
  let inFrontmatter = false
  let inStructure = false
  let issuesFixed = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Track frontmatter boundaries
    if (trimmed === '---') {
      fixed.push(line)
      if (!inFrontmatter) {
        inFrontmatter = true
      } else {
        // Closing frontmatter
        inFrontmatter = false
        inStructure = false
      }
      continue
    }
    
    // Outside frontmatter - keep as-is
    if (!inFrontmatter) {
      fixed.push(line)
      continue
    }
    
    // Detect structure array start
    if (trimmed.match(/^structure:\s*$/)) {
      inStructure = true
      fixed.push('structure:')
      continue
    }
    
    // Detect when structure array ends (non-indented key at root level)
    if (inStructure && trimmed.length > 0 && !trimmed.startsWith('-') && trimmed.match(/^[a-z_]+:\s*/i) && !line.startsWith(' ')) {
      // This is a new root-level YAML key, exit structure mode
      inStructure = false
      fixed.push(line)
      continue
    }
    
    // Inside structure array - fix indentation
    if (inStructure) {
      if (trimmed.length === 0) {
        // Keep blank lines
        fixed.push('')
        continue
      }
      
      if (trimmed.startsWith('-')) {
        // List item - ensure exactly 2 spaces
        const originalIndent = line.length - line.trimStart().length
        if (originalIndent !== 2) {
          fixed.push('  ' + trimmed)
          issuesFixed++
          console.log(`  ✓ Fixed list item indent at line ${i + 1}: "${trimmed.substring(0, 30)}..."`)
        } else {
          fixed.push(line)
        }
        continue
      }
      
      // Property under a list item - ensure exactly 4 spaces
      if (trimmed.includes(':')) {
        const originalIndent = line.length - line.trimStart().length
        if (originalIndent !== 4) {
          fixed.push('    ' + trimmed)
          issuesFixed++
          console.log(`  ✓ Fixed property indent at line ${i + 1}: "${trimmed.substring(0, 30)}..."`)
        } else {
          fixed.push(line)
        }
        continue
      }
    }
    
    // Default: keep line as-is
    fixed.push(line)
  }
  
  console.log(`🔧 YAML repair complete: fixed ${issuesFixed} indentation issues`)
  return fixed.join('\n')
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
  console.log('📄 Parsing markdown structure...')
  console.log('📄 Original markdown length:', markdown.length)
  
  // Log first 50 lines of YAML frontmatter for debugging
  const yamlSection = markdown.split('---')[1]
  if (yamlSection) {
    const yamlLines = yamlSection.split('\n').slice(0, 50)
    console.log('📄 YAML frontmatter (first 50 lines):', yamlLines.join('\n'))
  }
  
  // Try to fix common YAML indentation issues before parsing
  const fixedMarkdown = repairYAMLIndentation(markdown)
  
  // Parse frontmatter
  let data, content
  try {
    const parsed = matter(fixedMarkdown)
    data = parsed.data
    content = parsed.content
  } catch (yamlError: any) {
    console.error('❌ YAML parsing failed even after repair:', yamlError)
    console.error('❌ Failed YAML section:', fixedMarkdown.split('---')[1]?.substring(0, 500))
    throw new Error(`YAML frontmatter is invalid: ${yamlError.message}\n\nPlease check the markdown format. The YAML must use exactly 2 spaces for indentation.`)
  }
  
  const structure = data.structure as YAMLStructureItem[] | undefined
  
  console.log('📊 Parsed YAML data:', {
    hasStructure: !!structure,
    isArray: Array.isArray(structure),
    structureType: typeof structure,
    structureLength: Array.isArray(structure) ? structure.length : 'N/A',
    allKeys: Object.keys(data),
    dataPreview: data
  })
  
  if (!structure || !Array.isArray(structure)) {
    console.error('❌ Missing or invalid structure field in YAML:', {
      structure,
      allData: data,
      allKeys: Object.keys(data)
    })
    throw new Error(`Markdown must contain a "structure" array in YAML frontmatter. Found: ${Object.keys(data).join(', ') || 'empty YAML'}`)
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
        // If no match, this is a sub-header (like scene headings), add to content
        currentContent.push(line)
      }
    } else {
      // Add ALL lines to current content, including blank lines (for proper paragraph separation)
      currentContent.push(line)
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

