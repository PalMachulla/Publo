# Orchestrator Test Scenarios

**Purpose:** Comprehensive test scenarios for orchestrator refactoring  
**Usage:** Run these tests after each code change to ensure no regression  
**Date:** 2025-11-27

---

## Test Format

Each test scenario follows this structure:

```markdown
## [Intent Name]

### Scenario: [Description]
**Setup:**
- Canvas state: [empty/single node/multiple nodes]
- Active context: [none/specific section]
- User message: "[exact message]"

**Expected Behavior:**
1. Intent detected: `[intent_type]`
2. Actions generated: `[action_type]`
3. Action payload contains: [key fields]
4. UI shows: [expected result]

**How to Test:**
1. [Step-by-step instructions]
2. [What to verify]
3. [Expected console logs]

**Pass Criteria:**
- [ ] Intent correctly detected
- [ ] Actions generated match expected
- [ ] No console errors
- [ ] UI updates correctly
- [ ] Blackboard updated
- [ ] WorldState consistent
```

---

## Test Scenarios

## 1. Answer Question - Empty Canvas

### Scenario: User asks about the app with no content

**Setup:**
- Canvas state: Empty (no nodes)
- Active context: None
- User message: "What is this app?"

**Expected Behavior:**
1. Intent detected: `answer_question`
2. Actions generated: `generate_content` with `isAnswer: true`
3. Action payload contains:
   - `prompt`: Enhanced with question
   - `model`: Selected model ID
   - `isAnswer`: true
4. UI shows: Conversational response about the app

**How to Test:**
1. Open canvas page with no nodes
2. Type "What is this app?" in orchestrator panel
3. Press Enter
4. Wait for response

**Expected Console Logs:**
```
🎯 [Orchestrator] Starting orchestration
📊 [Intent Analysis] answer_question (confidence: 0.9+)
✅ [Orchestrator] Completed
```

**Pass Criteria:**
- [ ] Intent: `answer_question`
- [ ] No errors in console
- [ ] Response appears in chat
- [ ] Response is conversational and helpful
- [ ] No canvas changes

---

## 2. Answer Question - Single Story Node

### Scenario: User asks about existing story

**Setup:**
- Canvas state: One story node (novel with 3 chapters)
- Active context: None
- User message: "Tell me about this story"

**Expected Behavior:**
1. Intent detected: `answer_question`
2. Actions generated: `generate_content` with enhanced prompt
3. Action payload includes:
   - Story structure in prompt
   - Content from sections (if available)
   - Node summary
4. UI shows: Description of the story based on structure/content

**How to Test:**
1. Create a novel structure (3 chapters)
2. Optionally write some content
3. Type "Tell me about this story"
4. Verify response references the story

**Expected Console Logs:**
```
📊 [Intent Analysis] answer_question
🔍 Enhanced prompt includes 1 node(s)
✅ Response generated
```

**Pass Criteria:**
- [ ] Intent: `answer_question`
- [ ] Response mentions story details
- [ ] Response references chapter structure
- [ ] Response includes content if available
- [ ] No errors

---

## 3. Answer Question - Multiple Nodes

### Scenario: User asks to compare stories

**Setup:**
- Canvas state: Two story nodes (novel + screenplay)
- Active context: None
- User message: "Compare these two stories"

**Expected Behavior:**
1. Intent detected: `answer_question`
2. Actions generated: `generate_content` with both nodes' context
3. Action payload includes both stories' structures
4. UI shows: Comparative analysis

**How to Test:**
1. Create two different document types
2. Type "Compare these two stories"
3. Verify response compares both

**Pass Criteria:**
- [ ] Intent: `answer_question`
- [ ] Response mentions both stories
- [ ] Response compares structures/formats
- [ ] No errors

---

## 4. Write Content - Numeric Detection

### Scenario: User requests "Write Chapter 1"

**Setup:**
- Canvas state: One novel node with 3 chapters
- Active context: None (or different section)
- User message: "Write Chapter 1"

