# Quick Integration Checklist

## 📋 Files to Touch vs Leave Alone

### ✅ LEAVE UNCHANGED (Don't modify these)

```
orchestrator/
├── actions/
│   ├── base/BaseAction.ts                    ✅ Keep as-is
│   ├── content/
│   │   ├── AnswerQuestionAction.ts          ✅ Keep as-is
│   │   └── WriteContentAction.ts            ✅ Keep as-is
│   ├── navigation/
│   │   ├── DeleteNodeAction.ts              ✅ Keep as-is
│   │   ├── NavigateSectionAction.ts         ✅ Keep as-is
│   │   └── OpenDocumentAction.ts            ✅ Keep as-is
│   └── structure/
│       └── CreateStructureAction.ts         ✅ Keep as-is
│
├── agents/
│   ├── WriterAgent.ts                       ✅ Keep as-is
│   ├── CriticAgent.ts                       ✅ Keep as-is
│   ├── MultiAgentOrchestrator.ts           ✅ Keep as-is
│   ├── DAGExecutor.ts                      ✅ Keep as-is
│   └── ExecutionTracer.ts                  ✅ Keep as-is
│
├── tools/
│   ├── ToolRegistry.ts                     ✅ Keep as-is
│   ├── BaseTool.ts                         ✅ Keep as-is
│   ├── writeContentTool.ts                 ✅ Keep as-is
│   └── ... (all other tools)               ✅ Keep as-is
│
├── schemas/
│   ├── documentHierarchy.ts                ✅ Keep as-is
│   ├── structurePlan.ts                    ✅ Keep as-is
│   └── templateRegistry.ts                 ✅ Keep as-is
│
└── core/
    ├── blackboard.ts                       ✅ Keep as-is (we'll read/write)
    ├── worldState.ts                       ✅ Keep as-is (we'll read)
    └── modelRouter.ts                      ✅ Keep as-is (we'll reuse)
```

### 🔄 MODIFY THESE (Update to use new system)

```
orchestrator/
├── context/
│   ├── intentRouter.ts                     🔄 UPDATE to use IntentPipeline
│   ├── llmIntentAnalyzer.ts               🔄 REPLACE with wrapper
│   └── templateMatcher.ts                  🔄 ENHANCE (optional)
│
└── core/
    └── orchestratorEngine.ts               🔄 ADD feature flag temporarily
```

### 🆕 CREATE THESE (New intent system)

```
orchestrator/context/intent/                🆕 NEW FOLDER
├── pipeline/
│   ├── IntentPipeline.ts                  🆕 Main orchestrator
│   ├── types.ts                           🆕 Intent-specific types
│   └── config.ts                          🆕 Configuration
│
├── agents/
│   ├── TriageAgent.ts                     🆕 Fast classifier
│   ├── ContextAgent.ts                    🆕 Reference resolver
│   ├── AnalysisAgent.ts                   🆕 Deep analyzer
│   └── ValidationAgent.ts                 🆕 Validator
│
├── stages/
│   ├── 1-triage/
│   │   ├── patterns.ts                    🆕 Pattern matching
│   │   └── classifier.ts                  🆕 Classification logic
│   ├── 2-context/
│   │   ├── resolver.ts                    🆕 Pronoun resolution
│   │   └── canvasAnalyzer.ts              🆕 Node matching
│   ├── 3-analysis/
│   │   ├── prompts/
│   │   │   ├── core.ts                    🆕 Core rules
│   │   │   ├── canvas.ts                  🆕 Canvas awareness
│   │   │   ├── followUp.ts                🆕 Follow-up handling
│   │   │   └── templates.ts               🆕 Template matching
│   │   └── composer.ts                    🆕 Prompt composition
│   └── 4-validation/
│       ├── rules.ts                       🆕 Validation rules
│       └── autoCorrect.ts                 🆕 Auto-corrections
│
└── utils/
    ├── modelRouterAdapter.ts              🆕 Adapter (if needed)
    ├── contextBuilder.ts                  🆕 Build context from worldState
    ├── confidence.ts                      🆕 Confidence thresholds
    └── metrics.ts                         🆕 Performance tracking
```

---

## 🔧 Step-by-Step Integration (30 Minutes)

### Step 1: Create Folder Structure (5 min)

```bash
cd orchestrator/context
mkdir -p intent/pipeline
mkdir -p intent/agents
mkdir -p intent/stages/{1-triage,2-context,3-analysis/prompts,4-validation}
mkdir -p intent/utils
```

### Step 2: Copy Types (5 min)

Create `orchestrator/context/intent/pipeline/types.ts`:
- Copy from build plan
- Align with your existing `ActionType` from `BaseAction.ts`
- Ensure compatibility with `worldState` and `blackboard`

### Step 3: Build IntentPipeline Shell (10 min)

Create `orchestrator/context/intent/pipeline/IntentPipeline.ts`:
- Import your existing `modelRouter`
- Import `worldState` and `blackboard`
- Build shell that coordinates agents
- Test basic integration

