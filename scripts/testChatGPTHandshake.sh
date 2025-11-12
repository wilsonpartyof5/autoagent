#!/bin/bash

# AutoAgent ChatGPT MCP Handshake Test Script
# Tests the MCP protocol handshake sequence required for ChatGPT connector validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if URL provided
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: MCP server URL required${NC}"
  echo "Usage: $0 <mcp-server-url>"
  echo "Example: $0 https://abc123.ngrok-free.dev"
  exit 1
fi

MCP_URL="$1"
MCP_ENDPOINT="${MCP_URL%/}/mcp"
HEALTH_ENDPOINT="${MCP_URL%/}/health"

echo "🧪 AutoAgent ChatGPT MCP Handshake Test"
echo "========================================"
echo "MCP Server URL: $MCP_URL"
echo "MCP Endpoint: $MCP_ENDPOINT"
echo "Health Endpoint: $HEALTH_ENDPOINT"
echo ""

# Function to test endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local method="${3:-GET}"
  local data="${4:-}"
  
  echo -e "${YELLOW}🧪 Testing $name...${NC}"
  
  if [ "$method" = "POST" ] && [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$url" 2>/dev/null || echo "ERROR")
  else
    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo "ERROR")
  fi
  
  if [ "$response" = "ERROR" ]; then
    echo -e "${RED}❌ $name: Connection failed${NC}"
    return 1
  fi
  
  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✅ $name: HTTP $http_code${NC}"
    if command -v jq &> /dev/null; then
      echo "$body" | jq . 2>/dev/null || echo "$body"
    else
      echo "$body"
    fi
    return 0
  else
    echo -e "${RED}❌ $name: HTTP $http_code${NC}"
    echo "$body"
    return 1
  fi
}

# Test 1: Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if ! test_endpoint "Health Check" "$HEALTH_ENDPOINT"; then
  echo -e "${RED}❌ Health check failed. Is the MCP server running?${NC}"
  exit 1
fi
echo ""

# Test 2: MCP Initialize
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: MCP Initialize"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
INIT_REQUEST='{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": {
      "name": "chatgpt",
      "version": "1.0.0"
    }
  }
}'

if ! test_endpoint "MCP Initialize" "$MCP_ENDPOINT" "POST" "$INIT_REQUEST"; then
  echo -e "${RED}❌ Initialize failed. Check MCP server logs.${NC}"
  exit 1
fi

# Check for required fields in initialize response
if echo "$body" | grep -q '"initialized"'; then
  echo -e "${GREEN}✅ Initialize response includes 'initialized' field${NC}"
else
  echo -e "${YELLOW}⚠️  Initialize response missing 'initialized' field${NC}"
fi

if echo "$body" | grep -q '"serverInfo"'; then
  echo -e "${GREEN}✅ Initialize response includes 'serverInfo'${NC}"
else
  echo -e "${YELLOW}⚠️  Initialize response missing 'serverInfo'${NC}"
fi
echo ""

# Test 3: MCP Tools List
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: MCP Tools List"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOOLS_LIST_REQUEST='{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}'

if ! test_endpoint "MCP Tools List" "$MCP_ENDPOINT" "POST" "$TOOLS_LIST_REQUEST"; then
  echo -e "${RED}❌ Tools list failed. Check MCP server logs.${NC}"
  exit 1
fi

# Check for required tools
if echo "$body" | grep -q '"search-vehicles"'; then
  echo -e "${GREEN}✅ 'search-vehicles' tool found${NC}"
else
  echo -e "${RED}❌ 'search-vehicles' tool NOT found${NC}"
fi

if echo "$body" | grep -q '"submit-lead"'; then
  echo -e "${GREEN}✅ 'submit-lead' tool found${NC}"
else
  echo -e "${RED}❌ 'submit-lead' tool NOT found${NC}"
fi
echo ""

# Test 4: Widget Endpoint
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Widget Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
WIDGET_URL="${MCP_URL%/}/widget/vehicle-results"
widget_headers=$(curl -s -I "$WIDGET_URL" 2>/dev/null || echo "ERROR")

if [ "$widget_headers" = "ERROR" ]; then
  echo -e "${RED}❌ Widget endpoint: Connection failed${NC}"
else
  http_code=$(echo "$widget_headers" | head -n 1 | awk '{print $2}')
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✅ Widget endpoint: HTTP $http_code${NC}"
    
    # Check CSP headers
    if echo "$widget_headers" | grep -qi "content-security-policy.*frame-ancestors.*chat.openai.com"; then
      echo -e "${GREEN}✅ CSP header includes ChatGPT domains${NC}"
    else
      echo -e "${YELLOW}⚠️  CSP header may not include ChatGPT domains${NC}"
    fi
    
    # Check for X-Frame-Options
    if echo "$widget_headers" | grep -qi "x-frame-options"; then
      echo -e "${YELLOW}⚠️  X-Frame-Options header present (may block embedding)${NC}"
    else
      echo -e "${GREEN}✅ X-Frame-Options header not present (good for embedding)${NC}"
    fi
  else
    echo -e "${RED}❌ Widget endpoint: HTTP $http_code${NC}"
  fi
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All handshake tests completed${NC}"
echo ""
echo "💡 Next Steps:"
echo "   1. Use this URL in ChatGPT connector: $MCP_ENDPOINT"
echo "   2. Verify connector shows 'Connected' status"
echo "   3. Test search-vehicles tool in ChatGPT"
echo "   4. Test submit-lead tool via widget"
echo ""
echo "📖 For complete testing guide, see:"
echo "   docs/testing/chatgpt-smoke-test.md"
echo ""

