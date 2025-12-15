"""
LangGraph Node Functions

This file contains all the processing nodes in the orchestrator workflow.
Each node is a function that processes the shared state and returns updates.

Key Concepts:
- Nodes receive OrchestratorState (shared data structure)
- Nodes return ONLY the fields they want to update (LangGraph merges automatically)
- Nodes are async functions (can call LLMs, APIs, etc.)
- Nodes are connected by edges defined in workflow.py

Node Execution Flow:
1. analyze_intent_node → Understands what user wants
2. generate_actions_node → Creates action plan based on intent
3. select_strategy_node → Chooses execution approach
4. tool_executor_node → Executes external tools (MCP, web search, etc.)
5. writer_node → Generates content/structure using LLM
6. critic_node → Reviews writer output for quality
7. merge_results_node → Prepares final response

Each node is independent and can be tested/modified separately.
"""

from typing import Dict, Any, Optional
from .state import OrchestratorState
from langsmith import traceable

@traceable(name="analyze_intent")
async def analyze_intent_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 1: Analyze user intent from their message.
    
    This is the FIRST node in the workflow (entry point).
    It uses LLM to understand what the user wants to do.
    
    Input (from state):
        - user_message: The user's input text
        - active_segment: Currently selected section (if any)
        - document_panel_open: Whether document panel is visible
        - document_format: Format of current document (novel, screenplay, etc.)
        - canvas_context: Description of canvas state
        - conversation_history: Recent messages for context
    
    Output (updates state):
        - intent: {
            intent: "write_content" | "create_structure" | "navigate_section" | etc.
            confidence: 0.0-1.0 (how certain we are)
            reasoning: "Why we think this is the intent"
            extractedEntities: { sectionId, format, template, etc. }
          }
        - messages: Thinking message for UI
    
    Process:
        1. Build PipelineContext from state
        2. Call intent analyzer (uses LLM to classify intent)
        3. Return intent classification + confidence
    
    Next node: generate_actions_node (always)
    
    Example intents:
        - "write_content" → User wants to write/improve content
        - "create_structure" → User wants to create new document structure
        - "navigate_section" → User wants to jump to a section
        - "open_document" → User wants to open a document node
        - "answer_question" → User asked a question
        - "general_chat" → Casual conversation
    """
    print(f"🔍 [Node] Analyzing intent for: {state.get('user_message', '')[:50]}...")
    
    try:
        # Import here to avoid circular imports
        from core.intent.analyzer import analyze_intent
        from core.intent.types import PipelineContext
        import os
        
        # ============================================================
        # PHASE 3: CONTEXT MANAGEMENT (OPTIONAL)
        # ============================================================
        # Load context from filesystem if feature flag enabled
        # This reduces context window usage by loading only what's needed
        USE_DEEP_AGENTS_CONTEXT = os.getenv("USE_DEEP_AGENTS_CONTEXT", "false").lower() == "true"
        
        canvas_context = None
        conversation_history = []
        active_seg = state.get("active_segment")
        
        if USE_DEEP_AGENTS_CONTEXT:
            try:
                import sys
                from pathlib import Path
                # ✅ FIX: Add project root to path for imports
                current_file = Path(__file__).resolve()
                project_root = current_file.parent.parent.parent
                if str(project_root) not in sys.path:
                    sys.path.insert(0, str(project_root))
                
                from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend
                from orchestrator.agents.file_storage import load_context_from_filesystem
                from orchestrator.agents.migration_utils import initialize_filesystem_for_session
                
                # Initialize filesystem if not already done (Phase 1)
                filesystem_meta = state.get("_filesystem", {})
                if filesystem_meta.get("enabled"):
                    session_id = filesystem_meta.get("project_id")
                    backend = OrchestratorFilesystemBackend(project_id=session_id)
                else:
                    # Initialize filesystem for this session
                    session_id = state.get("session_id") or f"session-{state.get('user_id', 'default')}"
                    backend = initialize_filesystem_for_session(session_id, state)
                
                # Load context from filesystem (selective loading)
                canvas_data = load_context_from_filesystem(backend, "canvas")
                conversation_data = load_context_from_filesystem(backend, "conversation")
                document_data = load_context_from_filesystem(backend, "document")
                
                # Convert filesystem data to context format
                if canvas_data:
                    # canvas_data is already a dict (from filesystem)
                    import json
                    canvas_context = json.dumps(canvas_data) if isinstance(canvas_data, dict) else str(canvas_data)
                
                if conversation_data:
                    conversation_history = conversation_data.get("messages", [])
                
                # Update active_segment from document data if available
                if document_data and not active_seg:
                    active_seg = document_data.get("active_segment")
                
                print(f"💾 [Context] Loaded from filesystem: canvas={bool(canvas_data)}, conversation={len(conversation_history)} messages")
                
            except Exception as e:
                # Fallback to state if filesystem fails
                print(f"⚠️ [Context] Filesystem loading failed (using state): {e}")
                canvas_context = state.get("canvas_context")
                conversation_history = state.get("conversation_history", [])
        else:
            # Original behavior: read from state
            canvas_context = state.get("canvas_context")
            conversation_history = state.get("conversation_history", [])
        
        # ============================================================
        # BUILD CONTEXT FOR INTENT ANALYSIS
        # ============================================================
        # The intent analyzer needs context to make good decisions:
        # - What section is active? (affects "write_content" vs "create_structure")
        # - What's on the canvas? (helps resolve references like "that story")
        # - Conversation history? (understands follow-ups)
        context = PipelineContext(
            message=state.get("user_message", ""),
            activeSegment=active_seg,
            documentPanelOpen=state.get("document_panel_open", False),
            documentFormat=state.get("document_format"),
            canvasContext=canvas_context,
            conversationHistory=conversation_history
        )
        
        # ============================================================
        # RUN INTENT ANALYSIS (LLM CALL)
        # ============================================================
        # This calls the intent analyzer which uses LLM to classify the intent
        result = await analyze_intent(state.get("user_message", ""), context)
        
        print(f"✅ [Node] Intent: {result.intent} (confidence: {result.confidence})")
        
        # ============================================================
        # RETURN STATE UPDATES
        # ============================================================
        # Only return fields we want to update - LangGraph merges automatically
        return {
            "intent": result.model_dump(),  # Full intent data (type, confidence, entities)
            "messages": [{
                "role": "orchestrator",
                "content": f"Intent: {result.intent} ({result.confidence:.0%} confidence)",
                "type": "thinking"
            }]
        }
        
    except Exception as e:
        print(f"❌ [Node] Intent analysis error: {e}")
        # On error, set intent to "unknown" so workflow can handle gracefully
        return {
            "intent": {"intent": "unknown", "confidence": 0.0, "reasoning": str(e)},
            "messages": [{
                "role": "system",
                "content": f"Intent analysis failed: {str(e)}",
                "type": "error"
            }],
            "error": str(e)
        }


def select_strategy_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 3: Select execution strategy based on intent and actions.
    
    This node decides HOW to execute the actions:
    - Sequential: Simple, fast execution (1-2 actions)
    - Parallel: Multiple independent actions (3+ sections)
    - Cluster: High-quality mode with writer-critic loop
    
    Input (from state):
        - intent: Intent classification from analyze_intent_node
        - actions: Action list from generate_actions_node
        - enable_critic: Whether critic is enabled (feature flag)
    
    Output (updates state):
        - strategy: "sequential" | "parallel" | "cluster"
        - messages: Strategy selection message
    
    Strategy Selection Logic:
        1. Simple intents (chat, navigate) → sequential (fast, no quality needed)
        2. Structure creation → sequential (single action)
        3. 3+ actions → parallel (can do multiple things at once)
        4. High-confidence writing → cluster (use writer-critic for quality)
        5. Default → sequential (safe fallback)
    
    Next node: needs_action() routing function decides what to do next
    
    Why strategies matter:
        - Sequential: Fast, good for simple tasks
        - Parallel: Efficient for bulk operations
        - Cluster: Best quality, uses writer-critic feedback loop
    """
    intent = state.get("intent", {}) or {}
    intent_type = intent.get("intent", "")
    actions = state.get("actions", []) or []
    enable_critic = state.get("enable_critic", True)
    
    # ============================================================
    # STRATEGY SELECTION LOGIC
    # ============================================================
    # Decision tree based on intent type and action count
    
    # Simple intents → sequential (fast execution)
    if intent_type in ["answer_question", "general_chat", "navigate_section"]:
        strategy = "sequential"
    
    # Structure creation → sequential (single action, no need for parallel)
    elif intent_type == "create_structure":
        strategy = "sequential"
    
    # Many actions → parallel (can execute independently)
    elif len(actions) >= 3:
        strategy = "parallel"
    
    # High-quality writing → cluster (use writer-critic loop)
    elif intent_type in ["write_content", "improve_content"] and enable_critic:
        confidence = intent.get("confidence", 0)
        if confidence > 0.9:
            strategy = "cluster"  # High-quality writing uses writer-critic
        else:
            strategy = "sequential"
    
    # Default fallback
    else:
        strategy = "sequential"
    
    print(f"📋 [Node] Selected strategy: {strategy}")
    
    return {
        "strategy": strategy,
        "messages": [{
            "role": "orchestrator",
            "content": f"Strategy: {strategy}",
            "type": "thinking"
        }]
    }


