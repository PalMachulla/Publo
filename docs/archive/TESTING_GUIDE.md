# Phase 3 Testing Guide
**Date:** November 26, 2025  
**Implementation:** Two-Phase Orchestration with Multi-Agent Content Generation

## 🎯 Test Scenarios

### Test 1: Simple Structure Creation (Single-Step)
**User Input:** `"Create a screenplay about a space adventure"`

**Expected Behavior:**
1. ✅ Orchestrator analyzes intent → `create_structure`
2. ✅ LLM generates structure with 3 acts
3. ✅ Node created and saved to Supabase
4. ✅ Structure displayed in canvas
5. ❌ **NO content generation** (single-step task)

**Expected Logs:**
```
🎬 ORCHESTRATION STARTED
✅ Plan created: 3 sections, 0 tasks
💾 Initializing hierarchical document system...
✅ Hierarchical document system initialized
🔄 Updating WorldState with new node
✅ WorldState updated
ℹ️ No content generation requested (structure only)
```

**Verification:**
- Check canvas: Node exists with structure
- Check database: `node.data.items` has structure
- Check database: `node.document_data` is initialized but empty
- Check UI: No "Generating content..." message

---

### Test 2: Multi-Step Task (Structure + Content)
**User Input:** `"Screenplay, write act 1"`

**Expected Behavior:**
1. ✅ Orchestrator analyzes intent → `create_structure`
2. ✅ LLM detects multi-step task → "User wants structure AND content for act 1"
3. ✅ Actions generated: `[generate_structure, generate_content(act-1)]`
4. ✅ Node created and saved to Supabase
5. ✅ WorldState updated with new node
6. ✅ **Second orchestration triggered automatically**
7. ✅ WriterAgent generates content for act 1
8. ✅ Content saved to `document_data` JSON blob

**Expected Logs:**
```
🎬 ORCHESTRATION STARTED
✅ Plan created: 3 sections, 1 tasks
🎯 Multi-step task detected: User wants structure AND content for act 1
💾 Initializing hierarchical document system...
✅ Hierarchical document system initialized
🔄 Updating WorldState with new node
✅ WorldState updated
🎯 Multi-step task detected: Generating content...
🚀 Starting agent execution for 1 action(s)
🔀 Parallel execution: 1 actions across 1 batch(es) via tools
✍️ [WriterAgent writer-tool-direct] Executing: write_content for section "Act 1"
💾 [saveAgentContent] Content saved via API route
✅ Agent execution complete
✅ Content generation complete
```

**Verification:**
- Check canvas: Node exists with structure
- Check database: `node.data.items` has structure
- Check database: `node.document_data.sections[0].content` has generated text
- Check UI: "Content generation complete" message
- Open document view: Act 1 shows content

---

### Test 3: Multi-Step Task (Multiple Sections)
**User Input:** `"Create a novel and write chapters 1, 2, and 3"`

**Expected Behavior:**
1. ✅ Orchestrator analyzes intent → `create_structure`
2. ✅ LLM detects multi-step task → "User wants chapters 1-3 written"
3. ✅ Actions generated: `[generate_structure, generate_content(ch1), generate_content(ch2), generate_content(ch3)]`
4. ✅ Node created and saved
5. ✅ WorldState updated
6. ✅ **Second orchestration triggered**
7. ✅ **DAGExecutor runs 3 WriterAgents in parallel**
8. ✅ All 3 chapters saved to database

**Expected Logs:**
```
🎬 ORCHESTRATION STARTED
✅ Plan created: 10 sections, 3 tasks
🎯 Multi-step task detected: User wants chapters 1, 2, and 3 written
💾 Initializing hierarchical document system...
✅ Hierarchical document system initialized
🔄 Updating WorldState with new node
✅ WorldState updated
🎯 Multi-step task detected: Generating content...
🚀 Starting agent execution for 3 action(s)
🔀 Parallel execution: 3 actions across 1 batch(es) via tools
📋 Execution plan:
   Batch 1: 3 task(s) in parallel
✍️ [WriterAgent writer-0] Executing: write_content for "Chapter 1"
✍️ [WriterAgent writer-1] Executing: write_content for "Chapter 2"
✍️ [WriterAgent writer-2] Executing: write_content for "Chapter 3"
💾 [saveAgentContent] Content saved via API route (Chapter 1)
💾 [saveAgentContent] Content saved via API route (Chapter 2)
💾 [saveAgentContent] Content saved via API route (Chapter 3)
✅ Agent execution complete
✅ Content generation complete
```

**Verification:**
- Check database: 3 sections have content
- Check logs: "Batch 1: 3 task(s) in parallel"
- Check execution time: Should be ~same as single chapter (parallel execution)
- Open document view: All 3 chapters show content

---

### Test 4: Clarification Flow
**User Input:** `"Write chapter 1"` (when multiple novels exist)

