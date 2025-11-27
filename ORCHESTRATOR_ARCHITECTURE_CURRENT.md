# Orchestrator Architecture - Current State & Future Vision

**Date:** 2025-11-27  
**Purpose:** Document current architecture and plan for modular refactoring  
**Status:** Phase 0 - Preparation

---

## Current Architecture

### File Structure

```
frontend/src/lib/orchestrator/
├── core/
│   ├── orchestratorEngine.ts      (3214 lines) ⚠️ TOO LARGE
│   ├── blackboard.ts               (530 lines)
│   ├── worldState.ts               (530 lines)
│   └── contextProvider.ts          (200 lines)
├── agents/
│   ├── MultiAgentOrchestrator.ts  (910 lines)
│   ├── WriterAgent.ts             (354 lines)
│   ├── CriticAgent.ts             (330 lines)
│   ├── AgentRegistry.ts           (294 lines)
│   ├── DAGExecutor.ts             (373 lines)
│   ├── ExecutionTracer.ts         (330 lines)
│   ├── types.ts                   (280 lines)
│   ├── clusters/
│   │   └── WriterCriticCluster.ts (300 lines)
│   └── utils/
│       └── contentPersistence.ts  (284 lines)
├── tools/
│   ├── ToolRegistry.ts            (150 lines)
│   ├── BaseTool.ts                (100 lines)
│   ├── writeContentTool.ts        (317 lines)
│   ├── createStructureTool.ts     (120 lines)
│   ├── answerQuestionTool.ts      (80 lines)
│   ├── openDocumentTool.ts        (70 lines)
│   ├── selectSectionTool.ts       (66 lines)
│   ├── deleteNodeTool.ts          (60 lines)
│   ├── messageTool.ts             (50 lines)
│   ├── saveTool.ts                (150 lines)
│   └── types.ts                   (200 lines)
├── intentRouter.ts                (200 lines)
├── llmIntentAnalyzer.ts           (300 lines)
├── modelRouter.ts                 (250 lines)
└── ragIntegration.ts              (150 lines)
```

**Total Lines:** ~10,000+ lines across all files

---

## orchestratorEngine.ts Breakdown

### Current Structure (3214 lines)

