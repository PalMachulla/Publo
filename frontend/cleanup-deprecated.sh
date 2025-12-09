#!/bin/bash

# =============================================================================
# Orchestrator Cleanup Script
# =============================================================================
# This script checks for unused TypeScript files after Python migration
# and renames them with .deprecated suffix
#
# Usage: ./cleanup-deprecated.sh [--dry-run]
#   --dry-run: Only show what would be renamed, don't actually rename
#
# =============================================================================

set -e

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "🔍 DRY RUN MODE - No files will be renamed"
  echo ""
fi

cd "$(dirname "$0")"

# Counters
CHECKED=0
DEPRECATED=0
KEPT=0
SKIPPED=0

# Arrays to track results
declare -a DEPRECATED_FILES
declare -a KEPT_FILES
declare -a SKIPPED_FILES

# =============================================================================
# Helper function to check if a file is imported anywhere
# =============================================================================
check_imports() {
  local file="$1"
  local basename=$(basename "$file" .ts)
  basename=$(basename "$basename" .tsx)
  
  # Skip if already deprecated
  if [[ "$file" == *.deprecated* ]]; then
    return 2  # Skip
  fi
  
  # Search for imports of this file (excluding the file itself)
  local import_count=$(grep -r "$basename" src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^$file:" | grep -c "import\|from\|require" || true)
  
  if [[ $import_count -eq 0 ]]; then
    return 0  # Not imported - can deprecate
  else
    return 1  # Is imported - keep
  fi
}

# =============================================================================
# Helper function to deprecate a file
# =============================================================================
deprecate_file() {
  local file="$1"
  local reason="$2"
  
  CHECKED=$((CHECKED + 1))
  
  if [[ "$file" == *.deprecated* ]]; then
    SKIPPED=$((SKIPPED + 1))
    SKIPPED_FILES+=("$file (already deprecated)")
    return
  fi
  
  if check_imports "$file"; then
    # Not imported anywhere
    if [[ "$DRY_RUN" == true ]]; then
      echo "📦 WOULD DEPRECATE: $file"
      echo "   Reason: $reason"
    else
      mv "$file" "${file}.deprecated"
      echo "📦 DEPRECATED: $file"
    fi
    DEPRECATED=$((DEPRECATED + 1))
    DEPRECATED_FILES+=("$file - $reason")
  else
    local status=$?
    if [[ $status -eq 2 ]]; then
      SKIPPED=$((SKIPPED + 1))
      SKIPPED_FILES+=("$file")
    else
      KEPT=$((KEPT + 1))
      KEPT_FILES+=("$file")
      echo "✅ KEPT (still imported): $file"
    fi
  fi
}

# =============================================================================
# Helper to deprecate entire directory
# =============================================================================
deprecate_directory() {
  local dir="$1"
  local reason="$2"
  
  if [[ ! -d "$dir" ]]; then
    echo "⚠️  Directory not found: $dir"
    return
  fi
  
  echo ""
  echo "📁 Checking directory: $dir"
  echo "   Reason: $reason"
  echo ""
  
  find "$dir" -name "*.ts" -o -name "*.tsx" | while read file; do
    deprecate_file "$file" "$reason"
  done
}

echo "============================================================================="
echo "🧹 Orchestrator Cleanup Script"
echo "============================================================================="
echo ""
echo "This script marks unused TypeScript files as .deprecated"
echo "after migrating orchestration to Python backend."
echo ""

# =============================================================================
# PHASE 1: Intent Analysis System (replaced by Python)
# =============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 1: Intent Analysis System (Python now handles this)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Individual files
deprecate_file "src/lib/orchestrator/context/llmIntentAnalyzer.ts" "Python intent analyzer"
deprecate_file "src/lib/orchestrator/context/intentRouter.ts" "Python intent router"
deprecate_file "src/lib/orchestrator/context/intentAnalyzerWrapper.ts" "Python intent wrapper"
deprecate_file "src/lib/orchestrator/context/templateMatcher.ts" "Python template matching"

# Entire intent pipeline directory
deprecate_directory "src/lib/orchestrator/context/intent" "Entire intent pipeline moved to Python"

# =============================================================================
# PHASE 2: Orchestrator Engine (replaced by Python LangGraph)
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 2: Orchestrator Engine (Python LangGraph now handles this)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

deprecate_file "src/lib/orchestrator/core/orchestratorEngine.ts" "Main engine moved to Python"
deprecate_file "src/lib/orchestrator/core/orchestratorEngine.helpers.ts" "Helpers moved to Python"
deprecate_file "src/lib/orchestrator/core/orchestratorEngine.clarification.ts" "Clarification in Python"
deprecate_file "src/lib/orchestrator/core/orchestratorEngine.learning.ts" "Learning in Python"
deprecate_file "src/lib/orchestrator/core/orchestratorEngine.actions.ts" "Actions in Python"
deprecate_file "src/lib/orchestrator/core/orchestratorEngine.structure.ts" "Structure gen in Python"
deprecate_file "src/lib/orchestrator/core/orchestratorEngine.confirmation.ts" "Confirmation in Python"
# Note: Keep orchestratorEngine.types.ts and orchestratorEngine.constants.ts - may still be used

# =============================================================================
# PHASE 3: Actions (replaced by Python)
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 3: Actions (Python now handles action execution)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

deprecate_directory "src/lib/orchestrator/actions" "All actions moved to Python"

# =============================================================================
# PHASE 4: Tools (check if still used)
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 4: Tools (checking if still used)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

deprecate_file "src/lib/orchestrator/tools/saveTool.ts" "Save tool - check usage"
deprecate_file "src/lib/orchestrator/tools/createStructureTool.ts" "Structure tool - Python"
deprecate_file "src/lib/orchestrator/tools/messageTool.ts" "Message tool - check usage"
deprecate_file "src/lib/orchestrator/tools/deleteNodeTool.ts" "Delete tool - check usage"
deprecate_file "src/lib/orchestrator/tools/answerQuestionTool.ts" "Answer tool - check usage"
deprecate_file "src/lib/orchestrator/tools/selectSectionTool.ts" "Select tool - check usage"
deprecate_file "src/lib/orchestrator/tools/writeContentTool.ts" "Write tool - check usage"
deprecate_file "src/lib/orchestrator/tools/openDocumentTool.ts" "Open doc tool - check usage"
# Note: Keep ToolRegistry.ts, BaseTool.ts, types.ts, index.ts if other tools use them

# =============================================================================
# PHASE 5: Hooks (check if still used)
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 5: Hooks (checking if still used)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

deprecate_file "src/lib/orchestrator/hooks/useOrchestrate.ts" "Old orchestrate hook"
deprecate_file "src/lib/orchestrator/hooks/useOrchestratorActions.ts" "Old actions hook"
deprecate_file "src/lib/orchestrator/hooks/useCreateStoryNode.ts" "Implemented in CanvasPanels"
# Note: Keep useOrchestratorSession.ts - still used for chat history

# =============================================================================
# PHASE 6: Other potentially unused files
# =============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PHASE 6: Other files to check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

deprecate_file "src/lib/orchestrator/learning/correctionService.ts" "Learning moved to Python"
deprecate_file "src/lib/orchestrator/reasoning/coherenceRewriter.ts" "Reasoning in Python"
deprecate_file "src/lib/orchestrator/prompts/structureGeneration.ts" "Prompts in Python"
deprecate_file "src/lib/orchestrator/context/contextProvider.ts" "Context in Python"
deprecate_file "src/lib/orchestrator/context/dependencyAnalyzer.ts" "Dependencies in Python"
deprecate_file "src/lib/orchestrator/context/temporalMemory.ts" "Memory in Python"
deprecate_file "src/lib/orchestrator/context/ragIntegration.ts" "RAG in Python"

# Agents - check if multi-agent is still used or moved to Python
deprecate_file "src/lib/orchestrator/agents/ExecutionTracer.ts" "Agents - check usage"
deprecate_file "src/lib/orchestrator/agents/CriticAgent.ts" "Critic agent - Python?"
deprecate_file "src/lib/orchestrator/agents/MultiAgentOrchestrator.ts" "Multi-agent - Python?"
deprecate_file "src/lib/orchestrator/agents/WriterAgent.ts" "Writer agent - Python?"
deprecate_file "src/lib/orchestrator/agents/DAGExecutor.ts" "DAG executor - Python?"
deprecate_file "src/lib/orchestrator/agents/AgentRegistry.ts" "Agent registry - Python?"
deprecate_directory "src/lib/orchestrator/agents/clusters" "Agent clusters - Python?"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "============================================================================="
echo "📊 SUMMARY"
echo "============================================================================="
echo ""
echo "Files checked:    $CHECKED"
echo "Files deprecated: $DEPRECATED"
echo "Files kept:       $KEPT"
echo "Files skipped:    $SKIPPED"
echo ""

if [[ ${#DEPRECATED_FILES[@]} -gt 0 ]]; then
  echo "📦 DEPRECATED FILES:"
  for f in "${DEPRECATED_FILES[@]}"; do
    echo "   - $f"
  done
  echo ""
fi

if [[ ${#KEPT_FILES[@]} -gt 0 ]]; then
  echo "✅ KEPT FILES (still imported):"
  for f in "${KEPT_FILES[@]}"; do
    echo "   - $f"
  done
  echo ""
fi

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "🔍 This was a DRY RUN. To actually rename files, run:"
  echo "   ./cleanup-deprecated.sh"
fi

echo ""
echo "============================================================================="
echo "✨ Done! Remember to:"
echo "   1. Run 'npm run build' to check for broken imports"
echo "   2. Test the application thoroughly"
echo "   3. Commit changes with a descriptive message"
echo "============================================================================="
