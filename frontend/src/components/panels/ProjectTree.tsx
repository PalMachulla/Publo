'use client'

import { memo, useMemo, useState, useEffect } from 'react'
import type { Node } from 'reactflow'
import type { StoryStructureItem } from '@/types/nodes'
import type { ProjectTreeNode, ProjectTreeSelection } from '@/types/focused-content'

interface ProjectTreeProps {
  canvasNodes: Node[]
  /** Currently selected story structure node */
  activeStoryNodeId?: string | null
  /** Structure items for the active story */
  structureItems?: StoryStructureItem[]
  /** Current selection in the tree */
  selection?: ProjectTreeSelection | null
  /** Callback when selection changes */
  onSelect: (selection: ProjectTreeSelection) => void
  /** Callback to switch to a different story node */
  onSwitchStory?: (nodeId: string) => void
}

// Icon components
const FolderIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
)

const FolderOpenIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
  </svg>
)

const DocumentIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const LibrarianIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
)

const CharacterIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const ResearchIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
)

const ChevronIcon = ({ expanded, className = '' }: { expanded: boolean; className?: string }) => (
  <svg className={`${className} transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

function ProjectTree({
  canvasNodes,
  activeStoryNodeId,
  structureItems = [],
  selection,
  onSelect,
  onSwitchStory,
}: ProjectTreeProps) {
  // Track expanded nodes
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    // Default: expand the Stories folder and active story
    const initial = new Set(['folder-stories'])
    if (activeStoryNodeId) {
      initial.add(`story-${activeStoryNodeId}`)
    }
    return initial
  })

  // Auto-expand active story and its content folder when it changes
  useEffect(() => {
    if (activeStoryNodeId) {
      setExpandedNodes(prev => {
        const next = new Set(prev)
        next.add('folder-stories')
        next.add(`story-${activeStoryNodeId}`)
        next.add(`content-${activeStoryNodeId}`)  // Also expand Content folder
        return next
      })
    }
  }, [activeStoryNodeId])
  
  // Auto-expand Characters folder when a character is selected externally
  useEffect(() => {
    if (selection?.type === 'character') {
      setExpandedNodes(prev => {
        const next = new Set(prev)
        next.add('folder-characters')  // Expand the Characters folder
        return next
      })
    }
  }, [selection])

  // Build tree from canvas nodes
  const tree = useMemo((): ProjectTreeNode[] => {
    // Filter by ReactFlow type OR by data.nodeType (both patterns are used)
    const storyNodes = canvasNodes.filter(n => 
      n.type === 'storyStructureNode' || n.data?.nodeType === 'story-structure'
    )
    const characterNodes = canvasNodes.filter(n => 
      n.type === 'characterNode' || n.data?.nodeType === 'character'
    )
    const researchNodes = canvasNodes.filter(n => 
      n.type === 'researchNode' || n.data?.nodeType === 'research'
    )

    // Build story children (Librarian + Content folder) for each story
    const buildStoryChildren = (storyNode: Node): ProjectTreeNode[] => {
      const children: ProjectTreeNode[] = []

      // Add Librarian node (Cards view)
      children.push({
        id: `librarian-${storyNode.id}`,
        type: 'librarian',
        name: 'Librarian',
        canvasNodeId: storyNode.id,
        icon: '📋',
      })

      // Add Content folder with sections (only for active story that has structure items)
      if (storyNode.id === activeStoryNodeId && structureItems.length > 0) {
        // Build hierarchical structure
        const buildSectionChildren = (parentId: string | null | undefined, level: number): ProjectTreeNode[] => {
          return structureItems
            .filter(item => {
              if (parentId === null || parentId === undefined) {
                return !item.parentId || item.parentId === ''
              }
              return item.parentId === parentId
            })
            .sort((a, b) => a.order - b.order)
            .map(item => ({
              id: `section-${item.id}`,
              type: 'section' as const,
              name: item.name || item.title || 'Section',
              canvasNodeId: storyNode.id,
              sectionId: item.id,
              children: buildSectionChildren(item.id, level + 1),
            }))
        }

        // Add Content folder containing all sections
        children.push({
          id: `content-${storyNode.id}`,
          type: 'folder',
          name: 'Content',
          canvasNodeId: storyNode.id,
          icon: '📂',
          children: buildSectionChildren(null, 0),
        })
      }

      return children
    }

    // Stories folder
    const storiesFolder: ProjectTreeNode = {
      id: 'folder-stories',
      type: 'folder',
      name: 'Stories',
      icon: '📁',
      children: storyNodes.map(node => ({
        id: `story-${node.id}`,
        type: 'story',
        name: node.data?.name || node.data?.label || 'Untitled',
        canvasNodeId: node.id,
        format: node.data?.format,
        children: buildStoryChildren(node),
      })),
    }

    // Characters folder
    const charactersFolder: ProjectTreeNode = {
      id: 'folder-characters',
      type: 'folder',
      name: 'Characters',
      icon: '📁',
      children: characterNodes.map(node => ({
        id: `character-${node.id}`,
        type: 'character',
        name: node.data?.label || node.data?.characterName || node.data?.name || 'Unnamed',
        canvasNodeId: node.id,
      })),
    }

    // Research folder
    const researchFolder: ProjectTreeNode = {
      id: 'folder-research',
      type: 'folder',
      name: 'Research',
      icon: '📁',
      children: researchNodes.map(node => ({
        id: `research-${node.id}`,
        type: 'research',
        name: node.data?.label || node.data?.name || 'Untitled',
        canvasNodeId: node.id,
      })),
    }

    return [storiesFolder, charactersFolder, researchFolder]
  }, [canvasNodes, activeStoryNodeId, structureItems])

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const handleSelect = (node: ProjectTreeNode) => {
    // For stories, also trigger switch
    if (node.type === 'story' && node.canvasNodeId && onSwitchStory) {
      onSwitchStory(node.canvasNodeId)
    }

    onSelect({
      nodeId: node.id,
      type: node.type,
      canvasNodeId: node.canvasNodeId,
      sectionId: node.sectionId,
      name: node.name,
    })
  }

  const getIcon = (node: ProjectTreeNode, expanded: boolean) => {
    const iconClass = 'w-4 h-4'
    
    switch (node.type) {
      case 'folder':
        return expanded 
          ? <FolderOpenIcon className={`${iconClass} text-yellow-500`} />
          : <FolderIcon className={`${iconClass} text-yellow-500`} />
      case 'story':
        return <DocumentIcon className={`${iconClass} text-purple-500`} />
      case 'section':
        return <DocumentIcon className={`${iconClass} text-gray-400`} />
      case 'librarian':
        return <LibrarianIcon className={`${iconClass} text-blue-500`} />
      case 'character':
        return <CharacterIcon className={`${iconClass} text-green-500`} />
      case 'research':
        return <ResearchIcon className={`${iconClass} text-orange-500`} />
      default:
        return <DocumentIcon className={`${iconClass} text-gray-400`} />
    }
  }

  const renderNode = (node: ProjectTreeNode, level: number = 0): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = selection?.nodeId === node.id

    return (
      <div key={node.id}>
        <div
          className={`
            flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors
            ${isSelected 
              ? 'bg-yellow-100 text-yellow-900' 
              : 'hover:bg-gray-100 text-gray-700'
            }
          `}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => handleSelect(node)}
        >
          {/* Chevron */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(node.id)
              }}
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center hover:bg-gray-200 rounded"
            >
              <ChevronIcon expanded={isExpanded} className="w-3 h-3 text-gray-500" />
            </button>
          ) : (
            <span className="w-4" />
          )}

          {/* Icon */}
          {getIcon(node, isExpanded)}

          {/* Name */}
          <span className="text-sm truncate flex-1">{node.name}</span>

          {/* Format badge for stories */}
          {node.type === 'story' && node.format && (
            <span className="text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider bg-purple-100 text-purple-700">
              {node.format}
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto py-2">
      {tree.map(node => renderNode(node))}
      
      {/* Empty state */}
      {tree.every(folder => !folder.children || folder.children.length === 0) && (
        <div className="px-4 py-8 text-center text-gray-400 text-sm">
          <p>No content yet.</p>
          <p className="mt-1">Create a story on the canvas to get started.</p>
        </div>
      )}
    </div>
  )
}

export default memo(ProjectTree)
