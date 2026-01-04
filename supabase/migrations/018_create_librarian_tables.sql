-- Migration 018: Create Librarian Agent Tables
-- 
-- The Librarian Agent maintains story coherency by tracking:
-- 1. Section Cards - Per-chapter intelligence (summary, characters, dependencies)
-- 2. Story Characters - Character registry with medium depth
-- 3. Story Places - Location registry  
-- 4. Story Events - Plot event timeline
-- 5. Coherency Issues - Flagged issues on section cards
--
-- Designed for automatic analysis after content is written.
-- Issues are displayed on section cards with links to discrepancies.

-- ============================================================================
-- 1. SECTION CARDS TABLE
-- ============================================================================
-- Per-chapter intelligence: summary, characters present, dependencies, etc.
-- This is the primary table the Librarian uses to guide writers.
CREATE TABLE IF NOT EXISTS public.section_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to the document section (which links to node via document_sections table)
  -- If null, this card is for a section that doesn't have content yet
  document_section_id UUID REFERENCES public.document_sections(id) ON DELETE SET NULL,
  
  -- Direct link to node for structure sections without content yet
  node_id TEXT REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  
  -- Section identifier within the structure (e.g., "chapter-1", "scene-2-3")
  structure_item_id TEXT NOT NULL,
  
  -- Section name from structure
  section_name TEXT NOT NULL,
  
  -- ============ CONTENT SUMMARY ============
  -- 2-3 sentence summary of what happens in this section
  summary TEXT,
  
  -- Key moments as bullet points (JSON array of strings)
  -- e.g., ["Marcus discovers the letter", "Elena reveals her true identity"]
  key_moments JSONB DEFAULT '[]',
  
  -- ============ ENTITY TRACKING ============
  -- Character IDs present in this section (references story_characters.id)
  characters_present JSONB DEFAULT '[]',
  
  -- Place IDs mentioned (references story_places.id)  
  places_visited JSONB DEFAULT '[]',
  
  -- Event IDs occurring (references story_events.id)
  events_occurring JSONB DEFAULT '[]',
  
  -- ============ CROSS-CHAPTER CONNECTIONS ============
  -- Dependencies on other sections
  -- Format: [{ "type": "requires|references|builds_on", "sectionId": "...", "description": "..." }]
  dependencies JSONB DEFAULT '[]',
  
  -- Narrative hooks (foreshadowing, callbacks)
  -- Format: [{ "type": "foreshadowing|callback|plant|payoff", "targetSectionId": "...", "element": "..." }]
  hooks JSONB DEFAULT '[]',
  
  -- ============ WRITER GUIDANCE ============
  -- Constraints for writers (what must/must not happen)
  -- Format: [{ "type": "character_alive|item_possession|location|knowledge|custom", "description": "..." }]
  constraints JSONB DEFAULT '[]',
  
  -- Required elements to include
  must_include JSONB DEFAULT '[]',
  
  -- Elements that would cause contradictions
  must_not_include JSONB DEFAULT '[]',
  
  -- ============ METADATA ============
  word_count INTEGER DEFAULT 0,
  
  -- Point of view character ID (references story_characters.id)
  pov_character_id UUID,
  
  -- Timeframe within the story (e.g., "Day 1, morning", "Two weeks later")
  timeframe TEXT,
  
  -- Mood/tone for this section
  mood TEXT,
  
  -- Has this card been analyzed by the Librarian?
  analyzed BOOLEAN DEFAULT FALSE,
  
  -- When was the card last analyzed?
  analyzed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique card per section within a node
  UNIQUE(node_id, structure_item_id)
);

