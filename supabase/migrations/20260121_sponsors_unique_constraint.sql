-- Add unique constraint to sponsors table to prevent duplicates
-- Date: January 21, 2026

-- First, identify and remove duplicate sponsors (keep the oldest one)
DELETE FROM sponsors a USING sponsors b
WHERE a.id > b.id 
  AND LOWER(TRIM(a.name)) = LOWER(TRIM(b.name));

-- Add unique constraint on name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS sponsors_name_unique 
ON sponsors (LOWER(TRIM(name)));

-- Add comment
COMMENT ON INDEX sponsors_name_unique IS 'Prevents duplicate sponsor names (case-insensitive)';
