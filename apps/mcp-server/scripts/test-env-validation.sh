#!/bin/bash
# Test script to verify environment variable validation
# This script tests that the server fails fast when required vars are missing

set -e

echo "🧪 Testing environment variable validation..."
echo ""

# Build first
echo "📦 Building MCP server..."
cd "$(dirname "$0")/.."
corepack pnpm build

echo ""
echo "✅ Build successful"
echo ""

# Test 1: Missing WIDGET_HOST
echo "Test 1: Missing WIDGET_HOST"
unset WIDGET_HOST
if node dist/config/check-env.js 2>&1 | grep -q "WIDGET_HOST is missing"; then
  echo "  ✅ Correctly fails when WIDGET_HOST is missing"
else
  echo "  ❌ Did not fail as expected"
  exit 1
fi

# Test 2: Missing MARKETCHECK_API_KEY
echo ""
echo "Test 2: Missing MARKETCHECK_API_KEY"
export WIDGET_HOST="https://test.example.com"
unset MARKETCHECK_API_KEY
if node dist/config/check-env.js 2>&1 | grep -q "MARKETCHECK_API_KEY is missing"; then
  echo "  ✅ Correctly fails when MARKETCHECK_API_KEY is missing"
else
  echo "  ❌ Did not fail as expected"
  exit 1
fi

# Test 3: Missing LEAD_ENC_KEY
echo ""
echo "Test 3: Missing LEAD_ENC_KEY"
export MARKETCHECK_API_KEY="test-key"
unset LEAD_ENC_KEY
if node dist/config/check-env.js 2>&1 | grep -q "LEAD_ENC_KEY is missing"; then
  echo "  ✅ Correctly fails when LEAD_ENC_KEY is missing"
else
  echo "  ❌ Did not fail as expected"
  exit 1
fi

# Test 4: Invalid LEAD_ENC_KEY (wrong length)
echo ""
echo "Test 4: Invalid LEAD_ENC_KEY (wrong length)"
export LEAD_ENC_KEY="invalid"
if node dist/config/check-env.js 2>&1 | grep -q "LEAD_ENC_KEY must be"; then
  echo "  ✅ Correctly fails when LEAD_ENC_KEY is invalid"
else
  echo "  ❌ Did not fail as expected"
  exit 1
fi

# Test 5: All required vars set
echo ""
echo "Test 5: All required vars set"
export LEAD_ENC_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
export DASHBOARD_INGEST_URL="https://test.example.com/api/ingest/lead"
export DASHBOARD_INGEST_TOKEN="test-token"
if node dist/config/check-env.js 2>&1 | grep -q "All required environment variables are set"; then
  echo "  ✅ Correctly passes when all required vars are set"
else
  echo "  ❌ Did not pass as expected"
  exit 1
fi

echo ""
echo "✅ All environment validation tests passed!"

