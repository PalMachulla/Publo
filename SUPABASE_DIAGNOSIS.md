# 🔍 Supabase Issues Diagnosis & Fixes

## Current State ✅

**What's Working:**
- ✅ Structure creation ("Carrie Carrot and Benny Bunny")
- ✅ `document_data` initialized via `DocumentManager.fromStructureItems()`
- ✅ Node saved to Supabase with proper `document_data`
- ✅ Multi-agent system wired up

**What's Broken:**
- ❌ Agents not generating content (sections still empty)
- ❌ PGRST116 errors: "Cannot coerce result to single JSON object"
- ❌ Invalid queries: `id=eq.structure-...` (structure ID, not node ID)

---

## 🐛 Root Causes

### Issue 1: Agents Never Execute
**Problem:** User says "write the first chapter" but agents don't run.

**Diagnosis:**
1. Orchestrator creates structure ✅
2. Multi-step detection should trigger content generation
3. But `generate_content` actions aren't being created
4. Or they're created but agents aren't called

**Evidence:**
- Document shows "No content yet - Click here to start writing"
- No agent logs in console
- Total words: 120,000 (structure metadata, not actual content)

### Issue 2: Invalid Supabase Queries
**Problem:** Queries using `structure_item_id` as if it's a node ID.

**Diagnosis:**
```typescript
// ❌ WRONG: Using structure item ID
id=eq.structure-1764135959933-5kwuk75v1

// ✅ CORRECT: Using actual node ID  
id=eq.abc-123-def-456...
```

**Where it breaks:**
- `useHierarchicalDocument` expects node ID
- But receives structure item ID somewhere
- Results in "0 rows" errors

### Issue 3: Content Save Mismatch
**Problem:** `saveAgentContent()` can't find sections.

**Diagnosis:**
```typescript
// Agent has:
sectionId: "structure-..." // Structure item ID

// DocumentManager expects:
sectionId: "structure-..." // Same, but document doesn't exist yet?

// Result:
"Section not found in document"
```

---

## 🔧 Required Fixes

### Fix 1: Ensure Multi-Step Detection Triggers Agents

**File:** `orchestratorEngine.ts` (multi-step detection)

**Check:**
```typescript
// After creating structure, does it add generate_content actions?
const isMultiStep = multiStepIndicators.some(pattern => pattern.test(lowerPrompt))

if (isMultiStep && plan.structure.length > 0) {
  // Should create generate_content action for first chapter
  actions.push({
    type: 'generate_content',
    payload: {
      sectionId: firstSection.id,  // ← Is this correct?
      sectionName: firstSection.name,
      prompt: `Write engaging content...`,
      autoStart: true
    },
    status: 'pending'
  })
}
```

**Verify:** Are these actions being created? Are they in `response.actions`?

### Fix 2: Ensure Agents Are Invoked

**File:** `MultiAgentOrchestrator.ts`

**Check:**
```typescript
async orchestrate(request: any): Promise<any> {
  const response = await super.orchestrate(request)
  
  // Are there actions?
  console.log('Actions to execute:', response.actions.length)
  
  if (response.actions && response.actions.length > 0) {
    await this.executeActionsWithAgents(response.actions, sessionId, request)
  }
}
```

**Verify:** 
- Are agents being called?
- Is `executeActionsWithAgents` running?
- Check console for "Starting agent execution"

### Fix 3: Validate Node ID vs Structure ID

**File:** `contentPersistence.ts`

**Add Logging:**
```typescript
export async function saveAgentContent(options: SaveContentOptions): Promise<SaveContentResult> {
  const { storyStructureNodeId, sectionId, content, userId } = options
  
  console.log('💾 [saveAgentContent] Attempting save:', {
    nodeId: storyStructureNodeId,  // Should be UUID like "abc-123..."
    sectionId: sectionId,          // Should be "structure-..."
    contentLength: content.length
  })
  
  // ...fetch node...
  
  if (!node?.document_data) {
    console.error('❌ No document_data in node:', node)
    return { success: false, error: 'No document_data found' }
  }
  
  // ...
}
```

### Fix 4: Ensure document_data Has Correct Structure

**File:** Check the actual `document_data` in Supabase

**Query:**
```sql
SELECT id, type, document_data 
FROM nodes 
WHERE type = 'storyStructureNode'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Structure:**
```json
{
  "version": 1,
  "format": "novel",
  "structure": [
    {
      "id": "structure-...",
      "name": "Chapter 1 - The Best Crunchy Smell Ever",
      "content": "",  // ← Empty initially
      "wordCount": 0,
      "status": "draft",
      "children": [...]
    }
  ],
  "totalWordCount": 0,
  "lastEditedAt": "2025-11-26T..."
}
```

---

## 🧪 Testing Steps

### Step 1: Verify Structure Creation
```typescript
// In browser console after creating structure:
const node = // get from canvas
console.log('document_data:', node.data.document_data)
console.log('Structure count:', node.data.document_data.structure.length)
```

### Step 2: Verify Action Generation
```typescript
// In orchestratorEngine.ts, add console.log:
console.log('🔍 Actions generated:', actions.map(a => ({
  type: a.type,
  sectionId: a.payload?.sectionId,
  sectionName: a.payload?.sectionName
})))
```

### Step 3: Verify Agent Execution
```typescript
// In MultiAgentOrchestrator.ts:
console.log('🚀 Executing actions:', actions.length)
console.log('Strategy:', strategy)
```

### Step 4: Verify Content Save
```typescript
// In contentPersistence.ts:
console.log('💾 Save result:', {
  success: saveResult.success,
  wordCount: saveResult.wordCount,
  error: saveResult.error
})
```

---

## 📋 Checklist

Before moving on, verify:

- [ ] Multi-step detection creates `generate_content` actions
- [ ] Actions array contains section IDs (not empty)
- [ ] `MultiAgentOrchestrator.orchestrate()` is called
- [ ] `executeActionsWithAgents()` runs
- [ ] Strategy selection works (parallel/cluster)
- [ ] Agents are allocated and execute
- [ ] `saveAgentContent()` is called with correct node ID
- [ ] Node ID is UUID format (not "structure-...")
- [ ] Section ID is "structure-..." format
- [ ] `document_data` exists in node
- [ ] `DocumentManager.updateContent()` succeeds
- [ ] Updated `document_data` is saved to Supabase
- [ ] Content appears in UI when reopening document

---

## 🎯 Next Steps

1. Add comprehensive logging to trace the full flow
2. Verify each step in the checklist
3. Fix any broken links in the chain
4. Test with a simple 1-chapter request
5. Then test with multi-chapter parallel execution

---

## 💡 Quick Debug Commands

```javascript
// In browser console:

// 1. Check if orchestrator is wired up
window.orchestrator = orchestrator // expose in OrchestratorPanel

// 2. Check blackboard messages
window.orchestrator.getBlackboard().getRecentMessages(20)

// 3. Check agent registry
window.orchestrator.getAgentRegistry().getStats()

// 4. Check last response
window.lastResponse = response // store in orchestrate()
```

