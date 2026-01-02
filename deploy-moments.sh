#!/bin/bash

echo "🚀 Deploying Unami Foundation Moments App..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    exit 1
fi

# Load environment variables
source .env

echo "📊 Setting up database schema..."

# Apply original schema
if [ -f "supabase/schema.sql" ]; then
    echo "Applying base schema..."
    # Note: In production, run this via Supabase dashboard or CLI
    echo "Run supabase/schema.sql in your Supabase dashboard"
fi

# Apply Moments schema
if [ -f "supabase/moments-schema.sql" ]; then
    echo "Applying Moments schema..."
    echo "Run supabase/moments-schema.sql in your Supabase dashboard"
fi

echo "📦 Installing dependencies..."
npm install

echo "🧪 Running tests..."
npm test

echo "🔧 Building application..."
# No build step needed for this Node.js app

echo "✅ Deployment preparation complete!"
echo ""
echo "Next steps:"
echo "1. Run the SQL files in your Supabase dashboard"
echo "2. Configure WhatsApp Business API webhook to point to /webhook"
echo "3. Set up Railway deployment with environment variables"
echo "4. Access admin dashboard at your deployed URL"
echo ""
echo "Local development:"
echo "npm start - Start the server"
echo "Open http://localhost:3000 for admin dashboard"