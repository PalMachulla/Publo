# 🎯 Orchestrator Refactor Plan: From Pipeline to Agent

## 📊 Status: Phase 1 - In Progress

**Last Updated:** 2025-11-25

---

## 🎯 Vision

Transform the orchestrator from a **pipeline architecture** (plan → delegate to UI) into a **true agent architecture** (understand → reason → execute → learn).

### Current Architecture (Pipeline):
```
User → Intent Analysis → Context Gathering → Action Planning → UI Execution
         ✅ LLM            ⚠️ Scattered         ⚠️ JSON           ❌ External
```

### Target Architecture (Agent):
```
User → Agent.act()
         ├─ 1. Understand (Intent + Entity Extraction)  ✅ DONE
         ├─ 2. Perceive (Unified WorldState)            🚧 IN PROGRESS
         ├─ 3. Reason (LLM Planning with Tools)         📋 TODO
         ├─ 4. Execute (Direct Tool Invocation)         📋 TODO
         └─ 5. Learn (Update WorldState + Memory)       📋 TODO
```

---

## 📐 Three Pillars Assessment

| Pillar | Status | Score | Current State |
|--------|--------|-------|--------------|
| **1. Intent Understanding** | ✅ Strong | 8/10 | LLM-based, context-aware, extracts entities |
| **2. Context Understanding** | ⚠️ Fragmented | 6/10 | Data exists but scattered across 15+ props |
| **3. Action Execution** | ⚠️ Planning only | 5/10 | Plans actions but doesn't execute—UI does |

**Overall Coordination:** 6/10 - Works sequentially, not as unified operator

---

## 🗺️ Phase 1: Unified State Model (CURRENT)

**Goal:** Create a single source of truth for application state that the orchestrator owns and manages.

**Status:** 🚧 In Progress

### Problem
State is scattered across 15+ props in `OrchestratorRequest`:
- `canvasNodes`, `canvasEdges`
- `activeContext`, `isDocumentViewOpen`
- `documentFormat`, `structureItems`, `contentMap`
- `currentStoryStructureNodeId`
- `modelMode`, `fixedModelId`, `availableProviders`, `availableModels`
- `userKeyId`, `clarificationContext`

### Solution
Create `WorldStateManager` that consolidates all state into a single, observable, versioned object.

### Tasks

#### 1.1 Create WorldState Foundation ⏳
- [ ] Create `frontend/src/lib/orchestrator/core/worldState.ts`
- [ ] Define `WorldState` interface (canvas, activeDocument, ui, user, meta)
- [ ] Implement `WorldStateManager` class with:
  - [ ] `getState()` - Read-only access
  - [ ] `update()` - Transactional updates
  - [ ] `subscribe()` - Observable pattern
  - [ ] Query helpers (`getNode`, `getActiveDocument`, `getCanvasContext`)
- [ ] Add TypeScript tests for state normalization

**Files to Create:**
- `frontend/src/lib/orchestrator/core/worldState.ts` (main)
- `frontend/src/lib/orchestrator/core/worldState.test.ts` (optional)

**Files to Reference:**
- `frontend/src/lib/orchestrator/core/orchestratorEngine.ts` (current request types)
- `frontend/src/lib/orchestrator/core/contextProvider.ts` (current context shape)

#### 1.2 Add WorldState Adapter ⏳
- [ ] In `OrchestratorPanel.tsx`, create `buildWorldStateFromProps()`
- [ ] Use `useMemo` to create WorldState from existing props
- [ ] Ensure no prop changes cause unnecessary rebuilds
- [ ] Add dev console logs to verify state building

**Files to Modify:**
- `frontend/src/components/panels/OrchestratorPanel.tsx`

**Dependencies:**
- Requires Task 1.1 complete

#### 1.3 Refactor OrchestratorEngine ⏳
- [ ] Update `OrchestratorEngine` constructor to accept `WorldStateManager`
- [ ] Refactor `orchestrate()` method signature:
  - Before: `orchestrate(request: OrchestratorRequest)`
  - After: `orchestrate(userMessage: string)`
- [ ] Update internal methods to read from `worldState` instead of request props
- [ ] Preserve all existing functionality (no feature changes)

**Files to Modify:**
- `frontend/src/lib/orchestrator/core/orchestratorEngine.ts`

**Dependencies:**
- Requires Task 1.1 and 1.2 complete

#### 1.4 Update Context Provider ⏳
- [ ] Refactor `buildCanvasContext()` to accept `WorldState` instead of raw nodes/edges
- [ ] Ensure `resolveNode()` works with new state structure
- [ ] Verify RAG integration still functions

**Files to Modify:**
- `frontend/src/lib/orchestrator/core/contextProvider.ts`

**Dependencies:**
- Requires Task 1.3 complete

#### 1.5 Testing & Verification ⏳
- [ ] Test all existing orchestrator intents:
  - [ ] `write_content` (with section selection)
  - [ ] `answer_question` (with RAG)
  - [ ] `create_structure` (screenplay, novel, report)
  - [ ] `delete_node`
  - [ ] `open_and_write`
  - [ ] `navigate_section`
  - [ ] Clarification flow
- [ ] Verify no regressions in UI
- [ ] Check console for errors
- [ ] Verify WorldState updates propagate correctly

**Success Criteria:**
- ✅ All existing features work identically
- ✅ No TypeScript errors
- ✅ No console errors
- ✅ Dev logs show WorldState being built correctly
- ✅ Reduced complexity: 15 props → 1 WorldState

---

## 🔧 Phase 2: Tool System (TODO)

**Status:** 📋 Not Started

