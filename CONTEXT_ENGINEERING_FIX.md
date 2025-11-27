# Context Engineering: Orchestrator Trust & Awareness

## 🎯 The Core Problem

**User says:** "Write a report about X, fill out chapter 2"

**What SHOULD happen:**
1. Orchestrator understands: "NEW report" + "chapter 2 (wrong term)"
2. Asks clarification: "Did you mean Section 2?"
3. User confirms: "Yes, section 2"
4. Orchestrator remembers: "Create NEW REPORT with Section 2"
5. Executes: Creates report structure + generates Section 2

**What ACTUALLY happens:**
1. Orchestrator understands: "report" + "chapter 2"
2. ❌ Intent detected as `write_content` or `open_and_write` (not `create_structure`)
3. ❌ Sees "Short Story" nodes on canvas → Opens one of those
4. ❌ Completely forgets user wanted a REPORT

---

## 🧠 Context Engineering Principles

### **1. The Orchestrator Must Always Know:**
- ✅ **WHERE am I?** (Canvas? Document view? Which document?)
- ✅ **WHAT exists?** (Canvas nodes, their types, their content)
- ✅ **WHAT does the user want?** (Create new? Edit existing? Navigate?)
- ✅ **WHAT did I just say?** (Clarification questions, promises made)
- ✅ **WHAT tools do I have?** (Create, Write, Save, Open, Delete)
- ✅ **WHAT agents can help?** (Writer, Critic, available or busy)

### **2. Trust = Consistency + Transparency**
- **Consistency:** Same input → Same output (no random behavior)
- **Transparency:** User sees what orchestrator is thinking
- **Confidence:** Only act when sure, ask when uncertain
- **Memory:** Never forget what was just discussed

---

