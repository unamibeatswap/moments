# Marketing Template Migration - Quick Reference

## 🚀 30-Minute Deployment

```bash
# 1. Database Migration (5 min)
# Run in Supabase SQL Editor: supabase/marketing_template_migration.sql

# 2. Deploy Code (5 min)
supabase functions deploy admin-api

# 3. Test (5 min)
./test-marketing-migration.sh  # Must pass all 20 tests

# 4. Enable (1 min)
# In Supabase SQL Editor:
UPDATE feature_flags SET enabled = true WHERE flag_key = 'enable_marketing_templates';

# 5. Monitor (ongoing)
# Check compliance dashboard in admin UI
```

## 📊 Key SQL Queries

```sql
-- Check feature flag status
SELECT * FROM feature_flags WHERE flag_key = 'enable_marketing_templates';

-- View compliance scores
SELECT * FROM compliance_dashboard ORDER BY validated_at DESC LIMIT 10;

-- Check broadcast success rates
SELECT 
  template_category,
  COUNT(*) as total,
  AVG(success_count::float / NULLIF(recipient_count, 0)) as success_rate
FROM broadcasts
WHERE broadcast_started_at > NOW() - INTERVAL '24 hours'
GROUP BY template_category;

-- Immediate rollback
UPDATE feature_flags SET enabled = false WHERE flag_key = 'enable_marketing_templates';
```

## 📁 File Locations

| File | Purpose |
|------|---------|
| `supabase/marketing_template_migration.sql` | Database schema |
| `src/broadcast-hybrid.js` | Broadcast logic |
| `supabase/functions/admin-api/index.ts` | Compliance validation |
| `test-marketing-migration.sh` | Test suite |
| `DEPLOYMENT_GUIDE.md` | Full instructions |
| `IMPLEMENTATION_SUMMARY.md` | What was built |

## ✅ Pre-Flight Checklist

- [ ] Backup database: `pg_dump $DATABASE_URL > backup.sql`
- [ ] Review changes: `git diff main`
- [ ] Confirm Meta Business Manager access
- [ ] Verify sponsors table populated
- [ ] Test script executable: `chmod +x test-marketing-migration.sh`

## 🎯 Success Indicators

- ✅ All 20 tests pass
- ✅ Compliance score > 90
- ✅ Broadcast success rate maintained
- ✅ No increase in opt-outs
- ✅ Partner attribution visible

## 🚨 Emergency Rollback

```sql
-- IMMEDIATE: Disable feature flag (30 seconds)
UPDATE feature_flags SET enabled = false WHERE flag_key = 'enable_marketing_templates';

-- System reverts to hello_world template
-- No data loss, broadcasts continue
```

## 📞 Quick Links

- **Playbook**: `SENIOR_DEV_PLAYBOOK.md`
- **Deployment**: `DEPLOYMENT_GUIDE.md`
- **Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Meta Support**: https://business.facebook.com/support

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests failing | Check database migration ran successfully |
| Low compliance score | Review moment creation in admin-api |
| Template not found | Verify whatsapp-templates.js imports |
| Broadcast failures | Check feature flag status and logs |
| Missing attribution | Ensure sponsor_id set on sponsored moments |

## 📈 Monitoring Dashboard

```sql
-- Real-time compliance view
SELECT * FROM compliance_dashboard WHERE validated_at > NOW() - INTERVAL '1 hour';

-- Template usage today
SELECT template_used, COUNT(*) FROM broadcasts 
WHERE broadcast_started_at > CURRENT_DATE 
GROUP BY template_used;

-- Errors in last hour
SELECT * FROM error_logs WHERE created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC;
```

---

**Quick Deploy**: 30 minutes  
**Full Rollout**: 3-5 days (staged)  
**Meta Approval**: 7-14 days  
**Risk**: LOW (feature flag controlled)
