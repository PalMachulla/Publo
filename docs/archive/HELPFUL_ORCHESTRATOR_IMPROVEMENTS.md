# Helpful Orchestrator Improvements

## Problem

The orchestrator was **unhelpful and robotic**, throwing errors instead of trying to understand and help:

### **Example 1: Multi-step Request**
```
USER: "A short story about a man with one eye... And, you can write chapter 2 straight away"
ORCHESTRATOR: "I want to add content, but I need you to select a section first."
```
**Problem:** User explicitly said "write chapter 2 straight away" but orchestrator asked for clarification!

### **Example 2: Frustrated Follow-up**
```
USER: "chapter 2 as I said."
ORCHESTRATOR: "I couldn't find that section."
```
**Problem:** User is frustrated and repeating themselves, but orchestrator just says "error"!

---

## Solution

Enhanced the LLM intent analyzer to be **helpful, conversational, and proactive**.

### **1. Multi-Step Request Handling**

**Added to system prompt:**
```
MULTI-STEP REQUESTS (CRITICAL):
- If user says "create X and write Y" or "write Y straight away/immediately/right away/right now":
  * Intent: create_structure
  * This is a COMBINED request: create structure + generate content
  * Extract which sections to auto-generate (e.g., "chapter 2", "act 1")
  * Set needsClarification: false (user was explicit)
```

**Example:**
```
USER: "Write a story about X and write chapter 2 straight away"
REASONING: User wants to create a new story AND generate chapter 2 immediately. 
This is a multi-step request that should be handled in one flow.
INTENT: create_structure
EXTRACTED: autoGenerateSections: ["chapter 2"]
ACTION: Create structure, then auto-generate chapter 2
```

---

### **2. Frustrated Follow-up Handling**

**Added to system prompt:**
```
FRUSTRATED FOLLOW-UPS (CRITICAL):
- If user says "as I said", "like I told you", "I already said", "chapter 2 as I said":
  * User is frustrated because their request wasn't understood
  * Re-analyze their PREVIOUS message (look at conversation history)
  * Keep the same intent type they originally wanted
  * Extract the section reference they mentioned
  * Intent: write_content (they want to write, not navigate!)
```

**Example:**
```
USER: "chapter 2 as I said."
REASONING: User is frustrated and repeating their request. Looking at conversation history, 
they wanted to write chapter 2. I should help them do that.
INTENT: write_content (or create_structure if no structure exists)
EXTRACTED: targetSegment: "chapter 2"
```

---

### **3. Structure Reasoning**

**Added to system prompt:**
```
STRUCTURE REASONING (CRITICAL):
- Short story → typically has chapters (Chapter 1, Chapter 2, etc.)
- Screenplay → typically has acts and scenes (Act 1, Scene 1, etc.)
- Novel → typically has chapters or parts
- Report → typically has sections (Introduction, Background, Conclusion, etc.)

When user mentions a section:
1. Check if structure exists (look at documentStructure)
2. If structure exists → use write_content or navigate_section
3. If structure doesn't exist → use create_structure (be proactive!)
4. Reason about what makes sense: "User wants chapter 2 of a short story, 
   so I should create a short story structure with chapters"
```

**Example:**
```
USER: "Write chapter 2"
CANVAS: No structure exists
REASONING: User wants chapter 2, but no structure exists. Short stories have chapters. 
I should create a short story structure with chapters, then write chapter 2.
INTENT: create_structure
EXTRACTED: 
  - documentFormat: "short-story"
  - autoGenerateSections: ["chapter 2"]
```

---

### **4. Helpful and Proactive**

**Added to system prompt:**
```
HELPFUL REASONING (CRITICAL):
- If user mentions a section that doesn't exist yet:
  * Don't say "I couldn't find that section" - that's unhelpful!
  * Reason: "User wants chapter 2, but no structure exists yet. 
    I should create the structure first, then write chapter 2."
  * Intent: create_structure (with auto-generation)
  * Be proactive and helpful, not just error-throwing

CONVERSATIONAL TONE:
- Be helpful and collaborative, not robotic
- Instead of "Error: section not found" → "Let me create that structure for you"
- Instead of "I need more information" → "I'd be happy to help! Just to clarify..."
- Try to figure out what the user wants before asking questions
```

---

### **5. Enhanced Response Format**

Added new fields to the JSON response:

