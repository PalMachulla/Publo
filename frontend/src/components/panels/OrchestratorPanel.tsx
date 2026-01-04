/**
 * OrchestratorPanel - DEPRECATED WRAPPER
 * 
 * =============================================================================
 * 2024-12-14: DEPRECATED - Use OrchestratorPanelStreaming directly
 * =============================================================================
 * 
 * This wrapper is now vestigial. NodeDetailsPanel.tsx imports
 * OrchestratorPanelStreaming directly ("leapfrogging" this wrapper).
 * 
 * Keeping this file for backwards compatibility with any other consumers.
 * New code should import OrchestratorPanelStreaming directly.
 * 
 * @deprecated Use OrchestratorPanelStreaming directly
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

/**
 * @deprecated Use OrchestratorPanelStreaming directly instead
 */
export default function OrchestratorPanel(props: OrchestratorPanelProps) {
  // Always use streaming UI - legacy panel is deprecated
  return <OrchestratorPanelStreaming {...props} />
}

// Also export named for flexibility
export { OrchestratorPanel }