# Marketing Template Migration - Deployment Guide

## 🎯 Overview
This guide walks through deploying the marketing template migration per the SENIOR_DEV_PLAYBOOK.md requirements.

## ✅ Pre-Deployment Checklist

- [ ] All code changes reviewed and tested locally
- [ ] Database migration SQL validated
- [ ] Feature flag created and set to `false`
- [ ] Rollback plan documented
- [ ] Meta Business Manager access confirmed
- [ ] Sponsor data populated in database

## 📦 Deployment Steps

### Step 1: Database Migration (5 minutes)

```bash
# 1. Backup current database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Run migration in Supabase SQL Editor
# File: supabase/marketing_template_migration.sql
# This adds:
# - broadcasts.template_category column
# - moments.partner_attribution column
# - marketing_compliance table
# - compliance_dashboard view
# - Feature flag: enable_marketing_templates (default: false)

# 3. Verify migration
psql $DATABASE_URL -c "\d marketing_compliance"
psql $DATABASE_URL -c "\d+ broadcasts" | grep template_category
psql $DATABASE_URL -c "\d+ moments" | grep partner_attribution
psql $DATABASE_URL -c "SELECT * FROM feature_flags WHERE flag_key = 'enable_marketing_templates';"
```

### Step 2: Deploy Code Changes (10 minutes)

```bash
# 1. Deploy updated Edge Functions
cd /workspaces/moments

# Deploy admin-api with compliance validation
supabase functions deploy admin-api

# Deploy broadcast-webhook (if updated)
supabase functions deploy broadcast-webhook

# 2. Verify deployments
curl -X GET "https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/admin-api/help"

# 3. Update Node.js broadcast system
npm install
npm run build  # If applicable

# 4. Restart services (if using PM2/systemd)
pm2 restart moments-broadcast  # Or your process name
```

### Step 3: Run Test Suite (5 minutes)

```bash
# Run comprehensive test suite
./test-marketing-migration.sh

# Expected output:
# - 20 tests total
# - All tests should pass
# - Feature flag should be DISABLED
```

### Step 4: Staged Rollout (Recommended)

#### Phase A: 10% Traffic Test (24 hours)

```sql
-- Enable for test users only
UPDATE feature_flags 
SET enabled = true, 
    metadata = jsonb_build_object('rollout_percentage', 10)
WHERE flag_key = 'enable_marketing_templates';

-- Monitor compliance dashboard
SELECT * FROM compliance_dashboard 
WHERE validated_at > NOW() - INTERVAL '24 hours'
ORDER BY validated_at DESC;

-- Check broadcast success rates
SELECT 
  template_category,
  COUNT(*) as total,
  AVG(success_count::float / NULLIF(recipient_count, 0)) as success_rate
FROM broadcasts
WHERE broadcast_started_at > NOW() - INTERVAL '24 hours'
GROUP BY template_category;
```

#### Phase B: 50% Traffic Test (48 hours)

```sql
-- Increase rollout if Phase A successful
UPDATE feature_flags 
SET metadata = jsonb_build_object('rollout_percentage', 50)
WHERE flag_key = 'enable_marketing_templates';
```

#### Phase C: Full Rollout

```sql
-- Enable for all users
UPDATE feature_flags 
SET enabled = true,
    metadata = jsonb_build_object('rollout_percentage', 100)
WHERE flag_key = 'enable_marketing_templates';
```

### Step 5: Meta Template Submission (7-14 days)

1. **Login to Meta Business Manager**
   - URL: https://business.facebook.com/
   - Navigate to WhatsApp Manager → Message Templates

2. **Submit MOMENT_BROADCAST Template**
   ```
   Name: moment_broadcast_v2
   Category: MARKETING
   Language: English
   
   Header: {{1}} Moment — {{2}}
   Body: {{3}}
   
   {{4}}
   
   🏷️ {{5}} • 📍 {{6}}
   
   🌐 More: https://moments.unamifoundation.org
   
   Footer: Reply STOP to unsubscribe
   ```

3. **Submit SPONSORED_MOMENT Template**
   ```
   Name: sponsored_moment_v2
   Category: MARKETING
   Language: English
   
   Header: {{1}} [Sponsored] Moment — {{2}}
   Body: {{3}}
   
   {{4}}
   
   🏷️ {{5}} • 📍 {{6}}
   
   ✨ Proudly sponsored by {{7}}
   
   🌐 More: https://moments.unamifoundation.org
   
   Footer: Reply STOP to unsubscribe
   ```

4. **Wait for Approval**
   - Typical approval time: 7-14 days
   - Check status daily in Meta Business Manager
   - Address any rejection reasons immediately

### Step 6: PWA Updates (Optional, 30 minutes)

