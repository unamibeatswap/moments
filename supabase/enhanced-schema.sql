-- Enhanced Moments App Schema for Frontend Integration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Sponsors table (enhanced)
CREATE TABLE sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  contact_email TEXT,
  logo_url TEXT,
  website_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moments table (enhanced with constraints)
CREATE TABLE moments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) >= 3 AND length(title) <= 200),
  content TEXT NOT NULL CHECK (length(content) >= 10 AND length(content) <= 2000),
  region TEXT NOT NULL CHECK (region IN ('KZN','WC','GP','EC','FS','LP','MP','NC','NW')),
  category TEXT NOT NULL CHECK (category IN ('Education','Safety','Culture','Opportunity','Events','Health','Technology')),
  language TEXT DEFAULT 'eng',
  sponsor_id UUID REFERENCES sponsors(id),
  is_sponsored BOOLEAN DEFAULT FALSE,
  pwa_link TEXT,
  media_urls TEXT[],
  scheduled_at TIMESTAMPTZ,
  broadcasted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','broadcasted','cancelled')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcasts table (enhanced)
CREATE TABLE broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  recipient_count INTEGER DEFAULT 0 CHECK (recipient_count >= 0),
  success_count INTEGER DEFAULT 0 CHECK (success_count >= 0),
  failure_count INTEGER DEFAULT 0 CHECK (failure_count >= 0),
  broadcast_started_at TIMESTAMPTZ DEFAULT NOW(),
  broadcast_completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions table (enhanced)
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL CHECK (phone_number ~ '^\+[1-9]\d{1,14}$'),
  opted_in BOOLEAN DEFAULT TRUE,
  regions TEXT[] DEFAULT ARRAY['KZN','WC','GP'],
  categories TEXT[] DEFAULT ARRAY['Education','Safety','Opportunity'],
  language_preference TEXT DEFAULT 'eng',
  opted_in_at TIMESTAMPTZ DEFAULT NOW(),
  opted_out_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table (enhanced)
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_id TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text','image','audio','video','document')),
  content TEXT,
  media_url TEXT,
  media_id TEXT,
  language_detected TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Media table (enhanced)
CREATE TABLE media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  whatsapp_media_id TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','audio','video','document')),
  original_url TEXT,
  storage_path TEXT,
  file_size BIGINT CHECK (file_size > 0),
  mime_type TEXT,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advisories table (enhanced)
CREATE TABLE advisories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  advisory_type TEXT NOT NULL CHECK (advisory_type IN ('language','urgency','harm','spam','content_quality')),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  details JSONB,
  escalation_suggested BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flags table (enhanced)
CREATE TABLE flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  action_taken TEXT CHECK (action_taken IN ('logged','warned','escalated','blocked')),
  notes TEXT,
  flagged_by TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comprehensive Indexes
CREATE INDEX idx_sponsors_active ON sponsors(active);
CREATE INDEX idx_sponsors_name ON sponsors(name);

CREATE INDEX idx_moments_status ON moments(status);
CREATE INDEX idx_moments_scheduled ON moments(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_moments_region ON moments(region);
CREATE INDEX idx_moments_category ON moments(category);
CREATE INDEX idx_moments_created_at ON moments(created_at DESC);
CREATE INDEX idx_moments_sponsor ON moments(sponsor_id);

CREATE INDEX idx_broadcasts_moment_id ON broadcasts(moment_id);
CREATE INDEX idx_broadcasts_status ON broadcasts(status);
CREATE INDEX idx_broadcasts_started_at ON broadcasts(broadcast_started_at DESC);

CREATE INDEX idx_subscriptions_phone ON subscriptions(phone_number);
CREATE INDEX idx_subscriptions_opted_in ON subscriptions(opted_in);
CREATE INDEX idx_subscriptions_regions ON subscriptions USING GIN(regions);
CREATE INDEX idx_subscriptions_last_activity ON subscriptions(last_activity DESC);

CREATE INDEX idx_messages_from_number ON messages(from_number);
CREATE INDEX idx_messages_processed ON messages(processed);
CREATE INDEX idx_messages_flagged ON messages(flagged);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);

CREATE INDEX idx_advisories_message_id ON advisories(message_id);
CREATE INDEX idx_advisories_moment_id ON advisories(moment_id);
CREATE INDEX idx_advisories_type ON advisories(advisory_type);
CREATE INDEX idx_advisories_escalation ON advisories(escalation_suggested);
CREATE INDEX idx_advisories_reviewed ON advisories(reviewed);

