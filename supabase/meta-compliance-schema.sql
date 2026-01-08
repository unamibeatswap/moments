-- Meta WhatsApp Business API Compliance Categories
-- This defines allowed and restricted campaign types to prevent account suspension

-- Campaign compliance categories
CREATE TABLE IF NOT EXISTS campaign_compliance_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_name TEXT UNIQUE NOT NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('ALLOWED', 'RESTRICTED', 'PROHIBITED')),
    description TEXT NOT NULL,
    meta_policy_reference TEXT,
    risk_level TEXT CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    requires_approval BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Meta-compliant categories
INSERT INTO campaign_compliance_categories (category_name, category_type, description, risk_level, requires_approval) VALUES

-- ALLOWED CATEGORIES (Safe for campaigns)
('Community Education', 'ALLOWED', 'Educational content about community services, skills development, literacy programs', 'LOW', FALSE),
('Safety Awareness', 'ALLOWED', 'Public safety information, emergency preparedness, community safety tips', 'LOW', FALSE),
('Cultural Events', 'ALLOWED', 'Community cultural celebrations, heritage events, local festivals', 'LOW', FALSE),
('Job Opportunities', 'ALLOWED', 'Legitimate job postings, skills training, employment opportunities', 'LOW', FALSE),
('Health Information', 'ALLOWED', 'General health awareness, clinic information, vaccination drives (non-medical advice)', 'MEDIUM', TRUE),
('Local Services', 'ALLOWED', 'Community services, local business information, municipal services', 'LOW', FALSE),
('Environmental Initiatives', 'ALLOWED', 'Environmental awareness, recycling programs, conservation efforts', 'LOW', FALSE),
('Youth Programs', 'ALLOWED', 'Youth development, sports programs, educational initiatives for young people', 'LOW', FALSE),

-- RESTRICTED CATEGORIES (Require careful handling)
('Government Services', 'RESTRICTED', 'Government program information - must be factual and non-political', 'MEDIUM', TRUE),
('Financial Literacy', 'RESTRICTED', 'Basic financial education - no investment advice or financial products', 'MEDIUM', TRUE),
('Healthcare Services', 'RESTRICTED', 'Healthcare facility information - no medical advice or treatment claims', 'MEDIUM', TRUE),
('Religious Events', 'RESTRICTED', 'Interfaith community events - must be inclusive and non-discriminatory', 'MEDIUM', TRUE),

-- PROHIBITED CATEGORIES (Will cause account suspension)
('Political Campaigns', 'PROHIBITED', 'Political party promotion, candidate endorsements, political messaging', 'CRITICAL', FALSE),
('Financial Products', 'PROHIBITED', 'Loans, investments, cryptocurrency, get-rich-quick schemes', 'CRITICAL', FALSE),
('Medical Treatments', 'PROHIBITED', 'Medical advice, treatment recommendations, health product sales', 'CRITICAL', FALSE),
('Adult Content', 'PROHIBITED', 'Adult services, dating, mature content', 'CRITICAL', FALSE),
('Gambling', 'PROHIBITED', 'Betting, lotteries, gambling services, games of chance', 'CRITICAL', FALSE),
('Weapons/Violence', 'PROHIBITED', 'Weapons sales, violence promotion, threatening content', 'CRITICAL', FALSE),
('Illegal Activities', 'PROHIBITED', 'Drug sales, illegal services, fraudulent schemes', 'CRITICAL', FALSE),
('Misleading Claims', 'PROHIBITED', 'False advertising, miracle cures, unrealistic promises', 'CRITICAL', FALSE),
('Spam/Bulk Messaging', 'PROHIBITED', 'Unsolicited bulk messages, chain letters, spam content', 'CRITICAL', FALSE),
('Personal Data Collection', 'PROHIBITED', 'Requesting personal information, data harvesting, privacy violations', 'CRITICAL', FALSE);

