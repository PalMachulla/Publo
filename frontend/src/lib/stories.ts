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

// Save canvas state (optimized - only updates what changed)
export async function saveCanvas(
  storyId: string,
  nodes: Node[],
  edges: Edge[]
) {
  console.log('Saving canvas:', { storyId, nodeCount: nodes.length, edgeCount: edges.length })
  
  const currentNodeIds = nodes.map(n => n.id)
  const currentEdgeIds = edges.map(e => e.id)

  try {
    // Perform all operations in parallel for speed
    const operations = []

    // Upsert nodes (updates existing, inserts new)
    if (nodes.length > 0) {
      const nodeRecords = nodes.map(node => ({
        id: node.id,
        story_id: storyId,
        type: node.type || 'storyNode',
        position_x: node.position.x,
        position_y: node.position.y,
        data: node.data
      }))

      operations.push(
        supabase.from('nodes').upsert(nodeRecords, { onConflict: 'id' })
      )
    }

    // Upsert edges (updates existing, inserts new)
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

      operations.push(
        supabase.from('edges').upsert(edgeRecords, { onConflict: 'id' })
      )
    }

    // Delete nodes that no longer exist (only if we have nodes)
    if (currentNodeIds.length > 0) {
      operations.push(
        supabase
          .from('nodes')
          .delete()
          .eq('story_id', storyId)
          .not('id', 'in', `(${currentNodeIds.join(',')})`)
      )
    }

    // Delete edges that no longer exist (only if we have edges)
    if (currentEdgeIds.length > 0) {
      operations.push(
        supabase
          .from('edges')
          .delete()
          .eq('story_id', storyId)
          .not('id', 'in', `(${currentEdgeIds.join(',')})`)
      )
    }

    // Update story timestamp
    operations.push(
      supabase
        .from('stories')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', storyId)
    )

    // Execute all operations in parallel
    const results = await Promise.all(operations)

    // Check for errors
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('Save errors:', errors)
      throw errors[0].error
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

