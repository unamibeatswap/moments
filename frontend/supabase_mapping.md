# Supabase Tables → Frontend Mapping

## Enhanced Schema with Frontend Requirements

### Table: `moments`
**Purpose**: Core content for broadcasting
```sql
CREATE TABLE moments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('KZN','WC','GP','EC','FS','LP','MP','NC','NW')),
  category TEXT NOT NULL CHECK (category IN ('Education','Safety','Culture','Opportunity','Events','Health','Technology')),
  language TEXT DEFAULT 'eng',
  sponsor_id UUID REFERENCES sponsors(id),
  is_sponsored BOOLEAN DEFAULT FALSE,
  pwa_link TEXT,
  media_urls TEXT[],
  scheduled_at TIMESTAMPTZ,
  broadcasted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','scheduled','broadcasted','cancelled')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_moments_status ON moments(status);
CREATE INDEX idx_moments_scheduled ON moments(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_moments_region ON moments(region);
CREATE INDEX idx_moments_category ON moments(category);
CREATE INDEX idx_moments_created_at ON moments(created_at DESC);

-- RLS Policies
ALTER TABLE moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access" ON moments FOR ALL USING (true);
CREATE POLICY "Public read published" ON moments FOR SELECT USING (status = 'broadcasted');

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE moments;
```

**Frontend Usage**:
- `/moments` - List with filters
- `/moments/create` - Insert new
- `/moments/[id]` - View single
- `/moments/[id]/edit` - Update

### Table: `sponsors`
**Purpose**: Sponsor information and branding
```sql
CREATE TABLE sponsors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  contact_email TEXT,
  logo_url TEXT,
  website_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sponsors_active ON sponsors(active);
CREATE INDEX idx_sponsors_name ON sponsors(name);

-- RLS Policies
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage sponsors" ON sponsors FOR ALL USING (true);
CREATE POLICY "Public read active sponsors" ON sponsors FOR SELECT USING (active = true);
```

**Frontend Usage**:
- `/sponsors` - List and manage
- `/sponsors/create` - Add new sponsor
- Dropdown in moment creation

### Table: `broadcasts`
**Purpose**: Broadcast execution tracking
```sql
CREATE TABLE broadcasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  recipient_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  broadcast_started_at TIMESTAMPTZ DEFAULT NOW(),
  broadcast_completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','failed')),
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_broadcasts_moment_id ON broadcasts(moment_id);
CREATE INDEX idx_broadcasts_status ON broadcasts(status);
CREATE INDEX idx_broadcasts_started_at ON broadcasts(broadcast_started_at DESC);

-- RLS Policies
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view broadcasts" ON broadcasts FOR SELECT USING (true);
CREATE POLICY "Admin create broadcasts" ON broadcasts FOR INSERT WITH CHECK (true);
CREATE POLICY "System update broadcasts" ON broadcasts FOR UPDATE USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE broadcasts;
```

**Frontend Usage**:
- `/broadcasts` - History and status
- `/broadcasts/[id]` - Detailed view
- Real-time progress updates

### Table: `subscriptions`
**Purpose**: User subscription preferences
```sql
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  opted_in BOOLEAN DEFAULT TRUE,
  regions TEXT[] DEFAULT ARRAY['KZN','WC','GP'],
  categories TEXT[] DEFAULT ARRAY['Education','Safety','Opportunity'],
  language_preference TEXT DEFAULT 'eng',
  opted_in_at TIMESTAMPTZ DEFAULT NOW(),
  opted_out_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_phone ON subscriptions(phone_number);
CREATE INDEX idx_subscriptions_opted_in ON subscriptions(opted_in);
CREATE INDEX idx_subscriptions_regions ON subscriptions USING GIN(regions);
CREATE INDEX idx_subscriptions_last_activity ON subscriptions(last_activity DESC);

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view subscriptions" ON subscriptions FOR SELECT USING (true);
CREATE POLICY "System manage subscriptions" ON subscriptions FOR ALL USING (true);
```

**Frontend Usage**:
- `/subscribers` - Management interface
- Analytics dashboard
- Broadcast targeting

### Table: `messages` (Enhanced)
**Purpose**: Incoming WhatsApp messages
```sql
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_id TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text','image','audio','video','document')),
  content TEXT,
  media_url TEXT,
  media_id TEXT,
  language_detected TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_from_number ON messages(from_number);
CREATE INDEX idx_messages_processed ON messages(processed);
CREATE INDEX idx_messages_flagged ON messages(flagged);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view messages" ON messages FOR SELECT USING (true);
CREATE POLICY "System insert messages" ON messages FOR INSERT WITH CHECK (true);
```

**Frontend Usage**:
- `/moderation` - Review flagged content
- Analytics for message volume

