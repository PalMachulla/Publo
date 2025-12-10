"""
Deep Analyzer - LLM-Based Intent Analysis

This is the Python equivalent of your DeepAnalyzer.ts

Uses LangChain to call Claude/GPT for complex intent analysis when
pattern matching doesn't give a confident result.

Key differences from TypeScript version:
- Uses LangChain for LLM calls (cleaner API)
- Async/await works more naturally in Python
- Pydantic for response validation (instead of manual parsing)
"""

import os
import json
from typing import Optional
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

from .types import IntentAnalysis, PipelineContext


# ============================================================
# LLM RESPONSE SCHEMA
# ============================================================

class LLMIntentResponse(BaseModel):
    """
    Schema for the LLM's JSON response.
    This guides the LLM to return structured data.
    """
    intent: str = Field(description="The detected intent (e.g., 'write_content', 'create_structure')")
    confidence: float = Field(description="Confidence score from 0.0 to 1.0")
    reasoning: str = Field(description="Brief explanation of why this intent was detected")
    suggestedAction: str = Field(description="What action the system should take")
    requiresContext: bool = Field(description="Whether canvas/document context is needed")
    suggestedModel: str = Field(description="Which model type to use: 'orchestrator', 'writer', or 'editor'")
    needsClarification: bool = Field(default=False, description="Whether to ask user for clarification")
    clarifyingQuestion: Optional[str] = Field(default=None, description="Question to ask if clarification needed")
    extractedEntities: dict = Field(default_factory=dict, description="Any entities extracted (chapter names, etc.)")


# ============================================================
# PROMPT TEMPLATE
# ============================================================
# This mirrors your PromptComposer.ts logic

SYSTEM_PROMPT = """You are an intent analyzer for Publo, a creative writing platform.

Your job is to analyze user messages and determine their intent. The possible intents are:

STRUCTURE INTENTS (creating/modifying document structure):
- create_structure: User wants to create a new story/document from scratch
- modify_structure: User wants to add, remove, or reorganize sections

CONTENT INTENTS (writing/editing content):
- write_content: User wants to generate new content for a section
- improve_content: User wants to refine/polish existing content
- rewrite_with_coherence: User wants to update content while maintaining consistency

NAVIGATION INTENTS:
- navigate_section: User wants to jump to a specific section
- open_and_write: User wants to open a document and write in it

OTHER INTENTS:
- answer_question: User is asking a question (not requesting an action)
- delete_node: User wants to delete something
- general_chat: General conversation, doesn't fit other categories

CONTEXT INFORMATION:
{context_section}

IMPORTANT:
- Return ONLY valid JSON matching the schema
- Be concise in reasoning (1-2 sentences)
- Confidence should reflect certainty (0.5 = unsure, 0.9+ = very confident)
- If truly ambiguous, set needsClarification=true and provide a clarifyingQuestion
"""

USER_PROMPT = """Analyze this user message and determine the intent:

"{message}"

Return your analysis as JSON with these fields:
- intent: string (one of the intents listed above)
- confidence: number (0.0 to 1.0)
- reasoning: string (brief explanation)
- suggestedAction: string (what to do)
- requiresContext: boolean
- suggestedModel: string ("orchestrator", "writer", or "editor")
- needsClarification: boolean
- clarifyingQuestion: string or null
- extractedEntities: object (any extracted names, numbers, etc.)

JSON response:"""


# ============================================================
# DEEP ANALYZER CLASS
# ============================================================

