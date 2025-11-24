'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Node, Edge } from 'reactflow'
import { AnyNodeData, Comment, StoryStructureItem, StoryStructureNodeData, TestNodeData, AIPromptNodeData, StoryFormat } from '@/types/nodes'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import StoryBookPanel from './StoryBookPanel'
import CharacterPanel from './CharacterPanel'
import ResearchPanel from './ResearchPanel'
import ClusterPanel from './ClusterPanel'
import OrchestratorPanel from './OrchestratorPanel'
import StoryStructurePanel from './StoryStructurePanel'
import { PASTEL_COLORS } from '@/components/nodes/narrationline/NarrationSegment'
import { parseMarkdownStructure } from '@/lib/markdownParser'
import { getFormatSystemPrompt } from '@/lib/groq/formatPrompts'

// Helper function to lighten a hex color for cascading
function lightenColor(hex: string, depth: number): string {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substr(0, 2), 16)
  const g = parseInt(cleanHex.substr(2, 2), 16)
  const b = parseInt(cleanHex.substr(4, 2), 16)
  
  // depth 1: 30% lighter, depth 2: 50% lighter, depth 3+: 70% lighter
  const factor = depth === 1 ? 0.3 : depth === 2 ? 0.5 : 0.7
  
  const newR = Math.round(r + (255 - r) * factor)
  const newG = Math.round(g + (255 - g) * factor)
  const newB = Math.round(b + (255 - b) * factor)
  
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🗑️ REMOVED: structureTemplates (360+ lines)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Template-based structure generation has been REMOVED to enforce generator node workflow.
//
// Users MUST now connect one of these nodes to create a structure:
//   • Test Node (for development/testing with predefined markdown)
//   • AI Prompt Node (for real AI-powered generation via Groq API)
//
// See: /atomic-design-ui-system.plan.md for AI Prompt Node implementation details
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// structureTemplates removed (was ~360 lines containing: screenplay, novel, short-story, podcast, article, essay, report)

interface ActiveContext {
  type: 'section' | 'segment'
  id: string
  name: string
  title?: string
  level?: number
  description?: string
}