**Expected Behavior:**
1. ✅ Orchestrator analyzes intent → `open_and_write`
2. ✅ Finds multiple matching nodes
3. ✅ Returns `request_clarification` action
4. ✅ UI displays options: "Novel A", "Novel B", "Novel C"
5. ✅ User selects "Novel A"
6. ✅ Orchestrator receives clarification response
7. ✅ Opens Novel A and generates content for Chapter 1

**Expected Logs:**
```
🔍 [open_and_write] Search results: 3 candidates
📋 Requesting clarification...
[User selects option]
✅ Clarification received: Novel A
✍️ [WriterAgent] Executing: write_content for "Chapter 1"
💾 [saveAgentContent] Content saved
✅ Content generation complete
```

**Verification:**
- Check UI: Clarification options displayed
- Check logs: "Requesting clarification"
- After selection: Content generated for correct novel

---

### Test 5: WorldState Synchronization
**User Input:** `"Screenplay, write act 1"`

**Expected Behavior:**
1. ✅ WorldState created with empty nodes array
2. ✅ Node created and saved to database
3. ✅ **WorldState.setActiveDocument() called**
4. ✅ Agents can access node via `worldState.getActiveDocument()`

**Verification Steps:**
```typescript
// Before node creation:
worldState.getActiveDocument()
// → { nodeId: null, format: null, structure: null }

// After node creation + WorldState update:
worldState.getActiveDocument()
// → { nodeId: "12345-abc", format: "screenplay", structure: [...] }

// Agents can now access:
const doc = context.worldState.getActiveDocument()
console.log(doc.nodeId) // "12345-abc"
console.log(doc.structure) // [{ id: "act-1", name: "Act 1", ... }]
```

**Check Logs:**
```
🔄 [triggerOrchestratedGeneration] Updating WorldState with new node
✅ [triggerOrchestratedGeneration] WorldState updated
```

---

### Test 6: Blackboard Tracking
**User Input:** `"Screenplay, write act 1"`

**Expected Behavior:**
1. ✅ Blackboard tracks canvas state
2. ✅ Blackboard tracks document state
3. ✅ Blackboard tracks task assignments
4. ✅ Blackboard tracks task results

**Verification:**
```typescript
// Check blackboard state:
const messages = blackboard.getRecentMessages(100)

// Should include:
// - User message: "Screenplay, write act 1"
// - Orchestrator: "🎯 Multi-step task detected"
// - Orchestrator: "🚀 Starting agent execution"
// - Agent: "✍️ Executing: write_content"
// - Agent: "💾 Content saved"
// - Orchestrator: "✅ Agent execution complete"

// Check task tracking:
const tasks = blackboard.getTasks()
// Should show: task assigned to writer-0, status: completed
```

---

### Test 7: Content Persistence
**User Input:** `"Screenplay, write act 1"`

**Expected Behavior:**
1. ✅ Content generated by WriterAgent
2. ✅ Saved via `/api/agent/save-content`
3. ✅ Persists across page refreshes
4. ✅ Accessible in document view

**Verification Steps:**
1. Generate content
2. Check database directly:
   ```sql
   SELECT document_data FROM nodes WHERE id = '12345-abc';
   ```
3. Refresh page
4. Open document view
5. Verify content is still there

**Expected Database Structure:**
```json
{
  "format": "screenplay",
  "sections": [
    {
      "id": "act-1",
      "name": "Act 1",
      "level": 1,
      "parentId": null,
      "content": "FADE IN:\n\nINT. SPACESHIP - DAY\n\n...",
      "wordCount": 1234,
      "summary": "The hero discovers..."
    }
  ],
  "totalWordCount": 1234,
  "lastUpdated": "2025-11-26T14:00:00.000Z"
}
```

---

### Test 8: Error Handling
**User Input:** `"Screenplay, write act 1"` (with invalid API key)

**Expected Behavior:**
1. ✅ Orchestrator attempts to generate structure
2. ✅ LLM call fails (invalid API key)
3. ✅ Error caught and logged
4. ✅ User sees error message
5. ✅ System doesn't crash

**Expected Logs:**
```
❌ [create_structure] Failed to generate plan: API key invalid
❌ Failed to generate structure: API key invalid
⚠️ Content generation failed: API key invalid
```

**Verification:**
- Check UI: Error message displayed
- Check logs: Error logged with details
- Check system: No crash, user can retry

---

## 🔍 Debug Checklist

### If Content Generation Doesn't Start:

1. **Check orchestrator response:**
   ```javascript
   console.log('Actions:', response.actions)
   // Should include: { type: 'generate_content', payload: { autoStart: true } }
   ```

2. **Check hasContentActions:**
   ```javascript
   const hasContentActions = response.actions.some(a => 
     a.type === 'generate_content' && a.payload?.autoStart
   )
   console.log('Has content actions:', hasContentActions)
   // Should be: true
   ```

3. **Check WorldState update:**
   ```javascript
   console.log('WorldState before:', worldState.getActiveDocument())
   worldState.setActiveDocument(nodeId, format, structure)
   console.log('WorldState after:', worldState.getActiveDocument())
   // Should show: nodeId populated
   ```