-- ============================================================================
-- 2. STORY CHARACTERS TABLE
-- ============================================================================
-- Character registry with medium depth:
-- - Name, role, traits, arc
-- - Relationships
-- - Appearance tracking
-- - Voice notes for dialogue
CREATE TABLE IF NOT EXISTS public.story_characters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to the story node
  node_id TEXT REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  
  -- ============ BASIC INFO ============
  name TEXT NOT NULL,
  
  -- Alternative names/aliases (e.g., nicknames, titles)
  aliases JSONB DEFAULT '[]',
  
  -- Physical/visual description
  description TEXT,
  
  -- Role in the story
  role TEXT CHECK (role IN ('protagonist', 'antagonist', 'supporting', 'minor')) DEFAULT 'supporting',
  
  -- ============ PERSONALITY ============
  -- Key personality traits (JSON array of strings)
  traits JSONB DEFAULT '[]',
  
  -- Character's journey/arc description
  arc TEXT,
  
  -- Motivations driving the character
  motivations JSONB DEFAULT '[]',
  
  -- ============ RELATIONSHIPS ============
  -- Relationships with other characters
  -- Format: [{ "characterId": "...", "type": "friend|enemy|family|romantic|rival|mentor", "description": "..." }]
  relationships JSONB DEFAULT '[]',
  
  -- ============ APPEARANCE TRACKING ============
  -- Section ID where character first appears
  first_appearance_section_id TEXT,
  
  -- All section IDs where character appears
  appearances JSONB DEFAULT '[]',
  
  -- ============ WRITING GUIDANCE ============
  -- Notes on how this character speaks (for dialogue consistency)
  voice_notes TEXT,
  
  -- Secrets the character has (only known to reader/author)
  secrets JSONB DEFAULT '[]',
  
  -- Current status (for tracking deaths, transformations, etc.)
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deceased', 'unknown', 'transformed')),
  
  -- Section ID where status changed (if applicable)
  status_changed_in TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. STORY PLACES TABLE
-- ============================================================================
-- Location registry for the story world
CREATE TABLE IF NOT EXISTS public.story_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to the story node
  node_id TEXT REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  
  -- ============ BASIC INFO ============
  name TEXT NOT NULL,
  
  -- Type of location
  type TEXT CHECK (type IN ('interior', 'exterior', 'city', 'country', 'realm', 'vehicle', 'other')) DEFAULT 'other',
  
  -- Detailed description
  description TEXT,
  
  -- Atmospheric notes (for setting the scene)
  atmosphere TEXT,
  
  -- ============ CONNECTIONS ============
  -- Parent location ID (for hierarchical locations, e.g., room → building → city)
  parent_place_id UUID REFERENCES public.story_places(id) ON DELETE SET NULL,
  
  -- ============ APPEARANCE TRACKING ============
  -- Section ID where place first appears
  first_appearance_section_id TEXT,
  
  -- All section IDs where place is mentioned
  appearances JSONB DEFAULT '[]',
  
  -- Story significance
  significance TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. STORY EVENTS TABLE
-- ============================================================================
-- Plot events and their timeline
CREATE TABLE IF NOT EXISTS public.story_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Link to the story node
  node_id TEXT REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  
  -- ============ BASIC INFO ============
  name TEXT NOT NULL,
  
  -- What happened
  description TEXT NOT NULL,
  
  -- Type of event
  type TEXT CHECK (type IN ('plot_point', 'revelation', 'conflict', 'resolution', 'death', 'transformation', 'meeting', 'other')) DEFAULT 'other',
  
  -- ============ CONTEXT ============
  -- Section where this event occurs
  section_id TEXT NOT NULL,
  
  -- Characters involved (array of character IDs)
  characters_involved JSONB DEFAULT '[]',
  
  -- Place where event occurs (place ID)
  place_id UUID REFERENCES public.story_places(id) ON DELETE SET NULL,
  
  -- ============ TIMELINE ============
  -- Relative position in story timeline (for ordering)
  timeline_position INTEGER,
  
  -- Story time (if applicable, e.g., "Day 1, evening")
  story_time TEXT,
  
  -- ============ CONSEQUENCES ============
  -- What this event causes/affects
  consequences TEXT,
  
  -- Events this depends on (array of event IDs)
  depends_on JSONB DEFAULT '[]',
  
  -- Events this enables (array of event IDs)  
  enables JSONB DEFAULT '[]',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. COHERENCY ISSUES TABLE
