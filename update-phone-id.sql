-- Update WHATSAPP_PHONE_ID in Supabase secrets
-- Run this in Supabase dashboard or via API
UPDATE vault.secrets 
SET secret = '997749243410302' 
WHERE name = 'WHATSAPP_PHONE_ID';