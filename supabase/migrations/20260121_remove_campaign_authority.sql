-- Remove Authority Integration from Campaign System
-- Date: January 21, 2026
-- Reason: Authority system is for WhatsApp-submitted moments only, not admin campaigns

-- Drop view first before removing columns it depends on
DROP VIEW IF EXISTS campaign_performance;

-- Remove authority fields from campaigns table
ALTER TABLE campaigns 
DROP COLUMN IF EXISTS created_by,
DROP COLUMN IF EXISTS authority_level,
DROP COLUMN IF EXISTS institution_name;

-- Drop authority lookup function for campaigns (no longer needed)
DROP FUNCTION IF EXISTS lookup_campaign_authority(TEXT);

-- Recreate campaign_performance view without authority fields
CREATE OR REPLACE VIEW campaign_performance AS
SELECT 
  c.id,
  c.title,
  c.status,
  c.template_name,
  c.sponsor_id,
  s.display_name as sponsor_name,
  c.budget,
  c.total_cost,
  c.broadcast_count,
  c.total_reach,
  CASE 
    WHEN c.total_cost > 0 THEN ROUND((c.total_reach::DECIMAL / c.total_cost), 2)
    ELSE 0 
  END as reach_per_rand,
  CASE 
    WHEN c.budget > 0 THEN ROUND((c.total_cost / c.budget * 100)::NUMERIC, 1)
    ELSE 0 
  END as budget_used_percent,
  COUNT(DISTINCT m.id) as moments_created,
  COUNT(DISTINCT b.id) as broadcasts_sent,
  COALESCE(SUM(b.success_count), 0) as total_success,
  COALESCE(SUM(b.failure_count), 0) as total_failures,
  CASE 
    WHEN SUM(b.recipient_count) > 0 THEN 
      ROUND((SUM(b.success_count)::DECIMAL / SUM(b.recipient_count) * 100)::NUMERIC, 1)
    ELSE 0 
  END as success_rate,
  c.created_at,
  c.updated_at
FROM campaigns c
LEFT JOIN sponsors s ON c.sponsor_id = s.id
LEFT JOIN moments m ON m.campaign_id = c.id
LEFT JOIN broadcasts b ON b.moment_id = m.id
GROUP BY c.id, c.title, c.status, c.template_name, c.sponsor_id, 
         s.display_name, c.budget, c.total_cost, c.broadcast_count, 
         c.total_reach, c.created_at, c.updated_at;

-- Remove authority_level from template_performance (campaigns don't have authority)
ALTER TABLE template_performance 
DROP COLUMN IF EXISTS authority_level;

-- Update log_template_performance function to remove authority_level parameter
CREATE OR REPLACE FUNCTION log_template_performance(
  p_template_name TEXT,
  p_campaign_id UUID,
  p_sends INTEGER,
  p_deliveries INTEGER,
  p_failures INTEGER,
  p_cost DECIMAL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO template_performance (
    template_name,
    campaign_id,
    sends,
    deliveries,
    failures,
    delivery_rate,
    avg_cost_per_send
  ) VALUES (
    p_template_name,
    p_campaign_id,
    p_sends,
    p_deliveries,
    p_failures,
    CASE WHEN p_sends > 0 THEN ROUND((p_deliveries::DECIMAL / p_sends * 100)::NUMERIC, 2) ELSE 0 END,
    CASE WHEN p_sends > 0 THEN ROUND((p_cost / p_sends)::NUMERIC, 3) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql;

-- Remove authority_context from broadcasts table (campaigns don't use authority)
ALTER TABLE broadcasts 
DROP COLUMN IF EXISTS authority_context;

-- Migration complete: Removed authority integration from campaign system
-- Authority is only for WhatsApp-submitted moments, not admin campaigns
