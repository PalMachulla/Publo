"""
Deep Agent Planner

Replaces generate_actions_node with a Deep Agent that creates
detailed task plans with decomposition.

This planner uses LLM reasoning to break down user requests into
executable steps, which are then converted to actions for backward compatibility.

Phase 2: Deep Agent Planner
"""

from typing import Dict, Any, List, Optional
from langchain.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
import json
import os

from .deep_agent_backend import OrchestratorFilesystemBackend


# ============================================================
# PLANNING SYSTEM PROMPT
# ============================================================
PLANNER_SYSTEM_PROMPT = """You are Publo's creative writing orchestrator planner.

Your job is to create focused, minimal plans for user requests.

CRITICAL: Match complexity to the request. DO NOT over-plan!

**SIMPLE REQUESTS (1 step max):**
- "Open X" → 1 step: open_document
- "Go to chapter 3" → 1 step: select_section
- "Close the document" → 1 step: close_document
- "Show me Y" → 1 step: open_document or select_section

**MODERATE REQUESTS (2-3 steps):**
- "Write chapter 1" → 1-2 steps: (select_section), generate_content
- "Create an outline" → 1 step: generate_structure

**COMPLEX REQUESTS (3-5 steps):**
- "Create a novel about X" → 2-3 steps: generate_structure
- "Write the entire story" → Multiple steps for each section

Plan Format (JSON):
{{
  "task": "User's original request",
  "intent": "open_document | write_content | create_structure | navigate_section | etc.",
  "steps": [
    {{
      "id": "step_1",
      "description": "What this step does",
      "action_type": "open_document | generate_content | generate_structure | select_section",
      "dependencies": [],
      "payload": {{
        "documentTitle": "...",  // For open_document
        "sectionId": "...",      // For select_section/generate_content
        "format": "..."          // For generate_structure
      }},
      "priority": "high",
      "requires_user_input": false
    }}
  ],
  "clarification_needed": false,
  "clarification_message": null,
  "clarification_options": []
}}

IMPORTANT RULES:
1. "Open X" = JUST open the document. Do NOT write content.
2. "Go to X" = JUST navigate. Do NOT generate anything.
3. Only add writing steps if user EXPLICITLY asks to write/create content.
4. Fewer steps is ALWAYS better. Don't add unnecessary steps.
5. If intent is "open_and_write", check if user actually said "write" or just "open".

CONTEXT-AWARE RULES:
6. "this chapter", "this section", "it" = Refers to the ACTIVE SEGMENT (provided in context).
   If Active Segment is provided, use its ID and name in the action payload.
7. If user says "write this chapter" but NO Active Segment is set → ASK FOR CLARIFICATION.
   Set clarification_needed=true, message="Which chapter would you like me to write?"
8. When writing content, ALWAYS include:
   - sectionId: The section/chapter ID to write
   - sectionName: The name for display
   - prompt: What to write (from user message + context)

WRITING CONTENT:
9. For "write chapter X" → generate_content with that chapter's sectionId
10. For "write this chapter" with active segment → generate_content with activeSegment.id
11. Include context about the story/document in the prompt for better content generation."""


PLANNER_USER_PROMPT = """User Request: {user_message}

Intent Analysis:
- Intent: {intent_type}
- Confidence: {confidence}
- Reasoning: {reasoning}
- Extracted Entities: {entities}

Current Context:
- Active Segment (currently selected): {active_segment}
- Document Format: {document_format}
- Document Panel Open: {document_panel_open}
- Structure Items: {structure_items_count} sections available
- Available Sections: {structure_items_summary}
- Canvas Nodes: {canvas_nodes_count} nodes on canvas

CRITICAL: If user says "this chapter", "this section", or similar:
- If Active Segment is set → Use Active Segment's ID as sectionId
- If NO Active Segment → Set clarification_needed=true

Create a MINIMAL plan to fulfill this request.
- "Write this chapter" with active segment → 1 step: generate_content with activeSegment.id
- "Write chapter 5" → 1 step: generate_content with sectionId="chapter-5"
- If unclear which chapter → clarification_needed=true"""


