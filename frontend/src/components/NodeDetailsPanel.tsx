'use client'

import { useState } from 'react'
import { Node } from 'reactflow'
import { StoryNodeData, Comment } from '@/types/nodes'
import { useAuth } from '@/contexts/AuthContext'

interface NodeDetailsPanelProps {
  node: Node<StoryNodeData> | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (nodeId: string, data: Partial<StoryNodeData>) => void
}

export default function NodeDetailsPanel({
  node,
  isOpen,
  onClose,
  onUpdate
}: NodeDetailsPanelProps) {
  const { user } = useAuth()
  const [commentText, setCommentText] = useState('')

  if (!node) return null

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
    onUpdate(node.id, { ...node.data, label })
  }

  const handleUpdateDescription = (description: string) => {
    onUpdate(node.id, { ...node.data, description })
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
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Node Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
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
                value={node.data.label}
                onChange={(e) => handleUpdateLabel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="node-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="node-description"
                value={node.data.description || ''}
                onChange={(e) => handleUpdateDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none transition-all"
                placeholder="Add a description..."
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
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none text-sm transition-all"
                  placeholder="Add a comment..."
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
          </div>
        </div>
      </div>
    </>
  )
}

