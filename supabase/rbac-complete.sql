-- Complete RBAC Schema for Unami Foundation Moments
-- This file creates the admin_roles table and RBAC functions

-- Admin roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'content_admin', 'moderator', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Enable RLS on admin_roles
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON admin_roles(role);

-- Function to check admin role
-- Skip function recreation if it already exists with dependencies

-- Function to get current user role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
  user_uuid UUID;
  user_role TEXT;
BEGIN
  user_uuid := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
  
  IF user_uuid IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT role INTO user_role
  FROM admin_roles
  WHERE user_id = user_uuid;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger for admin_roles
CREATE OR REPLACE FUNCTION update_admin_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_roles_updated_at
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_roles_updated_at();

-- Audit log table for role changes
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  user_uuid UUID;
BEGIN
  user_uuid := (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, operation, old_values, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), user_uuid);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, operation, old_values, new_values, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW), user_uuid);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, operation, new_values, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW), user_uuid);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add audit triggers to admin_roles
CREATE TRIGGER audit_admin_roles
  AFTER INSERT OR UPDATE OR DELETE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Webhook tokens table for secure API access
CREATE TABLE IF NOT EXISTS webhook_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_name TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  permissions TEXT[] DEFAULT ARRAY['webhook'],
  active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Enable RLS on webhook_tokens
ALTER TABLE webhook_tokens ENABLE ROW LEVEL SECURITY;

-- System settings table for configuration
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('whatsapp_number', '"+27 65 829 5041"', 'WhatsApp Business number for broadcasts'),
('broadcast_rate_limit', '100', 'Maximum broadcasts per minute'),
('mcp_endpoint', '"supabase-native"', 'MCP advisory service endpoint - using Supabase native function'),
('default_language', '"eng"', 'Default language for content'),
('supported_regions', '["KZN","WC","GP","EC","FS","LP","MP","NC","NW"]', 'Supported South African provinces'),
('supported_categories', '["Education","Safety","Culture","Opportunity","Events","Health","Technology"]', 'Supported content categories')
ON CONFLICT (setting_key) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE admin_roles IS 'User role assignments for admin access control';
COMMENT ON TABLE audit_log IS 'Audit trail for all administrative actions';
COMMENT ON TABLE webhook_tokens IS 'Secure tokens for webhook and API access';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';
COMMENT ON FUNCTION check_admin_role(TEXT) IS 'Check if current user has required admin role with hierarchy';
COMMENT ON FUNCTION get_current_user_role() IS 'Get the current authenticated user role';