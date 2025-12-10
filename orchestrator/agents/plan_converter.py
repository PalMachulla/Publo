"""
Plan to Actions Converter

Converts Deep Agent plans to OrchestratorActions for backward compatibility.

This allows the planner to create detailed plans while maintaining
compatibility with the existing workflow that expects actions.
"""

from typing import Dict, Any, List


def convert_plan_to_actions(plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Convert a Deep Agent plan to OrchestratorActions.
    
    This maintains backward compatibility with the existing workflow.
    The plan's steps are converted to actions that can be executed.
    
    Args:
        plan: Plan dictionary from PlannerAgent
    
    Returns:
        List of actions compatible with existing workflow
    
    Example:
        plan = {
            "steps": [
                {
                    "id": "step_1",
                    "action_type": "generate_structure",
                    "payload": {"format": "novel", "template": "hero_journey"}
                }
            ]
        }
        actions = convert_plan_to_actions(plan)
        # Returns: [{"type": "generate_structure", "payload": {...}, ...}]
    """
    actions = []
    steps = plan.get("steps", [])
    
    # Sort steps by dependencies (topological sort)
    sorted_steps = _topological_sort_steps(steps)
    
    for step in sorted_steps:
        # Map plan step to action
        action = {
            "type": step.get("action_type", "general_task"),
            "payload": step.get("payload", {}),
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

