#!/bin/bash
# Monitor Railway service for incoming requests
# Usage: bash scripts/monitorRailwayRequests.sh

set -e

RAILWAY_URL="https://autoagentmcp-server-production.up.railway.app"

echo "🔍 Railway Request Monitor"
echo "=========================="
echo "Service: $RAILWAY_URL"
echo ""
echo "This script will test the endpoint every 5 seconds."
echo "When you click 'Create' in ChatGPT, watch for activity here."
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Function to test endpoint and show timestamp
test_endpoint() {
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X POST "$RAILWAY_URL/mcp" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"monitor","version":"1.0.0"}}}' 2>/dev/null)
    
    http_code=$(echo "$response" | tail -n 2 | head -n 1)
    time_total=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ]; then
        echo "[$timestamp] ✅ Endpoint responding (HTTP $http_code, ${time_total}s)"
    else
        echo "[$timestamp] ⚠️  Endpoint returned HTTP $http_code (${time_total}s)"
    fi
}

# Monitor loop
while true; do
    test_endpoint
    sleep 5
done

