# 2026-01-16: WhatsApp Broadcast Fix - Intent System Investigation

## Issue Summary
Moments broadcasts reach PWA but not WhatsApp. All broadcasts stuck in "pending" or "processing" status with 0 delivered messages.

## Root Cause Analysis

### Architecture Discovery
- **Production**: Uses `server.js` (modular) NOT `server-bulletproof.js` (monolithic)
- **Deployment**: Vercel with auto-deploy from git
- **Broadcast System**: MCP-native intent-based architecture via `moment_intents` table
- **Processing**: n8n workflows consume intents and trigger WhatsApp delivery

### Current State
```
Broadcast Flow:
Admin Dashboard → POST /admin/moments/:id/broadcast → Creates moment_intents → n8n processes → WhatsApp API
                                                              ↓
                                                         BROKEN HERE
```

### Evidence
1. **Broadcasts table**: All show 0 delivered, stuck in pending/processing
2. **moment_intents table**: Only PWA intents created, NO WhatsApp intents
3. **Admin endpoint**: Creates PWA intent but fails to create WhatsApp intent
4. **n8n workflows**: Cannot process what doesn't exist

## Investigation Results

### Files Checked
- `/src/server.js` - Main production server (313 lines)
- `/src/admin.js` - Admin routes including broadcast endpoint
- `/src/broadcast.js` - Broadcast logic (256 lines)
- `/config/whatsapp.js` - WhatsApp API integration (has credentials)
- `/supabase/functions/broadcast-batch-processor/index.ts` - Edge function (not used in production)

### Key Finding
Admin broadcast endpoint at `/admin/moments/:id/broadcast`:
- ✅ Updates moment status to 'broadcasted'
- ✅ Creates PWA intent
- ❌ Does NOT create WhatsApp intent
- ❌ Intent creation logic incomplete or failing silently

## Fix Plan

### Step 1: Verify Intent Creation Logic ✅ COMPLETE
- [x] Read full `/src/admin.js` broadcast endpoint
- [x] Check if WhatsApp intent creation code exists
- [x] Identify why WhatsApp intents aren't being created

### Step 2: Fix Intent Creation ✅ COMPLETE
- [x] Ensure WhatsApp intent is created alongside PWA intent
- [x] Add error handling and logging
- [x] Verify intent structure matches n8n expectations

### Step 3: Test & Deploy ✅ DEPLOYED
- [x] Commit and push to trigger Vercel deployment
- [ ] Verify WhatsApp intent appears in database for new broadcasts
- [ ] Monitor n8n workflow processing
- [ ] Check if messages actually reach WhatsApp

### Step 4: Fix Architecture Confusion 🔴 NEW
- [ ] Verify intents are being created in database
- [ ] Check n8n logs for intent processing
- [ ] Fix session validation error
- [ ] Determine broadcasts table purpose
- [ ] Update dashboard to show correct status

### Step 5: Retry Stuck Broadcasts
- [ ] Create script to generate WhatsApp intents for stuck broadcasts
- [ ] Process all pending/processing broadcasts from last 48 hours

## Environment Variables Status
✅ WHATSAPP_TOKEN - Available in production
✅ WHATSAPP_PHONE_ID - Available in production
✅ SUPABASE_URL - Available
✅ SUPABASE_SERVICE_KEY - Available

## Next Actions
1. Read complete admin.js broadcast endpoint
2. Identify intent creation failure point
3. Implement fix
4. Deploy and verify

## Related Files
- `/src/admin.js` - Broadcast endpoint
- `/src/broadcast.js` - Broadcast utilities
- Database: `moment_intents`, `broadcasts`, `moments`
- n8n: Intent executor workflow

## CRITICAL CORRECTION

**I made a major mistake**: Modified `server-bulletproof.js` and `src/admin.js` which are NOT used in production.

**Actual Production Architecture:**
- ✅ Supabase Edge Functions: `admin-api`, `broadcast-webhook`, `broadcast-batch-processor`
- ✅ Vercel: Hosts PWA frontend ONLY (no backend)
- ❌ NO Node.js server in production
- ❌ Changes to `server-bulletproof.js` are irrelevant

**Real Issue:**
The `admin-api` edge function creates `broadcasts` table records and calls `broadcast-webhook`, but:
1. Dashboard shows `broadcasts` table (always 0 delivered)
2. Actual WhatsApp delivery may be working via `broadcast-webhook`
3. The `broadcasts` table isn't being updated with success/failure counts
4. Environment variables (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID) must be set in Supabase edge function secrets

## Status: ARCHITECTURE MISUNDERSTANDING - NEED TO VERIFY SUPABASE SECRETS

### New Issue: Broadcasts Table vs Intent System Conflict

**Evidence from Logs:**
```
1. MCP auto-approved message (risk=0.00) - Working ✅
2. Session validation failed: Cannot coerce to single JSON object - Error ❌
3. Broadcast still shows "processing" with 0 delivered - Not working ❌
```

**Discovery:**
The system has TWO broadcast mechanisms:
1. **Intent System** (MCP-native) - Creates `moment_intents` → n8n processes → WhatsApp
2. **Broadcasts Table** (Legacy) - Creates `broadcasts` record with batches

The admin dashboard shows the `broadcasts` table which is NOT connected to the intent system.

**Root Cause:**
- Admin endpoint creates WhatsApp intent ✅
- Admin endpoint ALSO creates broadcast record in `broadcasts` table ❌
- Dashboard shows `broadcasts` table status (always 0 delivered)
- Actual WhatsApp delivery happens via intents (not tracked in broadcasts table)

**Session Validation Error:**
- "Cannot coerce to single JSON object" suggests RLS policy or query issue
- Likely in admin authentication or session management
- May be blocking proper intent processing

## Critical Questions
1. Is the `broadcasts` table still used or is it legacy?
2. Should broadcast endpoint create BOTH intent AND broadcast record?
3. Where does n8n update delivery status - intents or broadcasts table?
4. Why is session validation failing?

## Next Actions
1. Check if WhatsApp intents are being created in database
2. Verify n8n is processing the intents
3. Fix session validation error
4. Determine if broadcasts table should be deprecated
5. Update dashboard to show intent status instead of broadcast status

**Priority**: CRITICAL - System architecture confusion
**Impact**: Broadcasts may be working but dashboard shows wrong status
