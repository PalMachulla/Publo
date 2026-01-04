# Orchestrator Development Checklist

**Last Updated:** November 27, 2025  
**Purpose:** Systematic checklist for adding features or modifying the orchestrator system

> ⚠️ **Important (2025-12):** This checklist is scoped to the **legacy TypeScript orchestrator** implementation in `frontend/src/lib/orchestrator/` (many files now end with `.deprecated`).
>
> If you are modifying the **active Python Deep Agent** system (SSE streaming + `orchestrator/api/chat.py`), start with:
> - `docs/orchestrator/DEEP_AGENT_CANVAS_SOURCES.md` (canvas nodes → agent context)
> - `orchestrator/api/chat.py` (context injection into agent)
> - `frontend/src/hooks/useOrchestratorStream.ts` (request payload to backend)

---

## 🎯 Quick Start

Before making ANY changes to the orchestrator:

1. ✅ Read this checklist
2. ✅ Review `ORCHESTRATOR_ARCHITECTURE.md` for system overview
3. ✅ Check `QUICK_REFERENCE.md` for file locations
4. ✅ Review `ARCHITECTURE_DIAGRAM.md` for data flow
5. ✅ Create a feature branch: `git checkout -b feature/your-feature`

---

## 📋 Pre-Development Phase

### 1. Understand the Complete Flow

**Trace the path from user input to UI display:**

```
User Input
  ↓
OrchestratorPanel (UI)
  ↓
MultiAgentOrchestrator.orchestrate()
  ↓
OrchestratorEngine.analyzeIntent() (LLM)
  ↓
Action Generator (e.g., CreateStructureAction)
  ↓
Action Payload (with ALL required data)
  ↓
OrchestratorPanel.executeActionDirectly()
  ↓
UI Display / Tool Execution
  ↓
WorldState Update
  ↓
Blackboard Communication
```

**Checklist:**
- [ ] I understand which layer my change affects
- [ ] I've identified all files that need modification
- [ ] I've checked for similar existing features
- [ ] I understand the data flow through the system

---

### 2. Architecture Review

**Reference Documents:**
- [ ] Read relevant sections in `ORCHESTRATOR_ARCHITECTURE.md`
- [ ] Check `ARCHITECTURE_DIAGRAM.md` for two-phase orchestration
- [ ] Review `QUICK_REFERENCE.md` for file locations

**Key Questions:**
- [ ] Does this fit into the existing architecture?
- [ ] Will this require new layers or components?
- [ ] Are there architectural patterns I should follow?

---

### 3. Dependency Analysis

**Check Dependencies:**
- [ ] WorldState - Will I read/write application state?
- [ ] Blackboard - Will I communicate with agents?
- [ ] Canvas Context - Do I need canvas node information?
- [ ] RAG Integration - Do I need semantic search?
- [ ] Temporal Memory - Do I need conversation history?

**Dependency Map:**
```
My Feature
  ├─ Depends on: [list dependencies]
  ├─ Depended on by: [list dependents]
  └─ Circular dependencies: [check for cycles]
```

---

## 🧠 Intent Analysis Layer

### When Modifying Intent Detection

**Critical Decision: LLM vs Pattern Matching**

```
Use LLM Reasoning When:
✅ Creative/varied user input ("build a story", "make an interview")
✅ Context-dependent ("write it", "the first one")
✅ Ambiguous phrasing ("I need something for podcasting")
✅ Follow-up responses ("yes", "1", "the interview one")

Use Pattern Matching When:
❌ NEVER for structure creation
❌ NEVER for creative requests
❌ Only for very specific, unambiguous commands
```

**Checklist:**
- [ ] **LLM Reasoning First**: Does this need LLM analysis?
- [ ] Updated `shouldUseLLMAnalysis()` in `llmIntentAnalyzer.ts`
- [ ] Added examples to LLM system prompt
- [ ] Added intent to `UserIntent` type in `intentRouter.ts`
- [ ] Tested with varied phrasings (not just one example)

