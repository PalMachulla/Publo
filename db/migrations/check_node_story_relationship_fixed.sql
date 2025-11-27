-- First, check if there's a story record with this ID
SELECT 
  id, 
  name, 
  format,
  CASE 
    WHEN items IS NULL THEN 'NULL'
    WHEN jsonb_array_length(items) = 0 THEN 'Empty'
    ELSE jsonb_array_length(items)::text || ' items'
  END as items_status,
  created_at
FROM stories
WHERE id = 'structure-1763794041637-rrj5hf2fn';

-- Then check the node record
SELECT 
  id as node_id,
  type as node_type,
  data->>'label' as node_label,
  data->>'format' as node_format,
  data->>'name' as node_name,
  story_id,
  created_at
FROM nodes
WHERE id = 'structure-1763794041637-rrj5hf2fn';

-- Check if node.data has items field
SELECT 
  id,
  jsonb_typeof(data->'items') as items_type,
  CASE 
    WHEN data->'items' IS NULL THEN 'NULL'
    WHEN jsonb_typeof(data->'items') = 'array' THEN jsonb_array_length(data->'items')::text || ' items'
    ELSE 'Not an array'
  END as items_in_data_status
FROM nodes
WHERE id = 'structure-1763794041637-rrj5hf2fn';
