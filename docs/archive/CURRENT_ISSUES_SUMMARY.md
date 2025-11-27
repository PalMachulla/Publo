# Current Issues Summary

## Issue 1: No Educational Clarification ❌

**Expected:**
```
USER: "Write a short story about a one-eyed man. Write chapter 2."
ORCHESTRATOR: "I'd love to help! Just to clarify - short stories typically use scenes 
rather than chapters. Did you mean Scene 2? Or are you planning a longer novel?"
```

**Actual:**
```
USER: "Write a short story about a one-eyed man. Write chapter 2."
ORCHESTRATOR: Creates structure with chapters (no clarification!)
```

**Why:**
- The LLM intent analyzer changes were made to `llmIntentAnalyzer.ts`
- BUT the orchestrator is detecting `create_structure` intent
- The educational clarification logic needs to happen BEFORE structure generation
- Currently, the orchestrator goes straight to structure generation without checking format conventions

**Solution Needed:**
- Add format validation in `orchestratorEngine.ts` BEFORE calling structure generation
- Check if user's request matches format conventions
- If mismatch detected, return `clarify_intent` action instead of `create_structure`

---

## Issue 2: Section ID Mismatch ❌

**Error:**
```
✅ Content generated and saved for segment: ch2
❌ Failed to generate content: Section chap2 not found in document
```

**Why:**
- First phase uses section ID: "ch2"
- Second phase uses section ID: "chap2"
- These don't match!

**Root Cause:**
- The LLM is generating inconsistent section IDs in the structure plan
- OR the task generation is using a different ID than what was created

**Solution Needed:**
- Validate that task `sectionId`s match actual structure IDs
- This validation already exists in `canvas/page.tsx` but might not be working correctly
- Need to check the structure generation prompt to ensure consistent ID format

---

## Issue 3: Structure Created with Chapters (Not Scenes) ❌

**Expected:**
- Short story structure with **Scenes**

**Actual:**
- Short story structure with **Chapters**

**Why:**
- The `getFormatInstructions()` method tells the LLM that short stories use scenes
- BUT the LLM is prioritizing user's explicit request ("chapter 2") over format conventions
- No validation or clarification happens

**Solution Needed:**
- Implement pre-generation validation
- Detect format mismatches BEFORE calling structure generation LLM
- Return clarification action when mismatch detected

---

## Root Cause Analysis

The educational clarification logic was added to `llmIntentAnalyzer.ts`, but:

1. **Intent analysis happens EARLY** - Before we know the details
2. **Structure generation happens LATER** - After intent is already decided
3. **No validation between intent and structure** - Missing step!

### Current Flow:
```
1. User: "Write short story, chapter 2"
2. Intent Analysis → create_structure (correct!)
3. Structure Generation → Creates chapters (wrong!)
4. No validation or clarification
```

### Needed Flow:
```
1. User: "Write short story, chapter 2"
2. Intent Analysis → create_structure
3. Format Validation → Detects mismatch (short story + chapters)
4. Return clarify_intent action
5. Orchestrator asks: "Short stories use scenes. Did you mean Scene 2?"
6. User: "Yes, scene 2"
7. Structure Generation → Creates scenes (correct!)
```

---

## Implementation Plan

### Step 1: Add Format Validation Function

**File:** `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`

```typescript
private validateFormatConventions(
  format: string, 
  userMessage: string
): { valid: boolean; mismatch?: string; suggestion?: string } {
  const normalizedFormat = format.toLowerCase().replace(/-/g, '_')
  const lowerMessage = userMessage.toLowerCase()
  
  // Check for format mismatches
  if (normalizedFormat === 'short_story') {
    if (lowerMessage.includes('chapter')) {
      return {
        valid: false,
        mismatch: 'chapter',
        suggestion: 'scene'
      }
    }
  }
  
  if (normalizedFormat === 'screenplay') {
    if (lowerMessage.includes('chapter')) {
      return {
        valid: false,
        mismatch: 'chapter',
        suggestion: 'act or scene'
      }
    }
  }
  
  if (normalizedFormat === 'novel') {
    // Novels can have chapters, this is correct
  }
  
  return { valid: true }
}
```

### Step 2: Call Validation Before Structure Generation

**File:** `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`  
**Location:** In `generateActions()`, case `'create_structure':`

```typescript
case 'create_structure': {
  // ✅ NEW: Validate format conventions
  const validation = this.validateFormatConventions(
    request.documentFormat || 'short-story',
    request.message
  )
  
  if (!validation.valid) {
    // Return clarification action instead of creating structure
    actions.push({
      type: 'message',
      payload: {
        content: `I'd love to help with your ${request.documentFormat}! Just to clarify - 
${request.documentFormat}s typically use ${validation.suggestion}s rather than ${validation.mismatch}s. 
Did you mean ${validation.suggestion.charAt(0).toUpperCase() + validation.suggestion.slice(1)} 2? 
Or are you planning a different format?`,
        type: 'result'
      },
      status: 'pending'
    })
    break // Don't create structure yet
  }
  
  // Continue with structure generation...
}
```

### Step 3: Fix Section ID Consistency

**File:** `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`  
**Location:** In structure generation prompt

Add explicit instruction:
```
CRITICAL: Section IDs must be consistent and match the structure you create.
- Use format: "{parent_id}_{child_type}{number}" (e.g., "act1_seq1", "act1_seq2")
- OR use simple format: "{type}{number}" (e.g., "scene1", "scene2", "chapter1")
- Tasks MUST reference the EXACT section IDs from your structure
- Example: If you create section with id "chapter2", task must use sectionId "chapter2" (not "ch2" or "chap2")
```

---

## Priority

1. **HIGH**: Fix section ID mismatch (blocks content generation)
2. **HIGH**: Add format validation (user education)
3. **MEDIUM**: Improve error messages

---

## Testing Plan

**Test Case 1:**
```
USER: "Write a short story about X. Write chapter 2."
EXPECTED: Orchestrator asks if they meant Scene 2 or want a novel
```

**Test Case 2:**
```
USER: "Write a short story about X. Write scene 2."
EXPECTED: Creates structure with scenes, generates scene 2
```

**Test Case 3:**
```
USER: "Write a screenplay about X. Write chapter 1."
EXPECTED: Orchestrator explains screenplays use acts/scenes
```