**Files to Modify:**
- [ ] `context/intentRouter.ts` - Intent routing logic
- [ ] `context/llmIntentAnalyzer.ts` - LLM reasoning
- [ ] `context/templateMatcher.ts` - Template matching (if applicable)

**Test Cases:**
```
Test these variations:
- Exact keyword: "Create a podcast"
- Variation 1: "Build a story about podcasts"
- Variation 2: "Make me an interview format"
- Variation 3: "I want to write about dragons"
- Follow-up: "1", "the first one", "yes"
```

---

## 🎬 Action Generation Layer

### When Creating/Modifying Action Generators

**Critical: Action Payload Completeness**

```typescript
// ❌ BAD: Missing required fields
{
  type: 'generate_structure',
  payload: {
    plan: structurePlan  // Missing format, prompt!
  }
}

// ✅ GOOD: Complete payload
{
  type: 'generate_structure',
  payload: {
    plan: structurePlan,
    format: request.documentFormat,  // ✅ Required
    prompt: request.message,          // ✅ Required
    userKeyId: request.userKeyId      // ✅ If needed
  }
}
```

**Payload Checklist:**
- [ ] `format` - Document format (if structure-related)
- [ ] `prompt` - User's original message (for context)
- [ ] `sectionId` - Target section (if content-related)
- [ ] `sectionName` - Section name (for display)
- [ ] `nodeId` - Node ID (if navigation-related)
- [ ] `plan` - Structure plan (if structure generation)
- [ ] `model` - Selected model (if LLM call)
- [ ] `userKeyId` - API key ID (if LLM call)
- [ ] Any other context the UI or tools need

**Action Type Checklist:**
- [ ] Using correct action type:
  - `message` - Display message to user
  - `generate_structure` - Create document structure
  - `generate_content` - Write content
  - `request_clarification` - Ask user for clarification
  - `open_document` - Navigate to document
  - `select_section` - Select a section
  - `delete_node` - Delete a node

**Status Checklist:**
- [ ] Initial status is correct:
  - `pending` - Action not yet executed
  - `executing` - Action in progress
  - `completed` - Action finished successfully
  - `failed` - Action failed

**Files to Create/Modify:**
- [ ] `actions/[category]/[YourAction].ts` - New action generator
- [ ] `actions/base/BaseAction.ts` - If modifying base class
- [ ] `core/orchestratorEngine.ts` - Register action generator

**Action Generator Template:**
```typescript
export class MyNewAction extends BaseAction {
  get actionType(): OrchestratorAction['type'] {
    return 'my_action_type'
  }
  
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext,
    additionalContext?: any
  ): Promise<OrchestratorAction[]> {
    // 1. Validate required fields
    if (!request.requiredField) {
      return [this.message('Missing required field', 'error')]
    }
    
    // 2. Build action payload with ALL required data
    const payload = {
      field1: request.field1,
      field2: request.field2,
      // ... include EVERYTHING the UI needs
    }
    
    // 3. Return action with complete payload
    return [{
      type: 'my_action_type',
      payload,
      status: 'pending'
    }]
  }
}
```

---

## 🖥️ UI Integration Layer

### When Actions Need UI Display

**Critical: OrchestratorPanel Handler**

**Checklist:**
- [ ] Added case in `OrchestratorPanel.tsx` `executeActionDirectly()` switch
- [ ] Validated ALL required payload fields
- [ ] NO silent defaults (validate explicitly)
- [ ] Added user feedback (success/error messages)
- [ ] Tested with missing fields (should fail gracefully)

**Handler Template:**
```typescript
case 'my_action_type':
  // 1. Validate required fields (NO DEFAULTS!)
  if (!action.payload.requiredField) {
    console.error('❌ Missing requiredField in action payload')
    if (onAddChatMessage) {
      onAddChatMessage('Failed: Missing required data', 'orchestrator', 'error')
    }
    return
  }
  
  // 2. Extract fields safely
  const { field1, field2 } = action.payload
  
  // 3. Execute action
  await myActionHandler(field1, field2)
  
  // 4. User feedback
  if (onAddChatMessage) {
    onAddChatMessage(`✅ Success: ${field1}`, 'orchestrator', 'result')
  }
  break
```