### Table: `advisories` (Enhanced)
**Purpose**: MCP intelligence outputs
```sql
CREATE TABLE advisories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  advisory_type TEXT NOT NULL CHECK (advisory_type IN ('language','urgency','harm','spam','content_quality')),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  details JSONB,
  escalation_suggested BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_advisories_message_id ON advisories(message_id);
CREATE INDEX idx_advisories_moment_id ON advisories(moment_id);
CREATE INDEX idx_advisories_type ON advisories(advisory_type);
CREATE INDEX idx_advisories_escalation ON advisories(escalation_suggested);
CREATE INDEX idx_advisories_reviewed ON advisories(reviewed);

-- RLS Policies
ALTER TABLE advisories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view advisories" ON advisories FOR SELECT USING (true);
CREATE POLICY "Admin review advisories" ON advisories FOR UPDATE USING (true);
CREATE POLICY "System create advisories" ON advisories FOR INSERT WITH CHECK (true);
```

**Frontend Usage**:
- `/moderation` - Review high-confidence flags
- Content quality scoring

### Table: `flags` (Enhanced)
**Purpose**: Trust & safety markers
```sql
CREATE TABLE flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  action_taken TEXT CHECK (action_taken IN ('logged','warned','escalated','blocked')),
  notes TEXT,
  flagged_by TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_flags_message_id ON flags(message_id);
CREATE INDEX idx_flags_moment_id ON flags(moment_id);
CREATE INDEX idx_flags_severity ON flags(severity);
CREATE INDEX idx_flags_resolved ON flags(resolved);

-- RLS Policies
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage flags" ON flags FOR ALL USING (true);
```

**Frontend Usage**:
- `/moderation` - Flag resolution
- Safety dashboard

## Database Functions for Frontend

### Analytics Function
```sql
CREATE OR REPLACE FUNCTION get_dashboard_analytics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_moments', (SELECT COUNT(*) FROM moments),
    'active_subscribers', (SELECT COUNT(*) FROM subscriptions WHERE opted_in = true),
    'total_broadcasts', (SELECT COUNT(*) FROM broadcasts WHERE status = 'completed'),
    'avg_success_rate', (
      SELECT ROUND(AVG(success_count::float / NULLIF(recipient_count, 0)) * 100, 1)
      FROM broadcasts WHERE status = 'completed'
    ),
    'pending_moderation', (
      SELECT COUNT(*) FROM advisories WHERE escalation_suggested = true AND reviewed = false
    ),
    'regions_breakdown', (
      SELECT json_object_agg(region, count)
      FROM (
        SELECT region, COUNT(*) as count
        FROM moments
        WHERE status = 'broadcasted'
        GROUP BY region
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Broadcast Targeting Function
```sql
CREATE OR REPLACE FUNCTION get_broadcast_targets(
  target_regions TEXT[],
  target_categories TEXT[]
)
RETURNS TABLE(phone_number TEXT, regions TEXT[], categories TEXT[]) AS $$
BEGIN
  RETURN QUERY
  SELECT s.phone_number, s.regions, s.categories
  FROM subscriptions s
  WHERE s.opted_in = true
    AND (target_regions <@ s.regions OR s.regions = '{}')
    AND (target_categories <@ s.categories OR s.categories = '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Realtime Subscriptions Setup

### Frontend Realtime Hooks
```typescript
// hooks/useRealtimeUpdates.ts
export function useMomentsUpdates() {
  const [moments, setMoments] = useState([]);
  
  useEffect(() => {
    const channel = supabase
      .channel('moments-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'moments' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMoments(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setMoments(prev => prev.map(m => 
              m.id === payload.new.id ? payload.new : m
            ));
          }
        }
      )
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, []);
  
  return moments;
}

export function useBroadcastProgress(broadcastId: string) {
  const [progress, setProgress] = useState(null);
  
  useEffect(() => {
    const channel = supabase
      .channel(`broadcast-${broadcastId}`)
      .on('postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'broadcasts',
          filter: `id=eq.${broadcastId}`
        },
        (payload) => setProgress(payload.new)
      )
      .subscribe();
      
    return () => supabase.removeChannel(channel);
  }, [broadcastId]);
  
  return progress;
}
```

## Row Level Security Policies

### Admin Access Pattern
```sql
-- Create admin role check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- In production, check JWT claims or user roles
  RETURN true; -- Simplified for demo
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all admin tables
CREATE POLICY "Admin only access" ON moments FOR ALL USING (is_admin());
CREATE POLICY "Admin only access" ON sponsors FOR ALL USING (is_admin());
CREATE POLICY "Admin only access" ON broadcasts FOR ALL USING (is_admin());
```

### Public Read Policies
```sql
-- Public can read published moments
CREATE POLICY "Public read published moments" 
ON moments FOR SELECT 
USING (status = 'broadcasted');

-- Public can read active sponsors
CREATE POLICY "Public read active sponsors"
ON sponsors FOR SELECT
USING (active = true);
```

## Implementation Checklist

- [x] Enhanced schema with constraints and checks
- [x] Comprehensive indexing strategy
- [x] RLS policies for security
- [x] Realtime subscriptions setup
- [x] Database functions for complex queries
- [x] Frontend integration patterns
- [ ] Next.js API routes implementation
- [ ] Component library with TypeScript interfaces
- [ ] Real-time UI updates
- [ ] MCP integration triggers