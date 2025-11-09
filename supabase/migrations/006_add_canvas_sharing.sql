-- Canvas Sharing System
-- This migration adds support for sharing canvases with specific users

-- Create canvas_shares table
CREATE TABLE IF NOT EXISTS public.canvas_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate shares
  UNIQUE(canvas_id, shared_with_email)
);

-- Create canvas_invites table for non-registered users
CREATE TABLE IF NOT EXISTS public.canvas_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate invites
  UNIQUE(canvas_id, email)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_canvas_shares_canvas_id ON public.canvas_shares(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_shares_user_id ON public.canvas_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_canvas_shares_email ON public.canvas_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_canvas_invites_canvas_id ON public.canvas_invites(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_invites_token ON public.canvas_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_canvas_invites_email ON public.canvas_invites(email);

-- Add updated_at trigger for canvas_shares
CREATE OR REPLACE FUNCTION public.update_canvas_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_canvas_shares_updated_at
  BEFORE UPDATE ON public.canvas_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.update_canvas_shares_updated_at();

-- Row Level Security
ALTER TABLE public.canvas_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for canvas_shares

-- Users can view shares for canvases they own
CREATE POLICY "Canvas owners can view shares"
  ON public.canvas_shares
  FOR SELECT
  USING (
    shared_by_user_id = auth.uid()
    OR shared_with_user_id = auth.uid()
  );

-- Users can insert shares for canvases they own
CREATE POLICY "Canvas owners can create shares"
  ON public.canvas_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = canvas_shares.canvas_id
      AND stories.user_id = auth.uid()
    )
  );

-- Users can delete shares for canvases they own
CREATE POLICY "Canvas owners can delete shares"
  ON public.canvas_shares
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = canvas_shares.canvas_id
      AND stories.user_id = auth.uid()
    )
  );

-- RLS Policies for canvas_invites

-- Users can view invites they created
CREATE POLICY "Users can view their invites"
  ON public.canvas_invites
  FOR SELECT
  USING (invited_by_user_id = auth.uid());

-- Users can insert invites for canvases they own
CREATE POLICY "Canvas owners can create invites"
  ON public.canvas_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = canvas_invites.canvas_id
      AND stories.user_id = auth.uid()
    )
  );

-- Users can update invites they created
CREATE POLICY "Users can update their invites"
  ON public.canvas_invites
  FOR UPDATE
  USING (invited_by_user_id = auth.uid());

-- Users can delete invites they created
CREATE POLICY "Users can delete their invites"
  ON public.canvas_invites
  FOR DELETE
  USING (invited_by_user_id = auth.uid());

-- Helper function to check if user has access to a canvas
CREATE OR REPLACE FUNCTION public.user_has_canvas_access(
  p_canvas_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- User owns the canvas
    SELECT 1 FROM public.stories
    WHERE id = p_canvas_id
    AND user_id = p_user_id
  ) OR EXISTS (
    -- Canvas is public
    SELECT 1 FROM public.stories
    WHERE id = p_canvas_id
    AND is_public = TRUE
  ) OR EXISTS (
    -- User has been granted access
    SELECT 1 FROM public.canvas_shares
    WHERE canvas_id = p_canvas_id
    AND shared_with_user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get users a canvas is shared with
CREATE OR REPLACE FUNCTION public.get_canvas_shared_users(p_canvas_id UUID)
RETURNS TABLE (
  email TEXT,
  user_id UUID,
  permission TEXT,
  accepted_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.shared_with_email,
    cs.shared_with_user_id,
    cs.permission,
    cs.accepted_at
  FROM public.canvas_shares cs
  WHERE cs.canvas_id = p_canvas_id
  ORDER BY cs.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE public.canvas_shares IS 'Tracks which users have access to shared canvases';
COMMENT ON TABLE public.canvas_invites IS 'Stores pending invitations for users not yet registered';
COMMENT ON FUNCTION public.user_has_canvas_access IS 'Checks if a user has access to view a canvas (owns it, it is public, or they have been granted access)';
COMMENT ON FUNCTION public.get_canvas_shared_users IS 'Returns list of users a canvas has been shared with';