@traceable(name="generate_actions")
async def generate_actions_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 2: Generate actions based on analyzed intent.
    
    This node converts the intent into concrete actions that can be executed.
    It's like a "planning" step - "what do we need to do?"
    
    PHASE 2: Now supports Deep Agent Planner (optional, feature flag)
    - If USE_DEEP_AGENTS_PLANNER=true, uses PlannerAgent for dynamic planning
    - Otherwise, uses original rule-based action generation
    
    Input (from state):
        - intent: Intent classification from analyze_intent_node
        - clarification_response: User's response to clarification (if any)
        - active_segment: Currently selected section
        - structure_items: Available sections in document
        - canvas_nodes: Nodes on the canvas
        - _filesystem: Filesystem metadata (if Phase 1 enabled)
    
    Output (updates state):
        - actions: List of actions to execute, e.g.:
            {
                type: "generate_content" | "generate_structure" | "select_section" | etc.
                payload: { sectionId, prompt, format, template, etc. }
                requiresUserInput: true/false
                priority: "high" | "normal" | "low"
                status: "pending"
            }
        - plan: Deep Agent plan (if planner used)
        - needs_clarification: true if user needs to choose an option
        - clarification_options: List of options for user to choose
        - clarification_message: Question to ask user
        - original_action: Which action needs clarification
    
    Action Types:
        - generate_content: Write content for a section
        - generate_structure: Create new document structure
        - select_section: Navigate to a specific section
        - open_document: Open a document node on canvas
        - delete_node: Delete a canvas node
        - message: Send a message to user (error/info)
    - request_clarification: Ask user to choose from options
    
    Clarification Flow:
        If action needs user input (e.g., "which template?"), this node:
        1. Sets needs_clarification = True
        2. Creates clarification_options with choices
        3. Sets original_action so we know what to do after user responds
        4. Workflow pauses and waits for user selection
    
    Next node: select_strategy_node (always)
    """
    import os
    
    # ============================================================
    # CLARIFICATION RESPONSE HANDLING (CHECK FIRST!)
    # ============================================================
    # If user responded to a clarification, process it before anything else.
    # This must run BEFORE the planner to prevent re-analysis of the response.
    clarification_response = state.get("clarification_response")
    if clarification_response:
        response_action = clarification_response.get("original_action")
        selected_option = clarification_response.get("option_id")
        intent = state.get("intent", {}) or {}
        
        print(f"✅ [Actions] Processing clarification response: action={response_action}, option={selected_option}")
        
        # Handle create_structure clarification (user selected a template)
        if response_action == "create_structure":
            # User selected a template - create structure with that template
            # Detect format from original user message or state
            format_type = None
            original_message = state.get("user_message", "").lower()
            available_formats = ["podcast", "novel", "screenplay", "article", "report"]
            
            for fmt in available_formats:
                if fmt in original_message:
                    format_type = fmt
                    break
            
            if not format_type:
                conversation_history = state.get("conversation_history", []) or []
                for msg in reversed(conversation_history):
                    msg_content = (msg.get("content") or "").lower()
                    for fmt in available_formats:
                        if fmt in msg_content:
                            format_type = fmt
                            break
                    if format_type:
                        break
            
            if not format_type:
                format_type = state.get("document_format") or "novel"
            
            print(f"📝 [Actions] Creating structure: template={selected_option}, format={format_type}")
            return {
                "actions": [{
                    "type": "generate_structure",
                    "payload": {
                        "format": format_type,
                        "template": selected_option,
                        "prompt": state.get("user_message", "")
                    },
                    "requiresUserInput": False,
                    "priority": "high",
                    "status": "pending"
                }],
                "needs_clarification": False,
                "messages": [{"role": "orchestrator", "content": f"Creating {format_type} with template: {selected_option}", "type": "decision"}]
            }
        
        # Handle open_document clarification (user selected a document)
        elif response_action == "open_document":
            canvas_nodes = state.get("canvas_nodes", []) or []
            target_node = None
            response_lower = (selected_option or "").lower().strip()
            
            # Try by ID first
            for node in canvas_nodes:
                node_id = (node.get("id") or node.get("nodeId") or "").lower()
                if node_id == response_lower:
                    target_node = node
                    break
            
            # Try by label/name
            if not target_node:
                for node in canvas_nodes:
                    label = (node.get("label") or node.get("name") or 
                             node.get("data", {}).get("label") or "").lower()
                    if label == response_lower or response_lower in label or label in response_lower:
                        target_node = node
                        break
            
            # Try ordinal matching
            if not target_node:
                ordinal_map = {"first": 0, "1": 0, "second": 1, "2": 1, "third": 2, "3": 2}
                doc_nodes = [n for n in canvas_nodes if "story" in str(n.get("type", "")).lower()]
                for ordinal, idx in ordinal_map.items():
                    if ordinal in response_lower and idx < len(doc_nodes):
                        target_node = doc_nodes[idx]
                        break
            
            if target_node:
                node_id = target_node.get("id") or target_node.get("nodeId", "")
                node_name = (target_node.get("label") or target_node.get("name") or 
                            target_node.get("data", {}).get("label", "Document"))
                
                actions = [{
                    "type": "open_document",
                    "payload": {"nodeId": node_id, "nodeName": node_name},
                    "requiresUserInput": False,
                    "priority": "high",
                    "status": "pending"
                }]
                
                # Check if user also wanted to write content
                user_message = (state.get("user_message") or "").lower()
                if any(w in user_message for w in ["write", "writing", "chapter"]):
                    structure_items = state.get("structure_items", []) or []
                    import re
                    chapter_match = re.search(r'chapter\s*(\d+)', user_message)
                    target_section = None
                    if chapter_match:
                        idx = int(chapter_match.group(1)) - 1
                        if 0 <= idx < len(structure_items):
                            target_section = structure_items[idx]
                    elif structure_items:
                        target_section = structure_items[0]
                    
                    if target_section:
                        actions.append({
                            "type": "generate_content",
                            "payload": {
                                "sectionId": target_section.get("id"),
                                "sectionName": target_section.get("name") or target_section.get("title"),
                                "prompt": f"Write content for {target_section.get('name')}"
                            },
                            "requiresUserInput": False,
                            "priority": "normal",
                            "status": "pending"
                        })
                
                print(f"📂 [Actions] Opening document: {node_name}")
                return {
                    "actions": actions,
                    "needs_clarification": False,
                    "messages": [{"role": "orchestrator", "content": f"Opening: {node_name}", "type": "decision"}]
                }
            else:
                # Could not find document - check if canvas_nodes is empty
                if not canvas_nodes:
                    print(f"❌ [Actions] No canvas nodes available for open_document")
                    return {
                        "actions": [],
                        "needs_clarification": False,
                        "messages": [{"role": "orchestrator", "content": "No documents found on the canvas.", "type": "error"}]
                    }
                else:
                    # Document not found - re-ask with available options
                    doc_nodes = [n for n in canvas_nodes if "story" in str(n.get("type", "")).lower()]
                    print(f"❌ [Actions] Could not resolve document '{selected_option}' from {len(doc_nodes)} documents")
                    return {
                        "actions": [],
                        "needs_clarification": True,
                        "clarification_message": f"I couldn't find '{selected_option}'. Which document would you like to open?",
                        "clarification_options": [{"id": n.get("id"), "label": n.get("label") or n.get("name") or n.get("data", {}).get("label", "Document")} for n in doc_nodes[:10]],
                        "original_action": "open_document"
                    }
        
        # Handle write_content clarification (user selected a chapter)
        elif response_action == "write_content":
            structure_items = state.get("structure_items", []) or []
            target_section = None
            response_lower = (selected_option or "").lower().strip()
            
            ordinal_map = {"first": 0, "1": 0, "second": 1, "2": 1, "third": 2, "3": 2}
            for ordinal, idx in ordinal_map.items():
                if ordinal in response_lower and idx < len(structure_items):
                    target_section = structure_items[idx]
                    break
            
            if not target_section:
                for item in structure_items:
                    if item.get("id", "").lower() == response_lower:
                        target_section = item
                        break
                    label = (item.get("name") or item.get("title") or "").lower()
                    if label == response_lower or response_lower in label:
                        target_section = item
                        break
            
            if target_section:
                # Get section name - check both 'name' and 'title' fields
                section_name = target_section.get("name") or target_section.get("title") or f"Section {target_section.get('id')}"
                print(f"✍️ [Actions] Writing chapter: {section_name}")
                return {
                    "actions": [{
                        "type": "generate_content",
                        "payload": {
                            "sectionId": target_section.get("id"),
                            "sectionName": section_name,
                            "prompt": state.get("user_message", "")
                        },
                        "requiresUserInput": False,
                        "priority": "normal",
                        "status": "pending"
                    }],
                    "needs_clarification": False,
                    "messages": [{"role": "orchestrator", "content": f"Writing: {target_section.get('name')}", "type": "decision"}]
                }
            else:
                # Could not find section - check if structure_items is empty
                if not structure_items:
                    print(f"❌ [Actions] No structure items available for write_content")
                    return {
                        "actions": [],
                        "needs_clarification": False,
                        "messages": [{"role": "orchestrator", "content": "No chapters found. Please open a document first.", "type": "error"}]
                    }
                else:
                    # Section not found - re-ask with available options
                    print(f"❌ [Actions] Could not resolve chapter '{selected_option}' from {len(structure_items)} items")
                    return {
                        "actions": [],
                        "needs_clarification": True,
                        "clarification_message": f"I couldn't find '{selected_option}'. Which chapter would you like to write?",
                        "clarification_options": [{"id": item.get("id"), "label": item.get("name") or item.get("title")} for item in structure_items[:10]],
                        "original_action": "write_content"
                    }
        
        # Handle navigate_section clarification (user selected a chapter to navigate to)
        elif response_action == "navigate_section":
            structure_items = state.get("structure_items", []) or []
            target_section = None
            response_lower = (selected_option or "").lower().strip()
            
            # Match by ID first (most reliable)
            for item in structure_items:
                if item.get("id", "").lower() == response_lower:
                    target_section = item
                    break
            
            # Match by name/title
            if not target_section:
                for item in structure_items:
                    label = (item.get("name") or item.get("title") or "").lower()
                    if label == response_lower or response_lower in label:
                        target_section = item
                        break
            
            # Match by ordinal ("first", "1", etc.)
            if not target_section:
                ordinal_map = {"first": 0, "1": 0, "second": 1, "2": 1, "third": 2, "3": 2, 
                              "fourth": 3, "4": 3, "fifth": 4, "5": 4, "sixth": 5, "6": 5,
                              "seventh": 6, "7": 6, "eighth": 7, "8": 7, "ninth": 8, "9": 8, "tenth": 9, "10": 9}
                for ordinal, idx in ordinal_map.items():
                    if ordinal in response_lower and idx < len(structure_items):
                        target_section = structure_items[idx]
                        break
            
            if target_section:
                section_id = target_section.get("id")
                section_name = target_section.get("name") or target_section.get("title")
                print(f"📍 [Actions] Navigating to: {section_name}")
                
                actions = [{
                    "type": "select_section",
                    "payload": {"sectionId": section_id, "sectionName": section_name},
                    "requiresUserInput": False,
                    "priority": "normal",
                    "status": "pending"
                }]
                
                # Check if user also wanted to write content
                user_message = (state.get("user_message") or "").lower()
                if any(w in user_message for w in ["write", "writing", "draft", "create content"]):
                    actions.append({
                        "type": "generate_content",
                        "payload": {
                            "sectionId": section_id,
                            "sectionName": section_name,
                            "prompt": state.get("user_message", "")
                        },
                        "requiresUserInput": False,
                        "priority": "normal",
                        "status": "pending"
                    })
                    print(f"✍️ [Actions] Also writing content for: {section_name}")
                
                return {
                    "actions": actions,
                    "needs_clarification": False,
                    "messages": [{"role": "orchestrator", "content": f"Navigating to: {section_name}", "type": "decision"}]
                }
            else:
                # Could not find section - check if structure_items is empty
                if not structure_items:
                    print(f"❌ [Actions] No structure items available for navigate_section")
                    return {
                        "actions": [],
                        "needs_clarification": False,
                        "messages": [{"role": "orchestrator", "content": "No chapters found. Please open a document first.", "type": "error"}]
                    }
                else:
                    # Section not found - re-ask with available options
                    print(f"❌ [Actions] Could not resolve chapter '{selected_option}' from {len(structure_items)} items")
                    return {
                        "actions": [],
                        "needs_clarification": True,
                        "clarification_message": f"I couldn't find '{selected_option}'. Which chapter would you like to navigate to?",
                        "clarification_options": [{"id": item.get("id"), "label": item.get("name") or item.get("title")} for item in structure_items[:10]],
                        "original_action": "navigate_section"
                    }
        
        # Handle open_and_write clarification (user selected a chapter to open and write)
        elif response_action == "open_and_write":
            structure_items = state.get("structure_items", []) or []
            target_section = None
            response_lower = (selected_option or "").lower().strip()
            
            # Match by ID first
            for item in structure_items:
                if item.get("id", "").lower() == response_lower:
                    target_section = item
                    break
            
            # Match by name/title
            if not target_section:
                for item in structure_items:
                    label = (item.get("name") or item.get("title") or "").lower()
                    if label == response_lower or response_lower in label:
                        target_section = item
                        break
            
            if target_section:
                section_id = target_section.get("id")
                section_name = target_section.get("name") or target_section.get("title")
                print(f"📍✍️ [Actions] Opening and writing: {section_name}")
                
                return {
                    "actions": [
                        {
                            "type": "select_section",
                            "payload": {"sectionId": section_id, "sectionName": section_name},
                            "requiresUserInput": False,
                            "priority": "high",
                            "status": "pending"
                        },
                        {
                            "type": "generate_content",
                            "payload": {
                                "sectionId": section_id,
                                "sectionName": section_name,
                                "prompt": state.get("user_message", "")
                            },
                            "requiresUserInput": False,
                            "priority": "normal",
                            "status": "pending"
                        }
                    ],
                    "needs_clarification": False,
                    "messages": [{"role": "orchestrator", "content": f"Writing: {section_name}", "type": "decision"}]
                }
            else:
                # Could not find section - check if structure_items is empty
                if not structure_items:
                    print(f"❌ [Actions] No structure items available for open_and_write")
                    return {
                        "actions": [],
                        "needs_clarification": False,
                        "messages": [{"role": "orchestrator", "content": "No chapters found. Please open a document with chapters first.", "type": "error"}]
                    }
                else:
                    # Section not found - re-ask with available options
                    print(f"❌ [Actions] Could not resolve chapter '{selected_option}' from {len(structure_items)} items")
                    return {
                        "actions": [],
                        "needs_clarification": True,
                        "clarification_message": f"I couldn't find '{selected_option}'. Which chapter would you like?",
                        "clarification_options": [{"id": item.get("id"), "label": item.get("name") or item.get("title")} for item in structure_items[:10]],
                        "original_action": "open_and_write"
                    }
        
        # Fallback: Unhandled clarification - return empty to avoid infinite loop
        print(f"⚠️ [Actions] Unhandled clarification: action={response_action}, option={selected_option}")
        return {
            "actions": [],
            "needs_clarification": False,
            "messages": [{"role": "orchestrator", "content": f"Acknowledged: {selected_option}", "type": "result"}]
        }
    
    # ============================================================
    # PHASE 2: DEEP AGENT PLANNER (OPTIONAL)
    # ============================================================
    # Use Deep Agent planner if feature flag enabled
    USE_DEEP_AGENTS_PLANNER = os.getenv("USE_DEEP_AGENTS_PLANNER", "false").lower() == "true"
    
    if USE_DEEP_AGENTS_PLANNER:
        try:
            import sys
            import os
            from pathlib import Path
            # ✅ FIX: Add project root (parent of orchestrator/) to path
            # When running from orchestrator/, we need the project root in path
            # so that "orchestrator.agents" can be imported
            current_file = Path(__file__).resolve()
            # File is at: orchestrator/graph/nodes.py
            # Parent is: orchestrator/graph/
            # Parent.parent is: orchestrator/
            # Parent.parent.parent is: project root (where we want to be)
            project_root = current_file.parent.parent.parent
            project_root_str = str(project_root)
            # Normalize paths for comparison
            normalized_paths = [os.path.abspath(p) for p in sys.path]
            if os.path.abspath(project_root_str) not in normalized_paths:
                sys.path.insert(0, project_root_str)
                print(f"🔧 [Actions] Added project root to path: {project_root_str}")
            
            from orchestrator.agents.planner_agent import PlannerAgent
            from orchestrator.agents.plan_converter import convert_plan_to_actions, extract_clarification_from_plan
            from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend
            from orchestrator.agents.migration_utils import initialize_filesystem_for_session
            
            # Initialize filesystem if not already done (Phase 1)
            filesystem_meta = state.get("_filesystem", {})
            if filesystem_meta.get("enabled"):
                session_id = filesystem_meta.get("project_id")
                backend = OrchestratorFilesystemBackend(project_id=session_id)
            else:
                # Initialize filesystem for this session
                session_id = state.get("session_id") or f"session-{state.get('user_id', 'default')}"
                backend = initialize_filesystem_for_session(session_id, state)
            
            # Create planner
            planner = PlannerAgent(backend)
            
            # Get intent and context
            intent = state.get("intent", {}) or {}
            context = {
                "active_segment": state.get("active_segment"),
                "document_format": state.get("document_format"),
                "document_panel_open": state.get("document_panel_open", False),
                "structure_items": state.get("structure_items", []),
                "canvas_nodes": state.get("canvas_nodes", [])
            }
            
            # Create plan
            plan = await planner.create_plan(
                user_message=state.get("user_message", ""),
                intent=intent,
                context=context
            )
            
            # Convert plan to actions (backward compatibility)
            # CRITICAL: Pass all context so section IDs can be resolved correctly
            user_message = state.get("user_message", "")
            canvas_nodes = state.get("canvas_nodes", []) or []
            entities = intent.get("extractedEntities", {}) or {}
            active_segment = state.get("active_segment")
            structure_items = state.get("structure_items", []) or []
            
            actions = convert_plan_to_actions(
                plan, 
                user_message=user_message,
                canvas_nodes=canvas_nodes,
                entities=entities,
                active_segment=active_segment,
                structure_items=structure_items
            )
            
            # Extract clarification if needed
            clarification = extract_clarification_from_plan(plan)
            
            print(f"✅ [Actions] Planner generated {len(actions)} action(s) from plan")
            
            # Build plan summary for UI display
            plan_summary = {
                "task": plan.get("task", state.get("user_message", "")),
                "intent": plan.get("intent", ""),
                "step_count": len(plan.get("steps", [])),
                "steps": [
                    {
                        "id": step.get("id", f"step_{i}"),
                        "description": step.get("description", "")[:80],  # Truncate for UI
                        "action_type": step.get("action_type", "general_task"),
                        "status": "pending"
                    }
                    for i, step in enumerate(plan.get("steps", []))
                ]
            }
            
            # Return result with actions and plan summary for UI
            # Note: 'plan_summary' is for streaming to UI, not stored in state
            result = {
                "actions": actions,
                "plan_summary": plan_summary,  # NEW: For UI display
                "messages": [{
                    "role": "orchestrator",
                    "content": f"Created plan with {len(plan.get('steps', []))} steps, generated {len(actions)} action(s)",
                    "type": "thinking"
                }]
            }
            
            # Add clarification if needed
            if clarification:
                result.update(clarification)
                result["messages"].append({
                    "role": "orchestrator",
                    "content": clarification.get("clarification_message", "Please choose an option"),
                    "type": "options",
                    "options": clarification.get("clarification_options", [])
                })
            
            # Check if any action needs node clarification (converter couldn't find document)
            for action in actions:
                if action.get("payload", {}).get("_needs_node_clarification"):
                    search_term = action.get("payload", {}).get("_search_term", "")
                    canvas_nodes = state.get("canvas_nodes", []) or []
                    
                    # Get all document nodes as options
                    doc_nodes = [
                        n for n in canvas_nodes 
                        if n.get("type") in ["storyStructureNode", "storyNode"]
                        or "story" in str(n.get("type", "")).lower()
                    ]
                    
                    if doc_nodes:
                        def get_label(n):
                            return n.get("label") or n.get("name") or n.get("data", {}).get("label", "Unknown")
                        
                        result["needs_clarification"] = True
                        result["clarification_message"] = f"I couldn't find '{search_term}'. Which document would you like to open?"
                        result["original_action"] = "open_document"
                        result["clarification_options"] = [
                            {
                                "id": n.get("id") or n.get("nodeId", ""),
                                "label": get_label(n),
                                "description": f"{n.get('type', 'document')}"
                            }
                            for n in doc_nodes
                        ]
                        print(f"🤔 [Actions] Node not found, offering {len(doc_nodes)} document options")
                    break  # Only handle first
            
            print(f"✅ [Actions] Planner generated {len(actions)} action(s) from plan")
            return result
            
        except Exception as e:
            # Fallback to original logic if planner fails
            print(f"⚠️ [Actions] Planner failed (falling back to original): {e}")
            import traceback
            traceback.print_exc()
            # Continue to original logic below
    
    # ============================================================
    # ORIGINAL ACTION GENERATION LOGIC (FALLBACK)
    # ============================================================
    # Extract intent data
    intent = state.get("intent", {}) or {}
    intent_type = intent.get("intent", "")
    entities = intent.get("extractedEntities", {}) or {}  # Extracted info (format, section, etc.)
    
    # ============================================================
    # INITIALIZE ACTION GENERATION STATE
    # ============================================================
    actions = []
    needs_clarification = False
    clarification_options = []
    clarification_message = None
    original_action = None
    
    # ============================================================
    # HANDLE CLARIFICATION RESPONSE (PRIORITY: Check FIRST)
    # ============================================================
    # If user just responded to a clarification question, handle that FIRST
    # before processing new intent. This allows the workflow to continue
    # from where it paused.
    #
    # Example flow:
    #   1. User: "Create a story" → needs_clarification=True (which template?)
    #   2. User selects: "hero's journey" → clarification_response set
    #   3. This node processes the response → creates generate_structure action
    #   4. Workflow continues with structure generation
    clarification_response = state.get("clarification_response")
    if clarification_response:
        response_action = clarification_response.get("original_action")
        selected_option = clarification_response.get("option_id")
        
        print(f"✅ [Actions] Processing clarification response: action={response_action}, option={selected_option}")
        
        if response_action == "create_structure":
            # User selected a template - create structure with that template
            # ✅ FIX: Detect format from original user message, not stale state
            # The state might have "novel" from a previous request, so we need to
            # re-detect format from the original message or conversation history
            
            format_type = None
            
            # 1. Try to detect from original user message (most reliable)
            original_message = state.get("user_message", "").lower()
            available_formats = ["podcast", "novel", "screenplay", "article", "report"]
            for fmt in available_formats:
                if fmt in original_message:
                    format_type = fmt
                    print(f"✅ [Actions] Detected format from original message: {format_type}")
                    break
            
            # 2. If not in message, check conversation history for format mentions
            if not format_type:
                conversation_history = state.get("conversation_history", []) or []
                for msg in reversed(conversation_history):  # Check most recent first
                    msg_content = (msg.get("content") or "").lower()
                    for fmt in available_formats:
                        if fmt in msg_content:
                            format_type = fmt
                            print(f"✅ [Actions] Detected format from conversation history: {format_type}")
                            break
                    if format_type:
                        break
            
            # 3. Fall back to state (might be stale, but better than nothing)
            if not format_type:
                format_type = state.get("document_format")
                if format_type:
                    print(f"⚠️ [Actions] Using format from state (may be stale): {format_type}")
            
            # 4. Try to detect from template ID prefix
            if not format_type and selected_option:
                if selected_option.startswith("podcast-"):
                    format_type = "podcast"
                elif selected_option.startswith("screenplay-"):
                    format_type = "screenplay"
                elif selected_option.startswith("novel-"):
                    format_type = "novel"
                elif selected_option.startswith("article-"):
                    format_type = "article"
            
            # 5. Final fallback to novel
            if not format_type:
                format_type = "novel"
                print(f"⚠️ [Actions] No format detected, defaulting to: {format_type}")
            
            print(f"📝 [Actions] Format preserved: {format_type} (original message: {original_message[:50]}, template: {selected_option})")
            
            actions.append({
                "type": "generate_structure",
                "payload": {
                    "format": format_type,
                    "template": selected_option,
                    "prompt": state.get("user_message", "")
                },
                "requiresUserInput": False,
                "priority": "high",
                "status": "pending"
            })
            
            print(f"📝 [Actions] Created generate_structure action with template: {selected_option}")
            
            # Return early - skip normal intent processing
            return {
                "actions": actions,
                "needs_clarification": False,
                "messages": [{
                    "role": "orchestrator",
                    "content": f"Creating {format_type} with template: {selected_option}",
                    "type": "decision"
                }]
            }
        
        # ============================================================
        # CLARIFICATION RESPONSE: WRITE CONTENT (select chapter)
        # ============================================================
        elif response_action == "write_content":
            # User selected which chapter to write
            # selected_option could be: "the first", "1", "chapter-1", "Chapter 1", etc.
            structure_items = state.get("structure_items", []) or []
            target_section = None
            
            # Try to interpret the response
            response_lower = (selected_option or "").lower().strip()
            
            # Pattern 1: Ordinal words ("the first", "first", "second", etc.)
            ordinal_map = {
                "first": 0, "1st": 0, "the first": 0,
                "second": 1, "2nd": 1, "the second": 1,
                "third": 2, "3rd": 2, "the third": 2,
                "fourth": 3, "4th": 3, "fifth": 4, "5th": 4
            }
            for ordinal, index in ordinal_map.items():
                if ordinal in response_lower:
                    if index < len(structure_items):
                        target_section = structure_items[index]
                    break
            
            # Pattern 2: Number ("1", "2", etc.)
            if not target_section:
                import re
                num_match = re.search(r'^(\d+)$', response_lower)
                if num_match:
                    index = int(num_match.group(1)) - 1  # 1-indexed
                    if 0 <= index < len(structure_items):
                        target_section = structure_items[index]
            
            # Pattern 3: Direct ID match ("chapter-1")
            if not target_section:
                for item in structure_items:
                    if item.get("id", "").lower() == response_lower:
                        target_section = item
                        break
            
            # Pattern 4: Name match ("Chapter 1", "The Great Escape")
            if not target_section:
                for item in structure_items:
                    item_name = (item.get("name") or item.get("title") or "").lower()
                    if item_name == response_lower or response_lower in item_name:
                        target_section = item
                        break
            
            if target_section:
                actions.append({
                    "type": "generate_content",
                    "payload": {
                        "sectionId": target_section.get("id"),
                        "sectionName": target_section.get("name") or target_section.get("title"),
                        "prompt": state.get("user_message", "")
                    },
                    "requiresUserInput": False,
                    "priority": "normal",
                    "status": "pending"
                })
                
                section_name = target_section.get("name") or target_section.get("title")
                print(f"📝 [Actions] Resolved chapter selection: '{selected_option}' → {section_name}")
                
                return {
                    "actions": actions,
                    "needs_clarification": False,
                    "messages": [{
                        "role": "orchestrator",
                        "content": f"Writing content for: {section_name}",
                        "type": "decision"
                    }]
                }
            else:
                print(f"⚠️ [Actions] Could not resolve chapter: '{selected_option}'")
                # Continue to normal processing
        
        # ============================================================
        # CLARIFICATION RESPONSE: OPEN DOCUMENT (select from list)
        # ============================================================
        elif response_action == "open_document":
            # User selected which document to open
            # selected_option is the node ID or name
            canvas_nodes = state.get("canvas_nodes", []) or []
            target_node = None
            
            response_lower = (selected_option or "").lower().strip()
            
            # Try to find the node by ID first
            for node in canvas_nodes:
                node_id = (node.get("id") or node.get("nodeId") or "").lower()
                if node_id == response_lower:
                    target_node = node
                    break
            
            # Try by label/name
            if not target_node:
                for node in canvas_nodes:
                    label = (node.get("label") or node.get("name") or 
                             node.get("data", {}).get("label") or "").lower()
                    if label == response_lower or response_lower in label:
                        target_node = node
                        break
            
            # Try ordinal matching ("the first", "1", etc.)
            if not target_node:
                ordinal_map = {
                    "first": 0, "1st": 0, "the first": 0, "1": 0,
                    "second": 1, "2nd": 1, "the second": 1, "2": 1,
                    "third": 2, "3rd": 2, "the third": 2, "3": 2,
                    "fourth": 3, "4th": 3, "4": 3,
                    "fifth": 4, "5th": 4, "5": 4
                }
                # Filter to document nodes only
                doc_nodes = [
                    n for n in canvas_nodes 
                    if n.get("type") in ["storyStructureNode", "storyNode"]
                    or "story" in str(n.get("type", "")).lower()
                ]
                for ordinal, index in ordinal_map.items():
                    if ordinal in response_lower:
                        if index < len(doc_nodes):
                            target_node = doc_nodes[index]
                        break
            
            if target_node:
                node_id = target_node.get("id") or target_node.get("nodeId", "")
                node_name = (target_node.get("label") or target_node.get("name") or 
                            target_node.get("data", {}).get("label", "Document"))
                
                actions.append({
                    "type": "open_document",
                    "payload": {
                        "nodeId": node_id,
                        "nodeName": node_name
                    },
                    "requiresUserInput": False,
                    "priority": "high",
                    "status": "pending"
                })
                
                print(f"📂 [Actions] Resolved document selection: '{selected_option}' → {node_name} ({node_id})")
                
                # Check if original request also wanted to write content
                # e.g., "open X and start writing chapter 1"
                user_message = (state.get("user_message") or "").lower()
                intent_type = intent.get("intent", "")
                
                if intent_type == "open_and_write" or any(word in user_message for word in ["write", "writing", "start chapter", "chapter 1"]):
                    # Also queue up a write action for chapter 1 (or first section)
                    structure_items = state.get("structure_items", []) or []
                    
                    # Try to extract which chapter from the original message
                    import re
                    chapter_match = re.search(r'chapter\s*(\d+)', user_message)
                    target_section = None
                    
                    if chapter_match:
                        chapter_num = int(chapter_match.group(1)) - 1  # 0-indexed
                        if 0 <= chapter_num < len(structure_items):
                            target_section = structure_items[chapter_num]
                    elif structure_items:
                        # Default to first chapter
                        target_section = structure_items[0]
                    
                    if target_section:
                        actions.append({
                            "type": "generate_content",
                            "payload": {
                                "sectionId": target_section.get("id"),
                                "sectionName": target_section.get("name") or target_section.get("title"),
                                "prompt": f"Write content for {target_section.get('name') or 'this section'}"
                            },
                            "requiresUserInput": False,
                            "priority": "normal",
                            "status": "pending"
                        })
                        print(f"✍️ [Actions] Also queued writing: {target_section.get('name')}")
                
                return {
                    "actions": actions,
                    "needs_clarification": False,
                    "messages": [{
                        "role": "orchestrator",
                        "content": f"Opening document: {node_name}",
                        "type": "decision"
                    }]
                }
            else:
                print(f"⚠️ [Actions] Could not resolve document: '{selected_option}'")
                # Continue to normal processing
    
    # ============================================================
    # ACTION GENERATION: WRITE CONTENT
    # ============================================================
    # User wants to write or improve content for a section
    # 
    # Example: "Write about the main character" or "Improve the opening"
    if intent_type == "write_content":
        segment = state.get("active_segment")
        if segment:
            actions.append({
                "type": "generate_content",
                "payload": {
                    "sectionId": segment.get("id"),
                    "sectionName": segment.get("name"),
                    "prompt": state.get("user_message", "")
                },
                "requiresUserInput": False,
                "priority": "normal",
                "status": "pending"
            })
        else:
            # No active segment - generate content without section
            actions.append({
                "type": "generate_content",
                "payload": {
                    "prompt": state.get("user_message", "")
                },
                "requiresUserInput": False,
                "priority": "normal",
                "status": "pending"
            })
    
    # ============================================================
    # ACTION GENERATION: CREATE STRUCTURE
    # ============================================================
    # User wants to create a new document structure (novel, screenplay, etc.)
    #
    # This is complex because:
    # 1. Need to detect format (novel, screenplay, podcast, etc.)
    # 2. May need to select template (hero's journey, three-act, etc.)
    # 3. If multiple templates exist, request clarification
    #
    # Example: "Create a podcast" or "Make a hero's journey novel"
    elif intent_type == "create_structure":
        # Import template registry (contains available templates per format)
        from .schemas.template_registry import (
            get_templates_for_format, 
            find_template_by_keywords,
            get_format_label,
            get_available_formats
        )
        
        user_message = state.get("user_message", "").lower()
        
        # ============================================================
        # STEP 1: DETECT FORMAT (novel, screenplay, podcast, etc.)
        # ============================================================
        # Try multiple sources in order of reliability:
        # 1. Entities from intent analysis (most reliable)
        # 2. Keyword detection in message
        # 3. Default to "novel"
        format_type = entities.get("documentFormat") or entities.get("document_format")
        
        # If not in entities, try to detect from message keywords
        if not format_type:
            available_formats = get_available_formats()
            for fmt in available_formats:
                # Check for format mention in message
                if fmt in user_message or fmt.replace("-", " ") in user_message:
                    format_type = fmt
                    print(f"✅ [Actions] Detected format from message: {format_type}")
                    break
        
        # ✅ FIX: Also check state's document_format (from previous request or context)
        # But prioritize detected format over stale state
        if not format_type:
            format_type = state.get("document_format")
            if format_type:
                print(f"⚠️ [Actions] Using format from state (may be stale): {format_type}")
        
        # Default to novel if still not detected
        if not format_type:
            format_type = "novel"
            print(f"⚠️ [Actions] No format detected, defaulting to: {format_type}")
        else:
            print(f"✅ [Actions] Using format: {format_type} (from entities: {entities.get('documentFormat')}, state: {state.get('document_format')})")
        
        # ✅ FIX: Store detected format in state so it's preserved for clarification responses
        # This ensures "podcast" is remembered when user selects template
        # Only update if we detected a new format (don't overwrite with None)
        
        # ============================================================
        # STEP 2: DETECT TEMPLATE (hero's journey, three-act, etc.)
        # ============================================================
        # Templates are format-specific (e.g., "hero's journey" for novels)
        # Try multiple sources:
        # 1. Entities from intent analysis
        # 2. Clarification response (user selected an option)
        # 3. Keyword matching in message
        # 4. Request clarification if multiple templates exist
        suggested_template = entities.get("suggestedTemplate") or entities.get("suggested_template")
        
        # Legacy fallback: Check clarification response (now primarily handled at top of function)
        clarification_response = state.get("clarification_response")
        if clarification_response and clarification_response.get("original_action") == "create_structure":
            suggested_template = clarification_response.get("option_id")
            print(f"✅ [Actions] Using template from clarification (fallback): {suggested_template}")
        
        # Try to find template from keywords if not explicitly set
        # Only search within the detected format
        if not suggested_template:
            matched_template = find_template_by_keywords(format_type, user_message)
            if matched_template:
                suggested_template = matched_template.id
                print(f"✅ [Actions] Matched template from keywords: {suggested_template}")
        
        # ============================================================
        # STEP 3: HANDLE TEMPLATE SELECTION
        # ============================================================
        # If no template found and format has templates, ask user to choose
        if not suggested_template:
            available_templates = get_templates_for_format(format_type)
            
            if len(available_templates) > 0:
                print(f"🤔 [Actions] No template specified for {format_type}, requesting clarification")
                
                needs_clarification = True
                format_label = get_format_label(format_type)
                clarification_message = f"What type of {format_label.lower()} would you like to create?"
                original_action = "create_structure"
                clarification_options = [
                    {
                        "id": t.id,
                        "label": t.name,
                        "description": t.description
                    }
                    for t in available_templates
                ]
            else:
                # No templates for this format, proceed without
                actions.append({
                    "type": "generate_structure",
                    "payload": {
                        "format": format_type,
                        "prompt": user_message
                    },
                    "requiresUserInput": False,
                    "priority": "high",
                    "status": "pending"
                })
        else:
            # Template selected, proceed with structure generation
            actions.append({
                "type": "generate_structure",
                "payload": {
                    "format": format_type,
                    "template": suggested_template,
                    "prompt": state.get("user_message", "")  # Use original case
                },
                "requiresUserInput": False,
                "priority": "high",
                "status": "pending"
            })
    
    # ============================================================
    # ACTION GENERATION: ANSWER QUESTION
    # ============================================================
    # User asked a question - generate an answer using LLM
    # 
    # Example: "What is the theme of this story?" or "Who is the protagonist?"
    elif intent_type == "answer_question":
        actions.append({
            "type": "generate_content",
            "payload": {
                "prompt": state.get("user_message", ""),
                "isAnswer": True
            },
            "requiresUserInput": False,
            "priority": "normal",
            "status": "pending"
        })
    
    # ============================================================
    # ACTION GENERATION: NAVIGATE SECTION
    # ============================================================
    # User wants to jump to a specific section in the document
    #
    # Example: "Go to chapter 3" or "Show me the climax"
    # 
    # This action updates the UI to show the selected section
    elif intent_type == "navigate_section":
        target_section = entities.get("targetSection") or entities.get("target_section")
        target_name = entities.get("targetSectionName") or entities.get("target_section_name")
        
        # Try to resolve section from structure_items
        structure_items = state.get("structure_items", []) or []
        resolved_section = None
        
        if target_section:
            # Direct ID match
            resolved_section = {"id": target_section, "name": target_name}
        elif target_name and structure_items:
            # Try to find by name
            resolved_section = find_section_by_name(target_name, structure_items)
        
        if resolved_section:
            actions.append({
                "type": "select_section",
                "payload": {
                    "sectionId": resolved_section.get("id"),
                    "sectionName": resolved_section.get("name")
                },
                "requiresUserInput": False,
                "priority": "high",
                "status": "pending"
            })
        else:
            # Could not resolve - might need clarification
            actions.append({
                "type": "message",
                "payload": {
                    "content": "I couldn't find that section. Could you be more specific?",
                    "type": "error"
                },
                "requiresUserInput": False,
                "priority": "normal",
                "status": "completed"
            })
    
    # ============================================================
    # ACTION GENERATION: OPEN DOCUMENT
    # ============================================================
    # User wants to open a document node on the canvas
    #
    # This can require clarification if multiple documents exist
    # Example: "Open the screenplay" (if multiple screenplays exist)
    elif intent_type == "open_document" or intent_type == "open_and_write":
        canvas_nodes = state.get("canvas_nodes", []) or []
        target_type = entities.get("documentType") or entities.get("document_type")
        
        # Filter nodes by type if specified
        candidate_nodes = canvas_nodes
        if target_type:
            candidate_nodes = [
                n for n in canvas_nodes 
                if n.get("format", "").lower() == target_type.lower()
                or n.get("nodeType", "").lower() == target_type.lower()
            ]
        
        if len(candidate_nodes) == 0:
            actions.append({
                "type": "message",
                "payload": {
                    "content": f"I couldn't find any {target_type or 'document'} nodes. Could you be more specific?",
                    "type": "error"
                },
                "requiresUserInput": False,
                "priority": "normal",
                "status": "completed"
            })
        elif len(candidate_nodes) == 1:
            # Single match - open it
            node = candidate_nodes[0]
            actions.append({
                "type": "open_document",
                "payload": {
                    "nodeId": node.get("id") or node.get("nodeId"),
                    "nodeName": node.get("label") or node.get("name")
                },
                "requiresUserInput": False,
                "priority": "high",
                "status": "pending"
            })
        else:
            # Multiple matches - request clarification
            needs_clarification = True
            clarification_message = f"I found {len(candidate_nodes)} documents. Which one would you like to open?"
            original_action = "open_document"
            clarification_options = [
                {
                    "id": n.get("id") or n.get("nodeId"),
                    "label": n.get("label") or n.get("name"),
                    "description": f"{n.get('format', 'document')} - {n.get('wordCount', 0)} words"
                }
                for n in candidate_nodes
            ]
    
    # ============================================================
    # ACTION GENERATION: DELETE NODE
    # ============================================================
    # User wants to delete a node from the canvas
    #
    # This requires confirmation (requiresUserInput=True) for safety
    # Example: "Delete the screenplay" or "Remove that story"
    elif intent_type == "delete_node":
        canvas_nodes = state.get("canvas_nodes", []) or []
        target_type = entities.get("nodeType") or entities.get("node_type")
        
        candidate_nodes = canvas_nodes
        if target_type:
            candidate_nodes = [
                n for n in canvas_nodes 
                if n.get("format", "").lower() == target_type.lower()
                or n.get("nodeType", "").lower() == target_type.lower()
            ]
        
        if len(candidate_nodes) == 0:
            actions.append({
                "type": "message",
                "payload": {
                    "content": f"I couldn't find any {target_type or 'matching'} nodes to delete.",
                    "type": "error"
                },
                "requiresUserInput": False,
                "priority": "normal",
                "status": "completed"
            })
        elif len(candidate_nodes) == 1:
            node = candidate_nodes[0]
            actions.append({
                "type": "delete_node",
                "payload": {
                    "nodeId": node.get("id") or node.get("nodeId"),
                    "nodeName": node.get("label") or node.get("name")
                },
                "requiresUserInput": True,  # Deletion should confirm
                "priority": "high",
                "status": "pending"
            })
        else:
            needs_clarification = True
            clarification_message = f"I found {len(candidate_nodes)} nodes. Which one would you like to delete?"
            original_action = "delete_node"
            clarification_options = [
                {
                    "id": n.get("id") or n.get("nodeId"),
                    "label": n.get("label") or n.get("name"),
                    "description": n.get("format", "node")
                }
                for n in candidate_nodes
            ]
    
    # ============================================================
    # ACTION GENERATION: GENERAL CHAT
    # ============================================================
    # Casual conversation - generate a chat response
    #
    # Example: "How are you?" or "What can you do?"
    # This is low priority and doesn't modify the document
    elif intent_type == "general_chat":
        actions.append({
            "type": "generate_content",
            "payload": {
                "prompt": state.get("user_message", ""),
                "isChat": True
            },
            "requiresUserInput": False,
            "priority": "low",
            "status": "pending"
        })
    
    # ============================================================
    # RETURN ACTION GENERATION RESULTS
    # ============================================================
    print(f"📝 [Node] Generated {len(actions)} action(s), needs_clarification={needs_clarification}")
    
    # Build result with actions and messages
    result = {
        "actions": actions,
        "messages": [{
            "role": "orchestrator",
            "content": f"Generated {len(actions)} action(s): {[a['type'] for a in actions]}",
            "type": "thinking"
        }]
    }
    
    # ✅ FIX: Preserve document_format in state so clarification responses can use it
    # Only update if format_type was detected (exists in local scope)
    if 'format_type' in locals() and format_type:
        result["document_format"] = format_type
        print(f"💾 [Actions] Storing format in state: {format_type}")
    
    # If clarification is needed, add clarification state
    # This will pause the workflow and wait for user input
    if needs_clarification:
        result["needs_clarification"] = True
        result["clarification_options"] = clarification_options
        result["clarification_message"] = clarification_message
        result["original_action"] = original_action
        
        # Add clarification message to UI (shows options to user)
        result["messages"].append({
            "role": "orchestrator",
            "content": clarification_message,
            "type": "options",
            "options": clarification_options
        })
    
    return result


def find_section_by_name(name: str, structure_items: list) -> Optional[dict]:
    """
    Helper function: Find a section by name with fuzzy matching.
    
    This searches through the document structure (which can be nested)
    to find a section that matches the given name.
    
    Uses fuzzy matching (substring search) so "chapter 1" matches "Chapter 1: Introduction"
    
    Args:
        name: Section name to search for (e.g., "chapter 3", "climax")
        structure_items: List of structure items (can be nested with children)
    
    Returns:
        dict: The matching section item, or None if not found
    
    Example:
        structure_items = [
            {"id": "ch1", "name": "Chapter 1", "children": [...]},
            {"id": "ch2", "name": "Chapter 2", "children": [...]}
        ]
        find_section_by_name("chapter 1", structure_items)
        # Returns: {"id": "ch1", "name": "Chapter 1", ...}
    """
    if not name or not structure_items:
        return None
    
    name_lower = name.lower().strip()
    
    def search(items):
        """Recursive search through nested structure"""
        for item in items:
            item_name = (item.get("name") or "").lower()
            # Fuzzy match: check if name contains search term or vice versa
            if name_lower in item_name or item_name in name_lower:
                return item
            # Recursively search children (nested sections)
            if item.get("children"):
                found = search(item["children"])
                if found:
                    return found
        return None
    
    return search(structure_items)

@traceable(name="writer_agent")
async def writer_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 5: Execute writing actions using the Writer agent.
    
    This is the MAIN EXECUTION node - it actually generates content/structure.
    The writer agent uses LLMs to create the actual output.
    
    Input (from state):
        - actions: List of actions to execute (from generate_actions_node)
        - results: Existing results (may be empty or contain previous iterations)
        - iteration: Current iteration count (for writer-critic loop)
        - canvas_context: Context about canvas state
    
    Output (updates state):
        - results: {
            section_id: "generated content text",
            "structure": { title, items, format, ... }
          }
        - iteration: Incremented iteration count
        - messages: Result message for UI
    
    Process:
        1. Loop through actions that need writer execution
        2. For each action:
           - generate_content → Call writer agent to generate text
           - generate_structure → Call writer agent to create structure
        3. Store results in state.results
        4. Increment iteration counter
    
    Action Types Handled:
        - generate_content: Write content for a section
        - generate_structure: Create document structure (chapters, scenes, etc.)
    
    Next node: should_use_critic() routing function decides:
        - "critic" → Route to critic for review (if cluster strategy)
        - "merge" → Skip critic, go to final response
    
    Writer-Critic Loop:
        If critic rejects, workflow loops back here with feedback.
        The iteration counter prevents infinite loops (max 3 iterations).
    
    Example flow:
        1. Action: generate_content for "Chapter 1"
        2. Writer generates: "It was a dark and stormy night..."
        3. Results: {"chapter-1": "It was a dark and stormy night..."}
        4. Next: Critic reviews (if cluster strategy)
    """
    try:
        import os
        
        # ============================================================
        # PHASE 4: SUBAGENT SPAWNING (OPTIONAL)
        # ============================================================
        # Use WriterAgent with subagent spawning if feature flag enabled
        USE_DEEP_AGENTS_SUBAGENTS = os.getenv("USE_DEEP_AGENTS_SUBAGENTS", "false").lower() == "true"
        
        if USE_DEEP_AGENTS_SUBAGENTS:
            try:
                import sys
                import os
                from pathlib import Path
                # ✅ FIX: Add project root to path for imports
                current_file = Path(__file__).resolve()
                project_root = current_file.parent.parent.parent
                project_root_str = str(project_root)
                # Normalize paths for comparison
                normalized_paths = [os.path.abspath(p) for p in sys.path]
                if os.path.abspath(project_root_str) not in normalized_paths:
                    sys.path.insert(0, project_root_str)
                    print(f"🔧 [Writer] Added project root to path: {project_root_str}")
                
                from orchestrator.agents.writer_agent import WriterAgent
                from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend
                from orchestrator.agents.migration_utils import initialize_filesystem_for_session
                
                # Initialize filesystem if not already done (Phase 1)
                filesystem_meta = state.get("_filesystem", {})
                if filesystem_meta.get("enabled"):
                    session_id = filesystem_meta.get("project_id")
                    backend = OrchestratorFilesystemBackend(project_id=session_id)
                else:
                    # Initialize filesystem for this session
                    session_id = state.get("session_id") or f"session-{state.get('user_id', 'default')}"
                    backend = initialize_filesystem_for_session(session_id, state)
                
                # ============================================================
                # LIBRARIAN INTEGRATION: Get node_id and Supabase client
                # ============================================================
                # The Librarian needs the node_id to scope entities to the story
                # and a Supabase client to persist section cards and entities.
                node_id = None
                supabase_client = None
                
                # Get node_id from canvas_nodes (the story structure node)
                canvas_nodes = state.get("canvas_nodes", []) or []
                for node in canvas_nodes:
                    if node.get("nodeType") == "storyStructure" or node.get("type") == "storyStructureNode":
                        node_id = node.get("id") or node.get("nodeId")
                        break
                
                # Create async Supabase client for Librarian
                if node_id and os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"):
                    try:
                        from supabase import create_client, Client
                        supabase_client = create_client(
                            os.getenv("SUPABASE_URL"),
                            os.getenv("SUPABASE_SERVICE_KEY")
                        )
                        print(f"📚 [Writer] Librarian enabled for node: {node_id[:20]}...")
                    except Exception as e:
                        print(f"⚠️ [Writer] Failed to create Supabase client: {e}")
                else:
                    print(f"📚 [Writer] Librarian disabled (node_id={bool(node_id)}, supabase={bool(os.getenv('SUPABASE_URL'))})")
                
                # Create writer agent with Librarian integration
                writer_agent = WriterAgent(
                    backend=backend,
                    node_id=node_id,
                    supabase_client=supabase_client
                )
                
                # Get actions and plan
                actions = state.get("actions", []) or []
                plan = state.get("plan")
                results = dict(state.get("results", {}) or {})
                
                # Generate content using subagents (parallel execution)
                content_results = await writer_agent.generate_content(actions, plan)
                results.update(content_results)
                
                # Generate structure (if needed) - ONLY PROCESS FIRST ONE
                # The planner might create multiple steps, but we only need one structure
                structure_actions = [a for a in actions if a.get("type") == "generate_structure"]
                if structure_actions:
                    # Take the first structure action only - avoid duplicate generation
                    action = structure_actions[0]
                    # Ensure format is propagated from state
                    if not action.get("payload", {}).get("format"):
                        action.setdefault("payload", {})["format"] = state.get("document_format")
                    structure = await writer_agent.generate_structure(action, plan)
                    results["structure"] = structure
                    if len(structure_actions) > 1:
                        print(f"⚠️ [Writer] Skipped {len(structure_actions) - 1} duplicate structure action(s)")
                
                print(f"✅ [Writer] Subagent execution complete: {len(results)} result(s)")
                
                return {
                    "results": results,
                    "iteration": (state.get("iteration", 0) or 0) + 1,
                    "messages": [{
                        "role": "orchestrator",
                        "content": f"Generated content using {len(content_results)} subagent(s)",
                        "type": "result"
                    }]
                }
                
            except Exception as e:
                # Fallback to original logic if subagent spawning fails
                print(f"⚠️ [Writer] Subagent spawning failed (falling back to original): {e}")
                import traceback
                traceback.print_exc()
                # Continue to original logic below
        
        # ============================================================
        # ORIGINAL WRITER LOGIC (FALLBACK)
        # ============================================================
        from .agents.writer import generate_content, generate_structure
        
        # ============================================================
        # PHASE 3: CONTEXT MANAGEMENT (OPTIONAL)
        # ============================================================
        # Load context from filesystem if feature flag enabled
        USE_DEEP_AGENTS_CONTEXT = os.getenv("USE_DEEP_AGENTS_CONTEXT", "false").lower() == "true"
        
        canvas_context = None
        if USE_DEEP_AGENTS_CONTEXT:
            try:
                import sys
                import os
                from pathlib import Path
                # ✅ FIX: Add project root to path for imports
                current_file = Path(__file__).resolve()
                project_root = current_file.parent.parent.parent
                project_root_str = str(project_root)
                # Normalize paths for comparison
                normalized_paths = [os.path.abspath(p) for p in sys.path]
                if os.path.abspath(project_root_str) not in normalized_paths:
                    sys.path.insert(0, project_root_str)
                    print(f"🔧 [Writer Context] Added project root to path: {project_root_str}")
                
                from orchestrator.agents.deep_agent_backend import OrchestratorFilesystemBackend
                from orchestrator.agents.file_storage import load_context_from_filesystem
                from orchestrator.agents.migration_utils import initialize_filesystem_for_session
                
                # Initialize filesystem if not already done (Phase 1)
                filesystem_meta = state.get("_filesystem", {})
                if filesystem_meta.get("enabled"):
                    session_id = filesystem_meta.get("project_id")
                    backend = OrchestratorFilesystemBackend(project_id=session_id)
                else:
                    # Initialize filesystem for this session
                    session_id = state.get("session_id") or f"session-{state.get('user_id', 'default')}"
                    backend = initialize_filesystem_for_session(session_id, state)
                
                # Load canvas context from filesystem (selective loading)
                canvas_data = load_context_from_filesystem(backend, "canvas")
                
                # Convert filesystem data to context format
                if canvas_data:
                    import json
                    canvas_context = json.dumps(canvas_data) if isinstance(canvas_data, dict) else str(canvas_data)
                
                print(f"💾 [Writer] Loaded canvas context from filesystem")
                
            except Exception as e:
                # Fallback to state if filesystem fails
                print(f"⚠️ [Writer] Filesystem loading failed (using state): {e}")
                canvas_context = state.get("canvas_context")
        else:
            # Original behavior: read from state
            canvas_context = state.get("canvas_context")
        
        # ============================================================
        # GET ACTIONS AND INITIALIZE RESULTS
        # ============================================================
        actions = state.get("actions", []) or []
        results = dict(state.get("results", {}) or {})  # Make a copy to avoid mutating
        
        # ============================================================
        # EXECUTE ACTIONS (with deduplication)
        # ============================================================
        # Process content actions - recognize various content-related action types
        # The LLM may return "write_article", "compose_content", "draft_section" etc.
        def is_content_action(action_type: str) -> bool:
            if not action_type:
                return False
            action_lower = action_type.lower()
            return (
                action_lower == "generate_content" or
                "write" in action_lower or
                "content" in action_lower or
                "draft" in action_lower or
                "compose" in action_lower or
                "author" in action_lower
            )
        
        content_actions = [a for a in actions if is_content_action(a.get("type", ""))]
        if content_actions:
            print(f"📝 [Writer] Found {len(content_actions)} content action(s)")
        for action in content_actions:
            payload = action.get("payload", {})
            section_name = payload.get("sectionName", "Content")
            section_id = payload.get("sectionId", "default")
            
            print(f"✍️ [Writer] Generating content for: {section_name}")
            
            content = await generate_content(
                prompt=payload.get("prompt", ""),
                section_name=section_name,
                context=canvas_context
            )
            
            results[section_id] = content
        
        # Process structure action - ONLY FIRST ONE (avoid duplicates from planner)
        structure_actions = [a for a in actions if a.get("type") == "generate_structure"]
        if structure_actions:
            # Take only the first structure action
            action = structure_actions[0]
            payload = action.get("payload", {})
            
            # CRITICAL: Use state's document_format as fallback, not hardcoded "novel"
            # This ensures podcast requests generate podcast structures, not novels
            state_format = state.get("document_format")
            format_type = payload.get("format") or state_format or "novel"
            template_id = payload.get("template")
            # Use payload prompt, fallback to user_message (the original request)
            prompt = payload.get("prompt") or state.get("user_message", "")
            
            print(f"📐 [Writer] Generating structure for: {format_type} (template: {template_id or 'default'})")
            
            # Call writer agent to generate structure
            # This creates the document outline (chapters, scenes, etc.)
            structure = await generate_structure(
                prompt=prompt,
                format_type=format_type,
                template_id=template_id,
                context=canvas_context
            )
            
            # Store structure result (special key "structure")
            results["structure"] = structure
            
            if len(structure_actions) > 1:
                print(f"⚠️ [Writer] Skipped {len(structure_actions) - 1} duplicate structure action(s)")
        
        # ============================================================
        # UPDATE ITERATION COUNTER
        # ============================================================
        # Track how many times writer has run (for writer-critic loop)
        current_iteration = state.get("iteration", 0) or 0
        
        return {
            "results": results,  # Generated content/structure
            "iteration": current_iteration + 1,  # Increment for loop tracking
            "messages": [{
                "role": "orchestrator",
                "content": f"Content generated (iteration {current_iteration + 1})",
                "type": "result"
            }]
        }
        
    except Exception as e:
        print(f"❌ [Writer] Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "messages": [{
                "role": "system",
                "content": f"Writer failed: {str(e)}",
                "type": "error"
            }]
        }

