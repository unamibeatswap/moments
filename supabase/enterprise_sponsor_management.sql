-- ENTERPRISE SPONSOR MANAGEMENT SYSTEM
-- Tier-based pricing, performance tracking, automated billing

-- Sponsor tiers and pricing
CREATE TABLE IF NOT EXISTS sponsor_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT UNIQUE NOT NULL CHECK (tier_name IN ('bronze','silver','gold','platinum','enterprise')),
  monthly_fee DECIMAL(10,2) NOT NULL,
  message_allowance INTEGER NOT NULL,
  overage_rate DECIMAL(4,3) NOT NULL,
  priority_level INTEGER DEFAULT 1,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced sponsors with enterprise features
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze' REFERENCES sponsor_tiers(tier_name);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS monthly_budget DECIMAL(10,2) DEFAULT 1000;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS auto_billing BOOLEAN DEFAULT false;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS billing_contact TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contract_start DATE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contract_end DATE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS performance_bonus_rate DECIMAL(3,2) DEFAULT 0;

-- Sponsor performance tracking
CREATE TABLE IF NOT EXISTS sponsor_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  campaigns_run INTEGER DEFAULT 0,
  total_reach INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  cost_spent DECIMAL(10,2) DEFAULT 0,
  roi_percentage DECIMAL(5,2) DEFAULT 0,
  performance_score DECIMAL(3,2) DEFAULT 0, -- 0-100 score
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sponsor_id, period_start, period_end)
);

-- Automated billing system
CREATE TABLE IF NOT EXISTS sponsor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  base_fee DECIMAL(10,2) NOT NULL,
  message_count INTEGER DEFAULT 0,
  overage_charges DECIMAL(10,2) DEFAULT 0,
  performance_bonus DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','paid','overdue','cancelled')),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sponsor asset management
CREATE TABLE IF NOT EXISTS sponsor_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo','banner','video','audio','document')),
  asset_url TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  file_size INTEGER,
  dimensions TEXT, -- e.g., "1200x600"
  is_active BOOLEAN DEFAULT true,
  usage_rights TEXT DEFAULT 'campaign_only',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance calculation function
