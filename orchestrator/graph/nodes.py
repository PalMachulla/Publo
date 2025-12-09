"""
LangGraph Node Functions

Each node is a function that takes state and returns a dict with ONLY
the keys that should be updated. LangGraph merges this with existing state.
"""

from typing import Dict, Any, Optional
from .state import OrchestratorState


async def analyze_intent_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Analyze user intent.
    
    Replaces: OrchestratorEngine.analyzeUserIntent()
    """
    print(f"🔍 [Node] Analyzing intent for: {state.get('user_message', '')[:50]}...")
    
    try:
        # Import here to avoid circular imports
        from orchestrator.intent.analyzer import analyze_intent
        from orchestrator.intent.types import PipelineContext
        
        # Build context for intent analysis
        active_seg = state.get("active_segment")
        context = PipelineContext(
            message=state.get("user_message", ""),
            activeSegment=active_seg,
            documentPanelOpen=state.get("document_panel_open", False),
            documentFormat=state.get("document_format"),
            canvasContext=state.get("canvas_context"),
            conversationHistory=state.get("conversation_history", [])
        )
        
        # Run intent analysis
        result = await analyze_intent(state.get("user_message", ""), context)
        
        print(f"✅ [Node] Intent: {result.intent} (confidence: {result.confidence})")
        
        # Return ONLY the fields we want to update
        return {
            "intent": result.model_dump(),
            "messages": [{
                "role": "orchestrator",
                "content": f"Intent: {result.intent} ({result.confidence:.0%} confidence)",
                "type": "thinking"
            }]
        }
        
    except Exception as e:
        print(f"❌ [Node] Intent analysis error: {e}")
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
    Select execution strategy based on intent and actions.
    
    Strategies:
    - sequential: Simple tasks, 1-2 actions
    - parallel: 3+ independent sections
    - cluster: High-quality tasks needing writer-critic collaboration
    """
    intent = state.get("intent", {}) or {}
    intent_type = intent.get("intent", "")
    actions = state.get("actions", []) or []
    enable_critic = state.get("enable_critic", True)
    
    # Strategy selection logic
    if intent_type in ["answer_question", "general_chat", "navigate_section"]:
        strategy = "sequential"
    elif intent_type == "create_structure":
        strategy = "sequential"
    elif len(actions) >= 3:
        strategy = "parallel"
    elif intent_type in ["write_content", "improve_content"] and enable_critic:
        confidence = intent.get("confidence", 0)
        if confidence > 0.9:
            strategy = "cluster"  # High-quality writing uses writer-critic
        else:
            strategy = "sequential"
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