interface NodeDetailsPanelProps {
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
  onSelectNode?: (nodeId: string, sectionId?: string) => void // NEW: Select and open a specific node, optionally auto-select a section
  canvasChatHistory?: Array<{
    id: string
    timestamp: string
    content: string
    type: 'thinking' | 'decision' | 'task' | 'result' | 'error' | 'user'
    role?: 'user' | 'orchestrator'
  }>
  onAddChatMessage?: (message: string) => void
  onClearChat?: () => void
  onToggleDocumentView?: () => void // NEW: Toggle document panel visibility
  isDocumentViewOpen?: boolean // NEW: Document panel visibility state
  onPanelWidthChange?: (width: number) => void // NEW: Notify parent when panel width changes
  activeContext?: ActiveContext | null // NEW: Currently selected segment/section
  onClearContext?: () => void // NEW: Clear the active context
  onWriteContent?: (segmentId: string, prompt: string) => Promise<void> // NEW: Write content to specific segment
  onAnswerQuestion?: (question: string) => Promise<string> // NEW: Answer questions about content
  structureItems?: any[] // GHOSTWRITER: Current document structure
  contentMap?: Record<string, string> // GHOSTWRITER: Existing content by section ID
  currentStoryStructureNodeId?: string | null // CANVAS CONTENT: ID of currently loaded story
}

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
  canvasChatHistory = [],
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
  currentStoryStructureNodeId = null
}: NodeDetailsPanelProps) {
  const { user } = useAuth()
  const supabase = createClient()
  const [commentText, setCommentText] = useState('')
  
  // Panel resize state
  const [panelWidth, setPanelWidth] = useState(384) // 384px = w-96 default
  const [isResizing, setIsResizing] = useState(false)
  
  // Embedding status state
  const [embeddingStatus, setEmbeddingStatus] = useState<{
    exists: boolean
    chunkCount: number
    queueStatus: string
    loading: boolean
    generating: boolean
  }>({
    exists: false,
    chunkCount: 0,
    queueStatus: 'none',
    loading: false,
    generating: false
  })
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(false)
  
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Check embedding status for current node
  const checkEmbeddingStatus = useCallback(async (nodeId: string) => {
    // Skip during SSR or if component unmounted
    if (typeof window === 'undefined' || !isMountedRef.current) return
    
    if (!isMountedRef.current) return
    setEmbeddingStatus(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await fetch(`/api/embeddings/generate?nodeId=${nodeId}`)
      const data = await response.json()
      
      // Only update state if still mounted
      if (!isMountedRef.current) return
      
      // Handle both success and error responses
      setEmbeddingStatus({
        exists: data.exists || false,
        chunkCount: data.chunkCount || 0,
        queueStatus: data.queueStatus || 'none',
        loading: false,
        generating: false
      })
      
      // Log if tables are not set up
      if (data.queueStatus === 'unavailable') {
        console.warn('Embeddings feature not set up:', data.error)
      }
    } catch (error) {
      console.error('Failed to check embedding status:', error)
      // Set unavailable status on error
      if (isMountedRef.current) {
        setEmbeddingStatus({
          exists: false,
          chunkCount: 0,
          queueStatus: 'unavailable',
          loading: false,
          generating: false
        })
      }
    }
  }, []) // Empty dependency array - function doesn't depend on any props/state
  
  // Generate embeddings for current node
  const generateEmbeddings = async (nodeId: string, structureItems: any[]) => {
    setEmbeddingStatus(prev => ({ ...prev, generating: true }))
    try {
      // Fetch document sections from database with content
      const { data: documentSections, error: sectionsError } = await supabase
        .from('document_sections')
        .select('id, content, structure_item_id, story_structure_node_id')
        .eq('story_structure_node_id', nodeId)
      
      if (sectionsError) {
        console.error('Failed to fetch document sections:', sectionsError)
        alert(`❌ Failed to fetch document sections:\n\n${sectionsError.message}`)
        setEmbeddingStatus(prev => ({ ...prev, generating: false }))
        return
      }
      
      if (!documentSections || documentSections.length === 0) {
        alert('⚠️ No content found to vectorize.\n\nThis document appears to be empty.')
        setEmbeddingStatus(prev => ({ ...prev, generating: false }))
        return
      }
      
      // Map to the format expected by the API
      const sections = documentSections.map((docSection) => {
        // Find matching structure item
        const structureItem = structureItems.find((item: any) => item.id === docSection.structure_item_id)
        
        return {
          documentSectionId: docSection.id,
          content: docSection.content || '',
          structureItem: structureItem || {
            id: docSection.structure_item_id,
            level: 0,
            type: 'section',
            content: docSection.content
          }
        }
      })
      
      const response = await fetch('/api/embeddings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'batch',
          nodeId,
          sections
        })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        // Success - refresh status and show results
        await checkEmbeddingStatus(nodeId)
        alert(`✅ Embeddings generated!\n\nSections: ${data.successfulSections}/${data.totalSections}\nChunks: ${data.totalChunks}\nTokens: ${data.totalTokens}`)
      } else if (response.status === 503) {
        // Service unavailable - tables don't exist
        alert(`⚙️ Setup Required\n\n${data.error}\n\n${data.details}\n\n💡 ${data.hint}`)
        setEmbeddingStatus(prev => ({ ...prev, generating: false, queueStatus: 'unavailable' }))
      } else {
        // Other errors
        const errorMsg = data.errors?.join('\n') || data.error || data.details || 'Unknown error'
        alert(`❌ Failed to generate embeddings:\n\n${errorMsg}`)
        setEmbeddingStatus(prev => ({ ...prev, generating: false }))
      }
    } catch (error) {
      console.error('Failed to generate embeddings:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setEmbeddingStatus(prev => ({ ...prev, generating: false }))
    }
  }

  // Detect test nodes connected to orchestrator (MUST be before any early returns)
  const connectedTestNode = useMemo(() => {
    if (!node) return null
    
    const orchestratorId = 'context'
    const testEdges = edges.filter(edge => edge.target === orchestratorId)
    
    for (const edge of testEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      if (sourceNode?.data?.nodeType === 'test') {
        return sourceNode as Node<TestNodeData>
      }
    }
    
    return null
  }, [edges, nodes, node])

  // Detect AI Prompt nodes connected to orchestrator (MUST be before any early returns)
  const connectedAIPromptNode = useMemo(() => {
    if (!node) return null
    
    const orchestratorId = 'context'
    const promptEdges = edges.filter(edge => edge.target === orchestratorId)
    
    for (const edge of promptEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source)
      if (sourceNode?.data?.nodeType === 'aiPrompt') {
        return sourceNode as Node<AIPromptNodeData>
      }
    }
    
    return null
  }, [edges, nodes, node])

  // Detect Structure node connected to orchestrator's output (MUST be before any early returns)
  const connectedStructureNode = useMemo(() => {
    if (!node) return null
    
    // Find edges where this orchestrator is the source
    const outgoingEdges = edges.filter(edge => edge.source === node.id)
    
    for (const edge of outgoingEdges) {
      const targetNode = nodes.find(n => n.id === edge.target)
      if (targetNode?.type === 'storyStructureNode') {
        return targetNode as Node<StoryStructureNodeData>
      }
    }
    
    return null
  }, [edges, nodes, node])

  // Handle resize drag (MUST be before any early returns)
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      // Min width 320px, max width 800px
      setPanelWidth(Math.min(Math.max(newWidth, 320), 800))
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Notify parent when panel width changes
  useEffect(() => {
    if (onPanelWidthChange) {
      onPanelWidthChange(panelWidth)
    }
  }, [panelWidth, onPanelWidthChange])
  
  // Check embedding status when story-structure node is selected
  // Only run on client-side, not during SSR
  useEffect(() => {
    if (typeof window === 'undefined') return // Skip during SSR
    if (node && node.type === 'storyStructureNode') {
      checkEmbeddingStatus(node.id)
    }
  }, [node, checkEmbeddingStatus])

  // Early returns AFTER all hooks
  if (!node) return null
  
  const nodeData = node.data as any
  const nodeType = nodeData.nodeType || 'story'
  
  // Debug logging
  console.log('NodeDetailsPanel - Node clicked:', {
    nodeId: node.id,
    nodeType: node.type,
    dataNodeType: nodeData.nodeType,
    resolvedNodeType: nodeType,
    format: nodeData.format,
    allData: nodeData,
    hasTestNode: !!connectedTestNode
  })
  
  // Don't show panel for story-draft nodes - they open the AI Document Panel
  if (nodeType === 'story-draft') {
    return null
  }

  const handleAddComment = () => {
    if (!commentText.trim() || !user) return

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      text: commentText,
      author: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      author_id: user.id,
      created_at: new Date().toISOString()
    }

    const updatedComments = [...(node.data.comments || []), newComment]
    onUpdate(node.id, { ...node.data, comments: updatedComments })
    setCommentText('')
  }

  const handleUpdateLabel = (label: string) => {
    onUpdate(node.id, { ...nodeData, label })
  }

  const handleUpdateDescription = (description: string) => {
    onUpdate(node.id, { ...nodeData, description })
  }

  const handleDeleteComment = (commentId: string) => {
    const updatedComments = (node.data.comments || []).filter(c => c.id !== commentId)
    onUpdate(node.id, { ...node.data, comments: updatedComments })
  }

  return (
    <>
      {/* Full-height Panel with left border and resize handle */}
      <div
        className={`fixed top-16 right-0 bottom-0 bg-gray-50/95 border-l border-t border-gray-200 shadow-sm backdrop-blur-sm transform transition-all duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
        style={{ 
          width: `${panelWidth}px`,
          backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {/* Resize Handle - Left Border */}
        <div
          className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 hover:bg-yellow-400 cursor-ew-resize transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
        >
          {/* Handle Grip - Middle of border */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-16 flex items-center justify-center">
            <div className="w-2.5 h-10 rounded-full bg-gray-300 hover:bg-yellow-400 flex items-center justify-center shadow-md transition-colors group">
              <svg className="w-2.5 h-2.5 text-gray-600 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          </div>
        </div>
        
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header for generic panel */}
          {nodeType !== 'story' && nodeType !== 'character' && nodeType !== 'research' && nodeType !== 'cluster' && nodeType !== 'create-story' && nodeType !== 'story-structure' && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
              <h2 className="text-xl font-semibold text-gray-900">Node Details</h2>
            </div>
          )}

          {/* Route to specialized panel or generic content */}
          {nodeType === 'story' ? (
            <StoryBookPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} />
          ) : nodeType === 'character' ? (
            <CharacterPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} />
          ) : nodeType === 'research' ? (
            <ResearchPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} />
          ) : nodeType === 'cluster' ? (
            <ClusterPanel node={node as any} onUpdate={onUpdate} onDelete={onDelete} edges={edges} nodes={nodes} />
          ) : nodeType === 'aiPrompt' ? (
            // AI Prompt Panel
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{nodeData.label || 'AI Prompt'}</h2>
                    <p className="text-sm text-purple-600">Configure AI generation</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Active/Passive Toggle */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">Mode</h4>
                      <p className="text-xs text-gray-600">
                        {(nodeData as AIPromptNodeData).isActive !== false 
                          ? 'Active: User prompt will be sent to AI' 
                          : 'Passive: Only system prompt (no user input)'}
                      </p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className={`text-sm font-medium ${
                        (nodeData as AIPromptNodeData).isActive !== false ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {(nodeData as AIPromptNodeData).isActive !== false ? 'Active' : 'Passive'}
                      </span>
                      <button
                        onClick={() => onUpdate(node.id, { isActive: !((nodeData as AIPromptNodeData).isActive !== false) })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          (nodeData as AIPromptNodeData).isActive !== false ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            (nodeData as AIPromptNodeData).isActive !== false ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>

                {/* User Prompt */}
                <div className={`${(nodeData as AIPromptNodeData).isActive === false ? 'opacity-50' : ''}`}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Prompt
                  </label>
                  <textarea
                    value={(nodeData as AIPromptNodeData).userPrompt || ''}
                    onChange={(e) => onUpdate(node.id, { userPrompt: e.target.value })}
                    disabled={(nodeData as AIPromptNodeData).isActive === false}
                    placeholder="Describe your story... (e.g., A thriller about AI gone wrong in a small coastal town)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    rows={6}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    {(nodeData as AIPromptNodeData).isActive !== false 
                      ? 'This prompt will be sent to the AI model to generate your story structure.' 
                      : 'Disabled in passive mode. AI will generate based on system prompt only.'}
                  </p>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={(nodeData as AIPromptNodeData).maxTokens || 2000}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      if (!isNaN(value)) {
                        onUpdate(node.id, { maxTokens: Math.min(Math.max(value, 100), 16000) })
                      }
                    }}
                    min={100}
                    max={16000}
                    step={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Recommended: 2000-4000 for detailed structures
                    </p>
                    <p className="text-xs text-gray-400">
                      Max: 16,000
                    </p>
                  </div>
                </div>

                {/* Last Generation Info */}
                {(nodeData as AIPromptNodeData).lastGeneration && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-purple-900 mb-2">Last Generation</h4>
                    <div className="space-y-1 text-xs text-purple-700">
                      <div className="flex justify-between">
                        <span className="text-purple-600">Timestamp:</span>
                        <span className="font-medium">
                          {new Date((nodeData as AIPromptNodeData).lastGeneration!.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-600">Model:</span>
                        <span className="font-medium">{(nodeData as AIPromptNodeData).lastGeneration!.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-purple-600">Format:</span>
                        <span className="font-medium capitalize">
                          {(nodeData as AIPromptNodeData).lastGeneration!.format}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">How to Use</h4>
                  <ol className="space-y-2 text-xs text-blue-700">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">1.</span>
                      <span>Connect this node to an <strong>Orchestrator</strong> node</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">2.</span>
                      <span>Enter your story prompt above</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">3.</span>
                      <span>Click the Orchestrator to select a model and format</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-blue-600">4.</span>
                      <span>Click <strong>&quot;Generate Structure&quot;</strong> in the Orchestrator panel</span>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          ) : nodeType === 'create-story' ? (
              <OrchestratorPanel
              node={node as any} 
              onCreateStory={onCreateStory || (() => console.warn('onCreateStory not provided'))} 
              onClose={onClose}
              onUpdate={onUpdate}
              canvasChatHistory={canvasChatHistory}
              onAddChatMessage={onAddChatMessage}
              onClearChat={onClearChat}
              onToggleDocumentView={onToggleDocumentView}
              isDocumentViewOpen={isDocumentViewOpen}
              activeContext={activeContext}
              onClearContext={onClearContext}
              onWriteContent={onWriteContent}
              onAnswerQuestion={onAnswerQuestion}
              structureItems={structureItems}
              contentMap={contentMap}
              canvasNodes={nodes}
              canvasEdges={edges}
              currentStoryStructureNodeId={currentStoryStructureNodeId}
              onSelectNode={onSelectNode}
            />
          ) : nodeType === 'story-structure' ? (
            // Story Structure Metadata Panel
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{nodeData.label || 'Story Structure'}</h2>
                    <p className="text-sm text-gray-500 capitalize">{nodeData.format?.replace('-', ' ') || 'Document'}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Metadata Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Metadata</h3>
                  <div className="space-y-3">
                    {/* Created Date */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Created</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Number of Sections */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Sections</span>
                      <span className="text-sm font-medium text-gray-900">
                        {nodeData.items?.length || 1}
                      </span>
                    </div>

                    {/* Pages (dummy) */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Pages</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Math.max(1, Math.floor((nodeData.items?.length || 1) * 2.5))}
                      </span>
                    </div>

                    {/* Word Count (dummy) */}
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Word Count</span>
                      <span className="text-sm font-medium text-gray-900">
                        {(Math.floor(Math.random() * 5000) + 1000).toLocaleString()}
                      </span>
                    </div>

                    {/* Template (if available) */}
                    {nodeData.template && (
                      <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-600">Template</span>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {nodeData.template.replace(/-/g, ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Embeddings Section */}
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                      </svg>
                      Vector Embeddings
                    </h3>
                    {embeddingStatus.exists && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Active
                      </span>
                    )}
                  </div>
                  
                  {embeddingStatus.loading ? (
                    <div className="text-sm text-gray-600 animate-pulse">Checking status...</div>
                  ) : embeddingStatus.queueStatus === 'unavailable' ? (
                    <div className="space-y-2">
                      <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3">
                        <strong>⚙️ Setup Required</strong>
                        <p className="mt-1 text-xs">
                          Embeddings feature not set up. Run database migration:
                          <code className="block mt-1 p-1 bg-yellow-100 rounded text-xs">
                            013_create_document_embeddings.sql
                          </code>
                        </p>
                      </div>
                    </div>
                  ) : embeddingStatus.exists ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Chunks:</span>
                        <span className="font-medium text-gray-900">{embeddingStatus.chunkCount}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        ✓ Semantic search enabled - orchestrator can use RAG to understand this document
                      </div>
                      <button
                        onClick={() => generateEmbeddings(node.id, nodeData.items || [])}
                        disabled={embeddingStatus.generating}
                        className="w-full mt-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {embeddingStatus.generating ? '⏳ Regenerating...' : '🔄 Regenerate Embeddings'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        {nodeData.items && nodeData.items.length > 0 ? (
                          <>
                            ⚠️ Not vectorized yet. Generate embeddings to enable semantic search and RAG.
                          </>
                        ) : (
                          <>
                            ℹ️ No content to vectorize. Write content first, then generate embeddings.
                          </>
                        )}
                      </div>
                      {nodeData.items && nodeData.items.length > 0 && (
                        <button
                          onClick={() => generateEmbeddings(node.id, nodeData.items || [])}
                          disabled={embeddingStatus.generating}
                          className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {embeddingStatus.generating ? (
                            <>⏳ Generating...</>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Generate Embeddings
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Info Message (if no items) */}
                {(!nodeData.items || nodeData.items.length === 0) && (
                  <div className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-lg p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">No Content Generated Yet</h4>
                    <p className="text-xs text-gray-600 mb-4">
                      To generate content, click the Orchestrator node above and select &quot;Create [Format]&quot;
                    </p>
                    <button
                      disabled
                      className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                    >
                      Waiting for generation...
                    </button>
                  </div>
                )}
                
                {/* OLD GENERATE BUTTON - DEPRECATED, kept for reference but hidden */}
                {false && (!nodeData.items || nodeData.items.length === 0) && (
                  <div className="hidden">
                    <button
                      onClick={() => {
                        // Use the connected structure node, or auto-create one if it doesn't exist
                        let structureNode = connectedStructureNode
                        
                        // Double-check: also look for any structure node connected via outgoing edges
                        // (in case the useMemo hasn't updated yet)
                        if (!structureNode && node) {
                          console.log('🔍 Double-checking for structure node:', {
                            orchestratorId: node.id,
                            totalEdges: edges.length,
                            outgoingEdgesFromOrchestrator: edges.filter(e => e.source === node.id).length,
                            allStructureNodes: nodes.filter(n => n.type === 'storyStructureNode').map(n => ({ id: n.id, type: n.type }))
                          })
                          
                          const outgoingEdges = edges.filter(e => e.source === node.id)
                          console.log('🔍 Outgoing edges from orchestrator:', outgoingEdges.map(e => ({ id: e.id, source: e.source, target: e.target })))
                          
                          for (const edge of outgoingEdges) {
                            const targetNode = nodes.find(n => n.id === edge.target)
                            console.log('🔍 Checking target node:', { edgeTarget: edge.target, foundNode: targetNode?.id, nodeType: targetNode?.type })
                            if (targetNode?.type === 'storyStructureNode') {
                              structureNode = targetNode as Node<StoryStructureNodeData>
                              console.log('✅ Found structure node via edge check:', structureNode.id)
                              break
                            }
                          }
                        }
                        
                        if (!structureNode) {
                          console.log('📦 No structure node connected. Auto-creating one...')
                          
                          // Auto-create structure node if callbacks are provided
                          if (!onAddNode || !onAddEdge) {
                            console.error('❌ Cannot auto-create structure node: missing callbacks')
                            alert('No structure node found. Please connect a Structure node to this Orchestrator first.')
                            return
                          }
                          
                          // Check if node exists before accessing properties
                          if (!node) {
                            console.error('❌ Cannot auto-create structure node: orchestrator node not found')
                            alert('Orchestrator node not found.')
                            return
                          }
                          
                          // Get format from orchestrator
                          const selectedFormat: StoryFormat = nodeData.format || 'screenplay'
                          
                          // Create structure node ID
                          const structureNodeId = `structure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                          
                          // Calculate position (below orchestrator)
                          const orchestratorPosition = node.position
                          const newStructureNode: Node<StoryStructureNodeData> = {
                            id: structureNodeId,
                            type: 'storyStructureNode',
                            position: {
                              x: orchestratorPosition.x - 50,
                              y: orchestratorPosition.y + 200
                            },
                          data: {
                            nodeType: 'story-structure',
                            label: selectedFormat.toUpperCase(),
                            description: 'Generated structure',
                            format: selectedFormat,
                            items: [],
                            activeLevel: 1, // Start at top level
                            comments: [],
                            onItemClick: () => {}, // Will be set by canvas
                            onItemsUpdate: () => {}, // Will be set by canvas
                            onWidthUpdate: () => {}, // Will be set by canvas
                            availableAgents: [],
                              customNarrationWidth: 1200
                            }
                          }
                          
                          // Create edge from orchestrator to structure
                          const newEdge: Edge = {
                            id: `edge-${node.id}-${structureNodeId}`,
                            source: node.id,
                            target: structureNodeId,
                            type: 'smoothstep'
                          }
                          
                          // Add node and edge
                          onAddNode(newStructureNode)
                          onAddEdge(newEdge)
                          
                          // Use the newly created node
                          structureNode = newStructureNode
                          
                          console.log('✅ Auto-created and connected structure node:', {
                            structureNodeId,
                            orchestratorId: node.id
                          })
                        }
                        
                        console.log('🎯 Using structure node:', {
                          structureNodeId: structureNode.id,
                          orchestratorNodeId: node?.id,
                          hasExistingItems: (structureNode.data.items?.length || 0) > 0,
                          existingFormat: structureNode.data.format
                        })
                        
                        // Check if AI Prompt node is connected - if so, generate with Groq API
                        if (connectedAIPromptNode && node) {
                          const promptNode = connectedAIPromptNode
                          let userPrompt = promptNode.data.userPrompt
                          const maxTokens = promptNode.data.maxTokens || 2000
                          
                          if (!userPrompt || userPrompt.trim() === '') {
                            alert('Please enter a prompt in the AI Prompt node first.')
                            return
                          }
                          
                          // Get selected model and format from orchestrator node data
                          const selectedModel = (node.data as any).selectedModel || 'llama-3.1-8b-instant'
                          const selectedFormat: StoryFormat = nodeData.format || 'screenplay'
                          
                          // Check if structure node has existing content
                          const hasExistingContent = structureNode.data.items && 
                                                    structureNode.data.items.length > 0
                          const existingFormat = structureNode.data.format
                          const isReformatting = hasExistingContent && existingFormat && existingFormat !== selectedFormat
                          const isRegenerating = hasExistingContent && existingFormat === selectedFormat
                          
                          // Confirm before overwriting same format
                          if (isRegenerating) {
                            if (!confirm(`This will overwrite the existing ${existingFormat} structure. Continue?`)) {
                              return
                            }
                          }
                          
                          // Get system prompt for the format
                          let systemPrompt = getFormatSystemPrompt(selectedFormat)
                          
                          // If reformatting, enhance the prompt with existing structure
                          if (isReformatting) {
                            console.log('🔄 Reformatting existing content:', {
                              from: existingFormat,
                              to: selectedFormat,
                              existingItemsCount: structureNode.data.items?.length
                            })
                            
                            // Build a summary of existing structure using summaries (levels 1-3)
                            const structureSummary = structureNode.data.items!
                              .filter(item => item.level <= 3 && item.summary)
                              .map(item => {
                                const indent = '  '.repeat(item.level - 1)
                                return `${indent}${item.name}: ${item.summary}`
                              })
                              .join('\n')
                            
                            // Get a sample of existing content (first 2000 chars)
                            let contentSample = ''
                            if (structureNode.data.contentMap) {
                              const allContent = Object.values(structureNode.data.contentMap).join('\n\n')
                              contentSample = allContent.substring(0, 2000)
                              if (allContent.length > 2000) {
                                contentSample += '\n\n[Content continues...]'
                              }
                            }
                            
                            // Enhance user prompt with existing content context
                            userPrompt = `REFORMAT REQUEST: Convert the following ${existingFormat} into a ${selectedFormat} format.

ORIGINAL STRUCTURE SUMMARY:
${structureSummary}

${contentSample ? `CONTENT SAMPLE:\n${contentSample}\n\n` : ''}INSTRUCTIONS: ${userPrompt}

IMPORTANT: Preserve the core story, themes, and narrative arc while adapting the structure to fit the ${selectedFormat} format. Maintain the essence of the story.`
                            
                            // Enhance system prompt to emphasize reformatting
                            systemPrompt = `${systemPrompt}

CRITICAL: You are REFORMATTING existing content from ${existingFormat} to ${selectedFormat}, not creating from scratch.
- Preserve the story's core narrative and themes
- Adapt the structure to fit ${selectedFormat} conventions
- Maintain character development and plot progression
- Adjust pacing and formatting to suit the new format`
                          }
                          
                          console.log('🤖 Generating structure with Groq AI:', {
                            model: selectedModel,
                            format: selectedFormat,
                            userPromptLength: userPrompt.length,
                            maxTokens
                          })
                          
                          // Show loading state
                          const generateButton = document.activeElement as HTMLButtonElement
                          if (generateButton) {
                            generateButton.disabled = true
                            generateButton.textContent = 'Generating...'
                          }
                          
                          // Call Groq API
                          fetch('/api/groq/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              model: selectedModel,
                              systemPrompt,
                              userPrompt,
                              maxTokens
                            })
                          })
                          .then(res => res.json())
                          .then(data => {
                            if (data.success && data.markdown) {
                              console.log('✅ Received AI-generated markdown:', {
                                markdownLength: data.markdown.length,
                                usage: data.usage
                              })
                              
                              // Parse the generated markdown
                              const { items: parsedItems, contentMap } = parseMarkdownStructure(data.markdown)
                              
                              // Convert contentMap to plain object
                              const contentMapObject: Record<string, string> = {}
                              contentMap.forEach((value, key) => {
                                contentMapObject[key] = value
                              })
                              
                              // Update structure node with parsed structure AND content map
                              console.log('💾 Updating structure node with AI-generated items:', {
                                structureNodeId: structureNode.id,
                                itemsCount: parsedItems.length,
                                items: parsedItems,
                                contentMapKeys: Object.keys(contentMapObject)
                              })
                              
                              onUpdate(structureNode.id, { 
                                items: parsedItems,
                                contentMap: contentMapObject,
                                format: selectedFormat // Save the new format!
                              })
                              
                              console.log('✅ Structure node update called successfully', {
                                format: selectedFormat,
                                itemsCount: parsedItems.length
                              })
                              
                              // Update AI Prompt node with last generation info
                              if (promptNode.data.onUpdate) {
                                promptNode.data.onUpdate(promptNode.id, {
                                  lastGeneration: {
                                    timestamp: new Date().toISOString(),
                                    model: selectedModel,
                                    format: selectedFormat,
                                    markdown: data.markdown
                                  }
                                })
                              }
                              
                              console.log('✅ AI structure generated successfully:', {
                                itemsCount: parsedItems.length,
                                levels: [...new Set(parsedItems.map(i => i.level))],
                                wasReformatting: isReformatting
                              })
                              
                              const successMessage = isReformatting 
                                ? `✅ Content reformatted from ${existingFormat} to ${selectedFormat}!`
                                : '✅ Structure generated successfully with AI!'
                              alert(successMessage)
                            } else {
                              throw new Error(data.error || 'Failed to generate structure')
                            }
                          })
                          .catch(error => {
                            console.error('❌ Failed to generate with AI:', error)
                            alert(`Failed to generate structure: ${error.message}\n\nFalling back to default template.`)
                            
                            // Fall through to template generation as fallback
                            // (code below will execute after this catch block)
                          })
                          .finally(() => {
                            if (generateButton) {
                              generateButton.disabled = false
                              generateButton.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg> Generate Structure`
                            }
                          })
                          
                          return // Exit early after initiating AI generation
                        }
                        
                        // Check if test node is connected - if so, parse its markdown
                        if (connectedTestNode) {
                          try {
                            const markdown = connectedTestNode.data.markdown || ''
                            console.log('🎬 Generating structure from test node markdown:', {
                              nodeId: connectedTestNode.id,
                              markdownLength: markdown.length,
                            })
                            
                            const { items: parsedItems, contentMap } = parseMarkdownStructure(markdown)
                            
                            // Convert contentMap (Map) to plain object for storage
                            const contentMapObject: Record<string, string> = {}
                            contentMap.forEach((value, key) => {
                              contentMapObject[key] = value
                            })
                            
                            // Update STRUCTURE NODE (not orchestrator) with parsed structure AND content map
                            console.log('💾 Updating structure node with contentMap:', {
                              structureNodeId: structureNode.id,
                              sections: contentMap.size,
                              sectionIds: Array.from(contentMap.keys())
                            })
                            
                            onUpdate(structureNode.id, { 
                              items: parsedItems,
                              contentMap: contentMapObject 
                            })
                            
                            console.log('📝 Content map SAVED TO NODE:', {
                              nodeId: structureNode.id,
                              sections: contentMap.size,
                              sectionIds: Array.from(contentMap.keys()),
                              contentMapObjectKeys: Object.keys(contentMapObject),
                              contentMapObject,
                              sampleContent: contentMapObject[Object.keys(contentMapObject)[0]]?.substring(0, 100)
                            })
                            
                            console.log('✅ Structure generated from test markdown:', {
                              itemsCount: parsedItems.length,
                              levels: [...new Set(parsedItems.map(i => i.level))],
                            })
                            
                            return
                          } catch (error) {
                            console.error('❌ Failed to parse test node markdown:', error)
                            alert(
                              '❌ Failed to parse markdown from Test Node.\n\n' +
                              'Please check that your Test Node contains valid markdown with:\n' +
                              '• Proper YAML frontmatter\n' +
                              '• Correctly formatted structure sections\n\n' +
                              'See console for detailed error information.'
                            )
                            return
                          }
                        }

                        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        // 🚫 NO GENERATOR NODE CONNECTED - SHOW ERROR
                        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                        
                        console.warn('⚠️ No generator node (Test or AI Prompt) connected to orchestrator')
                        alert(
                          '⚠️ No Generator Node Connected\n\n' +
                          'To create a structure, you must connect one of these nodes:\n\n' +
                          '1️⃣ Test Node (for development/testing)\n' +
                          '   • Contains predefined markdown\n' +
                          '   • Connect from bottom of Test Node to Orchestrator\n\n' +
                          '2️⃣ AI Prompt Node (for AI generation)\n' +
                          '   • Generates structure via Groq API\n' +
                          '   • Connect from bottom of AI Prompt Node to Orchestrator\n\n' +
                          'Add a generator node from the canvas menu (+) and connect it to the Orchestrator.'
                        )
                        return
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium text-sm hover:bg-yellow-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate Structure
                    </button>
                  </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm text-blue-900 font-medium mb-1">Writing Tip</p>
                      <p className="text-xs text-blue-700">
                        Click on any section card to start writing. Manage your structure directly in the AI Document Panel&apos;s sidebar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-gray-200 space-y-3">
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this story structure? This action cannot be undone.')) {
                      onDelete(node.id)
                      onClose()
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Structure
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Node Type Badge */}
            <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 uppercase tracking-wider">
              {node.type}
            </div>

            {/* Label/Title */}
            <div>
              <label htmlFor="node-label" className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                id="node-label"
                type="text"
                value={nodeData.label || ''}
                onChange={(e) => handleUpdateLabel(e.target.value)}
                maxLength={200}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
                aria-label="Node title"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="node-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="node-description"
                value={nodeData.description || ''}
                onChange={(e) => handleUpdateDescription(e.target.value)}
                maxLength={2000}
                rows={4}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none transition-all"
                placeholder="Add a description..."
                aria-label="Node description"
              />
            </div>

            {/* Image Upload (placeholder for now) */}
            {node.type === 'storyNode' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-yellow-400 transition-colors cursor-pointer">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Click to upload image</p>
                  <p className="text-xs text-gray-400 mt-1">Coming soon</p>
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Comments ({node.data.comments?.length || 0})
              </h3>

              {/* Comment List */}
              <div className="space-y-3 mb-4">
                {node.data.comments?.length === 0 && (
                  <p className="text-sm text-gray-400 italic">No comments yet</p>
                )}
                {node.data.comments?.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs font-medium text-gray-900">
                        {comment.author}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                        {user?.id === comment.author_id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            aria-label="Delete comment"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                  </div>
                ))}
              </div>

              {/* Add Comment */}
              <div className="space-y-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none text-sm transition-all"
                  placeholder="Add a comment..."
                  aria-label="Add comment"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAddComment()
                    }
                  }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Add Comment
                </button>
                <p className="text-xs text-gray-400 text-center">
                  Press ⌘/Ctrl + Enter to submit
                </p>
              </div>
            </div>

            {/* Delete Node Button */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this node?')) {
                    onDelete(node.id)
                    onClose()
                  }
                }}
                className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Node
              </button>
            </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

