# Orchestrator Architecture

**Last Updated:** November 27, 2025  
**Status:** Production (Post-Refactoring)

> ⚠️ **Important (2025-12):** This document primarily describes the **legacy TypeScript orchestrator** that lives under `frontend/src/lib/orchestrator/` (many files are now suffixed `.deprecated`).
>
> **Active path today:** Python **Deep Agent** + SSE streaming: `frontend/src/hooks/useOrchestratorStream.ts` → `orchestrator/api/chat.py`.
>
> For how canvas nodes (e.g. **Character nodes**) influence generation when connected to the Orchestrator node, see `docs/orchestrator/DEEP_AGENT_CANVAS_SOURCES.md`.

---

## 🎯 Overview

The Publo Orchestrator is a multi-agent AI system that coordinates document creation, content generation, and user interactions through a modular, extensible architecture.

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
│                    (Chat Interface)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  OrchestratorPanel                           │
│  • Manages conversation                                      │
│  • Sends requests to orchestrator                            │
│  • Displays responses                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 OrchestratorEngine                           │
│  • Analyzes user intent (LLM-based)                          │
│  • Selects appropriate models                                │
│  • Generates actions via modular action generators           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Action Generators (Modular)                     │
│  ├─ AnswerQuestionAction                                     │
│  ├─ WriteContentAction                                       │
│  ├─ CreateStructureAction                                    │
│  ├─ OpenDocumentAction                                       │
│  ├─ DeleteNodeAction                                         │
│  └─ NavigateSectionAction                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            MultiAgentOrchestrator                            │
│  • Analyzes execution strategy (LLM-based)                   │
│  • Coordinates agent execution                               │
│  • Manages parallel/sequential/cluster strategies            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tool System                               │
│  • WriteContentTool → WriterAgent/WriterCriticCluster        │
│  • CreateStructureTool → LLM Structure Generation            │
│  • SaveTool → Database Persistence                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI Agents                                  │
│  ├─ WriterAgent (content generation)                         │
│  ├─ CriticAgent (quality review)                             │
│  └─ WriterCriticCluster (iterative refinement)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              External Systems                                │
│  ├─ LLM APIs (OpenAI, Anthropic, Groq, Google)               │
│  └─ Supabase (Database)                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
frontend/src/lib/orchestrator/
├── core/                           # Core orchestration
│   ├── orchestratorEngine.ts      # Main coordinator (1,942 lines)
│   ├── blackboard.ts               # Agent communication hub
│   ├── worldState.ts               # Application state manager
│   └── modelRouter.ts              # Intelligent model selection
│
├── context/                        # 🆕 Context Engineering
│   ├── intentRouter.ts            # Hybrid intent analysis (fast patterns + LLM)
│   ├── llmIntentAnalyzer.ts       # LLM-based intent reasoning
│   ├── contextProvider.ts         # Canvas context provider
│   ├── ragIntegration.ts          # Semantic search integration
│   ├── dependencyAnalyzer.ts      # Section dependency analysis
│   └── temporalMemory.ts          # Conversation memory
│
├── reasoning/                      # 🆕 High-level Reasoning
│   └── coherenceRewriter.ts       # Multi-section coherence planning
│
├── actions/                        # Modular action generators
│   ├── base/
│   │   └── BaseAction.ts          # Abstract base class
│   ├── content/
│   │   ├── AnswerQuestionAction.ts
│   │   └── WriteContentAction.ts
│   ├── structure/
│   │   └── CreateStructureAction.ts
│   └── navigation/
│       ├── OpenDocumentAction.ts
│       ├── DeleteNodeAction.ts
│       └── NavigateSectionAction.ts
│
├── agents/                         # AI agents for content generation
│   ├── WriterAgent.ts
│   ├── CriticAgent.ts
│   ├── MultiAgentOrchestrator.ts
│   ├── AgentRegistry.ts
│   ├── DAGExecutor.ts
│   ├── clusters/
│   │   └── WriterCriticCluster.ts
│   └── utils/
│       └── contentPersistence.ts
│
├── tools/                          # Executable tools
│   ├── writeContentTool.ts
│   ├── createStructureTool.ts
│   ├── saveTool.ts
│   └── selectSectionTool.ts
│
└── schemas/
    └── structurePlan.ts            # Zod validation schemas
```

---

## 🔄 Request Flow

### Example: "Write a short story about butterflies"

```
1. User Message
   ↓
2. OrchestratorEngine.orchestrate()
   ├─ Analyze intent (LLM) → "create_structure"
   ├─ Select model → GPT-4o
   └─ Generate actions → CreateStructureAction
   
3. CreateStructureAction.generate()
   ├─ Validate format
   ├─ Check canvas for existing docs
   ├─ Generate structure plan (LLM)
   ├─ Analyze task complexity (LLM)
   └─ Return: [generate_structure, generate_content...]
   