4. **Check second orchestration call:**
   ```javascript
   console.log('Triggering second orchestration with nodeId:', structureNodeId)
   const contentResponse = await orchestrator.orchestrate({
     currentStoryStructureNodeId: structureNodeId,
     // ...
   })
   console.log('Content response:', contentResponse)
   ```

### If Content Doesn't Save:

1. **Check agent execution:**
   ```javascript
   console.log('Agent execution started')
   // Should see: ✍️ [WriterAgent] Executing...
   ```

2. **Check saveAgentContent call:**
   ```javascript
   console.log('Saving content:', { nodeId, sectionId, contentLength })
   // Should see: 💾 [saveAgentContent] Attempting save
   ```

3. **Check API response:**
   ```javascript
   console.log('Save result:', saveResult)
   // Should see: { success: true, wordCount: 1234 }
   ```

4. **Check database:**
   ```sql
   SELECT document_data FROM nodes WHERE id = 'your-node-id';
   ```

### If WorldState is Stale:

1. **Check update call:**
   ```javascript
   console.log('Updating WorldState...')
   worldState.setActiveDocument(nodeId, format, structure)
   console.log('WorldState updated')
   ```

2. **Check agent access:**
   ```javascript
   // In WriteContentTool:
   const doc = context.worldState?.getActiveDocument()
   console.log('Agent sees document:', doc)
   // Should show: { nodeId: "...", format: "...", structure: [...] }
   ```

---

## 📊 Performance Metrics

### Expected Execution Times:

| Task | Expected Time | Notes |
|------|---------------|-------|
| Structure generation | 3-8 seconds | LLM call |
| Single section content | 10-20 seconds | LLM call + save |
| 3 sections (parallel) | 10-20 seconds | Same as single (parallel) |
| 10 sections (parallel) | 15-30 seconds | Batched execution |

### Token Usage:

| Task | Estimated Tokens | Cost (GPT-4o) |
|------|------------------|---------------|
| Structure generation | 2,000-5,000 | $0.01-0.03 |
| Single section content | 3,000-8,000 | $0.02-0.05 |
| 3 sections (parallel) | 9,000-24,000 | $0.05-0.15 |

---

## ✅ Success Criteria

### Phase 3 is successful if:

1. ✅ User can request "Screenplay, write act 1"
2. ✅ Structure is created automatically
3. ✅ Content is generated automatically for act 1
4. ✅ Content persists across page refreshes
5. ✅ User can open document view and see content
6. ✅ WorldState is always up-to-date
7. ✅ Blackboard tracks all operations
8. ✅ Tools handle all actions
9. ✅ Parallel execution works for multiple sections
10. ✅ Error handling prevents crashes

---

## 🚀 Next Steps After Testing

1. **Monitor Production Logs:**
   - Track agent execution times
   - Monitor token usage
   - Watch for errors

2. **Optimize Performance:**
   - Cache structure generation results
   - Implement content streaming
   - Add progress indicators

3. **Enhance Features:**
   - Add content revision flow
   - Implement CriticAgent (when API limits allow)
   - Add collaborative editing

4. **User Experience:**
   - Add real-time progress updates
   - Show token usage estimates
   - Display estimated completion time

---

## 📝 Test Report Template

```markdown
## Test Report: [Test Name]

**Date:** [Date]
**Tester:** [Name]
**Build:** [Commit Hash]

### Test Input:
[User prompt]

### Expected Behavior:
[What should happen]

### Actual Behavior:
[What actually happened]

### Logs:
```
[Paste relevant logs]
```

### Screenshots:
[Attach screenshots]

### Status:
- [ ] ✅ PASS
- [ ] ❌ FAIL
- [ ] ⚠️ PARTIAL

### Notes:
[Any additional observations]
```

---

## 🎯 Manual Testing Procedure

1. **Start dev server:** `npm run dev`
2. **Open browser:** `http://localhost:3002`
3. **Login** with test account
4. **Navigate to canvas**
5. **Run Test 1:** Simple structure creation
6. **Run Test 2:** Multi-step task (single section)
7. **Run Test 3:** Multi-step task (multiple sections)
8. **Run Test 4:** Clarification flow
9. **Run Test 5:** WorldState synchronization
10. **Run Test 6:** Blackboard tracking
11. **Run Test 7:** Content persistence
12. **Run Test 8:** Error handling

**Record results for each test using the template above.**

---

## 🔧 Troubleshooting

### Common Issues:

1. **"Node not found" error:**
   - Check: Node ID format (should be `timestamp-random`)
   - Check: Node saved to database before agent execution
   - Check: WorldState updated with correct node ID

2. **Content not generating:**
   - Check: `hasContentActions` is true
   - Check: Second orchestration call is triggered
   - Check: `currentStoryStructureNodeId` is passed

3. **Content not saving:**
   - Check: `/api/agent/save-content` endpoint is accessible
   - Check: User authentication is valid
   - Check: Node ownership is correct

4. **WorldState is stale:**
   - Check: `worldState.setActiveDocument()` is called
   - Check: Called AFTER node is saved
   - Check: Called BEFORE second orchestration

---

**Ready to test!** 🚀
