# Debug Improvements: Section ID Mismatch Tracking

## 🎯 Goal

Add comprehensive logging to track section ID mismatches between:
1. LLM-generated structure
2. Saved structure in database
3. Agent content generation attempts

## 🔧 Changes Made

### 1. **orchestratorEngine.ts** - WorldState Update
**Location:** Line ~198 in `orchestrate()` method

**Added:**
```typescript
// ✅ CRITICAL FIX: Update WorldState if structureItems provided
if (this.worldState && request.structureItems && request.currentStoryStructureNodeId) {
  console.log('🔄 [Orchestrator] Updating WorldState with structure items:', {
    nodeId: request.currentStoryStructureNodeId,
    format: _documentFormat || 'novel',
    itemsCount: request.structureItems.length
  })
  this.worldState.setActiveDocument(
    request.currentStoryStructureNodeId,
    _documentFormat || 'novel',
    request.structureItems
  )
  console.log('✅ [Orchestrator] WorldState updated - agents can now access structure')
}
```

**Why:** Ensures `structureItems` passed to `orchestrate()` are immediately available in WorldState for all tools and agents.

---

### 2. **page.tsx** - Structure ID Logging
**Location:** Line ~1700 in `triggerOrchestratedGeneration()`

**Added:**
```typescript
// ✅ DEBUG: Log structure and task IDs for verification
console.log('🔍 [triggerOrchestratedGeneration] Structure IDs:', structureItems.map((s: any) => s.id))
console.log('🔍 [triggerOrchestratedGeneration] Task section IDs:', plan.tasks.map((t: any) => t.sectionId))
```

**Why:** Shows exactly what IDs the LLM generated for both structure and tasks, making mismatches immediately visible.

**Expected Output:**
```
🔍 Structure IDs: ["prologue", "chapter1", "chapter2", ...]
🔍 Task section IDs: ["prologue", "chapter1", "chapter2", ...]
```

If these don't match, we'll see it immediately!

---

### 3. **writeContentTool.ts** - Available IDs Logging
**Location:** Line ~142 in `execute()` method

**Added:**
```typescript
// ✅ DEBUG: Log all available section IDs
console.log(`🔍 [WriteContentTool] Available section IDs in structure:`, structureItems.map(item => item.id))
console.log(`🔍 [WriteContentTool] Looking for section ID: "${sectionId}"`)
```

**Updated:**
```typescript
console.log(`📚 [WriteContentTool] Structure context:`, {
  // ... existing fields ...
  requestedSectionId: sectionId,
  foundMatch: !!targetStructureItem  // ✅ NEW: Shows if section was found
})
```

**Why:** Shows what IDs are available in WorldState when the agent tries to generate content.

**Expected Output:**
```
🔍 Available section IDs: ["prologue", "chapter1", "chapter2", ...]
🔍 Looking for section ID: "prologue"
📚 Structure context: {
  structureItemsCount: 9,
  requestedSectionId: "prologue",
  foundMatch: true  ✅
}
```

---

### 4. **contentPersistence.ts** - Save Attempt Logging
**Location:** Line ~195 in `saveAgentContent()`

**Added:**
```typescript
// ✅ DEBUG: Show section names too for easier debugging
console.log('📋 [saveAgentContent] Section ID → Name mapping:')
flatSections.forEach(s => {
  console.log(`   - "${s.id}" → "${s.name}"`)
})
console.log(`🎯 [saveAgentContent] Trying to save to: "${sectionId}"`)
```

**Updated:**
```typescript
if (!updateSuccess) {
  console.error(`❌ [saveAgentContent] Section "${sectionId}" not found! Available IDs:`, flatSections.map(s => s.id))
  return { success: false, error: `Section ${sectionId} not found in document` }
}
```

**Why:** Shows the exact mapping between section IDs and names in the database, and highlights which ID the save attempt is using.

**Expected Output:**
```
📋 Section ID → Name mapping:
   - "prologue" → "Prologue - The Candle's Glow"
   - "chapter1" → "Chapter 1 - The Seeds of Compassion"
   - "chapter2" → "Chapter 2 - Defying Expectations"
🎯 Trying to save to: "prologue"
```

If the ID is wrong, we'll see:
```
❌ Section "prologue" not found! Available IDs: ["prologue-1", "chapter1", "chapter2"]
```

---

## 🔍 Debug Flow

When you test again, watch for this sequence in the console:

```
1️⃣ Structure Generation
   🔍 Structure IDs: ["prologue", "chapter1", "chapter2", ...]
   🔍 Task section IDs: ["prologue", "chapter1", "chapter2", ...]
   ✅ If these match → Good!
   ❌ If they don't match → LLM is generating inconsistent IDs

2️⃣ WorldState Update
   🔄 [Orchestrator] Updating WorldState with structure items
   ✅ [Orchestrator] WorldState updated - agents can now access structure

3️⃣ Agent Execution
   🔍 [WriteContentTool] Available section IDs: ["prologue", "chapter1", ...]
   🔍 [WriteContentTool] Looking for: "prologue"
   ✅ If foundMatch: true → Good!
   ❌ If foundMatch: false → WorldState has wrong IDs

4️⃣ Save Attempt
   📋 Section ID → Name mapping:
      - "prologue" → "Prologue - The Candle's Glow"
   🎯 Trying to save to: "prologue"
   ✅ If save succeeds → Good!
   ❌ If "not found" → Database has different IDs than WorldState
```

## 🎯 What This Reveals

These logs will show us **exactly where the ID mismatch occurs**:

- **Scenario A**: LLM generates mismatched IDs (structure: "prologue", task: "prol")
  - Fix: Strengthen LLM prompt further
  
- **Scenario B**: IDs match in generation but get transformed during save
  - Fix: Find where ID transformation happens
  
- **Scenario C**: IDs match everywhere but database has different structure
  - Fix: Ensure database initialization uses same IDs as structure generation

## 📝 Files Changed

1. `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`
   - Added WorldState update when structureItems provided
   
2. `frontend/src/app/canvas/page.tsx`
   - Added structure ID and task ID logging
   
3. `frontend/src/lib/orchestrator/tools/writeContentTool.ts`
   - Added available IDs logging
   - Added match verification
   
4. `frontend/src/lib/orchestrator/agents/utils/contentPersistence.ts`
   - Added ID→Name mapping display
   - Enhanced error message with available IDs

---

## 🧪 Next Test

Try creating a new story and watch the console logs. The debug output will tell us:

1. What IDs the LLM generated
2. What IDs WorldState received
3. What IDs the database has
4. Where the mismatch occurs

**Then we can fix the exact point where IDs diverge!** 🎯

