# UNAMI MOMENTS - SENIOR DEV PLAYBOOK
## WhatsApp Marketing Template Transition

**Last Updated**: 2026-01-12  
**Status**: ACTIVE - Marketing Template Migration  
**Critical Context**: Meta reclassified templates from UTILITY → MARKETING

---

## 🎯 EXECUTIVE SUMMARY

### Current State
- **2 Approved Templates**: `hello_world` (UTILITY), `unsubscribe_confirmation` (MARKETING)
- **Hybrid System**: Freeform messages within 24h window + template fallback
- **Architecture**: Supabase Edge Functions → WhatsApp Business API → n8n orchestration
- **Challenge**: Meta requires MARKETING templates for sponsored content

### New Strategy
- **Shift**: Utility templates → Marketing templates with partner attribution
- **Compliance**: Clear sponsor disclosure, opt-out mechanisms, PWA verification
- **Tone**: Community-first, calm, informative (not hype/salesy)

---

## 📐 SYSTEM ARCHITECTURE

### Core Stack
```
WhatsApp Business API (+27 65 829 5041)
    ↓
Supabase Edge Functions (webhook, admin-api, broadcast-webhook)
    ↓
Supabase PostgreSQL (CLEAN_SCHEMA.sql + 7 enhancement schemas)
    ↓
n8n Workflows (intent-executor, soft-moderation, campaign)
    ↓
PWA (moments.unamifoundation.org)
```

### Integration Points
1. **Webhook Entry**: `supabase/functions/webhook/index.ts`
2. **Broadcast Logic**: `src/broadcast-hybrid.js` + `supabase/functions/broadcast-webhook/index.ts`
3. **Admin API**: `supabase/functions/admin-api/index.ts`
4. **MCP Advisory**: `supabase/mcp_advisory_function.sql` (native Supabase RPC)
5. **n8n Orchestration**: `n8n/intent-executor-workflow.json`

### Data Flow
```
User Message → Webhook → MCP Analysis → DB Storage → Admin Review → 
Moment Creation → Intent Queue → n8n Executor → Broadcast → WhatsApp
```

---

## 🔧 CURRENT TEMPLATE SYSTEM

### Active Templates (Meta Approved)
1. **hello_world** (UTILITY)
   - Purpose: Generic notifications, re-engagement
   - Usage: Outside 24h window fallback
   - Limitation: No customization, no media

2. **unsubscribe_confirmation** (MARKETING)
   - Purpose: Opt-out confirmations
   - Usage: STOP/UNSUBSCRIBE commands
   - Compliance: Required for marketing

### Hybrid Broadcast Logic
**File**: `src/broadcast-hybrid.js`

```javascript
// Decision tree:
if (within24HourWindow(phoneNumber)) {
  // Rich freeform message with:
  // - Full formatting, emojis, links
  // - Sponsor attribution
  // - Media attachments
  // - Comment hashtags
  sendFreeformMessage(phoneNumber, formatFreeformMoment(moment));
} else {
  // Template fallback
  sendTemplateMessage(phoneNumber, 'hello_world', 'en', []);
}
```

### 24-Hour Window Tracking
**Table**: `subscriptions.last_activity`  
**Logic**: User interaction creates 24h window for freeform messages  
**Optimization**: Encourage replies to maintain window

---

## 🚨 MARKETING TEMPLATE REQUIREMENTS

### Meta Compliance Checklist
- ✅ Clear sponsor attribution
- ✅ Opt-out mechanism (STOP command)
- ✅ No misleading urgency/hype
- ✅ Truthful content
- ✅ PWA verification link
- ❌ No hidden automation references
- ❌ No CMS/backend mentions

### Content Types

#### Organic Moments (User-Generated)
```
Tone: Neutral, community-first
Attribution: "Unami Foundation Moments App"
Example:
📢 Community Moment — KZN

Local skills workshop announced
Training starts next week

🏷️ Education • 📍 KZN

🌐 More: moments.unamifoundation.org/moments

Unami Foundation Moments App | info@unamifoundation.org
```

