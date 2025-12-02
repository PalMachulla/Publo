/**
 * documentService - Document operations service
 * 
 * Handles document-related operations including:
 * - Structure items updates
 * - Document switching
 * - Content generation (write content)
 * - Question answering
 * 
 * Architecture Notes:
 * - Content map uses fallback chain: node contentMap → section content → structure summary
 * - Document operations interact with Supabase for persistence
 * - Uses DocumentManager for hierarchical document structure
 * 
 * @see DocumentManager for hierarchical document management
 * @see canvas/page.tsx for original implementation
 */

import { Node } from 'reactflow'
import { createClient } from '@/lib/supabase/client'
import { StoryFormat, StoryStructureNodeData } from '@/types/nodes'
import type { WorldStateManager } from '@/lib/orchestrator/core/worldState'

export interface DocumentServiceDependencies {
  // State setters
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setCurrentStructureItems: (items: any[]) => void
  setCurrentStructureFormat: (format: StoryFormat | undefined) => void
  setCurrentContentMap: (map: Record<string, string>) => void
  setCurrentStoryStructureNodeId: (id: string | null) => void
  
  // Document state
  currentStoryStructureNodeId: string | null
  currentStructureItems: any[]
  currentStructureFormat: StoryFormat | undefined
  currentContentMap: Record<string, string>
  currentSections: Array<{ id: string; structure_item_id: string; content: string }>
  activeContext: { type: 'section' | 'segment'; id: string; name: string } | null
  
  // Callbacks
  // Note: Signature matches StoryStructureNode usage: (item, allItems, format, nodeId)
  handleStructureItemClick?: (item: any, allItems: any[], format: StoryFormat, nodeId: string) => Promise<void>
  refreshSectionsRef: React.MutableRefObject<(() => Promise<void>) | null>
  
  // Refs
  hasUnsavedChangesRef: React.MutableRefObject<boolean>
  isLoadingRef: React.MutableRefObject<boolean>
  worldStateRef: React.MutableRefObject<WorldStateManager | null>
}

/**
 * Update structure items for a node
 * 
 * Updates both the canvas node and current document state if the node is currently open
 */
export function updateStructureItems(
  nodeId: string,
  updatedItems: any[],
  dependencies: DocumentServiceDependencies
): void {
  const {
    setNodes,
    setCurrentStructureItems,
    currentStoryStructureNodeId,
    handleStructureItemClick,
    hasUnsavedChangesRef,
    isLoadingRef
  } = dependencies
  
  console.log('Structure items updated:', { nodeId, updatedItems })
  
  setNodes((nds) =>
    nds.map((node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            items: updatedItems,
            onItemClick: handleStructureItemClick,
            onItemsUpdate: (items: any[]) => updateStructureItems(nodeId, items, dependencies)
          }
        }
      }
      return node
    })
  )
  
  // Update current structure items if this is the currently open node
  if (nodeId === currentStoryStructureNodeId) {
    setCurrentStructureItems(updatedItems)
  }
  
  // Mark as having unsaved changes
  if (!isLoadingRef.current) {
    hasUnsavedChangesRef.current = true
  }
}

/**
 * Switch to a different document
 * 
 * Loads document data from canvas node and updates document state
 */
export function switchDocument(
  nodeId: string,
  dependencies: DocumentServiceDependencies & {
    setInitialSectionId?: (id: string | null) => void
  }
): void {
  const {
    setNodes,
    setCurrentStoryStructureNodeId,
    setCurrentStructureItems,
    setCurrentStructureFormat,
    setCurrentContentMap,
    setInitialSectionId
  } = dependencies
  
  console.log('Switching to document:', nodeId)
  
  // Use setNodes to get LATEST state
  let latestContentMap: Record<string, string> = {}
  let allItems: any[] = []
  let format: StoryFormat | undefined
  
  setNodes((currentNodes) => {
    const targetNode = currentNodes.find(n => n.id === nodeId && n.type === 'storyStructureNode')
    if (!targetNode) {
      console.error('Story structure node not found:', nodeId)
      return currentNodes
    }
    
    const nodeData = targetNode.data as StoryStructureNodeData
    allItems = nodeData.items || []
    format = nodeData.format
    latestContentMap = nodeData.contentMap || {}
    
    return currentNodes // Don't modify nodes, just read from them
  })
  
  // Update state
  setCurrentStoryStructureNodeId(nodeId)
  setCurrentStructureItems(allItems)
  setCurrentStructureFormat(format)
  setCurrentContentMap(latestContentMap)
  setInitialSectionId?.(null) // Reset to first section (optional)
}