class PlannerAgent:
    """
    Deep Agent that plans tasks by decomposing them into sub-tasks.
    
    This replaces the fixed action generation logic with dynamic planning
    using LLM reasoning. The plan is then converted to actions for backward compatibility.
    
    Usage:
        planner = PlannerAgent(backend)
        plan = await planner.create_plan(user_message, intent, context_files)
        actions = convert_plan_to_actions(plan)
    """
    
    def __init__(self, backend: OrchestratorFilesystemBackend):
        """
        Initialize planner agent.
        
        Args:
            backend: Filesystem backend for storing plans
        """
        self.backend = backend
        self.llm = self._get_llm()
    
    def _get_llm(self) -> BaseChatModel:
        """
        Get LLM for planning (uses same model selection as intent analyzer).
        
        Returns:
            Configured LLM instance
        """
        # Use same model selection logic as intent analyzer
        model_provider = os.getenv("LLM_PROVIDER", "openai").lower()
        model_name = os.getenv("LLM_MODEL", "gpt-4o-mini")
        
        if model_provider == "anthropic" or "claude" in model_name.lower():
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY not set")
            return ChatAnthropic(
                model=model_name if "claude" in model_name.lower() else "claude-3-5-sonnet-20241022",
                temperature=0.3  # Lower temperature for more consistent planning
            )
        elif model_provider == "google" or "gemini" in model_name.lower():
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise ValueError("GOOGLE_API_KEY not set")
            return ChatGoogleGenerativeAI(
                model=model_name if "gemini" in model_name.lower() else "gemini-1.5-pro",
                temperature=0.3
            )
        else:  # Default to OpenAI
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not set")
            return ChatOpenAI(
                model=model_name,
                temperature=0.3
            )
    
    async def create_plan(
        self,
        user_message: str,
        intent: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a detailed plan for the user's request.
        
        Args:
            user_message: User's original request
            intent: Intent analysis result from analyze_intent_node
            context: Additional context (active_segment, structure_items, etc.)
        
        Returns:
            Plan dictionary with steps, dependencies, and metadata
        
        Example:
            plan = await planner.create_plan(
                "Create a hero's journey novel",
                {"intent": "create_structure", "confidence": 0.9},
                {"document_format": "novel", "structure_items": []}
            )
            # Returns plan with steps for structure creation
        """
        print(f"🧠 [Planner] Creating plan for: {user_message[:50]}...")
        
        # Store context for later use in clarification enrichment
        self._current_context = context
        
        # ============================================================
        # PHASE 5: LOAD MEMORY (PREFERENCES & PATTERNS)
        # ============================================================
        # Load user preferences and successful patterns to inform planning
        memory_context = ""
        try:
            from orchestrator.agents.memory_manager import MemoryManager
            memory = MemoryManager(self.backend)
            
            # Load preferences
            preferences = memory.load_preferences()
            if preferences:
                memory_context += f"\n\nUser Preferences:\n{json.dumps(preferences, indent=2)}"
            
            # Load relevant patterns
            intent_type = intent.get("intent", "")
            patterns = memory.find_similar_patterns(intent_type)
            if patterns:
                memory_context += f"\n\nSuccessful Patterns (similar to '{intent_type}'):\n"
                for pattern in patterns[:3]:  # Top 3 patterns
                    memory_context += f"- {pattern.get('description', 'Unknown')}\n"
            
            # Load style guide
            style_guide = memory.load_style_guide()
            if style_guide:
                memory_context += f"\n\nWriting Style Guide:\n{json.dumps(style_guide, indent=2)}"
            
            if memory_context:
                print(f"💾 [Planner] Loaded memory: {len(preferences)} preference(s), {len(patterns)} pattern(s)")
        
        except Exception as e:
            print(f"⚠️ [Planner] Failed to load memory (non-fatal): {e}")
            memory_context = ""
        
        # Build prompt
        intent_type = intent.get("intent", "")
        confidence = intent.get("confidence", 0.0)
        reasoning = intent.get("reasoning", "")
        entities = intent.get("extractedEntities", {}) or {}
        
        # Format context for prompt
        active_segment = context.get("active_segment")
        active_segment_str = f"{active_segment.get('name')} (id: {active_segment.get('id')})" if active_segment else "None (no chapter selected)"
        
        structure_items = context.get("structure_items", []) or []
        canvas_nodes = context.get("canvas_nodes", []) or []
        
        # Create a summary of available sections for context
        structure_items_summary = "None"
        if structure_items:
            summaries = []
            for item in structure_items[:10]:  # Limit to first 10
                name = item.get("name") or item.get("title") or item.get("label") or "Unnamed"
                item_id = item.get("id") or "unknown"
                summaries.append(f"- {name} (id: {item_id})")
            structure_items_summary = "\n".join(summaries)
        
        user_prompt = PLANNER_USER_PROMPT.format(
            user_message=user_message,
            intent_type=intent_type,
            confidence=confidence,
            reasoning=reasoning,
            entities=json.dumps(entities, indent=2),
            active_segment=active_segment_str,
            document_format=context.get("document_format", "novel"),
            document_panel_open=context.get("document_panel_open", False),
            structure_items_count=len(structure_items),
            structure_items_summary=structure_items_summary,
            canvas_nodes_count=len(canvas_nodes)
        )
        
        # Build messages directly (avoid ChatPromptTemplate parsing JSON examples as variables)
        # The system prompt contains JSON examples with {} braces that would be misinterpreted
        from langchain_core.messages import SystemMessage, HumanMessage
        messages = [
            SystemMessage(content=PLANNER_SYSTEM_PROMPT),
            HumanMessage(content=user_prompt)
        ]
        
        # Generate plan using LLM
        try:
            response = await self.llm.ainvoke(messages)
            
            # Extract plan from response
            plan_text = response.content if hasattr(response, 'content') else str(response)
            
            # Parse JSON from response (may be wrapped in markdown code blocks)
            plan = self._parse_plan_response(plan_text)
            
            # Validate and enrich plan
            plan = self._validate_plan(plan, user_message, intent_type)
            
            # Store plan in filesystem
            self.backend.write_file("plan/task_plan.json", plan)
            
            print(f"✅ [Planner] Plan created with {len(plan.get('steps', []))} steps")
            print(f"📋 [Planner] Plan stored at: plan/task_plan.json")
            
            return plan
            
        except Exception as e:
            print(f"❌ [Planner] Failed to create plan: {e}")
            import traceback
            traceback.print_exc()
            
            # Return fallback plan (single step)
            return self._create_fallback_plan(user_message, intent_type, entities)
    
    def _parse_plan_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse plan JSON from LLM response.
        
        LLM may return JSON wrapped in markdown code blocks, so we need to extract it.
        
        Args:
            response_text: Raw LLM response
        
        Returns:
            Parsed plan dictionary
        """
        # Try to extract JSON from markdown code blocks
        import re
        
        # Look for JSON in code blocks
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Try to find JSON object directly
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
            else:
                json_str = response_text
        
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            # If JSON parsing fails, try to fix common issues
            # Remove trailing commas, fix quotes, etc.
            json_str = json_str.replace("'", '"')  # Single to double quotes
            json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
            json_str = re.sub(r',\s*]', ']', json_str)
            
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                print(f"⚠️ [Planner] Failed to parse JSON, using fallback")
                raise
    
    def _validate_plan(self, plan: Dict[str, Any], user_message: str, intent_type: str) -> Dict[str, Any]:
        """
        Validate and enrich plan with required fields.
        
        Args:
            plan: Plan dictionary from LLM
            user_message: Original user message
            intent_type: Detected intent type
        
        Returns:
            Validated and enriched plan
        """
        # Ensure required fields exist
        if "task" not in plan:
            plan["task"] = user_message
        
        if "intent" not in plan:
            plan["intent"] = intent_type
        
        if "steps" not in plan:
            plan["steps"] = []
        
        # Ensure each step has required fields
        for i, step in enumerate(plan["steps"]):
            if "id" not in step:
                step["id"] = f"step_{i+1}"
            
            # Normalize action_type to standard types
            # The LLM may return custom types like "write_intro" - normalize to standard types
            action_type = step.get("action_type", "").lower()
            desc = step.get("description", "").lower()
            
            # Normalize structure-related actions
            if "structure" in action_type or "outline" in action_type:
                step["action_type"] = "generate_structure"
            elif "structure" in desc or "outline" in desc or "create document" in desc:
                step["action_type"] = "generate_structure"
            # Normalize content-related actions - CRITICAL for write requests
            elif any(kw in action_type for kw in ["write", "content", "draft", "compose", "author"]):
                step["action_type"] = "generate_content"
            elif any(kw in desc for kw in ["write", "content", "draft", "compose", "author", "create text"]):
                step["action_type"] = "generate_content"
            # Normalize navigation actions
            elif "navigate" in action_type or "select" in action_type:
                step["action_type"] = "select_section"
            elif "navigate" in desc or "select" in desc or "go to" in desc:
                step["action_type"] = "select_section"
            # Default if no action_type
            elif not action_type:
                step["action_type"] = "general_task"
            # Otherwise keep the LLM's action_type (but warn)
            
            if "dependencies" not in step:
                step["dependencies"] = []
            
            if "payload" not in step:
                step["payload"] = {}
            
            if "priority" not in step:
                step["priority"] = "normal"
            
            if "requires_user_input" not in step:
                step["requires_user_input"] = False
        
        # Ensure clarification fields exist
        if "clarification_needed" not in plan:
            plan["clarification_needed"] = False
        
        if "clarification_message" not in plan:
            plan["clarification_message"] = None
        
        if "clarification_options" not in plan:
            plan["clarification_options"] = []
        
        # ============================================================
        # ENRICH CLARIFICATION OPTIONS
        # ============================================================
        # If clarification is needed and options are empty, 
        # try to provide useful options from context
        if plan.get("clarification_needed") and not plan.get("clarification_options"):
            context = getattr(self, '_current_context', {}) or {}
            structure_items = context.get("structure_items", []) or []
            clarification_msg = (plan.get("clarification_message") or "").lower()
            
            # If asking about chapters/sections and we have structure items
            if any(word in clarification_msg for word in ["chapter", "section", "which"]):
                if structure_items:
                    # Convert structure items to clarification options
                    plan["clarification_options"] = [
                        {
                            "id": item.get("id", f"item-{i}"),
                            "label": item.get("name") or item.get("title") or f"Item {i+1}",
                            "description": item.get("description", "")[:50] if item.get("description") else None
                        }
                        for i, item in enumerate(structure_items[:10])  # Limit to 10 options
                    ]
                    print(f"✅ [Planner] Enriched clarification with {len(plan['clarification_options'])} options from structure")
        
        return plan
    
    def _create_fallback_plan(
        self,
        user_message: str,
        intent_type: str,
        entities: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a simple fallback plan if LLM planning fails.
        
        Args:
            user_message: User's message
            intent_type: Detected intent
            entities: Extracted entities
        
        Returns:
            Simple single-step plan
        """
        return {
            "task": user_message,
            "intent": intent_type,
            "steps": [{
                "id": "step_1",
                "description": f"Execute {intent_type} action",
                "action_type": intent_type,
                "dependencies": [],
                "context_needed": [],
                "payload": entities,
                "priority": "normal",
                "requires_user_input": False
            }],
            "clarification_needed": False,
            "clarification_message": None,
            "clarification_options": []
        }

