/**
 * Stories Data Layer
 * 
 * Updated: Orchestrator node ID is now story-scoped: context_${storyId}
 */

import { createClient } from '@/lib/supabase/client'
import type { Node, Edge } from 'reactflow'

const supabase = createClient()

// ============================================================
// HELPER: Generate orchestrator node ID
// ============================================================

/**
 * Generate the orchestrator node ID for a story
 * This ensures each story has its own unique orchestrator node
 */
export function getOrchestratorNodeId(storyId: string): string {
  return `context_${storyId}`
}

/**
 * Check if a node ID is an orchestrator node
 * 2024-12-11: Updated to handle both underscore and hyphen separators
 */
export function isOrchestratorNode(nodeId: string): boolean {
  return nodeId === 'context' || nodeId.startsWith('context_') || nodeId.startsWith('context-')
}

/**
 * Extract story ID from orchestrator node ID
 * Returns null if not a valid orchestrator node ID
 */
export function getStoryIdFromOrchestratorNode(nodeId: string): string | null {
  if (nodeId.startsWith('context_')) {
    return nodeId.replace('context_', '')
  }
  return null
}

// ============================================================
// STORY CRUD
// ============================================================

/**
 * Create new story with orchestrator node
 */
export async function createStory(title: string = 'Untitled Story') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('stories')
    .insert({ user_id: user.id, title })
    .select()
    .single()

  if (error) throw error

  // Create orchestrator node with story-scoped ID
  const orchestratorNodeId = getOrchestratorNodeId(data.id)
  
  const contextNode = {
    id: orchestratorNodeId,
    story_id: data.id,
    type: 'orchestratorNode',
    position_x: 250,
    position_y: 500,
    data: { 
      label: 'Orchestrator',
      comments: [],
      nodeType: 'create-story',
      is_orchestrating: false,
      loading_text: ''
    }
  }

  const { error: nodeError } = await supabase
    .from('nodes')
    .insert(contextNode)

  if (nodeError) {
    console.error('Failed to create orchestrator node:', nodeError)
    // Don't throw - story was created successfully
  }

  // Return story with orchestrator node ID for convenience
  return {
    ...data,
    orchestratorNodeId
  }
}

/**
 * Get all stories for current user
 */
export async function getStories() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Get single story by ID
 */
export async function getStory(storyId: string) {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', storyId)
    .single()

  if (error) throw error
  
  return {
    ...data,
    orchestratorNodeId: getOrchestratorNodeId(storyId)
  }
}

/**
 * Update story
 */
export async function updateStory(storyId: string, updates: { title?: string }) {
  const { data, error } = await supabase
    .from('stories')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', storyId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete story (cascades to nodes, edges, sessions)
 */
export async function deleteStory(storyId: string) {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', storyId)

  if (error) throw error
}

// ============================================================
// CANVAS OPERATIONS
// ============================================================

/**
 * Load canvas (nodes + edges) for a story
 */
export async function loadCanvas(storyId: string) {
  const [nodesResult, edgesResult] = await Promise.all([
    supabase.from('nodes').select('*').eq('story_id', storyId),
    supabase.from('edges').select('*').eq('story_id', storyId)
  ])

  if (nodesResult.error) throw nodesResult.error
  if (edgesResult.error) throw edgesResult.error

  const nodes: Node[] = (nodesResult.data || []).map(n => ({
    id: n.id,
    type: n.type,
    position: { x: n.position_x, y: n.position_y },
    data: n.data || {}
  }))

  const edges: Edge[] = (edgesResult.data || []).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type || 'smoothstep',
    animated: e.animated || false,
    style: e.style || {}
  }))

  // Find orchestrator node ID
  const orchestratorNode = nodes.find(n => isOrchestratorNode(n.id))
  const orchestratorNodeId = orchestratorNode?.id || getOrchestratorNodeId(storyId)

  return { 
    nodes, 
    edges,
    orchestratorNodeId
  }
}

/**
 * Save canvas state (optimized with upsert)
 */
export async function saveCanvas(
  storyId: string,
  nodes: Node[],
  edges: Edge[]
) {
  // Dedupe by id to prevent PostgREST "ON CONFLICT ... cannot affect row a second time"
  // when local state accidentally contains duplicates.
  const dedupedNodes = Array.from(
    nodes.reduce((acc, n) => acc.set(n.id, n), new Map<string, Node>()).values()
  )
  const dedupedEdges = Array.from(
    edges.reduce((acc, e) => acc.set(e.id, e), new Map<string, Edge>()).values()
  )

  if (dedupedNodes.length !== nodes.length || dedupedEdges.length !== edges.length) {
    console.warn('⚠️ [saveCanvas] Deduped canvas before save:', {
      storyId,
      nodesBefore: nodes.length,
      nodesAfter: dedupedNodes.length,
      edgesBefore: edges.length,
      edgesAfter: dedupedEdges.length,
    })
  }

  console.log('💾 Saving canvas:', { storyId, nodeCount: dedupedNodes.length, edgeCount: dedupedEdges.length })
  
  try {
    const upsertPromises = []

    if (dedupedNodes.length > 0) {
      const nodeRecords = dedupedNodes.map(node => ({
        id: node.id,
        story_id: storyId,
        type: node.type || 'storyNode',
        position_x: node.position.x,
        position_y: node.position.y,
        data: node.data
      }))

      upsertPromises.push(
        supabase.from('nodes').upsert(nodeRecords, { onConflict: 'id' })
      )
    }

    if (dedupedEdges.length > 0) {
      const edgeRecords = dedupedEdges.map(edge => ({
        id: edge.id,
        story_id: storyId,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        animated: edge.animated,
        style: edge.style
      }))

      upsertPromises.push(
        supabase.from('edges').upsert(edgeRecords, { onConflict: 'id' })
      )
    }

    const upsertResults = await Promise.all(upsertPromises)
    const upsertErrors = upsertResults.filter(r => r.error)
    if (upsertErrors.length > 0) {
      console.error('Upsert errors:', upsertErrors)
      throw upsertErrors[0].error
    }

    // Clean up deleted nodes/edges
    const currentNodeIds = dedupedNodes.map(n => n.id)
    const currentEdgeIds = dedupedEdges.map(e => e.id)

    const { data: existingNodes } = await supabase
      .from('nodes')
      .select('id')
      .eq('story_id', storyId)
    
    if (existingNodes && existingNodes.length > 0) {
      const nodesToDelete = existingNodes
        .filter(n => !currentNodeIds.includes(n.id))
        .map(n => n.id)
      
      if (nodesToDelete.length > 0) {
        await supabase.from('nodes').delete().in('id', nodesToDelete)
      }
    }

    const { data: existingEdges } = await supabase
      .from('edges')
      .select('id')
      .eq('story_id', storyId)
    
    if (existingEdges && existingEdges.length > 0) {
      const edgesToDelete = existingEdges
        .filter(e => !currentEdgeIds.includes(e.id))
        .map(e => e.id)
      
      if (edgesToDelete.length > 0) {
        await supabase.from('edges').delete().in('id', edgesToDelete)
      }
    }

    console.log('✅ Canvas saved successfully')
  } catch (error) {
    console.error('❌ Failed to save canvas:', error)
    throw error
  }
}