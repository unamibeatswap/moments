-- Enhanced Campaign Revenue & Budget Management
CREATE TABLE IF NOT EXISTS campaign_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  total_budget DECIMAL(12,2) NOT NULL,
  spent_amount DECIMAL(12,2) DEFAULT 0,
  cost_per_message DECIMAL(8,4) DEFAULT 0.05,
  cost_per_engagement DECIMAL(8,4) DEFAULT 0.25,
  revenue_generated DECIMAL(12,2) DEFAULT 0,
  roi_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Performance Metrics
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  clicks_generated INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  cost_per_conversion DECIMAL(8,2) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue Tracking
CREATE TABLE IF NOT EXISTS revenue_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  sponsor_id UUID REFERENCES sponsors(id),
  event_type TEXT CHECK (event_type IN ('click', 'conversion', 'subscription', 'purchase')),
  revenue_amount DECIMAL(10,2) NOT NULL,
  user_phone TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Optimization Rules (MCP Integration)
CREATE TABLE IF NOT EXISTS campaign_optimization_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  rule_type TEXT CHECK (rule_type IN ('budget_cap', 'performance_threshold', 'audience_filter', 'time_optimization')),
  rule_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Sponsors table with logo support
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS brand_colors JSONB DEFAULT '{"primary": "#2563eb", "secondary": "#64748b"}';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS brand_guidelines TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' CHECK (tier IN ('standard', 'premium', 'enterprise'));

-- Sponsor media assets
CREATE TABLE IF NOT EXISTS sponsor_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
  asset_type TEXT CHECK (asset_type IN ('logo', 'banner', 'watermark', 'video_intro')),
  asset_url TEXT NOT NULL,
  dimensions TEXT, -- e.g., "1200x630"
  file_size INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_budgets_campaign_id ON campaign_budgets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_id ON campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_campaign_id ON revenue_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_created_at ON revenue_events(created_at);