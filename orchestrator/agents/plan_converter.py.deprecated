"""
Plan to Actions Converter

Converts Deep Agent plans to OrchestratorActions for backward compatibility.

This allows the planner to create detailed plans while maintaining
compatibility with the existing workflow that expects actions.
"""

from typing import Dict, Any, List, Optional
import re


def _is_contextual_reference(text: str) -> bool:
    """Check if text contains 'this chapter', 'this section', etc."""
    if not text:
        return False
    t = text.lower()
    patterns = ["this chapter", "this section", "the chapter", "current chapter",
                "write it", "expand it", "write this", "expand this"]
    return any(p in t for p in patterns)


def _extract_section_from_text(text: str) -> Optional[Dict[str, str]]:
    """
    Extract section information from text (e.g., "Write chapter 6" -> {"name": "Chapter 6", "id": "chapter-6"}).
    
    Handles patterns like:
    - "chapter 6", "Chapter 6"
    - "scene 3", "Scene III"
    - "act 2", "Act II"
    
    Returns:
        Dict with "id" and "name" if found, None otherwise
    """
    if not text:
        return None
    
    # Pattern for section references
    pattern = r'\b(chapter|scene|act|section|part|episode)\s+(\d+|[ivxIVX]+)\b'
    match = re.search(pattern, text, re.IGNORECASE)
    
    if match:
        section_type = match.group(1).capitalize()
        section_num = match.group(2)
        
        # Convert Roman numerals to numbers for ID
        roman_map = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 
                     'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10}
        
        num_for_id = section_num
        if section_num.lower() in roman_map:
            num_for_id = str(roman_map[section_num.lower()])
        
        return {
            "id": f"{section_type.lower()}-{num_for_id}",
            "name": f"{section_type} {section_num.upper() if section_num.isalpha() else section_num}"
        }
    
    return None