```bash
# 1. Review PWA updates
cat public/pwa-marketing-updates.html

# 2. Manually integrate into public/moments/index.html
# - Update hero section with "Digital Notice Board" copy
# - Add transparency section about sponsored content
# - Update moment card rendering for partner attribution
# - Add CSS for sponsored badges

# 3. Test PWA locally
cd public/moments
python3 -m http.server 8000
# Visit http://localhost:8000

# 4. Deploy PWA updates
# (Depends on your hosting - Netlify/Vercel/S3/etc.)
```

## 🔍 Monitoring & Validation

### Key Metrics to Watch

```sql
-- 1. Compliance Score Distribution
SELECT 
  compliance_score,
  COUNT(*) as count,
  ROUND(AVG(CASE WHEN sponsor_disclosed THEN 1 ELSE 0 END) * 100, 2) as sponsor_disclosure_rate
FROM marketing_compliance
WHERE validated_at > NOW() - INTERVAL '7 days'
GROUP BY compliance_score
ORDER BY compliance_score DESC;

-- 2. Template Usage Breakdown
SELECT 
  template_used,
  template_category,
  COUNT(*) as usage_count,
  AVG(success_count::float / NULLIF(recipient_count, 0)) as avg_success_rate
FROM broadcasts
WHERE broadcast_started_at > NOW() - INTERVAL '7 days'
GROUP BY template_used, template_category
ORDER BY usage_count DESC;

-- 3. Sponsored vs Organic Performance
SELECT 
  m.is_sponsored,
  COUNT(DISTINCT b.id) as broadcast_count,
  SUM(b.recipient_count) as total_recipients,
  SUM(b.success_count) as total_successes,
  ROUND(AVG(b.success_count::float / NULLIF(b.recipient_count, 0)) * 100, 2) as success_rate
FROM moments m
JOIN broadcasts b ON m.id = b.moment_id
WHERE b.broadcast_started_at > NOW() - INTERVAL '7 days'
GROUP BY m.is_sponsored;

-- 4. Compliance Issues
SELECT 
  validation_notes,
  COUNT(*) as issue_count
FROM marketing_compliance
WHERE compliance_score < 100
  AND validated_at > NOW() - INTERVAL '7 days'
GROUP BY validation_notes
ORDER BY issue_count DESC;
```

### Alerts to Configure

1. **Low Compliance Score Alert**
   ```sql
   -- Alert if compliance score < 70
   SELECT * FROM marketing_compliance 
   WHERE compliance_score < 70 
   AND validated_at > NOW() - INTERVAL '1 hour';
   ```

2. **Template Failure Rate Alert**
   ```sql
   -- Alert if success rate < 80%
   SELECT * FROM broadcasts
   WHERE template_category = 'MARKETING'
   AND (success_count::float / NULLIF(recipient_count, 0)) < 0.8
   AND broadcast_started_at > NOW() - INTERVAL '1 hour';
   ```

3. **Missing Partner Attribution Alert**
   ```sql
   -- Alert if sponsored moment lacks attribution
   SELECT * FROM moments
   WHERE is_sponsored = true
   AND partner_attribution IS NULL
   AND created_at > NOW() - INTERVAL '1 hour';
   ```

## 🚨 Rollback Plan

### If Issues Detected

```sql
-- IMMEDIATE: Disable feature flag
UPDATE feature_flags 
SET enabled = false 
WHERE flag_key = 'enable_marketing_templates';

-- System will revert to hello_world template fallback
-- No data loss, broadcasts continue with old system
```

### If Database Issues

```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Redeploy previous Edge Function versions
supabase functions deploy admin-api --version previous
```

### If Template Rejection by Meta

```sql
-- Continue using hello_world until templates approved
-- Feature flag already disabled, no action needed
-- Address Meta's feedback and resubmit
```

## 📊 Success Criteria

- [ ] All 20 tests passing in test-marketing-migration.sh
- [ ] Compliance score average > 90
- [ ] Broadcast success rate maintained (>85%)
- [ ] No increase in opt-out rate
- [ ] Meta templates approved within 14 days
- [ ] Zero compliance violations logged
- [ ] Partner attribution visible in all sponsored moments

## 📞 Support Contacts

- **Technical Issues**: dev@unamifoundation.org
- **Meta Template Support**: https://business.facebook.com/support
- **Compliance Questions**: compliance@unamifoundation.org

## 📚 Related Documentation

- `SENIOR_DEV_PLAYBOOK.md` - Full implementation guide
- `AI_AGENT_PROMPT.md` - System context and architecture
- `supabase/marketing_template_migration.sql` - Database schema
- `src/broadcast-hybrid.js` - Broadcast logic
- `src/whatsapp-templates.js` - Template definitions

---

**Last Updated**: 2026-01-12  
**Version**: 1.0.0  
**Status**: Ready for Deployment
