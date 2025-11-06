export interface Comment {
  id: string
  text: string
  author: string
  author_id: string
  created_at: string
}

export type NodeType = 'story' | 'docs' | 'character' | 'location' | 'link' | 'context'

export interface BaseNodeData {
  label: string
  description?: string
  comments: Comment[]
  nodeType: NodeType
}

export interface StoryNodeData extends BaseNodeData {
  nodeType: 'story'
  bookId?: string
  bookTitle?: string
  bookAuthor?: string
  image?: string
}

export interface DocsNodeData extends BaseNodeData {
  nodeType: 'docs'
  documents: Array<{
    id: string
    filename: string
    fileUrl: string
    fileType: string
    fileSize: number
  }>
}

export type CharacterRole = 'Main' | 'Active' | 'Included' | 'Involved' | 'Passive'

export interface CharacterNodeData extends BaseNodeData {
  nodeType: 'character'
  characterName?: string
  bio?: string
  photoUrl?: string
  image?: string // For display on canvas (same as photoUrl)
  role?: CharacterRole
  profilerChat?: Array<{
    id: string
    question: string
    answer: string
    timestamp: string
  }>
  attributes?: Record<string, any>
}

export interface LocationNodeData extends BaseNodeData {
  nodeType: 'location'
  locationName?: string
  latitude?: number
  longitude?: number
  address?: string
}

export interface LinkNodeData extends BaseNodeData {
  nodeType: 'link'
  links: Array<{
    id: string
    url: string
    title?: string
    scrapedContent?: string
  }>
}

export interface ContextCanvasData {
  placeholder?: string
  content?: string
  comments: Comment[]
}

export type AnyNodeData = StoryNodeData | DocsNodeData | CharacterNodeData | LocationNodeData | LinkNodeData | ContextCanvasData

export interface Story {
  id: string
  user_id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
}

export interface StoryBook {
  id: string
  title: string
  author: string
  year?: number
  description?: string
  gutenberg_id?: string
  cover_url?: string
  full_text_url?: string
}

