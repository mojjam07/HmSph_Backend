-- Check if Review table exists
SELECT 
    table_name,
    'Table exists' as status
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'Review';

-- Check Review table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'Review'
ORDER BY ordinal_position;

-- Check if there are any records in Review table
SELECT COUNT(*) as total_reviews FROM "Review";
