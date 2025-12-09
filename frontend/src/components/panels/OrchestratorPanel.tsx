/**
 * OrchestratorPanel - Wrapper Component
 * 
 * =============================================================================
 * POST-PYTHON MIGRATION
 * =============================================================================
 * 
 * This wrapper now always uses the new OrchestratorPanel that communicates
 * with the Python backend via backendClient.ts.
 * 
 * The legacy TypeScript-based orchestrator has been deprecated.
 * 
 * Previously this component used a feature flag (NEXT_PUBLIC_USE_PYTHON_ORCHESTRATION)
 * to switch between new and legacy panels. That flag is no longer needed.
 * 
 * @see lib/orchestrator/components/OrchestratorPanel for the implementation
 * @see lib/orchestrator/backendClient.ts for Python API communication
 */
'use client'

import { OrchestratorPanel as NewPanel } from '@/lib/orchestrator/components/OrchestratorPanel'

// Re-export the new panel directly
// The legacy panel (LegacyOrchestratorPanel.tsx) has been deprecated
export default function OrchestratorPanel(props: any) {
  return <NewPanel {...props} />
}