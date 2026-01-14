#!/bin/bash
# Deploy WhatsApp comments integration

echo "🚀 Deploying WhatsApp comments schema..."
supabase db execute --file supabase/whatsapp_comments.sql

echo "🚀 Redeploying webhook function..."
supabase functions deploy webhook

echo "🚀 Deploying notification sender..."
supabase functions deploy notification-sender

echo "✅ WhatsApp comments deployed!"
echo ""
echo "📱 Features:"
echo "  - Reply to moments via WhatsApp"
echo "  - Comment notifications"
echo "  - Voice note support (future)"
echo "  - Media comments (future)"
echo ""
echo "🔧 Setup cron job for notifications:"
echo "  supabase functions invoke notification-sender --schedule '*/5 * * * *'"
