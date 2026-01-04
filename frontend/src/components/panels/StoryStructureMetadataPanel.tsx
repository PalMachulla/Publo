/**
 * StoryStructureMetadataPanel
 * 
 * 2024-12-14: Extracted from NodeDetailsPanel.tsx as part of panel architecture refactor
 * 
 * Displays metadata and embedding controls for story structure nodes.
 * This panel appears when clicking on a StoryStructureNode on the canvas.
 */
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Node } from 'reactflow'
import { StoryStructureNodeData } from '@/types/nodes'
import { createClient } from '@/lib/supabase/client'

interface StoryStructureMetadataPanelProps {
  node: Node<StoryStructureNodeData>
  onUpdate: (nodeId: string, data: any) => void
  onDelete: (nodeId: string) => void
  onClose: () => void
}

export default function StoryStructureMetadataPanel({
  node,
  onUpdate,
  onDelete,
  onClose,
}: StoryStructureMetadataPanelProps) {
  const supabase = createClient()
  const nodeData = node.data
  const isMountedRef = useRef(true)
  
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
  
  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  
  // Check embedding status
  const checkEmbeddingStatus = useCallback(async (nodeId: string) => {
    if (typeof window === 'undefined' || !isMountedRef.current) return
    
    setEmbeddingStatus(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await fetch(`/api/embeddings/generate?nodeId=${nodeId}`)
      const data = await response.json()
      
      if (!isMountedRef.current) return
      
      setEmbeddingStatus({
        exists: data.exists || false,
        chunkCount: data.chunkCount || 0,
        queueStatus: data.queueStatus || 'none',
        loading: false,
        generating: false
      })
      
      if (data.queueStatus === 'unavailable') {
        console.warn('Embeddings feature not set up:', data.error)
      }
    } catch (error) {
      console.error('Failed to check embedding status:', error)
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
  }, [])
  
  // Generate embeddings
  const generateEmbeddings = async (nodeId: string, structureItems: any[]) => {
    setEmbeddingStatus(prev => ({ ...prev, generating: true }))
    try {
      let sections: Array<{
        documentSectionId: string
        content: string
        structureItem: any
      }> = []
      
      // Try new hierarchical system first
      const { data: nodeData, error: nodeError } = await supabase
        .from('nodes')
        .select('document_data')
        .eq('id', nodeId)
        .single()
      
      if (nodeData?.document_data?.structure) {
        console.log('✅ [Embeddings] Using hierarchical document_data')
        
        const extractSegments = (segments: any[], parentPath: string = ''): any[] => {
          const result: any[] = []
          for (const seg of segments) {
            if (seg.content && seg.content.trim().length > 0) {
              result.push({
                documentSectionId: seg.id,
                content: seg.content,
                structureItem: {
                  id: seg.id,
                  level: seg.level,
                  name: seg.name,
                  title: seg.title,
                  order: seg.order,
                  type: 'section'
                }
              })
            }
            if (seg.children && seg.children.length > 0) {
              result.push(...extractSegments(seg.children, `${parentPath}/${seg.name}`))
            }
          }
          return result
        }
        
        sections = extractSegments(nodeData.document_data.structure)
        console.log(`📝 [Embeddings] Extracted ${sections.length} sections from document_data`)
      }
      
      // Fall back to legacy document_sections
      if (sections.length === 0) {
        console.log('⚠️ [Embeddings] No document_data found, falling back to legacy document_sections')
        
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
        
        sections = documentSections.map((docSection) => {
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
      }
      
      if (sections.length === 0) {
        alert('⚠️ No content found to vectorize.\n\nThis document appears to be empty.')
        setEmbeddingStatus(prev => ({ ...prev, generating: false }))
        return
      }
      
      console.log(`🚀 [Embeddings] Generating embeddings for ${sections.length} sections...`)
      
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
        await checkEmbeddingStatus(nodeId)
        alert(`✅ Embeddings generated!\n\nSections: ${data.successfulSections}/${data.totalSections}\nChunks: ${data.totalChunks}\nTokens: ${data.totalTokens}`)
      } else if (response.status === 503) {
        alert(`⚙️ Setup Required\n\n${data.error}\n\n${data.details}\n\n💡 ${data.hint}`)
        setEmbeddingStatus(prev => ({ ...prev, generating: false, queueStatus: 'unavailable' }))
      } else {
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
  
  // Check embedding status on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && node.id) {
      checkEmbeddingStatus(node.id)
    }
  }, [node.id, checkEmbeddingStatus])
  
  return (
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
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Created</span>
              <span className="text-sm font-medium text-gray-900">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Sections</span>
              <span className="text-sm font-medium text-gray-900">
                {nodeData.items?.length || 1}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Pages</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.max(1, Math.floor((nodeData.items?.length || 1) * 2.5))}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Word Count</span>
              <span className="text-sm font-medium text-gray-900">
                {(nodeData as any).document_data?.totalWordCount?.toLocaleString() || '0'}
              </span>
            </div>

            {(nodeData as any).template && (
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Template</span>
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {(nodeData as any).template.replace(/-/g, ' ')}
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
                  <>⚠️ Not vectorized yet. Generate embeddings to enable semantic search and RAG.</>
                ) : (
                  <>ℹ️ No content to vectorize. Write content first, then generate embeddings.</>
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
  )
}
