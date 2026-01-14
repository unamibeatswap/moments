-- MARKETING TEMPLATE MIGRATION - VALIDATION QUERIES
-- Run these in Supabase SQL Editor after migration

-- 1. Verify Schema Changes
SELECT 'marketing_compliance table' as check_name, 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'marketing_compliance') 
       THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 'compliance_dashboard view',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'compliance_dashboard')
       THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'broadcasts.template_category',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'broadcasts' AND column_name = 'template_category')
       THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 'moments.partner_attribution',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moments' AND column_name = 'partner_attribution')
       THEN '✅ EXISTS' ELSE '❌ MISSING' END;

-- 2. Check Feature Flag
SELECT flag_key, enabled, rollout_percentage, description 
FROM feature_flags 
WHERE flag_key = 'enable_marketing_templates';

-- 3. Test Compliance Score Function
SELECT calculate_compliance_score(true, true, true) as perfect_score,  -- Should be 100
       calculate_compliance_score(true, true, false) as no_pwa,        -- Should be 70
       calculate_compliance_score(false, true, true) as no_sponsor;    -- Should be 60

-- 4. View Compliance Dashboard (should be empty initially)
SELECT * FROM compliance_dashboard LIMIT 5;

-- 5. Check Recent Moments (verify partner_attribution column)
SELECT id, title, is_sponsored, partner_attribution, created_at 
FROM moments 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Check Broadcasts (verify template_category column)
SELECT id, moment_id, template_category, status, created_at 
FROM broadcasts 
ORDER BY created_at DESC 
LIMIT 5;

-- 7. Enable Feature Flag (10% rollout for testing)
-- UNCOMMENT TO ENABLE:
-- UPDATE feature_flags 
-- SET enabled = true, rollout_percentage = 10 
-- WHERE flag_key = 'enable_marketing_templates';

-- 8. Disable Feature Flag (rollback)
-- UNCOMMENT TO DISABLE:
-- UPDATE feature_flags 
-- SET enabled = false, rollout_percentage = 0 
-- WHERE flag_key = 'enable_marketing_templates';
