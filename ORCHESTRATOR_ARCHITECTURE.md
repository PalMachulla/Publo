# Orchestrator Architecture

## 🏗️ Overview

The Publo Orchestrator is a **blackboard-based AI orchestration system** inspired by [Agentic Flow](https://github.com/ruvnet/agentic-flow) but tailored for embedded React applications.

### Key Principles

1. **Blackboard Pattern** - Central state management for multi-agent coordination
2. **Intelligent Context** - LLM-based reasoning for node resolution and intent detection
3. **Model Routing** - Auto-select optimal model based on task complexity and priority
4. **Pattern Learning** - ReasoningBank-inspired system that learns from successful interactions
5. **Temporal Memory** - Timeline-based event tracking for auditability and optimization

---

## 📁 File Structure

```
orchestrator/
├── core/                          # Core orchestration logic
│   ├── blackboard.ts              # Central state management (🆕)
│   ├── contextProvider.ts         # Unified context + node resolution (🆕)
│   ├── modelRouter.ts             # Intelligent model selection (🆕)
│   └── orchestratorEngine.ts     # Main orchestration engine (🆕)
│
├── intent/                        # Intent detection (existing, unchanged)
│   ├── intentRouter.ts            # Hybrid intent detection
│   └── llmIntentAnalyzer.ts      # LLM-based intent analysis
│
├── capabilities/                  # Specialized capabilities (existing)
│   ├── ragIntegration.ts          # Semantic search
│   ├── coherenceRewriter.ts       # Multi-section rewriting
│   └── dependencyAnalyzer.ts      # Narrative dependencies
│
├── temporalMemory.ts              # Timeline event tracking (existing, now integrated)
└── index.ts                       # Clean public API (🆕)
```

### Deprecated Files (to be removed)
- ❌ `canvasContextProvider.ts` → Merged into `core/contextProvider.ts`
- ❌ `llmNodeResolver.ts` → Merged into `core/contextProvider.ts`
- ❌ `orchestratorEngine.ts` (old) → Replaced by `core/orchestratorEngine.ts`

---

## 🎯 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CreateStoryPanel.tsx                      │
│                     (React Component)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Orchestrator Engine                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              1. Update Blackboard                     │   │
│  │  • Canvas state (nodes, edges)                        │   │
│  │  • Document state (structure, content)                │   │
│  │  • Conversation history                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         2. Build Context (ContextProvider)            │   │
│  │  • Extract node contexts                              │   │
│  │  • Detect canvas changes                              │   │
│  │  • Format for LLM                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            3. Enhance with RAG (Optional)             │   │
│  │  • Semantic search on embeddings                      │   │
│  │  • Resolve node references (LLM + keywords)           │   │
│  │  • Build enriched context                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           4. Analyze Intent (IntentRouter)            │   │
│  │  • Pattern matching (fast path)                       │   │
│  │  • LLM reasoning (complex cases)                      │   │
│  │  • Confidence scoring                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         5. Select Model (ModelRouter)                 │   │
│  │  • Assess task complexity                             │   │
│  │  • Apply priority (cost/speed/quality/balanced)       │   │
│  │  • Score and rank candidates                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         6. Learn Pattern (ReasoningBank)              │   │
│  │  • Extract learnable patterns                         │   │
│  │  • Store in blackboard                                │   │
│  │  • Update success rates                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         7. Record Action (Temporal Memory)            │   │
│  │  • Log event delta                                    │   │
│  │  • Update timeline                                    │   │
│  │  • Create snapshots                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Core Components

### 1. Blackboard (`core/blackboard.ts`)

**Purpose**: Central state management and knowledge base

**Key Features**:
- **Conversation history** with metadata tracking
- **Canvas state** with change detection
- **Document state** per node (structure, content, word count)
- **Orchestrator context** (intent, actions, referenced nodes)
- **Pattern learning** (ReasoningBank-style)
- **Observer pattern** for reactive updates
- **Temporal memory** integration

**API**:
```typescript
const blackboard = getBlackboard(userId)

// Add message
blackboard.addMessage({ role: 'user', content: 'Hello' })

// Update canvas
blackboard.updateCanvas(nodes, edges)

// Store pattern
await blackboard.storePattern('pattern', 'action', 'namespace')

// Query patterns
const patterns = await blackboard.queryPatterns('search query')
```

---

### 2. Context Provider (`core/contextProvider.ts`)

**Purpose**: Unified context extraction and node resolution

**Key Features**:
- **Three-tier node resolution**:
  1. LLM reasoning (primary)
  2. Keyword matching (fallback)
  3. Recently referenced nodes (tertiary)
- **Smart context extraction** from all node types
- **LLM prompt formatting**
- **Blackboard integration**

**API**:
```typescript
// Build canvas context
const context = buildCanvasContext('orchestrator-id', nodes, edges, contentMap)

// Resolve node reference
const node = await resolveNode(userMessage, context, blackboard)

// Format for LLM
const prompt = formatCanvasContextForLLM(context)
```

---

### 3. Model Router (`core/modelRouter.ts`)

**Purpose**: Intelligent model selection

**Inspired by**: [Agentic Flow's Model Router](https://github.com/ruvnet/agentic-flow/tree/main/agentic-flow/src/router)

**Key Features**:
- **Auto-select** based on task complexity
- **Priority modes**: cost, speed, quality, balanced
- **Model registry** with capabilities and pricing
- **Cost estimation**

**API**:
```typescript
// Assess task complexity
const complexity = assessTaskComplexity(intent, contextLength, requiresReasoning)

// Select model
const selection = selectModel(complexity, 'balanced', ['openai', 'groq'])

// Get model info
const info = getModelInfo('gpt-4o')

// Estimate cost
const cost = estimateCost('gpt-4o', 2000)
```

---

### 4. Orchestrator Engine (`core/orchestratorEngine.ts`)

**Purpose**: Main orchestration logic

**Key Features**:
- **Unified orchestration** flow
- **Blackboard integration**
- **Model routing**
- **Pattern learning**
- **Temporal memory**
- **Factory pattern** for singleton management

**API**:
```typescript
// Create orchestrator
const orchestrator = getOrchestrator(userId, {
  modelPriority: 'balanced',
  enableRAG: true,
  enablePatternLearning: true
})

// Orchestrate request
const response = await orchestrator.orchestrate({
  message: 'Tell me about the screenplay',
  canvasNodes: nodes,
  canvasEdges: edges,
  activeContext: { id: 'section-1', name: 'Introduction' },
  isDocumentViewOpen: true
})

// Response includes:
// - intent: UserIntent
// - confidence: number
// - reasoning: string
// - modelUsed: string
// - actions: OrchestratorAction[]
// - canvasChanged: boolean
// - requiresUserInput: boolean
// - estimatedCost: number
```

---

## 🚀 Migration Guide

### Before (Old Architecture)

```typescript
// CreateStoryPanel.tsx (old)
import { analyzeIntent } from '@/lib/orchestrator/intentRouter'
import { buildCanvasContext, findReferencedNode } from '@/lib/orchestrator/canvasContextProvider'
import { enhanceContextWithRAG } from '@/lib/orchestrator/ragIntegration'

// Manual orchestration
const canvasContext = buildCanvasContext('context', nodes, edges, contentMap)
const ragContext = await enhanceContextWithRAG(message, canvasContext)
const intent = await analyzeIntent({ message, ... })
const node = findReferencedNode(message, canvasContext, history)
```

### After (New Architecture)

```typescript
// CreateStoryPanel.tsx (new)
import { getOrchestrator } from '@/lib/orchestrator'

// Automatic orchestration
const orchestrator = getOrchestrator(userId)
const response = await orchestrator.orchestrate({
  message,
  canvasNodes: nodes,
  canvasEdges: edges,
  activeContext,
  isDocumentViewOpen,
  documentFormat,
  structureItems,
  contentMap,
  currentStoryStructureNodeId
})

// Everything is handled internally:
// ✅ Canvas context
// ✅ RAG enhancement
// ✅ Intent detection
// ✅ Node resolution
// ✅ Model selection
// ✅ Pattern learning
// ✅ Temporal memory
```

---

## 📊 Benefits

### 1. **Simplified API**
- **Before**: 5+ imports, manual orchestration
- **After**: 1 import, single method call

### 2. **Intelligent Model Selection**
- **Before**: Hardcoded model IDs
- **After**: Auto-select based on task complexity and priority

### 3. **Pattern Learning**
- **Before**: No learning
- **After**: Automatically learns from successful interactions

### 4. **Better Context Management**
- **Before**: Manual state tracking
- **After**: Blackboard maintains all state automatically

### 5. **Three-Tier Node Resolution**
- **Before**: Keyword matching only
- **After**: LLM reasoning → Keywords → Recent nodes

### 6. **Temporal Memory**
- **Before**: Unused
- **After**: Fully integrated for auditability and optimization

---

## 🎓 Inspired By

This architecture draws inspiration from:

1. **[Agentic Flow](https://github.com/ruvnet/agentic-flow)** - Model routing, ReasoningBank, swarm coordination
2. **Blackboard Pattern** - Shared knowledge base for multi-agent systems
3. **AgentDB Timeline Self-Reflection** - Temporal event tracking
4. **Observer Pattern** - Reactive state updates

---

## 📝 Next Steps

1. ✅ Core architecture complete
2. ⏳ Update `CreateStoryPanel.tsx` to use new API
3. ⏳ Test all functionality
4. ⏳ Delete deprecated files
5. ⏳ Performance benchmarking
6. ⏳ Documentation and examples

---

## 💡 Future Enhancements

- **Multi-agent swarms** for parallel content generation
- **Real embeddings** for pattern similarity (currently simple hashing)
- **Distributed orchestration** for cloud deployment
- **MCP tool integration** (213 tools from Agentic Flow)
- **ONNX local inference** for offline mode

