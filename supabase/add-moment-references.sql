-- Add moment_id references after moments table exists
-- Run this after enhanced-schema.sql

-- Add moment_id to media table
ALTER TABLE media ADD COLUMN IF NOT EXISTS moment_id UUID REFERENCES moments(id) ON DELETE CASCADE;

-- Add moment_id to advisories table  
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS moment_id UUID REFERENCES moments(id) ON DELETE CASCADE;

-- Add moment_id to flags table
ALTER TABLE flags ADD COLUMN IF NOT EXISTS moment_id UUID REFERENCES moments(id) ON DELETE CASCADE;

-- Add indexes for moment_id references
CREATE INDEX IF NOT EXISTS idx_media_moment_id ON media(moment_id);
CREATE INDEX IF NOT EXISTS idx_advisories_moment_id ON advisories(moment_id);
CREATE INDEX IF NOT EXISTS idx_flags_moment_id ON flags(moment_id);