## 🔧 The Fix: Three-Layer Context System

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: BLACKBOARD                       │
│  • Conversation history (with orchestrator's own messages!)  │
│  • Task queue & results                                      │
│  • Agent states                                              │
│  • THE MEMORY                                                │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 2: WORLDSTATE                       │
│  • Canvas nodes (what exists)                                │
│  • Active document (what's open)                             │
│  • UI state (document panel open/closed)                     │
│  • THE AWARENESS                                             │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 3: INTENT ANALYZER                  │
│  • LLM reasoning (what does user want)                       │
│  • Context integration (Blackboard + WorldState)             │
│  • Confidence scoring (sure? or need clarification?)         │
│  • THE INTELLIGENCE                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 Critical Issues Identified

### **Issue 1: Clarification Not Added to Blackboard** ✅ FIXED
**Problem:** When orchestrator asks "Did you mean Section 2?", it doesn't add this to Blackboard.
**Impact:** Next orchestration call has no memory of the question.
**Fix:** Added `this.blackboard.addMessage()` before returning clarification action.

### **Issue 2: Intent Analyzer Distracted by Canvas** ⚠️ IN PROGRESS
**Problem:** LLM sees "Short Story" nodes and thinks user wants to open one, even though they said "REPORT".
**Impact:** Wrong intent detected (`open_and_write` instead of `create_structure`).
**Fix:** Strengthen LLM instructions to prioritize user's explicit document type over canvas nodes.

### **Issue 3: Format Detection Not Passed to Orchestrator** 🔍 TO VERIFY
**Problem:** `detectFormatFromMessage("Write a report...")` returns `"report"`, but orchestrator might not receive it.
**Impact:** `validateFormatConventions()` never runs because format is missing.
**Fix:** Verify format is passed correctly from OrchestratorPanel → orchestrator → generateActions.

### **Issue 4: No Confidence Scoring** 🆕 NEW
**Problem:** Orchestrator doesn't know if it's 90% sure or 40% sure about intent.
**Impact:** Acts confidently even when uncertain, leading to wrong actions.
**Fix:** Add confidence scoring to intent analysis, require >80% to act without clarification.

---

## 🎯 Proposed Solution: Enhanced Context Flow

### **Step 1: Strengthen Intent Analysis Context**

```typescript
// In llmIntentAnalyzer.ts
const contextString = buildContextString({
  currentMessage: "Write a report about X, fill out chapter 2",
  conversationHistory: [
    { role: "user", content: "Write a report..." },
    { role: "assistant", content: "Did you mean Section 2?" },
    { role: "user", content: "Yes, section 2" }
  ],
  canvasContext: "3 Short Story nodes visible",
  isDocumentViewOpen: false,
  documentFormat: "report" // ✅ CRITICAL: Detected format
})

// LLM receives FULL context:
// - User's original request (report)
// - Orchestrator's clarification (section vs chapter)
// - User's confirmation (yes, section 2)
// - Canvas state (short stories exist, but irrelevant)
// - Detected format (report, not short-story)
```

### **Step 2: Add Confidence Scoring**

```typescript
// LLM returns:
{
  "intent": "create_structure",
  "confidence": 0.95, // ✅ NEW: How sure are we?
  "reasoning": "User explicitly said 'report' and confirmed 'section 2' after clarification",
  "alternativeIntents": [
    { "intent": "open_and_write", "confidence": 0.05 }
  ],
  "needsClarification": false
}

// Orchestrator checks:
if (confidence < 0.80) {
  // Ask for clarification
  return clarifyingQuestion
} else {
  // Proceed with action
  executeIntent()
}
```

### **Step 3: Explicit Context Validation**

```typescript
// Before executing action, validate context:
function validateContext(intent: string, context: Context): ValidationResult {
  if (intent === 'create_structure') {
    // Check: Do we have a format?
    if (!context.documentFormat) {
      return { valid: false, reason: "No format detected" }
    }
    
    // Check: Is user trying to create something that already exists?
    const existingNodes = context.canvasNodes.filter(n => 
      n.data.format === context.documentFormat
    )
    if (existingNodes.length > 0) {
      return { 
        valid: false, 
        reason: "Similar document exists",
        suggestAlternative: "open_and_write"
      }
    }
    
    return { valid: true }
  }
  
  // ... other intents
}
```

### **Step 4: Transparent Thinking Display**

```typescript
// In OrchestratorPanel, show orchestrator's reasoning:
onAddChatMessage(`🧠 I understand: Create a NEW ${format}`, 'orchestrator', 'thinking')
onAddChatMessage(`📊 Confidence: ${(confidence * 100).toFixed(0)}%`, 'orchestrator', 'thinking')
onAddChatMessage(`🎯 Action: generate_structure`, 'orchestrator', 'decision')

// User sees:
// 🧠 I understand: Create a NEW report
// 📊 Confidence: 95%
// 🎯 Action: generate_structure
```

---

## 🔍 Debug Flow for Current Issue

### **Test Case: "Write a report about X, fill out chapter 2"**

**Expected Console Logs:**
```javascript
// 1. Format Detection
📋 [OrchestratorPanel] Format detection: {
  detected: "report",
  selected: "novel",
  using: "report"
}

// 2. Intent Analysis
🧠 [LLM Intent] Analyzing with context: {
  message: "Write a report about X, fill out chapter 2",
  format: "report",
  canvasNodes: 3,
  conversationHistory: 0
}

// 3. Intent Result
✅ [LLM Intent] Result: {
  intent: "create_structure",
  confidence: 0.95,
  needsClarification: false
}

// 4. Action Generation
🏗️ [generateActions] create_structure case reached {
  format: "report",
  message: "Write a report..."
}

// 5. Format Validation
🔍 [Format Validation] {
  format: "report",
  message: "Write a report...chapter 2",
  validation: {
    valid: false,
    mismatch: "chapter",
    suggestion: "section"
  }
}

// 6. Clarification
💬 [Orchestrator] Clarification needed
📝 [Blackboard] Added message: "Did you mean Section 2?"

// 7. User Response
🧠 [LLM Intent] Analyzing follow-up: {
  message: "Yes, section 2",
  conversationHistory: [
    { role: "user", content: "Write a report..." },
    { role: "assistant", content: "Did you mean Section 2?" }
  ]
}

// 8. Follow-Up Intent
✅ [LLM Intent] Follow-up detected: {
  intent: "create_structure",
  confidence: 0.98,
  extractedEntities: {
    documentFormat: "report",
    autoGenerateSections: ["section2"]
  }
}

// 9. Execution
🚀 [Orchestrator] Executing: create_structure
📊 [Structure] Creating report with sections
✍️ [Agent] Generating Section 2
💾 [Save] Content saved to database
```

**If ANY of these logs are missing or show wrong values, that's where the problem is!**

---

## 🎯 Implementation Checklist

### **Phase 1: Immediate Fixes** (Already Done)
- [x] Add clarification to Blackboard
- [x] Strengthen follow-up instructions
- [x] Add canvas distraction warnings
- [x] Add debug logging

### **Phase 2: Context Validation** (Next)
- [ ] Add confidence scoring to intent analysis
- [ ] Implement context validation before action execution
- [ ] Add format verification in generateActions
- [ ] Verify format is passed through entire chain

### **Phase 3: Transparency** (Future)
- [ ] Display orchestrator's reasoning in chat
- [ ] Show confidence scores to user
- [ ] Add "Why did you do that?" explanation feature
- [ ] Implement context visualization (what orchestrator sees)

### **Phase 4: Learning** (Future)
- [ ] Track successful vs failed orchestrations
- [ ] Learn from user corrections
- [ ] Adjust confidence thresholds based on accuracy
- [ ] Pattern recognition for common mistakes

---

## 🎓 Key Principles for Trust

### **1. Never Guess**
```
❌ BAD: "I think they want to open a short story"
✅ GOOD: "I'm 45% sure. Let me ask: Did you want to create a NEW report or open an existing document?"
```

### **2. Always Remember**
```
❌ BAD: Orchestrator asks question, then forgets it asked
✅ GOOD: Orchestrator asks question, adds to Blackboard, remembers in next call
```

### **3. Prioritize Explicit Over Implicit**
```
❌ BAD: User says "report" but canvas has "short story" → Opens short story
✅ GOOD: User says "report" → Creates report (canvas is context, not instruction)
```

### **4. Show Your Work**
```
❌ BAD: Silently does something, user confused
✅ GOOD: "I understand you want to create a NEW report. Confidence: 95%. Proceeding..."
```

### **5. Fail Gracefully**
```
❌ BAD: Error → "✅ Actions completed!" (lies)
✅ GOOD: Error → "❌ I couldn't complete that because [reason]. Would you like me to try [alternative]?"
```

---

## 🚀 Expected Outcome

**After these fixes:**

```
User: "Write a report about X, fill out chapter 2"

Orchestrator:
  🧠 I understand: Create a NEW report about X
  📊 Confidence: 95%
  💬 Just to clarify - reports use sections, not chapters. Did you mean Section 2?

User: "Yes, section 2"

Orchestrator:
  🧠 I understand: Confirmed - Section 2 of the report
  📊 Confidence: 98%
  🏗️ Creating report structure...
  ✍️ Generating Section 2...
  💾 Saved to database
  ✅ Your report is ready!
```

**User feels:**
- ✅ Understood ("It got what I meant")
- ✅ Informed ("I see what it's doing")
- ✅ In control ("It asked before acting")
- ✅ Confident ("It knows what it's doing")

---

## 🔮 Future: Self-Aware Orchestrator

**Vision:** Orchestrator that can explain its own reasoning

```
User: "Why did you open the short story instead of creating a report?"

Orchestrator:
  🧠 Let me explain my reasoning:
  
  1. You said "Write a report"
  2. I detected format: "report" (confidence: 90%)
  3. I saw 3 Short Story nodes on canvas
  4. I thought you meant "write IN a report" (confidence: 60%)
  5. I chose to open an existing document
  
  ❌ I made a mistake! You wanted to CREATE a new report.
  
  💡 I've learned from this. Next time:
  - I'll ask "Create NEW or edit EXISTING?" when confidence < 80%
  - I'll prioritize your explicit document type over canvas nodes
  
  🔄 Would you like me to create that report now?
```

**This is the future of AI orchestration - not just smart, but self-aware and educational!** 🎓

---

**The orchestrator should be a trusted collaborator, not a black box.** 🤝

