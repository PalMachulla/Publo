/**
 * Node types export for ReactFlow
 * 
 * Centralized export of all node type components for use in ReactFlow configuration
 */

import UniversalNode from '@/components/canvas/UniversalNode'
import OrchestratorNode from '@/components/nodes/OrchestratorNode'
import StoryDraftNode from '@/components/nodes/StoryDraftNode'
import StoryStructureNode from '@/components/nodes/StoryStructureNode'
import ClusterNode from '@/components/nodes/ClusterNode'
import TestNode from '@/components/nodes/TestNode'
import AIPromptNode from '@/components/nodes/AIPromptNode'

export const nodeTypes = {
  storyNode: UniversalNode,
  createStoryNode: OrchestratorNode, // Legacy support
  orchestratorNode: OrchestratorNode,
  storyDraftNode: StoryDraftNode,
  storyStructureNode: StoryStructureNode,
  clusterNode: ClusterNode,
  testNode: TestNode,
  aiPromptNode: AIPromptNode,
}