-- ============================================================================
-- Flagged coherency issues for section cards
-- Links to the discrepancy location in the content
CREATE TABLE IF NOT EXISTS public.coherency_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- The section card this issue is flagged on
  section_card_id UUID REFERENCES public.section_cards(id) ON DELETE CASCADE NOT NULL,
  
  -- ============ ISSUE DETAILS ============
  -- Type of coherency issue
  type TEXT NOT NULL CHECK (type IN (
    'character_inconsistency',   -- Character says/does something out of character
    'timeline_contradiction',    -- Event order doesn't make sense
    'knowledge_violation',       -- Character knows something they shouldn't
    'location_error',            -- Character is in wrong place
    'item_possession_error',     -- Character has/uses item they don't have
    'death_resurrection',        -- Dead character appears alive
    'name_inconsistency',        -- Character name spelled differently
    'relationship_error',        -- Relationship described incorrectly
    'other'
  )),
  
  -- Severity level
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  
  -- Human-readable description of the issue
  description TEXT NOT NULL,
  
  -- ============ LOCATION IN CONTENT ============
  -- Character offset where issue starts (for linking to text)
  start_offset INTEGER,
  
  -- Character offset where issue ends
  end_offset INTEGER,
  
  -- The problematic text snippet
  problematic_text TEXT,
  
  -- ============ EXPECTED VALUE ============
  -- What the correct value/state should be
  expected_value TEXT,
  
  -- Section ID where the "source of truth" is established
  source_section_id TEXT,
  
  -- ============ STATUS ============
  -- Has the issue been resolved?
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  
  -- When was it resolved?
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Optional note from user about resolution
  resolution_note TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Section cards
CREATE INDEX IF NOT EXISTS idx_section_cards_node ON public.section_cards(node_id);
CREATE INDEX IF NOT EXISTS idx_section_cards_document_section ON public.section_cards(document_section_id);
CREATE INDEX IF NOT EXISTS idx_section_cards_structure_item ON public.section_cards(node_id, structure_item_id);
CREATE INDEX IF NOT EXISTS idx_section_cards_analyzed ON public.section_cards(analyzed) WHERE analyzed = FALSE;

-- Characters
CREATE INDEX IF NOT EXISTS idx_story_characters_node ON public.story_characters(node_id);
CREATE INDEX IF NOT EXISTS idx_story_characters_name ON public.story_characters(node_id, name);
CREATE INDEX IF NOT EXISTS idx_story_characters_role ON public.story_characters(node_id, role);

-- Places
CREATE INDEX IF NOT EXISTS idx_story_places_node ON public.story_places(node_id);
CREATE INDEX IF NOT EXISTS idx_story_places_parent ON public.story_places(parent_place_id);

-- Events
CREATE INDEX IF NOT EXISTS idx_story_events_node ON public.story_events(node_id);
CREATE INDEX IF NOT EXISTS idx_story_events_section ON public.story_events(section_id);
CREATE INDEX IF NOT EXISTS idx_story_events_timeline ON public.story_events(node_id, timeline_position);

