# Context Loss Diagnosis: "Emily in Ravenswood" Bug

## 🐛 The Problem

User requested: **"Craft a report about wireless headsets, write first part"**

WriterAgent generated: **"Emily returning to Ravenswood"** (gothic mystery)

## 🔍 Root Cause

The WriterAgent received **ZERO context** about the report topic:

```
📚 [WriteContentTool] Structure context: {
  structureItemsCount: 0,        // ❌ NO structure!
  contentMapKeys: 0,              // ❌ NO content!
  targetSection: undefined,       // ❌ NO target section!
  hasSummary: false,              // ❌ NO summary!
  summary: undefined              // ❌ NO summary!
}
```

Without the summary ("Provides background information on wireless headsets..."), the WriterAgent had no idea what to write about, so it generated random creative fiction.

## 📊 Data Flow Analysis

### ✅ Phase 1: Structure Creation (WORKS)

```
User: "Craft a report about wireless headsets..."
  ↓
orchestrator.orchestrate({
  message: "Craft a report...",
  currentStoryStructureNodeId: "1764180121914-xmd9yiyyy",
  // ❌ NO structureItems (doesn't exist yet)
})
  ↓
LLM generates structure with summaries:
{
  structure: [
    {
      id: "section1",
      name: "Introduction to Wireless Headsets",
      summary: "Provides background information on wireless headsets..." ✅
    },
    // ... 6 more sections
  ]
}
  ↓
Node saved to Supabase ✅
  ↓
WorldState updated:
worldState.setActiveDocument(
  "1764180121914-xmd9yiyyy",
  "report",
  structureItems  // ✅ 7 items with summaries
)
```

### ❌ Phase 2: Content Generation (FAILS)

```
orchestrator.orchestrate({
  message: "Craft a report...",
  currentStoryStructureNodeId: "1764180121914-xmd9yiyyy",
  structureItems: structureItems,  // ✅ Passed correctly (7 items)
  contentMap: {}
})
  ↓
MultiAgentOrchestrator filters actions
  ↓
executeCluster() calls WriteContentTool
  ↓
WriteContentTool.execute({
  sectionId: "section1",
  storyStructureNodeId: "1764180121914-xmd9yiyyy",
  format: "report"
})
  ↓
WriteContentTool tries to get context:
const activeDoc = worldState.getActiveDocument()
const structureItems = activeDoc.structure?.items || []
  ↓
❌ structureItems = [] (EMPTY!)
  ↓
WriterAgent receives NO context:
task.payload.context.section.summary = undefined
  ↓
WriterAgent generates random content (no guidance)
```

## 🔎 The Mystery

**Why is `worldState.getActiveDocument().structure.items` empty?**

### Hypothesis 1: WorldState Not Updated ❌

**Evidence Against:**
- Line 1782 in page.tsx: `worldState.setActiveDocument(structureNodeId, format, structureItems)`
- This happens BEFORE the second orchestration call (line 1806)
- Console log shows: `✅ [triggerOrchestratedGeneration] WorldState updated`

### Hypothesis 2: Different WorldState Instance ✅ **LIKELY**

**Evidence For:**
- WorldState is created at line 1480: `const worldState = buildWorldStateFromReactFlow(...)`
- This is a **LOCAL variable** in `triggerOrchestratedGeneration`
- The orchestrator is created at line 1495: `const orchestrator = getMultiAgentOrchestrator(..., worldState)`
- **BUT**: Is this the SAME WorldState instance that gets updated at line 1782?

**YES!** It's the same instance because:
1. WorldState is created once (line 1480)
2. Passed to orchestrator (line 1495)
3. Updated (line 1782)
4. Used in second orchestrate call (line 1806)

### Hypothesis 3: WorldState Overwritten by Supabase Fetch ✅ **MOST LIKELY**

**Evidence For:**
- Error log: `❌ Failed to fetch document_data: {code: 'PGRST116', details: 'The result contains 0 rows'}`
- The fetch URL: `GET ...nodes?select=document_data&id=eq.null`
- **The node ID is NULL!**

**Timeline:**
1. WorldState updated with structure ✅
2. Document panel opens automatically (line 1841-1845)
3. `AIDocumentPanel` mounts
4. `useHierarchicalDocument` hook tries to fetch from Supabase
5. **Race condition**: `currentStoryStructureNodeId` state hasn't updated yet
6. Fetch happens with `id=eq.null`
7. Fetch fails (0 rows)
8. WorldState might be cleared or structure lost

### Hypothesis 4: WorldState Not Passed to WriteContentTool ✅ **ROOT CAUSE**

**Evidence For:**

Looking at the orchestrator flow:
1. `orchestrator.orchestrate()` is called with `structureItems`
2. Orchestrator passes this to `MultiAgentOrchestrator`
3. `MultiAgentOrchestrator.executeCluster()` calls `toolRegistry.execute('write_content', ...)`
4. **BUT**: Does the tool context include the updated WorldState?

Let me check the tool execution flow...

## 🎯 The Real Issue

The problem is that **`structureItems` passed to `orchestrator.orchestrate()` are NOT automatically added to WorldState**!

### Current Flow:
```typescript
// page.tsx line 1806
await orchestrator.orchestrate({
  structureItems: structureItems,  // ✅ Passed to orchestrator
  // ...
})
```

But inside the orchestrator, these `structureItems` are just parameters - they don't automatically update the WorldState that was passed to the orchestrator constructor!

### The Fix

**Option 1**: Update WorldState INSIDE the orchestrator when it receives `structureItems`

```typescript
// In orchestratorEngine.ts
async orchestrate(request: OrchestratorRequest) {
  // ✅ NEW: If structureItems provided, update WorldState
  if (request.structureItems && request.currentStoryStructureNodeId) {
    this.worldState?.setActiveDocument(
      request.currentStoryStructureNodeId,
      request.documentFormat || 'novel',
      request.structureItems
    )
  }
  // ... rest of orchestration
}
```

**Option 2**: Pass `structureItems` directly to WriteContentTool

```typescript
// In MultiAgentOrchestrator.ts executeCluster()
await this.toolRegistry.execute('write_content', {
  sectionId,
  prompt,
  storyStructureNodeId,
  format,
  structureItems: request.structureItems,  // ✅ NEW: Pass directly
  contentMap: request.contentMap
}, context)
```

Then in WriteContentTool:
```typescript
// Use provided structureItems if available, otherwise fall back to WorldState
const structureItems = input.structureItems || activeDoc.structure?.items || []
```

## 🚀 Recommended Solution

**Use Option 1** because:
1. Keeps WorldState as the single source of truth
2. Ensures all tools have access to the latest structure
3. Follows the architecture design (WorldState = awareness)
4. Less parameter passing through multiple layers

## 📝 Implementation

1. Add WorldState update in `orchestratorEngine.ts` at the start of `orchestrate()`
2. Ensure this happens BEFORE any tool execution
3. Add debug logging to confirm WorldState has structure before tool execution

This will ensure that when WriteContentTool accesses `worldState.getActiveDocument().structure.items`, it gets the 7 structure items with their summaries, and the WriterAgent can generate relevant content about wireless headsets!

