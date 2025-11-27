# Orchestrator Quick Reference

**For developers working on the Publo orchestrator**

---

## 📂 Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `core/orchestratorEngine.ts` | Main coordinator | 1,942 |
| `context/intentRouter.ts` | Hybrid intent analysis | ~450 |
| `context/llmIntentAnalyzer.ts` | LLM intent reasoning | ~500 |
| `context/contextProvider.ts` | Canvas context | ~350 |
| `core/blackboard.ts` | Agent communication | ~400 |
| `core/worldState.ts` | Application state | ~150 |
| `agents/MultiAgentOrchestrator.ts` | Agent coordination | ~910 |

---

## 🎯 Intent Types

| Intent | Trigger | Action Generator |
|--------|---------|------------------|
| `answer_question` | Questions, general chat | `AnswerQuestionAction` |
| `write_content` | "Write chapter 1" | `WriteContentAction` |
| `create_structure` | "Write a novel about..." | `CreateStructureAction` |
| `open_and_write` | "Open story X" | `OpenDocumentAction` |
| `delete_node` | "Delete this node" | `DeleteNodeAction` |
| `navigate_section` | "Go to chapter 2" | `NavigateSectionAction` |

---

## 🔧 Common Tasks

### **Add a New Intent**

1. Add to `llmIntentAnalyzer.ts`:
```typescript
const intents = [
  // ...
  {
    intent: 'my_new_intent',
    description: 'What this intent does',
    examples: ['example 1', 'example 2']
  }
]
```

2. Create action generator in `actions/`:
```typescript
export class MyNewAction extends BaseAction {
  get actionType() {
    return 'my_action_type' as const
  }
  
  async generate(intent, request, context) {
    // Implementation
  }
}
```

3. Register in `orchestratorEngine.ts`:
```typescript
this.actionGenerators.set('my_new_intent', new MyNewAction())
```

---

### **Debug Intent Detection**

Check console logs:
```
✅ [Orchestrator] Intent detected: write_content (confidence: 0.95)
✅ [Orchestrator] Using modular action generator for: write_content
```

If wrong intent detected, check `llmIntentAnalyzer.ts` examples.

---

### **Test a Specific Action**

1. Open browser console
2. Type test message
3. Check logs for action generation
4. Verify payload structure

---

## 🐛 Common Issues

### **"userKeyId is required"**
- **Cause:** User not logged in or no API keys configured
- **Fix:** Log in and add API key in Settings

### **"Section not found"**
- **Cause:** Section detection failed
- **Fix:** Check `WriteContentAction.ts` section detection logic

### **"Structure generation failed"**
- **Cause:** LLM API error or invalid format
- **Fix:** Check API key, check format in `CreateStructureAction.ts`

### **TypeScript errors after changes**
- **Check:** `npm run build` in frontend/
- **Common:** Missing type imports, wrong action types

---

## 📊 Action Payload Examples

### **generate_content**
```typescript
{
  type: 'generate_content',
  status: 'pending',
  payload: {
    prompt: 'Write chapter 1 about...',
    model: 'gpt-4o',
    sectionId: 'ch1',
    useCluster: true
  }
}
```

### **generate_structure**
```typescript
{
  type: 'generate_structure',
  status: 'pending',
  payload: {
    plan: {
      format: 'novel',
      structure: [
        { id: 'ch1', name: 'Chapter 1', summary: '...' }
      ]
    }
  }
}
```

### **request_clarification**
```typescript
{
  type: 'request_clarification',
  status: 'pending',
  payload: {
    question: 'Which section?',
    options: ['Chapter 1', 'Chapter 2'],
    context: { originalIntent: 'write_content' }
  }
}
```

---

## 🔍 Debugging Tips

### **Enable verbose logging:**
```typescript
// In orchestratorEngine.ts
console.log('[Orchestrator] Intent:', intent)
console.log('[Orchestrator] Canvas context:', canvasContext)
console.log('[Orchestrator] Actions generated:', actions)
```

### **Check Blackboard state:**
```typescript
const blackboard = getBlackboard()
console.log('Messages:', blackboard.getMessages())
console.log('Patterns:', blackboard.getPatterns())
```

### **Inspect action payload:**
```typescript
// In action generator
console.log('[Action] Generated payload:', payload)
```

---

## 🚀 Quick Commands

```bash
# Build and check for errors
cd frontend && npm run build

# Start dev server
npm run dev

# Check TypeScript
npx tsc --noEmit

# Git workflow
git checkout -b feature/my-feature
git add .
git commit -m "feat: Add my feature"
git push origin feature/my-feature
```

---

## 📚 Related Docs

- **Architecture:** `docs/ORCHESTRATOR_ARCHITECTURE.md`
- **Roadmap:** `docs/ORCHESTRATOR_ROADMAP.md`
- **Historical:** `docs/archive/`

---

## 💡 Pro Tips

1. **Always test intent detection first** - If intent is wrong, everything else fails
2. **Use BaseAction helpers** - `this.message()`, `this.pending()`, etc.
3. **Check canvas context** - Many actions depend on active document
4. **Validate payloads** - UI expects specific payload structures
5. **Log everything** - Makes debugging 10x easier

---

**Need help? Check the archive docs or ask in the team chat!** 🎉

