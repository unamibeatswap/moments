-- Add logo_url column to sponsors table
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Update existing sponsors table comment
COMMENT ON COLUMN sponsors.logo_url IS 'URL to sponsor logo image stored in Supabase storage';
COMMENT ON COLUMN sponsors.website_url IS 'Sponsor website URL';