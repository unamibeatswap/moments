-- Check actual admin_roles table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'admin_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;