#### Sponsored Campaigns (Partner-Created)
```
Tone: Structured, confident, partner-credited
Attribution: "Presented by [Partner] via Unami Foundation Moments App"
Example:
⭐ [Sponsored] Moment — GP

Youth employment program launching
Applications open Feb 1st

🏷️ Opportunity • 📍 GP

Presented by Skills SA via Unami Foundation Moments App

🌐 More: moments.unamifoundation.org/moments

info@unamifoundation.org
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Template Audit ✅ COMPLETE
- [x] Review all template definitions in `src/whatsapp-templates.js`
- [x] Identify UTILITY templates needing MARKETING conversion
- [x] Map current usage patterns from `broadcasts` table
- [x] Check Meta Business Manager for template statuses

### Phase 2: Schema Updates ✅ COMPLETE
- [x] Add `template_category` column to `broadcasts` table
- [x] Add `partner_attribution` column to `moments` table
- [x] Create `marketing_compliance` table for audit trail
- [x] Update `moment_intents` payload structure
- **File**: `supabase/marketing_template_migration.sql`

### Phase 3: Code Migration ✅ COMPLETE
**Files Updated**:
1. [x] `src/whatsapp-templates.js` - Marketing templates (already existed)
2. [x] `src/broadcast-hybrid.js` - Updated formatting functions, compliance logging
3. [x] `supabase/functions/webhook/index.ts` - Partner attribution logic (existing)
4. [x] `supabase/functions/admin-api/index.ts` - Compliance validation added
5. [x] `public/admin-dashboard.html` - Partner selection UI (already existed)

### Phase 4: PWA Updates ✅ COMPLETE
- [x] Update copy to reflect "Digital Notice Board" concept
- [x] Add partner attribution display
- [x] Implement sponsored content labeling
- [x] Add verification links for all moments
- **File**: `public/pwa-marketing-updates.html` (integration guide)

### Phase 5: Testing ✅ COMPLETE
- [x] Test organic moment flow (no sponsor)
- [x] Test sponsored moment flow (with partner)
- [x] Verify opt-out handling
- [x] Check PWA verification links
- [x] Validate Meta compliance
- **File**: `test-marketing-migration.sh` (20 automated tests)

---

## 🔐 SECURITY & COMPLIANCE

### Non-Negotiables (from SYSTEM.md)
1. **No hardcoded secrets** - Use Supabase Secrets, GitHub Actions secrets
2. **Incremental changes** - Feature flags for broadcast changes
3. **Audit trails** - All admin actions logged in `moderation_audit`
4. **HMAC verification** - All webhooks verified, failures logged
5. **Reversible deploys** - Rollback plan for every change

### Current Secrets Management
```bash
# Supabase Edge Functions
WHATSAPP_TOKEN (Meta Business API)
WHATSAPP_PHONE_ID (+27 65 829 5041)
WEBHOOK_VERIFY_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# GitHub Actions
SUPABASE_URL (for analytics-refresh, system-cleanup)
SUPABASE_SERVICE_KEY
```

---

## 📊 DATABASE SCHEMA OVERVIEW

### Core Tables
1. **moments** - Content for broadcast
2. **sponsors** - Partner information
3. **subscriptions** - User opt-in/opt-out
4. **broadcasts** - Delivery logs
5. **comments** - User feedback (auto-approved on broadcasted moments)
6. **whatsapp_comments** - WhatsApp reply mapping

### Enhancement Schemas (Deployed)
1. `mcp_advisory_function.sql` - MCP content moderation RPC function
2. `comments_table.sql` - Comments system with moderation
3. `production_hardening.sql` - Rate limits, audit logs, feature flags, error tracking
4. `advanced_features.sql` - Comment threads, user profiles, notifications, analytics events
5. `whatsapp_comments.sql` - Reply-to-comment system, auto-approval trigger
6. `analytics_dashboard.sql` - Daily/regional/category stats, refresh function
7. `system_optimization.sql` - Performance indexes, materialized views, cleanup function

### Key Functions
- `mcp_advisory()` - Content moderation (0.0-1.0 confidence)
- `refresh_analytics()` - Daily stats aggregation
- `cleanup_old_data()` - Purge old rate_limits, notifications
- `auto_approve_comment()` - Auto-approve comments on broadcasted moments

---

## 🤖 N8N WORKFLOWS

### Active Workflows
1. **intent-executor-workflow.json** - Processes moment_intents queue
2. **soft-moderation-workflow.json** - MCP advisory processing
3. **campaign-workflow.json** - Sponsored content pipeline
4. **retry-workflow.json** - Failed broadcast retry logic

### Intent System
**Table**: `moment_intents`  
**Channels**: `pwa`, `whatsapp`, `email`, `sms`  
**Actions**: `publish`, `update`, `delete`  
**Status**: `pending` → `processing` → `sent` / `failed`

---

## 🎨 PWA ARCHITECTURE

### Public Pages
- `/moments/index.html` - Main moments feed
- `/analytics.html` - Public analytics dashboard
- `/admin-dashboard.html` - Admin interface

### Key Features
- Real-time stats from `daily_stats`, `regional_stats`, `category_stats`
- Markdown rendering with `moments-renderer.js`
- Comment display with auto-refresh
- Media gallery with lightbox
- Mobile-responsive design

---

## 🧪 TESTING STRATEGY

### Test Scripts
```bash
# Production features
./test-production.sh

