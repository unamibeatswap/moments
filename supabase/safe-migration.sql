-- Safe Database Migration - Only Add Missing Tables and Columns

-- Create sponsors table if not exists
CREATE TABLE IF NOT EXISTS sponsors (
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

-- Create moments table if not exists
CREATE TABLE IF NOT EXISTS moments (
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

-- Create broadcasts table if not exists
CREATE TABLE IF NOT EXISTS broadcasts (
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

-- Create subscriptions table if not exists
CREATE TABLE IF NOT EXISTS subscriptions (
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

-- Create system_settings table if not exists
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'text' CHECK (setting_type IN ('text','url','boolean','number','json')),
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing tables (safe operations)
DO $$ 
BEGIN
  -- Add flagged column to messages if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'flagged') THEN
    ALTER TABLE messages ADD COLUMN flagged BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add updated_at to messages if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'updated_at') THEN
    ALTER TABLE messages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors(active);
CREATE INDEX IF NOT EXISTS idx_sponsors_name ON sponsors(name);
CREATE INDEX IF NOT EXISTS idx_moments_status ON moments(status);
CREATE INDEX IF NOT EXISTS idx_moments_scheduled ON moments(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_moments_region ON moments(region);
CREATE INDEX IF NOT EXISTS idx_moments_category ON moments(category);
CREATE INDEX IF NOT EXISTS idx_moments_created_at ON moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_moment_id ON broadcasts(moment_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone_number);
CREATE INDEX IF NOT EXISTS idx_subscriptions_opted_in ON subscriptions(opted_in);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Enable RLS on new tables
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create admin function if not exists
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN true; -- Simplified for demo
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policies if not exists
DO $$
BEGIN
  -- Drop existing policies if they exist and recreate
  DROP POLICY IF EXISTS "Admin full access" ON sponsors;
  DROP POLICY IF EXISTS "Admin full access" ON moments;
  DROP POLICY IF EXISTS "Admin full access" ON broadcasts;
  DROP POLICY IF EXISTS "Admin full access" ON subscriptions;
  DROP POLICY IF EXISTS "Admin manage settings" ON system_settings;
  
  -- Create new policies
  CREATE POLICY "Admin full access" ON sponsors FOR ALL USING (is_admin());
  CREATE POLICY "Admin full access" ON moments FOR ALL USING (is_admin());
  CREATE POLICY "Admin full access" ON broadcasts FOR ALL USING (is_admin());
  CREATE POLICY "Admin full access" ON subscriptions FOR ALL USING (is_admin());
  CREATE POLICY "Admin manage settings" ON system_settings FOR ALL USING (is_admin());
END $$;

-- Insert default data if not exists
INSERT INTO sponsors (name, display_name, contact_email) 
VALUES ('unami_foundation', 'Unami Foundation Partners', 'partners@unamifoundation.org')
ON CONFLICT (name) DO NOTHING;

-- Insert default system settings if not exists
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('app_name', 'Unami Foundation Moments', 'text', 'Application name displayed in header'),
('app_logo', '/logo.png', 'url', 'Application logo URL'),
('primary_color', '#2563eb', 'text', 'Primary brand color'),
('whatsapp_number', '+27 65 829 5041', 'text', 'WhatsApp Business number'),
('support_email', 'support@unamifoundation.org', 'text', 'Support contact email'),
('max_moments_per_day', '10', 'number', 'Maximum moments that can be broadcasted per day'),
('auto_broadcast_enabled', 'true', 'boolean', 'Enable automatic scheduled broadcasting'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('analytics_enabled', 'true', 'boolean', 'Enable analytics tracking'),
('default_region', 'KZN', 'text', 'Default region for new moments')
ON CONFLICT (setting_key) DO NOTHING;

-- Create utility functions
CREATE OR REPLACE FUNCTION get_setting(key TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT setting_value INTO result FROM system_settings WHERE setting_key = key;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_setting(key TEXT, value TEXT, updated_by_user TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE system_settings 
  SET setting_value = value, updated_by = updated_by_user, updated_at = NOW()
  WHERE setting_key = key;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;