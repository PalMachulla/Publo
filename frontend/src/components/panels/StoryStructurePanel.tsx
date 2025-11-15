'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
import { StoryStructureNodeData, StoryStructureItem } from '@/types/nodes'
import { getDocumentHierarchy } from '@/lib/documentHierarchy'
import { getFormatIcon } from '@/components/menus/StoryFormatMenu'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface StoryStructurePanelProps {
  node: Node<StoryStructureNodeData>
  onUpdate: (nodeId: string, updates: Partial<StoryStructureNodeData>) => void
  onDelete: (nodeId: string) => void
}

export default function StoryStructurePanel({ node, onUpdate, onDelete }: StoryStructurePanelProps) {
  const { format, items } = node.data
  
  const hierarchy = getDocumentHierarchy(format)
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState('')

  // Get top-level items
  const topLevelItems = items.filter(item => item.level === 1).sort((a, b) => a.order - b.order)
  
  // Helper to get children of an item
  const getChildren = (parentId: string): StoryStructureItem[] => {
    return items.filter(item => item.parentId === parentId).sort((a, b) => a.order - b.order)
  }
  
  // Helper to check if item has children
  const hasChildren = (itemId: string): boolean => {
    return items.some(item => item.parentId === itemId)
  }
  
  // Helper to get level name from hierarchy
  const getLevelName = (level: number): string => {
    return hierarchy?.[level - 1]?.name || 'Item'
  }

  // Format icon
  const formatIcon = getFormatIcon(format)

  // Generate default structure based on format with realistic, varied word counts
  const handleGenerateStructure = () => {
    const newItems: StoryStructureItem[] = []
    let itemCounter = 0
    
    // Define realistic structure templates with proportional word counts
    // Each child's word count is specified, and they sum to match parent
    const structureTemplates: Record<string, any> = {
      'screenplay': {
        // Classic 3-act structure: 25% / 50% / 25%
        level1: [
          { name: 'Act 1', wordCount: 3750, children: [
            { name: 'Sequence 1', wordCount: 1500, children: [
              { name: 'Scene 1', wordCount: 600 },
              { name: 'Scene 2', wordCount: 500 },
              { name: 'Scene 3', wordCount: 400 }
            ]},
            { name: 'Sequence 2', wordCount: 1250, children: [
              { name: 'Scene 1', wordCount: 500 },
              { name: 'Scene 2', wordCount: 750 }
            ]},
            { name: 'Sequence 3', wordCount: 1000, children: [
              { name: 'Scene 1', wordCount: 1000 }
            ]}
          ]},
          { name: 'Act 2', wordCount: 7500, children: [
            { name: 'Sequence 1', wordCount: 2250, children: [
              { name: 'Scene 1', wordCount: 750 },
              { name: 'Scene 2', wordCount: 1000 },
              { name: 'Scene 3', wordCount: 500 }
            ]},
            { name: 'Sequence 2', wordCount: 3000, children: [
              { name: 'Scene 1', wordCount: 1200 },
              { name: 'Scene 2', wordCount: 1800 }
            ]},
            { name: 'Sequence 3', wordCount: 2250, children: [
              { name: 'Scene 1', wordCount: 900 },
              { name: 'Scene 2', wordCount: 1350 }
            ]}
          ]},
          { name: 'Act 3', wordCount: 3750, children: [
            { name: 'Sequence 1', wordCount: 2250, children: [
              { name: 'Scene 1', wordCount: 1350 },
              { name: 'Scene 2', wordCount: 900 }
            ]},
            { name: 'Sequence 2', wordCount: 1500, children: [
              { name: 'Scene 1', wordCount: 1500 }
            ]}
          ]}
        ]
      },
      'novel': {
        // 3 Parts with varied chapter lengths
        level1: [
          { name: 'Part 1', wordCount: 25000, children: [
            { name: 'Chapter 1', wordCount: 6000, children: [
              { name: 'Scene 1', wordCount: 2500 },
              { name: 'Scene 2', wordCount: 2000 },
              { name: 'Scene 3', wordCount: 1500 }
            ]},
            { name: 'Chapter 2', wordCount: 5500, children: [
              { name: 'Scene 1', wordCount: 2500 },
              { name: 'Scene 2', wordCount: 3000 }
            ]},
            { name: 'Chapter 3', wordCount: 6500, children: [
              { name: 'Scene 1', wordCount: 3500 },
              { name: 'Scene 2', wordCount: 3000 }
            ]},
            { name: 'Chapter 4', wordCount: 7000, children: [
              { name: 'Scene 1', wordCount: 3500 },
              { name: 'Scene 2', wordCount: 3500 }
            ]}
          ]},
          { name: 'Part 2', wordCount: 35000, children: [
            { name: 'Chapter 5', wordCount: 7000, children: [
              { name: 'Scene 1', wordCount: 3500 },
              { name: 'Scene 2', wordCount: 3500 }
            ]},
            { name: 'Chapter 6', wordCount: 8000, children: [
              { name: 'Scene 1', wordCount: 4000 },
              { name: 'Scene 2', wordCount: 4000 }
            ]},
            { name: 'Chapter 7', wordCount: 10000, children: [
              { name: 'Scene 1', wordCount: 5000 },
              { name: 'Scene 2', wordCount: 5000 }
            ]},
            { name: 'Chapter 8', wordCount: 10000, children: [
              { name: 'Scene 1', wordCount: 5000 },
              { name: 'Scene 2', wordCount: 5000 }
            ]}
          ]},
          { name: 'Part 3', wordCount: 20000, children: [
            { name: 'Chapter 9', wordCount: 8000, children: [
              { name: 'Scene 1', wordCount: 4000 },
              { name: 'Scene 2', wordCount: 4000 }
            ]},
            { name: 'Chapter 10', wordCount: 12000, children: [
              { name: 'Scene 1', wordCount: 6000 },
              { name: 'Scene 2', wordCount: 6000 }
            ]}
          ]}
        ]
      },
      'short-story': {
        // 3 Acts without scenes
        level1: [
          { name: 'Act 1', wordCount: 1000, children: [
            { name: 'Scene 1', wordCount: 400 },
            { name: 'Scene 2', wordCount: 600 }
          ]},
          { name: 'Act 2', wordCount: 2500, children: [
            { name: 'Scene 1', wordCount: 800 },
            { name: 'Scene 2', wordCount: 1200 },
            { name: 'Scene 3', wordCount: 500 }
          ]},
          { name: 'Act 3', wordCount: 1500, children: [
            { name: 'Scene 1', wordCount: 1000 },
            { name: 'Scene 2', wordCount: 500 }
          ]}
        ]
      },
      'podcast': {
        // 1 Season with 3 episodes
        level1: [
          { name: 'Season 1', wordCount: 15000, children: [
            { name: 'Episode 1', wordCount: 4500, children: [
              { name: 'Segment 1', wordCount: 2000 },
              { name: 'Segment 2', wordCount: 2500 }
            ]},
            { name: 'Episode 2', wordCount: 5500, children: [
              { name: 'Segment 1', wordCount: 3000 },
              { name: 'Segment 2', wordCount: 2500 }
            ]},
            { name: 'Episode 3', wordCount: 5000, children: [
              { name: 'Segment 1', wordCount: 2500 },
              { name: 'Segment 2', wordCount: 2500 }
            ]}
          ]}
        ]
      },
      'article': {
        // 4 Sections with subsections
        level1: [
          { name: 'Section 1', wordCount: 1500, children: [
            { name: 'Subsection 1', wordCount: 600 },
            { name: 'Subsection 2', wordCount: 900 }
          ]},
          { name: 'Section 2', wordCount: 2500, children: [
            { name: 'Subsection 1', wordCount: 1000 },
            { name: 'Subsection 2', wordCount: 800 },
            { name: 'Subsection 3', wordCount: 700 }
          ]},
          { name: 'Section 3', wordCount: 2000, children: [
            { name: 'Subsection 1', wordCount: 1200 },
            { name: 'Subsection 2', wordCount: 800 }
          ]},
          { name: 'Section 4', wordCount: 1000, children: [
            { name: 'Subsection 1', wordCount: 1000 }
          ]}
        ]
      },
      'essay': {
        // 3 Sections with paragraphs
        level1: [
          { name: 'Section 1', wordCount: 1200, children: [
            { name: 'Paragraph 1', wordCount: 400 },
            { name: 'Paragraph 2', wordCount: 500 },
            { name: 'Paragraph 3', wordCount: 300 }
          ]},
          { name: 'Section 2', wordCount: 2000, children: [
            { name: 'Paragraph 1', wordCount: 700 },
            { name: 'Paragraph 2', wordCount: 800 },
            { name: 'Paragraph 3', wordCount: 500 }
          ]},
          { name: 'Section 3', wordCount: 1800, children: [
            { name: 'Paragraph 1', wordCount: 600 },
            { name: 'Paragraph 2', wordCount: 700 },
            { name: 'Paragraph 3', wordCount: 500 }
          ]}
        ]
      },
      'report': {
        // 5 Chapters with sections
        level1: [
          { name: 'Chapter 1', wordCount: 3000, children: [
            { name: 'Section 1', wordCount: 1000, children: [
              { name: 'Subsection 1', wordCount: 600 },
              { name: 'Subsection 2', wordCount: 400 }
            ]},
            { name: 'Section 2', wordCount: 2000, children: [
              { name: 'Subsection 1', wordCount: 1200 },
              { name: 'Subsection 2', wordCount: 800 }
            ]}
          ]},
          { name: 'Chapter 2', wordCount: 4500, children: [
            { name: 'Section 1', wordCount: 2250, children: [
              { name: 'Subsection 1', wordCount: 1350 },
              { name: 'Subsection 2', wordCount: 900 }
            ]},
            { name: 'Section 2', wordCount: 2250, children: [
              { name: 'Subsection 1', wordCount: 1350 },
              { name: 'Subsection 2', wordCount: 900 }
            ]}
          ]},
          { name: 'Chapter 3', wordCount: 4000, children: [
            { name: 'Section 1', wordCount: 2000, children: [
              { name: 'Subsection 1', wordCount: 1200 },
              { name: 'Subsection 2', wordCount: 800 }
            ]},
            { name: 'Section 2', wordCount: 2000, children: [
              { name: 'Subsection 1', wordCount: 1200 },
              { name: 'Subsection 2', wordCount: 800 }
            ]}
          ]},
          { name: 'Chapter 4', wordCount: 3500, children: [
            { name: 'Section 1', wordCount: 1750, children: [
              { name: 'Subsection 1', wordCount: 1050 },
              { name: 'Subsection 2', wordCount: 700 }
            ]},
            { name: 'Section 2', wordCount: 1750, children: [
              { name: 'Subsection 1', wordCount: 1050 },
              { name: 'Subsection 2', wordCount: 700 }
            ]}
          ]},
          { name: 'Chapter 5', wordCount: 2500, children: [
            { name: 'Section 1', wordCount: 1250, children: [
              { name: 'Subsection 1', wordCount: 750 },
              { name: 'Subsection 2', wordCount: 500 }
            ]},
            { name: 'Section 2', wordCount: 1250, children: [
              { name: 'Subsection 1', wordCount: 750 },
              { name: 'Subsection 2', wordCount: 500 }
            ]}
          ]}
        ]
      }
    }
    
    const template = structureTemplates[format] || structureTemplates['screenplay']
    
    // Recursive function to generate items from template
    const generateFromTemplate = (templateItems: any[], parentId?: string, level: number = 1) => {
      for (let i = 0; i < templateItems.length; i++) {
        const templateItem = templateItems[i]
        const itemId = `item-${Date.now()}-${itemCounter++}`
        
        const item: StoryStructureItem = {
          id: itemId,
          level,
          parentId,
          name: templateItem.name,
          title: '',
          description: '',
          order: i,
          completed: false,
          content: '',
          expanded: level < 3, // Expand levels 1 and 2
          wordCount: templateItem.wordCount
        }
        
        newItems.push(item)
        
        // Recursively generate children
        if (templateItem.children && templateItem.children.length > 0) {
          generateFromTemplate(templateItem.children, itemId, level + 1)
        }
      }
    }
    
    generateFromTemplate(template.level1)
    
    onUpdate(node.id, { items: newItems })
  }

  // Add new structural item at a specific level
  const handleAddItem = (parentId?: string, level: number = 1) => {
    const siblings = parentId 
      ? items.filter(item => item.parentId === parentId)
      : items.filter(item => item.level === 1 && !item.parentId)
    
    const levelName = getLevelName(level)
    
    const newItem: StoryStructureItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: level,
      parentId: parentId,
      name: `${levelName} ${siblings.length + 1}`,
      title: '',
      description: '',
      order: siblings.length,
      completed: false,
      content: '',
      expanded: false
    }

    const updatedItems = [...items, newItem]
    onUpdate(node.id, { items: updatedItems })
  }
  
  // Toggle expanded state
  const handleToggleExpanded = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, expanded: !item.expanded } : item
    )
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

  // Delete an item and all its children recursively
  const handleDeleteItem = (itemId: string) => {
    const deleteRecursive = (id: string): string[] => {
      const childrenIds = items.filter(item => item.parentId === id).map(child => child.id)
      const allDescendants = childrenIds.flatMap(childId => deleteRecursive(childId))
      return [id, ...allDescendants]
    }
    
    const idsToDelete = deleteRecursive(itemId)
    const updatedItems = items.filter(item => !idsToDelete.includes(item.id))
    
    onUpdate(node.id, { items: updatedItems })
  }

  // Toggle item completion
  const handleToggleComplete = (itemId: string) => {
    const updatedItems = items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    )
    onUpdate(node.id, { items: updatedItems })
  }

  // Move item up/down in order among siblings
  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    // Get siblings (items at same level with same parent)
    const siblings = items.filter(i => 
      i.level === item.level && i.parentId === item.parentId
    ).sort((a, b) => a.order - b.order)

    const currentIndex = siblings.findIndex(i => i.id === itemId)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= siblings.length) return

    const targetItem = siblings[targetIndex]

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

  // Delete entire structure node
  const handleDelete = () => {
    onDelete(node.id)
    setShowDeleteConfirm(false)
  }

  // Recursive component to render tree items
  const renderTreeItem = (item: StoryStructureItem, depth: number = 0): JSX.Element => {
    const children = getChildren(item.id)
    const itemHasChildren = children.length > 0
    const canAddChild = item.level < 3 && hierarchy && item.level < hierarchy.length
    const siblings = items.filter(i => i.level === item.level && i.parentId === item.parentId).sort((a, b) => a.order - b.order)
    const siblingIndex = siblings.findIndex(i => i.id === item.id)
    
    return (
      <div key={item.id} className="relative">
        <div
          className={`border rounded-lg p-3 transition-all ${
            item.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
          }`}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          {editingItemId === item.id ? (
            // Edit mode
            <div className="space-y-2">
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder={`${getLevelName(item.level)} name`}
                maxLength={200}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                aria-label="Structure item name"
              />
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                placeholder="Title (optional)"
                maxLength={500}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                aria-label="Structure item title"
              />
              <textarea
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                placeholder="Description (optional)"
                maxLength={2000}
                rows={2}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                aria-label="Structure item description"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-3 py-1.5 bg-yellow-400 text-black rounded font-medium text-sm hover:bg-yellow-500 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 rounded font-medium text-sm hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // View mode
            <div className="flex items-start gap-2">
              {/* Checkbox */}
              <button
                onClick={() => handleToggleComplete(item.id)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  item.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {item.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Expand/Collapse chevron */}
              {(itemHasChildren || canAddChild) && (
                <button
                  onClick={() => handleToggleExpanded(item.id)}
                  className="mt-0.5 flex-shrink-0 text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  {item.expanded ? (
                    <ChevronDownIcon className="w-4 h-4" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4" />
                  )}
                </button>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm ${item.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                  {item.name}
                </h4>
                {item.title && <p className="text-xs text-gray-600 mt-0.5">{item.title}</p>}
                {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                
                {/* Add child button */}
                {canAddChild && item.expanded && (
                  <button
                    onClick={() => handleAddItem(item.id, item.level + 1)}
                    className="mt-2 text-xs text-yellow-600 hover:text-yellow-700 font-medium flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add {getLevelName(item.level + 1)}
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleMoveItem(item.id, 'up')}
                  disabled={siblingIndex === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                  title="Move up"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveItem(item.id, 'down')}
                  disabled={siblingIndex === siblings.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-20"
                  title="Move down"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleEditItem(item)}
                  className="p-1 text-gray-400 hover:text-yellow-600"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
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
          )}
        </div>
        
        {/* Render children */}
        {item.expanded && children.length > 0 && (
          <div className="mt-2 space-y-2">
            {children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
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

      {/* Hierarchy Info */}
      {hierarchy && hierarchy.length > 1 && (
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-1 text-xs">
            {hierarchy.map((level, index) => (
              <div key={level.level} className="flex items-center">
                <span className="text-gray-600">{level.name}</span>
                {index < hierarchy.length - 1 && <span className="mx-1 text-gray-400">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content - Tree Structure */}
      <div className="flex-1 overflow-y-auto p-6">
        {topLevelItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No {getLevelName(1)}s yet</h3>
            <p className="text-xs text-gray-500 mb-4">
              Generate a structure automatically or add items manually
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleGenerateStructure}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-lg font-medium text-sm hover:bg-yellow-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Structure
              </button>
              <button
                onClick={() => handleAddItem(undefined, 1)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add One
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Tree structure */}
            {topLevelItems.map((item) => renderTreeItem(item, 0))}
            
            {/* Add top-level item button */}
            <button
              onClick={() => handleAddItem(undefined, 1)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-yellow-400 hover:text-yellow-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add {getLevelName(1)}
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