```
orchestratorEngine.ts
├── Imports & Types (1-100)
│   ├── External dependencies
│   ├── Type definitions
│   └── Interface declarations
│
├── OrchestratorConfig Interface (41-60)
│   ├── userId: string
│   ├── modelPriority?: ModelPriority
│   ├── enableRAG?: boolean
│   ├── enablePatternLearning?: boolean
│   ├── toolRegistry?: ToolRegistry
│   ├── onMessage?: callback
│   └── Phase 1-3 integrations
│
├── OrchestratorRequest Interface (62-80)
│   ├── message: string
│   ├── canvasNodes: Node[]
│   ├── canvasEdges: Edge[]
│   ├── activeContext?: object
│   ├── structureItems?: array
│   ├── contentMap?: Map
│   ├── currentStoryStructureNodeId?: string
│   ├── documentFormat?: StoryFormat
│   └── Model selection params
│
├── OrchestratorResponse Interface (82-95)
│   ├── intent: UserIntent
│   ├── confidence: number
│   ├── reasoning: string
│   ├── modelUsed: string
│   ├── actions: OrchestratorAction[]
│   ├── canvasChanged: boolean
│   ├── requiresUserInput: boolean
│   ├── estimatedCost: number
│   └── thinkingSteps: object[]
│
├── OrchestratorAction Interface (97-110)
│   ├── type: string
│   ├── payload: any
│   └── status: string
│
├── Constructor (150-250)
│   ├── Initialize config
│   ├── Create blackboard
│   ├── Setup tool registry
│   ├── Setup world state
│   └── Initialize agent pool
│
├── Public Methods (250-500)
│   ├── orchestrate() (250-443)
│   │   ├── Build canvas context
│   │   ├── Analyze intent
│   │   ├── Select model
│   │   ├── Generate actions
│   │   ├── Execute tools
│   │   ├── Update blackboard
│   │   └── Return response
│   ├── resolveNodeReference() (448-453)
│   ├── getBlackboard() (458-460)
│   ├── createSnapshot() (465-467)
│   └── reset() (472-475)
│
├── Tool Execution (Phase 2) (480-670)
│   ├── executeToolsIfAvailable()
│   ├── Tool routing logic
│   └── WorldState updates
│
├── Action Generation (679-1800)  ⚠️ MASSIVE SWITCH
│   ├── generateActions() method
│   ├── switch (intent.intent)
│   │   ├── case 'answer_question' (691-738)
│   │   │   ├── Build enhanced prompt
│   │   │   ├── Include canvas context
│   │   │   ├── Add RAG content
│   │   │   └── Return generate_content action
│   │   │
│   │   ├── case 'write_content' (741-1140)
│   │   │   ├── Detect target section
│   │   │   │   ├── Numeric pattern (Chapter 1)
│   │   │   │   ├── Ordinal pattern (first chapter)
│   │   │   │   └── Name-based (prologue)
│   │   │   ├── Validate section exists
│   │   │   ├── Check for existing content
│   │   │   └── Return generate_content action
│   │   │
│   │   ├── case 'create_structure' (1142-1750)
│   │   │   ├── Validate format
│   │   │   ├── Check format conventions
│   │   │   ├── Call createStructurePlan()
│   │   │   ├── Analyze task complexity
│   │   │   ├── Generate structure action
│   │   │   └── Generate content actions (if requested)
│   │   │
│   │   ├── case 'open_document' (~1750-1800)
│   │   │   ├── Find node by name/ID
│   │   │   ├── Fuzzy matching
│   │   │   └── Return open_document action
│   │   │
│   │   ├── case 'delete_node' (1755+)
│   │   │   ├── Detect node from message
│   │   │   └── Return delete_node action
│   │   │
│   │   ├── case 'navigate_section'
│   │   │   └── Return navigation action
│   │   │
│   │   ├── case 'modify_structure'
│   │   │   └── Return modification action
│   │   │
│   │   └── default
│   │       └── Return message action
│   │
│   └── Helper methods for section detection
│
├── Structure Generation (2100-2500)
│   ├── createStructurePlan()
│   │   ├── Select model for complexity
│   │   ├── Get format-specific prompt
│   │   ├── Call LLM with structured output
│   │   ├── Parse and validate structure
│   │   └── Return StructurePlan
│   │
│   ├── validateFormatConventions()
│   │   ├── Check format alignment
│   │   └── Return educational message
│   │
│   └── Structure validation helpers
│
├── Task Complexity Analysis (2500-2700)
│   ├── analyzeTaskComplexity()
│   │   ├── Build LLM prompt
│   │   ├── Ask about multi-step intent
│   │   ├── Parse structured response
│   │   └── Return analysis
│   │
│   └── Section parsing helpers
│
├── Pattern Learning (2700-2900)
│   ├── extractPattern()
│   ├── Pattern matching logic
│   └── Pattern storage
│
├── Multi-Agent Integration (Phase 3) (2900-3100)
│   ├── getMultiAgentOrchestrator()
│   ├── Agent pool management
│   └── Strategy selection
│
└── Utility Functions (3100-3214)
    ├── Helper methods
    ├── Type guards
    └── Formatters
```

---

## Data Flow

### Current Flow (Monolithic)

