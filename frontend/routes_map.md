# Frontend Routes → Supabase Mapping

## Next.js App Router Structure

```
app/
├── layout.tsx                 # Root layout with auth
├── page.tsx                   # Dashboard home
├── moments/
│   ├── page.tsx              # Moments list
│   ├── create/page.tsx       # Create moment
│   ├── [id]/
│   │   ├── page.tsx          # View moment
│   │   └── edit/page.tsx     # Edit moment
│   └── scheduled/page.tsx    # Scheduled moments
├── sponsors/
│   ├── page.tsx              # Sponsors list
│   └── create/page.tsx       # Create sponsor
├── broadcasts/
│   ├── page.tsx              # Broadcast history
│   └── [id]/page.tsx         # Broadcast details
├── moderation/
│   ├── page.tsx              # Flagged content
│   └── [id]/page.tsx         # Review content
├── analytics/page.tsx         # Analytics dashboard
├── subscribers/page.tsx       # Subscriber management
└── api/
    ├── moments/route.ts       # Moments CRUD
    ├── broadcasts/route.ts    # Broadcast management
    └── analytics/route.ts     # Analytics data
```

## Route → Table Mappings

### 1. Dashboard (`/`)
**Tables**: `moments`, `broadcasts`, `subscriptions`, `advisories`
```sql
-- Analytics query
SELECT 
  COUNT(*) as total_moments FROM moments;
SELECT 
  COUNT(*) as active_subscribers FROM subscriptions WHERE opted_in = true;
SELECT 
  AVG(success_count::float / NULLIF(recipient_count, 0)) as success_rate 
  FROM broadcasts;
```
**RLS**: Public read for aggregates
**Realtime**: Subscribe to `moments:status=broadcasted`

### 2. Moments List (`/moments`)
**Primary Table**: `moments`
**Joins**: `sponsors`, `broadcasts`
```sql
SELECT m.*, s.display_name as sponsor_name, 
       b.recipient_count, b.success_count
FROM moments m
LEFT JOIN sponsors s ON m.sponsor_id = s.id
LEFT JOIN broadcasts b ON b.moment_id = m.id
ORDER BY m.created_at DESC;
```
**Columns**: `id`, `title`, `content`, `region`, `category`, `status`, `created_at`, `is_sponsored`
**Indexes**: `idx_moments_status`, `idx_moments_region`
**RLS**: Admin read/write access
**Realtime**: Subscribe to `moments` table changes

### 3. Create Moment (`/moments/create`)
**Primary Table**: `moments`
**Related**: `sponsors` (dropdown)
```sql
INSERT INTO moments (title, content, region, category, sponsor_id, is_sponsored, scheduled_at, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 IS NULL THEN 'draft' ELSE 'scheduled' END);
```
**Validation**: Required fields, region enum, category enum
**MCP Trigger**: Content analysis on insert

### 4. Edit Moment (`/moments/[id]/edit`)
**Primary Table**: `moments`
**Constraint**: Cannot edit if `status = 'broadcasted'`
```sql
UPDATE moments 
SET title = $1, content = $2, region = $3, category = $4, sponsor_id = $5
WHERE id = $6 AND status != 'broadcasted';
```
**RLS**: Admin write access, status check

### 5. Sponsors (`/sponsors`)
**Primary Table**: `sponsors`
```sql
SELECT id, name, display_name, contact_email, active, created_at
FROM sponsors 
WHERE active = true
ORDER BY display_name;
```
**Columns**: All sponsor fields
**RLS**: Admin read/write

### 6. Broadcasts (`/broadcasts`)
**Primary Table**: `broadcasts`
**Joins**: `moments`
```sql
SELECT b.*, m.title, m.region, m.category
FROM broadcasts b
JOIN moments m ON b.moment_id = m.id
ORDER BY b.broadcast_started_at DESC;
```
**Columns**: `id`, `moment_id`, `recipient_count`, `success_count`, `failure_count`, `status`
**Realtime**: Subscribe to broadcast status changes

### 7. Moderation (`/moderation`)
**Primary Table**: `messages`
**Joins**: `advisories`, `flags`
```sql
SELECT m.*, a.advisory_type, a.confidence, a.escalation_suggested
FROM messages m
JOIN advisories a ON m.id = a.message_id
WHERE a.confidence > 0.7 OR a.escalation_suggested = true
ORDER BY m.created_at DESC;
```
**Columns**: `id`, `content`, `from_number`, `created_at`, `advisory_type`, `confidence`
**RLS**: Admin read access

### 8. Subscribers (`/subscribers`)
**Primary Table**: `subscriptions`
```sql
SELECT phone_number, opted_in, regions, categories, language_preference, 
       opted_in_at, last_activity
FROM subscriptions
ORDER BY last_activity DESC;
```
**Columns**: All subscription fields
**Privacy**: Phone numbers masked in UI
**RLS**: Admin read access only