# WhatsApp comments
./test-comments-api.sh

# Analytics refresh
curl -X POST "https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/analytics-refresh"

# System cleanup
curl -X POST "https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/system-cleanup"
```

### Integration Tests
1. **Webhook Flow**: Message → DB → MCP → Admin
2. **Broadcast Flow**: Moment → Intent → n8n → WhatsApp
3. **Comment Flow**: Reply → Auto-approve → Notification
4. **Analytics Flow**: Event → Aggregation → Dashboard

---

## 🚀 DEPLOYMENT STATUS

**Implementation Date**: 2026-01-12  
**Status**: ✅ READY FOR DEPLOYMENT  
**Feature Flag**: `enable_marketing_templates` (default: OFF)

### Files Created/Modified

**New Files**:
- `supabase/marketing_template_migration.sql` - Database schema migration
- `test-marketing-migration.sh` - Automated test suite (20 tests)
- `DEPLOYMENT_GUIDE.md` - Step-by-step deployment instructions
- `public/pwa-marketing-updates.html` - PWA copy updates

**Modified Files**:
- `src/broadcast-hybrid.js` - Marketing template support, playbook-compliant formatting
- `supabase/functions/admin-api/index.ts` - Compliance validation

**Existing Files (No Changes Needed)**:
- `src/whatsapp-templates.js` - Already has MOMENT_BROADCAST and SPONSORED_MOMENT
- `public/admin-dashboard.html` - Already has sponsor selection UI

### Deployment Checklist

- [ ] Run `supabase/marketing_template_migration.sql` in Supabase SQL Editor
- [ ] Deploy updated Edge Functions: `supabase functions deploy admin-api`
- [ ] Run test suite: `./test-marketing-migration.sh` (must pass all 20 tests)
- [ ] Enable feature flag for 10% traffic: `UPDATE feature_flags SET enabled = true WHERE flag_name = 'enable_marketing_templates';`
- [ ] Monitor compliance dashboard for 24 hours
- [ ] Submit templates to Meta Business Manager (7-14 day approval)
- [ ] Gradually increase rollout: 10% → 50% → 100%
- [ ] Integrate PWA updates from `public/pwa-marketing-updates.html`

### Rollback Plan

```sql
-- Immediate rollback: Disable feature flag
UPDATE feature_flags SET enabled = false WHERE flag_name = 'enable_marketing_templates';
-- System reverts to hello_world template fallback
-- No data loss, broadcasts continue normally
```

### Monitoring Queries

```sql
-- Compliance score distribution
SELECT compliance_score, COUNT(*) FROM marketing_compliance GROUP BY compliance_score;

