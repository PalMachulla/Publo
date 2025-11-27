# Smart Intent Reasoning Plan

## 🎯 **Goal**
Make the orchestrator's intent analysis truly intelligent by leveraging the template registry, improving context awareness, and reducing unnecessary clarifications.

## 📊 **Current State (Problems)**

### **Problem 1: Template Matching is Weak**
```typescript
User: "Create a podcast interview"
Current: Shows all podcast templates ❌
Smart: Auto-selects "interview" template ✅
```

### **Problem 2: Over-Clarification**
```typescript
User: "Write a novel"
Current: Asks "What template?" even for vague requests ❌
Smart: Shows templates, but doesn't block workflow ✅
```

### **Problem 3: Poor Follow-Up Understanding**
```typescript
User: "Create a podcast"
System: "What template?"
User: "1" or "the first one"
Current: Might not understand ❌
Smart: Matches to template[0] ✅
```

### **Problem 4: No Template Intelligence**
```typescript
User: "Create a hero's journey novel"
Current: Ignores "hero's journey" keyword ❌
Smart: Matches to 'heros-journey' template ✅
```

### **Problem 5: Doesn't Use Registry**
- LLM has template descriptions in prompt
- But doesn't actively match keywords
- No connection to `findTemplateByKeywords()`

---

## 🏗️ **Target Architecture**

```
Intent Analysis Flow:
┌─────────────────────────────────────────┐
│ 1. User Message                         │
│    "Create a podcast interview"         │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│ 2. LLM Intent Analysis                  │
│    - Detects: create_structure          │
│    - Format: podcast                    │
│    - Keywords: "interview"              │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│ 3. Template Matching (NEW!)             │
│    findTemplateByKeywords('podcast',    │
│                           'interview')   │
│    → Returns: 'interview' template      │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│ 4. Decision Logic (NEW!)                │
│    - If template matched: auto-select   │
│    - If vague: show options             │
│    - If unclear: ask clarification      │
└────────────────┬────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│ 5. Action Generation                    │
│    - Skip template UI if confident      │
│    - Show TemplateSelector if needed    │
└─────────────────────────────────────────┘
```

---

## 📋 **Implementation Plan**

### **Phase 1: Enhance LLM Prompt for Template Matching**
**Risk:** LOW (only prompt changes)

**Changes:**
1. Update `INTENT_ANALYSIS_SYSTEM_PROMPT` to emphasize template matching
2. Add examples of good template matching
3. Clarify when to use `suggestedTemplate`

**Example additions:**
```typescript
TEMPLATE MATCHING (CRITICAL):
- When user mentions template keywords, ALWAYS set suggestedTemplate
- Examples:
  * "podcast interview" → suggestedTemplate: "interview"
  * "hero's journey novel" → suggestedTemplate: "heros-journey"
  * "feature film screenplay" → suggestedTemplate: "feature"
  * "how to article" → suggestedTemplate: "how-to"
  
- When user is vague (just "podcast"), leave suggestedTemplate undefined
  * System will show template options
  
- Be confident! If keywords match, suggest the template
```

---

