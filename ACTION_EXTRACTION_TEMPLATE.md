# Action Extraction Template

**Purpose:** Step-by-step template for extracting actions from orchestratorEngine.ts  
**Usage:** Follow this template when extracting each action  
**Date:** 2025-11-27

---

## Overview

This template provides a systematic approach to extracting action generation logic from the monolithic `orchestratorEngine.ts` into modular, testable action classes.

---

## Prerequisites

Before extracting any action:

- [ ] Phase 0 documentation complete
- [ ] Test scenarios documented
- [ ] Rollback plan ready
- [ ] Safety branch created (`refactor/orchestrator-modular`)
- [ ] Build passes (`npm run build`)

---

## Step 1: Create BaseAction Class

**File:** `frontend/src/lib/orchestrator/actions/base/BaseAction.ts`

**Purpose:** Abstract base class that all actions extend

```typescript
/**
 * Base class for all action generators
 * 
 * Responsibilities:
 * - Define common interface for action generation
 * - Provide utility methods for success/error responses
 * - Enforce consistent structure across all actions
 * 
 * Usage:
 * ```typescript
 * export class MyAction extends BaseAction {
 *   get actionType() { return 'my_action_type' }
 *   async generate(intent, request, context) {
 *     // Implementation
 *     return [this.success(payload)]
 *   }
 * }
 * ```
 */

import type { IntentAnalysis } from '../../intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../core/orchestratorEngine'
import type { CanvasContext } from '../core/contextProvider'

export abstract class BaseAction {
  /**
   * Generate actions based on intent
   * 
   * This is the main method that each action must implement.
   * It receives the analyzed intent, original request, and canvas context,
   * and returns an array of actions to execute.
   * 
   * @param intent - Analyzed user intent from LLM
   * @param request - Original orchestrator request with message and state
   * @param context - Canvas context (nodes, edges, selected items)
   * @param additionalContext - Optional additional context (RAG, model selection, etc.)
   * @returns Array of actions to execute
   */
  abstract generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext,
    additionalContext?: {
      ragContext?: any
      modelSelection?: any
      availableModels?: any[]
    }
  ): Promise<OrchestratorAction[]>
  
  /**
   * Action type identifier
   * 
   * This should match the action type used in the orchestrator response.
   * Examples: 'generate_content', 'generate_structure', 'open_document'
   */
  abstract get actionType(): string
  
  /**
   * Create a success action
   * 
   * Helper method to create an action with 'completed' status.
   * Use this when the action can be executed immediately.
   * 
   * @param payload - Action payload data
   * @returns OrchestratorAction with completed status
   */
  protected success(payload: any): OrchestratorAction {
    return {
      type: this.actionType,
      status: 'completed',
      payload
    }
  }
  
  /**
   * Create a pending action
   * 
   * Helper method to create an action with 'pending' status.
   * Use this when the action needs to be executed later (e.g., by agents).
   * 
   * @param payload - Action payload data
   * @returns OrchestratorAction with pending status
   */
  protected pending(payload: any): OrchestratorAction {
    return {
      type: this.actionType,
      status: 'pending',
      payload
    }
  }
  
  /**
   * Create an error action
   * 
   * Helper method to create an action with 'error' status.
   * Use this when validation fails or an error occurs.
   * 
   * @param message - Error message to display
   * @returns OrchestratorAction with error status
   */
  protected error(message: string): OrchestratorAction {
    return {
      type: this.actionType,
      status: 'error',
      payload: { error: message }
    }
  }
  
  /**
   * Create a message action
   * 
   * Helper method to create a message action for user communication.
   * Use this for clarifications, confirmations, or informational messages.
   * 
   * @param content - Message content
   * @param type - Message type (result, error, etc.)
   * @returns OrchestratorAction with message
   */
  protected message(content: string, type: 'result' | 'error' | 'info' = 'result'): OrchestratorAction {
    return {
      type: 'message',
      status: 'completed',
      payload: {
        type,
        content
      }
    }
  }
}
```

