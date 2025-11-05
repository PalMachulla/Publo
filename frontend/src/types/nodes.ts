export interface Comment {
  id: string
  text: string
  author: string
  author_id: string
  created_at: string
}

export interface StoryNodeData {
  label: string
  description?: string
  image?: string
  comments: Comment[]
}

export interface ContextCanvasData {
  placeholder?: string
  content?: string
  comments: Comment[]
}

export interface Story {
  id: string
  user_id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
}