```typescript
{
  "intent": "...",
  "confidence": 0.9,
  "reasoning": "Explain your thought process - be helpful and show you understand",
  "suggestedAction": "What the system should do - be specific and proactive",
  "clarifyingQuestion": "Helpful, polite question (e.g., 'I'd be happy to help! Just to clarify...')",
  "extractedEntities": {
    "targetSegment": "chapter 2",
    "autoGenerateSections": ["chapter 2"], // ✅ NEW
    "documentFormat": "short-story" // ✅ NEW
  }
}
```

---

## How It Works Now

### **Example 1: Multi-step Request**

**Before:**
```
USER: "Write a story about X and write chapter 2 straight away"
ORCHESTRATOR: "I need you to select a section first."
```

**After:**
```
USER: "Write a story about X and write chapter 2 straight away"
REASONING: User wants to create a new story and immediately generate chapter 2. 
This is a multi-step request - I should create the structure and auto-generate chapter 2.
INTENT: create_structure
ACTION: 
  1. Generate story structure
  2. Auto-generate chapter 2 content
  3. Open document panel
ORCHESTRATOR: "✅ Created short-story structure with 5 sections"
              "✍️ Writing 'Chapter 2' (initial draft)..."
```

---

### **Example 2: Frustrated Follow-up**

**Before:**
```
USER: "chapter 2 as I said."
ORCHESTRATOR: "I couldn't find that section."
```

**After:**
```
USER: "chapter 2 as I said."
REASONING: User is frustrated. Looking at conversation history, they wanted to write 
chapter 2. No structure exists yet, so I should create it first.
INTENT: create_structure
ACTION: Create short story structure, then write chapter 2
ORCHESTRATOR: "I understand! Let me create that structure for you and write chapter 2."
              "✅ Created short-story structure with 5 sections"
              "✍️ Writing 'Chapter 2' (initial draft)..."
```

---

### **Example 3: Proactive Structure Reasoning**

**Before:**
```
USER: "Write chapter 3"
ORCHESTRATOR: "Error: Chapter 3 not found"
```

**After:**
```
USER: "Write chapter 3"
REASONING: User wants chapter 3, but no structure exists. I should create a story 
structure with chapters, then write chapter 3.
INTENT: create_structure
EXTRACTED: 
  - documentFormat: inferred from context or default to "short-story"
  - autoGenerateSections: ["chapter 3"]
ORCHESTRATOR: "I'll create a story structure for you and write chapter 3!"
              "✅ Created short-story structure with 5 sections"
              "✍️ Writing 'Chapter 3' (initial draft)..."
```

---

## Files Modified

1. ✅ `frontend/src/lib/orchestrator/llmIntentAnalyzer.ts` - Enhanced system prompt with helpful reasoning

---

## Benefits

✅ **Helpful and Proactive** - Tries to help instead of throwing errors  
✅ **Multi-step Requests** - Handles "create and write" in one go  
✅ **Frustrated Follow-ups** - Recognizes when user is repeating themselves  
✅ **Structure Reasoning** - Understands "short story = chapters"  
✅ **Conversational Tone** - Friendly and collaborative, not robotic  
✅ **Better UX** - Users don't get stuck in error loops  

---

## Testing

**Test Case 1: Multi-step Request**
```
USER: "Write a screenplay about X. Write act 1 right away."
EXPECTED: 
  - Creates screenplay structure
  - Auto-generates act 1
  - Opens document panel
```

**Test Case 2: Frustrated Follow-up**
```
USER: "Write chapter 2"
ORCHESTRATOR: "Which section?"
USER: "chapter 2 as I said!"
EXPECTED:
  - Recognizes frustration
  - Creates structure if needed
  - Writes chapter 2
```

**Test Case 3: Proactive Reasoning**
```
USER: "Write scene 5"
CANVAS: No structure exists
EXPECTED:
  - Reasons: "User wants scene 5, probably a screenplay"
  - Creates screenplay structure
  - Writes scene 5
```

---

## Future Enhancements

- **Learn from user preferences** - Remember if user prefers chapters vs. scenes
- **Suggest alternatives** - "Did you mean chapter 2 or scene 2?"
- **Explain reasoning** - Show user why orchestrator made certain decisions
- **Undo/redo** - Allow user to revert orchestrator actions

The orchestrator is now a **helpful collaborator**, not just a command executor! 🎉

