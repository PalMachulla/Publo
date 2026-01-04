'use client'

import { memo, useMemo } from 'react'
import type { Node, Edge } from 'reactflow'
import type { ProjectTreeSelection, FocusedContent } from '@/types/focused-content'
import type { StoryStructureItem } from '@/types/nodes'
import type { SectionCardDisplay } from '@/types/librarian'
import type { CharacterNodeData } from '@/types/nodes'
import NarrationCardView from '../document/NarrationCardView'
import CharacterProfilePanel from './CharacterProfilePanel'

interface ContentRendererProps {
  /** Current selection from the project tree */
  selection: ProjectTreeSelection | null
  /** All canvas nodes */
  canvasNodes: Node[]
  /** All canvas edges */
  canvasEdges: Edge[]
  /** Story structure items for the active story */
  structureItems: StoryStructureItem[]
  /** Section cards for the active story (Librarian data) */
  sectionCards: SectionCardDisplay[]
  /** Currently active section ID */
  activeSectionId: string | null
  /** User ID */
  userId: string
  /** Story ID */
  storyId: string
  /** Callback when section is clicked in librarian view */
  onSectionClick: (sectionId: string) => void
  /** Content for the document editor */
  contentMap: Record<string, string>
  /** Streaming content from orchestrator */
  streamingContent: Record<string, { sectionId: string; content: string; isComplete: boolean }>
  /** Set of section IDs currently being written */
  writingSectionIds: string[]
  /** Theme colors for cards */
  themeColors: Record<string, string>
  /** Callback when theme color changes */
  onColorChange?: (itemId: string, color: string) => void
  /** Render the document editor content */
  renderDocumentContent?: () => JSX.Element
  /** Render character panel in embedded mode */
  renderCharacterPanel?: (node: Node<CharacterNodeData>) => JSX.Element
  /** Render research panel in embedded mode */
  renderResearchPanel?: (node: Node) => JSX.Element
  /** Callback to update a node */
  onNodeUpdate?: (nodeId: string, data: any) => void
  /** Callback to delete a node */
  onNodeDelete?: (nodeId: string) => void
}

/**
 * Routes project tree selection to the appropriate content panel.
 * Handles: stories, sections, librarian (cards), characters, research
 */
function ContentRenderer({
  selection,
  canvasNodes,
  structureItems,
  sectionCards,
  activeSectionId,
  onSectionClick,
  writingSectionIds,
  themeColors,
  onColorChange,
  renderDocumentContent,
  renderCharacterPanel,
  renderResearchPanel,
  userId,
  storyId,
  onNodeUpdate,
  onNodeDelete,
}: ContentRendererProps) {
  // Find the selected canvas node if applicable
  const selectedCanvasNode = useMemo(() => {
    if (!selection?.canvasNodeId) return null
    return canvasNodes.find(n => n.id === selection.canvasNodeId) || null
  }, [selection?.canvasNodeId, canvasNodes])

  // No selection - show placeholder
  if (!selection) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Select an item from the tree</p>
        </div>
      </div>
    )
  }

  // Route based on selection type
  switch (selection.type) {
    case 'story':
    case 'section':
      // Render document editor
      if (renderDocumentContent) {
        return renderDocumentContent()
      }
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Document editor loading...</p>
        </div>
      )

    case 'librarian':
      // Render Cards view (NarrationCardView)
      return (
        <div className="h-full overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 z-10">
            <h2 className="text-sm font-medium text-gray-900">Librarian Cards</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Section summaries, characters, and story intelligence
            </p>
          </div>
          
          {/* Cards content */}
          <div className="p-4">
            {structureItems.length > 0 ? (
              <NarrationCardView
                structureItems={structureItems}
                activeSectionId={activeSectionId}
                onSectionClick={onSectionClick}
                themeColors={themeColors}
                onColorChange={onColorChange}
                sectionCards={sectionCards}
                writingSectionIds={writingSectionIds}
              />
            ) : (
              <div className="text-center text-gray-400 py-8">
                <p className="text-sm">No sections yet.</p>
                <p className="text-xs mt-1">Create a story structure to see Librarian cards.</p>
              </div>
            )}
          </div>
        </div>
      )

    case 'character':
      // Render character profile panel
      // Use key with serialized attributes to force re-render when attributes change
      if (selectedCanvasNode && userId && storyId && onNodeUpdate && onNodeDelete) {
        const charData = selectedCanvasNode.data as CharacterNodeData
        const attributesKey = JSON.stringify(charData.attributes || {})
        return (
          <CharacterProfilePanel
            key={`${selectedCanvasNode.id}-${attributesKey}`}
            node={selectedCanvasNode as Node<CharacterNodeData>}
            onUpdate={onNodeUpdate}
            onDelete={onNodeDelete}
            userId={userId}
            storyId={storyId}
            embedded
          />
        )
      }
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Character not found</p>
        </div>
      )

    case 'research':
      // Render research panel (embedded mode)
      if (selectedCanvasNode && renderResearchPanel) {
        return (
          <div className="h-full overflow-y-auto">
            {renderResearchPanel(selectedCanvasNode)}
          </div>
        )
      }
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Research document not found</p>
        </div>
      )

    case 'folder':
      // Folders don't show content - prompt to select a child
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">{selection.name}</p>
            <p className="text-xs mt-1">Select an item from this folder</p>
          </div>
        </div>
      )

    default:
      return (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p className="text-sm">Unknown content type</p>
        </div>
      )
  }
}

export default memo(ContentRenderer)

/**
 * Convert ProjectTreeSelection to FocusedContent for the orchestrator
 */
export function selectionToFocusedContent(
  selection: ProjectTreeSelection | null,
  canvasNodes: Node[]
): FocusedContent | null {
  if (!selection) return null

  // Find the canvas node for additional data
  const node = selection.canvasNodeId 
    ? canvasNodes.find(n => n.id === selection.canvasNodeId)
    : null

  switch (selection.type) {
    case 'story':
      return {
        type: 'story',
        nodeId: selection.canvasNodeId || selection.nodeId,
        name: selection.name,
        data: {
          format: node?.data?.format,
        },
      }

    case 'section':
      return {
        type: 'section',
        nodeId: selection.canvasNodeId || selection.nodeId,
        sectionId: selection.sectionId,
        name: selection.name,
      }

    case 'librarian':
      return {
        type: 'librarian',
        nodeId: selection.canvasNodeId || selection.nodeId,
        name: `Librarian for ${selection.name}`,
      }

    case 'character':
      return {
        type: 'character',
        nodeId: selection.canvasNodeId || selection.nodeId,
        name: selection.name,
        data: {
          bio: node?.data?.bio,
          role: node?.data?.role,
        },
      }

    case 'research':
      return {
        type: 'research',
        nodeId: selection.canvasNodeId || selection.nodeId,
        name: selection.name,
        data: {
          content: node?.data?.content,
        },
      }

    default:
      return null
  }
}
