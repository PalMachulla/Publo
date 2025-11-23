-- Migration 013: Create Document Embeddings for RAG
-- This migration adds vector embeddings support for semantic search and RAG capabilities

-- ============================================================================
-- 1. ENABLE PGVECTOR EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. DOCUMENT EMBEDDINGS TABLE
-- ============================================================================
-- Stores vector embeddings of document chunks for semantic search
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- References
  document_section_id UUID NOT NULL REFERENCES public.document_sections(id) ON DELETE CASCADE,
  story_structure_node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Order within the document section
  token_count INTEGER, -- Approximate token count for cost tracking
  
  -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding vector(1536) NOT NULL,
  
  -- Metadata for enhanced retrieval
  metadata JSONB DEFAULT '{}', 
  -- Example metadata structure:
  -- {
  --   "act": "Act 1",
  --   "sequence": "Opening Sequence", 
  --   "scene": "INT. COFFEE SHOP - DAY",
  --   "beat": "Introduction",
  --   "hierarchy_path": "Act 1/Opening Sequence/INT. COFFEE SHOP - DAY",
  --   "section_type": "scene" | "beat" | "sequence",
  --   "character_mentions": ["Alice", "Bob"],
  --   "themes": ["friendship", "conflict"]
  -- }
  
  -- Status tracking
  embedding_status TEXT DEFAULT 'completed' CHECK (embedding_status IN ('pending', 'processing', 'completed', 'failed')),
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique chunks per section
  UNIQUE(document_section_id, chunk_index)
);

-- ============================================================================
-- 3. INDEXES FOR FAST RETRIEVAL
-- ============================================================================

-- HNSW index for fast cosine similarity search
-- This is the key index for semantic search performance
CREATE INDEX document_embeddings_embedding_idx 
  ON public.document_embeddings 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- m = max connections per layer (higher = better recall, slower build)
-- ef_construction = size of dynamic candidate list (higher = better quality, slower build)

-- Index for filtering by story structure node (performance optimization)
CREATE INDEX document_embeddings_node_idx 
  ON public.document_embeddings(story_structure_node_id);

-- Index for filtering by user (for user-specific searches)
CREATE INDEX document_embeddings_user_idx 
  ON public.document_embeddings(user_id);

-- Index for document section lookups
CREATE INDEX document_embeddings_section_idx 
  ON public.document_embeddings(document_section_id);

-- Index for status filtering (useful for batch operations)
CREATE INDEX document_embeddings_status_idx 
  ON public.document_embeddings(embedding_status)
  WHERE embedding_status != 'completed';

-- GIN index for metadata queries (e.g., searching by character mentions)
CREATE INDEX document_embeddings_metadata_idx 
  ON public.document_embeddings USING GIN (metadata);

-- ============================================================================
-- 4. EMBEDDING QUEUE TABLE (For async processing)
-- ============================================================================
-- Tracks which document sections need embeddings generated
CREATE TABLE IF NOT EXISTS public.embedding_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_section_id UUID NOT NULL REFERENCES public.document_sections(id) ON DELETE CASCADE,
  story_structure_node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  priority INTEGER DEFAULT 5, -- 1 (high) to 10 (low)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(document_section_id)
);

-- Index for queue processing
CREATE INDEX embedding_queue_status_priority_idx 
  ON public.embedding_queue(status, priority, created_at)
  WHERE status = 'pending';

-- ============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. RLS POLICIES - DOCUMENT EMBEDDINGS
-- ============================================================================

