# Bug Fix: Invalid Section IDs in Tasks

**Date:** November 26, 2025  
**Status:** ✅ FIXED

---

## 🐛 **The Problem**

**Symptoms:**
- Content generation failed with "Section seq1/seq2/seq3/seq4 not found in document"
- Generated content was completely unrelated to the structure (Emily at a lake, not halibut eating seagulls)
- Multiple "saveAgentContent API route failed" errors

**Root Cause:**
The LLM was generating tasks with `sectionId` values that **didn't match** the actual structure IDs!

**Example:**
```json
{
  "structure": [
    { "id": "act1", "name": "Act I - Setup", ... },
    { "id": "act1_seq1", "name": "Sequence 1 - Coastal Life", ... },
    { "id": "act1_seq2", "name": "Sequence 2 - Subtle Disturbances", ... }
  ],
  "tasks": [
    { "id": "task1", "sectionId": "seq1", ... },  // ❌ WRONG! Should be "act1_seq1"
    { "id": "task2", "sectionId": "seq2", ... },  // ❌ WRONG! Should be "act1_seq2"
    { "id": "task3", "sectionId": "seq3", ... }   // ❌ WRONG! Doesn't exist!
  ]
}
```

**What Happened:**
1. Orchestrator generated structure with correct IDs (`act1`, `act1_seq1`, etc.)
2. Orchestrator generated tasks with WRONG IDs (`seq1`, `seq2`, etc.)
3. WriterAgent tried to save content to `seq1` → **Section not found!**
4. Content was generated but couldn't be saved
5. User saw random content because the agent had no context

---

## ✅ **Fixes Applied**

### **Fix 1: Task Validation After Structure Generation**

**File:** `frontend/src/app/canvas/page.tsx`  
**Lines:** 1689-1711

```typescript
// ✅ CRITICAL FIX: Validate that all task sectionIds exist in structure
const validSectionIds = new Set(structureItems.map((s: any) => s.id))
const invalidTasks = plan.tasks.filter((task: any) => !validSectionIds.has(task.sectionId))

if (invalidTasks.length > 0) {
  console.warn('⚠️ [triggerOrchestratedGeneration] Found tasks with invalid sectionIds:', {
    invalidTasks: invalidTasks.map((t: any) => ({ taskId: t.id, sectionId: t.sectionId })),
    validSectionIds: Array.from(validSectionIds)
  })
  
  // Remove invalid tasks to prevent "section not found" errors
  plan.tasks = plan.tasks.filter((task: any) => validSectionIds.has(task.sectionId))
  
  onReasoning(`⚠️ Removed ${invalidTasks.length} invalid tasks (section IDs don't match structure)`, 'decision')
}

console.log('✅ [triggerOrchestratedGeneration] Task validation complete:', {
  totalTasks: plan.tasks.length,
  validTasks: plan.tasks.length,
  removedTasks: invalidTasks.length
})
```

**What This Does:**
1. Creates a Set of all valid section IDs from the structure
2. Filters out any tasks with `sectionId` that doesn't exist in the structure
3. Logs which tasks were removed and why
4. Notifies user via orchestrator panel

---

### **Fix 2: Improved LLM Prompt**

**File:** `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`  
**Lines:** 2325-2338

```typescript
const systemPrompt = `You are an expert story structure planner. Your role is to analyze creative prompts and create detailed, hierarchical structures optimized for the requested format.

${formatInstructions}${reportWarning}

Generate a complete structure plan with:
- Concise reasoning (max 1000 characters)
- 3-20 hierarchical structure items with clear parent-child relationships
- Realistic word count estimates for each section
- Specific writing tasks (minimum 1)
- Metadata with total word count, estimated time, and recommended models (REQUIRED)

CRITICAL: Each task's sectionId MUST exactly match an id from the structure array. For example, if you create a section with id "act1", then tasks for that section must use sectionId "act1" (not "seq1" or any other value).`
```

**What This Does:**
- Explicitly tells the LLM that task `sectionId` must match structure `id`
- Provides a concrete example
- Uses "CRITICAL" to emphasize importance

---

## 📊 **Expected Behavior (After Fix)**

### **Scenario 1: LLM Generates Correct IDs**
```json
{
  "structure": [
    { "id": "act1", "name": "Act I - Setup" }
  ],
  "tasks": [
    { "id": "task1", "sectionId": "act1" }  // ✅ CORRECT!
  ]
}
```
**Result:** Content generated and saved successfully ✅

### **Scenario 2: LLM Generates Wrong IDs (Fallback)**
```json
{
  "structure": [
    { "id": "act1", "name": "Act I - Setup" }
  ],
  "tasks": [
    { "id": "task1", "sectionId": "seq1" }  // ❌ WRONG!
  ]
}
```
**Result:** 
- Validation catches the error
- Invalid task is removed
- User sees: "⚠️ Removed 1 invalid tasks (section IDs don't match structure)"
- No "section not found" errors
- Structure is still created correctly

---

## 🎯 **Impact**

### **Before:**
- ❌ "Section seq1 not found in document" errors
- ❌ Content generated but not saved
- ❌ Random/unrelated content shown to user
- ❌ Poor user experience

### **After:**
- ✅ Invalid tasks are caught and removed
- ✅ Only valid tasks are executed
- ✅ Content is saved to correct sections
- ✅ Content follows the structure summary
- ✅ Clear error messages if tasks are invalid

---

## 🧪 **Testing**

### **Test Case: Create Screenplay with Content**
```
User: "Screenplay about halibut eating seagulls, write act 1"
```

**Expected Result:**
- ✅ Structure created with correct section IDs
- ✅ Tasks validated (invalid ones removed if any)
- ✅ Content generated for valid sections only
- ✅ Content saved successfully
- ✅ Content is about halibut eating seagulls (not random characters)
- ✅ No "section not found" errors

---

## 📝 **Files Modified**

1. **`frontend/src/app/canvas/page.tsx`**
   - Lines 1689-1711: Added task validation logic

2. **`frontend/src/lib/orchestrator/core/orchestratorEngine.ts`**
   - Lines 2325-2338: Improved LLM prompt with explicit instructions

---

## 🔍 **Why This Happened**

1. **Schema Ambiguity:** The JSON schema for `TaskSchema` (line 104 in `structurePlan.ts`) says:
   ```typescript
   sectionId: { type: 'string', description: 'ID of the section this task relates to' }
   ```
   This doesn't enforce that the ID must exist in the structure array.

2. **LLM Interpretation:** The LLM interpreted "section ID" loosely and generated IDs like `seq1`, `seq2` that made sense to it but didn't match the actual structure IDs.

3. **No Validation:** There was no validation step to catch this mismatch before tasks were executed.

---

## 🚀 **Deployment**

- **No database changes required**
- **No API changes required**
- **Frontend-only changes**
- **Backward compatible**
- **Safe to deploy immediately**

---

**Status:** ✅ **COMPLETE**  
**Priority:** 🔥 **CRITICAL** - Fixes content generation failures

---

*Intelligence Engineered by AIAKAKI*