4. MultiAgentOrchestrator.executeActionsWithAgents()
   ├─ Analyze strategy (LLM) → "cluster"
   └─ Execute via tools
   
5. WriteContentTool.execute()
   ├─ Create WriterCriticCluster
   ├─ Iterative generation (2-3 rounds)
   └─ Save to database
   
6. Response to UI
   └─ Display messages, update canvas
```

---

## 🧠 Key Components

### **1. Intent Analysis (LLM-Based)**

**File:** `core/orchestratorEngine.ts` + `llmIntentAnalyzer.ts`

**Purpose:** Understand what the user wants

**Intents:**
- `answer_question` - Answer user questions
- `write_content` - Generate content for sections
- `create_structure` - Create document structures
- `open_and_write` - Open existing documents
- `delete_node` - Delete canvas nodes
- `navigate_section` - Navigate to sections
- `general_chat` - Conversational fallback

---

### **2. Action Generators (Modular)**

**Location:** `actions/`

**Purpose:** Generate specific actions based on intent

**Benefits:**
- ✅ Single responsibility
- ✅ Easy to test
- ✅ Easy to extend
- ✅ Type-safe

**Example:**
```typescript
class WriteContentAction extends BaseAction {
  async generate(intent, request, context) {
    // Detect target section (numeric, ordinal, name-based)
    // Select appropriate model
    // Return generate_content action
  }
}
```

---

### **3. Multi-Agent System**

**File:** `agents/MultiAgentOrchestrator.ts`

**Purpose:** Coordinate AI agents for content generation

**Strategies:**
- **Sequential** - Simple tasks, one at a time
- **Parallel** - Independent tasks, run simultaneously
- **Cluster** - Complex tasks, iterative refinement (Writer + Critic)

**Selection:** LLM analyzes task and chooses strategy

---

### **4. Tool System**

**Location:** `tools/`

**Purpose:** Execute actions with real implementations

**Key Tools:**
- `writeContentTool` - Delegates to WriterAgent/Cluster
- `createStructureTool` - Generates structures with LLM
- `saveTool` - Persists to database

---

### **5. Blackboard (Communication Hub)**

**File:** `core/blackboard.ts`

**Purpose:** Agent-to-agent communication and conversation history

**Features:**
- Message history
- Pattern memory
- Agent coordination
- Real-time UI updates

---

## 🎯 Current Capabilities

### ✅ What Works
- [x] Answer questions with context
- [x] Create document structures (novel, screenplay, report, etc.)
- [x] Generate content for sections
- [x] Navigate between sections
- [x] Open/delete documents
- [x] Multi-step task detection
- [x] Intelligent model selection
- [x] Writer-Critic iterative refinement
- [x] Format validation and education

### ⚠️ Known Issues
- [ ] Clarification response handling (user says "1" after clarification)
- [ ] Database schema issues (avatar_url column)
- [ ] Duplicate node key constraints

---

## 🚀 Next Improvements

### **Priority 1: Clarification Response Handling**
**Problem:** When user responds to clarification ("1", "first", etc.), orchestrator loses context

**Solution:** Add clarification response detection in intent analysis

**Files to modify:**
- `llmIntentAnalyzer.ts` - Detect clarification responses
- `core/orchestratorEngine.ts` - Handle clarification context
- `actions/structure/CreateStructureAction.ts` - Resume from clarification

---

### **Priority 2: Better Conversational Flow**
**Problem:** Orchestrator not conversational enough

**Solution:**
- More educational responses
- Helpful suggestions
- Clear progress updates
- Friendly tone

---

### **Priority 3: Database Schema Fixes**
**Problem:** Missing columns, constraint violations

**Solution:**
- Add missing columns (avatar_url, etc.)
- Fix unique constraints
- Migration scripts

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| **Total Lines** | ~25,000 lines |
| **Core Engine** | 1,942 lines (40% reduction) |
| **Action Files** | 7 files, 1,527 lines |
| **Agent Files** | 10 files, ~3,500 lines |
| **Tool Files** | 8 files, ~1,200 lines |
| **TypeScript Errors** | 0 |
| **Build Status** | ✅ Passing |

---

## 🔧 Development

### **Adding a New Action**

1. Create file in `actions/[category]/NewAction.ts`
2. Extend `BaseAction`
3. Implement `generate()` method
4. Register in `orchestratorEngine.ts` constructor
5. Add to `llmIntentAnalyzer.ts` intent list

### **Adding a New Agent**

1. Create file in `agents/NewAgent.ts`
2. Implement `AgentInterface`
3. Register in `AgentRegistry`
4. Use in tool or orchestrator

### **Adding a New Tool**

1. Create file in `tools/newTool.ts`
2. Extend `BaseTool`
3. Implement `execute()` method
4. Register in tool registry

---

## 📚 Documentation

- **This file** - Architecture overview
- `docs/archive/` - Historical docs, bug fixes, phase documentation
- `db/migrations/` - Database migration scripts

---

**For detailed implementation history, see `docs/archive/`**

