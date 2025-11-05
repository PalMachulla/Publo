-- Fix edges policies to properly allow inserts and updates
DROP POLICY IF EXISTS "Users can manage edges in own stories" ON public.edges;

-- Separate policies for better control
CREATE POLICY "Users can view edges from own stories"
  ON public.edges FOR SELECT
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create edges in own stories"
  ON public.edges FOR INSERT
  WITH CHECK (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update edges in own stories"
  ON public.edges FOR UPDATE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete edges from own stories"
  ON public.edges FOR DELETE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