## Component Suggestions

### Core Components
```typescript
// components/MomentCard.tsx
interface MomentCardProps {
  moment: Moment & { sponsor?: Sponsor; broadcast?: Broadcast };
  onBroadcast?: (id: string) => void;
  onEdit?: (id: string) => void;
}

// components/BroadcastStatus.tsx
interface BroadcastStatusProps {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  successRate?: number;
}

// components/RegionFilter.tsx
interface RegionFilterProps {
  selected: string[];
  onChange: (regions: string[]) => void;
}
```

### Form Components
```typescript
// components/forms/MomentForm.tsx
interface MomentFormData {
  title: string;
  content: string;
  region: string;
  category: string;
  sponsor_id?: string;
  scheduled_at?: string;
  pwa_link?: string;
}

// components/forms/SponsorForm.tsx
interface SponsorFormData {
  name: string;
  display_name: string;
  contact_email?: string;
}
```

## Supabase Configuration

### RLS Policies
```sql
-- Moments policies
CREATE POLICY "Admin full access" ON moments FOR ALL USING (true);
CREATE POLICY "Public read published" ON moments FOR SELECT USING (status = 'broadcasted');

-- Sponsors policies  
CREATE POLICY "Admin manage sponsors" ON sponsors FOR ALL USING (true);

-- Broadcasts policies
CREATE POLICY "Admin view broadcasts" ON broadcasts FOR SELECT USING (true);

-- Subscriptions policies
CREATE POLICY "Admin view subscriptions" ON subscriptions FOR SELECT USING (true);
```

### Realtime Subscriptions
```typescript
// hooks/useRealtimeUpdates.ts
const supabase = createClient();

// Subscribe to moment status changes
supabase
  .channel('moments-updates')
  .on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'moments' },
    (payload) => {
      // Update UI when moment status changes
    }
  )
  .subscribe();

// Subscribe to broadcast progress
supabase
  .channel('broadcast-updates')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'broadcasts' },
    (payload) => {
      // Update broadcast progress in real-time
    }
  )
  .subscribe();
```

### Database Functions
```sql
-- Get analytics summary
CREATE OR REPLACE FUNCTION get_analytics_summary()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_moments', (SELECT COUNT(*) FROM moments),
    'active_subscribers', (SELECT COUNT(*) FROM subscriptions WHERE opted_in = true),
    'total_broadcasts', (SELECT COUNT(*) FROM broadcasts),
    'avg_success_rate', (
      SELECT ROUND(AVG(success_count::float / NULLIF(recipient_count, 0)) * 100, 1)
      FROM broadcasts WHERE status = 'completed'
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## MCP Integration Points

### Content Analysis Triggers
```sql
-- Trigger MCP analysis on moment creation
CREATE OR REPLACE FUNCTION trigger_mcp_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- Call MCP advisory API for content analysis
  PERFORM net.http_post(
    url := 'https://mcp-production.up.railway.app/advisory',
    body := json_build_object(
      'content', NEW.content,
      'type', 'moment',
      'region', NEW.region,
      'category', NEW.category
    )::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER moments_mcp_analysis
  AFTER INSERT ON moments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mcp_analysis();
```

## API Route Implementations

### `/api/moments/route.ts`
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const region = searchParams.get('region');
  
  let query = supabase
    .from('moments')
    .select(`
      *,
      sponsors(display_name),
      broadcasts(recipient_count, success_count, status)
    `)
    .order('created_at', { ascending: false });
    
  if (status) query = query.eq('status', status);
  if (region) query = query.eq('region', region);
  
  const { data, error } = await query;
  return Response.json({ data, error });
}

export async function POST(request: Request) {
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('moments')
    .insert(body)
    .select()
    .single();
    
  return Response.json({ data, error });
}
```

### `/api/broadcasts/route.ts`
```typescript
export async function POST(request: Request) {
  const { moment_id } = await request.json();
  
  // Start broadcast process
  const { data, error } = await supabase
    .from('broadcasts')
    .insert({ moment_id, status: 'pending' })
    .select()
    .single();
    
  if (!error) {
    // Trigger broadcast worker
    await fetch('/api/workers/broadcast', {
      method: 'POST',
      body: JSON.stringify({ broadcast_id: data.id })
    });
  }
  
  return Response.json({ data, error });
}
```

## Implementation Priority

1. **Core Routes** - Dashboard, moments list/create
2. **Broadcast System** - Immediate and scheduled broadcasting  
3. **Real-time Updates** - Status changes, progress tracking
4. **Moderation Interface** - Flagged content review
5. **Analytics Dashboard** - Metrics and reporting
6. **Subscriber Management** - Opt-in/out tracking

## Next Steps

1. Set up Next.js project with App Router
2. Configure Supabase client with RLS policies
3. Implement core CRUD operations
4. Add real-time subscriptions
5. Integrate MCP advisory triggers
6. Build responsive UI components