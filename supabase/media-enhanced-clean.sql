-- Enhanced Media Storage Schema for Production
-- Run this after the main schema to add media-specific enhancements

-- Add missing columns to media table
ALTER TABLE media ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS whatsapp_sha256 TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS bucket_name TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0;
ALTER TABLE media ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- Add indexes for media queries
CREATE INDEX IF NOT EXISTS idx_media_content_hash ON media(content_hash);
CREATE INDEX IF NOT EXISTS idx_media_whatsapp_sha256 ON media(whatsapp_sha256);
CREATE INDEX IF NOT EXISTS idx_media_bucket_name ON media(bucket_name);
CREATE INDEX IF NOT EXISTS idx_media_processed ON media(processed);
CREATE INDEX IF NOT EXISTS idx_media_message_id ON media(message_id);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);

-- Add constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_media_file_size') THEN
    ALTER TABLE media ADD CONSTRAINT chk_media_file_size CHECK (file_size > 0 AND file_size <= 52428800);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_media_bucket_name') THEN
    ALTER TABLE media ADD CONSTRAINT chk_media_bucket_name CHECK (bucket_name IN ('images', 'audio', 'videos', 'documents'));
  END IF;
END $$;

-- Media processing queue table for async processing
CREATE TABLE IF NOT EXISTS media_processing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  whatsapp_media_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio', 'video', 'document')),
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for processing queue
CREATE INDEX IF NOT EXISTS idx_media_queue_status ON media_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_media_queue_priority ON media_processing_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_media_queue_scheduled ON media_processing_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_media_queue_message_id ON media_processing_queue(message_id);

-- Media analytics table
CREATE TABLE IF NOT EXISTS media_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE,
  media_type TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  total_files INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  successful_uploads INTEGER DEFAULT 0,
  failed_uploads INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, media_type, bucket_name)
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_media_analytics_date ON media_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_media_analytics_type ON media_analytics(media_type);

-- Update trigger for media_processing_queue
CREATE OR REPLACE FUNCTION update_media_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_media_queue_updated_at
  BEFORE UPDATE ON media_processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_media_queue_updated_at();

-- Function to clean up old media files
CREATE OR REPLACE FUNCTION cleanup_old_media(days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM media 
  WHERE created_at < NOW() - INTERVAL '1 day' * days_old
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '1 day' * (days_old / 2));
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get media storage statistics
CREATE OR REPLACE FUNCTION get_media_storage_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_files', COUNT(*),
    'total_size_mb', ROUND(SUM(file_size)::numeric / 1024 / 1024, 2),
    'by_type', (
      SELECT json_object_agg(media_type, stats)
      FROM (
        SELECT 
          media_type,
          json_build_object(
            'count', COUNT(*),
            'size_mb', ROUND(SUM(file_size)::numeric / 1024 / 1024, 2),
            'avg_size_kb', ROUND(AVG(file_size)::numeric / 1024, 2)
          ) as stats
        FROM media
        WHERE processed = true
        GROUP BY media_type
      ) t
    ),
    'by_bucket', (
      SELECT json_object_agg(bucket_name, stats)
      FROM (
        SELECT 
          bucket_name,
          json_build_object(
            'count', COUNT(*),
            'size_mb', ROUND(SUM(file_size)::numeric / 1024 / 1024, 2)
          ) as stats
        FROM media
        WHERE processed = true AND bucket_name IS NOT NULL
        GROUP BY bucket_name
      ) t
    ),
    'processing_stats', (
      SELECT json_build_object(
        'processed', COUNT(*) FILTER (WHERE processed = true),
        'failed', COUNT(*) FILTER (WHERE processed = false AND processing_error IS NOT NULL),
        'pending', COUNT(*) FILTER (WHERE processed = false AND processing_error IS NULL)
      )
      FROM media
    )
  ) INTO result
  FROM media
  WHERE processed = true;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to queue media for processing
CREATE OR REPLACE FUNCTION queue_media_processing(
  p_message_id UUID,
  p_whatsapp_media_id TEXT,
  p_media_type TEXT,
  p_priority INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
  queue_id UUID;
BEGIN
  INSERT INTO media_processing_queue (
    message_id,
    whatsapp_media_id,
    media_type,
    priority
  ) VALUES (
    p_message_id,
    p_whatsapp_media_id,
    p_media_type,
    p_priority
  )
  RETURNING id INTO queue_id;
  
  RETURN queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for media tables
ALTER TABLE media_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_analytics ENABLE ROW LEVEL SECURITY;

-- Admin access to media processing queue
CREATE POLICY "Admin manage media queue" ON media_processing_queue
  FOR ALL USING (check_admin_role('content_admin'));

-- Admin access to media analytics
CREATE POLICY "Admin view media analytics" ON media_analytics
  FOR SELECT USING (check_admin_role('moderator'));

CREATE POLICY "Admin manage media analytics" ON media_analytics
  FOR ALL USING (check_admin_role('content_admin'));

-- Comments for documentation
COMMENT ON TABLE media_processing_queue IS 'Queue for asynchronous media processing';
COMMENT ON TABLE media_analytics IS 'Daily analytics for media storage and processing';
COMMENT ON FUNCTION cleanup_old_media(INTEGER) IS 'Clean up old media files to manage storage usage';
COMMENT ON FUNCTION get_media_storage_stats() IS 'Get comprehensive media storage statistics';
COMMENT ON FUNCTION queue_media_processing(UUID, TEXT, TEXT, INTEGER) IS 'Queue media for asynchronous processing';

-- Insert initial analytics records
INSERT INTO media_analytics (date, media_type, bucket_name, total_files, total_size_bytes)
VALUES 
  (CURRENT_DATE, 'image', 'images', 0, 0),
  (CURRENT_DATE, 'audio', 'audio', 0, 0),
  (CURRENT_DATE, 'video', 'videos', 0, 0),
  (CURRENT_DATE, 'document', 'documents', 0, 0)
ON CONFLICT (date, media_type, bucket_name) DO NOTHING;