CREATE INDEX idx_flags_message_id ON flags(message_id);
CREATE INDEX idx_flags_moment_id ON flags(moment_id);
CREATE INDEX idx_flags_severity ON flags(severity);
CREATE INDEX idx_flags_resolved ON flags(resolved);

-- RLS Policies
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisories ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

-- Admin access function (simplified for demo)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN true; -- In production, check JWT claims
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin policies
CREATE POLICY "Admin full access" ON sponsors FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON moments FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON broadcasts FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON subscriptions FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON messages FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON media FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON advisories FOR ALL USING (is_admin());
CREATE POLICY "Admin full access" ON flags FOR ALL USING (is_admin());

-- Public read policies
CREATE POLICY "Public read published moments" ON moments FOR SELECT USING (status = 'broadcasted');
CREATE POLICY "Public read active sponsors" ON sponsors FOR SELECT USING (active = true);

-- Database Functions
CREATE OR REPLACE FUNCTION get_dashboard_analytics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_moments', (SELECT COUNT(*) FROM moments),
    'active_subscribers', (SELECT COUNT(*) FROM subscriptions WHERE opted_in = true),
    'total_broadcasts', (SELECT COUNT(*) FROM broadcasts WHERE status = 'completed'),
    'avg_success_rate', (
      SELECT ROUND(AVG(success_count::float / NULLIF(recipient_count, 0)) * 100, 1)
      FROM broadcasts WHERE status = 'completed'
    ),
    'pending_moderation', (
      SELECT COUNT(*) FROM advisories WHERE escalation_suggested = true AND reviewed = false
    ),
    'regions_breakdown', (
      SELECT json_object_agg(region, count)
      FROM (
        SELECT region, COUNT(*) as count
        FROM moments
        WHERE status = 'broadcasted'
        GROUP BY region
      ) t
    ),
    'categories_breakdown', (
      SELECT json_object_agg(category, count)
      FROM (
        SELECT category, COUNT(*) as count
        FROM moments
        WHERE status = 'broadcasted'
        GROUP BY category
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_broadcast_targets(
  target_regions TEXT[],
  target_categories TEXT[]
)
RETURNS TABLE(phone_number TEXT, regions TEXT[], categories TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT s.phone_number, s.regions, s.categories
  FROM subscriptions s
  WHERE s.opted_in = true
    AND (target_regions <@ s.regions OR s.regions = '{}')
    AND (target_categories <@ s.categories OR s.categories = '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger functions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update triggers
CREATE TRIGGER update_sponsors_updated_at BEFORE UPDATE ON sponsors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_moments_updated_at BEFORE UPDATE ON moments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- MCP Advisory trigger
CREATE OR REPLACE FUNCTION trigger_mcp_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- In production, this would call the MCP API
  INSERT INTO advisories (moment_id, advisory_type, confidence, details)
  VALUES (NEW.id, 'content_quality', 0.8, '{"status": "pending_analysis"}'::jsonb);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER moments_mcp_analysis
  AFTER INSERT ON moments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mcp_analysis();

-- Realtime setup
ALTER PUBLICATION supabase_realtime ADD TABLE moments;
ALTER PUBLICATION supabase_realtime ADD TABLE broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE advisories;

-- Insert default data
INSERT INTO sponsors (name, display_name, contact_email) VALUES 
('unami_foundation', 'Unami Foundation Partners', 'partners@unamifoundation.org'),
('local_business', 'Local Business Network', 'info@localbusiness.co.za');

-- Sample data for testing
INSERT INTO moments (title, content, region, category, sponsor_id, is_sponsored) VALUES
('Community Garden Project', 'New community garden opening in Durban. Join us for the launch event this Saturday!', 'KZN', 'Culture', (SELECT id FROM sponsors WHERE name = 'unami_foundation'), true),
('Safety Workshop', 'Free personal safety workshop for women. Learn self-defense and safety awareness.', 'WC', 'Safety', NULL, false);

COMMENT ON TABLE moments IS 'Core content for WhatsApp broadcasts';
COMMENT ON TABLE sponsors IS 'Sponsor information and branding';
COMMENT ON TABLE broadcasts IS 'Broadcast execution tracking';
COMMENT ON TABLE subscriptions IS 'User subscription preferences';
COMMENT ON COLUMN moments.region IS 'South African provinces: KZN, WC, GP, EC, FS, LP, MP, NC, NW';
COMMENT ON COLUMN moments.category IS 'Content categories: Education, Safety, Culture, Opportunity, Events, Health, Technology';