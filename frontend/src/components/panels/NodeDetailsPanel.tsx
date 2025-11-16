'use client'

import { useState, useMemo } from 'react'
import { Node, Edge } from 'reactflow'
import { AnyNodeData, Comment, StoryStructureItem, TestNodeData } from '@/types/nodes'
import { useAuth } from '@/contexts/AuthContext'
import StoryBookPanel from './StoryBookPanel'
import CharacterPanel from './CharacterPanel'
import ResearchPanel from './ResearchPanel'
import ClusterPanel from './ClusterPanel'
import CreateStoryPanel from './CreateStoryPanel'
import StoryStructurePanel from './StoryStructurePanel'
import { PASTEL_COLORS } from '@/components/nodes/narrationline/NarrationSegment'
import { parseMarkdownStructure } from '@/lib/markdownParser'

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

// Define realistic structure templates with proportional word counts
// These templates are used when clicking "Generate Structure" button in the NodeDetailsPanel
// IMPORTANT: These must match the templates in StoryStructurePanel.tsx
const structureTemplates: Record<string, any> = {
  'screenplay': {
    // Classic 3-act structure: 25% / 50% / 25% with Beats
    level1: [
      { name: 'Act 1', wordCount: 3750, children: [
        { name: 'Sequence 1', wordCount: 1500, children: [
          { name: 'Scene 1', wordCount: 600, children: [
            { name: 'Beat 1', wordCount: 300 },
            { name: 'Beat 2', wordCount: 300 }
          ]},
          { name: 'Scene 2', wordCount: 500, children: [
            { name: 'Beat 1', wordCount: 250 },
            { name: 'Beat 2', wordCount: 250 }
          ]},
          { name: 'Scene 3', wordCount: 400, children: [
            { name: 'Beat 1', wordCount: 200 },
            { name: 'Beat 2', wordCount: 200 }
          ]}
        ]},
        { name: 'Sequence 2', wordCount: 1250, children: [
          { name: 'Scene 1', wordCount: 500, children: [
            { name: 'Beat 1', wordCount: 250 },
            { name: 'Beat 2', wordCount: 250 }
          ]},
          { name: 'Scene 2', wordCount: 750, children: [
            { name: 'Beat 1', wordCount: 400 },
            { name: 'Beat 2', wordCount: 350 }
          ]}
        ]},
        { name: 'Sequence 3', wordCount: 1000, children: [
          { name: 'Scene 1', wordCount: 1000, children: [
            { name: 'Beat 1', wordCount: 500 },
            { name: 'Beat 2', wordCount: 500 }
          ]}
        ]}
      ]},
      { name: 'Act 2', wordCount: 7500, children: [
        { name: 'Sequence 1', wordCount: 2250, children: [
          { name: 'Scene 1', wordCount: 750, children: [
            { name: 'Beat 1', wordCount: 400 },
            { name: 'Beat 2', wordCount: 350 }
          ]},
          { name: 'Scene 2', wordCount: 1000, children: [
            { name: 'Beat 1', wordCount: 500 },
            { name: 'Beat 2', wordCount: 500 }
          ]},
          { name: 'Scene 3', wordCount: 500, children: [
            { name: 'Beat 1', wordCount: 250 },
            { name: 'Beat 2', wordCount: 250 }
          ]}
        ]},
        { name: 'Sequence 2', wordCount: 3000, children: [
          { name: 'Scene 1', wordCount: 1200, children: [
            { name: 'Beat 1', wordCount: 600 },
            { name: 'Beat 2', wordCount: 600 }
          ]},
          { name: 'Scene 2', wordCount: 1800, children: [
            { name: 'Beat 1', wordCount: 900 },
            { name: 'Beat 2', wordCount: 900 }
          ]}
        ]},
        { name: 'Sequence 3', wordCount: 2250, children: [
          { name: 'Scene 1', wordCount: 900, children: [
            { name: 'Beat 1', wordCount: 450 },
            { name: 'Beat 2', wordCount: 450 }
          ]},
          { name: 'Scene 2', wordCount: 1350, children: [
            { name: 'Beat 1', wordCount: 700 },
            { name: 'Beat 2', wordCount: 650 }
          ]}
        ]}
      ]},
      { name: 'Act 3', wordCount: 3750, children: [
        { name: 'Sequence 1', wordCount: 2250, children: [
          { name: 'Scene 1', wordCount: 1350, children: [
            { name: 'Beat 1', wordCount: 700 },
            { name: 'Beat 2', wordCount: 650 }
          ]},
          { name: 'Scene 2', wordCount: 900, children: [
            { name: 'Beat 1', wordCount: 450 },
            { name: 'Beat 2', wordCount: 450 }
          ]}
        ]},
        { name: 'Sequence 2', wordCount: 1500, children: [
          { name: 'Scene 1', wordCount: 1500, children: [
            { name: 'Beat 1', wordCount: 750 },
            { name: 'Beat 2', wordCount: 750 }
          ]}
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
    // 3 Acts with scenes
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
    // 1 Season with 3 episodes, segments, and topics
    level1: [
      { name: 'Season 1', wordCount: 15000, children: [
        { name: 'Episode 1', wordCount: 4500, children: [
          { name: 'Segment 1', wordCount: 2000, children: [
            { name: 'Topic 1', wordCount: 800 },
            { name: 'Topic 2', wordCount: 1200 }
          ]},
          { name: 'Segment 2', wordCount: 2500, children: [
            { name: 'Topic 1', wordCount: 1000 },
            { name: 'Topic 2', wordCount: 1500 }
          ]}
        ]},
        { name: 'Episode 2', wordCount: 5500, children: [
          { name: 'Segment 1', wordCount: 3000, children: [
            { name: 'Topic 1', wordCount: 1200 },
            { name: 'Topic 2', wordCount: 1800 }
          ]},
          { name: 'Segment 2', wordCount: 2500, children: [
            { name: 'Topic 1', wordCount: 1000 },
            { name: 'Topic 2', wordCount: 1500 }
          ]}
        ]},
        { name: 'Episode 3', wordCount: 5000, children: [
          { name: 'Segment 1', wordCount: 2500, children: [
            { name: 'Topic 1', wordCount: 1000 },
            { name: 'Topic 2', wordCount: 1500 }
          ]},
          { name: 'Segment 2', wordCount: 2500, children: [
            { name: 'Topic 1', wordCount: 1250 },
            { name: 'Topic 2', wordCount: 1250 }
          ]}
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
    // 5 Chapters with sections, subsections, and sub-subsections
    level1: [
      { name: 'Chapter 1', wordCount: 3000, children: [
        { name: 'Section 1', wordCount: 1000, children: [
          { name: 'Subsection 1', wordCount: 600, children: [
            { name: 'Sub-subsection 1', wordCount: 300 },
            { name: 'Sub-subsection 2', wordCount: 300 }
          ]},
          { name: 'Subsection 2', wordCount: 400, children: [
            { name: 'Sub-subsection 1', wordCount: 200 },
            { name: 'Sub-subsection 2', wordCount: 200 }
          ]}
        ]},
        { name: 'Section 2', wordCount: 2000, children: [
          { name: 'Subsection 1', wordCount: 1200, children: [
            { name: 'Sub-subsection 1', wordCount: 600 },
            { name: 'Sub-subsection 2', wordCount: 600 }
          ]},
          { name: 'Subsection 2', wordCount: 800, children: [
            { name: 'Sub-subsection 1', wordCount: 400 },
            { name: 'Sub-subsection 2', wordCount: 400 }
          ]}
        ]}
      ]},
      { name: 'Chapter 2', wordCount: 4500, children: [
        { name: 'Section 1', wordCount: 2250, children: [
          { name: 'Subsection 1', wordCount: 1350, children: [
            { name: 'Sub-subsection 1', wordCount: 700 },
            { name: 'Sub-subsection 2', wordCount: 650 }
          ]},
          { name: 'Subsection 2', wordCount: 900, children: [
            { name: 'Sub-subsection 1', wordCount: 450 },
            { name: 'Sub-subsection 2', wordCount: 450 }
          ]}
        ]},
        { name: 'Section 2', wordCount: 2250, children: [
          { name: 'Subsection 1', wordCount: 1350, children: [
            { name: 'Sub-subsection 1', wordCount: 700 },
            { name: 'Sub-subsection 2', wordCount: 650 }
          ]},
          { name: 'Subsection 2', wordCount: 900, children: [
            { name: 'Sub-subsection 1', wordCount: 450 },
            { name: 'Sub-subsection 2', wordCount: 450 }
          ]}
        ]}
      ]},
      { name: 'Chapter 3', wordCount: 4000, children: [
        { name: 'Section 1', wordCount: 2000, children: [
          { name: 'Subsection 1', wordCount: 1200, children: [
            { name: 'Sub-subsection 1', wordCount: 600 },
            { name: 'Sub-subsection 2', wordCount: 600 }
          ]},
          { name: 'Subsection 2', wordCount: 800, children: [
            { name: 'Sub-subsection 1', wordCount: 400 },
            { name: 'Sub-subsection 2', wordCount: 400 }
          ]}
        ]},
        { name: 'Section 2', wordCount: 2000, children: [
          { name: 'Subsection 1', wordCount: 1200, children: [
            { name: 'Sub-subsection 1', wordCount: 600 },
            { name: 'Sub-subsection 2', wordCount: 600 }
          ]},
          { name: 'Subsection 2', wordCount: 800, children: [
            { name: 'Sub-subsection 1', wordCount: 400 },
            { name: 'Sub-subsection 2', wordCount: 400 }
          ]}
        ]}
      ]},
      { name: 'Chapter 4', wordCount: 3500, children: [
        { name: 'Section 1', wordCount: 1750, children: [
          { name: 'Subsection 1', wordCount: 1050, children: [
            { name: 'Sub-subsection 1', wordCount: 550 },
            { name: 'Sub-subsection 2', wordCount: 500 }
          ]},
          { name: 'Subsection 2', wordCount: 700, children: [
            { name: 'Sub-subsection 1', wordCount: 350 },
            { name: 'Sub-subsection 2', wordCount: 350 }
          ]}
        ]},
        { name: 'Section 2', wordCount: 1750, children: [
          { name: 'Subsection 1', wordCount: 1050, children: [
            { name: 'Sub-subsection 1', wordCount: 550 },
            { name: 'Sub-subsection 2', wordCount: 500 }
          ]},
          { name: 'Subsection 2', wordCount: 700, children: [
            { name: 'Sub-subsection 1', wordCount: 350 },
            { name: 'Sub-subsection 2', wordCount: 350 }
          ]}
        ]}
      ]},
      { name: 'Chapter 5', wordCount: 2500, children: [
        { name: 'Section 1', wordCount: 1250, children: [
          { name: 'Subsection 1', wordCount: 750, children: [
            { name: 'Sub-subsection 1', wordCount: 400 },
            { name: 'Sub-subsection 2', wordCount: 350 }
          ]},
          { name: 'Subsection 2', wordCount: 500, children: [
            { name: 'Sub-subsection 1', wordCount: 250 },
            { name: 'Sub-subsection 2', wordCount: 250 }
          ]}
        ]},
        { name: 'Section 2', wordCount: 1250, children: [
          { name: 'Subsection 1', wordCount: 750, children: [
            { name: 'Sub-subsection 1', wordCount: 400 },
            { name: 'Sub-subsection 2', wordCount: 350 }
          ]},
          { name: 'Subsection 2', wordCount: 500, children: [
            { name: 'Sub-subsection 1', wordCount: 250 },
            { name: 'Sub-subsection 2', wordCount: 250 }
          ]}
        ]}
      ]}
    ]
  }
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
                        // Find the structure node to update (not the orchestrator!)
                        console.log('🔍 Looking for structure node. Available nodes:', {
                          allNodes: nodes.map(n => ({ id: n.id, type: n.type }))
                        })
                        
                        const structureNode = nodes.find((n) => n.type === 'storyStructureNode')
                        
                        if (!structureNode) {
                          console.error('❌ No structure node found. Available nodes:', {
                            nodeTypes: nodes.map(n => n.type)
                          })
                          alert('No structure node found. Please create a structure node first.')
                          return
                        }
                        
                        console.log('🎯 Found structure node to update:', {
                          structureNodeId: structureNode.id,
                          orchestratorNodeId: node.id
                        })
                        
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
                            alert('Failed to parse test node markdown. Using default template instead.')
                            // Fall through to template generation
                          }
                        }

                        // Default template-based generation
                        const format = nodeData.format || 'screenplay'
                        const template = structureTemplates[format] || structureTemplates['screenplay']
                        
                        const newItems: StoryStructureItem[] = []
                        let itemCounter = 0
                        
                        // Recursive function to generate items from template
                        const generateFromTemplate = (templateItems: any[], parentId?: string, level: number = 1, parentColor?: string) => {
                          for (let i = 0; i < templateItems.length; i++) {
                            const templateItem = templateItems[i]
                            const itemId = `item-${Date.now()}-${itemCounter++}`
                            
                            // Assign colors only at level 1, cascade for children
                            let itemColor = parentColor
                            if (level === 1) {
                              const colorIndex = i % PASTEL_COLORS.length
                              itemColor = PASTEL_COLORS[colorIndex].hex
                            } else if (parentColor) {
                              itemColor = lightenColor(parentColor, level - 1)
                            }
                            
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
                              expanded: level < 4, // Expand first 3 levels to show 4 levels
                              wordCount: templateItem.wordCount,
                              backgroundColor: itemColor
                            }
                            
                            newItems.push(item)
                            
                            if (templateItem.children && templateItem.children.length > 0) {
                              generateFromTemplate(templateItem.children, itemId, level + 1, itemColor)
                            }
                          }
                        }
                        
                        generateFromTemplate(template.level1)
                        
                        console.log('📝 Generated structure (NodeDetailsPanel):', {
                          format,
                          totalItems: newItems.length,
                          maxLevel: Math.max(...newItems.map(i => i.level)),
                          level1Items: newItems.filter(i => i.level === 1).map(i => ({ name: i.name, wordCount: i.wordCount })),
                          level2Items: newItems.filter(i => i.level === 2).map(i => ({ name: i.name, wordCount: i.wordCount, parentId: i.parentId })),
                          level3Items: newItems.filter(i => i.level === 3).map(i => ({ name: i.name, wordCount: i.wordCount, parentId: i.parentId })),
                          level4Items: newItems.filter(i => i.level === 4).map(i => ({ name: i.name, wordCount: i.wordCount, parentId: i.parentId })),
                          allItems: newItems
                        })
                        
                        // Update STRUCTURE NODE (not orchestrator)
                        onUpdate(structureNode.id, { items: newItems })
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

