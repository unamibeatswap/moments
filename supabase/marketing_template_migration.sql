-- Marketing Template Migration Schema
-- Adds compliance tracking and partner attribution
-- Run after: CLEAN_SCHEMA.sql and all enhancement schemas

-- Add template_category to broadcasts table
ALTER TABLE broadcasts 
ADD COLUMN IF NOT EXISTS template_category TEXT CHECK (template_category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION'));

-- Add partner_attribution to moments table
ALTER TABLE moments 
ADD COLUMN IF NOT EXISTS partner_attribution TEXT;

-- Create marketing_compliance audit table
CREATE TABLE IF NOT EXISTS marketing_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES broadcasts(id) ON DELETE CASCADE,
  template_used TEXT NOT NULL,
  template_category TEXT NOT NULL,
  sponsor_disclosed BOOLEAN DEFAULT false,
  opt_out_included BOOLEAN DEFAULT true,
  pwa_link_included BOOLEAN DEFAULT false,
  compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
  validation_notes TEXT,
  validated_at TIMESTAMPTZ DEFAULT NOW(),
  validated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_compliance_moment ON marketing_compliance(moment_id);
CREATE INDEX IF NOT EXISTS idx_marketing_compliance_broadcast ON marketing_compliance(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_template_category ON broadcasts(template_category);

-- Update moment_intents to include compliance metadata
ALTER TABLE moment_intents 
ADD COLUMN IF NOT EXISTS compliance_validated BOOLEAN DEFAULT false;

-- Add feature flag for marketing templates
INSERT INTO feature_flags (flag_key, enabled, description, created_at)
VALUES (
  'enable_marketing_templates',
  false,
  'Enable marketing-compliant WhatsApp templates for broadcasts',
  NOW()
)
ON CONFLICT (flag_key) DO NOTHING;

-- Function to calculate compliance score
CREATE OR REPLACE FUNCTION calculate_compliance_score(
  p_sponsor_disclosed BOOLEAN,
  p_opt_out_included BOOLEAN,
  p_pwa_link_included BOOLEAN
) RETURNS INTEGER AS $$
BEGIN
  RETURN (
    CASE WHEN p_sponsor_disclosed THEN 40 ELSE 0 END +
    CASE WHEN p_opt_out_included THEN 30 ELSE 0 END +
    CASE WHEN p_pwa_link_included THEN 30 ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate compliance score
CREATE OR REPLACE FUNCTION auto_calculate_compliance_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.compliance_score := calculate_compliance_score(
    NEW.sponsor_disclosed,
    NEW.opt_out_included,
    NEW.pwa_link_included
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_compliance_score
BEFORE INSERT OR UPDATE ON marketing_compliance
FOR EACH ROW
EXECUTE FUNCTION auto_calculate_compliance_score();

-- View for compliance dashboard
CREATE OR REPLACE VIEW compliance_dashboard AS
SELECT 
  m.id as moment_id,
  m.title,
  m.is_sponsored,
  s.display_name as sponsor_name,
  mc.template_category,
  mc.compliance_score,
  mc.sponsor_disclosed,
  mc.opt_out_included,
  mc.pwa_link_included,
  mc.validated_at,
  b.status as broadcast_status,
  b.success_count,
  b.failure_count
FROM moments m
LEFT JOIN sponsors s ON m.sponsor_id = s.id
LEFT JOIN marketing_compliance mc ON m.id = mc.moment_id
LEFT JOIN broadcasts b ON mc.broadcast_id = b.id
WHERE m.status IN ('scheduled', 'broadcasted')
ORDER BY mc.validated_at DESC;

COMMENT ON TABLE marketing_compliance IS 'Audit trail for marketing template compliance per Meta requirements';
COMMENT ON COLUMN marketing_compliance.compliance_score IS 'Auto-calculated: sponsor(40) + opt_out(30) + pwa_link(30) = 100';
COMMENT ON VIEW compliance_dashboard IS 'Real-time compliance monitoring for admin dashboard';
