-- Check stories table schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stories' 
ORDER BY ordinal_position;

-- Check nodes table schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'nodes' 
ORDER BY ordinal_position;
