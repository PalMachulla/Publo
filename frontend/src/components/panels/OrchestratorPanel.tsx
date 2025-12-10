/**
 * OrchestratorPanel - Wrapper Component
 * 
 * =============================================================================
 * STREAMING UI ONLY (Legacy panel deprecated)
 * =============================================================================
 * 
 * This component now only uses the streaming UI.
 * The legacy panel has been deprecated and moved to:
 * - @/lib/orchestrator/components/OrchestratorPanel/index.tsx.deprecated
 * 
 * @see components/orchestrator/OrchestratorPanelStreaming for implementation
 */
'use client'

import { OrchestratorPanelStreaming } from '@/components/orchestrator/OrchestratorPanelStreaming'

export interface OrchestratorPanelProps {
  userId: string
  sessionId?: string
  storyId?: string
  documentFormat?: string
  onStructureComplete?: (structure: any) => void
  onSectionComplete?: (sectionId: string, content: string) => void
  onClarificationNeeded?: (clarification: any) => void
  onCreateStoryNode?: (structure: any) => void
  // Pass through any other props the panels need
  [key: string]: any
}

export default function OrchestratorPanel(props: OrchestratorPanelProps) {
  // Always use streaming UI - legacy panel is deprecated
  return <OrchestratorPanelStreaming {...props} />
}

// Also export named for flexibility
export { OrchestratorPanel }