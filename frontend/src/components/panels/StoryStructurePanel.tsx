'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
import { StoryStructureNodeData, StoryStructureItem } from '@/types/nodes'
import { getDocumentHierarchy } from '@/lib/documentHierarchy'
import { getFormatIcon } from '@/components/StoryFormatMenu'

interface StoryStructurePanelProps {
  node: Node<StoryStructureNodeData>
  onUpdate: (nodeId: string, updates: Partial<StoryStructureNodeData>) => void
  onDelete: (nodeId: string) => void
}

export default function StoryStructurePanel({ node, onUpdate, onDelete }: StoryStructurePanelProps) {
  const { format, items, activeLevel } = node.data
  
  // Debug logging
  console.log('StoryStructurePanel rendered with:', {
    nodeId: node.id,
    nodeType: node.data.nodeType,
    format: format,
    items: items,
    activeLevel: activeLevel,
    fullData: node.data
  })
  
  const hierarchy = getDocumentHierarchy(format)
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState('')

  // Get current level info
  const currentLevel = hierarchy?.[activeLevel - 1]
  const canGoDeeper = hierarchy && activeLevel < hierarchy.length
  const canGoUp = activeLevel > 1

  // Filter items by current level
  const currentLevelItems = items.filter(item => item.level === activeLevel)
    .sort((a, b) => a.order - b.order)

  // Format icon
  const formatIcon = getFormatIcon(format)

  // Add new structural item
  const handleAddItem = () => {
    if (!currentLevel) return

    const newItem: StoryStructureItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: activeLevel,
      name: `${currentLevel.name} ${currentLevelItems.length + 1}`,
      title: '',
      description: '',
      order: currentLevelItems.length,
      completed: false,
      content: ''
    }

    const updatedItems = [...items, newItem]
    onUpdate(node.id, { items: updatedItems })
  }

  // Start editing an item
  const handleEditItem = (item: StoryStructureItem) => {
    setEditingItemId(item.id)
    setEditingName(item.name)
    setEditingTitle(item.title || '')
    setEditingDescription(item.description || '')
  }

  // Save edited item
  const handleSaveEdit = () => {
    if (!editingItemId) return

    const updatedItems = items.map(item => 
      item.id === editingItemId 
        ? { ...item, name: editingName, title: editingTitle, description: editingDescription }
        : item
    )

    onUpdate(node.id, { items: updatedItems })
    setEditingItemId(null)
    setEditingName('')
    setEditingTitle('')
    setEditingDescription('')
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingItemId(null)
    setEditingName('')
    setEditingTitle('')
    setEditingDescription('')
  }

  // Delete an item
  const handleDeleteItem = (itemId: string) => {
    const updatedItems = items.filter(item => item.id !== itemId)
    // Reorder remaining items at this level
    const reorderedItems = updatedItems.map(item => {
      if (item.level === activeLevel && item.order > (items.find(i => i.id === itemId)?.order || 0)) {
        return { ...item, order: item.order - 1 }
      }
      return item
    })
    onUpdate(node.id, { items: reorderedItems })
  }

  // Toggle item completion
  const handleToggleComplete = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    )
    onUpdate(node.id, { items: updatedItems })
  }

  // Move item up/down in order
  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    const item = currentLevelItems.find(i => i.id === itemId)
    if (!item) return

    const currentIndex = currentLevelItems.findIndex(i => i.id === itemId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= currentLevelItems.length) return

    const targetItem = currentLevelItems[targetIndex]

    const updatedItems = items.map(i => {
      if (i.id === itemId) {
        return { ...i, order: targetItem.order }
      }
      if (i.id === targetItem.id) {
        return { ...i, order: item.order }
      }
      return i
    })

    onUpdate(node.id, { items: updatedItems })
  }

  // Navigate hierarchy levels
  const handleLevelChange = (newLevel: number) => {
    if (newLevel < 1 || (hierarchy && newLevel > hierarchy.length)) return
    onUpdate(node.id, { activeLevel: newLevel })
  }

  // Delete entire structure node
  const handleDelete = () => {
    onDelete(node.id)
    setShowDeleteConfirm(false)
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
            <div className="text-yellow-600 scale-150">
              {formatIcon}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 capitalize">{format} Structure</h2>
            <p className="text-sm text-gray-500">{items.length} structural {items.length === 1 ? 'item' : 'items'}</p>
          </div>
        </div>
      </div>

      {/* Hierarchy Level Navigation */}
      {hierarchy && hierarchy.length > 1 && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Level {activeLevel}: {currentLevel?.name}
            </div>
            <div className="text-xs text-gray-500">
              {currentLevel?.optional ? 'Optional' : 'Required'}
            </div>
          </div>
          
          {/* Level selector */}
          <div className="flex gap-1 overflow-x-auto">
            {hierarchy.map((level, index) => (
              <button
                key={level.level}
                onClick={() => handleLevelChange(level.level)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeLevel === level.level
                    ? 'bg-yellow-400 text-black'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {level.name}
              </button>
            ))}
          </div>
          
          {currentLevel?.description && (
            <p className="text-xs text-gray-600 mt-2">{currentLevel.description}</p>
          )}
        </div>
      )}

      {/* Content - List of items */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentLevelItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No {currentLevel?.name}s yet</h3>
            <p className="text-xs text-gray-500 mb-4">
              Add your first {currentLevel?.name.toLowerCase()} to start structuring your {format}
            </p>
            <button
              onClick={handleAddItem}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium text-sm hover:bg-yellow-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add {currentLevel?.name}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {currentLevelItems.map((item, index) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 transition-all ${
                  item.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}
              >
                {editingItemId === item.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder={`${currentLevel?.name} name`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
                    />
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      placeholder="Title (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm"
                    />
                    <textarea
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 px-3 py-2 bg-yellow-400 text-black rounded-lg font-medium text-sm hover:bg-yellow-500 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-start gap-3">
                      {/* Completion checkbox */}
                      <button
                        onClick={() => handleToggleComplete(item.id)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          item.completed
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {item.completed && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className={`font-medium text-sm ${item.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                              {item.name}
                            </h4>
                            {item.title && (
                              <p className="text-xs text-gray-600 mt-0.5">{item.title}</p>
                            )}
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Move up */}
                        <button
                          onClick={() => handleMoveItem(item.id, 'up')}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>

                        {/* Move down */}
                        <button
                          onClick={() => handleMoveItem(item.id, 'down')}
                          disabled={index === currentLevelItems.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleEditItem(item)}
                          className="p-1 text-gray-400 hover:text-yellow-600"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Add Item Button */}
            <button
              onClick={handleAddItem}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-yellow-400 hover:text-yellow-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add {currentLevel?.name}
            </button>
          </div>
        )}
      </div>

      {/* Footer - Delete Button */}
      <div className="p-6 border-t border-gray-200 bg-white">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Structure
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Story Structure?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will delete the entire {format} structure and all {items.length} structural items. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

