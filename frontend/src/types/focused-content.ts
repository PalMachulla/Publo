/**
 * Represents the currently focused/active content in the ProjectContentPanel.
 * This is passed to the orchestrator so the AI knows what the user is viewing.
 */
export interface FocusedContent {
  /** Type of content being viewed */
  type: 'story' | 'section' | 'librarian' | 'character' | 'research'
  /** Canvas node ID */
  nodeId: string
  /** Section ID within a story (for section type) */
  sectionId?: string
  /** Display name of the content */
  name: string
  /** Additional data for context */
  data?: {
    bio?: string
    role?: string
    content?: string
    format?: string
  }
}

/**
 * Represents a node in the ProjectTree component
 */
export interface ProjectTreeNode {
  /** Unique identifier for the tree node */
  id: string
  /** Type of tree node */
  type: 'folder' | 'story' | 'section' | 'librarian' | 'character' | 'research'
  /** Display name */
  name: string
  /** Canvas node ID (if backed by a canvas node) */
  canvasNodeId?: string
  /** Section ID (for section nodes) */
  sectionId?: string
  /** Story format (for story nodes) */
  format?: string
  /** Child nodes */
  children?: ProjectTreeNode[]
  /** Whether this node is expanded in the tree */
  isExpanded?: boolean
  /** Icon to display (optional override) */
  icon?: string
}

/**
 * Selection state for the project tree
 */
export interface ProjectTreeSelection {
  nodeId: string
  type: ProjectTreeNode['type']
  canvasNodeId?: string
  sectionId?: string
  name: string
}
