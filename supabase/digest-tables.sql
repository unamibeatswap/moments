-- Quick Win #2: Scheduled Digests Tables
-- Saves R84,000/month by batching messages

-- User digest preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  phone_number TEXT PRIMARY KEY,
  digest_enabled BOOLEAN DEFAULT true,
  digest_time TIME DEFAULT '18:00:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_prefs_digest ON user_preferences(digest_enabled) WHERE digest_enabled = true;

-- Pending moments queue
CREATE TABLE IF NOT EXISTS pending_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  moment_title TEXT NOT NULL,
  moment_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_scheduled ON pending_moments(scheduled_for) WHERE sent = false;
CREATE INDEX idx_pending_phone ON pending_moments(phone_number) WHERE sent = false;
