-- Check the Report node structure in database
SELECT 
  id,
  name,
  format,
  CASE 
    WHEN items IS NULL THEN 'NULL'
    WHEN jsonb_array_length(items) = 0 THEN 'Empty array'
    ELSE jsonb_array_length(items)::text || ' items'
  END as items_status,
  CASE 
    WHEN content_map IS NULL THEN 'NULL'
    WHEN jsonb_typeof(content_map) = 'object' THEN jsonb_object_keys(content_map)::text
    ELSE 'Not an object'
  END as content_map_status,
  created_at,
  updated_at
FROM stories
WHERE id = 'structure-1763794041637-rrj5hf2fn';

-- If items exist, show first 3
SELECT 
  elem->>'id' as section_id,
  elem->>'name' as section_name,
  elem->>'level' as level
FROM stories,
     jsonb_array_elements(items) as elem
WHERE id = 'structure-1763794041637-rrj5hf2fn'
LIMIT 3;
