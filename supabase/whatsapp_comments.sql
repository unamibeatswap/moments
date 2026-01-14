-- WHATSAPP COMMENTS INTEGRATION
-- Reply to moments via WhatsApp, notifications, voice notes

-- WhatsApp comment mappings
CREATE TABLE IF NOT EXISTS whatsapp_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_message_id TEXT UNIQUE NOT NULL,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  reply_to_message_id TEXT,
  media_type TEXT CHECK (media_type IN ('text','voice','image','video')),
  transcription TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_comments_number ON whatsapp_comments(from_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_comments_moment ON whatsapp_comments(moment_id);

-- Notification queue
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_params JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status, created_at);

-- RLS
ALTER TABLE whatsapp_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access" ON whatsapp_comments FOR ALL USING (is_admin());
CREATE POLICY "Admin access" ON notification_queue FOR ALL USING (is_admin());

-- Trigger: Send notification when comment approved
CREATE OR REPLACE FUNCTION notify_comment_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.moderation_status = 'approved' AND OLD.moderation_status = 'pending' THEN
    INSERT INTO notification_queue (phone_number, template_name, template_params)
    VALUES (NEW.from_number, 'comment_approved', jsonb_build_object('moment_id', NEW.moment_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_approved_notification 
AFTER UPDATE ON comments 
FOR EACH ROW EXECUTE FUNCTION notify_comment_approved();
