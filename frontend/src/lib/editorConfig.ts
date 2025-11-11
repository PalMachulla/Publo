// TipTap Editor Configuration and Extensions

import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Extension } from '@tiptap/core'

// Custom extension for section anchors/markers
export const SectionAnchor = Extension.create({
  name: 'sectionAnchor',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          'data-section-id': {
            default: null,
            parseHTML: element => element.getAttribute('data-section-id'),
            renderHTML: attributes => {
              if (!attributes['data-section-id']) {
                return {}
              }
              return {
                'data-section-id': attributes['data-section-id'],
                id: `section-${attributes['data-section-id']}`
              }
            },
          },
        },
      },
    ]
  },
})

// Default editor extensions
export const getDefaultExtensions = (placeholder = 'Start writing...') => {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      bulletList: {
        keepMarks: true,
        keepAttributes: false,
      },
      orderedList: {
        keepMarks: true,
        keepAttributes: false,
      },
      blockquote: {
        HTMLAttributes: {
          class: 'border-l-4 border-gray-300 pl-4 italic',
        },
      },
      codeBlock: {
        HTMLAttributes: {
          class: 'bg-gray-100 rounded p-4 font-mono text-sm',
        },
      },
    }),
    Placeholder.configure({
      placeholder,
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
    }),
    CharacterCount,
    SectionAnchor,
  ]
}

// Editor prose styling classes (Tailwind)
export const editorProseClasses = [
  'prose',
  'prose-lg',
  'max-w-none',
  'focus:outline-none',
  // Headings
  'prose-headings:font-bold',
  'prose-headings:text-gray-900',
  'prose-h1:text-3xl',
  'prose-h1:mb-4',
  'prose-h1:mt-8',
  'prose-h2:text-2xl',
  'prose-h2:mb-3',
  'prose-h2:mt-6',
  'prose-h3:text-xl',
  'prose-h3:mb-2',
  'prose-h3:mt-4',
  // Paragraphs
  'prose-p:text-gray-700',
  'prose-p:leading-relaxed',
  'prose-p:mb-4',
  // Lists
  'prose-li:text-gray-700',
  'prose-ul:list-disc',
  'prose-ol:list-decimal',
  // Links
  'prose-a:text-blue-600',
  'prose-a:underline',
  'prose-a:hover:text-blue-800',
  // Blockquotes
  'prose-blockquote:text-gray-600',
  'prose-blockquote:border-gray-300',
  // Code
  'prose-code:bg-gray-100',
  'prose-code:px-1',
  'prose-code:py-0.5',
  'prose-code:rounded',
  'prose-code:text-sm',
  'prose-code:font-mono',
  // Strong and emphasis
  'prose-strong:font-bold',
  'prose-strong:text-gray-900',
  'prose-em:italic',
].join(' ')

// Keyboard shortcuts documentation
export const KEYBOARD_SHORTCUTS = [
  { keys: ['Cmd', 'B'], description: 'Bold' },
  { keys: ['Cmd', 'I'], description: 'Italic' },
  { keys: ['Cmd', 'U'], description: 'Underline' },
  { keys: ['Cmd', 'Shift', '7'], description: 'Ordered list' },
  { keys: ['Cmd', 'Shift', '8'], description: 'Bullet list' },
  { keys: ['Cmd', 'Shift', 'B'], description: 'Blockquote' },
  { keys: ['Cmd', 'Alt', '1'], description: 'Heading 1' },
  { keys: ['Cmd', 'Alt', '2'], description: 'Heading 2' },
  { keys: ['Cmd', 'Alt', '3'], description: 'Heading 3' },
  { keys: ['Cmd', 'Z'], description: 'Undo' },
  { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo' },
]

// Generate HTML from structure items for initial document
export function generateInitialDocumentHTML(structureItems: any[], format?: string): string {
  if (!structureItems || structureItems.length === 0) {
    return '<p></p>'
  }

  // Generate sections with proper headings
  const sections = structureItems
    .sort((a, b) => a.order - b.order)
    .map(item => {
      const headingLevel = Math.min(item.level, 3) // Max H3
      const sectionId = item.id
      
      let html = `<h${headingLevel} data-section-id="${sectionId}" id="section-${sectionId}">${item.name}</h${headingLevel}>`
      
      if (item.title) {
        html += `<p><em>${item.title}</em></p>`
      }
      
      if (item.description) {
        html += `<p class="text-gray-500">${item.description}</p>`
      }
      
      // Add placeholder paragraph for content
      html += '<p></p>'
      
      return html
    })
    .join('\n')

  return sections
}

// Extract sections from HTML content
export function extractSectionsFromHTML(html: string): { sectionId: string; content: string }[] {
  // This would use a proper HTML parser in production
  // For now, return empty array as sections are managed separately
  return []
}

// Scroll to section helper
export function scrollToSection(sectionId: string, behavior: ScrollBehavior = 'smooth') {
  const element = document.getElementById(`section-${sectionId}`)
  if (element) {
    element.scrollIntoView({ behavior, block: 'start' })
  }
}

