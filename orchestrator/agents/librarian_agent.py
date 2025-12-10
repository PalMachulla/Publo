"""
Librarian Agent

The Librarian maintains story coherency by:
1. Managing Section Cards (per-chapter intelligence)
2. Tracking Characters, Places, and Events
3. Providing context to writers before they write
4. Extracting and updating metadata from new content
5. Detecting coherency issues

USAGE:
    librarian = LibrarianAgent(node_id, supabase_client)
    
    # After content is written, analyze and update cards
    await librarian.analyze_and_update(section_id, content)
    
    # Before writing, get context for writer
    context = await librarian.get_writer_context(section_id)
    
    # Get section card for display
    card = await librarian.get_section_card(section_id)

DATA FLOW:
    1. Structure Generation → Creates initial section cards (empty)
    2. Content Generation → Librarian.analyze_and_update()
       - Extracts characters, places, events
       - Updates section card summary
       - Detects coherency issues
    3. Writer Context → Librarian.get_writer_context()
       - Returns relevant info for consistent writing
"""

import json
import os
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime

# ============================================================================
# DATA CLASSES
# ============================================================================
# These match the Supabase table schemas

@dataclass
class SectionCard:
    """
    Per-section intelligence card.
    
    Contains summary, entity references, dependencies, and writer guidance.
    This is the primary data structure the Librarian uses.
    """
    id: Optional[str] = None
    document_section_id: Optional[str] = None
    node_id: str = ""
    structure_item_id: str = ""
    section_name: str = ""
    
    # Content summary
    summary: Optional[str] = None
    key_moments: List[str] = field(default_factory=list)
    
    # Entity tracking (IDs referencing other tables)
    characters_present: List[str] = field(default_factory=list)
    places_visited: List[str] = field(default_factory=list)
    events_occurring: List[str] = field(default_factory=list)
    
    # Cross-chapter connections
    dependencies: List[Dict] = field(default_factory=list)
    hooks: List[Dict] = field(default_factory=list)
    
    # Writer guidance
    constraints: List[Dict] = field(default_factory=list)
    must_include: List[str] = field(default_factory=list)
    must_not_include: List[str] = field(default_factory=list)
    
    # Metadata
    word_count: int = 0
    pov_character_id: Optional[str] = None
    timeframe: Optional[str] = None
    mood: Optional[str] = None
    analyzed: bool = False
    analyzed_at: Optional[str] = None


@dataclass
class Character:
    """
    Character with medium depth.
    
    Includes basic info, personality, relationships, and appearance tracking.
    """
    id: Optional[str] = None
    node_id: str = ""
    name: str = ""
    aliases: List[str] = field(default_factory=list)
    description: Optional[str] = None
    role: str = "supporting"  # protagonist, antagonist, supporting, minor
    traits: List[str] = field(default_factory=list)
    arc: Optional[str] = None
    motivations: List[str] = field(default_factory=list)
    relationships: List[Dict] = field(default_factory=list)
    first_appearance_section_id: Optional[str] = None
    appearances: List[str] = field(default_factory=list)
    voice_notes: Optional[str] = None
    secrets: List[str] = field(default_factory=list)
    status: str = "active"  # active, deceased, unknown, transformed
    status_changed_in: Optional[str] = None


@dataclass
class Place:
    """Location in the story world."""
    id: Optional[str] = None
    node_id: str = ""
    name: str = ""
    type: str = "other"  # interior, exterior, city, country, realm, vehicle, other
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
    type: str = "other"  # plot_point, revelation, conflict, resolution, death, etc.
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
    """Flagged coherency issue on a section card."""
    id: Optional[str] = None
    section_card_id: str = ""
    type: str = ""  # character_inconsistency, timeline_contradiction, etc.
    severity: str = "warning"  # info, warning, error
    description: str = ""
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None
    problematic_text: Optional[str] = None
    expected_value: Optional[str] = None
    source_section_id: Optional[str] = None
    status: str = "open"  # open, resolved, ignored
    resolved_at: Optional[str] = None
    resolution_note: Optional[str] = None


