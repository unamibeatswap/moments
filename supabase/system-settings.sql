-- System Settings Table for Admin Control
CREATE TABLE system_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type TEXT DEFAULT 'text' CHECK (setting_type IN ('text','url','boolean','number','json')),
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);

-- RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage settings" ON system_settings FOR ALL USING (is_admin());

-- Default settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('app_name', 'Unami Foundation Moments', 'text', 'Application name displayed in header'),
('app_logo', '/logo.png', 'url', 'Application logo URL'),
('primary_color', '#2563eb', 'text', 'Primary brand color'),
('whatsapp_number', '+27 65 829 5041', 'text', 'WhatsApp Business number'),
('support_email', 'support@unamifoundation.org', 'text', 'Support contact email'),
('max_moments_per_day', '10', 'number', 'Maximum moments that can be broadcasted per day'),
('auto_broadcast_enabled', 'true', 'boolean', 'Enable automatic scheduled broadcasting'),
('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
('analytics_enabled', 'true', 'boolean', 'Enable analytics tracking'),
('default_region', 'KZN', 'text', 'Default region for new moments');

-- Function to get setting value
CREATE OR REPLACE FUNCTION get_setting(key TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT setting_value INTO result FROM system_settings WHERE setting_key = key;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update setting
CREATE OR REPLACE FUNCTION update_setting(key TEXT, value TEXT, updated_by_user TEXT DEFAULT 'admin')
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE system_settings 
  SET setting_value = value, updated_by = updated_by_user, updated_at = NOW()
  WHERE setting_key = key;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;