CREATE OR REPLACE FUNCTION calculate_sponsor_performance(p_sponsor_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS JSONB AS $$
DECLARE
  v_performance RECORD;
  v_score DECIMAL(3,2);
BEGIN
  -- Calculate performance metrics
  SELECT 
    COUNT(DISTINCT c.id) as campaigns_run,
    COALESCE(SUM(cm.impressions), 0) as total_reach,
    COALESCE(SUM(cm.clicks + cm.conversions), 0) as total_engagement,
    COALESCE(SUM(cm.conversions), 0) as conversion_count,
    COALESCE(SUM(re.revenue_amount), 0) as revenue_generated,
    COALESCE(SUM(cb.spent_amount), 0) as cost_spent
  INTO v_performance
  FROM campaigns c
  LEFT JOIN campaign_metrics cm ON cm.campaign_id = c.id
  LEFT JOIN revenue_events re ON re.campaign_id = c.id
  LEFT JOIN campaign_budgets cb ON cb.campaign_id = c.id
  WHERE c.sponsor_id = p_sponsor_id
  AND c.created_at BETWEEN p_start_date AND p_end_date;
  
  -- Calculate performance score (0-100)
  v_score := LEAST(100, GREATEST(0, 
    (v_performance.campaigns_run * 10) + 
    (CASE WHEN v_performance.cost_spent > 0 THEN 
      (v_performance.revenue_generated / v_performance.cost_spent * 20) 
     ELSE 0 END) +
    (v_performance.conversion_count * 2)
  ));
  
  -- Upsert performance record
  INSERT INTO sponsor_performance (
    sponsor_id, period_start, period_end, campaigns_run, total_reach, 
    total_engagement, conversion_count, revenue_generated, cost_spent,
    roi_percentage, performance_score
  ) VALUES (
    p_sponsor_id, p_start_date, p_end_date, v_performance.campaigns_run,
    v_performance.total_reach, v_performance.total_engagement, 
    v_performance.conversion_count, v_performance.revenue_generated,
    v_performance.cost_spent,
    CASE WHEN v_performance.cost_spent > 0 THEN 
      ((v_performance.revenue_generated - v_performance.cost_spent) / v_performance.cost_spent * 100)
    ELSE 0 END,
    v_score
  ) ON CONFLICT (sponsor_id, period_start, period_end) 
  DO UPDATE SET
    campaigns_run = EXCLUDED.campaigns_run,
    total_reach = EXCLUDED.total_reach,
    total_engagement = EXCLUDED.total_engagement,
    conversion_count = EXCLUDED.conversion_count,
    revenue_generated = EXCLUDED.revenue_generated,
    cost_spent = EXCLUDED.cost_spent,
    roi_percentage = EXCLUDED.roi_percentage,
    performance_score = EXCLUDED.performance_score;
  
  RETURN jsonb_build_object(
    'campaigns_run', v_performance.campaigns_run,
    'total_reach', v_performance.total_reach,
    'revenue_generated', v_performance.revenue_generated,
    'cost_spent', v_performance.cost_spent,
    'performance_score', v_score
  );
END;
$$ LANGUAGE plpgsql;

-- Automated billing function
CREATE OR REPLACE FUNCTION generate_sponsor_invoice(p_sponsor_id UUID, p_period_start DATE, p_period_end DATE)
RETURNS UUID AS $$
DECLARE
  v_sponsor RECORD;
  v_tier RECORD;
  v_usage RECORD;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_base_fee DECIMAL(10,2);
  v_overage_charges DECIMAL(10,2) := 0;
  v_performance_bonus DECIMAL(10,2) := 0;
  v_total_amount DECIMAL(10,2);
BEGIN
  -- Get sponsor and tier info
  SELECT s.*, st.monthly_fee, st.message_allowance, st.overage_rate, s.performance_bonus_rate
  INTO v_sponsor
  FROM sponsors s
  JOIN sponsor_tiers st ON st.tier_name = s.tier
  WHERE s.id = p_sponsor_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sponsor not found';
  END IF;
  
  -- Calculate message usage
  SELECT 
    COUNT(*) as message_count,
    COALESCE(SUM(bt.amount), 0) as total_spent
  INTO v_usage
  FROM campaigns c
  JOIN moment_intents mi ON mi.moment_id IN (
    SELECT m.id FROM moments m WHERE m.sponsor_id = c.sponsor_id
  )
  LEFT JOIN budget_transactions bt ON bt.campaign_id = c.id
  WHERE c.sponsor_id = p_sponsor_id
  AND c.created_at BETWEEN p_period_start AND p_period_end
  AND mi.status = 'sent';
  
  v_base_fee := v_sponsor.monthly_fee;
  
  -- Calculate overage charges
  IF v_usage.message_count > v_sponsor.message_allowance THEN
    v_overage_charges := (v_usage.message_count - v_sponsor.message_allowance) * v_sponsor.overage_rate;
  END IF;
  
  -- Calculate performance bonus
  IF v_sponsor.performance_bonus_rate > 0 THEN
    SELECT performance_score INTO v_performance_bonus
    FROM sponsor_performance 
    WHERE sponsor_id = p_sponsor_id 
    AND period_start = p_period_start 
    AND period_end = p_period_end;
    
    v_performance_bonus := COALESCE(v_performance_bonus * v_sponsor.performance_bonus_rate, 0);
  END IF;
  
  v_total_amount := v_base_fee + v_overage_charges + v_performance_bonus;
  
  -- Generate invoice number
  v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('invoice_sequence')::TEXT, 4, '0');
  
  -- Create invoice
  INSERT INTO sponsor_invoices (
    sponsor_id, invoice_number, billing_period_start, billing_period_end,
    base_fee, message_count, overage_charges, performance_bonus, total_amount,
    due_date
  ) VALUES (
    p_sponsor_id, v_invoice_number, p_period_start, p_period_end,
    v_base_fee, v_usage.message_count, v_overage_charges, v_performance_bonus, v_total_amount,
    p_period_end + INTERVAL '30 days'
  ) RETURNING id INTO v_invoice_id;
  
  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Create invoice sequence
CREATE SEQUENCE IF NOT EXISTS invoice_sequence START 1000;

-- Insert default sponsor tiers with realistic South African pricing
INSERT INTO sponsor_tiers (tier_name, monthly_fee, message_allowance, overage_rate, priority_level, features) VALUES
('bronze', 2500.00, 5000, 0.50, 1, '{"analytics": "basic", "support": "email", "monthly_reports": true}'),
('silver', 7500.00, 15000, 0.30, 2, '{"analytics": "advanced", "support": "priority", "custom_branding": true, "weekly_reports": true}'),
('gold', 15000.00, 40000, 0.20, 3, '{"analytics": "premium", "support": "phone", "custom_branding": true, "api_access": true, "daily_reports": true}'),
('platinum', 25000.00, 100000, 0.15, 4, '{"analytics": "enterprise", "support": "dedicated", "custom_branding": true, "api_access": true, "white_label": true, "real_time_reports": true}'),
('enterprise', 50000.00, 500000, 0.10, 5, '{"analytics": "enterprise", "support": "24_7", "custom_branding": true, "api_access": true, "white_label": true, "custom_integration": true, "unlimited_features": true}')
ON CONFLICT (tier_name) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sponsor_performance_sponsor_period ON sponsor_performance(sponsor_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sponsor_invoices_sponsor_status ON sponsor_invoices(sponsor_id, status);
CREATE INDEX IF NOT EXISTS idx_sponsor_assets_sponsor_active ON sponsor_assets(sponsor_id, is_active);

-- RLS policies
ALTER TABLE sponsor_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access tiers" ON sponsor_tiers FOR ALL USING (is_admin());
CREATE POLICY "Admin access performance" ON sponsor_performance FOR ALL USING (is_admin());
CREATE POLICY "Admin access invoices" ON sponsor_invoices FOR ALL USING (is_admin());
CREATE POLICY "Admin access assets" ON sponsor_assets FOR ALL USING (is_admin());