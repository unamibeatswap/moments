-- Populate system_settings table with default budget values
-- Run this in Supabase SQL Editor after CLEAN_SCHEMA.sql

INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
    ('monthly_budget', '3000', 'Monthly budget limit in South African Rand'),
    ('warning_threshold', '80', 'Budget warning threshold percentage'),
    ('message_cost', '0.12', 'Cost per template message in Rand'),
    ('daily_limit', '500', 'Daily spend limit in Rand')
ON CONFLICT (setting_key) 
DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();
