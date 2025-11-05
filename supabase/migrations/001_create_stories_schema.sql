-- Create Stories Table
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Story',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Nodes Table
CREATE TABLE IF NOT EXISTS public.nodes (
  id TEXT PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Edges Table
CREATE TABLE IF NOT EXISTS public.edges (
  id TEXT PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT DEFAULT 'default',
  animated BOOLEAN DEFAULT false,
  style JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;

-- Stories Policies
CREATE POLICY "Users can view own stories"
  ON public.stories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own stories"
  ON public.stories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stories"
  ON public.stories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON public.stories FOR DELETE
  USING (auth.uid() = user_id);

-- Nodes Policies
CREATE POLICY "Users can view nodes from own stories"
  ON public.nodes FOR SELECT
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create nodes in own stories"
  ON public.nodes FOR INSERT
  WITH CHECK (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update nodes in own stories"
  ON public.nodes FOR UPDATE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete nodes from own stories"
  ON public.nodes FOR DELETE
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

-- Edges Policies
CREATE POLICY "Users can manage edges in own stories"
  ON public.edges FOR ALL
  USING (
    story_id IN (
      SELECT id FROM public.stories WHERE user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_story_id ON public.nodes(story_id);
CREATE INDEX IF NOT EXISTS idx_edges_story_id ON public.edges(story_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON public.nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

