-- Add node types and specialized data tables

-- Update nodes table to include node_type
ALTER TABLE public.nodes 
ADD COLUMN node_type TEXT NOT NULL DEFAULT 'story';

-- Create table for story books (public domain books)
CREATE TABLE public.story_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  year INTEGER,
  description TEXT,
  gutenberg_id TEXT,
  cover_url TEXT,
  full_text_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for uploaded documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for character personas
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT NOT NULL UNIQUE REFERENCES public.nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for locations
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT NOT NULL UNIQUE REFERENCES public.nodes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for links to be scraped
CREATE TABLE public.links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  scraped_content TEXT,
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.story_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

-- RLS policies for story_books (readable by all authenticated users)
CREATE POLICY "Story books are viewable by authenticated users"
  ON public.story_books FOR SELECT
  TO authenticated
  USING (true);

-- RLS policies for documents
CREATE POLICY "Users can view documents in their own stories"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents in their own stories"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete documents in their own stories"
  ON public.documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  );

-- RLS policies for characters
CREATE POLICY "Users can manage characters in their own stories"
  ON public.characters FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  );

-- RLS policies for locations
CREATE POLICY "Users can manage locations in their own stories"
  ON public.locations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  );

-- RLS policies for links
CREATE POLICY "Users can manage links in their own stories"
  ON public.links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.nodes n
      JOIN public.stories s ON n.story_id = s.id
      WHERE n.id = node_id AND s.user_id = auth.uid()
    )
  );

-- Seed some public domain books
INSERT INTO public.story_books (title, author, year, description, gutenberg_id) VALUES
('Alice''s Adventures in Wonderland', 'Lewis Carroll', 1865, 'A young girl falls down a rabbit hole into a fantasy world populated by peculiar creatures.', '11'),
('The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 1892, 'A collection of twelve detective stories featuring the famous consulting detective.', '1661'),
('Pride and Prejudice', 'Jane Austen', 1813, 'A romantic novel following Elizabeth Bennet as she deals with issues of manners and morality.', '1342'),
('The Great Gatsby', 'F. Scott Fitzgerald', 1925, 'A tragic story of Jay Gatsby and his obsession with Daisy Buchanan.', '64317'),
('Frankenstein', 'Mary Shelley', 1818, 'A young scientist creates a grotesque creature in an unorthodox scientific experiment.', '84'),
('Dracula', 'Bram Stoker', 1897, 'An epistolary novel about the vampire Count Dracula''s attempt to move to England.', '345'),
('The Picture of Dorian Gray', 'Oscar Wilde', 1890, 'A philosophical novel about a man who sells his soul for eternal youth.', '174'),
('Moby-Dick', 'Herman Melville', 1851, 'The narrative of Captain Ahab''s obsessive quest for the white whale.', '2701'),
('The Wonderful Wizard of Oz', 'L. Frank Baum', 1900, 'A young girl is swept away to a magical land and seeks the Wizard to return home.', '55'),
('A Christmas Carol', 'Charles Dickens', 1843, 'A miser is visited by ghosts who show him his past, present, and future.', '46'),
('The Adventures of Tom Sawyer', 'Mark Twain', 1876, 'Adventures of a mischievous boy growing up along the Mississippi River.', '74'),
('Winnie-the-Pooh', 'A. A. Milne', 1926, 'Stories about a lovable bear and his friends in the Hundred Acre Wood.', '67098'),
('Peter Pan', 'J. M. Barrie', 1911, 'The adventures of the boy who wouldn''t grow up and the Darling children.', '16'),
('The Strange Case of Dr. Jekyll and Mr. Hyde', 'Robert Louis Stevenson', 1886, 'A London lawyer investigates strange occurrences involving his friend and a murderer.', '43'),
('The Time Machine', 'H. G. Wells', 1895, 'A scientist travels far into the future and witnesses the evolution of humanity.', '35');