**Default Values - DANGER ZONE:**
```typescript
// ❌ BAD: Silent incorrect defaults
const format = action.payload.format || 'novel'
// Problem: If format is missing, defaults to 'novel' silently!
// User asks for podcast → gets novel → confusion!

// ✅ GOOD: Explicit validation
const format = action.payload.format
if (!format) {
  console.error('❌ Missing format in action payload')
  return
}
// Problem: Fails loudly, easy to debug!
```

**Files to Modify:**
- [ ] `components/panels/OrchestratorPanel.tsx` - Main handler
- [ ] `components/ui/organisms/ChatAccordion.tsx` - If chat display
- [ ] `components/ui/molecules/ChatOptionsSelector.tsx` - If options UI

---

## 🌍 WorldState Integration

### When Using WorldState

**Read Operations:**
```typescript
// ✅ Always check for null/undefined
const activeDoc = worldState.getActiveDocument()
if (!activeDoc.nodeId) {
  console.log('No active document')
  return
}

const section = worldState.getSelectedSection()
if (!section) {
  console.log('No selected section')
  return
}
```

**Write Operations:**
```typescript
// ✅ Use update() with draft
worldState.update(draft => {
  draft.activeDocument.nodeId = newNodeId
  draft.activeDocument.format = format
  draft.activeDocument.structure = structure
})

// ❌ Don't mutate directly
worldState.state.activeDocument.nodeId = newNodeId  // BAD!
```

**Checklist:**
- [ ] Using `worldState.getActiveDocument()` for reads
- [ ] Using `worldState.update(draft => {...})` for writes
- [ ] Null checks on all WorldState reads
- [ ] Not mutating state directly

**Files to Check:**
- [ ] `core/worldState.ts` - State definition
- [ ] `core/orchestratorEngine.ts` - WorldState usage

---

## 📝 Blackboard Communication

### When Adding Messages

**Message Type Guidelines:**
```
thinking  - Orchestrator is processing (spinner icon)
decision  - Orchestrator made a decision (lightbulb icon)
result    - Final result/success (checkmark icon)
error     - Error occurred (X icon)
progress  - Progress update (progress bar)
task      - Task delegation (task icon)
```

