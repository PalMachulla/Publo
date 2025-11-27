# Integration Testing Guide - Phase 2 + Phase 3

**Date:** 2025-11-26  
**Purpose:** Verify end-to-end flow: User Prompt → Tool → Agent → Content Saved

---

## 🧪 Test Scenarios

### **Test 1: Simple Content Generation (Sequential Strategy)**

**Objective:** Verify basic content generation with direct WriterAgent (no cluster)

**Steps:**
1. Open the application
2. Create a new story structure (e.g., "Create a short story about a cat")
3. Once structure is created, send: `"Write Chapter 1"`

**Expected Behavior:**
```
✅ Chat Messages (in order):
   1. "🤖 Multi-agent system initialized" (orchestrator, thinking)
   2. "⏭️ Sequential execution: 1 action(s)" (orchestrator, progress)
   3. "▶️ generate_content: Chapter 1..." (orchestrator, progress)
   4. "✅ Sequential execution complete" (orchestrator, result)

✅ Console Logs:
   - "🔧 [WriteContentTool] Executing for section "Chapter 1""
   - "   Using direct writer agent"
   - "✅ [WriteContentTool] Direct write complete"
   - "💾 [WriteContentTool] Content saved: ~2000 words"

✅ Supabase:
   - Query: SELECT document_data FROM nodes WHERE id = '<storyStructureNodeId>'
   - Verify: document_data.items[0].content is populated

✅ Document View:
   - Open document panel
   - Navigate to Chapter 1
   - Content should be visible immediately (no need to refresh)
```

**Success Criteria:**
- ✅ No errors in console
- ✅ Content appears in document view
- ✅ Chat messages show progress
- ✅ Content saved to Supabase

---

### **Test 2: Multi-Chapter Generation (Cluster Strategy)**

**Objective:** Verify writer-critic cluster with iterative refinement

**Steps:**
1. Open the application
2. Create a new story structure (e.g., "Create a children's book about a rabbit")
3. Once structure is created, send: `"Write the two first chapters"`

**Expected Behavior:**
```
✅ Chat Messages (in order):
   1. "🤖 Multi-agent system initialized" (orchestrator, thinking)
   2. "🔄 Using writer-critic cluster for high-quality generation" (orchestrator, progress)
   3. "✨ Generated ~2000 words (quality: 7.2/10, 2 iterations)" (orchestrator, result)
   4. "✨ Generated ~1800 words (quality: 7.5/10, 2 iterations)" (orchestrator, result)
   5. "✅ Agent execution complete" (orchestrator, result)

✅ Console Logs:
   - "🔧 [WriteContentTool] Executing for section "Chapter 1""
   - "   Using writer-critic cluster"
   - "[WriterCriticCluster] Iteration 1/3..."
   - "[CriticAgent] Review score: 6.5/10 - needs improvement"
   - "[WriterCriticCluster] Iteration 2/3..."
   - "[CriticAgent] Review score: 7.2/10 - approved! ✅"
   - "💾 [WriteContentTool] Content saved: ~2000 words"
   - (repeat for Chapter 2)

✅ Supabase:
   - Query: SELECT document_data FROM nodes WHERE id = '<storyStructureNodeId>'
   - Verify: document_data.items[0].content (Chapter 1) is populated
   - Verify: document_data.items[1].content (Chapter 2) is populated

✅ Document View:
   - Open document panel
   - Both chapters should have content
   - Quality should be noticeably higher than single-pass generation
```

**Success Criteria:**
- ✅ No errors in console
- ✅ Both chapters have content
- ✅ Chat shows quality scores and iteration counts
- ✅ Content saved to Supabase for both chapters
- ✅ Quality scores >= 7.0

---

### **Test 3: Multi-Step Task Detection**

**Objective:** Verify orchestrator detects and chains multiple actions

**Steps:**
1. Open the application
2. Send: `"Create a children's book about a carrot and a rabbit. Write the first chapter."`

**Expected Behavior:**
```
✅ Chat Messages (in order):
   1. "🤖 Multi-agent system initialized"
   2. "⏳ Step 1/4: Analyzing prompt for Novel structure..."
   3. "🎯 Step 2/4: Selecting best model..."
   4. "📝 Step 3/4: Creating structure plan..."
   5. "🔄 Step 4/4: Validating structure plan..."
   6. "✅ Plan created: 8 sections, 2 tasks"
   7. "📊 Structure initialized with 8 sections"
   8. "🔄 Using writer-critic cluster for high-quality generation"
   9. "✨ Generated ~2000 words (quality: 7.0/10, 2 iterations)"
   10. "✅ Agent execution complete"

✅ Console Logs:
   - "🧠 [OrchestratorEngine] Multi-step task detected"
   - "   Will create structure AND generate content for 1 section(s)"
   - "🔍 [MultiAgentOrchestrator] Actions generated: 2"
   - "🎯 [MultiAgentOrchestrator] Strategy: CLUSTER"

✅ Supabase:
   - New node created with proper UUID (not "structure-...")
   - document_data.items array with ~8 items (structure)
   - document_data.items[0].content populated (first chapter)

✅ Canvas:
   - New story node appears on canvas
   - Node has proper UUID ID
```

**Success Criteria:**
- ✅ Structure created successfully
- ✅ First chapter content generated automatically
- ✅ No errors or double execution
- ✅ Node ID is a proper UUID

---

### **Test 4: Error Handling**

