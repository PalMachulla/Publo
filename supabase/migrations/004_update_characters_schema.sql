-- Restructure characters table to be standalone (not node-based)
-- Drop the old node_id based structure and create a user-based one

-- First, drop existing policies
DROP POLICY IF EXISTS "Users can manage characters in their own stories" ON public.characters;

-- Drop the old table (we're restructuring completely)
DROP TABLE IF EXISTS public.characters CASCADE;

-- Recreate characters table as a standalone entity
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Unnamed Character',
  bio TEXT,
  photo_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  role TEXT,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for characters table

-- Policy: Users can view their own characters, shared characters, and public characters
CREATE POLICY "Users can view accessible characters" ON public.characters
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    visibility = 'public' OR
    visibility = 'shared'
  );

-- Policy: Users can insert their own characters
CREATE POLICY "Users can insert own characters" ON public.characters
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own characters
CREATE POLICY "Users can update own characters" ON public.characters
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own characters
CREATE POLICY "Users can delete own characters" ON public.characters
  FOR DELETE
  USING (user_id = auth.uid());

-- Add index for faster character searches
CREATE INDEX IF NOT EXISTS characters_user_id_idx ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS characters_visibility_idx ON public.characters(visibility);
CREATE INDEX IF NOT EXISTS characters_name_idx ON public.characters(name);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_characters_updated_at ON public.characters;
CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON public.characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

