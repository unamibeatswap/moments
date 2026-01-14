-- Comments Table for Moments
-- Enables community engagement and discussion

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(content) >= 1 AND length(content) <= 500),
  featured BOOLEAN DEFAULT false,
  reply_count INTEGER DEFAULT 0,
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_moment_id ON comments(moment_id);
CREATE INDEX IF NOT EXISTS idx_comments_moderation ON comments(moderation_status);
CREATE INDEX IF NOT EXISTS idx_comments_featured ON comments(featured) WHERE featured = true;

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin full access" ON comments FOR ALL USING (is_admin());
CREATE POLICY "Public read approved" ON comments FOR SELECT USING (moderation_status = 'approved');

-- Update trigger
CREATE TRIGGER update_comments_updated_at 
  BEFORE UPDATE ON comments 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON comments TO anon, authenticated;
GRANT ALL ON comments TO service_role;
