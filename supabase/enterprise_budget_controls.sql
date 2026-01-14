-- ENTERPRISE BUDGET CONTROL SYSTEM
-- Real-time budget tracking and automated campaign management

-- Campaign budget management
CREATE TABLE IF NOT EXISTS campaign_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  total_budget DECIMAL(10,2) NOT NULL CHECK (total_budget > 0),
  spent_amount DECIMAL(10,2) DEFAULT 0 CHECK (spent_amount >= 0),
  daily_limit DECIMAL(10,2) CHECK (daily_limit > 0),
  cost_per_message DECIMAL(4,3) DEFAULT 0.05,
  auto_pause_at_limit BOOLEAN DEFAULT true,
  budget_alerts_at DECIMAL(3,2)[] DEFAULT ARRAY[0.5, 0.8, 0.95], -- Alert at 50%, 80%, 95%
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget transaction log
CREATE TABLE IF NOT EXISTS budget_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('spend','refund','adjustment','allocation')),
  amount DECIMAL(10,2) NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  cost_per_recipient DECIMAL(4,3),
  description TEXT,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue tracking and attribution
CREATE TABLE IF NOT EXISTS revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id),
  sponsor_id UUID REFERENCES sponsors(id),
  revenue_type TEXT NOT NULL CHECK (revenue_type IN ('sponsorship','partnership','grant','conversion')),
  revenue_amount DECIMAL(10,2) NOT NULL CHECK (revenue_amount > 0),
  attribution_method TEXT DEFAULT 'direct',
  conversion_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign performance metrics
CREATE TABLE IF NOT EXISTS campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  metric_date DATE DEFAULT CURRENT_DATE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cost_spent DECIMAL(10,2) DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,4) DEFAULT 0, -- Click-through rate
  conversion_rate DECIMAL(5,4) DEFAULT 0,
  cpa DECIMAL(10,2) DEFAULT 0, -- Cost per acquisition
  roas DECIMAL(5,2) DEFAULT 0, -- Return on ad spend
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, metric_date)
);

-- Automated budget control function
CREATE OR REPLACE FUNCTION check_campaign_budget(p_campaign_id UUID, p_spend_amount DECIMAL)
RETURNS JSONB AS $$
DECLARE
  v_budget RECORD;
  v_new_spent DECIMAL;
  v_budget_percentage DECIMAL;
  v_result JSONB;
BEGIN
  -- Get current budget info
  SELECT * INTO v_budget 
  FROM campaign_budgets 
  WHERE campaign_id = p_campaign_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'No budget allocated');
  END IF;
  
  v_new_spent := v_budget.spent_amount + p_spend_amount;
  v_budget_percentage := v_new_spent / v_budget.total_budget;
  
  -- Check if spend would exceed budget
  IF v_new_spent > v_budget.total_budget THEN
    IF v_budget.auto_pause_at_limit THEN
      -- Auto-pause campaign
      UPDATE campaigns SET status = 'paused' WHERE id = p_campaign_id;
      
      RETURN jsonb_build_object(
        'allowed', false, 
        'reason', 'Budget exceeded - campaign auto-paused',
        'budget_used', v_budget_percentage * 100,
        'action', 'paused'
      );
    ELSE
      RETURN jsonb_build_object(
        'allowed', false, 
        'reason', 'Budget exceeded',
        'budget_used', v_budget_percentage * 100
      );
    END IF;
  END IF;
  
  -- Check daily limit
  IF v_budget.daily_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_new_spent
    FROM budget_transactions 
    WHERE campaign_id = p_campaign_id 
    AND DATE(created_at) = CURRENT_DATE
    AND transaction_type = 'spend';
    
    IF v_new_spent + p_spend_amount > v_budget.daily_limit THEN
      RETURN jsonb_build_object(
        'allowed', false, 
        'reason', 'Daily limit exceeded',
        'daily_spent', v_new_spent,
        'daily_limit', v_budget.daily_limit
      );
    END IF;
  END IF;
  
  -- Check for budget alerts
  IF v_budget_percentage >= ANY(v_budget.budget_alerts_at) THEN
    -- Insert alert notification
    INSERT INTO notifications (
      user_phone, 
      notification_type, 
      title, 
      message, 
      related_id
    ) VALUES (
      'admin', 
      'budget_alert', 
      'Campaign Budget Alert',
      format('Campaign %s has used %s%% of budget', 
        (SELECT title FROM campaigns WHERE id = p_campaign_id),
        ROUND(v_budget_percentage * 100, 1)
      ),
      p_campaign_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'budget_used', v_budget_percentage * 100,
    'remaining_budget', v_budget.total_budget - v_new_spent
  );
END;
$$ LANGUAGE plpgsql;

-- ROI calculation view
CREATE OR REPLACE VIEW campaign_roi_analysis AS
SELECT 
  c.id,
  c.title,
  c.status,
  cb.total_budget,
  cb.spent_amount,
  COALESCE(SUM(re.revenue_amount), 0) as revenue_generated,
  CASE 
    WHEN cb.spent_amount > 0 THEN 
      ROUND(((COALESCE(SUM(re.revenue_amount), 0) - cb.spent_amount) / cb.spent_amount * 100)::numeric, 2)
    ELSE 0 
  END as roi_percentage,
  CASE 
    WHEN cb.spent_amount > 0 THEN 
      ROUND((COALESCE(SUM(re.revenue_amount), 0) / cb.spent_amount)::numeric, 2)
    ELSE 0 
  END as roas,
  ROUND((cb.spent_amount / NULLIF(cb.total_budget, 0) * 100)::numeric, 2) as budget_utilization,
  COUNT(DISTINCT bt.id) as transaction_count,
  MAX(cm.conversion_rate) as best_conversion_rate,
  AVG(cm.ctr) as avg_ctr
FROM campaigns c
LEFT JOIN campaign_budgets cb ON cb.campaign_id = c.id
LEFT JOIN revenue_events re ON re.campaign_id = c.id
LEFT JOIN budget_transactions bt ON bt.campaign_id = c.id AND bt.transaction_type = 'spend'
LEFT JOIN campaign_metrics cm ON cm.campaign_id = c.id
GROUP BY c.id, c.title, c.status, cb.total_budget, cb.spent_amount;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_budgets_campaign ON campaign_budgets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_campaign_date ON budget_transactions(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_events_campaign ON revenue_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign_date ON campaign_metrics(campaign_id, metric_date DESC);

-- RLS policies
ALTER TABLE campaign_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin access budgets" ON campaign_budgets FOR ALL USING (is_admin());
CREATE POLICY "Admin access transactions" ON budget_transactions FOR ALL USING (is_admin());
CREATE POLICY "Admin access revenue" ON revenue_events FOR ALL USING (is_admin());
CREATE POLICY "Admin access metrics" ON campaign_metrics FOR ALL USING (is_admin());