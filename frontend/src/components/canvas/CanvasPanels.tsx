/**
 * CanvasPanels - Canvas panel components wrapper
 * 
 * Wraps and coordinates:
 * - NodeDetailsPanel (node details and orchestrator)
 * - AIDocumentPanel (document editing)
 * 
 * Architecture Notes:
 * - Coordinates panel state between NodeDetailsPanel and AIDocumentPanel
 * - Handles callbacks for document operations
 * - Manages WorldState instance sharing
 * 
 * @see NodeDetailsPanel for node details UI
 * @see AIDocumentPanel for document editing UI
 * @see canvas/page.tsx for original implementation
 */

import React from 'react'
import { Node, Edge } from 'reactflow'
import NodeDetailsPanel from '@/components/panels/NodeDetailsPanel'
import AIDocumentPanel from '@/components/panels/AIDocumentPanel'
import type { WorldStateManager } from '@/lib/orchestrator/core/worldState'
import { StoryFormat } from '@/types/nodes'

export interface CanvasPanelsProps {
  // Node details panel
  selectedNode: Node | null
  isPanelOpen: boolean
  onClosePanel: () => void
  onNodeUpdate: (nodeId: string, newData: any) => void
  onNodeDelete: (nodeId: string) => void
  onCreateStory: (format: StoryFormat, template?: string, userPromptDirect?: string, plan?: any) => Promise<void>
  onAddNode: (newNode: Node) => void
  onAddEdge: (newEdge: Edge) => void
  edges: Edge[]
  nodes: Node[]
  worldState?: WorldStateManager
  
  // Document selection
  onSelectNode: (nodeId: string, sectionId?: string) => void
  
  // Chat operations
  // ✅ NEW: Added metadata parameter for structured content support (progress lists, etc.)
  // Metadata allows messages to include structured data that can be rendered with icons
  // and better formatting in the UI. See StatusMessage component for rendering logic.
  onAddChatMessage: (
    message: string, 
    role?: 'user' | 'orchestrator', 
    type?: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user' | 'model' | 'progress',
    metadata?: {
      structured?: boolean
      format?: 'progress_list' | 'simple_list' | 'steps'
    }
  ) => void
  onClearChat: () => void
  
  // Document panel
  isDocumentViewOpen: boolean
  onToggleDocumentView: () => void
  onPanelWidthChange: (width: number) => void
  
  // Active context
  activeContext: { type: 'section' | 'segment'; id: string; name: string } | null
  onClearContext: () => void
  
  // Document operations
  onWriteContent: (segmentId: string, prompt: string) => Promise<void>
  onAnswerQuestion: (question: string) => Promise<string>
  structureItems: any[]
  contentMap: Record<string, string>
  currentStoryStructureNodeId: string | null
  
  // Document panel state
  isAIDocPanelOpen: boolean
  onCloseDocumentPanel: () => void
  initialSectionId: string | null
  onUpdateStructure: (nodeId: string, items: any[]) => void
  orchestratorPanelWidth: number
  onSwitchDocument: (nodeId: string) => void
  onSetContext: (context: { type: 'section' | 'segment'; id: string; name: string } | null) => void
  onSectionsLoaded: (sections: Array<{ id: string; structure_item_id: string; content: string }>) => void
  onRefreshSections: (refreshFn: () => Promise<void>) => void
}

/**
 * Canvas panels component
 */
export default function CanvasPanels(props: CanvasPanelsProps) {
  const {
    selectedNode,
    isPanelOpen,
    onClosePanel,
    onNodeUpdate,
    onNodeDelete,
    onCreateStory,
    onAddNode,
    onAddEdge,
    edges,
    nodes,
    worldState,
    onSelectNode,
    onAddChatMessage,
    onClearChat,
    isDocumentViewOpen,
    onToggleDocumentView,
    onPanelWidthChange,
    activeContext,
    onClearContext,
    onWriteContent,
    onAnswerQuestion,
    structureItems,
    contentMap,
    currentStoryStructureNodeId,
    isAIDocPanelOpen,
    onCloseDocumentPanel,
    initialSectionId,
    onUpdateStructure,
    orchestratorPanelWidth,
    onSwitchDocument,
    onSetContext,
    onSectionsLoaded,
    onRefreshSections
  } = props
  
  return (
    <>
      {/* Right Panel */}
      <NodeDetailsPanel
        node={selectedNode}
        isOpen={isPanelOpen}
        onClose={onClosePanel}
        onUpdate={onNodeUpdate}
        onDelete={onNodeDelete}
        onCreateStory={onCreateStory}
        onAddNode={onAddNode}
        onAddEdge={onAddEdge}
        edges={edges}
        nodes={nodes}
        worldState={worldState}
        onSelectNode={onSelectNode}
        onAddChatMessage={onAddChatMessage}
        onClearChat={onClearChat}
        onToggleDocumentView={onToggleDocumentView}
        isDocumentViewOpen={isDocumentViewOpen}
        onPanelWidthChange={onPanelWidthChange}
        activeContext={activeContext}
        onClearContext={onClearContext}
        onWriteContent={onWriteContent}
        onAnswerQuestion={onAnswerQuestion}
        structureItems={structureItems}
        contentMap={contentMap}
        currentStoryStructureNodeId={currentStoryStructureNodeId}
      />

      {/* AI Document Panel */}
      <AIDocumentPanel 
        key={currentStoryStructureNodeId || 'no-document'} // Force re-mount when document changes
        isOpen={isAIDocPanelOpen} 
        onClose={onCloseDocumentPanel}
        storyStructureNodeId={currentStoryStructureNodeId}
        structureItems={structureItems}
        contentMap={contentMap}
        initialSectionId={initialSectionId}
        onUpdateStructure={onUpdateStructure}
        canvasEdges={edges}
        canvasNodes={nodes}
        orchestratorPanelWidth={orchestratorPanelWidth}
        onSwitchDocument={onSwitchDocument}
        onSetContext={onSetContext}
        onSectionsLoaded={onSectionsLoaded}
        onRefreshSections={onRefreshSections}
      />
    </>
  )
}