**Expected Behavior:**
1. Intent detected: `write_content`
2. Section detected: Chapter 1 (numeric pattern match)
3. Actions generated: `generate_content` with `sectionId`
4. UI shows: Content generation progress

**How to Test:**
1. Create novel with chapters
2. Type "Write Chapter 1"
3. Verify Chapter 1 is targeted (not active context)

**Expected Console Logs:**
```
📝 [generateActions] write_content
✅ [Numeric Detection] Found section: Chapter 1
🎯 Target section: chapter-1
```

**Pass Criteria:**
- [ ] Intent: `write_content`
- [ ] Section: Chapter 1 detected
- [ ] Overrides active context if different
- [ ] Content generated for Chapter 1
- [ ] No errors

---

## 5. Write Content - Ordinal Detection

### Scenario: User requests "Write the first chapter"

**Setup:**
- Canvas state: Novel with 3 chapters
- Active context: Chapter 2 (selected)
- User message: "Write the first chapter"

**Expected Behavior:**
1. Intent detected: `write_content`
2. Section detected: Chapter 1 (ordinal → numeric conversion)
3. Overrides active context (Chapter 2)
4. Content generated for Chapter 1

**How to Test:**
1. Create novel with chapters
2. Select Chapter 2 in document panel
3. Type "Write the first chapter"
4. Verify Chapter 1 is targeted

**Expected Console Logs:**
```
✅ [Ordinal Detection] "first" → Chapter 1
✅ [Section Override] Using section from message instead of active context
```

**Pass Criteria:**
- [ ] Intent: `write_content`
- [ ] Section: Chapter 1 (not Chapter 2)
- [ ] Console shows override message
- [ ] Content generated correctly

---

## 6. Write Content - Name-Based Detection

### Scenario: User requests "Write the prologue"

**Setup:**
- Canvas state: Novel with prologue + 3 chapters
- Active context: None
- User message: "Write the prologue"

**Expected Behavior:**
1. Intent detected: `write_content`
2. Section detected: Prologue (fuzzy name match)
3. Content generated for prologue

**How to Test:**
1. Create novel with prologue
2. Type "Write the prologue"
3. Verify prologue is targeted

**Expected Console Logs:**
```
✅ [Pattern Match] Found section: Prologue
```

**Pass Criteria:**
- [ ] Intent: `write_content`
- [ ] Section: Prologue detected
- [ ] Content generated
- [ ] No errors

---

## 7. Write Content - Active Context Fallback

### Scenario: User says "Write this section" with active context

**Setup:**
- Canvas state: Novel with 3 chapters
- Active context: Chapter 2 (selected in document panel)
- User message: "Write this section"

**Expected Behavior:**
1. Intent detected: `write_content`
2. No section found in message
3. Falls back to active context (Chapter 2)
4. Content generated for Chapter 2

**How to Test:**
1. Create novel
2. Select Chapter 2 in document panel
3. Type "Write this section"
4. Verify Chapter 2 is targeted

**Expected Console Logs:**
```
ℹ️ [Section Fallback] Using active context section: chapter-2
```

**Pass Criteria:**
- [ ] Intent: `write_content`
- [ ] Section: Chapter 2 (from active context)
- [ ] Content generated
- [ ] No errors

---

## 8. Write Content - No Section Found

### Scenario: User requests invalid section

**Setup:**
- Canvas state: Novel with 3 chapters
- Active context: None
- User message: "Write Chapter 10"

