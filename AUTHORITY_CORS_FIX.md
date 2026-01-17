# Authority API CORS Fix

## Issue
Authority management endpoints were returning CORS errors:
```
Access to fetch at 'https://bxmdzcxejcxbinghtyfw.supabase.co/functions/v1/admin-api/authority' 
from origin 'https://moments.unamifoundation.org' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
Authority endpoints were defined in `src/admin.js` but not implemented in the `admin-api` Supabase edge function. The admin dashboard was calling the edge function URL, but the endpoints didn't exist there.

## Solution
Added authority management endpoints to `supabase/functions/admin-api/index.ts`:

### Endpoints Added
1. **GET /authority** - List authority profiles with pagination
2. **GET /authority/:id** - Get single authority profile
3. **POST /authority** - Create new authority profile
4. **PUT /authority/:id** - Update authority profile
5. **DELETE /authority/:id** - Delete authority profile

### Implementation
```typescript
// List authority profiles
if (path.includes('/authority') && method === 'GET' && !path.match(/\/authority\/[a-f0-9-]{36}/)) {
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const { data, error } = await supabase
    .from('authority_profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return new Response(JSON.stringify({ authority_profiles: data || [], page, limit }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

All endpoints return responses with CORS headers:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}
```

## Security Audit
✅ **No secrets exposed** in webhook file or markdown documentation
- All API keys use `Deno.env.get()` pattern
- No hardcoded tokens or passwords
- Supabase URL is public (not a secret)
- Documentation only shows placeholder examples

## Deployment
```bash
# Committed changes
git add -A
git commit -m "Add authority endpoints to admin-api edge function with CORS"
git push

# Deployed manually
supabase functions deploy admin-api --project-ref bxmdzcxejcxbinghtyfw
```

## Testing
Authority management UI should now work:
1. Navigate to Admin Dashboard → Authority tab
2. List authority profiles (GET request)
3. Create new authority profile (POST request)
4. Update existing profile (PUT request)
5. Delete profile (DELETE request)

All requests should succeed with proper CORS headers.

## Status
✅ **RESOLVED** - Authority endpoints now available in admin-api edge function with CORS support