-- Campaign content restrictions
CREATE TABLE IF NOT EXISTS campaign_content_restrictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restriction_type TEXT NOT NULL,
    description TEXT NOT NULL,
    prohibited_keywords TEXT[], -- Array of keywords that trigger restrictions
    severity TEXT CHECK (severity IN ('WARNING', 'BLOCK', 'SUSPEND')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert content restrictions
INSERT INTO campaign_content_restrictions (restriction_type, description, prohibited_keywords, severity) VALUES

('Political Content', 'Political messaging that could violate Meta policies', 
 ARRAY['vote for', 'election', 'political party', 'candidate', 'ANC', 'DA', 'EFF', 'IFP', 'campaign rally'], 'BLOCK'),

('Financial Schemes', 'Financial products and get-rich-quick schemes',
 ARRAY['investment opportunity', 'guaranteed returns', 'make money fast', 'bitcoin', 'cryptocurrency', 'loan approved', 'easy money'], 'SUSPEND'),

('Medical Claims', 'Medical advice and treatment claims',
 ARRAY['cure', 'treatment', 'medical advice', 'diagnosis', 'prescription', 'miracle cure', 'guaranteed healing'], 'SUSPEND'),

('Adult Content', 'Adult and mature content',
 ARRAY['dating', 'adult services', 'escort', 'massage', 'intimate'], 'SUSPEND'),

('Gambling', 'Gambling and betting content',
 ARRAY['bet now', 'gambling', 'casino', 'lottery', 'jackpot', 'win money', 'betting odds'], 'SUSPEND'),

('Spam Indicators', 'Spam and bulk messaging patterns',
 ARRAY['forward this message', 'send to 10 friends', 'chain letter', 'urgent action required', 'limited time offer'], 'BLOCK'),

('Misleading Claims', 'False or misleading advertising',
 ARRAY['guaranteed results', 'miracle', 'instant success', 'no risk', '100% effective', 'secret method'], 'BLOCK'),

('Data Collection', 'Unauthorized personal data collection',
 ARRAY['send your ID number', 'bank details', 'personal information', 'credit card', 'password'], 'SUSPEND');

-- Function to check campaign compliance
CREATE OR REPLACE FUNCTION check_campaign_compliance(
    campaign_title TEXT,
    campaign_content TEXT,
    campaign_category TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    compliance_result JSON;
    category_info RECORD;
    restriction RECORD;
    restriction_violations TEXT[] := '{}';
    risk_score INTEGER := 0;
    is_compliant BOOLEAN := TRUE;
    violation_severity TEXT := 'NONE';
BEGIN
    -- Check if category is allowed
    SELECT * INTO category_info
    FROM campaign_compliance_categories
    WHERE category_name = campaign_category;
    
    IF NOT FOUND THEN
        -- Unknown category - default to restricted
        risk_score := 50;
        is_compliant := FALSE;
        violation_severity := 'WARNING';
        restriction_violations := array_append(restriction_violations, 'Unknown campaign category');
    ELSIF category_info.category_type = 'PROHIBITED' THEN
        -- Prohibited category
        risk_score := 100;
        is_compliant := FALSE;
        violation_severity := 'SUSPEND';
        restriction_violations := array_append(restriction_violations, 'Prohibited campaign category: ' || campaign_category);
    ELSIF category_info.category_type = 'RESTRICTED' THEN
        -- Restricted category - needs approval
        risk_score := 30;
        violation_severity := 'WARNING';
    END IF;
    
    -- Check content for prohibited keywords
    FOR restriction IN 
        SELECT restriction_type, prohibited_keywords, severity
        FROM campaign_content_restrictions
    LOOP
        FOR i IN 1..array_length(restriction.prohibited_keywords, 1)
        LOOP
            IF (campaign_title || ' ' || campaign_content) ILIKE '%' || restriction.prohibited_keywords[i] || '%' THEN
                restriction_violations := array_append(
                    restriction_violations, 
                    restriction.restriction_type || ': ' || restriction.prohibited_keywords[i]
                );
                
                -- Update risk score and compliance
                CASE restriction.severity
                    WHEN 'SUSPEND' THEN
                        risk_score := GREATEST(risk_score, 90);
                        is_compliant := FALSE;
                        violation_severity := 'SUSPEND';
                    WHEN 'BLOCK' THEN
                        risk_score := GREATEST(risk_score, 70);
                        is_compliant := FALSE;
                        violation_severity := GREATEST(violation_severity, 'BLOCK');
                    WHEN 'WARNING' THEN
                        risk_score := GREATEST(risk_score, 40);
                        violation_severity := GREATEST(violation_severity, 'WARNING');
                END CASE;
            END IF;
        END LOOP;
    END LOOP;
    
    -- Build compliance result
    compliance_result := json_build_object(
        'is_compliant', is_compliant,
        'risk_score', risk_score,
        'violation_severity', violation_severity,
        'category_type', COALESCE(category_info.category_type, 'UNKNOWN'),
        'requires_approval', COALESCE(category_info.requires_approval, TRUE),
        'violations', restriction_violations,
        'recommendation', CASE
            WHEN violation_severity = 'SUSPEND' THEN 'Campaign will likely cause account suspension - DO NOT SEND'
            WHEN violation_severity = 'BLOCK' THEN 'Campaign violates Meta policies - requires major revision'
            WHEN violation_severity = 'WARNING' THEN 'Campaign needs review and possible approval'
            ELSE 'Campaign appears compliant with Meta policies'
        END,
        'checked_at', NOW()
    );
    
    RETURN compliance_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_campaign_compliance TO service_role;

-- Add compliance tracking to campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS compliance_check JSONB;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'compliant', 'non_compliant', 'requires_approval'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS meta_risk_score INTEGER DEFAULT 0;

-- Create trigger to automatically check compliance
CREATE OR REPLACE FUNCTION trigger_campaign_compliance_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    compliance_result JSON;
BEGIN
    -- Run compliance check
    SELECT check_campaign_compliance(NEW.title, NEW.content, NEW.primary_category)
    INTO compliance_result;
    
    -- Update campaign with compliance results
    NEW.compliance_check := compliance_result;
    NEW.meta_risk_score := (compliance_result->>'risk_score')::INTEGER;
    NEW.compliance_status := CASE
        WHEN (compliance_result->>'is_compliant')::BOOLEAN THEN 'compliant'
        WHEN (compliance_result->>'violation_severity')::TEXT IN ('SUSPEND', 'BLOCK') THEN 'non_compliant'
        ELSE 'requires_approval'
    END;
    
    RETURN NEW;
END;
$$;

-- Create trigger on campaigns table
DROP TRIGGER IF EXISTS campaign_compliance_check_trigger ON campaigns;
CREATE TRIGGER campaign_compliance_check_trigger
    BEFORE INSERT OR UPDATE ON campaigns
    FOR EACH ROW
    EXECUTE FUNCTION trigger_campaign_compliance_check();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_compliance_status ON campaigns(compliance_status);
CREATE INDEX IF NOT EXISTS idx_campaigns_meta_risk_score ON campaigns(meta_risk_score);
CREATE INDEX IF NOT EXISTS idx_campaign_compliance_categories_type ON campaign_compliance_categories(category_type);

COMMENT ON TABLE campaign_compliance_categories IS 'Meta WhatsApp Business API compliant campaign categories';
COMMENT ON TABLE campaign_content_restrictions IS 'Content restrictions to prevent Meta policy violations';
COMMENT ON FUNCTION check_campaign_compliance IS 'Validates campaign content against Meta WhatsApp Business API policies';