**Expected Behavior:**
1. Intent detected: `write_content`
2. Section detection fails (Chapter 10 doesn't exist)
3. Error message lists available sections
4. No content generated

**How to Test:**
1. Create novel with 3 chapters
2. Type "Write Chapter 10"
3. Verify error message

**Expected Console Logs:**
```
⚠️ [Numeric Detection] No match found for chapter 10
```

**Pass Criteria:**
- [ ] Intent: `write_content`
- [ ] Error message shown
- [ ] Lists available sections
- [ ] No content generated
- [ ] No crashes

---

## 9. Create Structure - Novel

### Scenario: User requests new novel

**Setup:**
- Canvas state: Empty or with other nodes
- Active context: None
- User message: "Write a novel about dragons"

**Expected Behavior:**
1. Intent detected: `create_structure`
2. Format: `novel`
3. Actions generated: `generate_structure`
4. Structure created with chapters
5. New node appears on canvas

**How to Test:**
1. Type "Write a novel about dragons"
2. Wait for structure generation
3. Verify node created with chapter structure

**Expected Console Logs:**
```
🏗️ [generateActions] create_structure
🎯 Attempting structure generation with gpt-4.1
✅ Structure generated successfully
```

**Pass Criteria:**
- [ ] Intent: `create_structure`
- [ ] Format: `novel`
- [ ] Structure has chapters
- [ ] Node created on canvas
- [ ] Document panel opens
- [ ] No errors

---

## 10. Create Structure - Screenplay

### Scenario: User requests screenplay

**Setup:**
- Canvas state: Empty
- Active context: None
- User message: "Create a screenplay about time travel"

**Expected Behavior:**
1. Intent detected: `create_structure`
2. Format: `screenplay`
3. Structure has acts and sequences
4. Node created

**How to Test:**
1. Type "Create a screenplay about time travel"
2. Verify screenplay structure (acts, sequences, scenes)

**Pass Criteria:**
- [ ] Intent: `create_structure`
- [ ] Format: `screenplay`
- [ ] Has acts and sequences
- [ ] Node created
- [ ] No errors

---

## 11. Create Structure - Format Education

### Scenario: User uses wrong terminology for format

**Setup:**
- Canvas state: Empty
- Active context: None
- User message: "Write a short story, chapter 1"

**Expected Behavior:**
1. Intent detected: `create_structure`
2. Format validation detects mismatch
3. Clarification message: "Short stories use scenes, not chapters"
4. Offers alternatives
5. No structure created yet

**How to Test:**
1. Type "Write a short story, chapter 1"
2. Verify educational message
3. Respond with corrected request

**Expected Console Logs:**
```
⚠️ [Format Validation] Mismatch: short-story uses scenes, not chapters
```

**Pass Criteria:**
- [ ] Intent: `create_structure` or `request_clarification`
- [ ] Educational message shown
- [ ] Suggests correct terminology
- [ ] Polite and helpful tone
- [ ] No structure created yet

---

## 12. Create Structure + Content

### Scenario: User wants both structure and content

**Setup:**
- Canvas state: Empty
- Active context: None
- User message: "Write a novel about dragons, write chapter 1"

**Expected Behavior:**
1. Intent detected: `create_structure`
2. Task complexity analysis detects multi-step
3. Actions generated:
   - `generate_structure`
   - `generate_content` (for chapter 1)
4. Both structure and content created

**How to Test:**
1. Type "Write a novel about dragons, write chapter 1"
2. Verify structure created
3. Verify Chapter 1 has content

**Expected Console Logs:**
```
🧠 Task complexity: Multi-step (structure + content)
✅ Structure generated
🚀 Starting agent execution for 1 action(s)
```

**Pass Criteria:**
- [ ] Intent: `create_structure`
- [ ] Structure created
- [ ] Chapter 1 has content
- [ ] Both steps complete
- [ ] No errors

---

## 13. Open Document

### Scenario: User wants to open existing document

**Setup:**
- Canvas state: Two story nodes ("Dragon Tale", "Time Traveler")
- Active context: None
- User message: "Open the dragon story"

**Expected Behavior:**
1. Intent detected: `open_document`
2. Fuzzy match finds "Dragon Tale" node
3. Document panel opens
4. Structure displayed

**How to Test:**
1. Create two stories with distinct names
2. Type "Open the dragon story"
3. Verify correct document opens

**Pass Criteria:**
- [ ] Intent: `open_document`
- [ ] Correct node identified
- [ ] Document panel opens
- [ ] Structure displayed
- [ ] No errors

---

## 14. Delete Node

### Scenario: User wants to delete a node

**Setup:**
- Canvas state: One story node
- Active context: None
- User message: "Delete this node"

**Expected Behavior:**
1. Intent detected: `delete_node`
2. Node identified
3. Confirmation prompt (if implemented)
4. Node deleted from canvas

**How to Test:**
1. Create a story node
2. Type "Delete this node"
3. Verify deletion

**Pass Criteria:**
- [ ] Intent: `delete_node`
- [ ] Node identified
- [ ] Node removed from canvas
- [ ] No errors

---

## 15. Edge Case - Empty Message

### Scenario: User sends empty message

**Setup:**
- Canvas state: Any
- Active context: Any
- User message: "" (empty)

**Expected Behavior:**
1. Validation error or request for input
2. No crash
3. Helpful message

**How to Test:**
1. Submit empty message
2. Verify graceful handling

**Pass Criteria:**
- [ ] No crash
- [ ] Helpful error message
- [ ] No state corruption

---

## 16. Edge Case - Ambiguous Intent

### Scenario: User message is unclear

**Setup:**
- Canvas state: Multiple nodes
- Active context: None
- User message: "Do something"

**Expected Behavior:**
1. Intent: `request_clarification`
2. Orchestrator asks for clarification
3. No actions executed

**How to Test:**
1. Type "Do something"
2. Verify clarification request

**Pass Criteria:**
- [ ] Intent: `request_clarification`
- [ ] Clarification message shown
- [ ] No unintended actions
- [ ] No errors

---

## 17. Edge Case - No Structure Items

### Scenario: Write content requested but no structure

**Setup:**
- Canvas state: Empty or node without structure
- Active context: None
- User message: "Write Chapter 1"

**Expected Behavior:**
1. Intent detected: `write_content`
2. Error: No structure available
3. Suggests creating structure first

**How to Test:**
1. Clear canvas or create empty node
2. Type "Write Chapter 1"
3. Verify error message

**Pass Criteria:**
- [ ] Intent: `write_content`
- [ ] Error message shown
- [ ] Suggests next steps
- [ ] No crash

---

## Test Execution Checklist

### For Each Scenario:

- [ ] **Intent Detection**
  - Correct intent identified
  - Confidence score > 0.7
  - Reasoning makes sense

- [ ] **Action Generation**
  - Correct action type
  - Payload has all required fields
  - No missing data

- [ ] **Console Logs**
  - No errors
  - Debug logs are helpful
  - Performance is acceptable

- [ ] **UI Updates**
  - Changes reflected immediately
  - No flickering or glitches
  - Loading states shown

- [ ] **State Management**
  - Blackboard updated correctly
  - WorldState consistent
  - No memory leaks

- [ ] **Error Handling**
  - Graceful degradation
  - Helpful error messages
  - No crashes

---

## Regression Test Suite

**Run after each refactoring step:**

### Quick Smoke Test (5 minutes)
1. Answer question (empty canvas)
2. Create novel structure
3. Write Chapter 1
4. Verify no console errors

### Full Test Suite (30 minutes)
- Run all 17 scenarios
- Check all pass criteria
- Document any failures
- Fix before proceeding

### Performance Benchmarks
- Intent analysis: < 2s
- Structure generation: < 30s
- Content generation: < 15s per section
- No memory leaks after 10 operations

---

## Test Results Template

```markdown
## Test Run: [Date]

**Branch:** refactor/orchestrator-modular
**Commit:** [hash]
**Tester:** [name]

### Results Summary
- Total scenarios: 17
- Passed: X
- Failed: X
- Skipped: X

### Failed Scenarios
1. [Scenario name]
   - Expected: [behavior]
   - Actual: [behavior]
   - Error: [message]
   - Fix: [action taken]

### Performance
- Avg intent analysis: Xs
- Avg structure gen: Xs
- Avg content gen: Xs

### Notes
[Any observations or concerns]
```

---

## Next Steps

After Phase 0 completion:
1. Use these scenarios to test Phase 1 extraction
2. Add new scenarios for each extracted action
3. Automate tests where possible
4. Keep documentation updated

