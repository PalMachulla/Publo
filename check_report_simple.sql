-- Check if there's a story record with this ID
SELECT 
  id, 
  title,
  format,
  CASE 
    WHEN items IS NULL THEN 'NULL'
    WHEN jsonb_array_length(items) = 0 THEN 'Empty'
    ELSE jsonb_array_length(items)::text || ' items'
  END as items_status,
  created_at
FROM stories
WHERE id = 'structure-1763794041637-rrj5hf2fn';

-- Check the node record
SELECT 
  id as node_id,
  type as node_type,
  data->>'label' as node_label,
  data->>'format' as node_format,
  story_id,
  created_at
FROM nodes
WHERE id = 'structure-1763794041637-rrj5hf2fn';

-- Check if node.data has items field
SELECT 
  id,
  data->>'label' as label,
  jsonb_typeof(data->'items') as items_type_in_data,
  jsonb_typeof(data->'structureItems') as structureItems_type_in_data,
  CASE 
    WHEN data->'items' IS NULL THEN 'items: NULL'
    WHEN jsonb_typeof(data->'items') = 'array' THEN 'items: ' || jsonb_array_length(data->'items')::text || ' items'
    ELSE 'items: Not an array'
  END as items_status,
  CASE 
    WHEN data->'structureItems' IS NULL THEN 'structureItems: NULL'
    WHEN jsonb_typeof(data->'structureItems') = 'array' THEN 'structureItems: ' || jsonb_array_length(data->'structureItems')::text || ' items'
    ELSE 'structureItems: Not an array'
  END as structureItems_status
FROM nodes
WHERE id = 'structure-1763794041637-rrj5hf2fn';
