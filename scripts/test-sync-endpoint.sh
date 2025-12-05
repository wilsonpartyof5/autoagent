#!/bin/bash

# Test script to debug MarketCheck sync endpoint
# This script tests the MCP server endpoint directly

set -e

echo "🔍 Testing MarketCheck Sync Endpoint"
echo ""

# Check if environment variables are set
if [ -z "$MCP_SERVER_URL" ] && [ -z "$INGESTION_SERVICE_URL" ]; then
    echo "❌ Error: MCP_SERVER_URL or INGESTION_SERVICE_URL must be set"
    echo ""
    echo "Set it with:"
    echo "  export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app"
    exit 1
fi

MCP_URL="${MCP_SERVER_URL:-$INGESTION_SERVICE_URL}"

if [ -z "$INGESTION_API_TOKEN" ] && [ -z "$MCP_SERVER_TOKEN" ]; then
    echo "⚠️  Warning: INGESTION_API_TOKEN not set (auth may fail)"
    TOKEN=""
else
    TOKEN="${INGESTION_API_TOKEN:-$MCP_SERVER_TOKEN}"
fi

# Default dealer ID (Rock Hill GMC)
DEALER_ID="${1:-11042155}"
SOURCE="${2:-myrockhillgmc.com}"
ZIP="${3:-}"
RADIUS="${4:-50}"

echo "Configuration:"
echo "  MCP Server URL: $MCP_URL"
echo "  Token: ${TOKEN:+***REDACTED***}"
echo "  Dealer ID: $DEALER_ID"
echo "  Source: $SOURCE"
echo "  Zip: ${ZIP:-(none)}"
echo "  Radius: $RADIUS"
echo ""

# Build request payload
PAYLOAD=$(cat <<EOF
{
  "dealerId": "$DEALER_ID",
  "source": "$SOURCE",
  "radiusMiles": $RADIUS,
  "condition": "all"
}
EOF
)

if [ -n "$ZIP" ]; then
    PAYLOAD=$(echo "$PAYLOAD" | jq ". + {zip: \"$ZIP\"}")
fi

echo "📡 Sending request to: $MCP_URL/api/ingest/marketcheck/fetch-and-ingest"
echo ""

# Make the request
if [ -n "$TOKEN" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck/fetch-and-ingest" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$PAYLOAD")
else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck/fetch-and-ingest" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD")
fi

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "✅ Success!"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo "❌ Error!"
    echo ""
    echo "Response body:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    echo "Full response:"
    echo "$RESPONSE"
fi