**Goal:** Replace JSON action plans with executable tools that the orchestrator directly invokes.

### Problem
Orchestrator returns action plans as JSON, UI executes them via callbacks:
```typescript
actions: [{ type: 'generate_content', payload: {...}, status: 'pending' }]
// UI then calls: onWriteContent(payload.sectionId, payload.prompt)
```

### Solution
Create executable `Tool` system with `ToolRegistry` where orchestrator directly calls tools and observes results.

### Tasks (Detailed planning TBD)
- [ ] Create `frontend/src/lib/orchestrator/tools/` directory
- [ ] Define `Tool` interface and `ToolRegistry`
- [ ] Convert 3 core actions to tools:
  - [ ] `writeContentTool`
  - [ ] `createStructureTool`
  - [ ] `answerQuestionTool`
- [ ] Add tool execution to orchestrator
- [ ] Test tools in parallel with UI callbacks
- [ ] Convert remaining 7 actions to tools
- [ ] Remove UI callbacks (breaking change - coordinate carefully)

**Estimated Time:** 2 weeks  
**Risk Level:** Medium (breaking change for UI layer)

---

## 🔄 Phase 3: Closed Loop Execution (TODO)

**Status:** 📋 Not Started

**Goal:** Enable orchestrator to observe outcomes and learn from execution results.

### Problem
Orchestrator plans and executes but never sees if actions succeeded or failed. No feedback loop.

### Solution
Implement `ExecutionMemory` to record execution traces and enable pattern learning.

### Tasks (Detailed planning TBD)
- [ ] Create `ExecutionMemory` class
- [ ] Define `ExecutionTrace` interface
- [ ] Add execution recording to orchestrator
- [ ] Implement pattern detection (recurring failures, success patterns)
- [ ] Build user feedback collection UI
- [ ] Integrate feedback into future planning

**Estimated Time:** 1 week  
**Risk Level:** Low (additive feature)

---

## 🧠 Phase 4: Self-Improving Reasoning (TODO)

**Status:** 📋 Not Started

**Goal:** Enable orchestrator to adapt its reasoning from experience.

### Problem
LLM system prompts are static and don't improve from experience.

### Solution
Implement `AdaptivePromptBuilder` that enhances prompts with learned patterns.

### Tasks (Detailed planning TBD)
- [ ] Create `AdaptivePromptBuilder`
- [ ] Extract lessons from execution traces
- [ ] Dynamically enhance system prompts
- [ ] A/B test prompt variations
- [ ] Build analytics dashboard

**Estimated Time:** 1-2 weeks  
**Risk Level:** Low (experimental feature)

---

## 📋 Migration Strategy

### Principles
1. **No Breaking Changes Until Phase 2**: Phase 1 is a refactor, not a rewrite
2. **Test Continuously**: Every task includes verification step
3. **Commit Frequently**: Each completed task = 1 commit
4. **Preserve Functionality**: If it works now, it must work after Phase 1
5. **Document Dependencies**: Track which files depend on which changes

### Rollback Plan
- Each phase is in a separate branch
- Phase 1 branch: `refactor/phase1-worldstate`
- Can revert to main if issues arise
- WorldState is additive—can run in parallel with old system during testing

---

## 📈 Success Metrics

### Phase 1 Success Criteria
- ✅ All existing orchestrator features work identically
- ✅ Code complexity reduced by 70% (15 props → 1 WorldState)
- ✅ Zero TypeScript/ESLint errors
- ✅ Zero runtime console errors
- ✅ Dev team understands WorldState concept

### Phase 2 Success Criteria
- ✅ Orchestrator executes tools directly (no UI callbacks)
- ✅ All tools have success/failure reporting
- ✅ WorldState updates automatically after tool execution
- ✅ 10 tools implemented and tested

### Phase 3 Success Criteria
- ✅ Execution traces recorded for all operations
- ✅ Pattern detection identifies recurring issues
- ✅ User feedback collected and stored
- ✅ Analytics show execution success rates

### Phase 4 Success Criteria
- ✅ System prompts adapt from experience
- ✅ Success rate improves over time
- ✅ Dashboard shows learning trends

---

## 🚨 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing features | Medium | High | Comprehensive testing, gradual rollout |
| Performance regression | Low | Medium | WorldState uses Maps for O(1) lookups |
| UI coupling issues | Medium | Medium | Adapter pattern in Phase 1 |
| Developer confusion | Medium | Low | Documentation, code reviews |
| Scope creep | High | Medium | Strict phase boundaries, no feature adds in Phase 1 |

---

## 🎯 Current Focus: Phase 1, Task 1.1

**Next Steps:**
1. ✅ Create this tracking document
2. ⏳ Commit current work (LLM reasoning improvements)
3. ⏳ Create `worldState.ts` with full implementation
4. ⏳ Test WorldState in isolation
5. ⏳ Create adapter in OrchestratorPanel

---

## 📝 Change Log

### 2025-11-25
- ✅ Created refactor plan document
- ✅ Defined 4 phases with clear goals
- ✅ Established success criteria
- 🚧 Starting Phase 1, Task 1.1

---

## 📚 References

- Current Architecture: `ORCHESTRATOR_ARCHITECTURE.md`
- Intent System: `frontend/src/lib/orchestrator/llmIntentAnalyzer.ts`
- Context System: `frontend/src/lib/orchestrator/core/contextProvider.ts`
- Model Selection: `frontend/src/lib/orchestrator/core/modelRouter.ts`
- Blackboard Pattern: `frontend/src/lib/orchestrator/core/blackboard.ts`

