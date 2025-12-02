-- Migration: Correction Learning System
-- Creates table and RPC function for storing and retrieving user correction patterns
-- Uses vector embeddings for semantic similarity search

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create correction_patterns table
CREATE TABLE IF NOT EXISTS correction_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Original context
  original_message TEXT NOT NULL,
  original_message_embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  
  -- Correction details
  wrong_intent TEXT NOT NULL,
  correct_intent TEXT NOT NULL,
  correction_message TEXT, -- User's correction message (e.g., "I wanted open, not create")
  
  -- Context when correction happened
  canvas_nodes JSONB, -- Array of node labels that existed
  document_panel_open BOOLEAN,
  previous_intent TEXT,
  
  -- Learning metrics
  success_rate NUMERIC DEFAULT 1.0 CHECK (success_rate >= 0 AND success_rate <= 1),
  times_applied INTEGER DEFAULT 0,
  times_successful INTEGER DEFAULT 0,
  
  -- Metadata
  namespace TEXT DEFAULT 'intent_correction',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_applied_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_success_rate CHECK (times_successful <= times_applied)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_correction_patterns_user_id 
  ON correction_patterns (user_id, namespace);

CREATE INDEX IF NOT EXISTS idx_correction_patterns_created_at 
  ON correction_patterns (created_at DESC);

-- Vector similarity search index (IVFFlat for fast approximate search)
-- Note: This index requires at least some data to be effective
-- You may need to run: CREATE INDEX after inserting some records
CREATE INDEX IF NOT EXISTS idx_correction_patterns_embedding 
  ON correction_patterns 
  USING ivfflat (original_message_embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS (Row Level Security) policies
ALTER TABLE correction_patterns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own correction patterns
CREATE POLICY "Users can view their own correction patterns"
  ON correction_patterns
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own correction patterns
CREATE POLICY "Users can insert their own correction patterns"
  ON correction_patterns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own correction patterns
CREATE POLICY "Users can update their own correction patterns"
  ON correction_patterns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own correction patterns
CREATE POLICY "Users can delete their own correction patterns"
  ON correction_patterns
  FOR DELETE
  USING (auth.uid() = user_id);

-- RPC Function: Search correction patterns by semantic similarity
CREATE OR REPLACE FUNCTION search_correction_patterns(
  query_embedding vector(1536),
  user_id UUID,
  match_threshold NUMERIC DEFAULT 0.75,
  match_count INTEGER DEFAULT 5,
  min_success_rate NUMERIC DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  original_message TEXT,
  wrong_intent TEXT,
  correct_intent TEXT,
  correction_message TEXT,
  canvas_nodes JSONB,
  document_panel_open BOOLEAN,
  previous_intent TEXT,
  success_rate NUMERIC,
  times_applied INTEGER,
  times_successful INTEGER,
  similarity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.original_message,
    cp.wrong_intent,
    cp.correct_intent,
    cp.correction_message,
    cp.canvas_nodes,
    cp.document_panel_open,
    cp.previous_intent,
    cp.success_rate,
    cp.times_applied,
    cp.times_successful,
    -- Calculate cosine similarity (1 - distance)
    -- Higher similarity = more similar (range: 0-1)
    1 - (cp.original_message_embedding <=> query_embedding) AS similarity
  FROM correction_patterns cp
  WHERE cp.user_id = search_correction_patterns.user_id
    AND cp.original_message_embedding IS NOT NULL
    AND cp.success_rate >= min_success_rate
    -- Filter by similarity threshold
    AND 1 - (cp.original_message_embedding <=> query_embedding) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION search_correction_patterns TO authenticated;

-- Add helpful comment
COMMENT ON TABLE correction_patterns IS 'Stores user correction patterns for intent classification learning. Uses vector embeddings for semantic similarity search.';
COMMENT ON FUNCTION search_correction_patterns IS 'Searches for similar correction patterns using cosine similarity on vector embeddings. Returns patterns above match_threshold similarity and min_success_rate.';

