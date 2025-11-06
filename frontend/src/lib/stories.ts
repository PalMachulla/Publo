import { createClient } from '@/lib/supabase/client'
import { Node, Edge } from 'reactflow'
import { Story } from '@/types/nodes'

const supabase = createClient()

// Get all stories for current user
export async function getStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .order('updated_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

// Get single story with nodes and edges
export async function getStory(storyId: string) {
  const [storyResult, nodesResult, edgesResult] = await Promise.all([
    supabase.from('stories').select('*').eq('id', storyId).single(),
    supabase.from('nodes').select('*').eq('story_id', storyId),
    supabase.from('edges').select('*').eq('story_id', storyId)
  ])

  if (storyResult.error) throw storyResult.error

  // Transform database nodes to React Flow format
  const nodes: Node[] = (nodesResult.data || []).map(node => ({
    id: node.id,
    type: node.type,
    position: { x: node.position_x, y: node.position_y },
    data: node.data
  }))

  const edges: Edge[] = (edgesResult.data || []).map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    animated: edge.animated,
    style: edge.style
  }))

  return {
    story: storyResult.data,
    nodes,
    edges
  }
}

// Create new story
export async function createStory(title: string = 'Untitled Story') {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('stories')
    .insert({ user_id: user.id, title })
    .select()
    .single()

  if (error) throw error

  // Always create the context canvas node for new stories
  const contextNode = {
    id: 'context',
    story_id: data.id,
    type: 'contextCanvas',
    position_x: 200,
    position_y: 350,
    data: { placeholder: "What's your story, Morning Glory?", comments: [] }
  }

  const { error: nodeError } = await supabase
    .from('nodes')
    .insert(contextNode)

  if (nodeError) {
    console.error('Failed to create context node:', nodeError)
    // Don't throw - story was created successfully
  }

  return data
}

// Save canvas state (optimized)
export async function saveCanvas(
  storyId: string,
  nodes: Node[],
  edges: Edge[]
) {
  console.log('Saving canvas:', { storyId, nodeCount: nodes.length, edgeCount: edges.length })
  
  try {
    // Step 1: Upsert nodes and edges (happens in parallel)
    const upsertPromises = []

    if (nodes.length > 0) {
      const nodeRecords = nodes.map(node => ({
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

    if (edges.length > 0) {
      const edgeRecords = edges.map(edge => ({
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

    // Wait for upserts to complete
    const upsertResults = await Promise.all(upsertPromises)
    const upsertErrors = upsertResults.filter(r => r.error)
    if (upsertErrors.length > 0) {
      console.error('Upsert errors:', upsertErrors)
      throw upsertErrors[0].error
    }

    // Step 2: Clean up deleted items (happens in parallel)
    const currentNodeIds = nodes.map(n => n.id)
    const currentEdgeIds = edges.map(e => e.id)

    const cleanupPromises = []

    // Only delete nodes not in current list
    if (currentNodeIds.length > 0) {
      // Use a subquery approach - delete nodes for this story that aren't in the current list
      const { data: existingNodes } = await supabase
        .from('nodes')
        .select('id')
        .eq('story_id', storyId)
      
      if (existingNodes && existingNodes.length > 0) {
        const nodesToDelete = existingNodes
          .filter(n => !currentNodeIds.includes(n.id))
          .map(n => n.id)
        
        if (nodesToDelete.length > 0) {
          cleanupPromises.push(
            supabase.from('nodes').delete().in('id', nodesToDelete)
          )
        }
      }
    }

    // Only delete edges not in current list
    if (currentEdgeIds.length > 0) {
      const { data: existingEdges } = await supabase
        .from('edges')
        .select('id')
        .eq('story_id', storyId)
      
      if (existingEdges && existingEdges.length > 0) {
        const edgesToDelete = existingEdges
          .filter(e => !currentEdgeIds.includes(e.id))
          .map(e => e.id)
        
        if (edgesToDelete.length > 0) {
          cleanupPromises.push(
            supabase.from('edges').delete().in('id', edgesToDelete)
          )
        }
      }
    }

    // Update timestamp
    cleanupPromises.push(
      supabase
        .from('stories')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', storyId)
    )

    // Wait for cleanup to complete
    const cleanupResults = await Promise.all(cleanupPromises)
    const cleanupErrors = cleanupResults.filter(r => r.error)
    if (cleanupErrors.length > 0) {
      console.error('Cleanup errors:', cleanupErrors)
      // Don't throw for cleanup errors, they're not critical
    }

    console.log('Canvas saved successfully!')
  } catch (error) {
    console.error('Failed to save canvas:', error)
    throw error
  }
}

// Update story metadata
export async function updateStory(storyId: string, updates: Partial<Story>) {
  const { error } = await supabase
    .from('stories')
    .update(updates)
    .eq('id', storyId)

  if (error) throw error
}

// Delete story
export async function deleteStory(storyId: string) {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', storyId)

  if (error) throw error
}

