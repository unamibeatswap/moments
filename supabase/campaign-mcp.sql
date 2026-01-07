-- Campaign MCP Integration Schema
-- Run this after campaigns.sql

-- Campaign advisories table for MCP screening
CREATE TABLE IF NOT EXISTS campaign_advisories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  advisory_data JSONB NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  escalation_suggested BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for campaign advisories
CREATE INDEX IF NOT EXISTS idx_campaign_advisories_campaign_id ON campaign_advisories(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_advisories_confidence ON campaign_advisories(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_advisories_escalation ON campaign_advisories(escalation_suggested) WHERE escalation_suggested = true;

-- RLS policy for campaign advisories
ALTER TABLE campaign_advisories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin view campaign advisories" ON campaign_advisories;
CREATE POLICY "Admin view campaign advisories" ON campaign_advisories
  FOR SELECT USING (check_admin_role('moderator'));

DROP POLICY IF EXISTS "Admin manage campaign advisories" ON campaign_advisories;
CREATE POLICY "Admin manage campaign advisories" ON campaign_advisories
  FOR ALL USING (check_admin_role('content_admin'));

-- Function to get campaign risk assessment
CREATE OR REPLACE FUNCTION get_campaign_risk_assessment(p_campaign_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'campaign_id', p_campaign_id,
    'latest_confidence', COALESCE(MAX(confidence), 0.5),
    'escalation_needed', BOOL_OR(escalation_suggested),
    'advisory_count', COUNT(*),
    'last_screened', MAX(created_at)
  ) INTO result
  FROM campaign_advisories
  WHERE campaign_id = p_campaign_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE campaign_advisories IS 'MCP advisory results for campaign content screening';
COMMENT ON FUNCTION get_campaign_risk_assessment(UUID) IS 'Get risk assessment summary for a campaign';