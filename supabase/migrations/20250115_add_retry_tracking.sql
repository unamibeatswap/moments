-- Add retry tracking fields to broadcast_batches table
ALTER TABLE broadcast_batches ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE broadcast_batches ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE broadcast_batches ADD COLUMN IF NOT EXISTS failed_recipients TEXT[];