-- Coherency issues
CREATE INDEX IF NOT EXISTS idx_coherency_issues_card ON public.coherency_issues(section_card_id);
CREATE INDEX IF NOT EXISTS idx_coherency_issues_status ON public.coherency_issues(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_coherency_issues_severity ON public.coherency_issues(severity);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.section_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coherency_issues ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - SECTION CARDS
-- ============================================================================
CREATE POLICY "Users can view section cards in accessible stories"
  ON public.section_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND (
        s.user_id = auth.uid()
        OR s.is_public = TRUE
        OR (
          s.shared = TRUE
          AND EXISTS (
            SELECT 1 FROM public.canvas_shares cs
            WHERE cs.canvas_id = s.id
            AND cs.shared_with_user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage section cards in own stories"
  ON public.section_cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - STORY CHARACTERS
-- ============================================================================
CREATE POLICY "Users can view characters in accessible stories"
  ON public.story_characters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND (
        s.user_id = auth.uid()
        OR s.is_public = TRUE
        OR (
          s.shared = TRUE
          AND EXISTS (
            SELECT 1 FROM public.canvas_shares cs
            WHERE cs.canvas_id = s.id
            AND cs.shared_with_user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage characters in own stories"
  ON public.story_characters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - STORY PLACES
-- ============================================================================
CREATE POLICY "Users can view places in accessible stories"
  ON public.story_places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND (
        s.user_id = auth.uid()
        OR s.is_public = TRUE
        OR (
          s.shared = TRUE
          AND EXISTS (
            SELECT 1 FROM public.canvas_shares cs
            WHERE cs.canvas_id = s.id
            AND cs.shared_with_user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage places in own stories"
  ON public.story_places FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - STORY EVENTS
-- ============================================================================
CREATE POLICY "Users can view events in accessible stories"
  ON public.story_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND (
        s.user_id = auth.uid()
        OR s.is_public = TRUE
        OR (
          s.shared = TRUE
          AND EXISTS (
            SELECT 1 FROM public.canvas_shares cs
            WHERE cs.canvas_id = s.id
            AND cs.shared_with_user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage events in own stories"
  ON public.story_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - COHERENCY ISSUES
-- ============================================================================
CREATE POLICY "Users can view issues in accessible stories"
  ON public.coherency_issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.section_cards sc
      JOIN public.nodes n ON sc.node_id = n.id
      JOIN public.stories s ON n.story_id = s.id
      WHERE sc.id = section_card_id
      AND (
        s.user_id = auth.uid()
        OR s.is_public = TRUE
        OR (
          s.shared = TRUE
          AND EXISTS (
            SELECT 1 FROM public.canvas_shares cs
            WHERE cs.canvas_id = s.id
            AND cs.shared_with_user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "Users can manage issues in own stories"
  ON public.coherency_issues FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.section_cards sc
      JOIN public.nodes n ON sc.node_id = n.id
      JOIN public.stories s ON n.story_id = s.id
      WHERE sc.id = section_card_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS - Updated At
-- ============================================================================
CREATE TRIGGER update_section_cards_updated_at
  BEFORE UPDATE ON public.section_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_characters_updated_at
  BEFORE UPDATE ON public.story_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_places_updated_at
  BEFORE UPDATE ON public.story_places
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_events_updated_at
  BEFORE UPDATE ON public.story_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coherency_issues_updated_at
  BEFORE UPDATE ON public.coherency_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.section_cards IS 'Librarian Agent: Per-section intelligence cards with summary, entities, dependencies, and writer guidance';
COMMENT ON TABLE public.story_characters IS 'Librarian Agent: Character registry with medium depth (traits, arc, relationships, voice)';
COMMENT ON TABLE public.story_places IS 'Librarian Agent: Location registry with hierarchy and atmosphere';
COMMENT ON TABLE public.story_events IS 'Librarian Agent: Plot event timeline with dependencies and consequences';
COMMENT ON TABLE public.coherency_issues IS 'Librarian Agent: Flagged coherency issues with links to problematic text';

COMMENT ON COLUMN public.section_cards.summary IS '2-3 sentence summary of what happens in this section';
COMMENT ON COLUMN public.section_cards.key_moments IS 'Bullet points of key moments (JSON array of strings)';
COMMENT ON COLUMN public.section_cards.dependencies IS 'Dependencies on other sections [{ type, sectionId, description }]';
COMMENT ON COLUMN public.section_cards.hooks IS 'Narrative hooks [{ type, targetSectionId, element }]';
COMMENT ON COLUMN public.section_cards.constraints IS 'Writer constraints [{ type, description }]';
COMMENT ON COLUMN public.section_cards.analyzed IS 'Has this card been analyzed by the Librarian?';

COMMENT ON COLUMN public.story_characters.traits IS 'Key personality traits (JSON array of strings)';
COMMENT ON COLUMN public.story_characters.relationships IS 'Relationships [{ characterId, type, description }]';
COMMENT ON COLUMN public.story_characters.voice_notes IS 'How this character speaks (for dialogue consistency)';
COMMENT ON COLUMN public.story_characters.status IS 'Current status: active, deceased, unknown, transformed';

COMMENT ON COLUMN public.story_events.timeline_position IS 'Relative position in story timeline for ordering';
COMMENT ON COLUMN public.story_events.depends_on IS 'Events this event depends on (array of event IDs)';
COMMENT ON COLUMN public.story_events.enables IS 'Events this event enables (array of event IDs)';

COMMENT ON COLUMN public.coherency_issues.start_offset IS 'Character offset where issue starts in section content';
COMMENT ON COLUMN public.coherency_issues.source_section_id IS 'Section where the source of truth is established';

