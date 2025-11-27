-- Check how the Report node relates to stories table
SELECT 
  n.id as node_id,
  n.type as node_type,
  n.data->>'label' as node_label,
  n.data->>'format' as node_format,
  n.data->>'structureId' as structure_id_in_data,
  n.story_id,
  s.id as story_id_from_stories,
  s.name as story_name,
  s.format as story_format,
  CASE 
    WHEN s.items IS NULL THEN 'NULL'
    WHEN jsonb_array_length(s.items) = 0 THEN 'Empty'
    ELSE jsonb_array_length(s.items)::text || ' items'
  END as story_items_status
FROM nodes n
LEFT JOIN stories s ON s.id = n.id  -- Try joining by ID
WHERE n.id = 'structure-1763794041637-rrj5hf2fn';

-- Also check if there's a story with matching ID
SELECT id, name, format,
  CASE 
    WHEN items IS NULL THEN 'NULL'
    WHEN jsonb_array_length(items) = 0 THEN 'Empty'
    ELSE jsonb_array_length(items)::text || ' items'
  END as items_status
FROM stories
WHERE id = 'structure-1763794041637-rrj5hf2fn';