---

## Step 2: Extract Specific Action

### Template for Action File

**File:** `frontend/src/lib/orchestrator/actions/[category]/[ActionName]Action.ts`

**Categories:**
- `content/` - Content-related actions (answer, write)
- `structure/` - Structure-related actions (create, modify)
- `navigation/` - Navigation actions (open, select, delete)

**Example:** `frontend/src/lib/orchestrator/actions/content/AnswerQuestionAction.ts`

```typescript
/**
 * [Action Name] Action
 * 
 * Purpose: [Brief description of what this action does]
 * 
 * Flow:
 * 1. [Step 1]
 * 2. [Step 2]
 * 3. [Step 3]
 * 
 * Dependencies:
 * - [Dependency 1]: [Why needed]
 * - [Dependency 2]: [Why needed]
 * 
 * Source: orchestratorEngine.ts lines [start-end]
 * 
 * Example Usage:
 * ```typescript
 * const action = new [ActionName]Action()
 * const result = await action.generate(intent, request, context)
 * ```
 */

import { BaseAction } from '../base/BaseAction'
import type { IntentAnalysis } from '../../intentRouter'
import type { OrchestratorRequest, OrchestratorAction } from '../../core/orchestratorEngine'
import type { CanvasContext } from '../../core/contextProvider'

export class [ActionName]Action extends BaseAction {
  /**
   * Action type identifier
   */
  get actionType(): string {
    return '[action_type]'  // e.g., 'generate_content', 'open_document'
  }
  
  /**
   * Generate actions for [intent name] intent
   * 
   * [Detailed description of what this method does]
   * 
   * @param intent - Analyzed intent from LLM
   * @param request - Original request with message and state
   * @param context - Canvas context (nodes, edges)
   * @param additionalContext - Optional RAG, model selection, etc.
   * @returns Array of actions to execute
   */
  async generate(
    intent: IntentAnalysis,
    request: OrchestratorRequest,
    context: CanvasContext,
    additionalContext?: {
      ragContext?: any
      modelSelection?: any
      availableModels?: any[]
    }
  ): Promise<OrchestratorAction[]> {
    console.log(`🎯 [${this.constructor.name}] Generating actions`)
    
    // ============================================================
    // STEP 1: [Description]
    // ============================================================
    
    // [Copy logic from orchestratorEngine.ts]
    // [Add detailed inline comments]
    
    // Example:
    // Extract model selection from additional context
    const modelSelection = additionalContext?.modelSelection
    if (!modelSelection) {
      return [this.error('Model selection required')]
    }
    
    // ============================================================
    // STEP 2: [Description]
    // ============================================================
    
    // [More logic with comments]
    
    // ============================================================
    // STEP 3: [Description]
    // ============================================================
    
    // [Final logic]
    
    // Return action(s)
    return [
      this.success({
        // payload fields
      })
    ]
  }
  
  /**
   * Helper method: [Description]
   * 
   * [What this helper does]
   * 
   * @param param1 - [Description]
   * @returns [Description]
   */
  private helperMethod(param1: any): any {
    // Helper logic
  }
}
```

---

## Step 3: Update orchestratorEngine.ts

### 3.1: Add Import

At the top of `orchestratorEngine.ts`:

```typescript
// Action generators (Phase 1: Modular refactoring)
import { AnswerQuestionAction } from '../actions/content/AnswerQuestionAction'
// ... other actions as they're extracted
```

### 3.2: Initialize Action Generators

In the constructor:

```typescript
export class OrchestratorEngine {
  // ... existing properties ...
  
  // NEW: Action generators map
  private actionGenerators: Map<UserIntent, BaseAction>
  
  constructor(config: OrchestratorConfig, worldState?: WorldStateManager) {
    // ... existing initialization ...
    
    // Initialize action generators
    this.actionGenerators = new Map([
      ['answer_question', new AnswerQuestionAction()],
      // ... other actions as they're extracted
    ])
  }
}
```