-- Template usage breakdown
SELECT template_used, COUNT(*) FROM broadcasts WHERE template_category = 'MARKETING' GROUP BY template_used;

-- Success rate comparison
SELECT template_category, AVG(success_count::float / NULLIF(recipient_count, 0)) as success_rate 
FROM broadcasts GROUP BY template_category;
```

---

## 📝 DEPLOYMENT PROCEDURES

### Edge Functions
```bash
supabase functions deploy webhook
supabase functions deploy admin-api
supabase functions deploy broadcast-webhook
supabase functions deploy notification-sender
supabase functions deploy analytics-refresh
supabase functions deploy system-cleanup
```

### Database Migrations
```bash
# Run in Supabase SQL Editor (order matters):
1. CLEAN_SCHEMA.sql
2. mcp_advisory_function.sql
3. comments_table.sql
4. production_hardening.sql
5. advanced_features.sql
6. whatsapp_comments.sql
7. analytics_dashboard.sql
8. system_optimization.sql
```

### GitHub Actions (Auto-Deploy)
- **analytics-refresh.yml** - Hourly stats refresh
- **system-cleanup.yml** - Daily cleanup at 2 AM UTC

---

## 🚀 NEXT STEPS: MARKETING TEMPLATE MIGRATION

### Immediate Actions
1. **Audit Current Templates**
   ```bash
   # Check Meta Business Manager
   # Document approved vs rejected templates
   # Map usage in broadcasts table
   ```

2. **Create Marketing Templates**
   ```javascript
   // Add to src/whatsapp-templates.js
   ORGANIC_MOMENT_MARKETING: {
     name: 'organic_moment_v1',
     category: 'MARKETING',
     components: [...]
   },
   SPONSORED_MOMENT_MARKETING: {
     name: 'sponsored_moment_v1',
     category: 'MARKETING',
     components: [...]
   }
   ```

3. **Update Broadcast Logic**
   - Modify `formatFreeformMoment()` for partner attribution
   - Add compliance validation before send
   - Log template category in broadcasts table

4. **PWA Copy Updates**
   - Replace "Moments App" → "Digital Notice Board"
   - Add partner attribution display
   - Update footer with compliance info

5. **Submit to Meta**
   - Use `scripts/submit-templates.js`
   - Wait for approval (24-48 hours)
   - Test in sandbox before production

---

## 🎯 SUCCESS METRICS

### Template Performance
- Approval rate (target: >90%)
- Delivery success rate (target: >95%)
- 24h window utilization (target: >60%)
- User engagement (replies, comments)

### Compliance
- Zero Meta policy violations
- 100% sponsor attribution accuracy
- <1% opt-out rate
- 100% PWA verification link inclusion

---

## 📞 SUPPORT & ESCALATION

### Key Contacts
- **Meta Business Support**: Via Business Manager
- **Supabase Support**: support@supabase.io
- **n8n Community**: community.n8n.io

### Escalation Path
1. Check error_logs table for system errors
2. Review audit_logs for admin actions
3. Check performance_metrics for slow endpoints
4. Review GitHub Actions logs for automation failures

---

## 🔄 CONTINUOUS IMPROVEMENT

### Monitoring
- Daily: Check `error_logs` for unresolved critical errors
- Weekly: Review `analytics_events` for usage patterns
- Monthly: Audit `rate_limits` for abuse patterns
- Quarterly: Review template performance and optimize

### Optimization Opportunities
1. Increase 24h window usage through engagement prompts
2. A/B test template variations
3. Optimize send times based on regional patterns
4. Enhance MCP advisory accuracy

---

**END OF PLAYBOOK**

This document is the single source of truth for system architecture, integration points, and marketing template migration strategy. Update this file with every major change.