/**
 * Write content for a specific segment
 * 
 * Features:
 * - Builds content map with smart fallback chain
 * - Calls content generation API with full context
 * - Saves content to hierarchical document structure
 * - Updates canvas node with new word count
 * - Refreshes document panel
 */
export async function writeContent(
  segmentId: string,
  prompt: string,
  dependencies: DocumentServiceDependencies
): Promise<void> {
  const {
    setNodes,
    setCurrentContentMap,
    currentStoryStructureNodeId,
    currentStructureItems,
    currentSections,
    currentContentMap,
    currentStructureFormat,
    refreshSectionsRef,
    worldStateRef
  } = dependencies
  
  console.log('📝 handleWriteContent:', { segmentId, prompt })
  
  // BUILD STRATEGIC CONTEXT (orchestrator's job!)
  // Get full hierarchy, previous content, future summaries
  let effectiveContentMap: Record<string, string> = { ...currentContentMap }
  
  // Build contentMap with smart fallback (same logic as handleAnswerQuestion)
  if (Object.keys(effectiveContentMap).length === 0) {
    const sectionByItemId = new Map(currentSections.map(s => [s.structure_item_id, s]))
    currentStructureItems.forEach((item: any) => {
      const section = sectionByItemId.get(item.id)
      if (section?.content && section.content.trim() && !section.content.includes('<p></p>')) {
        effectiveContentMap[item.id] = section.content
      } else if (item.summary && item.summary.trim()) {
        effectiveContentMap[item.id] = item.summary
      }
    })
  }
  
  console.log('🧠 Orchestrator context:', {
    targetSegment: segmentId,
    totalStructureItems: currentStructureItems.length,
    contentMapSize: Object.keys(effectiveContentMap).length,
    hasPreviousContent: currentStructureItems.findIndex((item: any) => item.id === segmentId) > 0
  })
  
  // ✅ MIGRATION: Add reasoning message via WorldState
  if (worldStateRef.current) {
    worldStateRef.current.addMessage({
      content: `📝 Orchestrator delegating to writer model with full story context...`,
      type: 'task',
      role: 'orchestrator'
    })
  }
  
  try {
    // Call API with FULL orchestrator context
    const response = await fetch('/api/content/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segmentId,
        prompt,
        storyStructureNodeId: currentStoryStructureNodeId,
        // STRATEGIC CONTEXT from orchestrator
        structureItems: currentStructureItems, // Full hierarchy
        contentMap: effectiveContentMap, // All content/summaries
        format: currentStructureFormat, // Story format
      })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      // Show the actual error message from the API
      const errorMsg = data.error || response.statusText
      const errorDetails = data.details ? `\nDetails: ${data.details}` : ''
      throw new Error(`Failed to generate content: ${errorMsg}${errorDetails}`)
    }
    
    // Update the content map with new content (local state)
    setCurrentContentMap(prev => ({
      ...prev,
      [segmentId]: data.content
    }))
    
    // ✅ NEW HIERARCHICAL SYSTEM: Save content to document_data JSONB
    console.log('💾 Saving generated content to hierarchical document:', {
      segmentId,
      contentLength: data.content.length,
      nodeId: currentStoryStructureNodeId
    })
    
    try {
      // ✅ Validate nodeId before fetching
      if (!currentStoryStructureNodeId) {
        console.error('❌ Cannot save content: No active document')
        return
      }
      
      const supabase = createClient()
      
      // Fetch current document_data
      const { data: nodeData, error: fetchError } = await supabase
        .from('nodes')
        .select('document_data')
        .eq('id', currentStoryStructureNodeId)
        .maybeSingle() // ✅ Use maybeSingle() instead of single()
        
      if (fetchError) {
        console.error('❌ Failed to fetch document_data:', fetchError)
        return
      }
      
      if (!nodeData) {
        console.error('❌ Node not found:', currentStoryStructureNodeId)
        return
      }
      
      if (nodeData?.document_data) {
        // Import DocumentManager dynamically
        const { DocumentManager } = await import('@/lib/document/DocumentManager')
        
        // Load existing document
        const docManager = new DocumentManager(nodeData.document_data)
        
        // Update the segment content
        const success = docManager.updateContent(segmentId, data.content)
        
        if (success) {
          // Save back to database
          const { error: updateError } = await supabase
            .from('nodes')
            .update({ document_data: docManager.getData() })
            .eq('id', currentStoryStructureNodeId)
          
          if (updateError) {
            console.error('❌ Failed to save document_data:', updateError)
          } else {
            console.log('✅ Content saved to hierarchical document')
            
            // ✅ Update canvas node with new document_data (includes updated word count)
            const updatedDocumentData = docManager.getData()
            setNodes((nds) => nds.map((n) => 
              n.id === currentStoryStructureNodeId
                ? { ...n, data: { ...n.data, document_data: updatedDocumentData } }
                : n
            ))
            
            console.log('🔄 Canvas node updated with new word count:', updatedDocumentData.totalWordCount)
            
            // Refresh document panel to show new content
            if (refreshSectionsRef.current) {
              console.log('🔄 Refreshing document view...')
              await refreshSectionsRef.current()
            }
          }
        } else {
          console.error('❌ Failed to update segment in DocumentManager')
        }
      } else {
        console.warn('⚠️ No document_data found - content only in local state')
      }
    } catch (saveError) {
      console.error('❌ Error saving to hierarchical document:', saveError)
      // Don't throw - content is still in local contentMap
    }
    
    // ✅ MIGRATION: Add success message via WorldState
    if (worldStateRef.current) {
      worldStateRef.current.addMessage({
        content: `✅ Content generated and saved for segment: ${segmentId}`,
        type: 'result',
        role: 'orchestrator'
      })
    }
    
  } catch (error) {
    console.error('Failed to write content:', error)
    // ✅ MIGRATION: Add error message via WorldState
    if (worldStateRef.current) {
      worldStateRef.current.addMessage({
        content: `❌ Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        role: 'orchestrator'
      })
    }
  }
}

/**
 * Answer a question about the document
 * 
 * Features:
 * - Builds content map with smart fallback chain
 * - Calls answer API with full document context
 * - Returns streaming text response
 * 
 * Content Map Fallback Chain:
 * 1. Node contentMap (from test markdown)
 * 2. Section content (user-written full story from Supabase)
 * 3. Structure item summary (AI-generated overview)
 */
export async function answerQuestion(
  question: string,
  dependencies: DocumentServiceDependencies
): Promise<string> {
  const {
    currentStoryStructureNodeId,
    currentStructureItems,
    currentContentMap,
    currentSections,
    activeContext
  } = dependencies
  
  console.log('💬 handleAnswerQuestion:', question)
  
  // BUILD contentMap with SMART FALLBACK CHAIN:
  // 1. Node contentMap (from test markdown)
  // 2. Section content (user-written full story from Supabase)
  // 3. Structure item summary (AI-generated overview)
  let effectiveContentMap = { ...currentContentMap }
  
  if (Object.keys(effectiveContentMap).length === 0) {
    console.log('📦 Building contentMap with smart fallback chain...')
    
    // Create a map from structure_item_id to section for quick lookup
    const sectionByItemId = new Map(
      currentSections.map(s => [s.structure_item_id, s])
    )
    
    currentStructureItems.forEach((item: any) => {
      const section = sectionByItemId.get(item.id)
      
      // Priority 1: Section content (user-written full story)
      if (section?.content && section.content.trim() && !section.content.includes('<p></p>')) {
        effectiveContentMap[item.id] = section.content
        console.log(`  ✅ [${item.name}] Using section.content (full story)`)
      }
      // Priority 2: Structure item summary (AI-generated overview)
      else if (item.summary && item.summary.trim()) {
        effectiveContentMap[item.id] = item.summary
        console.log(`  📝 [${item.name}] Using item.summary (AI overview): "${item.summary.substring(0, 60)}..."`)
      }
    })
    
    console.log('✅ Built contentMap:', {
      structureItemsCount: currentStructureItems.length,
      sectionsCount: currentSections.length,
      contentMapSize: Object.keys(effectiveContentMap).length,
      sampleKeys: Object.keys(effectiveContentMap).slice(0, 3)
    })
  }
  
  console.log('📊 Context being sent:', {
    storyStructureNodeId: currentStoryStructureNodeId,
    structureItemsCount: currentStructureItems.length,
    sectionsCount: currentSections.length,
    contentMapKeys: Object.keys(effectiveContentMap),
    contentMapSize: Object.keys(effectiveContentMap).length,
    hasActiveContext: !!activeContext,
    contentMapSample: Object.keys(effectiveContentMap).slice(0, 3).map(key => ({
      id: key,
      length: effectiveContentMap[key]?.length,
      preview: effectiveContentMap[key]?.substring(0, 100)
    }))
  })
  
  try {
    // Call API to answer question using orchestrator model
    const response = await fetch('/api/content/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        context: {
          storyStructureNodeId: currentStoryStructureNodeId,
          structureItems: currentStructureItems,
          contentMap: effectiveContentMap, // ← Use built contentMap from sections!
          activeContext
        }
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to answer question: ${response.statusText}`)
    }
    
    // The API now returns a streaming text response, not JSON
    const answer = await response.text()
    return answer
    
  } catch (error) {
    console.error('Failed to answer question:', error)
    return `I apologize, but I encountered an error trying to answer your question: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

