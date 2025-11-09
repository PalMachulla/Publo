-- Add sharing columns to stories table
-- This migration adds the is_public and shared columns needed for the canvas sharing system

-- Add columns if they don't exist
ALTER TABLE public.stories 
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.stories 
  ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for performance on public canvases
CREATE INDEX IF NOT EXISTS idx_stories_is_public ON public.stories(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_stories_shared ON public.stories(shared) WHERE shared = TRUE;

-- Update RLS policies to allow viewing public and shared canvases

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own stories" ON public.stories;

-- Recreate SELECT policy to include public and shared canvases
CREATE POLICY "Users can view accessible stories"
  ON public.stories FOR SELECT
  USING (
    -- User owns the story
    auth.uid() = user_id
    OR
    -- Story is public
    is_public = TRUE
    OR
    -- Story is shared with user
    (
      shared = TRUE
      AND EXISTS (
        SELECT 1 FROM public.canvas_shares
        WHERE canvas_shares.canvas_id = stories.id
        AND canvas_shares.shared_with_user_id = auth.uid()
      )
    )
  );

-- Comments for documentation
COMMENT ON COLUMN public.stories.is_public IS 'If true, anyone with the link can view this canvas';
COMMENT ON COLUMN public.stories.shared IS 'If true, this canvas has been shared with specific users';