### 3.3: Update generateActions Method

Replace the switch case with action generator lookup:

```typescript
private async generateActions(
  intent: IntentAnalysis,
  request: OrchestratorRequest,
  canvasContext: CanvasContext,
  ragContext: any,
  modelSelection: any,
  validatedFixedModelId: string | null = null,
  availableModels?: TieredModel[]
): Promise<OrchestratorAction[]> {
  const actions: OrchestratorAction[] = []
  
  // NEW: Try action generator first
  const generator = this.actionGenerators.get(intent.intent)
  if (generator) {
    console.log(`✅ Using modular action generator for: ${intent.intent}`)
    return generator.generate(intent, request, canvasContext, {
      ragContext,
      modelSelection,
      availableModels
    })
  }
  
  // FALLBACK: Existing switch statement (for not-yet-extracted actions)
  switch (intent.intent) {
    // Remove extracted case
    // case 'answer_question': {
    //   // OLD CODE - now in AnswerQuestionAction
    //   break
    // }
    
    // Keep remaining cases
    case 'write_content': {
      // ... existing logic ...
      break
    }
    
    // ... other cases ...
  }
  
  return actions
}
```

---

## Step 4: Test the Extraction

### 4.1: Build Test

```bash
cd /Users/palmac/Aiakaki/Code/publo/frontend
npm run build
```

**Expected:** ✅ Build completes successfully

### 4.2: Type Check

```bash
npx tsc --noEmit
```

**Expected:** ✅ No type errors

### 4.3: Functional Test

Run test scenarios from ORCHESTRATOR_TEST_SCENARIOS.md:

For AnswerQuestionAction:
- [ ] Test 1: Empty canvas + "What is this app?"
- [ ] Test 2: Single story + "Tell me about this story"
- [ ] Test 3: Multiple nodes + "Compare these stories"

**Expected:**
- [ ] Intent detected correctly
- [ ] Actions generated match original behavior
- [ ] No console errors
- [ ] UI updates correctly

### 4.4: Console Verification

Check for the new log message:

```
✅ Using modular action generator for: answer_question
```

---

## Step 5: Commit the Extraction

### 5.1: Review Changes

```bash
git status
git diff
```

### 5.2: Commit

```bash
git add -A
git commit -m "refactor: Extract AnswerQuestionAction (1/8)

- Created BaseAction abstract class
- Extracted answer_question logic from orchestratorEngine.ts (lines 691-738)
- Updated orchestratorEngine to use action generator
- All tests pass, no behavior changes

Source: orchestratorEngine.ts lines 691-738
Target: actions/content/AnswerQuestionAction.ts
Lines reduced: 47 lines extracted"
```

### 5.3: Push

```bash
git push origin refactor/orchestrator-modular
```

---

## Extraction Checklist

For each action extraction:

### Planning
- [ ] Identify action in orchestratorEngine.ts
- [ ] Note line numbers (start-end)
- [ ] List dependencies (context, RAG, model, etc.)
- [ ] Identify test scenarios

### Implementation
- [ ] Create action file in correct category
- [ ] Copy logic from orchestratorEngine.ts
- [ ] Add detailed inline comments
- [ ] Implement helper methods if needed
- [ ] Update imports in orchestratorEngine.ts
- [ ] Add to actionGenerators map
- [ ] Remove from switch statement (or comment out)

### Testing
- [ ] Build passes
- [ ] Type check passes
- [ ] Linter passes
- [ ] Functional tests pass
- [ ] Console logs show modular generator used
- [ ] No behavior changes

### Documentation
- [ ] File has comprehensive doc comments
- [ ] Each method documented
- [ ] Dependencies listed
- [ ] Source lines noted
- [ ] Example usage provided

### Commit
- [ ] Descriptive commit message
- [ ] Note lines extracted
- [ ] Note source and target
- [ ] Pushed to remote

---

## Action Extraction Order

Extract in order of complexity (simplest first):

### Phase 1A: Simple Actions (No Dependencies)

