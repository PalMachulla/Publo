/**
 * NodeDetailsPanel - Panel Router
 * 
 * 2024-12-14: REFACTORED - This is now a thin router component.
 * 
 * Original 1486-line implementation has been split into:
 * - StoryStructureMetadataPanel.tsx (metadata & embeddings for story nodes)
 * - AIPromptPanel.tsx (AI prompt node configuration)
 * - GenericNodePanel.tsx (fallback for generic nodes)
 * - PanelContainer.tsx (reusable sliding panel wrapper)
 * 
 * This component:
 * 1. Determines the node type
 * 2. Wraps content in PanelContainer
 * 3. Renders the appropriate specialized panel
 */
'use client'

import { useEffect, useRef } from 'react'
import { Node, Edge } from 'reactflow'
import { AnyNodeData, StoryStructureNodeData, AIPromptNodeData, StoryFormat } from '@/types/nodes'
import { useAuth } from '@/contexts/AuthContext'

// Panel components
import PanelContainer from './PanelContainer'
import StoryBookPanel from './StoryBookPanel'
import CharacterPanel from './CharacterPanel'
import ResearchPanel from './ResearchPanel'
import ClusterPanel from './ClusterPanel'
import StoryStructureMetadataPanel from './StoryStructureMetadataPanel'
import AIPromptPanel from './AIPromptPanel'
import GenericNodePanel from './GenericNodePanel'

// Orchestrator - direct import (leapfrogging the wrapper)
import { OrchestratorPanelStreaming } from '@/components/orchestrator/OrchestratorPanelStreaming'

import type { CreateStoryNodeData } from '@/lib/orchestrator/components/OrchestratorPanel/types'
import type { CharacterCreatedEvent, CharacterUpdatedEvent, NodesArrangedEvent } from '@/types/orchestrator-streaming-types'
import type { FocusedContent } from '@/types/focused-content'

// ============================================================================
// TYPES
// ============================================================================

interface ActiveContext {
  type: 'section' | 'segment'
  id: string
  name: string
  title?: string
  level?: number
  description?: string
}