class DeepAnalyzer:
    """
    LLM-based deep intent analyzer.
    
    Uses Claude by default (better at following instructions),
    falls back to GPT-4 if Anthropic key not available.
    """
    
    def __init__(self, model_name: Optional[str] = None):
        """
        Initialize the analyzer with an LLM.
        
        Args:
            model_name: Override the default model selection
        """
        self.llm = self._create_llm(model_name)
        self.parser = JsonOutputParser(pydantic_object=LLMIntentResponse)
        
    def _create_llm(self, model_name: Optional[str] = None):
        """
        Create the LLM instance.
        
        Priority:
        1. Use specified model_name if provided
        2. Use Claude if ANTHROPIC_API_KEY is available
        3. Fall back to GPT-4 if OPENAI_API_KEY is available
        """
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        
        if model_name:
            # User specified a model
            if "claude" in model_name.lower():
                return ChatAnthropic(model=model_name, temperature=0.2)
            else:
                return ChatOpenAI(model=model_name, temperature=0.2)
        
        # Auto-select based on available keys
        if anthropic_key:
            print("🤖 [DeepAnalyzer] Using Claude for intent analysis")
            return ChatAnthropic(
                model="claude-sonnet-4-20250514",
                temperature=0.2,
                max_tokens=1000
            )
        elif openai_key:
            print("🤖 [DeepAnalyzer] Using GPT-4 for intent analysis")
            return ChatOpenAI(
                model="gpt-4-turbo-preview",
                temperature=0.2,
                max_tokens=1000
            )
        else:
            raise ValueError(
                "No LLM API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY"
            )
    
    def _build_context_section(self, context: PipelineContext) -> str:
        """
        Build the context section for the prompt.
        
        This mirrors your PromptComposer.compose() logic.
        """
        sections = []
        
        # Document panel state
        if context.documentPanelOpen:
            sections.append(f"- Document panel is OPEN (format: {context.documentFormat or 'unknown'})")
            if context.activeSegment:
                segment = context.activeSegment
                sections.append(f"- Active section: \"{segment.get('name', 'Unknown')}\" (level {segment.get('level', 1)})")
        else:
            sections.append("- Document panel is CLOSED (user is on canvas view)")
        
        # Canvas context
        if context.canvasContext:
            canvas = context.canvasContext
            node_count = canvas.get("totalNodes", 0)
            if node_count > 0:
                sections.append(f"- Canvas has {node_count} nodes")
                # List connected nodes briefly
                connected = canvas.get("connectedNodes", [])
                if connected:
                    node_names = [n.get("label", "Unknown") for n in connected[:3]]
                    sections.append(f"- Connected documents: {', '.join(node_names)}")
        
        # Recent conversation
        if context.conversationHistory:
            recent = context.conversationHistory[-3:]  # Last 3 messages
            if recent:
                sections.append("- Recent conversation:")
                for msg in recent:
                    role = msg.get("role", "unknown")
                    content = msg.get("content", "")[:100]  # Truncate
                    sections.append(f"  [{role}]: {content}...")
        
        return "\n".join(sections) if sections else "No additional context available."
    
    async def analyze(
        self,
        message: str,
        context: PipelineContext
    ) -> IntentAnalysis:
        """
        Perform deep intent analysis using LLM.
        
        Args:
            message: The user's message
            context: Pipeline context (document state, canvas, history)
            
        Returns:
            IntentAnalysis with detected intent and metadata
        """
        print(f"🧠 [DeepAnalyzer] Starting deep analysis for: {message[:50]}...")
        
        # Build the prompt
        context_section = self._build_context_section(context)
        system_prompt = SYSTEM_PROMPT.format(context_section=context_section)
        user_prompt = USER_PROMPT.format(message=message)
        
        try:
            # Create the prompt template
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("human", user_prompt)
            ])
            
            # Create the chain: prompt -> LLM -> parse JSON
            chain = prompt | self.llm
            
            # Execute
            response = await chain.ainvoke({})
            
            # Parse the response
            return self._parse_response(response.content)
            
        except Exception as e:
            print(f"❌ [DeepAnalyzer] Analysis failed: {e}")
            return self._create_fallback_intent(message)
    
    def _parse_response(self, response_text: str) -> IntentAnalysis:
        """
        Parse the LLM's response into IntentAnalysis.
        
        Handles various response formats:
        - Clean JSON
        - JSON in markdown code blocks
        - JSON with surrounding text
        """
        try:
            content = response_text.strip()
            
            # Remove markdown code blocks if present
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            content = content.strip()
            
            # Extract JSON object if wrapped in text
            if not content.startswith("{"):
                import re
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    content = json_match.group()
            
            # Parse JSON
            data = json.loads(content)
            
            # Validate and create IntentAnalysis
            return IntentAnalysis(
                intent=data.get("intent", "general_chat"),
                confidence=float(data.get("confidence", 0.5)),
                reasoning=data.get("reasoning", "Deep analysis completed"),
                suggestedAction=data.get("suggestedAction", "Process the request"),
                requiresContext=data.get("requiresContext", True),
                suggestedModel=data.get("suggestedModel", "orchestrator"),
                needsClarification=data.get("needsClarification", False),
                clarifyingQuestion=data.get("clarifyingQuestion"),
                extractedEntities=data.get("extractedEntities", {}),
                usedLLM=True
            )
            
        except Exception as e:
            print(f"❌ [DeepAnalyzer] Failed to parse response: {e}")
            print(f"Response text: {response_text[:500]}")
            return self._create_fallback_intent("")
    
    def _create_fallback_intent(self, message: str) -> IntentAnalysis:
        """
        Create a fallback intent when analysis fails.
        """
        return IntentAnalysis(
            intent="general_chat",
            confidence=0.3,
            reasoning="Deep analysis failed, defaulting to conversation",
            suggestedAction="Respond conversationally and ask for clarification",
            requiresContext=False,
            suggestedModel="orchestrator",
            needsClarification=True,
            clarifyingQuestion=f"I'm not sure I understood your request. Could you please clarify what you'd like me to do?",
            usedLLM=True
        )


# ============================================================
# SINGLETON INSTANCE
# ============================================================

_analyzer_instance: Optional[DeepAnalyzer] = None

def get_deep_analyzer() -> DeepAnalyzer:
    """
    Get the singleton DeepAnalyzer instance.
    
    Lazy initialization to avoid creating the LLM connection
    until actually needed.
    """
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = DeepAnalyzer()
    return _analyzer_instance
