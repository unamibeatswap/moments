-- Add enhanced columns to existing tables
-- Run this after basic schema is deployed

-- Add enhanced columns to advisories table
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE;
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Add enhanced columns to flags table  
ALTER TABLE flags ADD COLUMN IF NOT EXISTS flagged_by TEXT;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE flags ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Add enhanced columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS flagged BOOLEAN DEFAULT FALSE;

-- Add enhanced columns to media table
ALTER TABLE media ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_advisories_reviewed ON advisories(reviewed);
CREATE INDEX IF NOT EXISTS idx_flags_resolved ON flags(resolved);
CREATE INDEX IF NOT EXISTS idx_messages_flagged ON messages(flagged);