"""
Librarian Service

Story coherency and context management.
Refactored from LibrarianAgent to be a pure service class
that tools can call directly (no agent behavior).

The Librarian maintains:
1. Section Cards (per-chapter intelligence)
2. Character, Place, and Event registries
3. Context for writers before content generation
4. Coherency issue detection
"""

import json
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from datetime import datetime


# ============================================================================
# DATA CLASSES (Same as original, for DB compatibility)
# ============================================================================

@dataclass
class SectionCard:
    """Per-section intelligence card."""
    id: Optional[str] = None
    document_section_id: Optional[str] = None
    node_id: str = ""
    structure_item_id: str = ""
    section_name: str = ""
    summary: Optional[str] = None
    key_moments: List[str] = field(default_factory=list)
    characters_present: List[str] = field(default_factory=list)
    places_visited: List[str] = field(default_factory=list)
    events_occurring: List[str] = field(default_factory=list)
    dependencies: List[Dict] = field(default_factory=list)
    hooks: List[Dict] = field(default_factory=list)
    constraints: List[Dict] = field(default_factory=list)
    must_include: List[str] = field(default_factory=list)
    must_not_include: List[str] = field(default_factory=list)
    word_count: int = 0
    pov_character_id: Optional[str] = None
    timeframe: Optional[str] = None
    mood: Optional[str] = None
    analyzed: bool = False
    analyzed_at: Optional[str] = None


@dataclass
class Character:
    """Character in the story."""
    id: Optional[str] = None
    node_id: str = ""
    name: str = ""
    aliases: List[str] = field(default_factory=list)
    description: Optional[str] = None
    role: str = "supporting"
    traits: List[str] = field(default_factory=list)
    arc: Optional[str] = None
    motivations: List[str] = field(default_factory=list)
    relationships: List[Dict] = field(default_factory=list)
    first_appearance_section_id: Optional[str] = None
    appearances: List[str] = field(default_factory=list)
    voice_notes: Optional[str] = None
    secrets: List[str] = field(default_factory=list)
    status: str = "active"
    status_changed_in: Optional[str] = None


@dataclass
class Place:
    """Location in the story world."""
    id: Optional[str] = None
    node_id: str = ""
    name: str = ""
    type: str = "other"
    description: Optional[str] = None
    atmosphere: Optional[str] = None
    parent_place_id: Optional[str] = None
    first_appearance_section_id: Optional[str] = None
    appearances: List[str] = field(default_factory=list)
    significance: Optional[str] = None


@dataclass
class Event:
    """Plot event in the story timeline."""
    id: Optional[str] = None
    node_id: str = ""
    name: str = ""
    description: str = ""
    type: str = "other"
    section_id: str = ""
    characters_involved: List[str] = field(default_factory=list)
    place_id: Optional[str] = None
    timeline_position: Optional[int] = None
    story_time: Optional[str] = None
    consequences: Optional[str] = None
    depends_on: List[str] = field(default_factory=list)
    enables: List[str] = field(default_factory=list)


@dataclass
class CoherencyIssue:
    """Flagged coherency issue."""
    id: Optional[str] = None
    section_card_id: str = ""
    type: str = ""
    severity: str = "warning"
    description: str = ""
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None
    problematic_text: Optional[str] = None
    expected_value: Optional[str] = None
    source_section_id: Optional[str] = None
    status: str = "open"
    resolved_at: Optional[str] = None
    resolution_note: Optional[str] = None


# ============================================================================
# LIBRARIAN SERVICE
# ============================================================================

