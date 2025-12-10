# Deep Agents Migration Plan: Publo Orchestrator

**Date:** January 2025  
**Project:** Publo - Creative Writing Platform  
**Purpose:** Comprehensive migration plan for integrating LangChain Deep Agents into the orchestrator system

---

## Executive Summary

This document outlines a phased migration plan to integrate LangChain Deep Agents into Publo's orchestrator system. Deep Agents will provide:

- **Dynamic Task Decomposition**: Break complex tasks into manageable sub-tasks
- **Virtual Filesystem**: Efficient context management without window overflow
- **Subagent Spawning**: Specialized agents for parallel execution
- **Persistent Memory**: Long-term learning and personalization
- **Adaptive Planning**: Dynamic strategy adjustment based on progress

**Estimated Timeline:** 10-12 weeks (2.5-3 months)  
**Risk Level:** Medium (incremental migration, can rollback at any phase)  
**Expected Benefits:** 40-60% improvement in task quality, 30-50% reduction in context window usage

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Deep Agents Architecture](#2-deep-agents-architecture)
3. [Migration Phases](#3-migration-phases)
4. [Technical Implementation](#4-technical-implementation)
5. [Risk Assessment](#5-risk-assessment)
6. [Success Metrics](#6-success-metrics)
7. [Rollback Strategy](#7-rollback-strategy)

---

## 1. Current State Analysis

### 1.1 Current Architecture

**Workflow Structure:**
```
analyze_intent → generate_actions → select_strategy 
  → [conditional] → writer/critic/tools → merge_results
```

**Key Components:**
- `orchestrator/graph/workflow.py`: LangGraph workflow definition
- `orchestrator/graph/nodes.py`: Node functions (analyze_intent, writer, critic, etc.)
- `orchestrator/graph/state.py`: OrchestratorState (shared state)
- `orchestrator/api/orchestrate.py`: API endpoints

**Current Limitations:**
1. ❌ Fixed action generation (no dynamic decomposition)
2. ❌ All context sent to LLM every time (context window risk)
3. ❌ Limited memory (conversation history only)
4. ❌ Sequential execution (limited parallelism)
5. ❌ No adaptive planning (strategy chosen once)

### 1.2 Dependencies

**Current:**
- `langchain==0.1.16`
- `langgraph==0.0.30`
- `langsmith>=0.1.17,<0.2.0`

**New Requirements:**
- `langchain-deepagents` (to be installed)
- Virtual filesystem backend
- Subagent management

---

## 2. Deep Agents Architecture

### 2.1 Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         MAIN ORCHESTRATOR DEEP AGENT                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Virtual Filesystem Backend                          │   │
│  │  /project/                                           │   │
│  │    ├── canvas_state.json                            │   │
│  │    ├── document_structure.json                      │   │
│  │    ├── conversation_history.json                    │   │
│  │    ├── plan/                                        │   │
│  │    │   ├── task_plan.json                          │   │
│  │    │   └── execution_state.json                    │   │
│  │    ├── content/                                     │   │
│  │    │   ├── chapter_1.json                         │   │
│  │    │   └── chapter_2.json                         │   │
│  │    └── memory/                                      │   │
│  │        ├── user_preferences.json                   │   │
│  │        ├── successful_patterns.json                │   │
│  │        └── style_guide.json                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           │ Spawns Subagents                 │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ STRUCTURE PLANNER SUBAGENT                           │   │
│  │  Task: Create document structure                     │   │
│  │  Reads: canvas_state, memory/patterns               │   │
│  │  Writes: plan/structure_plan.json                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           │ Spawns Writers                   │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CONTENT WRITER SUBAGENTS (parallel)                  │   │
│  │  - Chapter 1 Writer                                  │   │
│  │  - Chapter 2 Writer                                  │   │
│  │  - Chapter 3 Writer                                  │   │
│  │  Each: Reads plan, Writes content/                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           │ Spawns Critic                    │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CRITIC SUBAGENT                                       │   │
│  │  Task: Review and provide feedback                    │   │
│  │  Reads: content/, memory/preferences                  │   │
│  │  Writes: feedback/                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Key Components

**1. Main Orchestrator Agent**
- Entry point for all requests
- Manages virtual filesystem
- Spawns and coordinates subagents
- Maintains persistent memory

**2. Virtual Filesystem Backend**
- Stores all context as files
- Selective loading (read only what's needed)
- Persistent across sessions
- Project-scoped (one filesystem per canvas/story)

**3. Subagents**
- Specialized agents for specific tasks
- Isolated context (only relevant files)
- Can execute in parallel
- Report back to main agent

**4. Persistent Memory**
- User preferences
- Successful patterns
- Style guides
- Character profiles

---

## 3. Migration Phases

### Phase 1: Foundation & Virtual Filesystem (Weeks 1-2)

**Goal:** Set up Deep Agents infrastructure and virtual filesystem

**Tasks:**
1. Install `langchain-deepagents` package
2. Create virtual filesystem backend
3. Implement file storage for canvas state
4. Implement file storage for document structure
5. Implement file storage for conversation history
6. Create migration utilities (convert current state → files)

**Deliverables:**
- `orchestrator/agents/deep_agent_backend.py`: Virtual filesystem backend
- `orchestrator/agents/file_storage.py`: File storage utilities
- `orchestrator/agents/migration_utils.py`: State → files conversion
- Tests for file storage

**Success Criteria:**
- ✅ Can store/retrieve canvas state as JSON file
- ✅ Can store/retrieve document structure as JSON file
- ✅ Can store/retrieve conversation history as JSON file
- ✅ No performance degradation (< 50ms overhead)

**Rollback:** Can disable filesystem and use current state directly

---

### Phase 2: Deep Agent Planner (Weeks 3-4)

**Goal:** Replace `generate_actions_node` with Deep Agent planner

**Tasks:**
1. Create Deep Agent instance
2. Implement planning system prompt
3. Replace `generate_actions_node` with agent planner
4. Store plans in virtual filesystem
5. Convert plans to actions (backward compatibility)
6. Add plan visualization/debugging

**Deliverables:**
- `orchestrator/agents/planner_agent.py`: Deep Agent planner
- `orchestrator/agents/plan_converter.py`: Plan → Actions converter
- Updated `generate_actions_node` (uses planner)
- Plan storage in `/project/plan/`

**Success Criteria:**
- ✅ Agent creates detailed task plans
- ✅ Plans stored in filesystem
- ✅ Plans convert to actions (backward compatible)
- ✅ Plan quality better than current (user feedback)

**Rollback:** Can switch back to old `generate_actions_node`

---

### Phase 3: Context Management (Weeks 5-6)

**Goal:** Replace context strings with selective file loading

**Tasks:**
1. Update `analyze_intent_node` to read from filesystem
2. Update `writer_node` to read from filesystem
3. Implement selective context loading
4. Remove `canvas_context` string from state
5. Add context caching
6. Monitor context window usage

**Deliverables:**
- Updated `analyze_intent_node` (reads files)
- Updated `writer_node` (reads files)
- Context loading utilities
- Context usage monitoring

**Success Criteria:**
- ✅ Context window usage reduced by 30-50%
- ✅ No context overflow errors
- ✅ Intent analysis quality maintained/improved
- ✅ Performance acceptable (< 100ms overhead)

**Rollback:** Can restore `canvas_context` string

---

### Phase 4: Subagent Spawning (Weeks 7-9)

**Goal:** Replace `writer_node` with Deep Agent that spawns subagents

**Tasks:**
1. Create writer Deep Agent
2. Implement subagent spawning for sections/chapters
3. Implement parallel execution
4. Update `critic_node` to use subagent
5. Add subagent coordination
6. Handle subagent errors

**Deliverables:**
- `orchestrator/agents/writer_agent.py`: Main writer agent
- `orchestrator/agents/section_writer_subagent.py`: Section writer
- `orchestrator/agents/critic_subagent.py`: Critic subagent
- Updated `writer_node` (uses agent)
- Updated `critic_node` (uses subagent)

**Success Criteria:**
- ✅ Can spawn subagents for parallel writing
- ✅ Subagents execute independently
- ✅ Better content quality (user feedback)
- ✅ Faster execution for multi-section tasks

**Rollback:** Can revert to old `writer_node` and `critic_node`

---

### Phase 5: Persistent Memory (Weeks 10-11)

**Goal:** Implement persistent memory for learning and personalization

**Tasks:**
1. Create memory storage structure
2. Implement preference learning
3. Implement pattern learning
4. Implement style guide extraction
5. Update planner to read memory
6. Update writer to use memory

**Deliverables:**
- `orchestrator/agents/memory_manager.py`: Memory management
- `orchestrator/agents/preference_learner.py`: Preference learning
- `orchestrator/agents/pattern_learner.py`: Pattern learning
- Memory storage in `/project/memory/`
- Memory usage in planner and writer

**Success Criteria:**
- ✅ Preferences learned and stored
- ✅ Patterns remembered across sessions
- ✅ Personalization improves over time
- ✅ User satisfaction increases

**Rollback:** Can disable memory and use current pattern learning

---

### Phase 6: Testing & Optimization (Week 12)

**Goal:** Comprehensive testing and performance optimization

**Tasks:**
1. End-to-end testing
2. Performance benchmarking
3. Memory usage optimization
4. Error handling improvements
5. Documentation
6. User acceptance testing

**Deliverables:**
- Test suite
- Performance benchmarks
- Documentation
- Migration guide

**Success Criteria:**
- ✅ All tests pass
- ✅ Performance meets targets
- ✅ Documentation complete
- ✅ User acceptance achieved

---

## 4. Technical Implementation

### 4.1 Phase 1: Virtual Filesystem Backend

**File:** `orchestrator/agents/deep_agent_backend.py`

```python
"""
Virtual Filesystem Backend for Deep Agents

Stores orchestrator state as files in a project-scoped filesystem.
Each canvas/story gets its own filesystem instance.
"""

from pathlib import Path
from typing import Optional, Dict, Any
import json
from langchain_deepagents.backends import Backend

class OrchestratorFilesystemBackend(Backend):
    """
    Virtual filesystem backend scoped to a project (canvas/story).
    
    File Structure:
    /project/
      ├── canvas_state.json
      ├── document_structure.json
      ├── conversation_history.json
      ├── plan/
      │   ├── task_plan.json
      │   └── execution_state.json
      ├── content/
      │   ├── chapter_1.json
      │   └── chapter_2.json
      └── memory/
          ├── user_preferences.json
          ├── successful_patterns.json
          └── style_guide.json
    """
    
    def __init__(self, project_id: str, base_path: Optional[Path] = None):
        """
        Initialize filesystem backend for a project.
        
        Args:
            project_id: Canvas/story ID (scopes the filesystem)
            base_path: Base path for storage (default: /tmp/orchestrator/{project_id})
        """
        self.project_id = project_id
        self.base_path = base_path or Path(f"/tmp/orchestrator/{project_id}")
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        # Create directory structure
        (self.base_path / "plan").mkdir(exist_ok=True)
        (self.base_path / "content").mkdir(exist_ok=True)
        (self.base_path / "memory").mkdir(exist_ok=True)
        (self.base_path / "feedback").mkdir(exist_ok=True)
    
    def write_file(self, file_path: str, content: Any) -> None:
        """Write content to a file in the filesystem."""
        full_path = self.base_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        if isinstance(content, (dict, list)):
            with open(full_path, 'w') as f:
                json.dump(content, f, indent=2)
        else:
            with open(full_path, 'w') as f:
                f.write(str(content))
    
    def read_file(self, file_path: str) -> Any:
        """Read content from a file in the filesystem."""
        full_path = self.base_path / file_path
        
        if not full_path.exists():
            return None
        
        with open(full_path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return f.read()
    
    def list_files(self, directory: str = "") -> list[str]:
        """List files in a directory."""
        dir_path = self.base_path / directory
        if not dir_path.exists():
            return []
        
        return [str(f.relative_to(self.base_path)) for f in dir_path.iterdir()]
    
    def delete_file(self, file_path: str) -> None:
        """Delete a file from the filesystem."""
        full_path = self.base_path / file_path
        if full_path.exists():
            full_path.unlink()
    
    def clear_project(self) -> None:
        """Clear all files for this project."""
        import shutil
        if self.base_path.exists():
            shutil.rmtree(self.base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
```

**File:** `orchestrator/agents/file_storage.py`

```python
"""
File Storage Utilities

Converts OrchestratorState to/from filesystem storage.
"""

from typing import Dict, Any
from .deep_agent_backend import OrchestratorFilesystemBackend

def store_state_to_filesystem(
    backend: OrchestratorFilesystemBackend,
    state: Dict[str, Any]
) -> None:
    """
    Store OrchestratorState fields to filesystem.
    
    Maps state fields to files:
    - canvas_context → canvas_state.json
    - structure_items → document_structure.json
    - conversation_history → conversation_history.json
    """
    # Store canvas state
    if state.get("canvas_context"):
        backend.write_file("canvas_state.json", state["canvas_context"])
    
    # Store document structure
    if state.get("structure_items"):
        backend.write_file("document_structure.json", {
            "items": state["structure_items"],
            "format": state.get("document_format"),
            "active_segment": state.get("active_segment")
        })
    
    # Store conversation history
    if state.get("conversation_history"):
        backend.write_file("conversation_history.json", {
            "messages": state["conversation_history"],
            "session_id": state.get("session_id")
        })

def load_context_from_filesystem(
    backend: OrchestratorFilesystemBackend,
    context_type: str
) -> Any:
    """
    Load specific context from filesystem.
    
    Args:
        context_type: "canvas" | "document" | "conversation" | "memory"
    
    Returns:
        Context data or None
    """
    file_map = {
        "canvas": "canvas_state.json",
        "document": "document_structure.json",
        "conversation": "conversation_history.json",
        "preferences": "memory/user_preferences.json",
        "patterns": "memory/successful_patterns.json"
    }
    
    file_path = file_map.get(context_type)
    if not file_path:
        return None
    
    return backend.read_file(file_path)
```

---

### 4.2 Phase 2: Deep Agent Planner

**File:** `orchestrator/agents/planner_agent.py`

```python
"""
Deep Agent Planner

Replaces generate_actions_node with a Deep Agent that creates
detailed task plans with decomposition.
"""

from langchain_deepagents import DeepAgent
from langchain_deepagents.tools import TodoListTool
from typing import Dict, Any, List
from .deep_agent_backend import OrchestratorFilesystemBackend

class PlannerAgent:
    """
    Deep Agent that plans tasks by decomposing them into sub-tasks.
    
    Replaces the fixed action generation with dynamic planning.
    """
    
    def __init__(self, backend: OrchestratorFilesystemBackend):
        self.backend = backend
        self.agent = DeepAgent(
            backend=backend,
            system_prompt=self._get_system_prompt(),
            tools=[TodoListTool()]  # Built-in planning tool
        )
    
    def _get_system_prompt(self) -> str:
        return """You are Publo's creative writing orchestrator planner.

Your job is to break down user requests into detailed, executable plans.

When a user asks to:
- Create a story structure → Plan: research structure, create outline, generate sections
- Write content → Plan: identify target section, gather context, write content, review
- Edit content → Plan: identify changes, update content, verify consistency

Always create a todo list with clear steps. Each step should be:
1. Specific and actionable
2. Have clear dependencies
3. Include context needed
4. Specify expected output

Store your plan in /project/plan/task_plan.json"""
    
    async def create_plan(
        self,
        user_message: str,
        intent: Dict[str, Any],
        context_files: List[str]
    ) -> Dict[str, Any]:
        """
        Create a detailed plan for the user's request.
        
        Args:
            user_message: User's request
            intent: Intent analysis result
            context_files: Files to read for context
        
        Returns:
            Plan dictionary with steps, dependencies, and metadata
        """
        # Build task description
        task = f"""
User Request: {user_message}
Intent: {intent.get('intent')}
Confidence: {intent.get('confidence')}
Reasoning: {intent.get('reasoning')}

Context files available:
{chr(10).join(f"- {f}" for f in context_files)}

Create a detailed plan to fulfill this request.
Break it down into clear, executable steps.
"""
        
        # Agent creates plan using TodoListTool
        result = await self.agent.act(task)
        
        # Extract plan from result
        plan = {
            "task": user_message,
            "intent": intent.get('intent'),
            "steps": result.get('todo_list', []),
            "created_at": result.get('timestamp'),
            "status": "planned"
        }
        
        # Store plan in filesystem
        self.backend.write_file("plan/task_plan.json", plan)
        
        return plan
```

**File:** `orchestrator/agents/plan_converter.py`

```python
"""
Plan to Actions Converter

Converts Deep Agent plans to OrchestratorActions for backward compatibility.
"""

from typing import Dict, Any, List

def convert_plan_to_actions(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Convert a Deep Agent plan to OrchestratorActions.
    
    This maintains backward compatibility with the existing workflow.
    """
    actions = []
    steps = plan.get("steps", [])
    
    for step in steps:
        # Map plan step to action type
        action_type = _map_step_to_action_type(step)
        
        action = {
            "type": action_type,
            "payload": {
                "step_id": step.get("id"),
                "description": step.get("description"),
                "dependencies": step.get("dependencies", []),
                **step.get("payload", {})
            },
            "requiresUserInput": step.get("requires_user_input", False),
            "priority": step.get("priority", "normal"),
            "status": "pending",
            "dependsOn": step.get("dependencies", []),
            "autoExecute": not step.get("requires_user_input", False)
        }
        
        actions.append(action)
    
    return actions

def _map_step_to_action_type(step: Dict[str, Any]) -> str:
    """Map plan step to action type."""
    description = step.get("description", "").lower()
    
    if "structure" in description or "outline" in description:
        return "generate_structure"
    elif "content" in description or "write" in description:
        return "generate_content"
    elif "review" in description or "critic" in description:
        return "review_content"
    elif "research" in description:
        return "research"
    else:
        return "general_task"
```

**Updated Node:** `orchestrator/graph/nodes.py` (generate_actions_node)

```python
async def generate_actions_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 2: Generate actions using Deep Agent planner.
    
    NEW: Uses Deep Agent to create detailed plans, then converts to actions.
    """
    from orchestrator.agents.planner_agent import PlannerAgent
    from orchestrator.agents.plan_converter import convert_plan_to_actions
    from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend
    
    # Initialize backend for this session
    session_id = state.get("session_id", "default")
    backend = OrchestratorFilesystemBackend(project_id=session_id)
    
    # Store current state to filesystem
    from orchestrator.agents.file_storage import store_state_to_filesystem
    store_state_to_filesystem(backend, state)
    
    # Create planner agent
    planner = PlannerAgent(backend)
    
    # Get intent
    intent = state.get("intent", {}) or {}
    
    # Create plan
    plan = await planner.create_plan(
        user_message=state.get("user_message", ""),
        intent=intent,
        context_files=["canvas_state.json", "document_structure.json", "conversation_history.json"]
    )
    
    # Convert plan to actions (backward compatibility)
    actions = convert_plan_to_actions(plan)
    
    # Check if clarification needed (from intent)
    needs_clarification = intent.get("needsClarification", False)
    
    return {
        "actions": actions,
        "plan": plan,  # Store plan for execution
        "needs_clarification": needs_clarification,
        "clarification_options": intent.get("clarificationOptions", []),
        "clarification_message": intent.get("clarifyingQuestion"),
        "original_action": intent.get("suggestedAction")
    }
```

---

### 4.3 Phase 3: Context Management

**Updated Node:** `orchestrator/graph/nodes.py` (analyze_intent_node)

```python
async def analyze_intent_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 1: Analyze intent using context from filesystem.
    
    NEW: Reads context from filesystem instead of state strings.
    """
    from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend
    from orchestrator.agents.file_storage import load_context_from_filesystem
    
    # Initialize backend
    session_id = state.get("session_id", "default")
    backend = OrchestratorFilesystemBackend(project_id=session_id)
    
    # Load context from filesystem (selective loading)
    canvas_context = load_context_from_filesystem(backend, "canvas")
    document_context = load_context_from_filesystem(backend, "document")
    conversation_context = load_context_from_filesystem(backend, "conversation")
    
    # Build PipelineContext from files (not state strings)
    from orchestrator.intent.types import PipelineContext
    
    context = PipelineContext(
        message=state.get("user_message", ""),
        activeSegment=document_context.get("active_segment") if document_context else None,
        documentPanelOpen=state.get("document_panel_open", False),
        documentFormat=document_context.get("format") if document_context else state.get("document_format"),
        canvasContext=canvas_context,  # Already loaded from file
        conversationHistory=conversation_context.get("messages", []) if conversation_context else []
    )
    
    # Run intent analysis (existing logic)
    from orchestrator.intent.analyzer import analyze_intent
    result = await analyze_intent(state.get("user_message", ""), context)
    
    return {
        "intent": {
            "intent": result.intent,
            "confidence": result.confidence,
            "reasoning": result.reasoning,
            "suggestedAction": result.suggestedAction,
            "requiresContext": result.requiresContext,
            "suggestedModel": result.suggestedModel,
            "needsClarification": result.needsClarification,
            "clarifyingQuestion": result.clarifyingQuestion,
            "extractedEntities": result.extractedEntities
        },
        "messages": [{
            "role": "orchestrator",
            "content": f"Analyzed intent: {result.intent} (confidence: {result.confidence})",
            "type": "thinking"
        }]
    }
```

---

### 4.4 Phase 4: Subagent Spawning

**File:** `orchestrator/agents/writer_agent.py`

```python
"""
Writer Deep Agent with Subagent Spawning

Replaces writer_node with a Deep Agent that spawns subagents
for parallel content generation.
"""

from langchain_deepagents import DeepAgent
from typing import Dict, Any, List
from .deep_agent_backend import OrchestratorFilesystemBackend

class WriterAgent:
    """
    Main writer agent that spawns subagents for parallel writing.
    """
    
    def __init__(self, backend: OrchestratorFilesystemBackend):
        self.backend = backend
        self.agent = DeepAgent(
            backend=backend,
            system_prompt=self._get_system_prompt()
        )
    
    def _get_system_prompt(self) -> str:
        return """You are Publo's creative writing orchestrator writer.

Your job is to coordinate content generation by spawning specialized
subagents for each section/chapter that needs to be written.

When you receive a writing task:
1. Identify all sections that need content
2. Spawn a subagent for each section
3. Coordinate subagents to ensure consistency
4. Collect results and merge them

Each subagent should:
- Focus on one section only
- Read relevant context from filesystem
- Write content to filesystem
- Report progress back to you"""
    
    async def generate_content(
        self,
        actions: List[Dict[str, Any]],
        plan: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate content by spawning subagents.
        
        Args:
            actions: List of generate_content actions
            plan: Task plan from planner
        
        Returns:
            Results dictionary with section_id -> content
        """
        results = {}
        
        # Identify sections to write
        content_actions = [a for a in actions if a.get("type") == "generate_content"]
        
        # Spawn subagent for each section
        for action in content_actions:
            section_id = action.get("payload", {}).get("section_id")
            section_name = action.get("payload", {}).get("section_name", "Section")
            
            # Spawn subagent
            subagent = await self.agent.spawn_subagent(
                name=f"writer_{section_id}",
                task=f"Write content for {section_name}",
                context_files=[
                    "plan/task_plan.json",
                    "document_structure.json",
                    f"content/{section_id}_context.json"  # Section-specific context
                ]
            )
            
            # Execute subagent
            content = await subagent.execute()
            
            # Store result
            self.backend.write_file(f"content/{section_id}.json", {
                "section_id": section_id,
                "section_name": section_name,
                "content": content,
                "status": "completed"
            })
            
            results[section_id] = content
        
        return results
```

**Updated Node:** `orchestrator/graph/nodes.py` (writer_node)

```python
async def writer_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 5: Generate content using Writer Deep Agent.
    
    NEW: Uses Deep Agent that spawns subagents for parallel writing.
    """
    from orchestrator.agents.writer_agent import WriterAgent
    from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend
    
    # Initialize backend
    session_id = state.get("session_id", "default")
    backend = OrchestratorFilesystemBackend(project_id=session_id)
    
    # Get plan and actions
    plan = state.get("plan", {})
    actions = state.get("actions", [])
    
    # Create writer agent
    writer = WriterAgent(backend)
    
    # Generate content
    results = await writer.generate_content(actions, plan)
    
    return {
        "results": results,
        "messages": [{
            "role": "orchestrator",
            "content": f"Generated content for {len(results)} sections",
            "type": "result"
        }]
    }
```

---

### 4.5 Phase 5: Persistent Memory

**File:** `orchestrator/agents/memory_manager.py`

```python
"""
Memory Manager for Persistent Learning

Stores and retrieves user preferences, patterns, and style guides.
"""

from typing import Dict, Any, Optional
from .deep_agent_backend import OrchestratorFilesystemBackend

class MemoryManager:
    """
    Manages persistent memory for learning and personalization.
    """
    
    def __init__(self, backend: OrchestratorFilesystemBackend):
        self.backend = backend
    
    def load_preferences(self) -> Dict[str, Any]:
        """Load user preferences from memory."""
        return self.backend.read_file("memory/user_preferences.json") or {}
    
    def save_preference(self, key: str, value: Any) -> None:
        """Save a user preference."""
        prefs = self.load_preferences()
        prefs[key] = value
        self.backend.write_file("memory/user_preferences.json", prefs)
    
    def load_patterns(self) -> List[Dict[str, Any]]:
        """Load successful patterns from memory."""
        return self.backend.read_file("memory/successful_patterns.json") or []
    
    def save_pattern(self, pattern: Dict[str, Any]) -> None:
        """Save a successful pattern."""
        patterns = self.load_patterns()
        patterns.append(pattern)
        self.backend.write_file("memory/successful_patterns.json", patterns)
    
    def load_style_guide(self) -> Dict[str, Any]:
        """Load writing style guide from memory."""
        return self.backend.read_file("memory/style_guide.json") or {}
    
    def update_style_guide(self, updates: Dict[str, Any]) -> None:
        """Update writing style guide."""
        style = self.load_style_guide()
        style.update(updates)
        self.backend.write_file("memory/style_guide.json", style)
```

---

## 5. Risk Assessment

### 5.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Deep Agents API changes** | High | Medium | Pin version, monitor updates |
| **Performance degradation** | Medium | Low | Benchmark each phase, optimize |
| **Context loading overhead** | Medium | Medium | Implement caching, lazy loading |
| **Subagent coordination complexity** | High | Medium | Start simple, add complexity gradually |
| **Memory storage growth** | Low | High | Implement cleanup, size limits |

### 5.2 Migration Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Breaking existing workflow** | High | Low | Maintain backward compatibility |
| **User experience disruption** | Medium | Low | Feature flags, gradual rollout |
| **Data loss during migration** | High | Low | Backup before migration, test thoroughly |
| **Rollback complexity** | Medium | Medium | Each phase is independently rollbackable |

### 5.3 Mitigation Strategies

1. **Feature Flags**: Each phase behind a feature flag
2. **Backward Compatibility**: Maintain old code paths
3. **Gradual Rollout**: Test with subset of users first
4. **Comprehensive Testing**: Unit, integration, and E2E tests
5. **Monitoring**: Track performance, errors, user satisfaction

---

## 6. Success Metrics

### 6.1 Performance Metrics

- **Context Window Usage**: Reduce by 30-50%
- **Task Completion Time**: Maintain or improve
- **Error Rate**: < 1% (same as current)
- **Memory Overhead**: < 100MB per project

### 6.2 Quality Metrics

- **Plan Quality**: User feedback score > 4/5
- **Content Quality**: User satisfaction > 4/5
- **Personalization**: User reports "feels personalized"
- **Learning**: System remembers preferences across sessions

### 6.3 User Experience Metrics

- **User Satisfaction**: Survey score > 4/5
- **Feature Adoption**: > 80% of users benefit from memory
- **Error Recovery**: Automatic recovery rate > 90%
- **Support Tickets**: No increase in support requests

---

## 7. Rollback Strategy

### 7.1 Per-Phase Rollback

Each phase can be rolled back independently:

**Phase 1 Rollback:**
- Disable filesystem, use state directly
- Remove file storage calls

**Phase 2 Rollback:**
- Switch back to old `generate_actions_node`
- Remove planner agent

**Phase 3 Rollback:**
- Restore `canvas_context` string
- Remove file loading

**Phase 4 Rollback:**
- Revert to old `writer_node` and `critic_node`
- Remove subagent spawning

**Phase 5 Rollback:**
- Disable memory, use current pattern learning
- Remove memory manager

### 7.2 Full Rollback

If complete rollback needed:
1. Revert code to pre-migration state
2. Remove Deep Agents dependencies
3. Restore old workflow
4. Clear filesystem data (if needed)

---

## 8. Dependencies

### 8.1 New Packages

```txt
# orchestrator/requirements.txt additions
langchain-deepagents>=0.1.0  # Deep Agents framework
```

### 8.2 Version Compatibility

- Ensure compatibility with existing LangChain/LangGraph versions
- Test with current dependencies first
- Update if needed

---

## 9. Testing Strategy

### 9.1 Unit Tests

- File storage utilities
- Plan converter
- Memory manager
- Context loading

### 9.2 Integration Tests

- Planner agent with filesystem
- Writer agent with subagents
- Memory persistence
- End-to-end workflow

### 9.3 User Acceptance Tests

- Real user scenarios
- Performance benchmarks
- Quality assessments
- Feedback collection

---

## 10. Timeline Summary

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: Foundation | 2 weeks | Week 1 | Week 2 |
| Phase 2: Planner | 2 weeks | Week 3 | Week 4 |
| Phase 3: Context | 2 weeks | Week 5 | Week 6 |
| Phase 4: Subagents | 3 weeks | Week 7 | Week 9 |
| Phase 5: Memory | 2 weeks | Week 10 | Week 11 |
| Phase 6: Testing | 1 week | Week 12 | Week 12 |

**Total: 12 weeks (3 months)**

---

## 11. Next Steps

1. **Review and Approve Plan**: Get stakeholder approval
2. **Set Up Development Environment**: Install Deep Agents, create branch
3. **Begin Phase 1**: Start with filesystem backend
4. **Weekly Reviews**: Check progress, adjust as needed
5. **User Feedback**: Collect feedback at each phase

---

## 12. Questions & Considerations

### Open Questions

1. **Storage Backend**: Use local filesystem or cloud storage (S3, etc.)?
2. **Memory Retention**: How long to keep memory? Per-user or per-project?
3. **Subagent Limits**: Maximum number of concurrent subagents?
4. **Plan Complexity**: Maximum plan depth/steps?

### Considerations

- **Cost**: Deep Agents may increase LLM API calls (more agents)
- **Complexity**: More moving parts = more to maintain
- **Learning Curve**: Team needs to learn Deep Agents API
- **Vendor Lock-in**: Deep Agents is LangChain-specific

---

## Conclusion

This migration plan provides a structured approach to integrating Deep Agents into Publo's orchestrator. The phased approach allows for:

- ✅ Incremental progress
- ✅ Risk mitigation
- ✅ Easy rollback
- ✅ Continuous improvement

Each phase builds on the previous, ensuring a smooth transition while maintaining system stability.

**Ready to begin Phase 1?** 🚀

