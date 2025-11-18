#!/bin/bash

# AutoAgent Dealer Dashboard - Vercel Deployment Script
# This script helps deploy the dealer dashboard to Vercel

set -e

echo "🚀 Deploying AutoAgent Dealer Dashboard to Vercel"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Navigate to dealer dashboard directory
cd "$(dirname "$0")/../apps/dealer-dashboard"

echo "📦 Current directory: $(pwd)"
echo ""

# Check if .vercel directory exists (project already linked)
if [ -d ".vercel" ]; then
    echo "✅ Project already linked to Vercel"
    echo "🚀 Deploying to production..."
    vercel --prod
else
    echo "🔗 Linking project to Vercel..."
    echo "   Follow the prompts:"
    echo "   - Set up and deploy? Yes"
    echo "   - Which scope? (select your account)"
    echo "   - Link to existing project? No (for first deploy)"
    echo "   - Project name: autoagent-dealer-dashboard"
    echo "   - Directory: ./ (current directory)"
    echo ""
    vercel
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Set environment variables in Vercel Dashboard:"
echo "      - NEXT_PUBLIC_SUPABASE_URL"
echo "      - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   2. Configure Supabase redirect URLs"
echo "   3. Test the deployment"
echo ""