class Librarian:
    """
    Service for story coherency and context management.
    
    Usage:
        from librarian import Librarian
        from config import get_supabase_client
        
        librarian = Librarian(get_supabase_client(), node_id="story-123")
        
        # Get context before writing
        context = await librarian.get_writer_context(section_id)
        
        # After writing, update the registry
        await librarian.analyze_and_update(section_id, content)
    """
    
    def __init__(self, supabase_client: Any, node_id: str = ""):
        """
        Initialize the Librarian service.
        
        Args:
            supabase_client: Supabase client for database operations
            node_id: Story structure node ID
        """
        self.db = supabase_client
        self.node_id = node_id
        self._llm = None
    
    # ========================================================================
    # PUBLIC API - Context Retrieval
    # ========================================================================
    
    async def get_writer_context(self, section_id: str) -> Dict[str, Any]:
        """
        Get complete context for writing a section.
        
        This provides everything a writer needs to maintain coherency:
        - Section card (what this chapter is about)
        - Relevant characters
        - Active constraints
        - Previous section summary
        - Foreshadowing to plant
        
        Args:
            section_id: The structure item ID
        
        Returns:
            Dictionary with all context needed for writing
        """
        card = await self.get_section_card(section_id)
        
        return {
            "section_card": asdict(card) if card else None,
            "characters": await self.get_characters(relevant_to_section=section_id),
            "places": await self.get_places(relevant_to_section=section_id),
            "events": await self.get_events(up_to_section=section_id),
            "nearby_sections": await self.get_nearby_summaries(section_id, window=2),
            "coherency_issues": await self.get_coherency_issues(section_id),
            "constraints": card.constraints if card else [],
            "previous_summary": await self._get_previous_summary(section_id),
        }
    
    async def get_characters(
        self,
        relevant_to_section: Optional[str] = None
    ) -> List[Dict]:
        """
        Get character registry, optionally filtered by section relevance.
        
        Args:
            relevant_to_section: If provided, prioritize characters appearing near this section
        
        Returns:
            List of character dictionaries
        """
        try:
            result = self.db.table("story_characters") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .execute()
            
            characters = [self._row_to_dict(row) for row in result.data]
            
            # If section provided, sort by relevance
            if relevant_to_section and characters:
                characters.sort(
                    key=lambda c: relevant_to_section in (c.get("appearances") or []),
                    reverse=True
                )
            
            return characters
        except Exception as e:
            print(f"❌ [Librarian] Failed to get characters: {e}")
            return []
    
    async def get_places(
        self,
        relevant_to_section: Optional[str] = None
    ) -> List[Dict]:
        """
        Get location registry.
        
        Args:
            relevant_to_section: If provided, prioritize places near this section
        
        Returns:
            List of place dictionaries
        """
        try:
            result = self.db.table("story_places") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .execute()
            
            places = [self._row_to_dict(row) for row in result.data]
            
            if relevant_to_section and places:
                places.sort(
                    key=lambda p: relevant_to_section in (p.get("appearances") or []),
                    reverse=True
                )
            
            return places
        except Exception as e:
            print(f"❌ [Librarian] Failed to get places: {e}")
            return []
    
    async def get_events(
        self,
        up_to_section: Optional[str] = None
    ) -> List[Dict]:
        """
        Get plot events timeline.
        
        Args:
            up_to_section: If provided, get events up to this section
        
        Returns:
            List of event dictionaries
        """
        try:
            result = self.db.table("story_events") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .order("timeline_position") \
                .execute()
            
            events = [self._row_to_dict(row) for row in result.data]
            return events[-10:] if len(events) > 10 else events  # Last 10 events
        except Exception as e:
            print(f"❌ [Librarian] Failed to get events: {e}")
            return []
    
    async def get_coherency_issues(
        self,
        section_id: Optional[str] = None,
        status: str = "open"
    ) -> List[Dict]:
        """
        Get coherency issues, optionally filtered by section.
        
        Args:
            section_id: Optional section to filter by
            status: Issue status filter (default: "open")
        
        Returns:
            List of coherency issue dictionaries
        """
        try:
            query = self.db.table("coherency_issues") \
                .select("*, section_cards!inner(node_id, structure_item_id)")
            
            if section_id:
                query = query.eq("section_cards.structure_item_id", section_id)
            
            query = query.eq("section_cards.node_id", self.node_id)
            query = query.eq("status", status)
            
            result = query.execute()
            return [self._row_to_dict(row) for row in result.data]
        except Exception as e:
            print(f"❌ [Librarian] Failed to get coherency issues: {e}")
            return []
    
    async def get_nearby_summaries(
        self,
        section_id: str,
        window: int = 2
    ) -> List[Dict]:
        """
        Get summaries of adjacent sections for context.
        
        Args:
            section_id: Center section
            window: Number of sections before/after to include
        
        Returns:
            List of section summaries
        """
        try:
            result = self.db.table("section_cards") \
                .select("structure_item_id, section_name, summary") \
                .eq("node_id", self.node_id) \
                .not_.is_("summary", "null") \
                .execute()
            
            return [
                {
                    "section_id": row.get("structure_item_id"),
                    "section_name": row.get("section_name"),
                    "summary": row.get("summary")
                }
                for row in result.data
            ]
        except Exception as e:
            print(f"❌ [Librarian] Failed to get nearby summaries: {e}")
            return []
    
    async def get_section_card(self, section_id: str) -> Optional[SectionCard]:
        """
        Get a section card.
        
        Args:
            section_id: The structure item ID
        
        Returns:
            SectionCard or None if not found
        """
        try:
            result = self.db.table("section_cards") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .eq("structure_item_id", section_id) \
                .limit(1) \
                .execute()
            
            if result.data:
                return self._row_to_card(result.data[0])
            return None
        except Exception as e:
            print(f"❌ [Librarian] Failed to get section card: {e}")
            return None
    
    # ========================================================================
    # PUBLIC API - Content Analysis
    # ========================================================================
    
    async def analyze_and_update(
        self,
        section_id: str,
        content: str,
        section_name: Optional[str] = None
    ) -> SectionCard:
        """
        Analyze written content and update the section card.
        
        This is called AFTER content is written to extract entities
        and update the registry.
        
        Args:
            section_id: The structure item ID
            content: The generated content text
            section_name: Optional section name
        
        Returns:
            Updated SectionCard
        """
        print(f"📚 [Librarian] Analyzing section: {section_id}")
        
        # Get or create card
        card = await self._get_or_create_card(section_id, section_name or section_id)
        
        # Extract entities using LLM
        from .entity_extractor import EntityExtractor
        extractor = EntityExtractor(await self._get_llm())
        extracted = await extractor.extract(content)
        
        # Update entities in database
        character_ids = await self._process_characters(extracted.get("characters", []), section_id)
        place_ids = await self._process_places(extracted.get("places", []), section_id)
        event_ids = await self._process_events(extracted.get("events", []), section_id)
        
        # Generate summary
        summary = await self._generate_summary(content, extracted)
        
        # Update card
        card.summary = summary
        card.key_moments = extracted.get("key_moments", [])
        card.characters_present = character_ids
        card.places_visited = place_ids
        card.events_occurring = event_ids
        card.word_count = len(content.split())
        card.mood = extracted.get("mood")
        card.timeframe = extracted.get("timeframe")
        card.analyzed = True
        card.analyzed_at = datetime.utcnow().isoformat()
        
        # Detect coherency issues
        from .coherency_checker import CoherencyChecker
        checker = CoherencyChecker(self.db, self.node_id)
        issues = await checker.check(section_id, content, extracted)
        for issue in issues:
            await self._save_coherency_issue(card.id, issue)
        
        # Save card
        await self._save_section_card(card)
        
        print(f"📚 [Librarian] Updated card: {len(character_ids)} chars, {len(place_ids)} places")
        
        # Check for ripple effects to other sections
        await self._check_ripple_effects(section_id, extracted)
        
        return card
    
    async def create_initial_cards_with_planning(
        self,
        items: List[Dict],
        planning_context: Dict[str, Any]
    ) -> List[SectionCard]:
        """
        Create section cards with planning context from structure creation.
        
        Unlike basic card creation, this populates cards with:
        - Expected content based on section description
        - Inferred dependencies between sections
        - Mood/tone from the overall format
        - Potential characters/places from the prompt
        
        Args:
            items: Structure items from create_structure
            planning_context: Dict with prompt, format, template, title
        
        Returns:
            List of created SectionCard objects
        """
        prompt = planning_context.get("prompt", "")
        format_type = planning_context.get("format", "novel")
        title = planning_context.get("title", "Untitled")
        
        print(f"📚 [Librarian] Creating {len(items)} cards with planning context for '{title}'")
        
        cards = []
        previous_item = None
        
        for idx, item in enumerate(items):
            section_id = item.get("id", f"sec-{idx+1}")
            section_name = item.get("name") or item.get("title", f"Section {idx+1}")
            section_desc = item.get("description", "")
            
            # Build dependencies (each section depends on previous)
            dependencies = []
            if previous_item:
                dependencies.append({
                    "type": "follows",
                    "section_id": previous_item.get("id"),
                    "section_name": previous_item.get("name") or previous_item.get("title"),
                    "description": f"Follows from {previous_item.get('name', 'previous section')}"
                })
            
            # Infer mood from format
            default_mood = self._infer_mood_from_format(format_type)
            
            card = SectionCard(
                node_id=self.node_id,
                structure_item_id=section_id,
                section_name=section_name,
                summary=section_desc if section_desc else None,  # Use description as initial summary
                dependencies=dependencies,
                mood=default_mood,
                analyzed=False  # Not yet analyzed - content hasn't been written
            )
            
            saved_card = await self._save_section_card(card)
            cards.append(saved_card)
            previous_item = item
        
        print(f"📚 [Librarian] Created {len(cards)} section cards with dependencies")
        return cards
    
    async def _check_ripple_effects(
        self,
        updated_section_id: str,
        extracted: Dict[str, Any]
    ) -> None:
        """
        Check if updates to one section affect others.
        
        When new content is written, check if:
        - New characters appear that should be referenced elsewhere
        - Events contradict or depend on other sections
        - Timeline issues exist
        
        This propagates updates to affected section cards.
        """
        # Get all section cards for this story
        try:
            result = self.db.table("section_cards") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .execute()
            
            all_cards = result.data if result.data else []
            
            if len(all_cards) <= 1:
                return  # No ripple needed for single section
            
            # Get newly introduced characters and events
            new_characters = extracted.get("characters", [])
            new_events = extracted.get("events", [])
            
            if not new_characters and not new_events:
                return
            
            print(f"🔄 [Librarian] Checking ripple effects from {updated_section_id}...")
            
            # Check subsequent sections for potential impacts
            found_updated = False
            for card_row in all_cards:
                if card_row.get("structure_item_id") == updated_section_id:
                    found_updated = True
                    continue
                
                if not found_updated:
                    continue  # Only affect sections after the updated one
                
                # Update dependencies for subsequent sections
                card_id = card_row.get("id")
                existing_deps = self._parse_json(card_row.get("dependencies"), [])
                
                # Add new character dependencies
                for char in new_characters:
                    char_name = char.get("name", "")
                    if char_name and char.get("role") in ["protagonist", "antagonist"]:
                        dep = {
                            "type": "character_established",
                            "section_id": updated_section_id,
                            "description": f"Character '{char_name}' was introduced",
                            "entity_name": char_name
                        }
                        if dep not in existing_deps:
                            existing_deps.append(dep)
                
                # Save updated dependencies
                if existing_deps:
                    self.db.table("section_cards") \
                        .update({"dependencies": json.dumps(existing_deps)}) \
                        .eq("id", card_id) \
                        .execute()
            
            print(f"🔄 [Librarian] Ripple effects checked for {len(all_cards)} cards")
            
        except Exception as e:
            print(f"⚠️ [Librarian] Ripple check failed (non-fatal): {e}")
    
    def _infer_mood_from_format(self, format_type: str) -> Optional[str]:
        """Infer default mood from document format."""
        mood_map = {
            "novel": "narrative",
            "short-story": "focused",
            "screenplay": "visual",
            "podcast": "conversational",
            "report": "professional",
            "article": "informative",
            "essay": "analytical"
        }
        return mood_map.get(format_type)
    
    # ========================================================================
    # PRIVATE HELPERS
    # ========================================================================
    
    async def _get_llm(self):
        """Get or create LLM instance for analysis."""
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            self._llm = ChatOpenAI(
                model="gpt-4o-mini",
                temperature=0.3,
                api_key=os.getenv("OPENAI_API_KEY")
            )
        return self._llm
    
    async def _get_or_create_card(self, section_id: str, section_name: str) -> SectionCard:
        """Get existing card or create new one."""
        existing = await self.get_section_card(section_id)
        if existing:
            return existing
        
        card = SectionCard(
            node_id=self.node_id,
            structure_item_id=section_id,
            section_name=section_name,
            analyzed=False
        )
        return await self._save_section_card(card)
    
    async def _save_section_card(self, card: SectionCard) -> SectionCard:
        """Save section card to database."""
        try:
            data = {
                "node_id": card.node_id,
                "structure_item_id": card.structure_item_id,
                "section_name": card.section_name,
                "summary": card.summary,
                "key_moments": json.dumps(card.key_moments),
                "characters_present": json.dumps(card.characters_present),
                "places_visited": json.dumps(card.places_visited),
                "events_occurring": json.dumps(card.events_occurring),
                "dependencies": json.dumps(card.dependencies),
                "hooks": json.dumps(card.hooks),
                "constraints": json.dumps(card.constraints),
                "must_include": json.dumps(card.must_include),
                "must_not_include": json.dumps(card.must_not_include),
                "word_count": card.word_count,
                "pov_character_id": card.pov_character_id,
                "timeframe": card.timeframe,
                "mood": card.mood,
                "analyzed": card.analyzed,
                "analyzed_at": card.analyzed_at
            }
            
            if card.id:
                result = self.db.table("section_cards").update(data).eq("id", card.id).execute()
            else:
                result = self.db.table("section_cards").upsert(
                    data, on_conflict="node_id,structure_item_id"
                ).execute()
            
            if result.data:
                return self._row_to_card(result.data[0])
            return card
        except Exception as e:
            print(f"❌ [Librarian] Failed to save section card: {e}")
            return card
    
    async def _generate_summary(self, content: str, extracted: Dict) -> str:
        """Generate a 2-3 sentence summary."""
        llm = await self._get_llm()
        content_preview = content[:2000] + ("..." if len(content) > 2000 else "")
        characters = ", ".join([c["name"] for c in extracted.get("characters", [])[:3]])
        
        prompt = f"""Write a 2-3 sentence summary of this story section.
Focus on what happens (plot), not descriptions.
Mention key characters: {characters}

CONTENT:
{content_preview}

SUMMARY (2-3 sentences only):"""

        try:
            response = await llm.ainvoke(prompt)
            return response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            print(f"❌ [Librarian] Summary generation failed: {e}")
            return f"Section contains {len(content.split())} words."
    
    async def _get_previous_summary(self, section_id: str) -> Optional[str]:
        """Get summary of the previous section."""
        import re
        match = re.search(r'(\d+)', section_id)
        if not match:
            return None
        
        current_num = int(match.group(1))
        if current_num <= 1:
            return None
        
        prev_id_pattern = section_id.replace(str(current_num), str(current_num - 1))
        prev_card = await self.get_section_card(prev_id_pattern)
        
        if prev_card and prev_card.summary:
            return f"Previous section: {prev_card.summary}"
        return None
    
    async def _process_characters(self, characters: List[Dict], section_id: str) -> List[str]:
        """Process extracted characters: create new or update existing."""
        character_ids = []
        for char_data in characters:
            name = char_data.get("name", "").strip()
            if not name:
                continue
            
            # Find existing by name
            try:
                result = self.db.table("story_characters") \
                    .select("*") \
                    .eq("node_id", self.node_id) \
                    .ilike("name", name) \
                    .limit(1) \
                    .execute()
                
                if result.data:
                    existing = result.data[0]
                    appearances = json.loads(existing.get("appearances", "[]"))
                    if section_id not in appearances:
                        appearances.append(section_id)
                        self.db.table("story_characters") \
                            .update({"appearances": json.dumps(appearances)}) \
                            .eq("id", existing["id"]) \
                            .execute()
                    character_ids.append(existing["id"])
                else:
                    # Create new
                    new_data = {
                        "node_id": self.node_id,
                        "name": name,
                        "description": char_data.get("description"),
                        "role": char_data.get("role", "supporting"),
                        "traits": json.dumps(char_data.get("traits", [])),
                        "first_appearance_section_id": section_id,
                        "appearances": json.dumps([section_id])
                    }
                    result = self.db.table("story_characters").insert(new_data).execute()
                    if result.data:
                        character_ids.append(result.data[0]["id"])
            except Exception as e:
                print(f"❌ [Librarian] Character processing failed: {e}")
        
        return character_ids
    
    async def _process_places(self, places: List[Dict], section_id: str) -> List[str]:
        """Process extracted places."""
        place_ids = []
        for place_data in places:
            name = place_data.get("name", "").strip()
            if not name:
                continue
            
            try:
                result = self.db.table("story_places") \
                    .select("*") \
                    .eq("node_id", self.node_id) \
                    .ilike("name", name) \
                    .limit(1) \
                    .execute()
                
                if result.data:
                    existing = result.data[0]
                    appearances = json.loads(existing.get("appearances", "[]"))
                    if section_id not in appearances:
                        appearances.append(section_id)
                        self.db.table("story_places") \
                            .update({"appearances": json.dumps(appearances)}) \
                            .eq("id", existing["id"]) \
                            .execute()
                    place_ids.append(existing["id"])
                else:
                    new_data = {
                        "node_id": self.node_id,
                        "name": name,
                        "type": place_data.get("type", "other"),
                        "description": place_data.get("description"),
                        "atmosphere": place_data.get("atmosphere"),
                        "first_appearance_section_id": section_id,
                        "appearances": json.dumps([section_id])
                    }
                    result = self.db.table("story_places").insert(new_data).execute()
                    if result.data:
                        place_ids.append(result.data[0]["id"])
            except Exception as e:
                print(f"❌ [Librarian] Place processing failed: {e}")
        
        return place_ids
    
    async def _process_events(self, events: List[Dict], section_id: str) -> List[str]:
        """Process extracted events."""
        event_ids = []
        for event_data in events:
            name = event_data.get("name", "").strip()
            description = event_data.get("description", "").strip()
            if not name or not description:
                continue
            
            try:
                new_data = {
                    "node_id": self.node_id,
                    "name": name,
                    "description": description,
                    "type": event_data.get("type", "other"),
                    "section_id": section_id
                }
                result = self.db.table("story_events").insert(new_data).execute()
                if result.data:
                    event_ids.append(result.data[0]["id"])
            except Exception as e:
                print(f"❌ [Librarian] Event processing failed: {e}")
        
        return event_ids
    
    async def _save_coherency_issue(self, card_id: str, issue: Dict):
        """Save coherency issue to database."""
        try:
            data = {
                "section_card_id": card_id,
                "type": issue.get("type", "other"),
                "severity": issue.get("severity", "warning"),
                "description": issue.get("description", ""),
                "expected_value": issue.get("expected_value"),
                "source_section_id": issue.get("source_section_id"),
                "status": "open"
            }
            self.db.table("coherency_issues").insert(data).execute()
            print(f"⚠️ [Librarian] Flagged issue: {issue.get('type')}")
        except Exception as e:
            print(f"❌ [Librarian] Failed to save coherency issue: {e}")
    
    def _row_to_card(self, row: Dict) -> SectionCard:
        """Convert database row to SectionCard."""
        return SectionCard(
            id=row.get("id"),
            document_section_id=row.get("document_section_id"),
            node_id=row.get("node_id", ""),
            structure_item_id=row.get("structure_item_id", ""),
            section_name=row.get("section_name", ""),
            summary=row.get("summary"),
            key_moments=self._parse_json(row.get("key_moments"), []),
            characters_present=self._parse_json(row.get("characters_present"), []),
            places_visited=self._parse_json(row.get("places_visited"), []),
            events_occurring=self._parse_json(row.get("events_occurring"), []),
            dependencies=self._parse_json(row.get("dependencies"), []),
            hooks=self._parse_json(row.get("hooks"), []),
            constraints=self._parse_json(row.get("constraints"), []),
            must_include=self._parse_json(row.get("must_include"), []),
            must_not_include=self._parse_json(row.get("must_not_include"), []),
            word_count=row.get("word_count", 0),
            pov_character_id=row.get("pov_character_id"),
            timeframe=row.get("timeframe"),
            mood=row.get("mood"),
            analyzed=row.get("analyzed", False),
            analyzed_at=row.get("analyzed_at")
        )
    
    def _row_to_dict(self, row: Dict) -> Dict:
        """Convert database row, parsing JSON fields."""
        result = dict(row)
        for key in ["aliases", "traits", "motivations", "relationships", 
                    "appearances", "secrets", "characters_involved",
                    "depends_on", "enables"]:
            if key in result and isinstance(result[key], str):
                result[key] = self._parse_json(result[key], [])
        return result
    
    def _parse_json(self, value: Any, default: Any) -> Any:
        """Parse JSON value from database."""
        if value is None:
            return default
        if isinstance(value, (list, dict)):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except:
                return default
        return default


def get_librarian(node_id: str, supabase_client: Any = None) -> Librarian:
    """
    Factory function to get a Librarian instance.
    
    Args:
        node_id: The story structure node ID
        supabase_client: Optional Supabase client (creates one if not provided)
    
    Returns:
        Librarian instance
    """
    if supabase_client is None:
        from ..config import get_supabase_client
        supabase_client = get_supabase_client()
    
    return Librarian(supabase_client, node_id)