```typescript
import { modelRouter } from '../../../core/modelRouter'
import { worldState } from '../../../core/worldState'
import { blackboard } from '../../../core/blackboard'

export class IntentPipeline {
  constructor() {
    this.modelRouter = modelRouter  // ✅ Reuse existing
  }

  async analyze(message: string, context: any) {
    // Shell implementation
    console.log('IntentPipeline analyzing:', message)
    console.log('WorldState:', worldState.getAll())
    
    // Return dummy result for now
    return {
      intent: 'write_content',
      confidence: 0.9
    }
  }
}
```

### Step 4: Update intentRouter.ts (5 min)

```typescript
// orchestrator/context/intentRouter.ts

import { IntentPipeline } from './intent/pipeline/IntentPipeline'
import { worldState } from '../core/worldState'

export class IntentRouter {
  private pipeline = new IntentPipeline()

  async route(message: string) {
    const context = {
      documentPanelOpen: worldState.get('documentPanelOpen'),
      activeSegment: worldState.get('activeSegment'),
      canvasNodes: worldState.get('canvasNodes')
    }

    const analysis = await this.pipeline.analyze(message, context)
    
    // Map to your existing action system
    return this.mapIntentToAction(analysis.intent)
  }
}
```

### Step 5: Test Integration (5 min)

```bash
npm test orchestrator/context/intent
```

Test that:
- ✅ IntentPipeline can read from worldState
- ✅ IntentPipeline can use modelRouter
- ✅ intentRouter maps to correct actions
- ✅ Existing actions still work

---

## 🎯 Success Criteria for Each Phase

### Phase 1 Complete When:
- [ ] `IntentPipeline` shell works with your `modelRouter`
- [ ] Can read from `worldState` and `blackboard`
- [ ] Types are compatible with existing actions
- [ ] Basic integration test passes

### Phase 2 Complete When:
- [ ] `TriageAgent` classifies simple intents in <100ms
- [ ] Pattern matching works for common phrases
- [ ] 80%+ of simple requests skip deep analysis
- [ ] Metrics show 2x speed improvement for simple cases

### Phase 3 Complete When:
- [ ] `ContextAgent` resolves pronouns correctly
- [ ] Canvas node matching works (85%+ accuracy)
- [ ] Conversation state is tracked
- [ ] Follow-up responses are detected

### Phase 4 Complete When:
- [ ] `AnalysisAgent` breaks down mega-prompt into modules
- [ ] Prompts compose dynamically based on context
- [ ] Chain-of-thought reasoning is captured
- [ ] Accuracy matches or exceeds current system

### Phase 5 Complete When:
- [ ] `ValidationAgent` catches common mistakes
- [ ] Auto-corrections work (format mismatches, etc.)
- [ ] Confidence thresholds prevent bad intents
- [ ] Regression tests all pass

### Phase 6 Complete When:
- [ ] Feature flag controls rollout
- [ ] A/B testing shows improvement
- [ ] All existing actions work correctly
- [ ] Performance is 2-3x better
- [ ] Cost is 50% lower
- [ ] Ready for 100% rollout

---

## ⚠️ Common Gotchas

### 1. modelRouter Interface Mismatch
**Problem:** Your `modelRouter` might have different method signatures

**Solution:** Create adapter in `intent/utils/modelRouterAdapter.ts`

```typescript
export class ModelRouterAdapter {
  async complete(request) {
    // Adapt request to your modelRouter's interface
    return await modelRouter.yourMethodName(request)
  }
}
```

### 2. Action Type Mapping
**Problem:** Intent names don't match your action names

**Solution:** Update mapping in `intentRouter.ts`

```typescript
const intentToActionMap = {
  'write_content': 'YourWriteAction',  // Use your action names
  'answer_question': 'YourAnswerAction',
  // ...
}
```

### 3. worldState Structure
**Problem:** Pipeline expects certain keys that don't exist

**Solution:** Map your worldState to pipeline context in `contextBuilder.ts`

```typescript
export function buildPipelineContext() {
  return {
    documentPanelOpen: worldState.get('yourPanelKey'),
    activeSegment: worldState.get('yourSegmentKey'),
    // Map your keys to pipeline expectations
  }
}
```

### 4. Test Failures
**Problem:** Integration tests fail because of state issues

**Solution:** Mock worldState and blackboard in tests

```typescript
beforeEach(() => {
  worldState.set('documentPanelOpen', false)
  blackboard.clear()
})
```

---

## 📞 Need Help?

### Questions to Ask:

1. **About modelRouter:**
   - What methods does it have?
   - How do you specify fast vs smart models?
   - Does it return a string or structured response?

2. **About worldState:**
   - What keys are available?
   - How do you read from it?
   - Is it synchronous or async?

3. **About Actions:**
   - What's the base interface?
   - How are they registered?
   - Do they return a specific format?

4. **About Agents:**
   - Are they already registered somewhere?
   - Do they use a specific base class?
   - How does MultiAgentOrchestrator work?

---

## 🚀 Ready to Start?

1. ✅ Review this checklist
2. ✅ Understand what stays vs what changes
3. ✅ Follow 30-minute quick start
4. ✅ Test each phase before moving on
5. ✅ Keep existing system working throughout

**First Command:**
```bash
mkdir -p orchestrator/context/intent/pipeline
cd orchestrator/context/intent/pipeline
touch types.ts IntentPipeline.ts config.ts
```

You got this! 💪
