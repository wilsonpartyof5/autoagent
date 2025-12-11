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
HEALTH=$(curl -s -w "\n%{http_code}" "$MCP_URL/mcp" 2>&1)
CURL_EXIT=$?
if [ $CURL_EXIT -ne 0 ]; then
    HEALTH_CODE="CURL_ERROR"
    HEALTH_BODY="Failed to connect: curl exited with code $CURL_EXIT. Check if server is reachable at $MCP_URL"
    echo "❌ Connection Failed: $HEALTH_BODY"
else
    HEALTH_CODE=$(echo "$HEALTH" | tail -n 1)
    HEALTH_BODY=$(echo "$HEALTH" | sed '$d')
    if ! [[ "$HEALTH_CODE" =~ ^[0-9]{3}$ ]]; then
        # Not a valid HTTP status code - curl failed but didn't exit with error
        HEALTH_CODE="CURL_ERROR"
        HEALTH_BODY="Invalid response: $HEALTH"
        echo "❌ Invalid Response: $HEALTH_BODY"
    else
        echo "Status: $HEALTH_CODE"
        if [ "$HEALTH_CODE" != "200" ]; then
            echo "Response: $HEALTH_BODY"
        fi
    fi
fi
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
        -d "$PAYLOAD" 2>&1)
    CURL_EXIT=$?
else
    FETCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck/fetch-and-ingest" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" 2>&1)
    CURL_EXIT=$?
fi

FETCH_CODE=$(echo "$FETCH_RESPONSE" | tail -n 1)
FETCH_BODY=$(echo "$FETCH_RESPONSE" | sed '$d')

if [ $CURL_EXIT -ne 0 ] || ! [[ "$FETCH_CODE" =~ ^[0-9]{3}$ ]]; then
    FETCH_CODE="CURL_ERROR"
    FETCH_BODY="Failed to connect: curl exited with code $CURL_EXIT. $FETCH_RESPONSE"
    echo "❌ Connection Failed: $FETCH_BODY"
else
    echo "Status: $FETCH_CODE"
    if [ "$FETCH_CODE" != "200" ]; then
        echo "❌ ERROR RESPONSE:"
        echo "$FETCH_BODY" | jq '.' 2>/dev/null || echo "$FETCH_BODY"
        echo ""
    fi
fi
echo ""

# Test 3: Test direct ingestion endpoint (what the dashboard calls after fetching)
echo "Test 3: Direct Ingestion Endpoint (/api/ingest/marketcheck)"
echo "-----------------------------------------------------------"
echo "This is the endpoint that returns 500"

# Sample vehicle payload (minimal, matching MarketCheck structure)
# Note: MarketCheck normalizer expects year/make/model nested under "build" object
SAMPLE_VEHICLE='{
  "id": "test-vehicle-123",
  "vin": "1HGBH41JXMN109186",
  "build": {
    "year": 2023,
    "make": "Honda",
    "model": "Civic"
  },
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
        -d "$INGEST_PAYLOAD" 2>&1)
    CURL_EXIT=$?
else
    INGEST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$MCP_URL/api/ingest/marketcheck" \
        -H "Content-Type: application/json" \
        -d "$INGEST_PAYLOAD" 2>&1)
    CURL_EXIT=$?
fi

INGEST_CODE=$(echo "$INGEST_RESPONSE" | tail -n 1)
INGEST_BODY=$(echo "$INGEST_RESPONSE" | sed '$d')

if [ $CURL_EXIT -ne 0 ] || ! [[ "$INGEST_CODE" =~ ^[0-9]{3}$ ]]; then
    INGEST_CODE="CURL_ERROR"
    INGEST_BODY="Failed to connect: curl exited with code $CURL_EXIT. $INGEST_RESPONSE"
    echo "❌ Connection Failed: $INGEST_BODY"
    echo ""
    echo "This indicates a network error, not a server 500 error."
    echo "Check:"
    echo "  - Is the MCP server URL correct? ($MCP_URL)"
    echo "  - Is the server reachable? (try: curl $MCP_URL/health)"
    echo "  - Are there network/firewall issues?"
else
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