1. **AnswerQuestionAction** (47 lines)
   - Source: Lines 691-738
   - Dependencies: canvasContext, ragContext, modelSelection
   - Complexity: LOW

2. **DeleteNodeAction** (30 lines)
   - Source: Lines 1755-1785
   - Dependencies: canvasContext
   - Complexity: LOW

3. **OpenDocumentAction** (40 lines)
   - Source: Lines ~1750-1790
   - Dependencies: canvasContext
   - Complexity: LOW

### Phase 1B: Medium Actions

4. **NavigateSectionAction** (50 lines)
   - Source: Lines ~1800-1850
   - Dependencies: request.structureItems
   - Complexity: MEDIUM

5. **WriteContentAction** (400 lines)
   - Source: Lines 741-1140
   - Dependencies: structureItems, activeContext, complex section detection
   - Complexity: MEDIUM-HIGH

### Phase 1C: Complex Actions

6. **CreateStructureAction** (600 lines)
   - Source: Lines 1142-1750
   - Dependencies: format validation, createStructurePlan(), task complexity analysis
   - Complexity: HIGH

7. **ModifyStructureAction** (if exists)
   - Source: TBD
   - Complexity: MEDIUM

8. **ClarificationAction** (if exists)
   - Source: TBD
   - Complexity: MEDIUM

---

## Common Patterns

### Pattern 1: Validation

```typescript
// Validate required data
if (!request.structureItems || request.structureItems.length === 0) {
  return [this.error('No structure available. Please create a document first.')]
}
```

### Pattern 2: Context Building

```typescript
// Build enhanced prompt with context
let enhancedPrompt = `User Question: ${request.message}\n\n`

if (context.connectedNodes.length > 0) {
  enhancedPrompt += `Available Context:\n`
  context.connectedNodes.forEach(node => {
    enhancedPrompt += `- ${node.label}: ${node.summary}\n`
  })
}
```

### Pattern 3: Multiple Actions

```typescript
// Return multiple actions
const actions: OrchestratorAction[] = []

actions.push(this.success({
  // First action
}))

actions.push(this.pending({
  // Second action
}))

return actions
```

### Pattern 4: Error Handling

```typescript
try {
  // Action logic
  return [this.success(payload)]
} catch (error) {
  console.error(`❌ [${this.constructor.name}] Error:`, error)
  return [this.error(`Failed to generate action: ${error.message}`)]
}
```

---

## Troubleshooting

### Issue: Import errors after extraction

**Solution:** Check import paths are correct
```typescript
// Correct
import { BaseAction } from '../base/BaseAction'

// Wrong
import { BaseAction } from './base/BaseAction'
```

### Issue: Action not being used

**Solution:** Verify it's registered in actionGenerators map
```typescript
this.actionGenerators = new Map([
  ['answer_question', new AnswerQuestionAction()],  // ✅
])
```

### Issue: Different behavior than original

**Solution:** Compare logic line-by-line with original
```bash
# View original logic
git show HEAD:frontend/src/lib/orchestrator/core/orchestratorEngine.ts | sed -n '691,738p'
```

---

## Success Criteria

Extraction is successful when:

- [ ] Build passes
- [ ] All tests pass
- [ ] Behavior unchanged
- [ ] Code is well-documented
- [ ] Console shows "Using modular action generator"
- [ ] Committed and pushed
- [ ] orchestratorEngine.ts is smaller

---

## Next Action

After completing one action extraction:

1. Update this template if you learned something
2. Document any issues encountered
3. Proceed to next action in extraction order
4. Take breaks between extractions
5. Celebrate progress! 🎉

---

## References

- ORCHESTRATOR_CURRENT_BEHAVIOR.md - Original behavior
- ORCHESTRATOR_TEST_SCENARIOS.md - Test scenarios
- ORCHESTRATOR_ARCHITECTURE_CURRENT.md - Target architecture
- REFACTORING_ROLLBACK_PLAN.md - Rollback procedures