```
User Message
    ↓
orchestrate(request)
    ↓
┌─────────────────────────────────────┐
│   orchestratorEngine.ts (3214 lines) │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 1. Build Canvas Context     │   │
│   │    (contextProvider)        │   │
│   └─────────────────────────────┘   │
│               ↓                     │
│   ┌─────────────────────────────┐   │
│   │ 2. Analyze Intent           │   │
│   │    (intentRouter)           │   │
│   └─────────────────────────────┘   │
│               ↓                     │
│   ┌─────────────────────────────┐   │
│   │ 3. Select Model             │   │
│   │    (modelRouter)            │   │
│   └─────────────────────────────┘   │
│               ↓                     │
│   ┌─────────────────────────────┐   │
│   │ 4. Generate Actions         │   │
│   │    (MASSIVE SWITCH)         │   │
│   │    - 1100+ lines            │   │
│   │    - 8 intent cases         │   │
│   │    - Mixed concerns         │   │
│   └─────────────────────────────┘   │
│               ↓                     │
│   ┌─────────────────────────────┐   │
│   │ 5. Execute Tools (Phase 2)  │   │
│   └─────────────────────────────┘   │
│               ↓                     │
│   ┌─────────────────────────────┐   │
│   │ 6. Update Blackboard        │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
    ↓
Return OrchestratorResponse
```

---

## Problems with Current Architecture

### 1. Monolithic File (3214 lines)

**Issues:**
- Hard to navigate in IDE
- Slow to load and parse
- Difficult to understand data flow
- Merge conflicts when multiple developers work on it

**Impact:**
- Development velocity slows
- Bugs harder to find
- New features take longer to implement

---

### 2. Massive Switch Statement (1100+ lines)

**Issues:**
- All action generation logic in one method
- Cannot test individual actions in isolation
- Adding new intent requires modifying large switch
- Deep nesting makes logic hard to follow

**Example:**
```typescript
switch (intent.intent) {
  case 'answer_question': {
    // 47 lines of logic
    break
  }
  case 'write_content': {
    // 400+ lines of logic
    // Nested if-else chains
    // Section detection patterns
    // Validation logic
    break
  }
  case 'create_structure': {
    // 600+ lines of logic
    // Format validation
    // Structure generation
    // Task complexity analysis
    break
  }
  // ... 5 more cases
}
```

**Impact:**
- Cannot unit test individual actions
- Cannot reuse action logic
- Hard to extend with new intents

---

### 3. Mixed Concerns

**Issues:**
- Intent analysis + action generation + structure creation all in one file
- Violates Single Responsibility Principle
- Each concern has different dependencies
- Cannot swap implementations

**Concerns Mixed:**
1. **Orchestration** - Coordinating the flow
2. **Intent Analysis** - Understanding user request
3. **Action Generation** - Creating action objects
4. **Structure Generation** - LLM-based structure creation
5. **Section Detection** - Parsing section references
6. **Format Validation** - Checking format conventions
7. **Pattern Learning** - Extracting patterns
8. **Tool Execution** - Executing tools (Phase 2)
9. **Agent Coordination** - Managing agents (Phase 3)

**Impact:**
- Changes to one concern affect others
- Cannot test concerns independently
- Hard to understand what each part does

---

### 4. Hard to Test

**Issues:**
- Cannot test action generation without full orchestrator
- Cannot mock dependencies easily
- Integration tests only (no unit tests)
- Slow test execution

**Current Testing:**
- Manual testing in UI
- No automated tests for individual actions
- No regression test suite

**Impact:**
- Bugs slip through
- Refactoring is risky
- Confidence in changes is low

---

### 5. Hard to Extend

**Issues:**
- Adding new intent requires:
  1. Modifying large switch statement
  2. Understanding all existing cases
  3. Ensuring no side effects
  4. Testing entire orchestrator

**Example: Adding "rename_section" intent:**
```typescript
// Must modify orchestratorEngine.ts
switch (intent.intent) {
  // ... existing 8 cases ...
  case 'rename_section': {  // NEW
    // 50+ lines of logic here
    // Mixed with 1100+ existing lines
    break
  }
}
```

**Impact:**
- Feature development is slow
- Risk of breaking existing functionality
- Developers avoid adding new intents

---

## Target Architecture (Future)

### Modular Structure

Aligned with VERCEL_DEPLOYMENT_GUIDE.md (lines 405-449):

