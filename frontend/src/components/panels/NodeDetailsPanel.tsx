'use client'

import { useState } from 'react'
import { Node, Edge } from 'reactflow'
import { AnyNodeData, Comment } from '@/types/nodes'
import { useAuth } from '@/contexts/AuthContext'
import StoryBookPanel from './StoryBookPanel'
import CharacterPanel from './CharacterPanel'
import ResearchPanel from './ResearchPanel'
import ClusterPanel from './ClusterPanel'
import CreateStoryPanel from './CreateStoryPanel'
import StoryStructurePanel from './StoryStructurePanel'
import { PASTEL_COLORS } from '@/components/nodes/narrationline/NarrationSegment'

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

interface NodeDetailsPanelProps {
  node: Node<AnyNodeData> | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (nodeId: string, data: any) => void
  onDelete: (nodeId: string) => void
  onCreateStory?: (format: any) => void
  edges?: Edge[]
  nodes?: Node[]
}

export default function NodeDetailsPanel({
  node,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onCreateStory,
  edges = [],
  nodes = []
}: NodeDetailsPanelProps) {
  const { user } = useAuth()
  const [commentText, setCommentText] = useState('')

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
    allData: nodeData
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
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/10 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sliding Panel with rounded edges and margin */}
      <div
        className={`fixed top-6 right-6 bottom-6 w-96 bg-white rounded-3xl shadow-lg border border-gray-200 transform transition-all duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-[420px] opacity-0'
        }`}
      >
        <div className="h-full flex flex-col rounded-3xl overflow-hidden">
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
          ) : nodeType === 'create-story' ? (
            <CreateStoryPanel 
              node={node as any} 
              onCreateStory={onCreateStory || (() => console.warn('onCreateStory not provided'))} 
              onClose={onClose}
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

                {/* Generate Structure Button (if no items) */}
                {(!nodeData.items || nodeData.items.length === 0) && (
                  <div className="bg-yellow-50 border-2 border-yellow-300 border-dashed rounded-lg p-6 text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">No Structure Yet</h4>
                    <p className="text-xs text-gray-600 mb-4">
                      Generate a default structure to get started quickly
                    </p>
                    <button
                      onClick={() => {
                        // Generate structure logic
                        const format = nodeData.format || 'podcast'
                        const structureConfig: Record<string, { level1Count: number, level2Count: number, level3Count: number }> = {
                          'podcast': { level1Count: 1, level2Count: 3, level3Count: 2 },
                          'novel': { level1Count: 3, level2Count: 5, level3Count: 3 },
                          'screenplay': { level1Count: 3, level2Count: 10, level3Count: 3 },
                          'short-story': { level1Count: 3, level2Count: 4, level3Count: 0 },
                          'article': { level1Count: 4, level2Count: 3, level3Count: 0 },
                          'essay': { level1Count: 3, level2Count: 3, level3Count: 0 },
                          'report': { level1Count: 5, level2Count: 3, level3Count: 2 }
                        }
                        const config = structureConfig[format] || { level1Count: 3, level2Count: 3, level3Count: 0 }
                        
                        const newItems: any[] = []
                        let itemCounter = 0
                        
                        // Use documentHierarchy to get level names
                        const hierarchy = nodeData.format ? require('@/lib/documentHierarchy').getDocumentHierarchy(nodeData.format) : null
                        const getLevelName = (level: number) => hierarchy?.[level - 1]?.name || `Level ${level}`
                        
                        for (let i = 0; i < config.level1Count; i++) {
                          const level1Id = `item-${Date.now()}-${itemCounter++}`
                          // Assign pastel color cycling through palette
                          const colorIndex = i % PASTEL_COLORS.length
                          const assignedColor = PASTEL_COLORS[colorIndex].hex
                          
                          newItems.push({
                            id: level1Id,
                            level: 1,
                            name: `${getLevelName(1)} ${i + 1}`,
                            title: '',
                            description: '',
                            order: i,
                            completed: false,
                            content: '',
                            expanded: true,
                            wordCount: 5000,
                            backgroundColor: assignedColor // Auto-assign color
                          })
                          
                          for (let j = 0; j < config.level2Count; j++) {
                            const level2Id = `item-${Date.now()}-${itemCounter++}`
                            // Cascade color from level 1 (30% lighter)
                            const level2Color = lightenColor(assignedColor, 1)
                            
                            newItems.push({
                              id: level2Id,
                              level: 2,
                              parentId: level1Id,
                              name: `${getLevelName(2)} ${j + 1}`,
                              title: '',
                              description: '',
                              order: j,
                              completed: false,
                              content: '',
                              expanded: true,
                              wordCount: Math.floor(5000 / config.level2Count),
                              backgroundColor: level2Color // Cascaded color
                            })
                            
                            if (config.level3Count > 0) {
                              for (let k = 0; k < config.level3Count; k++) {
                                const level3Id = `item-${Date.now()}-${itemCounter++}`
                                // Cascade color from level 2 (50% lighter than original)
                                const level3Color = lightenColor(assignedColor, 2)
                                
                                newItems.push({
                                  id: level3Id,
                                  level: 3,
                                  parentId: level2Id,
                                  name: `${getLevelName(3)} ${k + 1}`,
                                  title: '',
                                  description: '',
                                  order: k,
                                  completed: false,
                                  content: '',
                                  expanded: false,
                                  wordCount: Math.floor(5000 / config.level2Count / config.level3Count),
                                  backgroundColor: level3Color // Cascaded color
                                })
                              }
                            }
                          }
                        }
                        
                        onUpdate(node.id, { items: newItems })
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

