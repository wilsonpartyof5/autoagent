#!/bin/bash

# Diagnostic script to test MCP ingestion endpoint and identify 500 errors
# This will help identify the root cause of the ingestion failure

set -e

MCP_URL="${MCP_SERVER_URL:-https://autoagentmcp-server-production.up.railway.app}"
TOKEN="${INGESTION_API_TOKEN:-${MCP_SERVER_TOKEN}}"

echo "🔍 Diagnosing MCP Ingestion 500 Error"
echo "======================================"
echo ""
echo "MCP Server URL: $MCP_URL"
echo "Token: ${TOKEN:+***SET***}"
echo ""

# Test 1: Check MCP server health
echo "Test 1: MCP Server Health Check"
echo "-------------------------------"
HEALTH=$(curl -s -w "\n%{http_code}" "$MCP_URL/mcp" || echo "FAILED")
HEALTH_CODE=$(echo "$HEALTH" | tail -n 1)
HEALTH_BODY=$(echo "$HEALTH" | sed '$d')
echo "Status: $HEALTH_CODE"
echo ""

# Test 2: Test fetch-and-ingest endpoint (the one that's failing)
echo "Test 2: Fetch-and-Ingest Endpoint"
echo "----------------------------------"
DEALER_ID="${1:-11042155}"
SOURCE="${2:-myrockhillgmc.com}"

PAYLOAD=$(cat <<EOF
{
  "dealerId": "$DEALER_ID",
  "source": "$SOURCE",
  "radiusMiles": 50,
  "condition": "all"
}
EOF
)

if [ -n "$TOKEN" ]; then
    FETCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck/fetch-and-ingest" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$PAYLOAD" 2>&1 || echo "CURL_ERROR")
else
    FETCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck/fetch-and-ingest" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" 2>&1 || echo "CURL_ERROR")
fi

FETCH_CODE=$(echo "$FETCH_RESPONSE" | tail -n 1)
FETCH_BODY=$(echo "$FETCH_RESPONSE" | sed '$d')

echo "Status: $FETCH_CODE"
if [ "$FETCH_CODE" != "200" ]; then
    echo "❌ ERROR RESPONSE:"
    echo "$FETCH_BODY" | jq '.' 2>/dev/null || echo "$FETCH_BODY"
    echo ""
fi
echo ""

# Test 3: Test direct ingestion endpoint (what the dashboard calls after fetching)
echo "Test 3: Direct Ingestion Endpoint (/api/ingest/marketcheck)"
echo "-----------------------------------------------------------"
echo "This is the endpoint that returns 500"

# Sample vehicle payload (minimal)
SAMPLE_VEHICLE='{
  "id": "test-vehicle-123",
  "vin": "1HGBH41JXMN109186",
  "year": 2023,
  "make": "Honda",
  "model": "Civic",
  "dealer": {
    "id": "11042155",
    "name": "Test Dealer"
  }
}'

INGEST_PAYLOAD=$(cat <<EOF
{
  "vehicles": [$SAMPLE_VEHICLE],
  "options": {
    "provider": "marketcheck",
    "dealerId": "$DEALER_ID",
    "dataSource": "marketcheck-api",
    "deletionStrategy": "mark_unavailable"
  }
}
EOF
)

if [ -n "$TOKEN" ]; then
    INGEST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$INGEST_PAYLOAD" 2>&1 || echo "CURL_ERROR")
else
    INGEST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck" \
        -H "Content-Type: application/json" \
        -d "$INGEST_PAYLOAD" 2>&1 || echo "CURL_ERROR")
fi

INGEST_CODE=$(echo "$INGEST_RESPONSE" | tail -n 1)
INGEST_BODY=$(echo "$INGEST_RESPONSE" | sed '$d')

echo "Status: $INGEST_CODE"
if [ "$INGEST_CODE" != "200" ]; then
    echo "❌ ERROR RESPONSE (This is the 500 we need to fix):"
    echo "$INGEST_BODY" | jq '.' 2>/dev/null || echo "$INGEST_BODY"
    echo ""
    echo "Full error:"
    echo "$INGEST_BODY"
else
    echo "✅ Success!"
    echo "$INGEST_BODY" | jq '.' 2>/dev/null || echo "$INGEST_BODY"
fi
echo ""

echo "======================================"
echo "Summary:"
echo "  Health Check: $HEALTH_CODE"
echo "  Fetch-and-Ingest: $FETCH_CODE"
echo "  Direct Ingestion: $INGEST_CODE"
echo ""
echo "If ingestion returns 500, check Railway logs for:"
echo "  - Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
echo "  - Database connection errors"
echo "  - Schema errors (missing uvs_vehicles table)"
echo ""