```
frontend/src/lib/orchestrator/
├── core/                           # Core orchestration (< 500 lines each)
│   ├── OrchestratorEngine.ts      (300 lines) - Main coordinator
│   ├── IntentAnalyzer.ts          (200 lines) - Intent detection
│   ├── ContextResolver.ts         (150 lines) - Canvas context building
│   └── ModelSelector.ts           (200 lines) - Model selection
│
├── actions/                        # Action handlers (< 400 lines each)
│   ├── base/
│   │   └── BaseAction.ts          - Abstract base class
│   ├── content/
│   │   ├── AnswerQuestionAction.ts (150 lines)
│   │   └── WriteContentAction.ts   (300 lines)
│   ├── structure/
│   │   ├── CreateStructureAction.ts (400 lines)
│   │   └── ModifyStructureAction.ts (future)
│   └── navigation/
│       ├── OpenDocumentAction.ts   (150 lines)
│       └── DeleteNodeAction.ts     (100 lines)
│
├── clarification/                  # Clarification handling
│   ├── ClarificationHandler.ts    (200 lines)
│   └── ResponseParser.ts          (150 lines)
│
├── structure/                      # Structure generation
│   ├── StructurePlanGenerator.ts  (300 lines)
│   ├── StructureValidator.ts      (150 lines)
│   └── FormatInstructions.ts      (200 lines)
│
├── agents/                         # Agent implementations (existing)
│   └── ... (no changes)
│
└── tools/                          # Executable tools (existing)
    └── ... (no changes)
```

---

### Future Data Flow (Modular)

```
User Message
    ↓
OrchestratorEngine.orchestrate()
    ↓
┌─────────────────────────────────────┐
│   OrchestratorEngine (300 lines)    │
│   - Coordinator only                │
│   - No business logic               │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│   IntentAnalyzer.analyze()          │
│   - Intent detection only           │
│   - 200 lines                       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│   ModelSelector.select()            │
│   - Model selection only            │
│   - 200 lines                       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│   ActionGenerator.generate()        │
│   - Routes to specific action       │
│   - 50 lines                        │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│   [Specific Action].generate()      │
│   - AnswerQuestionAction            │
│   - WriteContentAction              │
│   - CreateStructureAction           │
│   - etc.                            │
│   - Each < 400 lines                │
└─────────────────────────────────────┘
    ↓
Return OrchestratorResponse
```

---

## Benefits of Modular Architecture

### 1. Maintainability

**Before:**
- 3214 lines in one file
- Hard to find specific logic
- Slow IDE performance

**After:**
- Files < 400 lines each
- Clear file names indicate purpose
- Fast IDE navigation

**Example:**
```
Need to fix "Write Chapter 1" logic?
Before: Search through 3214 lines
After: Open WriteContentAction.ts (300 lines)
```

---

### 2. Testability

**Before:**
- Integration tests only
- Cannot test actions in isolation
- Slow test execution

**After:**
- Unit tests for each action
- Mock dependencies easily
- Fast test execution

**Example:**
```typescript
// Test WriteContentAction in isolation
describe('WriteContentAction', () => {
  it('detects numeric section references', () => {
    const action = new WriteContentAction()
    const result = action.generate(
      { intent: 'write_content' },
      { message: 'Write Chapter 1' },
      mockContext
    )
    expect(result[0].payload.sectionId).toBe('chapter-1')
  })
})
```

---

### 3. Performance

**Before:**
- Large file loads slowly
- All code loaded even if not needed
- No tree-shaking

**After:**
- Small files load quickly
- Dynamic imports possible
- Better tree-shaking in production

**Bundle Size Impact:**
```
Before: ~500KB orchestrator bundle
After: ~300KB (40% reduction via tree-shaking)
```

---

### 4. Collaboration

**Before:**
- Merge conflicts common
- Only one developer can work on orchestrator
- Changes affect everyone

**After:**
- Multiple developers can work on different actions
- Fewer merge conflicts
- Clear ownership of files

**Example:**
```
Developer A: Works on WriteContentAction.ts
Developer B: Works on CreateStructureAction.ts
No conflicts!
```