export interface NodeDetailsPanelProps {
  node: Node<AnyNodeData> | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
  onDelete: (nodeId: string) => void
  onCreateStory?: (format: any) => void
  onAddNode?: (node: Node) => void
  onAddEdge?: (edge: Edge) => void
  edges?: Edge[]
  nodes?: Node[]
  onSelectNode?: (nodeId: string, sectionId?: string) => void
  onAddChatMessage?: (message: string, role?: 'user' | 'orchestrator', type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress') => void
  onClearChat?: () => void
  onToggleDocumentView?: () => void
  isDocumentViewOpen?: boolean
  onPanelWidthChange?: (width: number) => void
  activeContext?: ActiveContext | null
  onClearContext?: () => void
  onWriteContent?: (segmentId: string, prompt: string) => Promise<void>
  onAnswerQuestion?: (question: string) => Promise<string>
  structureItems?: any[]
  contentMap?: Record<string, string>
  currentStoryStructureNodeId?: string | null
  storyId?: string
  orchestratorNodeId?: string
  onCreateStoryNode?: (data: CreateStoryNodeData) => void
  onCreateCharacterNode?: (data: CharacterCreatedEvent) => void
  onUpdateCharacterNode?: (data: CharacterUpdatedEvent) => void
  onArrangeNodes?: (data: NodesArrangedEvent) => void
  onSelectCharacter?: (characterName: string) => void
  onSectionComplete?: (sectionId: string, content: string) => void
  onContentChunk?: (sectionId: string, chunk: string, accumulated: string) => void
  onContentComplete?: (sectionId: string, wordCount: number) => void
  activeSectionCard?: any
  /** Currently focused content in the project panel (for contextual AI commands) */
  focusedContent?: FocusedContent | null
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function NodeDetailsPanel({
  node,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onCreateStory,
  onAddNode,
  onAddEdge,
  edges = [],
  nodes = [],
  onSelectNode,
  onAddChatMessage,
  onClearChat,
  onToggleDocumentView,
  isDocumentViewOpen = false,
  onPanelWidthChange,
  activeContext = null,
  onClearContext,
  onWriteContent,
  onAnswerQuestion,
  structureItems = [],
  contentMap = {},
  currentStoryStructureNodeId = null,
  storyId,
  orchestratorNodeId,
  onCreateStoryNode,
  onCreateCharacterNode,
  onUpdateCharacterNode,
  onArrangeNodes,
  onSelectCharacter,
  onSectionComplete,
  onContentChunk,
  onContentComplete,
  activeSectionCard,
  focusedContent,
}: NodeDetailsPanelProps) {
  
  const { user } = useAuth()
  const prevNodeIdRef = useRef<string | null>(null)

  // Debug logging - only fire when node ID actually changes
  useEffect(() => {
    if (!node) return
    if (node.id === prevNodeIdRef.current) return
    
    prevNodeIdRef.current = node.id
    console.log('📋 [NodeDetailsPanel] Node selected:', {
      nodeId: node.id,
      nodeType: node.type,
      dataNodeType: (node.data as any).nodeType,
    })
  }, [node?.id])
  // Early returns AFTER all hooks
  if (!node) return null
  
  const nodeData = node.data as any
  const nodeType = nodeData.nodeType || 'story'
  
  // Don't show panel for story-draft nodes - they open the AI Document Panel
  if (nodeType === 'story-draft') {
    return null
  }

  // ============================================================================
  // RENDER - Route to appropriate panel based on nodeType
  // ============================================================================
  
  /**
   * Panel Routing:
   * - story: StoryBookPanel
   * - character: CharacterPanel
   * - research: ResearchPanel
   * - cluster: ClusterPanel
   * - aiPrompt: AIPromptPanel (extracted)
   * - create-story: OrchestratorPanelStreaming (leapfrogged)
   * - story-structure: StoryStructureMetadataPanel (extracted)
   * - default: GenericNodePanel (extracted)
   */

  return (
    <PanelContainer 
      isOpen={isOpen} 
      onWidthChange={onPanelWidthChange}
    >
      {/* Route to specialized panel based on nodeType */}
      {nodeType === 'story' ? (
        <StoryBookPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} />
      ) : nodeType === 'character' ? (
        <CharacterPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} userId={user?.id || ''} storyId={storyId || ''} />
      ) : nodeType === 'research' ? (
        <ResearchPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} />
      ) : nodeType === 'cluster' ? (
        <ClusterPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} edges={edges} nodes={nodes} />
      ) : nodeType === 'aiPrompt' ? (
        // 2024-12-14: Extracted to AIPromptPanel
        <AIPromptPanel 
          node={node as Node<AIPromptNodeData>} 
          onUpdate={onUpdate} 
          onDelete={onDelete}
          onClose={onClose}
        />
      ) : nodeType === 'create-story' ? (
        // 2024-12-14: Leapfrogging OrchestratorPanel wrapper → direct to streaming
        <OrchestratorPanelStreaming
          userId={user?.id || ''}
          storyId={storyId}
          orchestratorNodeId={node.id}
          onOrchestratorNodeUpdate={(updates) => {
            // Update the orchestrator node on the canvas so it can show live status.
            onUpdate(node.id, updates)
          }}
          onCreateStoryNode={onCreateStoryNode}
          onCharacterComplete={onCreateCharacterNode}
          onCharacterUpdated={onUpdateCharacterNode}
          onNodesArranged={onArrangeNodes}
          onSelectCharacter={onSelectCharacter}
          onToggleDocumentView={onToggleDocumentView}
          isDocumentViewOpen={isDocumentViewOpen}
          structureItems={structureItems}
          canvasNodes={nodes}
          canvasEdges={edges}
          currentStoryStructureNodeId={currentStoryStructureNodeId || undefined}
          onOpenDocument={(nodeId: string, nodeName: string) => {
            console.log('📂 [NodeDetailsPanel] Opening document:', nodeName, nodeId)
            onSelectNode?.(nodeId)
          }}
          onSelectSection={(sectionId: string, sectionName: string) => {
            console.log('📍 [NodeDetailsPanel] Selecting section:', sectionName, sectionId)
            if (currentStoryStructureNodeId) {
              onSelectNode?.(currentStoryStructureNodeId, sectionId)
            }
          }}
          onSectionComplete={onSectionComplete}
          onContentChunk={onContentChunk}
          onContentComplete={(sectionId: string, wordCount: number) => {
            console.log('🔄 [NodeDetailsPanel] Content complete:', sectionId, wordCount, 'words')
            onContentComplete?.(sectionId, wordCount)
          }}
          activeSectionCard={activeSectionCard}
          focusedContent={focusedContent}
        />
      ) : nodeType === 'story-structure' ? (
        // 2024-12-14: Extracted to StoryStructureMetadataPanel
        <StoryStructureMetadataPanel
          node={node as Node<StoryStructureNodeData>}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />
      ) : (
        // Fallback: GenericNodePanel for unknown node types
        <GenericNodePanel
          node={node}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={onClose}
        />
      )}
    </PanelContainer>
  )
}
