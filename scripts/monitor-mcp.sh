#!/bin/bash

# AutoAgent MCP Server Monitor
# This script monitors the MCP server and provides comprehensive debugging

set -e

SERVER_URL="https://rana-flightiest-malcolm.ngrok-free.dev"
MCP_ENDPOINT="$SERVER_URL/mcp"
HEALTH_ENDPOINT="$SERVER_URL/health"

echo "🔍 AutoAgent MCP Server Monitor"
echo "================================"
echo "Server URL: $SERVER_URL"
echo "MCP Endpoint: $MCP_ENDPOINT"
echo "Health Endpoint: $HEALTH_ENDPOINT"
echo ""

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="${4:-}"
    
    echo "🧪 Testing $name..."
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null || echo "ERROR")
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo "ERROR")
    fi
    
    if [ "$response" = "ERROR" ]; then
        echo "❌ $name: Connection failed"
        return 1
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "✅ $name: HTTP $http_code"
        echo "📄 Response: $body" | jq . 2>/dev/null || echo "📄 Response: $body"
        return 0
    else
        echo "❌ $name: HTTP $http_code"
        echo "📄 Response: $body"
        return 1
    fi
}

# Test health endpoint
test_endpoint "Health Check" "$HEALTH_ENDPOINT"

echo ""

# Test MCP initialize
test_endpoint "MCP Initialize" "$MCP_ENDPOINT" "POST" '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"monitor","version":"1.0.0"}}}'

echo ""

# Test MCP tools/list
test_endpoint "MCP Tools List" "$MCP_ENDPOINT" "POST" '{"method":"tools/list"}'

echo ""

# Test MCP resources/list
test_endpoint "MCP Resources List" "$MCP_ENDPOINT" "POST" '{"method":"resources/list"}'

echo ""
echo "🎯 Monitor complete!"
echo ""
echo "💡 If any tests fail:"
echo "   1. Check if the server is running: cd /Users/mac/AutoAgent/apps/mcp-server && npx tsx src/index.ts"
echo "   2. Check if ngrok is running: npx ngrok http 8787"
echo "   3. Check server logs for detailed error information"
echo ""
echo "🔧 To restart everything:"
echo "   pkill -f 'tsx.*index.ts' && pkill -f ngrok"
echo "   cd /Users/mac/AutoAgent/apps/mcp-server && npx tsx src/index.ts &"
echo "   npx ngrok http 8787 &"
