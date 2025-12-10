# Deep Agents Migration - Quick Reference

**Quick links and summaries for the Deep Agents migration plan.**

---

## 📋 Phase Summary

| Phase | What | Duration | Key Files |
|-------|------|----------|-----------|
| **1. Foundation** | Virtual filesystem | 2 weeks | `deep_agent_backend.py`, `file_storage.py` |
| **2. Planner** | Deep Agent planner | 2 weeks | `planner_agent.py`, `plan_converter.py` |
| **3. Context** | Selective loading | 2 weeks | Updated `analyze_intent_node`, `writer_node` |
| **4. Subagents** | Parallel execution | 3 weeks | `writer_agent.py`, `section_writer_subagent.py` |
| **5. Memory** | Persistent learning | 2 weeks | `memory_manager.py`, `preference_learner.py` |
| **6. Testing** | Final polish | 1 week | Test suite, benchmarks |

**Total: 12 weeks**

---

## 🎯 Key Benefits

- ✅ **30-50% context window reduction** (selective loading)
- ✅ **Better task decomposition** (dynamic planning)
- ✅ **Parallel execution** (subagent spawning)
- ✅ **Persistent learning** (memory across sessions)
- ✅ **Adaptive planning** (dynamic strategy)

---

## 🚀 Getting Started

### 1. Install Deep Agents

```bash
cd orchestrator
pip install langchain-deepagents
```

### 2. Create Feature Branch

```bash
git checkout -b feature/deep-agents-migration
```

### 3. Start Phase 1

```bash
# Create filesystem backend
touch orchestrator/agents/deep_agent_backend.py
touch orchestrator/agents/file_storage.py
```

---

## 📁 New File Structure

```
orchestrator/
├── agents/                          # NEW: Deep Agents
│   ├── deep_agent_backend.py        # Virtual filesystem
│   ├── file_storage.py              # State ↔ files conversion
│   ├── planner_agent.py             # Deep Agent planner
│   ├── plan_converter.py            # Plan → Actions
│   ├── writer_agent.py              # Writer with subagents
│   ├── section_writer_subagent.py   # Section writer
│   ├── critic_subagent.py           # Critic subagent
│   ├── memory_manager.py            # Persistent memory
│   ├── preference_learner.py         # Preference learning
│   └── pattern_learner.py            # Pattern learning
└── graph/
    ├── nodes.py                     # UPDATED: Uses agents
    ├── workflow.py                  # UPDATED: Agent integration
    └── state.py                     # UPDATED: Plan field added
```

---

## 🔄 Migration Flow

```
Current System
    ↓
Phase 1: Add filesystem (no workflow changes)
    ↓
Phase 2: Replace generate_actions_node
    ↓
Phase 3: Replace context loading
    ↓
Phase 4: Replace writer_node with subagents
    ↓
Phase 5: Add persistent memory
    ↓
Phase 6: Test & optimize
    ↓
Deep Agents System
```

---

## 🛠️ Key Code Patterns

### Initialize Backend

```python
from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend

backend = OrchestratorFilesystemBackend(project_id=session_id)
```

### Store State

```python
from orchestrator.agents.file_storage import store_state_to_filesystem

store_state_to_filesystem(backend, state)
```

### Load Context

```python
from orchestrator.agents.file_storage import load_context_from_filesystem

canvas_context = load_context_from_filesystem(backend, "canvas")
```

### Create Plan

```python
from orchestrator.agents.planner_agent import PlannerAgent

planner = PlannerAgent(backend)
plan = await planner.create_plan(user_message, intent, context_files)
```

### Spawn Subagent

```python
from orchestrator.agents.writer_agent import WriterAgent

writer = WriterAgent(backend)
subagent = await writer.agent.spawn_subagent(
    name="writer_chapter_1",
    task="Write Chapter 1",
    context_files=["plan/task_plan.json"]
)
```

---

## ⚠️ Rollback Commands

### Phase 1 Rollback
```python
# Disable filesystem, use state directly
# Remove file storage calls
```

### Phase 2 Rollback
```python
# Switch back to old generate_actions_node
# Remove planner agent
```

### Phase 3 Rollback
```python
# Restore canvas_context string
# Remove file loading
```

### Phase 4 Rollback
```python
# Revert to old writer_node and critic_node
# Remove subagent spawning
```

### Phase 5 Rollback
```python
# Disable memory, use current pattern learning
# Remove memory manager
```

---

## 📊 Success Metrics

- **Context Usage**: -30% to -50%
- **Task Quality**: User feedback > 4/5
- **Performance**: < 100ms overhead
- **Memory**: < 100MB per project
- **Errors**: < 1% error rate

---

## 🔗 Related Documents

- **Full Plan**: `DEEP_AGENTS_MIGRATION_PLAN.md`
- **Architecture**: `ORCHESTRATOR_ARCHITECTURE.md`
- **State Flow**: `STATE_FLOW_REPORT.md` (to be created)

---

## ❓ FAQ

**Q: Can we rollback at any phase?**  
A: Yes, each phase is independently rollbackable.

**Q: Will this break existing workflows?**  
A: No, we maintain backward compatibility throughout.

**Q: How much will this cost?**  
A: May increase LLM calls (more agents), but should be offset by better efficiency.

**Q: When can we start?**  
A: After stakeholder approval and Phase 1 setup.

---

## 📞 Support

For questions or issues during migration:
1. Check the full plan document
2. Review code examples in plan
3. Test in development environment first
4. Use feature flags for gradual rollout

