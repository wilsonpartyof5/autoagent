#!/bin/bash

# Health check script for AutoAgent MCP Server
# Usage: ./scripts/health-check.sh

BASE_URL="https://rana-flightiest-malcolm.ngrok-free.dev"
TIMEOUT=10

echo "🏥 AutoAgent MCP Server Health Check"
echo "=================================="

# Check MCP endpoint
echo "📡 Testing MCP endpoint..."
MCP_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT "$BASE_URL/mcp" -X POST \
  -H "Content-Type: application/json" \
  -H "User-Agent: openai-mcp/1.0.0" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"openai-mcp","version":"1.0.0"}}}')

if [ "$MCP_RESPONSE" = "200" ]; then
  echo "✅ MCP endpoint: OK"
else
  echo "❌ MCP endpoint: FAILED (HTTP $MCP_RESPONSE)"
fi

# Check ping widget
echo "🎯 Testing ping widget..."
PING_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT "$BASE_URL/widget/ping")

if [ "$PING_RESPONSE" = "200" ]; then
  echo "✅ Ping widget: OK"
else
  echo "❌ Ping widget: FAILED (HTTP $PING_RESPONSE)"
fi

# Check vehicle widget
echo "🚗 Testing vehicle widget..."
VEHICLE_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT "$BASE_URL/widget/vehicle-results")

if [ "$VEHICLE_RESPONSE" = "200" ]; then
  echo "✅ Vehicle widget: OK"
else
  echo "❌ Vehicle widget: FAILED (HTTP $VEHICLE_RESPONSE)"
fi

# Check CSP headers
echo "🔒 Testing CSP headers..."
CSP_HEADER=$(curl -s -I --max-time $TIMEOUT "$BASE_URL/widget/ping" | grep -i "content-security-policy")

if [[ $CSP_HEADER == *"frame-ancestors https://chat.openai.com https://chatgpt.com"* ]]; then
  echo "✅ CSP headers: OK"
else
  echo "❌ CSP headers: MISSING or INCORRECT"
fi

echo "=================================="
echo "Health check complete"
