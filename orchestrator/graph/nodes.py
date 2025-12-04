# graph/nodes.py
"""
LangGraph Node Functions

Each node is a function that takes state and returns a dict with ONLY
the keys that should be updated. LangGraph merges this with existing state.
"""

from typing import Dict, Any
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
    """
    intent = state.get("intent", {}) or {}
    intent_type = intent.get("intent", "")
    
    actions = []
    
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
                "priority": "normal"
            })
        else:
            # No active segment - generate content without section
            actions.append({
                "type": "generate_content",
                "payload": {
                    "prompt": state.get("user_message", "")
                },
                "requiresUserInput": False,
                "priority": "normal"
            })
    
    elif intent_type == "create_structure":
        entities = intent.get("extractedEntities", {}) or {}
        actions.append({
            "type": "generate_structure",
            "payload": {
                "format": entities.get("documentFormat", "novel"),
                "prompt": state.get("user_message", "")
            },
            "requiresUserInput": False,
            "priority": "high"
        })
    
    elif intent_type == "answer_question":
        actions.append({
            "type": "generate_content",
            "payload": {
                "prompt": state.get("user_message", ""),
                "isAnswer": True
            },
            "requiresUserInput": False,
            "priority": "normal"
        })
    
    elif intent_type == "navigate_section":
        entities = intent.get("extractedEntities", {}) or {}
        actions.append({
            "type": "select_section",
            "payload": {
                "sectionId": entities.get("targetSection"),
                "sectionName": entities.get("targetSectionName")
            },
            "requiresUserInput": False,
            "priority": "high"
        })
    
    elif intent_type == "general_chat":
        actions.append({
            "type": "generate_content",
            "payload": {
                "prompt": state.get("user_message", ""),
                "isChat": True
            },
            "requiresUserInput": False,
            "priority": "low"
        })
    
    print(f"📝 [Node] Generated {len(actions)} action(s)")
    
    return {
        "actions": actions,
        "messages": [{
            "role": "orchestrator",
            "content": f"Generated {len(actions)} action(s): {[a['type'] for a in actions]}",
            "type": "thinking"
        }]
    }


async def writer_node(state: OrchestratorState) -> Dict[str, Any]:
    """
    Execute writing actions.
    """
    try:
        from .agents.writer import generate_content
        
        actions = state.get("actions", []) or []
        results = dict(state.get("results", {}) or {})  # Make a copy
        
        for action in actions:
            if action.get("type") == "generate_content":
                payload = action.get("payload", {})
                section_name = payload.get("sectionName", "Content")
                section_id = payload.get("sectionId", "default")
                
                print(f"✍️ [Writer] Generating content for: {section_name}")
                
                content = await generate_content(
                    prompt=payload.get("prompt", ""),
                    section_name=section_name,
                    context=state.get("canvas_context")
                )
                
                results[section_id] = content
        
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