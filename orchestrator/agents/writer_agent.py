"""
Writer Deep Agent with Subagent Spawning

Replaces writer_node with a Deep Agent that spawns subagents
for parallel content generation.

Phase 4: Subagent Spawning
Phase 6: Librarian Integration - Analyzes content after generation

LIBRARIAN INTEGRATION:
    After content is generated, the writer agent calls the Librarian
    to analyze the content and update section cards. This extracts:
    - Characters (name, role, traits, appearances)
    - Places (name, type, atmosphere)
    - Events (what happened, who was involved)
    
    The Librarian also checks for coherency issues and flags them
    on the section cards for the user to review.
"""

from typing import Dict, Any, List, Optional
import asyncio
import os
from .deep_agent_backend import OrchestratorFilesystemBackend
from .file_storage import load_context_from_filesystem


class WriterAgent:
    """
    Main writer agent that spawns subagents for parallel writing.
    
    This agent coordinates content generation by spawning specialized
    subagents for each section/chapter that needs to be written.
    
    After content is generated, the Librarian Agent is called to:
    - Extract characters, places, and events
    - Update section cards with summaries
    - Detect coherency issues
    
    Usage:
        agent = WriterAgent(backend, node_id, supabase_client)
        results = await agent.generate_content(actions, plan)
    """
    
    def __init__(
        self, 
        backend: OrchestratorFilesystemBackend,
        node_id: Optional[str] = None,
        supabase_client: Optional[Any] = None
    ):
        """
        Initialize writer agent.
        
        Args:
            backend: Filesystem backend for storing content
            node_id: Story node ID for Librarian integration (optional)
            supabase_client: Async Supabase client for Librarian (optional)
        """
        self.backend = backend
        self.node_id = node_id
        self.supabase = supabase_client
        
        # Librarian agent for coherency tracking (lazy loaded)
        self._librarian = None
    
    async def generate_content(
        self,
        actions: List[Dict[str, Any]],
        plan: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate content by spawning subagents for each section.
        
        This method:
        1. Identifies all sections that need content
        2. Spawns a subagent for each section
        3. Executes subagents in parallel (if possible)
        4. Collects results and stores them in filesystem
        
        Args:
            actions: List of generate_content actions
            plan: Optional task plan from planner
        
        Returns:
            Results dictionary with section_id -> content
        """
        # Filter content generation actions
        content_actions = [
            a for a in actions 
            if a.get("type") == "generate_content"
        ]
        
        if not content_actions:
            print("📝 [WriterAgent] No content generation actions found")
            return {}
        
        print(f"📝 [WriterAgent] Spawning {len(content_actions)} subagent(s) for content generation")
        
        # Spawn subagents and execute in parallel
        tasks = []
        for action in content_actions:
            section_id = action.get("payload", {}).get("sectionId", "default")
            section_name = action.get("payload", {}).get("sectionName", "Section")
            
            # Create task for this subagent
            task = self._spawn_section_writer_subagent(
                section_id=section_id,
                section_name=section_name,
                action=action,
                plan=plan
            )
            tasks.append((section_id, task))
        
        # Execute all subagents in parallel
        results = {}
        completed_tasks = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
        
        # Collect results
        for (section_id, _), result in zip(tasks, completed_tasks):
            if isinstance(result, Exception):
                print(f"❌ [WriterAgent] Subagent {section_id} failed: {result}")
                results[section_id] = f"Error: {str(result)}"
            else:
                results[section_id] = result
                print(f"✅ [WriterAgent] Subagent {section_id} completed ({len(result)} chars)")
        
        return results
    
    async def _spawn_section_writer_subagent(
        self,
        section_id: str,
        section_name: str,
        action: Dict[str, Any],
        plan: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Spawn a subagent to write content for a specific section.
        
        Each subagent:
        - Has isolated context (only relevant files)
        - Can work independently
        - Stores result in filesystem
        
        Args:
            section_id: Unique identifier for the section
            section_name: Human-readable section name
            action: Action dictionary with prompt and metadata
            plan: Optional task plan for context
        
        Returns:
            Generated content as string
        """
        print(f"👤 [Subagent] Spawning writer for: {section_name} (id: {section_id})")
        
        # Load context for this subagent (selective loading)
        context_files = [
            "plan/task_plan.json",  # Overall plan
            "document_structure.json",  # Document structure
        ]
        
        # Load section-specific context if available
        section_context_file = f"content/{section_id}_context.json"
        if self.backend.file_exists(section_context_file):
            context_files.append(section_context_file)
        
        # Load context from filesystem
        context_data = {}
        for context_file in context_files:
            data = self.backend.read_file(context_file)
            if data:
                context_data[context_file] = data
        
        # ============================================================
        # PHASE 5: LOAD MEMORY (STYLE GUIDE & PREFERENCES)
        # ============================================================
        # Load style guide and preferences for personalization
        try:
            from orchestrator.agents.memory_manager import MemoryManager
            memory = MemoryManager(self.backend)
            
            style_guide = memory.load_style_guide()
            preferences = memory.load_preferences()
            
            if style_guide:
                context_data["style_guide"] = style_guide
            
            if preferences:
                context_data["preferences"] = preferences
            
            if style_guide or preferences:
                print(f"💾 [Subagent] Loaded memory: style_guide={bool(style_guide)}, preferences={len(preferences)}")
        
        except Exception as e:
            print(f"⚠️ [Subagent] Failed to load memory (non-fatal): {e}")
        
        # Get prompt and metadata from action
        payload = action.get("payload", {})
        prompt = payload.get("prompt", "")
        existing_content = payload.get("existing_content")
        
        # Import writer functions (from existing writer agent)
        from orchestrator.graph.agents.writer import generate_content
        
        # Build context string for LLM
        context_parts = []
        if plan:
            context_parts.append(f"Task Plan: {plan.get('task', '')}")
        
        if "document_structure.json" in context_data:
            doc_structure = context_data["document_structure.json"]
            context_parts.append(f"Document Structure: {len(doc_structure.get('items', []))} sections")
        
        # Add style guide and preferences to context (Phase 5)
        if "style_guide" in context_data:
            import json
            style_guide = context_data["style_guide"]
            context_parts.append(f"Writing Style Guide: {json.dumps(style_guide, indent=2)}")
        
        if "preferences" in context_data:
            import json
            preferences = context_data["preferences"]
            context_parts.append(f"User Preferences: {json.dumps(preferences, indent=2)}")
        
        context_str = "\n".join(context_parts) if context_parts else None
        
        # Generate content using existing writer function
        # This maintains compatibility with existing writer agent
        content = await generate_content(
            prompt=prompt,
            section_name=section_name,
            context=context_str,
            existing_content=existing_content
        )
        
        # Store result in filesystem
        self.backend.write_file(f"content/{section_id}.json", {
            "section_id": section_id,
            "section_name": section_name,
            "content": content,
            "status": "completed",
            "word_count": len(content.split())
        })
        
        print(f"✅ [Subagent] {section_name} completed: {len(content)} chars")
        
        # ============================================================
        # LIBRARIAN INTEGRATION: Analyze content and update cards
        # ============================================================
        # After content is generated, the Librarian analyzes it to:
        # - Extract characters, places, events
        # - Generate section summary
        # - Detect coherency issues
        # This happens asynchronously and doesn't block content delivery
        await self._analyze_with_librarian(section_id, section_name, content)
        
        return content
    
    async def _get_librarian(self):
        """
        Get or create the Librarian Agent instance.
        
        Returns None if node_id or supabase client is not available.
        """
        if self._librarian is not None:
            return self._librarian
        
        if not self.node_id or not self.supabase:
            return None
        
        try:
            from .librarian_agent import LibrarianAgent
            self._librarian = LibrarianAgent(self.node_id, self.supabase)
            return self._librarian
        except Exception as e:
            print(f"⚠️ [WriterAgent] Failed to initialize Librarian: {e}")
            return None
    
    async def _analyze_with_librarian(
        self,
        section_id: str,
        section_name: str,
        content: str
    ):
        """
        Analyze generated content with the Librarian Agent.
        
        This extracts entities (characters, places, events), generates
        a section summary, and detects coherency issues.
        
        Args:
            section_id: The section identifier
            section_name: Human-readable section name
            content: The generated content text
        """
        librarian = await self._get_librarian()
        if not librarian:
            print("📚 [WriterAgent] Librarian not available - skipping analysis")
            return
        
        try:
            print(f"📚 [WriterAgent] Analyzing content with Librarian: {section_name}")
            
            # Analyze content and update section card
            card = await librarian.analyze_and_update(
                section_id=section_id,
                content=content,
                section_name=section_name
            )
            
            if card:
                print(f"📚 [WriterAgent] Section card updated: {card.section_name}")
                print(f"   Characters: {len(card.characters_present)}")
                print(f"   Places: {len(card.places_visited)}")
                print(f"   Events: {len(card.events_occurring)}")
                
                # Check for coherency issues
                issues = await librarian.get_coherency_issues(section_id)
                if issues:
                    print(f"⚠️ [WriterAgent] {len(issues)} coherency issue(s) detected")
                    for issue in issues:
                        print(f"   - {issue.severity}: {issue.description}")
        except Exception as e:
            print(f"⚠️ [WriterAgent] Librarian analysis failed (non-fatal): {e}")
            import traceback
            traceback.print_exc()
    
    async def generate_structure(
        self,
        action: Dict[str, Any],
        plan: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate structure using main agent (no subagents needed).
        
        Structure generation is typically a single task, so we don't
        spawn subagents for it. However, we can use the plan for context.
        
        Args:
            action: generate_structure action
            plan: Optional task plan
        
        Returns:
            Structure dictionary
        """
        print(f"📋 [WriterAgent] Generating structure (main agent)")
        
        # Import writer functions
        from orchestrator.graph.agents.writer import generate_structure
        
        payload = action.get("payload", {})
        prompt = payload.get("prompt", "")
        # CRITICAL: Use plan's format if available, not hardcoded "novel"
        # This ensures podcast requests generate podcast structures
        plan_format = plan.get("document_format") if plan else None
        format_type = payload.get("format") or plan_format or "novel"
        template_id = payload.get("template")
        
        # Load context from filesystem
        canvas_data = load_context_from_filesystem(self.backend, "canvas")
        context_str = None
        if canvas_data:
            import json
            context_str = json.dumps(canvas_data) if isinstance(canvas_data, dict) else str(canvas_data)
        
        # Generate structure
        structure = await generate_structure(
            prompt=prompt,
            format_type=format_type,
            template_id=template_id,
            context=context_str
        )
        
        # Store structure in filesystem
        self.backend.write_file("content/structure.json", structure)
        
        # ============================================================
        # LIBRARIAN INTEGRATION: Create initial section cards
        # ============================================================
        # When a structure is created, the Librarian creates empty
        # section cards for each section. These will be populated
        # when content is written.
        await self._create_initial_cards(structure)
        
        return structure
    
    async def _create_initial_cards(self, structure: Dict[str, Any]):
        """
        Create initial section cards for a new structure.
        
        Cards are created empty (analyzed=False) and will be populated
        when content is written for each section.
        
        Args:
            structure: The generated structure dictionary
        """
        librarian = await self._get_librarian()
        if not librarian:
            print("📚 [WriterAgent] Librarian not available - skipping card creation")
            return
        
        try:
            # Extract items from structure
            items = structure.get("items", []) or structure.get("sections", [])
            
            if not items:
                print("📚 [WriterAgent] No items in structure - skipping card creation")
                return
            
            print(f"📚 [WriterAgent] Creating initial cards for {len(items)} sections")
            
            # Create cards for each section
            cards = await librarian.create_initial_cards(items)
            
            print(f"📚 [WriterAgent] Created {len(cards)} section cards")
        except Exception as e:
            print(f"⚠️ [WriterAgent] Failed to create initial cards (non-fatal): {e}")

