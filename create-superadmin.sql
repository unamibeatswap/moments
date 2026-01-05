-- Create admin_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'content_admin', 'moderator', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert superadmin user
INSERT INTO admin_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'superadmin')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- Verify the insert
SELECT user_id, role, created_at FROM admin_roles WHERE role = 'superadmin';