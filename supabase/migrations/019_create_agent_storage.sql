-- Migration 019: Create Agent Storage Tables
-- Provides persistent storage for Deep Agent context and memory

-- ============================================================================
-- 1. AGENT CONTEXT FILES TABLE
-- ============================================================================
-- Replaces ephemeral /tmp/ storage with persistent Supabase storage
-- Stores per-story context files (notes, character data, plan files, etc.)

CREATE TABLE IF NOT EXISTS public.agent_context_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Scope
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File info
  path TEXT NOT NULL,  -- e.g., "context/connected_characters.json", "notes/plot.txt"
  
  -- Content (one or the other, depending on file type)
  content JSONB,       -- For JSON files
  text_content TEXT,   -- For plain text files
  
  -- Metadata
  file_type TEXT DEFAULT 'json' CHECK (file_type IN ('json', 'text')),
  size_bytes INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique path per story
  UNIQUE(story_id, path)
);

-- ============================================================================
-- 2. AGENT MEMORY TABLE
-- ============================================================================
-- Long-term memory for LangGraph Store (cross-thread persistence)
-- Stores user preferences, patterns, and learned context

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Scope
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Namespacing (from LangGraph Store)
  namespace TEXT NOT NULL DEFAULT 'default',  -- e.g., 'preferences', 'patterns', 'character_insights'
  key TEXT NOT NULL,                          -- e.g., 'writing_style', 'correction:character_voice'
  
  -- Value
  value JSONB NOT NULL,
  
  -- Optional embedding for semantic search
  embedding vector(1536),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique key per user+namespace
  UNIQUE(user_id, namespace, key)
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Context files indexes
CREATE INDEX IF NOT EXISTS agent_context_files_story_idx 
  ON public.agent_context_files(story_id);

CREATE INDEX IF NOT EXISTS agent_context_files_user_idx 
  ON public.agent_context_files(user_id);

CREATE INDEX IF NOT EXISTS agent_context_files_path_idx 
  ON public.agent_context_files(story_id, path);

-- Memory indexes
CREATE INDEX IF NOT EXISTS agent_memory_user_idx 
  ON public.agent_memory(user_id);

CREATE INDEX IF NOT EXISTS agent_memory_namespace_idx 
  ON public.agent_memory(user_id, namespace);

CREATE INDEX IF NOT EXISTS agent_memory_key_idx 
  ON public.agent_memory(user_id, namespace, key);

-- HNSW index for semantic memory search (if embeddings are used)
CREATE INDEX IF NOT EXISTS agent_memory_embedding_idx 
  ON public.agent_memory 
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.agent_context_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

-- Context files policies
DROP POLICY IF EXISTS "Users can view own context files" ON public.agent_context_files;
CREATE POLICY "Users can view own context files"
  ON public.agent_context_files FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own context files" ON public.agent_context_files;
CREATE POLICY "Users can create own context files"
  ON public.agent_context_files FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own context files" ON public.agent_context_files;
CREATE POLICY "Users can update own context files"
  ON public.agent_context_files FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own context files" ON public.agent_context_files;
CREATE POLICY "Users can delete own context files"
  ON public.agent_context_files FOR DELETE
  USING (user_id = auth.uid());

-- Memory policies
DROP POLICY IF EXISTS "Users can view own memory" ON public.agent_memory;
CREATE POLICY "Users can view own memory"
  ON public.agent_memory FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own memory" ON public.agent_memory;
CREATE POLICY "Users can create own memory"
  ON public.agent_memory FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own memory" ON public.agent_memory;
CREATE POLICY "Users can update own memory"
  ON public.agent_memory FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own memory" ON public.agent_memory;
CREATE POLICY "Users can delete own memory"
  ON public.agent_memory FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================

-- Update updated_at timestamp for context files
DROP TRIGGER IF EXISTS update_agent_context_files_updated_at ON public.agent_context_files;
CREATE TRIGGER update_agent_context_files_updated_at
  BEFORE UPDATE ON public.agent_context_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp for memory
DROP TRIGGER IF EXISTS update_agent_memory_updated_at ON public.agent_memory;
CREATE TRIGGER update_agent_memory_updated_at
  BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to upsert a context file
CREATE OR REPLACE FUNCTION upsert_agent_context_file(
  p_story_id UUID,
  p_user_id UUID,
  p_path TEXT,
  p_content JSONB DEFAULT NULL,
  p_text_content TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_file_type TEXT;
  v_size_bytes INTEGER;
BEGIN
  -- Determine file type
  IF p_path LIKE '%.json' THEN
    v_file_type := 'json';
    v_size_bytes := COALESCE(octet_length(p_content::text), 0);
  ELSE
    v_file_type := 'text';
    v_size_bytes := COALESCE(octet_length(p_text_content), 0);
  END IF;
  
  -- Upsert the file
  INSERT INTO public.agent_context_files (
    story_id, user_id, path, content, text_content, file_type, size_bytes
  ) VALUES (
    p_story_id, p_user_id, p_path, p_content, p_text_content, v_file_type, v_size_bytes
  )
  ON CONFLICT (story_id, path) 
  DO UPDATE SET
    content = EXCLUDED.content,
    text_content = EXCLUDED.text_content,
    file_type = EXCLUDED.file_type,
    size_bytes = EXCLUDED.size_bytes,
    updated_at = NOW()
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to search memory by semantic similarity
CREATE OR REPLACE FUNCTION search_agent_memory(
  p_user_id UUID,
  p_namespace TEXT,
  p_query_embedding vector(1536),
  p_match_threshold float DEFAULT 0.7,
  p_match_count int DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  key TEXT,
  value JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    am.id,
    am.key,
    am.value,
    1 - (am.embedding <=> p_query_embedding) as similarity
  FROM public.agent_memory am
  WHERE 
    am.user_id = p_user_id
    AND am.namespace = p_namespace
    AND am.embedding IS NOT NULL
    AND 1 - (am.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY am.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- ============================================================================
-- 7. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.agent_context_files IS 'Per-story context files for Deep Agent (replaces /tmp/ storage)';
COMMENT ON TABLE public.agent_memory IS 'Long-term memory for LangGraph Store (cross-thread persistence)';

COMMENT ON COLUMN public.agent_context_files.path IS 'File path within project context (e.g., context/connected_characters.json)';
COMMENT ON COLUMN public.agent_memory.namespace IS 'Memory namespace from LangGraph Store (e.g., preferences, patterns)';
COMMENT ON COLUMN public.agent_memory.embedding IS 'Optional vector embedding for semantic memory search';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