**Checklist:**
- [ ] Using correct message type
- [ ] Message is user-friendly (not technical)
- [ ] Message is informative (tells user what's happening)
- [ ] Message timing is correct (when should it appear?)

**Message Template:**
```typescript
blackboard.addMessage({
  role: 'orchestrator',
  content: '✅ Created podcast structure with 5 sections',
  type: 'result'
})
```

**Files to Check:**
- [ ] `core/blackboard.ts` - Message system

---

## 🧪 Testing Checklist

### Manual Testing Scenarios

**Happy Path:**
- [ ] Normal input works correctly
- [ ] UI displays expected result
- [ ] Data persists correctly

**Edge Cases:**
- [ ] Empty canvas (no nodes)
- [ ] Multiple documents on canvas
- [ ] No active document
- [ ] Document panel open vs closed
- [ ] With conversation history
- [ ] Without conversation history

**Error Cases:**
- [ ] Missing API keys → Shows helpful error
- [ ] Network failure → Graceful degradation
- [ ] Invalid format → Clear error message
- [ ] Missing required fields → Fails loudly

**UI Verification:**
- [ ] Messages display correctly
- [ ] Options render properly (if applicable)
- [ ] Number selection works (if applicable)
- [ ] Click selection works (if applicable)
- [ ] Icons show correct state
- [ ] Loading states work
- [ ] Error states work

### Test Different User Inputs

**For Structure Creation:**
```
✅ Test these variations:
- "Create a podcast"
- "Build a story about podcasts"
- "Make me an interview format"
- "Let's do a hero's journey novel"
- "I want to write about dragons"
- "Generate a screenplay on time travel"
- "Start a blog post about AI"
```

**For Follow-up Responses:**
```
✅ Test these variations:
- "1" (number)
- "first" (ordinal)
- "the first one" (natural language)
- "option 1" (explicit)
- "yes" (confirmation)
```

---

## 🔍 Code Quality Checklist

### TypeScript

- [ ] Run `npm run build` in `frontend/`
- [ ] Run `npx tsc --noEmit` for type checking
- [ ] No `any` types (use proper interfaces)
- [ ] All function parameters typed
- [ ] All return types explicit
- [ ] No TypeScript errors

### Code Style

- [ ] Consistent naming conventions
  - `camelCase` for variables/functions
  - `PascalCase` for classes/types
  - `UPPER_CASE` for constants
- [ ] Clear, descriptive variable names
- [ ] Comments explain WHY, not WHAT
- [ ] JSDoc comments for public functions

### Error Handling

- [ ] Try-catch blocks where needed
- [ ] User-friendly error messages (not technical)
- [ ] Console logs for debugging (with emoji prefixes)
- [ ] Graceful degradation (don't crash the app)

**Error Handling Template:**
```typescript
try {
  // Risky operation
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('❌ [MyFeature] Operation failed:', error)
  
  // User-friendly message
  if (onAddChatMessage) {
    onAddChatMessage(
      'Something went wrong. Please try again.',
      'orchestrator',
      'error'
    )
  }
  
  // Return safe fallback
  return defaultValue
}
```

---

## 📚 Documentation Checklist

### Code Documentation

- [ ] JSDoc comments on new functions
- [ ] Inline comments for complex logic
- [ ] Updated existing comments if behavior changed
- [ ] Removed outdated comments

**JSDoc Template:**
```typescript
/**
 * Generate actions for my_new_intent
 * 
 * This action generator handles user requests to [describe what it does].
 * 
 * Flow:
 * 1. Validate required fields
 * 2. Build action payload
 * 3. Return action with complete data
 * 
 * @param intent - Analyzed user intent from LLM
 * @param request - Original orchestrator request
 * @param context - Canvas context (nodes, edges, state)
 * @param additionalContext - Model selection and available models
 * @returns Array of actions to execute
 * 
 * @example
 * // User: "Do something"
 * // Returns: [{ type: 'my_action', payload: {...} }]
 */
```

### Architecture Documentation

- [ ] Updated `ORCHESTRATOR_ARCHITECTURE.md` if architecture changed
- [ ] Updated `QUICK_REFERENCE.md` if new patterns added
- [ ] Updated `ARCHITECTURE_DIAGRAM.md` if flow changed
- [ ] Created feature-specific docs in `docs/orchestrator/` if needed

### Commit Messages

- [ ] Use conventional commits:
  - `feat:` - New feature
  - `fix:` - Bug fix
  - `refactor:` - Code refactoring
  - `docs:` - Documentation only
  - `test:` - Adding tests
  - `chore:` - Maintenance

- [ ] Explain WHAT changed and WHY
- [ ] Reference issues if applicable
- [ ] Keep commits atomic (one logical change per commit)

**Commit Message Template:**
```
feat: Add duplicate document feature

🎯 Allow users to duplicate existing documents

**What Changed:**
- Added DuplicateDocumentAction in actions/navigation/
- Updated OrchestratorPanel to handle duplicate_document action
- Added LLM examples for duplication requests

**Why:**
- Users requested ability to copy documents
- Enables template-based workflows

**Testing:**
- Tested with "Duplicate this document"
- Tested with "Copy the screenplay"
- Tested with no active document (shows error)

Closes #123
```

---

## 🚀 Deployment Checklist

### Pre-Commit

- [ ] All TypeScript errors fixed
- [ ] All console.errors reviewed (not left by mistake)
- [ ] No commented-out code (unless documented as TODO)
- [ ] No debug logs left in production code
- [ ] Removed any test/dummy data

### Pre-Push

- [ ] Feature tested end-to-end
- [ ] Edge cases tested
- [ ] Error cases tested
- [ ] No breaking changes (or documented in commit)
- [ ] Commit message clear and descriptive
- [ ] Branch up to date with main

### Post-Deployment

- [ ] Monitor for errors in production
- [ ] Verify feature works in production environment
- [ ] Update team on new feature/changes
- [ ] Close related issues

---

## 🐛 Common Pitfalls (Learn from Past Mistakes!)

### 1. Missing Payload Fields ⚠️

**Problem:** Action payload missing required fields (e.g., `format`, `prompt`)

**Example:**
```typescript
// ❌ BAD
{
  type: 'generate_structure',
  payload: {
    plan: structurePlan  // Missing format!
  }
}
```

**Solution:** Always include ALL context the UI needs
```typescript
// ✅ GOOD
{
  type: 'generate_structure',
  payload: {
    plan: structurePlan,
    format: request.documentFormat,  // ✅
    prompt: request.message           // ✅
  }
}
```

**How to Catch:** Check OrchestratorPanel handler - what does it expect?

---

### 2. Silent Defaults ⚠️

**Problem:** Using `|| 'default'` hides missing data

**Example:**
```typescript
// ❌ BAD
const format = action.payload.format || 'novel'
// User asks for podcast → gets novel → confusion!
```

**Solution:** Validate explicitly and fail loudly
```typescript
// ✅ GOOD
const format = action.payload.format
if (!format) {
  console.error('❌ Missing format in action payload')
  return
}
```

**How to Catch:** Search for `||` in action handlers

---

### 3. Pattern Matching Over-Reliance ⚠️

**Problem:** Brittle regex patterns miss variations

**Example:**
```typescript
// ❌ BAD
/create (a |an )?(novel|screenplay)/i
// Misses: "Build a story", "Make an interview"
```

**Solution:** Use LLM reasoning for creative/varied input
```typescript
// ✅ GOOD
const isStructureRequest = /\b(create|make|build).*\b(story|novel)/i
return ... || isStructureRequest  // Forces LLM analysis
```

**How to Catch:** Test with varied phrasings

---

### 4. Inconsistent Message Types ⚠️

**Problem:** Using wrong message type

**Example:**
```typescript
// ❌ BAD
blackboard.addMessage({
  role: 'orchestrator',
  content: 'Error occurred',
  type: 'result'  // Should be 'error'!
})
```

**Solution:** Follow message type conventions
```typescript
// ✅ GOOD
blackboard.addMessage({
  role: 'orchestrator',
  content: '❌ Error occurred',
  type: 'error'  // ✅ Correct type
})
```

**How to Catch:** Review message types in checklist

---

### 5. Missing Null Checks ⚠️

**Problem:** Assuming data exists without checking

**Example:**
```typescript
// ❌ BAD
const sectionName = worldState.getSelectedSection().name
// Crashes if no section selected!
```

**Solution:** Always validate before accessing
```typescript
// ✅ GOOD
const section = worldState.getSelectedSection()
if (!section) {
  console.log('No section selected')
  return
}
const sectionName = section.name
```

**How to Catch:** Look for direct property access without checks

---

### 6. Forgetting UI Integration ⚠️

**Problem:** Creating action but not handling it in OrchestratorPanel

**Example:**
```typescript
// Created MyNewAction.ts ✅
// But forgot to add case in OrchestratorPanel.tsx ❌
```

**Solution:** Check BOTH action generation AND UI handling

**How to Catch:** Search for action type in OrchestratorPanel.tsx

---

### 7. Incomplete Testing ⚠️

**Problem:** Only testing happy path

**Example:**
```
✅ Tested: "Create a podcast"
❌ Didn't test: Empty canvas, no API keys, network failure
```

**Solution:** Test edge cases, errors, and weird inputs

**How to Catch:** Use testing checklist above

---

## 📋 Quick Reference: Files by Feature

### Intent Analysis
```
context/
├── intentRouter.ts          - Hybrid intent routing
├── llmIntentAnalyzer.ts     - LLM-based reasoning
└── templateMatcher.ts       - Template keyword matching
```

### Action Generation
```
actions/
├── base/
│   └── BaseAction.ts        - Abstract base class
├── content/
│   ├── AnswerQuestionAction.ts
│   └── WriteContentAction.ts
├── structure/
│   └── CreateStructureAction.ts
└── navigation/
    ├── OpenDocumentAction.ts
    ├── DeleteNodeAction.ts
    └── NavigateSectionAction.ts
```

### Core System
```
core/
├── orchestratorEngine.ts    - Main orchestrator
├── worldState.ts            - Unified state management
├── blackboard.ts            - Communication hub
└── modelRouter.ts           - Model selection
```

### UI Integration
```
components/
├── panels/
│   └── OrchestratorPanel.tsx           - Main UI
└── ui/
    ├── organisms/
    │   └── ChatAccordion.tsx           - Chat display
    └── molecules/
        └── ChatOptionsSelector.tsx     - Options UI
```

---

## 🎯 Example: Adding a New Feature

### Scenario: Add "Duplicate Document" Feature

#### 1. Intent Analysis
- [ ] Add `duplicate_document` to `UserIntent` type
- [ ] Update `shouldUseLLMAnalysis()` to detect duplication requests
- [ ] Add examples to LLM system prompt:
  ```typescript
  "duplicate this document"
  "copy the screenplay"
  "make a copy of the novel"
  ```

#### 2. Action Generation
- [ ] Create `DuplicateDocumentAction.ts` in `actions/navigation/`
- [ ] Implement `generate()` method
- [ ] Return action with complete payload:
  ```typescript
  {
    type: 'duplicate_document',
    payload: {
      sourceNodeId: string,      // ✅ Required
      sourceName: string,         // ✅ Required
      targetName: string,         // ✅ Required
      format: string              // ✅ Required
    },
    status: 'pending'
  }
  ```

#### 3. UI Integration
- [ ] Add case in `OrchestratorPanel.tsx`:
  ```typescript
  case 'duplicate_document':
    // Validate
    if (!action.payload.sourceNodeId) {
      console.error('❌ Missing sourceNodeId')
      return
    }
    
    // Execute
    await onDuplicateNode(
      action.payload.sourceNodeId,
      action.payload.targetName
    )
    
    // Feedback
    if (onAddChatMessage) {
      onAddChatMessage(
        `✅ Duplicated "${action.payload.sourceName}"`,
        'orchestrator',
        'result'
      )
    }
    break
  ```

#### 4. Testing
- [ ] Test: "Duplicate this document"
- [ ] Test: "Copy the screenplay"
- [ ] Test: "Make a copy of the novel"
- [ ] Test with no active document → Shows error
- [ ] Test with multiple documents → Clarifies which one
- [ ] Test with network failure → Graceful error

#### 5. Documentation
- [ ] Update `ORCHESTRATOR_ARCHITECTURE.md`
- [ ] Add to `QUICK_REFERENCE.md`
- [ ] Commit: `feat: Add duplicate document feature`

---

## 🔄 Continuous Improvement

### After Each Feature
- [ ] Review this checklist - did it help?
- [ ] Add new items if you found gaps
- [ ] Update examples with real scenarios
- [ ] Share learnings with team

### Monthly Review
- [ ] Review common bugs - add to "Common Pitfalls"
- [ ] Update file references if architecture changed
- [ ] Simplify checklist if items are redundant
- [ ] Archive outdated sections

---

## 📞 Need Help?

**If you're unsure about any step:**

1. ✅ Check `ORCHESTRATOR_ARCHITECTURE.md` for system overview
2. ✅ Check `ARCHITECTURE_DIAGRAM.md` for data flow
3. ✅ Check `QUICK_REFERENCE.md` for file locations
4. ✅ Look at similar existing features for patterns
5. ✅ Ask team for code review before merging
6. ✅ Test thoroughly - better safe than sorry!

**Remember:** This checklist exists to help you, not slow you down. Use it as a guide, not a rigid rulebook. The goal is to catch issues early and maintain code quality! 🎯

---

**This checklist would have caught the bug we just found:**
- ✅ "Action Payload Completeness" → Would remind to include `format`
- ✅ "Default Values" → Would warn against `|| 'novel'`
- ✅ "Testing Checklist" → Would test with different formats

**Use this checklist for EVERY orchestrator change!** 🚀

