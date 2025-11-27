# 🚀 Phase 2 Tool System - Quick Start Guide

**For:** Developers testing the new tool system  
**Status:** Phase 2 Complete ✅

---

## ⚡ TL;DR

Phase 2 adds an **executable tool system** to the orchestrator. Tools are now available and will execute in parallel with existing UI callbacks. Everything is backward compatible.

---

## 🧪 Testing the Tool System

### 1. Start the Development Server

```bash
cd /Users/palmac/Aiakaki/Code/publo/frontend
npm run dev
```

### 2. Open Browser Console

The tool system logs helpful debug information:

```javascript
// On page load, you should see:
🔧 [ToolRegistry] Registered tool: write_content (content)
🔧 [ToolRegistry] Registered tool: create_structure (structure)
🔧 [ToolRegistry] Registered tool: answer_question (analysis)
// ... 7 tools total

🔧 [ToolRegistry] Default registry created with 7 tools

🎯 [Orchestrator] Initialized {
  userId: "...",
  hasWorldState: true,
  hasToolRegistry: true,
  toolCount: 7
}
```

### 3. Test Tool Execution

**Try these commands in the orchestrator panel:**

```
1. "Write about the main character"
   → Should trigger write_content tool

2. "Create a screenplay about space exploration"
   → Should trigger create_structure tool

3. "What is this story about?"
   → Should trigger answer_question tool

4. "Open the screenplay"
   → Should trigger open_document tool

5. "Delete the character sheet"
   → Should trigger delete_node tool
```

**Look for these logs:**

```javascript
[Orchestrator] Executing tool: write_content
[Orchestrator] Tool write_content succeeded

[WriteContentTool] // Tool-specific logs
```

### 4. Inspect Tool Results

In console, check the orchestrator response:

```javascript
{
  intent: "write_content",
  actions: [{
    type: "generate_content",
    status: "completed",  // ← Changed from "pending"
    payload: {...}
  }]
}
```

---

## 🔍 How to Verify It's Working

### ✅ Checklist

- [ ] **Tool registry created** - Check for "Default registry created with 7 tools" in console
- [ ] **Tools registered** - See 7 "Registered tool" messages
- [ ] **Orchestrator initialized** - hasToolRegistry: true, toolCount: 7
- [ ] **Tools execute** - See "Executing tool: ..." logs
- [ ] **Actions updated** - Action status changes from "pending" to "completed"
- [ ] **No errors** - No red error messages in console
- [ ] **UI still works** - Existing features not broken

### ⚠️ Expected Behavior

**Tools currently return placeholders**. This is correct! Example:

```javascript
// WriteContentTool returns:
{
  success: true,
  data: {
    generatedContent: "[Tool will generate content here]",
    tokensUsed: 0,
    modelUsed: "auto-selected"
  }
}
```

The infrastructure is complete. Tool logic will be implemented in Phase 3.

---

## 🐛 Troubleshooting

### Tool Registry Not Created

**Problem:** Console doesn't show "Default registry created"

**Solution:**
```javascript
// Check OrchestratorPanel.tsx
const toolRegistry = useMemo(() => createDefaultToolRegistry(), [])
```

### Tools Not Executing

**Problem:** No "Executing tool: ..." logs

**Check:**
1. Is `hasToolRegistry: true` in orchestrator init?
2. Is `toolCount: 7` shown?
3. Are actions being generated?

**Debug:**
```typescript
// In OrchestratorEngine.executeToolsIfAvailable()
console.log('Tool execution check:', {
  hasRegistry: !!this.toolRegistry,
  hasWorldState: !!this.worldState,
  actionCount: actions.length
})
```

### Actions Not Mapping to Tools

**Problem:** Tools available but not executing

**Check mapping:**
```typescript
// OrchestratorEngine.mapActionTypeToToolName()
const mapping = {
  'generate_content': 'write_content',      // ✅
  'generate_structure': 'create_structure', // ✅
  'open_document': 'open_document',         // ✅
  'select_section': 'select_section',       // ✅
  'delete_node': 'delete_node',             // ✅
  'message': 'send_message'                 // ✅
}
```

---

## 🔬 Advanced Testing

### Inspect Tool Registry

```javascript
// In browser console (after page loads)
const registry = window.__toolRegistry // If exposed

// Check available tools
registry.getAll().map(t => t.name)
// ['write_content', 'create_structure', ...]

// Check tool stats
registry.getStats()
// {
//   totalTools: 7,
//   byCategory: {...},
//   toolNames: [...]
// }
```

### Test Tool Validation

```javascript
// Try executing with invalid input
await registry.execute(
  'write_content',
  { /* missing required fields */ },
  context
)

// Should return:
// { success: false, error: "Missing required parameter: sectionId" }
```

### Test Tool Schemas

```javascript
// Get OpenAI function schemas
const schemas = registry.toFunctionSchemas()

console.log(schemas[0]) // write_content schema
// {
//   name: 'write_content',
//   description: '...',
//   parameters: {
//     type: 'object',
//     properties: {...},
//     required: [...]
//   }
// }
```

---

## 📊 Performance Testing

### Check Tool Execution Time

```javascript
// Look for metadata in tool results
{
  success: true,
  data: {...},
  metadata: {
    toolName: 'write_content',
    duration: 243,  // ← Execution time in ms
    timestamp: 1732553234567
  }
}
```

### Monitor WorldState Rebuilds

```javascript
// Should NOT rebuild on every orchestrate call
🔧 [WorldState] Rebuilding (canvasStateKey changed) // Only when state changes
```

If rebuilding too often, check `canvasStateKey` dependencies in OrchestratorPanel.

---

## 🎯 What's Next After Testing?

### Phase 2.7 Complete ✅
Once you've verified tools are executing, Phase 2 is fully complete.

### Phase 3.1 - Implement Tool Logic
Next step is to replace placeholder returns with actual implementation:

```typescript
// Current (Phase 2)
return this.success({
  generatedContent: "[Tool will generate content here]"
})

// Phase 3
const content = await callLLM(prompt, model)
worldState.update(draft => {
  draft.activeDocument.content[sectionId] = content
})
return this.success({ generatedContent: content })
```

---

## 📞 Getting Help

### Check These Files First

1. **PHASE2_SUMMARY.md** - High-level overview
2. **PHASE2_TOOL_SYSTEM_COMPLETE.md** - Technical details
3. **frontend/src/lib/orchestrator/tools/types.ts** - Interface definitions
4. **Browser console** - Real-time execution logs

### Common Issues

| Issue | Solution |
|-------|----------|
| No tools in console | Check OrchestratorPanel tool registry creation |
| Tools not executing | Check OrchestratorEngine has toolRegistry |
| Actions still "pending" | Check mapActionTypeToToolName() mapping |
| WorldState errors | Verify Phase 1 complete (worldState available) |
| TypeScript errors | Run `npm run type-check` |

---

## ✅ Success Indicators

You'll know Phase 2 is working when:

1. ✅ Console shows "7 tools" registered
2. ✅ Orchestrator initialized with `hasToolRegistry: true`
3. ✅ Tool execution logs appear when using orchestrator
4. ✅ Action statuses update to "completed"
5. ✅ No errors in console
6. ✅ Existing features still work perfectly

---

## 🎊 You're Done!

If all checks pass, **Phase 2 is successfully implemented** and ready for Phase 3.

Next: Proceed to Phase 3 to implement actual tool logic and enable closed-loop execution.

---

**Happy Testing! 🚀**