### **Phase 2: Add Post-Processing Template Matcher**
**Risk:** LOW (enhancement, doesn't break existing)

**Create:** `frontend/src/lib/orchestrator/context/templateMatcher.ts`

```typescript
/**
 * Post-process LLM intent to enhance template matching
 * Uses templateRegistry for keyword matching
 */
export function enhanceIntentWithTemplateMatch(
  intent: LLMIntentResult,
  format?: string
): LLMIntentResult {
  // If LLM already suggested a template, keep it
  if (intent.extractedEntities?.suggestedTemplate) {
    return intent
  }
  
  // If no format, can't match templates
  if (!format) {
    return intent
  }
  
  // Try to find template by keywords in user message
  const template = findTemplateByKeywords(format, intent.reasoning)
  
  if (template) {
    return {
      ...intent,
      extractedEntities: {
        ...intent.extractedEntities,
        suggestedTemplate: template.id,
        documentFormat: format
      }
    }
  }
  
  return intent
}
```

**Why?**
- LLM might miss keywords
- Fallback matching using our registry
- Doesn't override LLM if it already matched

---

### **Phase 3: Smart Auto-Selection Logic**
**Risk:** MEDIUM (changes user flow)

**Update:** `OrchestratorPanel.tsx` - handleSendMessage

```typescript
// After intent analysis
const intent = response.intent
const suggestedTemplate = intent.extractedEntities?.suggestedTemplate

if (intent.intent === 'create_structure') {
  const format = intent.extractedEntities?.documentFormat
  
  if (suggestedTemplate && format) {
    // ✅ SMART: User was specific, auto-select template
    console.log(`🎯 Auto-selecting template: ${suggestedTemplate}`)
    
    const template = getTemplateById(format, suggestedTemplate)
    if (template) {
      // Skip template selection UI, proceed directly
      await handleTemplateSelection(suggestedTemplate, template.name)
      return
    }
  }
  
  // ✅ SMART: User was vague, show template options
  console.log(`📋 Showing template options for: ${format}`)
  setPendingCreation({ format, userPrompt: message })
}
```

**User Experience:**

**Specific Request:**
```
User: "Create a podcast interview"
→ System: [Auto-selects interview template]
→ System: "✅ Creating podcast with interview format..."
→ Result: Structure generated immediately ⚡
```

**Vague Request:**
```
User: "Create a podcast"
→ System: [Shows TemplateSelector]
→ User: Clicks or types "1"
→ Result: Structure generated
```

---

### **Phase 4: Improve Follow-Up Understanding**
**Risk:** LOW (enhances existing)

**Update:** `llmIntentAnalyzer.ts` system prompt

Add better examples for follow-up responses:

```typescript
FOLLOW-UP RESPONSES (CRITICAL):
When user responds to template selection:
- "1", "2", "3" → Match to template by index
- "first", "second", "third" → Match to template by ordinal
- "interview", "the interview one" → Match by name/keywords
- "blank", "start from scratch" → Match to blank template

Examples:
User: "Create a podcast"
System: [Shows 4 templates]
User: "1"
→ Intent: create_structure
→ suggestedTemplate: templates[0].id (e.g., "interview")

User: "the interview one"
→ Intent: create_structure  
→ suggestedTemplate: "interview" (matched by keyword)
```

---

### **Phase 5: Context-Aware Reasoning**
**Risk:** LOW (enhancement)

**Add to context string:**

```typescript
// In buildContextString()
if (context.pendingCreation) {
  str += `**PENDING CREATION:**\n`
  str += `Format: ${context.pendingCreation.format}\n`
  str += `Available templates: ${context.pendingCreation.templates.map(t => t.name).join(', ')}\n`
  str += `User is responding to template selection!\n\n`
}
```

**Why?**
- LLM knows user is in template selection mode
- Better understanding of "1", "first", etc.
- More accurate intent detection

---

### **Phase 6: Confidence-Based Clarification**
**Risk:** LOW (reduces unnecessary questions)

**Update prompt:**

```typescript
CLARIFICATION RULES (CRITICAL):
Only ask clarifying questions when:
1. Intent is truly ambiguous (confidence < 0.6)
2. Multiple valid interpretations exist
3. User safety is at risk (e.g., deleting wrong node)

DO NOT ask clarifying questions for:
1. Template selection (show options instead)
2. Format detection (use best guess + show options)
3. Vague requests (be helpful, suggest options)

Examples:
❌ BAD: "What template do you want?" (just show options!)
✅ GOOD: "I found 3 novels on your canvas. Which one?"

❌ BAD: "Did you mean chapter or scene?" (educate + suggest)
✅ GOOD: "Novels typically use chapters. Did you mean Chapter 2?"
```

---

## 🧪 **Testing Strategy**

### **Test Cases**

#### **1. Specific Template Requests**
```typescript
// Should auto-select
"Create a podcast interview" → interview template ✅
"Write a hero's journey novel" → heros-journey template ✅
"Make a feature film screenplay" → feature template ✅
"Create a how-to article" → how-to template ✅
```

#### **2. Vague Requests**
```typescript
// Should show options
"Create a podcast" → Show 4 podcast templates ✅
"Write a novel" → Show 5 novel templates ✅
"Make a report" → Show 4 report templates ✅
```

#### **3. Follow-Up Responses**
```typescript
System: [Shows podcast templates]
User: "1" → Select template[0] ✅
User: "first" → Select template[0] ✅
User: "interview" → Match by keyword ✅
User: "the interview one" → Match by keyword ✅
```

#### **4. Context Awareness**
```typescript
User: "Create a podcast"
System: [Shows templates]
User: "Actually, make it a novel"
→ Should switch to novel templates ✅
```

#### **5. Edge Cases**
```typescript
"Create a podcast interview about dragons" → interview + topic ✅
"Write chapter 2 of a hero's journey novel" → heros-journey + chapter 2 ✅
"Make a blank podcast" → blank template ✅
```

---

## 🚀 **Rollout Plan**

### **Step 1: Phase 1 (Prompt Enhancement)**
- Update system prompt
- Add template matching examples
- Test with various requests
- **Commit:** "feat: Enhance LLM prompt for template matching"

### **Step 2: Phase 2 (Post-Processor)**
- Create `templateMatcher.ts`
- Add to intent analysis pipeline
- Test fallback matching
- **Commit:** "feat: Add template matcher post-processor"

### **Step 3: Phase 3 (Auto-Selection)**
- Update `OrchestratorPanel.tsx`
- Add auto-selection logic
- Test specific vs vague requests
- **Commit:** "feat: Auto-select templates when user is specific"

### **Step 4: Phase 4-6 (Polish)**
- Improve follow-up handling
- Add context awareness
- Refine clarification rules
- **Commit:** "feat: Improve intent reasoning intelligence"

---

## 📊 **Success Metrics**

### **Before:**
- Template selection: Always shows UI
- Follow-ups: Sometimes confused
- Clarifications: Too many
- User experience: Slow

### **After:**
- Template selection: Auto-select when specific ✅
- Follow-ups: Understands "1", "first", keywords ✅
- Clarifications: Only when truly needed ✅
- User experience: Fast and smart ⚡

---

## 🎯 **Expected Improvements**

| Scenario | Before | After |
|----------|--------|-------|
| "Create podcast interview" | Shows UI | Auto-selects ⚡ |
| "Create podcast" | Shows UI | Shows UI ✓ |
| User types "1" | Sometimes works | Always works ✅ |
| "Hero's journey novel" | Shows UI | Auto-selects ⚡ |
| Unnecessary clarifications | Many | Few ✅ |

---

## 🛡️ **Safety**

- **Phase 1-2:** Zero risk (enhancements only)
- **Phase 3:** Medium risk (test thoroughly)
- **Phase 4-6:** Low risk (polish)

**Rollback:** Simple `git revert` at any phase

---

## 📝 **Next Steps**

Ready to implement! Start with Phase 1 (prompt enhancement) and test incrementally.

**Estimated Time:**
- Phase 1: 30 min
- Phase 2: 45 min  
- Phase 3: 1 hour
- Phase 4-6: 1 hour

**Total: ~3 hours for complete smart intent reasoning** 🚀

