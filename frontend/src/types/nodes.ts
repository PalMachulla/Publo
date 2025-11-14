export interface Comment {
  id: string
  text: string
  author: string
  author_id: string
  created_at: string
}

export type NodeType = 'story' | 'docs' | 'character' | 'location' | 'research' | 'context' | 'create-story' | 'story-draft' | 'cluster' | 'story-structure'

export interface BaseNodeData {
  label: string
  description?: string
  comments: Comment[]
  nodeType: NodeType
}

export type BookRole = 'Baseline' | 'Influence' | 'Writing Style' | 'Inform'

export interface StoryNodeData extends BaseNodeData {
  nodeType: 'story'
  bookId?: string
  bookTitle?: string
  bookAuthor?: string
  year?: number
  role?: BookRole
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
export type CharacterVisibility = 'private' | 'shared' | 'public'

export interface Character {
  id: string
  user_id: string
  name: string
  bio?: string
  photo_url?: string
  visibility: CharacterVisibility
  role?: CharacterRole
  created_at: string
  updated_at: string
}

export interface CharacterNodeData extends BaseNodeData {
  nodeType: 'character'
  characterId?: string // Reference to character in characters table
  characterName?: string
  bio?: string
  photoUrl?: string
  image?: string // For display on canvas (same as photoUrl)
  role?: CharacterRole
  visibility?: CharacterVisibility
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

export interface ResearchNodeData extends BaseNodeData {
  nodeType: 'research'
  prompt?: string
  status?: 'idle' | 'researching' | 'completed' | 'error'
  queries?: string[]
  results?: Array<{
    id: string
    query: string
    url: string
    title?: string
    snippet?: string
    scrapedContent?: string
    timestamp: string
  }>
  summary?: string
  error?: string
}

export interface ContextCanvasData {
  placeholder?: string
  content?: string
  comments: Comment[]
}

export interface CreateStoryNodeData extends BaseNodeData {
  nodeType: 'create-story'
  isOrchestrating?: boolean // Whether the orchestrator is active
  orchestratorProgress?: number // Progress percentage (0-100)
  loadingText?: string // Text to show below logo during operations
}

export type StoryDraftStatus = 'draft' | 'active' | 'published'

export type StoryFormat = 'novel' | 'report' | 'short-story' | 'article' | 'screenplay' | 'essay' | 'podcast'

export interface StoryDraftNodeData extends BaseNodeData {
  nodeType: 'story-draft'
  storyId: string
  title: string
  status: StoryDraftStatus
  format: StoryFormat
  content: string
  parentStoryId?: string
  createdAt: string
  updatedAt: string
  preview?: string
}

export type AgentSpecialization = 
  | 'character_voice' 
  | 'historical_accuracy' 
  | 'genre_conventions'
  | 'world_rules' 
  | 'tone_style' 
  | 'research' 
  | 'custom'

export type ConsultationDepth = 'quick' | 'detailed' | 'comprehensive'
export type ResponseStyle = 'directive' | 'suggestive' | 'analytical' | 'reference_based'
export type ResponseLengthLimit = 'brief' | 'moderate' | 'detailed' | 'unlimited'
export type ResourceUsageMode = 'full_text' | 'summaries' | 'on_demand' | 'indexed'
export type ResourceType = 'character_profile' | 'world_bible' | 'style_sample' | 'research' | 'previous_segments'

export interface ConsultationTriggers {
  onSegmentStart: boolean
  onDemand: boolean
  automaticTriggers: string[] // keywords that auto-invoke
  onSegmentReview: boolean
}

export interface ResponsePreferences {
  includeExamples: boolean
  citeSources: boolean
  offerAlternatives: 'always' | 'when_relevant' | 'no'
  showConfidence: boolean
}

export interface ResourceConnection {
  resourceId: string
  resourceType: ResourceType
  priority: number // 0-100
  autoTriggerKeywords: string[]
  usageMode: ResourceUsageMode
  sections?: string[] // for world bible sections
}

export interface ClusterNodeData extends BaseNodeData {
  nodeType: 'cluster'
  clusterNodes?: string[] // IDs of nodes in this cluster
  color?: string // Background color for the cluster node
  isActive?: boolean // Active or passive status
  agentNumber?: number // Incremental agent number (e.g., 1 for AG001)
  
  // Agent Identity
  specialization?: AgentSpecialization
  
  // Consultation Behavior
  consultationTriggers?: ConsultationTriggers
  consultationDepth?: ConsultationDepth
  responseStyle?: ResponseStyle
  proactivityLevel?: number // 0-100
  
  // Knowledge & Resources
  connectedResources?: ResourceConnection[]
  contextAwareness?: number // 0-100
  canAccessDraft?: boolean
  canAccessOtherAgents?: boolean
  canAccessExternalTools?: boolean
  
  // Interaction
  exampleQueries?: string[]
  responsePreferences?: ResponsePreferences
  
  // Model & Voice
  modelSelection?: string
  expertPersonality?: number // 0 (formal) - 100 (casual)
  temperature?: number // 0.0-1.0
  
  // Efficiency
  responseLengthLimit?: ResponseLengthLimit
  tokenBudget?: number
  maxConsultations?: number | null
}

export interface StoryStructureItem {
  id: string
  level: number
  parentId?: string // Reference to parent item ID for hierarchy
  name: string // e.g., "Chapter 1", "Act I", "Episode 1"
  title?: string
  description?: string
  order: number
  completed?: boolean
  content?: string
  expanded?: boolean // Whether child items are visible
  wordCount?: number // Word count for this section
  startPosition?: number // Starting word position in document
  assignedAgentId?: string // Node ID of assigned agent/cluster
  assignedAgentNumber?: number // e.g., 6 for AG006
  assignedAgentColor?: string // Hex color from agent node for overlay
  backgroundColor?: string // Custom background color (inherited by children with fade)
}

export interface AgentOption {
  id: string
  agentNumber: number
  color: string
  label: string
  isActive?: boolean
}

export interface StoryStructureNodeData extends BaseNodeData {
  nodeType: 'story-structure'
  format: StoryFormat
  storyId?: string
  items: StoryStructureItem[] // The structural items (chapters, scenes, etc.)
  activeLevel: number // Which hierarchy level is currently being displayed (1 = top level)
  onItemClick?: (item: StoryStructureItem, allItems: StoryStructureItem[], format: StoryFormat, nodeId: string) => void // Callback when item is clicked
  onItemsUpdate?: (items: StoryStructureItem[]) => void // Callback when items are updated (e.g., expanded state)
  onWidthUpdate?: (width: number) => void // Callback when narration width changes
  template?: string // The selected template ID
  isLoading?: boolean // Whether the node is still being prepared
  customNarrationWidth?: number // Custom width for narration line view
  showAgentRows?: boolean // Toggle state for agent assignment UI
  availableAgents?: AgentOption[] // List of available agent nodes
  onAgentAssign?: (itemId: string, agentId: string | null) => void // Callback when agent is assigned/unassigned
}

export type AnyNodeData = StoryNodeData | DocsNodeData | CharacterNodeData | LocationNodeData | ResearchNodeData | ContextCanvasData | CreateStoryNodeData | StoryDraftNodeData | ClusterNodeData | StoryStructureNodeData

export interface Story {
  id: string
  user_id: string
  title: string
  description?: string | null
  is_public?: boolean | null
  shared?: boolean | null
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