def generate_actions_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Generate actions based on intent.
    
    Supports:
    - generate_content: Write content for sections
    - generate_structure: Create document structure
    - select_section: Navigate to section
    - open_document: Open document panel/node
    - delete_node: Delete canvas node
    - request_clarification: Ask user to choose from options
    """
    intent = state.get("intent", {}) or {}
    intent_type = intent.get("intent", "")
    entities = intent.get("extractedEntities", {}) or {}
    
    actions = []
    needs_clarification = False
    clarification_options = []
    clarification_message = None
    original_action = None
    
    # ========== WRITE CONTENT ==========
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
    
    # ========== CREATE STRUCTURE ==========
    elif intent_type == "create_structure":
        # Import template registry
        from .schemas.template_registry import (
            get_templates_for_format, 
            find_template_by_keywords,
            get_format_label,
            get_available_formats
        )
        
        user_message = state.get("user_message", "").lower()
        
        # First, detect format from entities OR message
        format_type = entities.get("documentFormat") or entities.get("document_format")
        
        # If not in entities, try to detect from message
        if not format_type:
            available_formats = get_available_formats()
            for fmt in available_formats:
                # Check for format mention in message
                if fmt in user_message or fmt.replace("-", " ") in user_message:
                    format_type = fmt
                    print(f"✅ [Actions] Detected format from message: {format_type}")
                    break
        
        # Default to novel if still not detected
        if not format_type:
            format_type = "novel"
            print(f"⚠️ [Actions] No format detected, defaulting to: {format_type}")
        
        suggested_template = entities.get("suggestedTemplate") or entities.get("suggested_template")
        
        # Check if we have a clarification response with selected template
        clarification_response = state.get("clarification_response")
        if clarification_response and clarification_response.get("original_action") == "create_structure":
            suggested_template = clarification_response.get("option_id")
            print(f"✅ [Actions] Using template from clarification: {suggested_template}")
        
        # Try to find template from keywords if not explicitly set
        # Only search within the detected format
        if not suggested_template:
            matched_template = find_template_by_keywords(format_type, user_message)
            if matched_template:
                suggested_template = matched_template.id
                print(f"✅ [Actions] Matched template from keywords: {suggested_template}")
        
        # If still no template and format has templates, request clarification
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
    
    # ========== ANSWER QUESTION ==========
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
    
    # ========== NAVIGATE SECTION ==========
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
    
    # ========== OPEN DOCUMENT ==========
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
    
    # ========== DELETE NODE ==========
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
    
    # ========== GENERAL CHAT ==========
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
    
    print(f"📝 [Node] Generated {len(actions)} action(s), needs_clarification={needs_clarification}")
    
    result = {
        "actions": actions,
        "messages": [{
            "role": "orchestrator",
            "content": f"Generated {len(actions)} action(s): {[a['type'] for a in actions]}",
            "type": "thinking"
        }]
    }
    
    # Add clarification state if needed
    if needs_clarification:
        result["needs_clarification"] = True
        result["clarification_options"] = clarification_options
        result["clarification_message"] = clarification_message
        result["original_action"] = original_action
        
        # Add clarification message to UI
        result["messages"].append({
            "role": "orchestrator",
            "content": clarification_message,
            "type": "options",
            "options": clarification_options
        })
    
    return result


def find_section_by_name(name: str, structure_items: list) -> Optional[dict]:
    """Helper to find section by name with fuzzy matching"""
    if not name or not structure_items:
        return None
    
    name_lower = name.lower().strip()
    
    def search(items):
        for item in items:
            item_name = (item.get("name") or "").lower()
            if name_lower in item_name or item_name in name_lower:
                return item
            if item.get("children"):
                found = search(item["children"])
                if found:
                    return found
        return None
    
    return search(structure_items)


async def writer_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Execute writing actions.
    Handles both content generation and structure generation.
    """
    try:
        from .agents.writer import generate_content, generate_structure
        
        actions = state.get("actions", []) or []
        results = dict(state.get("results", {}) or {})  # Make a copy
        
        for action in actions:
            action_type = action.get("type")
            payload = action.get("payload", {})
            
            if action_type == "generate_content":
                section_name = payload.get("sectionName", "Content")
                section_id = payload.get("sectionId", "default")
                
                print(f"✍️ [Writer] Generating content for: {section_name}")
                
                content = await generate_content(
                    prompt=payload.get("prompt", ""),
                    section_name=section_name,
                    context=state.get("canvas_context")
                )
                
                results[section_id] = content
                
            elif action_type == "generate_structure":
                format_type = payload.get("format", "novel")
                template_id = payload.get("template")
                prompt = payload.get("prompt", "")
                
                print(f"📐 [Writer] Generating structure for: {format_type} (template: {template_id or 'default'})")
                
                structure = await generate_structure(
                    prompt=prompt,
                    format_type=format_type,
                    template_id=template_id,
                    context=state.get("canvas_context")
                )
                
                results["structure"] = structure
        
        current_iteration = state.get("iteration", 0) or 0
        
        return {
            "results": results,
            "iteration": current_iteration + 1,
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


async def critic_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Review and critique content.
    """
    try:
        from .agents.critic import critique_content
        
        results = state.get("results", {}) or {}
        
        if not results:
            return {
                "critic_approved": True,
                "messages": [{
                    "role": "orchestrator",
                    "content": "No content to review",
                    "type": "decision"
                }]
            }
        
        all_approved = True
        feedback = []
        
        for section_id, content in results.items():
            print(f"🎭 [Critic] Reviewing content for section: {section_id}")
            
            critique = await critique_content(content)
            
            if not critique.get("approved", False):
                all_approved = False
                feedback.append(f"{section_id}: {critique.get('feedback', 'Needs improvement')}")
        
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
    Execute tool calls (MCP, web search, RAG, etc.)
    
    This node handles:
    - Web search via MCP
    - RAG/embedding queries
    - External API calls
    - File operations
    
    TODO: Implement when ready
    """
    pending_calls = state.get("pending_tool_calls", []) or []
    
    if not pending_calls:
        print("🔧 [Tools] No pending tool calls")
        return {"tool_execution_required": False}
    
    print(f"🔧 [Tools] Executing {len(pending_calls)} tool call(s)")
    
    tool_results = dict(state.get("tool_results", {}) or {})
    
    for call in pending_calls:
        tool_name = call.get("tool_name")
        tool_id = call.get("id")
        params = call.get("parameters", {})
        
        print(f"🔧 [Tools] Executing: {tool_name}")
        
        # TODO: Implement actual tool execution
        # For now, return placeholder
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
    
    return {
        "tool_results": tool_results,
        "pending_tool_calls": [],  # Clear pending calls
        "tool_execution_required": False,
        "messages": [{
            "role": "orchestrator",
            "content": f"Executed {len(pending_calls)} tool(s)",
            "type": "thinking"
        }]
    }


def merge_results_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Merge results and prepare final response.
    """
    results = state.get("results", {}) or {}
    actions = state.get("actions", []) or []
    
    completed = len([r for r in results.values() if r])
    
    return {
        "messages": [{
            "role": "orchestrator",
            "content": f"Completed {completed} action(s)",
            "type": "result"
        }]
    }