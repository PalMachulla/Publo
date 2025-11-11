'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
import { ClusterNodeData } from '@/types/nodes'

interface ClusterPanelProps {
  node: Node<ClusterNodeData>
  onUpdate: (nodeId: string, updates: Partial<ClusterNodeData>) => void
  onDelete: (nodeId: string) => void
}

export default function ClusterPanel({ node, onUpdate, onDelete }: ClusterPanelProps) {
  const [label, setLabel] = useState(node.data.label || '')
  const [description, setDescription] = useState(node.data.description || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Update local state when node changes
  useEffect(() => {
    setLabel(node.data.label || '')
    setDescription(node.data.description || '')
  }, [node.data.label, node.data.description])

  const handleSave = () => {
    onUpdate(node.id, {
      label,
      description,
    })
  }

  const handleDelete = () => {
    onDelete(node.id)
    setShowDeleteConfirm(false)
  }

  const nodeCount = node.data.clusterNodes?.length || 0

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="8" cy="6" r="2" strokeWidth={2} fill="currentColor" />
              <circle cx="12" cy="6" r="2" strokeWidth={2} fill="currentColor" />
              <circle cx="16" cy="6" r="2" strokeWidth={2} fill="currentColor" />
              <circle cx="12" cy="18" r="2" strokeWidth={2} fill="currentColor" />
              <line x1="8" y1="8" x2="12" y2="16" strokeWidth={2} strokeLinecap="round" />
              <line x1="12" y1="8" x2="12" y2="16" strokeWidth={2} strokeLinecap="round" />
              <line x1="16" y1="8" x2="12" y2="16" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Node Cluster</h2>
            <p className="text-sm text-gray-500">Group related nodes together</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cluster Name
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSave}
            placeholder="Enter cluster name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            placeholder="Describe what this cluster represents..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none"
          />
        </div>

        {/* Cluster Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-900">Cluster Information</h3>
          </div>
          <p className="text-sm text-gray-800 mb-2">
            This cluster currently contains <strong>{nodeCount}</strong> {nodeCount === 1 ? 'node' : 'nodes'}.
          </p>
          <p className="text-xs text-gray-700">
            Connect other nodes to this cluster to organize your canvas. Clusters help you group related content and maintain a clean visual structure.
          </p>
        </div>

        {/* Comments Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Comments</h3>
          {node.data.comments && node.data.comments.length > 0 ? (
            <div className="space-y-3">
              {node.data.comments.map((comment) => (
                <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{comment.author}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{comment.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No comments yet</p>
          )}
        </div>
      </div>

      {/* Footer with Delete Button */}
      <div className="p-6 border-t border-gray-200">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Cluster
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 text-center">Are you sure you want to delete this cluster?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