**Objective:** Verify graceful error handling when things go wrong

**Steps:**
1. Remove user API key (Settings → Remove OpenAI key)
2. Try to generate content: `"Write Chapter 1"`

**Expected Behavior:**
```
✅ Chat Messages:
   - "❌ Tool execution failed: Writer API failed: API key not found..."
   - "❌ Agent execution failed: Writer API failed..."

✅ Console Logs:
   - "❌ [WriterAgent writer-tool] Execution failed: Error: Writer API failed..."
   - "❌ [MultiAgentOrchestrator] Tool execution error: ..."

✅ No Crashes:
   - UI remains responsive
   - User can still interact with chat
   - Error is displayed clearly
```

**Success Criteria:**
- ✅ Error message displayed in chat
- ✅ No uncaught exceptions
- ✅ UI remains functional
- ✅ User can retry after fixing issue

---

## 🔍 Debugging Tips

### **Check Console Logs**
Look for these key log patterns:

```javascript
// Tool execution
"🔧 [WriteContentTool] Executing for section..."
"   Using writer-critic cluster" or "   Using direct writer agent"

// Agent execution
"[WriterAgent] Generating content..."
"[CriticAgent] Reviewing content..."

// Content persistence
"💾 [contentPersistence] Saving content..."
"✅ [contentPersistence] Content saved: X words"

// Strategy selection
"🎯 [MultiAgentOrchestrator] Strategy: CLUSTER"
"   Reasoning: ..."
```

### **Check Supabase**
```sql
-- Get the latest node
SELECT id, title, document_data 
FROM nodes 
WHERE user_id = '<your-user-id>' 
ORDER BY created_at DESC 
LIMIT 1;

-- Check if content is saved
SELECT 
  id,
  document_data->'items'->0->>'name' as chapter_name,
  length(document_data->'items'->0->>'content') as content_length
FROM nodes 
WHERE id = '<storyStructureNodeId>';
```

### **Check Blackboard Messages**
Open browser console and run:
```javascript
// If you have access to the orchestrator instance
const messages = orchestrator.getBlackboard().getRecentMessages(100)
console.table(messages.map(m => ({
  role: m.role,
  type: m.type,
  content: m.content.substring(0, 50)
})))
```

---

## 🚨 Common Issues

### **Issue 1: "Cannot coerce result to single JSON object" (PGRST116)**

**Cause:** `storyStructureNodeId` is null or invalid

**Fix:**
- Check `triggerOrchestratedGeneration` in `canvas/page.tsx`
- Verify `structureNodeId` is passed to `orchestrate()`
- Check console for "currentStoryStructureNodeId: null"

---

### **Issue 2: Content Not Appearing in Document View**

**Cause:** Content saved but UI not refreshing

**Fix:**
- Check `AIDocumentPanel.tsx` useEffect for refresh trigger
- Verify `useDocumentSections.ts` is called when panel opens
- Try closing and reopening document panel

---

### **Issue 3: Actions Executed Twice**

**Cause:** `MultiAgentOrchestrator` not clearing actions array

**Fix:**
- Check `MultiAgentOrchestrator.orchestrate()` line ~130
- Should have: `response.actions = []`
- Should NOT see duplicate log messages

---

### **Issue 4: No Chat Messages from Agents**

**Cause:** Blackboard not wired to UI callback

**Fix:**
- Check `OrchestratorPanel.tsx` passes `onAddChatMessage` to orchestrator
- Verify `Blackboard` constructor receives `messageCallback`
- Check `Blackboard.addMessage()` calls `this.messageCallback()`

---

## ✅ Validation Checklist

Before considering the integration complete, verify:

- [ ] **Test 1 passes:** Simple content generation works
- [ ] **Test 2 passes:** Multi-chapter cluster strategy works
- [ ] **Test 3 passes:** Multi-step task detection works
- [ ] **Test 4 passes:** Error handling is graceful
- [ ] **No double execution:** Content generated only once
- [ ] **Quality assurance:** Cluster iterations visible in logs
- [ ] **Content persistence:** Content saved to Supabase
- [ ] **Real-time feedback:** Chat messages stream in real-time
- [ ] **No console errors:** Clean console logs
- [ ] **Document view updates:** Content appears immediately

---

## 📊 Performance Benchmarks

Expected performance for typical operations:

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Simple content (sequential) | 5-10s | Direct WriterAgent, ~2000 words |
| Multi-chapter (cluster) | 15-30s | Writer-critic iterations, 2-3 rounds |
| Structure generation | 3-8s | LLM generates outline |
| Multi-step (structure + content) | 20-40s | Combined structure + cluster generation |

**If operations take longer:**
- Check network latency to API providers
- Verify API rate limits not hit
- Check Supabase connection speed

---

## 🎯 Success Metrics

The integration is successful if:

1. ✅ **Architecture:** Tools → Agents flow is enforced
2. ✅ **No Placeholders:** All tools are fully implemented
3. ✅ **Quality:** Writer-critic cluster produces 7.0+ scores
4. ✅ **Persistence:** Content reliably saved to database
5. ✅ **UX:** Real-time feedback visible in chat
6. ✅ **Error Handling:** Graceful failures, no crashes
7. ✅ **Performance:** Operations complete in expected timeframes

---

## 🚀 Ready to Test!

Start the development server:
```bash
cd /Users/palmac/Aiakaki/Code/publo
npm run dev
```

Then follow the test scenarios above. Good luck! 🎉