---

### 5. Extensibility

**Before:**
- Adding new intent = modifying 3214 line file
- Risk of breaking existing functionality
- Requires understanding entire codebase

**After:**
- Adding new intent = creating new action file
- No risk to existing actions
- Only need to understand BaseAction interface

**Example:**
```typescript
// New action in separate file
export class RenameSection extends BaseAction {
  async generate(intent, request, context) {
    // 50 lines of logic
    // Isolated from other actions
  }
}

// Register in OrchestratorEngine
this.actions.set('rename_section', new RenameSectionAction())
```

---

## Migration Strategy

### Phase 1: Extract Actions (Low Risk)

**Goal:** Move action generation logic into separate files

**Steps:**
1. Create `BaseAction` abstract class
2. Extract `AnswerQuestionAction` (simplest, no dependencies)
3. Update `orchestratorEngine.ts` to use action generator
4. Test thoroughly
5. Repeat for remaining actions

**Risk:** LOW - No external API changes

---

### Phase 2: Extract Intent Analysis (Medium Risk)

**Goal:** Move intent analysis into separate module

**Steps:**
1. Create `IntentAnalyzer` class
2. Move `analyzeIntent()` logic
3. Update `orchestratorEngine.ts` to use analyzer
4. Test thoroughly

**Risk:** MEDIUM - Changes how intent is detected

---

### Phase 3: Extract Structure Generation (High Risk)

**Goal:** Move structure generation into separate module

**Steps:**
1. Create `StructurePlanGenerator` class
2. Move `createStructurePlan()` logic
3. Update `CreateStructureAction` to use generator
4. Test thoroughly

**Risk:** HIGH - Complex logic with LLM calls

---

### Phase 4: Refactor OrchestratorEngine (Final)

**Goal:** Reduce orchestratorEngine.ts to ~300 lines (coordinator only)

**Steps:**
1. Remove all extracted logic
2. Keep only orchestration flow
3. Update imports
4. Test entire system

**Risk:** MEDIUM - Changes core file structure

---

## Success Metrics

### Code Quality
- [ ] No file > 500 lines
- [ ] Each action < 400 lines
- [ ] Clear separation of concerns
- [ ] 100% TypeScript strict mode

### Testing
- [ ] Unit tests for each action
- [ ] 80%+ code coverage
- [ ] All test scenarios pass
- [ ] No regression bugs

### Performance
- [ ] Bundle size reduced by 30%+
- [ ] IDE loads faster
- [ ] Build time unchanged or faster

### Developer Experience
- [ ] Easy to find specific logic
- [ ] Easy to add new intents
- [ ] Clear documentation
- [ ] Fewer merge conflicts

---

## Timeline Estimate

| Phase | Time Estimate | Risk Level |
|-------|---------------|------------|
| Phase 0: Preparation | 2-3 hours | None |
| Phase 1: Extract actions (8 actions) | 12-16 hours | Low |
| Phase 2: Extract intent analysis | 2-3 hours | Medium |
| Phase 3: Extract structure gen | 3-4 hours | High |
| Phase 4: Final refactor | 2-3 hours | Medium |
| **Total** | **21-29 hours** | Gradual |

---

## Next Steps

1. ✅ Complete Phase 0 documentation
2. Create test scenarios (ORCHESTRATOR_TEST_SCENARIOS.md)
3. Create rollback plan (REFACTORING_ROLLBACK_PLAN.md)
4. Create extraction template (ACTION_EXTRACTION_TEMPLATE.md)
5. Begin Phase 1: Extract AnswerQuestionAction

---

## References

- VERCEL_DEPLOYMENT_GUIDE.md (lines 405-449) - Target structure
- ORCHESTRATOR_CURRENT_BEHAVIOR.md - Current behavior documentation
- ORCHESTRATOR_TEST_SCENARIOS.md - Test scenarios
- PHASE3_COMPLETE.md - Multi-agent coordination context

