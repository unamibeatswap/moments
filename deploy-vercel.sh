#!/bin/bash

echo "🚀 Deploying Unami Foundation Moments to Vercel..."
echo "================================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Login to Vercel (if not already logged in)
echo "Checking Vercel authentication..."
vercel whoami || vercel login

# Set environment variables
echo "Setting up environment variables..."
echo "Please configure these in Vercel dashboard:"
echo ""
echo "Required Environment Variables:"
echo "- WHATSAPP_TOKEN=your_business_api_token"
echo "- WHATSAPP_PHONE_ID=your_phone_number_id" 
echo "- WEBHOOK_VERIFY_TOKEN=your_webhook_token"
echo "- SUPABASE_URL=your_supabase_url"
echo "- SUPABASE_SERVICE_KEY=your_service_key"
echo "- SUPABASE_ANON_KEY=your_supabase_anon_key"
echo "- MCP_ENDPOINT=https://mcp-production.up.railway.app/advisory"
echo "- NODE_ENV=production"
echo ""

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in Vercel dashboard"
echo "2. Set up custom domain (optional)"
echo "3. Configure WhatsApp webhook URL to your Vercel domain"
echo "4. Test the deployment"