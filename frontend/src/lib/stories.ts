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

// Save canvas state
export async function saveCanvas(
  storyId: string,
  nodes: Node[],
  edges: Edge[]
) {
  console.log('Saving canvas:', { storyId, nodeCount: nodes.length, edgeCount: edges.length })
  
  // Delete existing nodes and edges
  const [deleteNodesResult, deleteEdgesResult] = await Promise.all([
    supabase.from('nodes').delete().eq('story_id', storyId),
    supabase.from('edges').delete().eq('story_id', storyId)
  ])

  if (deleteNodesResult.error) {
    console.error('Error deleting nodes:', deleteNodesResult.error)
    throw deleteNodesResult.error
  }
  if (deleteEdgesResult.error) {
    console.error('Error deleting edges:', deleteEdgesResult.error)
    throw deleteEdgesResult.error
  }

  // Insert new nodes
  if (nodes.length > 0) {
    const nodeRecords = nodes.map(node => ({
      id: node.id,
      story_id: storyId,
      type: node.type || 'storyNode',
      position_x: node.position.x,
      position_y: node.position.y,
      data: node.data
    }))

    console.log('Inserting nodes:', nodeRecords)
    const { error: nodesError } = await supabase.from('nodes').insert(nodeRecords)
    if (nodesError) {
      console.error('Error inserting nodes:', nodesError)
      throw nodesError
    }
  }

  // Insert new edges
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

    console.log('Inserting edges:', edgeRecords)
    const { error: edgesError } = await supabase.from('edges').insert(edgeRecords)
    if (edgesError) {
      console.error('Error inserting edges:', edgesError)
      throw edgesError
    }
  }

  // Update story timestamp
  const { error: updateError } = await supabase
    .from('stories')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', storyId)

  if (updateError) {
    console.error('Error updating story timestamp:', updateError)
    throw updateError
  }

  console.log('Canvas saved successfully!')
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

