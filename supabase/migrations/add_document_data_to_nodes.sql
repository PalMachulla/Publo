-- Add document_data column to nodes table for hierarchical document storage
-- This replaces the flat document_sections table approach

-- Add the JSONB column to store hierarchical document data
ALTER TABLE nodes
ADD COLUMN IF NOT EXISTS document_data JSONB DEFAULT NULL;

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_nodes_document_data_gin ON nodes USING gin (document_data);

-- Create index for document version queries
CREATE INDEX IF NOT EXISTS idx_nodes_document_data_version ON nodes ((document_data->>'version'));

-- Add comment explaining the schema
COMMENT ON COLUMN nodes.document_data IS 'Hierarchical document structure stored as JSONB. Schema defined in frontend/src/types/document-hierarchy.ts';

-- Migration helper function: Convert existing document_sections to hierarchical format
-- This function can be called to migrate existing documents
CREATE OR REPLACE FUNCTION migrate_document_sections_to_hierarchy(node_id UUID)
RETURNS JSONB AS $$
DECLARE
  document_json JSONB;
  structure_items JSONB;
BEGIN
  -- Get the structure items from the node
  SELECT data->'structureItems' INTO structure_items
  FROM nodes
  WHERE id = node_id;
  
  -- If no structure items, return NULL
  IF structure_items IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Build the hierarchical document structure
  -- This is a placeholder - actual migration logic would need to recursively build the tree
  document_json := jsonb_build_object(
    'version', 1,
    'format', COALESCE((SELECT data->>'format' FROM nodes WHERE id = node_id), 'novel'),
    'structure', structure_items, -- TODO: Transform flat to hierarchical
    'fullDocument', '',
    'fullDocumentUpdatedAt', NOW()::text,
    'totalWordCount', 0,
    'completionPercentage', 0,
    'lastEditedAt', NOW()::text
  );
  
  RETURN document_json;
END;
$$ LANGUAGE plpgsql;

-- Example usage (commented out - run manually when ready to migrate):
-- UPDATE nodes 
-- SET document_data = migrate_document_sections_to_hierarchy(id)
-- WHERE type = 'storyStructureNode' AND document_data IS NULL;

-- Function to update word count automatically
CREATE OR REPLACE FUNCTION update_document_word_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When document_data is updated, recalculate totalWordCount
  -- This is a simplified version - real implementation would traverse the tree
  IF NEW.document_data IS NOT NULL THEN
    NEW.document_data := jsonb_set(
      NEW.document_data,
      '{lastEditedAt}',
      to_jsonb(NOW()::text)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic word count updates
DROP TRIGGER IF EXISTS trigger_update_document_word_count ON nodes;
CREATE TRIGGER trigger_update_document_word_count
  BEFORE UPDATE OF document_data ON nodes
  FOR EACH ROW
  WHEN (OLD.document_data IS DISTINCT FROM NEW.document_data)
  EXECUTE FUNCTION update_document_word_count();

-- Add RLS policies for document_data access
-- Users can only access document_data for nodes in their own stories
CREATE POLICY "Users can read document_data for their own stories" ON nodes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = nodes.story_id
      AND stories.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update document_data for their own stories" ON nodes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = nodes.story_id
      AND stories.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = nodes.story_id
      AND stories.user_id = auth.uid()
    )
  );

