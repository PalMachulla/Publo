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

Your job is to break down user requests into detailed, executable plans.

When a user asks to:
- Create a story structure → Plan: research structure, create outline, generate sections
- Write content → Plan: identify target section, gather context, write content, review
- Edit content → Plan: identify changes, update content, verify consistency
- Navigate → Plan: find section, open document, select section

Always create a plan with clear steps. Each step should be:
1. Specific and actionable
2. Have clear dependencies (which steps must complete first)
3. Include context needed (what files/data to read)
4. Specify expected output (what will be created)

Plan Format (JSON):
{{
  "task": "User's original request",
  "intent": "write_content | create_structure | navigate_section | etc.",
  "steps": [
    {{
      "id": "step_1",
      "description": "Clear description of what this step does",
      "action_type": "generate_content | generate_structure | select_section | etc.",
      "dependencies": [],  // Steps that must complete first (by id)
      "context_needed": ["canvas_state", "document_structure"],  // Files to read
      "payload": {{  // Action payload (sectionId, prompt, format, etc.)
        "sectionId": "...",
        "prompt": "...",
        "format": "..."
      }},
      "priority": "high | normal | low",
      "requires_user_input": false  // Does this need user to choose something?
    }}
  ],
  "clarification_needed": false,  // Does the plan need user input?
  "clarification_message": null,  // Question to ask user
  "clarification_options": []  // Options for user to choose
}}

Important:
- Break complex tasks into multiple steps
- Order steps by dependencies (no circular dependencies)
- Include all necessary context
- Mark steps that need user input
- If information is missing, set clarification_needed=true"""


PLANNER_USER_PROMPT = """User Request: {user_message}

Intent Analysis:
- Intent: {intent_type}
- Confidence: {confidence}
- Reasoning: {reasoning}
- Extracted Entities: {entities}

Current Context:
- Active Segment: {active_segment}
- Document Format: {document_format}
- Document Panel Open: {document_panel_open}
- Structure Items: {structure_items_count} sections available
- Canvas Nodes: {canvas_nodes_count} nodes on canvas

Create a detailed plan to fulfill this request.
Break it down into clear, executable steps with dependencies.
If information is missing or ambiguous, set clarification_needed=true."""


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
        active_segment_str = f"{active_segment.get('name')} (id: {active_segment.get('id')})" if active_segment else "None"
        
        structure_items = context.get("structure_items", [])
        canvas_nodes = context.get("canvas_nodes", [])
        
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
            canvas_nodes_count=len(canvas_nodes)
        )
        
        # Create prompt template
        prompt = ChatPromptTemplate.from_messages([
            ("system", PLANNER_SYSTEM_PROMPT),
            ("human", user_prompt)
        ])
        
        # Generate plan using LLM
        try:
            chain = prompt | self.llm
            response = await chain.ainvoke({})
            
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
            
            if "action_type" not in step:
                # Infer from description
                desc = step.get("description", "").lower()
                if "structure" in desc or "outline" in desc:
                    step["action_type"] = "generate_structure"
                elif "content" in desc or "write" in desc:
                    step["action_type"] = "generate_content"
                elif "navigate" in desc or "select" in desc:
                    step["action_type"] = "select_section"
                else:
                    step["action_type"] = "general_task"
            
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