-- Users can view embeddings from their own stories or stories shared with them
CREATE POLICY "Users can view accessible document embeddings"
  ON public.document_embeddings FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = story_structure_node_id
      AND (
        s.is_public = TRUE
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

-- Users can insert embeddings for their own stories
CREATE POLICY "Users can create embeddings for own stories"
  ON public.document_embeddings FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own embeddings
CREATE POLICY "Users can update own embeddings"
  ON public.document_embeddings FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own embeddings
CREATE POLICY "Users can delete own embeddings"
  ON public.document_embeddings FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 7. RLS POLICIES - EMBEDDING QUEUE
-- ============================================================================

CREATE POLICY "Users can view own embedding queue"
  ON public.embedding_queue FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own embedding queue items"
  ON public.embedding_queue FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own embedding queue"
  ON public.embedding_queue FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own embedding queue items"
  ON public.embedding_queue FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 8. FUNCTIONS
-- ============================================================================

-- Function to calculate cosine similarity (for reference, pgvector handles this)
-- This is a helper function for manual similarity calculations if needed
CREATE OR REPLACE FUNCTION cosine_similarity(a vector(1536), b vector(1536))
RETURNS float
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1 - (a <=> b); -- <=> is cosine distance operator
END;
$$;

-- Function to search embeddings by semantic similarity
CREATE OR REPLACE FUNCTION search_document_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_node_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_section_id uuid,
  chunk_text text,
  chunk_index integer,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.document_section_id,
    de.chunk_text,
    de.chunk_index,
    de.metadata,
    1 - (de.embedding <=> query_embedding) as similarity
  FROM public.document_embeddings de
  WHERE 
    (filter_node_id IS NULL OR de.story_structure_node_id = filter_node_id)
    AND de.embedding_status = 'completed'
    AND 1 - (de.embedding <=> query_embedding) > match_threshold
    AND (
      de.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.nodes n
        JOIN public.stories s ON n.story_id = s.id
        WHERE n.id = de.story_structure_node_id
        AND (s.is_public = TRUE OR s.shared = TRUE)
      )
    )
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to queue a document section for embedding
CREATE OR REPLACE FUNCTION queue_document_for_embedding(
  p_document_section_id uuid,
  p_priority integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_queue_id uuid;
  v_node_id text;
  v_user_id uuid;
BEGIN
  -- Get node_id and user_id from document_section
  SELECT 
    ds.story_structure_node_id,
    s.user_id
  INTO v_node_id, v_user_id
  FROM public.document_sections ds
  JOIN public.nodes n ON ds.story_structure_node_id = n.id
  JOIN public.stories s ON n.story_id = s.id
  WHERE ds.id = p_document_section_id;
  
  -- Insert or update queue entry
  INSERT INTO public.embedding_queue (
    document_section_id,
    story_structure_node_id,
    user_id,
    priority,
    status
  ) VALUES (
    p_document_section_id,
    v_node_id,
    v_user_id,
    p_priority,
    'pending'
  )
  ON CONFLICT (document_section_id) 
  DO UPDATE SET
    priority = EXCLUDED.priority,
    status = 'pending',
    retry_count = 0,
    error_message = NULL,
    updated_at = NOW()
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$;

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Update updated_at timestamp for document_embeddings
CREATE TRIGGER update_document_embeddings_updated_at
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp for embedding_queue
CREATE TRIGGER update_embedding_queue_updated_at
  BEFORE UPDATE ON public.embedding_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically queue document sections for embedding when created/updated
CREATE OR REPLACE FUNCTION auto_queue_document_for_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only queue if content has changed and is not empty
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.content IS DISTINCT FROM OLD.content))
     AND NEW.content IS NOT NULL 
     AND length(trim(NEW.content)) > 50 THEN
    
    PERFORM queue_document_for_embedding(NEW.id, 5);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to document_sections (debounced via queue system)
CREATE TRIGGER auto_queue_embedding_on_document_change
  AFTER INSERT OR UPDATE OF content ON public.document_sections
  FOR EACH ROW
  EXECUTE FUNCTION auto_queue_document_for_embedding();

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.document_embeddings IS 'Stores vector embeddings of document chunks for semantic search and RAG';
COMMENT ON TABLE public.embedding_queue IS 'Queue for async embedding generation of document sections';

COMMENT ON COLUMN public.document_embeddings.embedding IS 'Vector embedding from OpenAI text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN public.document_embeddings.metadata IS 'JSON metadata for enhanced retrieval: hierarchy, characters, themes, etc.';
COMMENT ON COLUMN public.document_embeddings.chunk_index IS 'Order of this chunk within the document section';

COMMENT ON FUNCTION search_document_embeddings IS 'Semantic search function using cosine similarity';
COMMENT ON FUNCTION queue_document_for_embedding IS 'Queue a document section for embedding generation';

-- ============================================================================
-- 11. PERFORMANCE NOTES
-- ============================================================================

-- VACUUM ANALYZE after initial bulk loading of embeddings
-- Run this after embedding your first batch of stories:
-- VACUUM ANALYZE public.document_embeddings;

-- Monitor index usage:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public' AND indexrelname LIKE 'document_embeddings%';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

