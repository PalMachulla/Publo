# Agentic Orchestrator System Implementation Plan

**Version**: 1.0  
**Branch**: `feature/agentic-orchestrator`  
**Status**: In Development  
**Goal**: Transform single-model generation into intelligent multi-agent orchestration

---

## Executive Summary

### Current State (What Works ✅)
- Basic structure generation via `/api/generate`
- Model selection in CreateStoryPanel
- YAML/Markdown parsing (with repair)
- Structure node visualization
- ReactFlow canvas integration
- BYOAPI key management

### Problems to Solve ❌
- Models struggle with complex YAML formatting
- No reasoning visibility
- Single model does everything (planning + writing)
- No task delegation
- No model specialization
- Complex prompts in `formatPrompts.ts` fighting YAML

### Target State 🎯
- Orchestrator model plans structure (returns JSON)
- Writer agents execute specific tasks
- Real-time reasoning chat visible to user
- Progressive structure building
- Model selection based on task requirements
- Specialized agent nodes (future)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│              USER INTERFACE LAYER                     │
│  ┌────────────────────┐  ┌─────────────────────┐    │
│  │ CreateStoryPanel   │  │ Reasoning Chat UI   │    │
│  │ - Format selector  │  │ - Collapsible       │    │
│  │ - Model selector   │  │ - Real-time logs    │    │
│  │ - Generate button  │  │ - Timestamped       │    │
│  └────────────────────┘  └─────────────────────┘    │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│           ORCHESTRATION ENGINE                        │
│  ┌──────────────────────────────────────────────┐   │
│  │  OrchestratorEngine Class                    │   │
│  │  - analyzePrompt()                           │   │
│  │  - createStructurePlan() → JSON             │   │
│  │  - selectModelForTask()                      │   │
│  │  - executeTasks() → Progressive building     │   │
│  └──────────────────────────────────────────────┘   │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│              MODEL CATALOG                            │
│  ┌──────────────────────────────────────────────┐   │
│  │  modelCapabilities.ts                        │   │
│  │  - Curated models with roles                 │   │
│  │  - Capabilities & specializations            │   │
│  │  - Cost/speed metadata                       │   │
│  └──────────────────────────────────────────────┘   │
└────────────────┬─────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────┐
│              API LAYER                                │
│  /api/generate (refactored)                          │
│  - Handles both orchestrator and writer calls        │
│  - Returns JSON for orchestrator                     │
│  - Returns plain text for writers                    │
└──────────────────────────────────────────────────────┘
```

---

## Implementation Phases

See detailed implementation steps below for each phase.

### Phase 1: Foundation (Week 1) ✅ IN PROGRESS
- [x] Create feature branch
- [ ] Create model catalog with capabilities
- [ ] Create orchestrator engine core logic
- [ ] Add reasoning chat UI component
- [ ] Refactor /api/generate for dual modes

### Phase 2: Integration (Week 2)
- [ ] Replace generation logic with orchestration
- [ ] Add model selection UI
- [ ] Implement progressive structure building
- [ ] End-to-end testing

### Phase 3: Cleanup (Week 3)
- [ ] Mark old files as deprecated
- [ ] Add legacy mode toggle
- [ ] Test backward compatibility
- [ ] Plan deletion timeline

### Phase 4: Polish (Future)
- [ ] Specialized agent nodes
- [ ] Advanced orchestration features
- [ ] Enhanced UI/UX

---

## Detailed Implementation Guide

[Full detailed implementation plan continues with all sections from the previous document...]

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-20  
**Status**: Active Development

