-- Migration: Add moderation support
-- File: supabase/migrations/20250111_add_moderation_support.sql

-- Add moderation status to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create moderation audit table
CREATE TABLE IF NOT EXISTS moderation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'flagged', 'rejected')),
  moderator TEXT NOT NULL,
  reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_moderation_status ON messages(moderation_status);
CREATE INDEX IF NOT EXISTS idx_messages_updated_at ON messages(updated_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_opted_in ON subscriptions(opted_in);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_message_id ON moderation_audit(message_id);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_timestamp ON moderation_audit(timestamp);

-- Update existing messages to have pending status
UPDATE messages 
SET moderation_status = 'pending' 
WHERE moderation_status IS NULL;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_messages_updated_at 
    BEFORE UPDATE ON messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();