@traceable(name="critic_agent")
async def critic_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 6: Review and critique content using the Critic agent.
    
    This node is part of the writer-critic feedback loop for quality control.
    The critic reviews the writer's output and can request revisions.
    
    Input (from state):
        - results: Content generated by writer_node
        - iteration: Current iteration count (to prevent infinite loops)
    
    Output (updates state):
        - critic_approved: true if content is good, false if needs revision
        - messages: Approval/rejection message with feedback
    
    Process:
        1. Check if there are results to review
        2. For each result, call critic agent to review
        3. Critic uses LLM to evaluate quality, coherence, style, etc.
        4. Aggregate approval status (all must be approved)
        5. Return approval status + feedback
    
    Next node: should_revise() routing function decides:
        - "revise" → Loop back to writer_node with feedback
        - "merge" → Critic approved, proceed to final response
    
    Writer-Critic Loop:
        This creates a feedback loop:
        1. Writer generates content
        2. Critic reviews → approves or rejects
        3. If rejected → back to writer with feedback
        4. Writer revises based on feedback
        5. Repeat until approved OR max iterations reached
    
    Safety:
        - On error, auto-approve to prevent infinite loops
        - Max iterations enforced in should_revise() function
    
    Example:
        Writer: "It was a dark night..."
        Critic: "Needs more detail about the setting"
        → Loop back to writer with feedback
        Writer: "It was a dark and stormy night. The wind howled..."
        Critic: "Approved ✅"
        → Proceed to final response
    """
    try:
        from .agents.critic import critique_content
        
        results = state.get("results", {}) or {}
        
        # ============================================================
        # EDGE CASE: NO CONTENT TO REVIEW
        # ============================================================
        if not results:
            return {
                "critic_approved": True,  # Nothing to review = approved
                "messages": [{
                    "role": "orchestrator",
                    "content": "No content to review",
                    "type": "decision"
                }]
            }
        
        # ============================================================
        # REVIEW EACH RESULT
        # ============================================================
        all_approved = True
        feedback = []
        
        for section_id, content in results.items():
            print(f"🎭 [Critic] Reviewing content for section: {section_id}")
            
            # Call critic agent to review content
            # This uses LLM to evaluate quality, coherence, style, etc.
            critique = await critique_content(content)
            
            # If any section is not approved, overall status is not approved
            if not critique.get("approved", False):
                all_approved = False
                feedback.append(f"{section_id}: {critique.get('feedback', 'Needs improvement')}")
        
        # ============================================================
        # RETURN CRITIC DECISION
        # ============================================================
        return {
            "critic_approved": all_approved,
            "messages": [{
                "role": "orchestrator",
                "content": "Approved ✅" if all_approved else f"Needs revision: {'; '.join(feedback)}",
                "type": "decision"
            }]
        }
        
    except Exception as e:
        print(f"❌ [Critic] Error: {e}")
        # On error, approve to avoid infinite loop
        # Better to return content than get stuck
        return {
            "critic_approved": True,
            "messages": [{
                "role": "system",
                "content": f"Critic failed, auto-approving: {str(e)}",
                "type": "error"
            }]
        }


async def tool_executor_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 4: Execute tool calls (MCP, web search, RAG, etc.)
    
    This node handles external tool execution that prepares data for the writer.
    Tools can fetch information, search, query databases, etc.
    
    Input (from state):
        - pending_tool_calls: List of tools to execute
        - tool_results: Existing tool results (if any)
    
    Output (updates state):
        - tool_results: Results from tool execution
        - pending_tool_calls: Cleared (executed)
        - tool_execution_required: Set to False
        - messages: Execution status message
    
    Tool Types (planned):
        - web_search: Search the web for information
        - rag_query: Query RAG/embedding database
        - external_api: Call external APIs
        - file_operations: Read/write files
    
    Next node: after_tools() routing function decides:
        - "writer" → Continue to writer (tools prepared data)
        - "merge" → Tools were sufficient, go to final response
    
    Current Status:
        This node is a placeholder for future MCP (Model Context Protocol) integration.
        Tools are not yet implemented, but the infrastructure is ready.
    
    Example Flow (future):
        1. Action needs research → pending_tool_calls = [web_search("character development")]
        2. Tool executor → Executes web search, gets results
        3. Tool results → Added to state
        4. Writer → Uses tool results to generate better content
    """
    pending_calls = state.get("pending_tool_calls", []) or []
    
    # ============================================================
    # EDGE CASE: NO TOOLS TO EXECUTE
    # ============================================================
    if not pending_calls:
        print("🔧 [Tools] No pending tool calls")
        return {"tool_execution_required": False}
    
    print(f"🔧 [Tools] Executing {len(pending_calls)} tool call(s)")
    
    tool_results = dict(state.get("tool_results", {}) or {})
    
    # ============================================================
    # EXECUTE EACH TOOL CALL
    # ============================================================
    for call in pending_calls:
        tool_name = call.get("tool_name")
        tool_id = call.get("id")
        params = call.get("parameters", {})
        
        print(f"🔧 [Tools] Executing: {tool_name}")
        
        # TODO: Implement actual tool execution
        # For now, return placeholder
        # Future: Integrate with MCP (Model Context Protocol) for tool execution
        if tool_name == "web_search":
            tool_results[tool_id] = {
                "status": "not_implemented",
                "message": "Web search not yet implemented"
            }
        elif tool_name == "rag_query":
            tool_results[tool_id] = {
                "status": "not_implemented", 
                "message": "RAG query not yet implemented"
            }
        else:
            tool_results[tool_id] = {
                "status": "unknown_tool",
                "message": f"Unknown tool: {tool_name}"
            }
    
    # ============================================================
    # RETURN TOOL EXECUTION RESULTS
    # ============================================================
    return {
        "tool_results": tool_results,
        "pending_tool_calls": [],  # Clear pending calls (executed)
        "tool_execution_required": False,
        "messages": [{
            "role": "orchestrator",
            "content": f"Executed {len(pending_calls)} tool(s)",
            "type": "thinking"
        }]
    }


