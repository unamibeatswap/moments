-- Moments App Enhanced Schema

-- Sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  contact_email TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Moments table (content to be broadcasted)
CREATE TABLE IF NOT EXISTS moments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  region TEXT NOT NULL, -- KZN, WC, GP, etc.
  category TEXT NOT NULL, -- Education, Safety, Culture, Opportunity, Events
  language TEXT DEFAULT 'eng',
  sponsor_id UUID REFERENCES sponsors(id),
  is_sponsored BOOLEAN DEFAULT FALSE,
  pwa_link TEXT,
  media_urls TEXT[], -- Array of media URLs
  scheduled_at TIMESTAMPTZ,
  broadcasted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft', -- draft, scheduled, broadcasted, cancelled
  created_by TEXT, -- Admin user identifier
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Broadcast logs
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID REFERENCES moments(id),
  recipient_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  broadcast_started_at TIMESTAMPTZ DEFAULT NOW(),
  broadcast_completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' -- pending, in_progress, completed, failed
);

-- User subscriptions (opt-in/opt-out)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  opted_in BOOLEAN DEFAULT TRUE,
  regions TEXT[] DEFAULT '{}', -- Subscribed regions
  categories TEXT[] DEFAULT '{}', -- Subscribed categories
  language_preference TEXT DEFAULT 'eng',
  opted_in_at TIMESTAMPTZ DEFAULT NOW(),
  opted_out_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_moments_status ON moments(status);
CREATE INDEX IF NOT EXISTS idx_moments_scheduled ON moments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_moments_region ON moments(region);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(phone_number);
CREATE INDEX IF NOT EXISTS idx_subscriptions_opted_in ON subscriptions(opted_in);

-- RLS policies
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Insert default sponsor
INSERT INTO sponsors (name, display_name) VALUES 
('unami_foundation', 'Unami Foundation Partners')
ON CONFLICT (name) DO NOTHING;

-- Sample regions and categories
COMMENT ON COLUMN moments.region IS 'South African provinces: KZN, WC, GP, EC, FS, LP, MP, NC, NW';
COMMENT ON COLUMN moments.category IS 'Content categories: Education, Safety, Culture, Opportunity, Events, Health, Technology';