def _find_node_by_title(title: str, canvas_nodes: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Find a canvas node by its title/label.
    
    Uses fuzzy matching to handle partial matches and case differences.
    
    Canvas nodes can have different structures:
    - React Flow format: { id, data: { label, nodeType, ... } }
    - Simplified format: { id, label, name, ... }
    
    Args:
        title: The document title to search for
        canvas_nodes: List of canvas node summaries
    
    Returns:
        Matching node dict or None
    """
    if not title or not canvas_nodes:
        return None
    
    title_lower = title.lower().strip()
    
    def get_node_label(node: Dict[str, Any]) -> str:
        """Extract label from various node formats."""
        # Try direct label
        if node.get("label"):
            return node["label"]
        # Try name
        if node.get("name"):
            return node["name"]
        # Try nested data.label (React Flow format)
        data = node.get("data", {})
        if isinstance(data, dict):
            return data.get("label") or data.get("name") or ""
        return ""
    
    # First try exact match
    for node in canvas_nodes:
        node_label = get_node_label(node).lower().strip()
        if node_label == title_lower:
            print(f"🎯 [Converter] Exact match: '{title}' → '{node_label}' (id: {node.get('id')})")
            return node
    
    # Then try partial match (title contains or is contained)
    for node in canvas_nodes:
        node_label = get_node_label(node).lower().strip()
        if node_label and (title_lower in node_label or node_label in title_lower):
            print(f"📍 [Converter] Partial match: '{title}' ↔ '{node_label}' (id: {node.get('id')})")
            return node
    
    # Debug: Show available nodes
    available = [f"{n.get('id')}: {get_node_label(n)}" for n in canvas_nodes[:5]]
    print(f"⚠️ [Converter] No match for '{title}'. Available nodes: {available}")
    
    return None


def convert_plan_to_actions(
    plan: Dict[str, Any], 
    user_message: str = "",
    canvas_nodes: Optional[List[Dict[str, Any]]] = None,
    entities: Optional[Dict[str, Any]] = None,
    active_segment: Optional[Dict[str, Any]] = None,
    structure_items: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """
    Convert a Deep Agent plan to OrchestratorActions.
    
    This maintains backward compatibility with the existing workflow.
    The plan's steps are converted to actions that can be executed.
    
    IMPORTANT: 
    - Deduplicates actions to avoid multiple structure generations.
    - Enriches payloads with user_message if not present.
    - Resolves node IDs for open_document actions using canvas_nodes.
    - Uses active_segment for "this chapter" references.
    
    Args:
        plan: Plan dictionary from PlannerAgent
        user_message: Original user message (to populate prompts)
        canvas_nodes: List of canvas nodes (for resolving node IDs)
        entities: Extracted entities from intent (for document titles, etc.)
        active_segment: Currently selected section/chapter (for "this chapter" references)
        structure_items: Available sections/chapters in the document
    
    Returns:
        List of actions compatible with existing workflow
    """
    actions = []
    steps = plan.get("steps", [])
    canvas_nodes = canvas_nodes or []
    entities = entities or {}
    structure_items = structure_items or []
    
    # Get task from plan as fallback for user_message
    task = plan.get("task", user_message) or user_message
    
    # Sort steps by dependencies (topological sort)
    sorted_steps = _topological_sort_steps(steps)
    
    # Track action types to deduplicate
    structure_action_added = False
    content_sections_added = set()  # Track section IDs to avoid duplicate content actions
    
    for step in sorted_steps:
        action_type = step.get("action_type", "general_task")
        
        # Skip duplicate structure actions (only need one)
        if action_type == "generate_structure":
            if structure_action_added:
                print(f"⏭️ [Converter] Skipping duplicate structure action: {step.get('description', '')[:50]}")
                continue
            structure_action_added = True
        
        # Get payload and enrich with user_message/prompt if missing
        payload = dict(step.get("payload", {}))  # Copy to avoid mutation
        
        # CRITICAL: Ensure prompt is populated for all content/structure actions
        if not payload.get("prompt"):
            payload["prompt"] = task
        
        # ============================================================
        # OPEN DOCUMENT: Resolve node ID from title
        # ============================================================
        if action_type == "open_document":
            # Try to get document title from entities or payload
            doc_title = (
                entities.get("documentTitle") or 
                entities.get("document_title") or
                payload.get("documentTitle") or
                payload.get("nodeName") or
                ""
            )
            
            if doc_title and canvas_nodes:
                # Find the node by title
                matching_node = _find_node_by_title(doc_title, canvas_nodes)
                if matching_node:
                    payload["nodeId"] = matching_node.get("id") or matching_node.get("nodeId", "")
                    payload["nodeName"] = matching_node.get("label") or matching_node.get("name", doc_title)
                    print(f"✅ [Converter] Resolved node: '{doc_title}' → {payload['nodeId']}")
                else:
                    print(f"⚠️ [Converter] Could not find node matching '{doc_title}' in {len(canvas_nodes)} nodes")
                    # Set flag to request clarification (handled by caller)
                    payload["_needs_node_clarification"] = True
                    payload["_search_term"] = doc_title
                    # Still set the name for display
                    payload["nodeName"] = doc_title
            elif doc_title:
                payload["nodeName"] = doc_title
            
            # Also check for section reference (e.g., "Open Paws and Hooks, chapter 3")
            section_info = _extract_section_from_text(task)
            if section_info:
                payload["targetSectionId"] = section_info.get("id")
                payload["targetSectionName"] = section_info.get("name")
                print(f"📍 [Converter] Also navigating to section: {section_info.get('name')}")
        
        # ============================================================
        # SELECT SECTION: Resolve section from description
        # ============================================================
        elif action_type == "select_section":
            section_info = _extract_section_from_text(
                step.get("description", "") or task
            )
            if section_info:
                payload["sectionId"] = section_info.get("id")
                payload["sectionName"] = section_info.get("name")
        
        # ============================================================
        # CONTENT: Use active segment or extract section info
        # ============================================================
        elif action_type == "generate_content":
            # Priority 1: Check if payload already has sectionId from planner
            if payload.get("sectionId") and payload.get("sectionId") != "default":
                print(f"✅ [Converter] Using sectionId from planner: {payload.get('sectionId')}")
            
            # Priority 2: Check if user said "this chapter" and we have an active segment
            elif active_segment and _is_contextual_reference(task):
                payload["sectionId"] = active_segment.get("id", "")
                payload["sectionName"] = active_segment.get("name", "Selected Section")
                print(f"✅ [Converter] Using active segment: {payload['sectionName']} ({payload['sectionId']})")
            
            # Priority 3: Try to extract section from description or task
            else:
                section_info = _extract_section_from_text(
                    step.get("description", "") or task
                )
                
                if section_info:
                    payload["sectionId"] = section_info.get("id", f"section-{step.get('id', 'default')}")
                    payload["sectionName"] = section_info.get("name", "Section")
                    print(f"✅ [Converter] Extracted section from text: {payload['sectionName']}")
                elif not payload.get("sectionId") or payload.get("sectionId") == "default":
                    # Fallback: Use step ID if no section found
                    payload["sectionId"] = f"section-{step.get('id', 'default')}"
                    payload["sectionName"] = step.get("description", "Section")[:40]
                    print(f"⚠️ [Converter] Using fallback section ID: {payload['sectionId']}")
            
            # Skip duplicate content actions for the same section
            section_id = payload.get("sectionId", "default")
            if section_id in content_sections_added:
                print(f"⏭️ [Converter] Skipping duplicate content action for section: {section_id}")
                continue
            content_sections_added.add(section_id)
        
        # Map plan step to action
        action = {
            "type": action_type,
            "payload": payload,
            "requiresUserInput": step.get("requires_user_input", False),
            "priority": step.get("priority", "normal"),
            "status": "pending",
            "dependsOn": step.get("dependencies", []),
            "autoExecute": not step.get("requires_user_input", False),
            # Store step metadata for debugging
            "_step_id": step.get("id"),
            "_step_description": step.get("description")
        }
        
        actions.append(action)
        print(f"✅ [Converter] Added action: {action_type} (prompt: {payload.get('prompt', '')[:30]}...)")
    
    return actions


def _topological_sort_steps(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sort steps by dependencies (topological sort).
    
    Ensures steps are ordered so that dependencies execute first.
    
    Args:
        steps: List of step dictionaries
    
    Returns:
        Sorted list of steps
    """
    # Build dependency graph
    step_map = {step["id"]: step for step in steps}
    in_degree = {step["id"]: len(step.get("dependencies", [])) for step in steps}
    
    # Find steps with no dependencies (can execute first)
    queue = [step_id for step_id, degree in in_degree.items() if degree == 0]
    sorted_steps = []
    
    while queue:
        step_id = queue.pop(0)
        sorted_steps.append(step_map[step_id])
        
        # Update in-degree for steps that depend on this one
        for step in steps:
            if step_id in step.get("dependencies", []):
                in_degree[step["id"]] -= 1
                if in_degree[step["id"]] == 0:
                    queue.append(step["id"])
    
    # Add any remaining steps (shouldn't happen if no circular deps)
    remaining = [step for step in steps if step not in sorted_steps]
    sorted_steps.extend(remaining)
    
    return sorted_steps


def extract_clarification_from_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract clarification information from plan.
    
    If the plan indicates clarification is needed, extract the options
    and message for the workflow to pause and wait for user input.
    
    Args:
        plan: Plan dictionary from PlannerAgent
    
    Returns:
        Dictionary with clarification fields (or empty if not needed)
    """
    if not plan.get("clarification_needed", False):
        return {}
    
    return {
        "needs_clarification": True,
        "clarification_options": plan.get("clarification_options", []),
        "clarification_message": plan.get("clarification_message"),
        "original_action": plan.get("intent", "create_structure")  # Default action type
    }

