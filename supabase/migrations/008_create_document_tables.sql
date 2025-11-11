-- Migration 008: Create Document Management Tables
-- This migration creates tables for document sections, AI interactions, highlights, and track changes

-- ============================================================================
-- 1. DOCUMENT SECTIONS TABLE
-- ============================================================================
-- Stores content for each structural section (Chapter, Scene, etc)
CREATE TABLE IF NOT EXISTS public.document_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_structure_node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  structure_item_id TEXT NOT NULL, -- References item.id from story structure JSON
  content TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique sections per structure item
  UNIQUE(story_structure_node_id, structure_item_id)
);

-- ============================================================================
-- 2. AI INTERACTIONS TABLE (Future Use)
-- ============================================================================
-- Stores AI requests and responses for analysis, generation, etc
CREATE TABLE IF NOT EXISTS public.ai_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_section_id UUID REFERENCES public.document_sections(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('analysis', 'suggestion', 'generation', 'continuation', 'companion')),
  prompt TEXT NOT NULL,
  response TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. HIGHLIGHTS TABLE (Future Use)
-- ============================================================================
-- Stores document highlights from AI analysis
CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_section_id UUID REFERENCES public.document_sections(id) ON DELETE CASCADE NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('yellow', 'red', 'blue', 'green')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. TRACK CHANGES TABLE (Future Use)
-- ============================================================================
-- Stores AI suggestions as track changes
CREATE TABLE IF NOT EXISTS public.track_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_section_id UUID REFERENCES public.document_sections(id) ON DELETE CASCADE NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  suggested_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_document_sections_node ON public.document_sections(story_structure_node_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_order ON public.document_sections(story_structure_node_id, order_index);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_user ON public.ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_section ON public.ai_interactions(document_section_id);
CREATE INDEX IF NOT EXISTS idx_highlights_section ON public.highlights(document_section_id);
CREATE INDEX IF NOT EXISTS idx_track_changes_section ON public.track_changes(document_section_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_changes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - DOCUMENT SECTIONS
-- ============================================================================
-- Users can view sections from stories they own or have access to
CREATE POLICY "Users can view accessible document sections"
  ON public.document_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = story_structure_node_id
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

-- Users can insert sections in stories they own
CREATE POLICY "Users can create document sections in own stories"
  ON public.document_sections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = story_structure_node_id
      AND s.user_id = auth.uid()
    )
  );

-- Users can update sections in stories they own
CREATE POLICY "Users can update document sections in own stories"
  ON public.document_sections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = story_structure_node_id
      AND s.user_id = auth.uid()
    )
  );

-- Users can delete sections from stories they own
CREATE POLICY "Users can delete document sections from own stories"
  ON public.document_sections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = story_structure_node_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - AI INTERACTIONS
-- ============================================================================
CREATE POLICY "Users can view own AI interactions"
  ON public.ai_interactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own AI interactions"
  ON public.ai_interactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI interactions"
  ON public.ai_interactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI interactions"
  ON public.ai_interactions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- RLS POLICIES - HIGHLIGHTS
-- ============================================================================
CREATE POLICY "Users can view highlights in accessible sections"
  ON public.highlights FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.document_sections ds
      JOIN public.nodes n ON ds.story_structure_node_id = n.id
      JOIN public.stories s ON n.story_id = s.id
      WHERE ds.id = document_section_id
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

CREATE POLICY "Users can manage highlights in own sections"
  ON public.highlights FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.document_sections ds
      JOIN public.nodes n ON ds.story_structure_node_id = n.id
      JOIN public.stories s ON n.story_id = s.id
      WHERE ds.id = document_section_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES - TRACK CHANGES
-- ============================================================================
CREATE POLICY "Users can view track changes in accessible sections"
  ON public.track_changes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.document_sections ds
      JOIN public.nodes n ON ds.story_structure_node_id = n.id
      JOIN public.stories s ON n.story_id = s.id
      WHERE ds.id = document_section_id
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

CREATE POLICY "Users can manage track changes in own sections"
  ON public.track_changes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.document_sections ds
      JOIN public.nodes n ON ds.story_structure_node_id = n.id
      JOIN public.stories s ON n.story_id = s.id
      WHERE ds.id = document_section_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Update updated_at timestamp for document_sections
CREATE TRIGGER update_document_sections_updated_at
  BEFORE UPDATE ON public.document_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp for highlights
CREATE TRIGGER update_highlights_updated_at
  BEFORE UPDATE ON public.highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp for track_changes
CREATE TRIGGER update_track_changes_updated_at
  BEFORE UPDATE ON public.track_changes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.document_sections IS 'Stores content for each structural section (Chapter, Scene, etc) of a story';
COMMENT ON TABLE public.ai_interactions IS 'Stores AI requests and responses for document assistance (future use)';
COMMENT ON TABLE public.highlights IS 'Stores document highlights from AI analysis (future use)';
COMMENT ON TABLE public.track_changes IS 'Stores AI suggestions as track changes (future use)';

COMMENT ON COLUMN public.document_sections.structure_item_id IS 'References item.id from the story structure items JSON array';
COMMENT ON COLUMN public.document_sections.word_count IS 'Calculated word count for this section';
COMMENT ON COLUMN public.document_sections.status IS 'Workflow status: draft, in_progress, or completed';
COMMENT ON COLUMN public.document_sections.order_index IS 'Sort order for sections within a story structure';

