# PHASE 3 - FEATURE COMPLETE

## 🎯 OBJECTIVES
Complete remaining features and optimizations

---

## 📋 PRIORITY ORDER

### 1. Comments Backend API (HIGH PRIORITY) ⏳
**Status:** Frontend exists, backend missing  
**Impact:** Users can't comment on moments  
**Files:** `supabase/functions/admin-api/index.ts`

**Required Endpoints:**
- `GET /moments/:id/comments` - List comments
- `POST /moments/:id/comments` - Create comment
- `PUT /comments/:id` - Update comment
- `DELETE /comments/:id` - Delete comment
- `POST /comments/:id/approve` - Approve comment
- `POST /comments/:id/feature` - Feature comment

**Database:** Comments table already exists in schema

---

### 2. Enhanced Audit Logging (MEDIUM PRIORITY) ⏳
**Status:** Basic audit exists, needs enhancement  
**Impact:** Better compliance and debugging  
**Files:** `supabase/functions/admin-api/index.ts`

**Required:**
- Log all moment CRUD operations
- Log all broadcast actions
- Log all sponsor changes
- Include IP address and user agent

---

### 3. Feature Flags System (LOW PRIORITY) ⏳
**Status:** Not implemented  
**Impact:** Better deployment control  
**Files:** `supabase/CLEAN_SCHEMA.sql`, admin-api

**Required:**
- `feature_flags` table
- API to read/update flags
- Admin UI to toggle flags

---

### 4. Performance Optimizations (LOW PRIORITY) ⏳
**Status:** Basic indexes exist  
**Impact:** Faster queries at scale  
**Files:** Database queries

**Required:**
- Add composite indexes
- Optimize N+1 queries
- Add query result caching

---

## 🔧 IMPLEMENTATION PLAN

### Step 1: Comments Backend (30 min)
```typescript
// Add to admin-api/index.ts

// GET /moments/:id/comments
if (path.match(/\/moments\/[^/]+\/comments$/) && method === 'GET') {
  const momentId = path.split('/moments/')[1].split('/comments')[0]
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('moment_id', momentId)
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })
  
  return new Response(JSON.stringify({ comments }), { headers: corsHeaders })
}

// POST /moments/:id/comments
if (path.match(/\/moments\/[^/]+\/comments$/) && method === 'POST') {
  const momentId = path.split('/moments/')[1].split('/comments')[0]
  const { data: comment } = await supabase
    .from('comments')
    .insert({
      moment_id: momentId,
      from_number: body.from_number,
      content: body.content,
      moderation_status: 'pending'
    })
    .select()
    .single()
  
  return new Response(JSON.stringify({ comment }), { headers: corsHeaders })
}

// POST /comments/:id/approve
if (path.match(/\/comments\/[^/]+\/approve$/) && method === 'POST') {
  const commentId = path.split('/comments/')[1].split('/approve')[0]
  await supabase
    .from('comments')
    .update({ moderation_status: 'approved' })
    .eq('id', commentId)
  
  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
}
```

---

### Step 2: Comments Table (if missing)
```sql
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  content TEXT NOT NULL,
  featured BOOLEAN DEFAULT false,
  reply_count INTEGER DEFAULT 0,
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_moment_id ON comments(moment_id);
CREATE INDEX idx_comments_moderation ON comments(moderation_status);
```

---

### Step 3: Enhanced Audit Logging
```typescript
// Helper function
async function createAuditLog(action: string, resource: string, resourceId: string, details: any) {
  await supabase.from('audit_logs').insert({
    action,
    resource,
    resource_id: resourceId,
    details,
    created_at: new Date().toISOString()
  })
}

// Use in all CRUD operations
await createAuditLog('moment_created', 'moments', moment.id, { title: moment.title })
```

---

### Step 4: Feature Flags
```sql
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO feature_flags (flag_key, enabled, description) VALUES
  ('auto_approve_enabled', true, 'Enable auto-approval for low-risk messages'),
  ('media_download_enabled', true, 'Enable WhatsApp media download'),
  ('comments_enabled', false, 'Enable comments on moments');
```

---

## 📦 FILES TO CREATE/MODIFY

### New Files:
1. `supabase/comments_table.sql` - Comments schema
2. `supabase/feature_flags.sql` - Feature flags schema

### Modified Files:
1. `supabase/functions/admin-api/index.ts` - Add comments endpoints
2. `public/js/admin.js` - Add comments UI handlers

---

## ✅ VERIFICATION

### Test Comments:
```bash
# Create comment
curl -X POST "https://[project].supabase.co/functions/v1/admin-api/moments/[id]/comments" \
  -H "Authorization: Bearer [token]" \
  -d '{"from_number":"+27...", "content":"Great moment!"}'

# Get comments
curl "https://[project].supabase.co/functions/v1/admin-api/moments/[id]/comments"

# Approve comment
curl -X POST "https://[project].supabase.co/functions/v1/admin-api/comments/[id]/approve" \
  -H "Authorization: Bearer [token]"
```

---

## 🎯 SUCCESS CRITERIA

- [ ] Comments can be created via API
- [ ] Comments appear in PWA
- [ ] Comments can be moderated in admin
- [ ] Audit logs track all actions
- [ ] Feature flags can be toggled
- [ ] No performance regressions

---

## 📊 ESTIMATED EFFORT

| Task | Time | Priority |
|------|------|----------|
| Comments Backend | 30 min | HIGH |
| Comments Table | 5 min | HIGH |
| Enhanced Audit | 20 min | MEDIUM |
| Feature Flags | 15 min | LOW |
| Performance | 30 min | LOW |
| **TOTAL** | **100 min** | |

---

## 🚀 DEPLOYMENT ORDER

1. Deploy comments table SQL
2. Deploy admin-api with comments endpoints
3. Test comments CRUD
4. Deploy audit logging
5. Deploy feature flags (optional)

---

**Next Action:** Implement comments backend API

**After Phase 3:**
- System is feature-complete
- All critical issues resolved
- Ready for production scale
