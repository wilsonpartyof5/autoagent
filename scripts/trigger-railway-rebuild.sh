#!/bin/bash
# Script to trigger Railway rebuild by updating cache-busting file
# Usage: ./scripts/trigger-railway-rebuild.sh

set -e

echo "🔄 Triggering Railway rebuild..."

# Update the rebuild trigger file with current timestamp
echo "# Railway rebuild trigger - $(date)" > .railway-rebuild
echo "Build triggered at: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" >> .railway-rebuild

# Commit and push
git add .railway-rebuild
git commit -m "Trigger Railway rebuild - $(date +%Y-%m-%d)" || echo "No changes to commit"
git push origin main

echo "✅ Rebuild trigger pushed to GitHub"
echo "📦 Railway should detect the change and start a new build"
echo ""
echo "💡 To verify:"
echo "   1. Check Railway dashboard for new deployment"
echo "   2. Monitor build logs for the latest commit"
echo "   3. Verify build uses latest pnpm-lock.yaml"

