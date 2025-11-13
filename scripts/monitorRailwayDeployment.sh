#!/bin/bash
# Monitor Railway deployment status
# Usage: bash scripts/monitorRailwayDeployment.sh [commit-sha]

set -e

COMMIT_SHA="${1:-$(git rev-parse HEAD)}"
RAILWAY_URL="https://autoagentmcp-server-production.up.railway.app"
COMMIT_SHORT="${COMMIT_SHA:0:7}"

echo "🔍 Railway Deployment Monitor"
echo "=============================="
echo "Commit: $COMMIT_SHORT ($COMMIT_SHA)"
echo "Service URL: $RAILWAY_URL"
echo ""

# Function to check service health
check_service() {
  echo "📊 Checking service health..."
  if curl -s -f "${RAILWAY_URL}/health" > /dev/null 2>&1; then
    echo "✅ Service is responding"
    curl -s "${RAILWAY_URL}/health" | jq -r '.timestamp // "unknown"' | head -1
    return 0
  else
    echo "❌ Service is not responding"
    return 1
  fi
}

# Function to test MCP endpoint
test_mcp() {
  echo ""
  echo "🧪 Testing MCP endpoint..."
  RESPONSE=$(curl -s -X POST "${RAILWAY_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' 2>&1)
  
  if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ MCP endpoint error:"
    echo "$RESPONSE" | jq -r '.error.message // .error // "Unknown error"' 2>/dev/null || echo "$RESPONSE"
    return 1
  else
    echo "✅ MCP endpoint responding"
    return 0
  fi
}

# Function to check if deployment is new
check_deployment_age() {
  echo ""
  echo "⏰ Checking deployment timestamp..."
  TIMESTAMP=$(curl -s "${RAILWAY_URL}/health" | jq -r '.timestamp // empty' 2>/dev/null)
  if [ -n "$TIMESTAMP" ]; then
    echo "Service timestamp: $TIMESTAMP"
    # Convert to epoch and compare
    SERVICE_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${TIMESTAMP%.*}" "+%s" 2>/dev/null || echo "0")
    COMMIT_EPOCH=$(git log -1 --format=%ct "$COMMIT_SHA" 2>/dev/null || echo "0")
    
    if [ "$SERVICE_EPOCH" -gt "$COMMIT_EPOCH" ]; then
      echo "✅ Service appears to be newer than commit (may have redeployed)"
    elif [ "$SERVICE_EPOCH" -lt "$COMMIT_EPOCH" ]; then
      echo "⚠️  Service appears older than commit (may need redeploy)"
    else
      echo "ℹ️  Timestamps are similar"
    fi
  fi
}

# Main monitoring loop
echo "Starting monitoring cycle..."
echo ""

# Initial checks
check_service
check_deployment_age
test_mcp

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Commit: $COMMIT_SHORT"
echo "Service: $RAILWAY_URL"
echo ""
echo "⚠️  Note: Full deployment status requires Railway CLI or dashboard access"
echo "   To check manually:"
echo "   1. Go to https://railway.app"
echo "   2. Navigate to your project → mcp-server service"
echo "   3. Check 'Deployments' tab for commit $COMMIT_SHORT"
echo "   4. Review build logs for status"
echo ""