def merge_results_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Node 7: Merge results and prepare final response.
    
    This is the FINAL node in the workflow (before END).
    It consolidates all results and prepares the response for the frontend.
    
    Input (from state):
        - results: All generated content/structure from writer
        - actions: List of actions that were executed
        - messages: All messages generated during workflow
        - intent: Intent classification
        - strategy: Execution strategy used
        - needs_clarification: Whether clarification is needed
        - clarification_options: Options for user (if clarification needed)
    
    Output (updates state):
        - messages: Final completion message
        - (State is already complete, this just adds a summary message)
    
    Process:
        1. Count completed results
        2. Add summary message
        3. State is ready to be returned to frontend
    
    Next node: END (workflow complete)
    
    Note:
        The actual response building happens in orchestrate.py after the graph completes.
        This node just adds a final message. The full state is returned to the API endpoint.
    
    What gets returned to frontend:
        - success: true/false
        - intent: Intent classification
        - actions: List of actions
        - messages: All messages (thinking, results, errors)
        - results: Generated content/structure
        - needs_clarification: Whether user needs to choose
        - clarification_options: Options for user
        - iterations_used: How many writer-critic iterations
        - critic_approved: Whether critic approved (if used)
    """
    results = state.get("results", {}) or {}
    actions = state.get("actions", []) or []
    
    # Count how many results were successfully generated
    completed = len([r for r in results.values() if r])
    
    # Add final summary message
    return {
        "messages": [{
            "role": "orchestrator",
            "content": f"Completed {completed} action(s)",
            "type": "result"
        }]
    }