@dataclass
class WriterContext:
    """
    Context provided to writer before generating content.
    
    Includes everything the writer needs to maintain coherency.
    """
    section_card: Optional[SectionCard] = None
    characters: List[Character] = field(default_factory=list)
    places: List[Place] = field(default_factory=list)
    active_threads: List[str] = field(default_factory=list)  # Plot thread descriptions
    constraints: List[Dict] = field(default_factory=list)
    previous_summary: Optional[str] = None
    foreshadowing_to_plant: List[str] = field(default_factory=list)
    style_guide: Optional[str] = None


# ============================================================================
# LIBRARIAN AGENT
# ============================================================================

class LibrarianAgent:
    """
    The Librarian Agent maintains story coherency.
    
    Responsibilities:
    1. Create and manage Section Cards (per-chapter intelligence)
    2. Track Characters, Places, and Events across the story
    3. Provide context to writers before they generate content
    4. Extract entities from generated content and update cards
    5. Detect and flag coherency issues
    
    Usage:
        librarian = LibrarianAgent(node_id, supabase_client)
        
        # After content is written
        await librarian.analyze_and_update(section_id, content)
        
        # Before writing
        context = await librarian.get_writer_context(section_id)
    """
    
    def __init__(self, node_id: str, supabase_client: Any):
        """
        Initialize the Librarian for a specific story node.
        
        Args:
            node_id: The story structure node ID (e.g., "story-structure-123")
            supabase_client: Async Supabase client for database operations
        """
        self.node_id = node_id
        self.supabase = supabase_client
        
        # LLM for entity extraction (lazy loaded)
        self._llm = None
        
        # Cache for loaded entities
        self._characters_cache: Dict[str, Character] = {}
        self._places_cache: Dict[str, Place] = {}
        self._cards_cache: Dict[str, SectionCard] = {}
    
    # ========================================================================
    # PUBLIC API
    # ========================================================================
    
    async def analyze_and_update(
        self,
        section_id: str,
        content: str,
        section_name: Optional[str] = None
    ) -> SectionCard:
        """
        Analyze content and update the section card.
        
        This is called AFTER content is written to extract entities
        and update the section card with summary, characters, etc.
        
        Args:
            section_id: The structure item ID (e.g., "chapter-1")
            content: The generated content text
            section_name: Optional section name (for creating new cards)
            
        Returns:
            Updated SectionCard
        """
        print(f"📚 [Librarian] Analyzing section: {section_id}")
        
        # 1. Get or create section card
        card = await self._get_or_create_card(section_id, section_name or section_id)
        
        # 2. Extract entities from content using LLM
        extracted = await self._extract_entities(content)
        
        # 3. Update or create entities in database
        character_ids = await self._process_characters(extracted.get("characters", []), section_id)
        place_ids = await self._process_places(extracted.get("places", []), section_id)
        event_ids = await self._process_events(extracted.get("events", []), section_id)
        
        # 4. Generate summary
        summary = await self._generate_summary(content, extracted)
        
        # 5. Update section card
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
        
        # 6. Detect coherency issues
        issues = await self._detect_coherency_issues(section_id, content, extracted)
        for issue in issues:
            await self._save_coherency_issue(card.id, issue)
        
        # 7. Save updated card
        await self._save_section_card(card)
        
        print(f"📚 [Librarian] Updated card for {section_id}: {len(character_ids)} chars, {len(place_ids)} places, {len(event_ids)} events")
        
        return card
    
    async def get_writer_context(self, section_id: str) -> WriterContext:
        """
        Get context for the writer before generating content.
        
        This provides everything the writer needs to maintain coherency:
        - Section card (what this chapter is about)
        - Relevant characters
        - Active constraints
        - Previous chapter summary
        - Foreshadowing to plant
        
        Args:
            section_id: The structure item ID
            
        Returns:
            WriterContext with all relevant information
        """
        print(f"📚 [Librarian] Getting writer context for: {section_id}")
        
        # Get section card
        card = await self._get_section_card(section_id)
        
        # Get characters that should appear
        characters = await self._get_characters_for_section(section_id, card)
        
        # Get places that might be relevant
        places = await self._get_places_for_section(section_id, card)
        
        # Get previous section summary
        previous_summary = await self._get_previous_summary(section_id)
        
        # Get constraints from dependencies
        constraints = card.constraints if card else []
        
        # Get foreshadowing hooks that should be planted
        foreshadowing = await self._get_foreshadowing_for_section(section_id)
        
        return WriterContext(
            section_card=card,
            characters=characters,
            places=places,
            constraints=constraints,
            previous_summary=previous_summary,
            foreshadowing_to_plant=foreshadowing
        )
    
    async def get_section_card(self, section_id: str) -> Optional[SectionCard]:
        """
        Get a section card for display.
        
        Args:
            section_id: The structure item ID
            
        Returns:
            SectionCard or None if not found
        """
        return await self._get_section_card(section_id)
    
    async def get_all_section_cards(self) -> List[SectionCard]:
        """Get all section cards for this story node."""
        try:
            result = await self.supabase.table("section_cards") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .execute()
            
            return [self._row_to_card(row) for row in result.data]
        except Exception as e:
            print(f"❌ [Librarian] Failed to get all cards: {e}")
            return []
    
    async def get_coherency_issues(
        self, 
        section_id: Optional[str] = None,
        status: str = "open"
    ) -> List[CoherencyIssue]:
        """
        Get coherency issues, optionally filtered by section.
        
        Args:
            section_id: Optional section ID to filter by
            status: Issue status filter (default: "open")
            
        Returns:
            List of CoherencyIssue objects
        """
        try:
            query = self.supabase.table("coherency_issues") \
                .select("*, section_cards!inner(node_id, structure_item_id)")
            
            if section_id:
                # Filter by section through join
                query = query.eq("section_cards.structure_item_id", section_id)
            
            query = query.eq("section_cards.node_id", self.node_id)
            query = query.eq("status", status)
            
            result = await query.execute()
            
            return [self._row_to_issue(row) for row in result.data]
        except Exception as e:
            print(f"❌ [Librarian] Failed to get issues: {e}")
            return []
    
    async def create_initial_cards(self, structure_items: List[Dict]) -> List[SectionCard]:
        """
        Create initial section cards for a new structure.
        
        Called when a structure is first created.
        Cards are created empty (analyzed=False) and populated when content is written.
        
        Args:
            structure_items: List of structure items from CreateStructure
            
        Returns:
            List of created SectionCard objects
        """
        print(f"📚 [Librarian] Creating initial cards for {len(structure_items)} sections")
        
        cards = []
        for item in structure_items:
            card = SectionCard(
                node_id=self.node_id,
                structure_item_id=item.get("id", ""),
                section_name=item.get("name", "") or item.get("title", ""),
                analyzed=False
            )
            
            saved_card = await self._save_section_card(card)
            cards.append(saved_card)
        
        return cards
    
    # ========================================================================
    # ENTITY EXTRACTION (LLM-based)
    # ========================================================================
    
    async def _extract_entities(self, content: str) -> Dict[str, Any]:
        """
        Extract characters, places, events from content using LLM.
        
        Returns a dict with:
        - characters: [{ name, description, role, traits }]
        - places: [{ name, type, description }]
        - events: [{ name, description, type }]
        - key_moments: ["moment1", "moment2"]
        - mood: "tense/peaceful/etc"
        - timeframe: "Day 1, morning"
        """
        llm = await self._get_llm()
        
        # Truncate content if too long (keep first and last parts)
        max_chars = 8000
        if len(content) > max_chars:
            half = max_chars // 2
            content = content[:half] + "\n\n[...content truncated...]\n\n" + content[-half:]
        
        prompt = f"""Analyze this story content and extract entities.

CONTENT:
{content}

Return a JSON object with:
{{
  "characters": [
    {{
      "name": "Full name",
      "description": "Brief physical/role description",
      "role": "protagonist|antagonist|supporting|minor",
      "traits": ["trait1", "trait2"]
    }}
  ],
  "places": [
    {{
      "name": "Place name",
      "type": "interior|exterior|city|country|realm|vehicle|other",
      "description": "Brief description",
      "atmosphere": "Mood/feeling of this place"
    }}
  ],
  "events": [
    {{
      "name": "Brief event name",
      "description": "What happened",
      "type": "plot_point|revelation|conflict|resolution|death|transformation|meeting|other"
    }}
  ],
  "key_moments": ["Key moment 1", "Key moment 2", "Key moment 3"],
  "mood": "Overall mood/tone of this section",
  "timeframe": "When this happens in story time (e.g., 'Day 1, morning', 'Two weeks later')"
}}

Only include entities that are actually mentioned or described in the content.
Be concise but accurate.
Return ONLY valid JSON, no markdown formatting."""

        try:
            response = await llm.ainvoke(prompt)
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            # Clean up response (remove markdown code blocks if present)
            response_text = response_text.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            return json.loads(response_text.strip())
        except Exception as e:
            print(f"❌ [Librarian] Entity extraction failed: {e}")
            return {
                "characters": [],
                "places": [],
                "events": [],
                "key_moments": [],
                "mood": None,
                "timeframe": None
            }
    
    async def _generate_summary(self, content: str, extracted: Dict) -> str:
        """Generate a 2-3 sentence summary of the content."""
        llm = await self._get_llm()
        
        # Use first 2000 chars for summary
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
    
    # ========================================================================
    # ENTITY MANAGEMENT
    # ========================================================================
    
    async def _process_characters(
        self, 
        characters: List[Dict], 
        section_id: str
    ) -> List[str]:
        """
        Process extracted characters: create new or update existing.
        
        Returns list of character IDs present in this section.
        """
        character_ids = []
        
        for char_data in characters:
            name = char_data.get("name", "").strip()
            if not name:
                continue
            
            # Try to find existing character by name
            existing = await self._find_character_by_name(name)
            
            if existing:
                # Update appearances
                if section_id not in existing.appearances:
                    existing.appearances.append(section_id)
                    await self._update_character_appearances(existing.id, existing.appearances)
                character_ids.append(existing.id)
            else:
                # Create new character
                new_char = Character(
                    node_id=self.node_id,
                    name=name,
                    description=char_data.get("description"),
                    role=char_data.get("role", "supporting"),
                    traits=char_data.get("traits", []),
                    first_appearance_section_id=section_id,
                    appearances=[section_id]
                )
                saved = await self._save_character(new_char)
                if saved and saved.id:
                    character_ids.append(saved.id)
        
        return character_ids
    
    async def _process_places(
        self, 
        places: List[Dict], 
        section_id: str
    ) -> List[str]:
        """
        Process extracted places: create new or update existing.
        
        Returns list of place IDs visited in this section.
        """
        place_ids = []
        
        for place_data in places:
            name = place_data.get("name", "").strip()
            if not name:
                continue
            
            # Try to find existing place by name
            existing = await self._find_place_by_name(name)
            
            if existing:
                # Update appearances
                if section_id not in existing.appearances:
                    existing.appearances.append(section_id)
                    await self._update_place_appearances(existing.id, existing.appearances)
                place_ids.append(existing.id)
            else:
                # Create new place
                new_place = Place(
                    node_id=self.node_id,
                    name=name,
                    type=place_data.get("type", "other"),
                    description=place_data.get("description"),
                    atmosphere=place_data.get("atmosphere"),
                    first_appearance_section_id=section_id,
                    appearances=[section_id]
                )
                saved = await self._save_place(new_place)
                if saved and saved.id:
                    place_ids.append(saved.id)
        
        return place_ids
    
    async def _process_events(
        self, 
        events: List[Dict], 
        section_id: str
    ) -> List[str]:
        """
        Process extracted events: create new.
        
        Returns list of event IDs occurring in this section.
        """
        event_ids = []
        
        for event_data in events:
            name = event_data.get("name", "").strip()
            description = event_data.get("description", "").strip()
            if not name or not description:
                continue
            
            # Create new event (events are unique per section)
            new_event = Event(
                node_id=self.node_id,
                name=name,
                description=description,
                type=event_data.get("type", "other"),
                section_id=section_id
            )
            saved = await self._save_event(new_event)
            if saved and saved.id:
                event_ids.append(saved.id)
        
        return event_ids
    
    # ========================================================================
    # COHERENCY DETECTION
    # ========================================================================
    
    async def _detect_coherency_issues(
        self,
        section_id: str,
        content: str,
        extracted: Dict
    ) -> List[Dict]:
        """
        Detect coherency issues by comparing with previous sections.
        
        Checks for:
        - Character inconsistencies (name spelling, traits)
        - Dead characters appearing
        - Knowledge violations
        - Location errors
        """
        issues = []
        
        # Get all existing characters
        all_characters = await self._get_all_characters()
        
        for char_data in extracted.get("characters", []):
            name = char_data.get("name", "")
            
            # Find matching character
            for existing in all_characters:
                # Check for deceased characters
                if existing.status == "deceased":
                    if self._name_matches(name, existing.name, existing.aliases):
                        # Check if this section is before the death
                        # (For now, just flag it - timeline checking can be added later)
                        issues.append({
                            "type": "death_resurrection",
                            "severity": "error",
                            "description": f"Character '{existing.name}' appears but was marked as deceased",
                            "expected_value": f"Character should not appear (died in {existing.status_changed_in})",
                            "source_section_id": existing.status_changed_in
                        })
                
                # Check for name inconsistencies (fuzzy match)
                if self._is_similar_name(name, existing.name) and name != existing.name:
                    issues.append({
                        "type": "name_inconsistency", 
                        "severity": "warning",
                        "description": f"Character name '{name}' might be a variant of '{existing.name}'",
                        "expected_value": existing.name,
                        "source_section_id": existing.first_appearance_section_id
                    })
        
        return issues
    
    def _name_matches(self, name: str, canonical_name: str, aliases: List[str]) -> bool:
        """Check if a name matches the canonical name or any alias."""
        name_lower = name.lower().strip()
        if name_lower == canonical_name.lower().strip():
            return True
        for alias in aliases:
            if name_lower == alias.lower().strip():
                return True
        return False
    
    def _is_similar_name(self, name1: str, name2: str) -> bool:
        """Check if two names are similar (potential variants)."""
        n1 = name1.lower().strip()
        n2 = name2.lower().strip()
        
        # One contains the other
        if n1 in n2 or n2 in n1:
            return True
        
        # Same first name
        parts1 = n1.split()
        parts2 = n2.split()
        if parts1 and parts2 and parts1[0] == parts2[0]:
            return True
        
        return False
    
    # ========================================================================
    # DATABASE OPERATIONS
    # ========================================================================
    
    async def _get_or_create_card(self, section_id: str, section_name: str) -> SectionCard:
        """Get existing card or create new one."""
        existing = await self._get_section_card(section_id)
        if existing:
            return existing
        
        # Create new card
        card = SectionCard(
            node_id=self.node_id,
            structure_item_id=section_id,
            section_name=section_name,
            analyzed=False
        )
        return await self._save_section_card(card)
    
    async def _get_section_card(self, section_id: str) -> Optional[SectionCard]:
        """Get section card from database."""
        # Check cache first
        if section_id in self._cards_cache:
            return self._cards_cache[section_id]
        
        try:
            result = await self.supabase.table("section_cards") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .eq("structure_item_id", section_id) \
                .limit(1) \
                .execute()
            
            if result.data:
                card = self._row_to_card(result.data[0])
                self._cards_cache[section_id] = card
                return card
            return None
        except Exception as e:
            print(f"❌ [Librarian] Failed to get section card: {e}")
            return None
    
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
                # Update
                result = await self.supabase.table("section_cards") \
                    .update(data) \
                    .eq("id", card.id) \
                    .execute()
            else:
                # Insert
                result = await self.supabase.table("section_cards") \
                    .upsert(data, on_conflict="node_id,structure_item_id") \
                    .execute()
            
            if result.data:
                saved_card = self._row_to_card(result.data[0])
                self._cards_cache[card.structure_item_id] = saved_card
                return saved_card
            return card
        except Exception as e:
            print(f"❌ [Librarian] Failed to save section card: {e}")
            return card
    
    async def _find_character_by_name(self, name: str) -> Optional[Character]:
        """Find character by name (case-insensitive)."""
        try:
            result = await self.supabase.table("story_characters") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .ilike("name", name) \
                .limit(1) \
                .execute()
            
            if result.data:
                return self._row_to_character(result.data[0])
            return None
        except Exception as e:
            print(f"❌ [Librarian] Failed to find character: {e}")
            return None
    
    async def _save_character(self, character: Character) -> Optional[Character]:
        """Save character to database."""
        try:
            data = {
                "node_id": character.node_id,
                "name": character.name,
                "aliases": json.dumps(character.aliases),
                "description": character.description,
                "role": character.role,
                "traits": json.dumps(character.traits),
                "arc": character.arc,
                "motivations": json.dumps(character.motivations),
                "relationships": json.dumps(character.relationships),
                "first_appearance_section_id": character.first_appearance_section_id,
                "appearances": json.dumps(character.appearances),
                "voice_notes": character.voice_notes,
                "secrets": json.dumps(character.secrets),
                "status": character.status,
                "status_changed_in": character.status_changed_in
            }
            
            result = await self.supabase.table("story_characters") \
                .insert(data) \
                .execute()
            
            if result.data:
                return self._row_to_character(result.data[0])
            return None
        except Exception as e:
            print(f"❌ [Librarian] Failed to save character: {e}")
            return None
    
    async def _update_character_appearances(self, character_id: str, appearances: List[str]):
        """Update character appearances list."""
        try:
            await self.supabase.table("story_characters") \
                .update({"appearances": json.dumps(appearances)}) \
                .eq("id", character_id) \
                .execute()
        except Exception as e:
            print(f"❌ [Librarian] Failed to update character appearances: {e}")
    
    async def _get_all_characters(self) -> List[Character]:
        """Get all characters for this story."""
        try:
            result = await self.supabase.table("story_characters") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .execute()
            
            return [self._row_to_character(row) for row in result.data]
        except Exception as e:
            print(f"❌ [Librarian] Failed to get characters: {e}")
            return []
    
    async def _find_place_by_name(self, name: str) -> Optional[Place]:
        """Find place by name."""
        try:
            result = await self.supabase.table("story_places") \
                .select("*") \
                .eq("node_id", self.node_id) \
                .ilike("name", name) \
                .limit(1) \
                .execute()
            
            if result.data:
                return self._row_to_place(result.data[0])
            return None
        except Exception as e:
            print(f"❌ [Librarian] Failed to find place: {e}")
            return None
    
    async def _save_place(self, place: Place) -> Optional[Place]:
        """Save place to database."""
        try:
            data = {
                "node_id": place.node_id,
                "name": place.name,
                "type": place.type,
                "description": place.description,
                "atmosphere": place.atmosphere,
                "parent_place_id": place.parent_place_id,
                "first_appearance_section_id": place.first_appearance_section_id,
                "appearances": json.dumps(place.appearances),
                "significance": place.significance
            }
            
            result = await self.supabase.table("story_places") \
                .insert(data) \
                .execute()
            
            if result.data:
                return self._row_to_place(result.data[0])
            return None
        except Exception as e:
            print(f"❌ [Librarian] Failed to save place: {e}")
            return None
    
    async def _update_place_appearances(self, place_id: str, appearances: List[str]):
        """Update place appearances list."""
        try:
            await self.supabase.table("story_places") \
                .update({"appearances": json.dumps(appearances)}) \
                .eq("id", place_id) \
                .execute()
        except Exception as e:
            print(f"❌ [Librarian] Failed to update place appearances: {e}")
    
    async def _save_event(self, event: Event) -> Optional[Event]:
        """Save event to database."""
        try:
            data = {
                "node_id": event.node_id,
                "name": event.name,
                "description": event.description,
                "type": event.type,
                "section_id": event.section_id,
                "characters_involved": json.dumps(event.characters_involved),
                "place_id": event.place_id,
                "timeline_position": event.timeline_position,
                "story_time": event.story_time,
                "consequences": event.consequences,
                "depends_on": json.dumps(event.depends_on),
                "enables": json.dumps(event.enables)
            }
            
            result = await self.supabase.table("story_events") \
                .insert(data) \
                .execute()
            
            if result.data:
                return self._row_to_event(result.data[0])
            return None
        except Exception as e:
            print(f"❌ [Librarian] Failed to save event: {e}")
            return None
    
    async def _save_coherency_issue(self, card_id: str, issue: Dict):
        """Save coherency issue to database."""
        try:
            data = {
                "section_card_id": card_id,
                "type": issue.get("type", "other"),
                "severity": issue.get("severity", "warning"),
                "description": issue.get("description", ""),
                "start_offset": issue.get("start_offset"),
                "end_offset": issue.get("end_offset"),
                "problematic_text": issue.get("problematic_text"),
                "expected_value": issue.get("expected_value"),
                "source_section_id": issue.get("source_section_id"),
                "status": "open"
            }
            
            await self.supabase.table("coherency_issues") \
                .insert(data) \
                .execute()
                
            print(f"⚠️ [Librarian] Flagged issue: {issue.get('type')} - {issue.get('description')}")
        except Exception as e:
            print(f"❌ [Librarian] Failed to save coherency issue: {e}")
    
    # ========================================================================
    # HELPER METHODS
    # ========================================================================
    
    async def _get_llm(self):
        """Get or create the LLM instance."""
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            
            self._llm = ChatOpenAI(
                model="gpt-4o-mini",  # Use smaller model for extraction
                temperature=0.3,
                api_key=os.getenv("OPENAI_API_KEY")
            )
        return self._llm
    
    async def _get_characters_for_section(
        self, 
        section_id: str, 
        card: Optional[SectionCard]
    ) -> List[Character]:
        """Get characters relevant for this section."""
        if not card or not card.characters_present:
            return []
        
        characters = []
        for char_id in card.characters_present:
            try:
                result = await self.supabase.table("story_characters") \
                    .select("*") \
                    .eq("id", char_id) \
                    .limit(1) \
                    .execute()
                
                if result.data:
                    characters.append(self._row_to_character(result.data[0]))
            except:
                pass
        
        return characters
    
    async def _get_places_for_section(
        self, 
        section_id: str, 
        card: Optional[SectionCard]
    ) -> List[Place]:
        """Get places relevant for this section."""
        if not card or not card.places_visited:
            return []
        
        places = []
        for place_id in card.places_visited:
            try:
                result = await self.supabase.table("story_places") \
                    .select("*") \
                    .eq("id", place_id) \
                    .limit(1) \
                    .execute()
                
                if result.data:
                    places.append(self._row_to_place(result.data[0]))
            except:
                pass
        
        return places
    
    async def _get_previous_summary(self, section_id: str) -> Optional[str]:
        """Get summary of the previous section (for continuity)."""
        # Extract section number if possible
        import re
        match = re.search(r'(\d+)', section_id)
        if not match:
            return None
        
        current_num = int(match.group(1))
        if current_num <= 1:
            return None
        
        # Try to find previous section
        prev_id_pattern = section_id.replace(str(current_num), str(current_num - 1))
        prev_card = await self._get_section_card(prev_id_pattern)
        
        if prev_card and prev_card.summary:
            return f"Previous section: {prev_card.summary}"
        
        return None
    
    async def _get_foreshadowing_for_section(self, section_id: str) -> List[str]:
        """Get foreshadowing hooks that should be planted in this section."""
        # Look for hooks from other sections that target this section
        try:
            result = await self.supabase.table("section_cards") \
                .select("hooks, section_name") \
                .eq("node_id", self.node_id) \
                .execute()
            
            foreshadowing = []
            for row in result.data:
                hooks = row.get("hooks")
                if isinstance(hooks, str):
                    hooks = json.loads(hooks)
                
                for hook in (hooks or []):
                    if hook.get("targetSectionId") == section_id:
                        if hook.get("type") == "foreshadowing":
                            foreshadowing.append(f"Plant foreshadowing: {hook.get('element')}")
            
            return foreshadowing
        except Exception as e:
            print(f"❌ [Librarian] Failed to get foreshadowing: {e}")
            return []
    
    # ========================================================================
    # ROW CONVERTERS
    # ========================================================================
    
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
    
    def _row_to_character(self, row: Dict) -> Character:
        """Convert database row to Character."""
        return Character(
            id=row.get("id"),
            node_id=row.get("node_id", ""),
            name=row.get("name", ""),
            aliases=self._parse_json(row.get("aliases"), []),
            description=row.get("description"),
            role=row.get("role", "supporting"),
            traits=self._parse_json(row.get("traits"), []),
            arc=row.get("arc"),
            motivations=self._parse_json(row.get("motivations"), []),
            relationships=self._parse_json(row.get("relationships"), []),
            first_appearance_section_id=row.get("first_appearance_section_id"),
            appearances=self._parse_json(row.get("appearances"), []),
            voice_notes=row.get("voice_notes"),
            secrets=self._parse_json(row.get("secrets"), []),
            status=row.get("status", "active"),
            status_changed_in=row.get("status_changed_in")
        )
    
    def _row_to_place(self, row: Dict) -> Place:
        """Convert database row to Place."""
        return Place(
            id=row.get("id"),
            node_id=row.get("node_id", ""),
            name=row.get("name", ""),
            type=row.get("type", "other"),
            description=row.get("description"),
            atmosphere=row.get("atmosphere"),
            parent_place_id=row.get("parent_place_id"),
            first_appearance_section_id=row.get("first_appearance_section_id"),
            appearances=self._parse_json(row.get("appearances"), []),
            significance=row.get("significance")
        )
    
    def _row_to_event(self, row: Dict) -> Event:
        """Convert database row to Event."""
        return Event(
            id=row.get("id"),
            node_id=row.get("node_id", ""),
            name=row.get("name", ""),
            description=row.get("description", ""),
            type=row.get("type", "other"),
            section_id=row.get("section_id", ""),
            characters_involved=self._parse_json(row.get("characters_involved"), []),
            place_id=row.get("place_id"),
            timeline_position=row.get("timeline_position"),
            story_time=row.get("story_time"),
            consequences=row.get("consequences"),
            depends_on=self._parse_json(row.get("depends_on"), []),
            enables=self._parse_json(row.get("enables"), [])
        )
    
    def _row_to_issue(self, row: Dict) -> CoherencyIssue:
        """Convert database row to CoherencyIssue."""
        return CoherencyIssue(
            id=row.get("id"),
            section_card_id=row.get("section_card_id", ""),
            type=row.get("type", ""),
            severity=row.get("severity", "warning"),
            description=row.get("description", ""),
            start_offset=row.get("start_offset"),
            end_offset=row.get("end_offset"),
            problematic_text=row.get("problematic_text"),
            expected_value=row.get("expected_value"),
            source_section_id=row.get("source_section_id"),
            status=row.get("status", "open"),
            resolved_at=row.get("resolved_at"),
            resolution_note=row.get("resolution_note")
        )
    
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


# ============================================================================
# FACTORY FUNCTION
# ============================================================================

def get_librarian(node_id: str, supabase_client: Any) -> LibrarianAgent:
    """
    Factory function to get a LibrarianAgent for a story node.
    
    Args:
        node_id: The story structure node ID
        supabase_client: Async Supabase client
        
    Returns:
        LibrarianAgent instance
    """
    return LibrarianAgent(node_id, supabase_client)

