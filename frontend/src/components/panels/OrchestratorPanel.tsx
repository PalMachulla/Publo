/**
 * OrchestratorPanel - Wrapper Component
 * 
 * =============================================================================
 * STREAMING UI MIGRATION (Phase 2)
 * =============================================================================
 * 
 * This wrapper uses a feature flag to switch between:
 * - NEW: Progressive streaming UI with visual feedback (OrchestratorPanelStreaming)
 * - CURRENT: Existing panel in @/lib/orchestrator/components/OrchestratorPanel
 * 
 * Feature Flag: NEXT_PUBLIC_USE_STREAMING_ORCHESTRATOR
 *   - true  → New progressive streaming UI
 *   - false → Current panel (default, safe fallback)
 * 
 * Once the streaming UI is stable, we can:
 * 1. Remove the feature flag
 * 2. Move files out of @/lib to proper locations
 * 3. Archive the old panel
 * 
 * @see components/orchestrator/OrchestratorPanelStreaming for new implementation
 * @see lib/orchestrator/components/OrchestratorPanel for current implementation
 */
'use client'

import { OrchestratorPanel as CurrentPanel } from '@/lib/orchestrator/components/OrchestratorPanel'
import { OrchestratorPanelStreaming } from '@/components/orchestrator/OrchestratorPanelStreaming'

// Feature flag for progressive streaming UI
const USE_STREAMING_UI = process.env.NEXT_PUBLIC_USE_STREAMING_ORCHESTRATOR === 'true'

export interface OrchestratorPanelProps {
  userId: string
  sessionId?: string
  documentFormat?: string
  onStructureComplete?: (structure: any) => void
  onSectionComplete?: (sectionId: string, content: string) => void
  onClarificationNeeded?: (clarification: any) => void
  // Pass through any other props the panels need
  [key: string]: any
}

export default function OrchestratorPanel(props: OrchestratorPanelProps) {
  if (USE_STREAMING_UI) {
    return <OrchestratorPanelStreaming {...props} />
  }
  
  return <CurrentPanel {...props} />
}

// Also export named for flexibility
export { OrchestratorPanel }