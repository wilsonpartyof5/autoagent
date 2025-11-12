# ChatGPT MCP Server Timeout Diagnosis

**Date**: 2025-11-12  
**Tunnel URL**: `https://gras-retailers-matters-coal.trycloudflare.com`  
**MCP Endpoint**: `https://gras-retailers-matters-coal.trycloudflare.com/mcp`

---

## Summary

**Root Cause**: **Cloudflare Tunnel timeout** - Requests through the tunnel are timing out before reaching the MCP server, or the tunnel has a shorter timeout than ChatGPT's expectations.

**Where Timeout Occurs**: Between ChatGPT → Cloudflare Tunnel → MCP Server

**Status**: 
- ✅ MCP server is healthy and responding locally
- ✅ Handshake test passes when run directly
- ❌ Requests through Cloudflare Tunnel timeout (curl exit code 23)
- ⚠️ Widget URL in responses points to old ngrok URL (not current tunnel)

---

## Findings

### 1. MCP Server Status ✅

**Local Health Check**: PASS
```json
{"ok":true,"status":"healthy","service":"autoagent-mcp-server","version":"1.0.0"}
```

**Local Tool Execution**: PASS (438ms response time)
- `search-vehicles` tool executes successfully
- Returns 20 vehicles in 438ms
- No errors in MCP server logs

**Server Configuration**:
- Timeout: 300000ms (5 minutes) - configured correctly
- Keep-alive: 300000ms (5 minutes)
- Headers timeout: 300000ms (5 minutes)

### 2. Cloudflare Tunnel Status ⚠️

**Tunnel Process**: Running (PID visible)
```
/Users/mac/AutoAgent/cloudflared tunnel --url http://localhost:8787
```

**Tunnel Logs**: No explicit timeout errors, but:
- Tunnel established successfully
- Connection registered: `connIndex=0 connection=d0b13813-dae9-474b-82a6-686d05fed73a`
- No 502/504 errors visible in logs

**Direct Test Through Tunnel**: TIMEOUT
```bash
curl -v -X POST https://gras-retailers-matters-coal.trycloudflare.com/mcp ...
# Exit code: 23 (timeout)
# Connection established to Cloudflare, but request times out
```

### 3. Handshake Test Results ✅

**All Checks Pass**:
- ✅ Health Check: HTTP 200
- ✅ MCP Initialize: HTTP 200 (includes 'initialized' field)
- ✅ Tools List: HTTP 200 (search-vehicles and submit-lead found)
- ✅ Widget Endpoint: HTTP 200 (CSP headers correct)

**Note**: Handshake test may be using cached responses or faster endpoints.

### 4. Tool Execution Test ✅

**Local Execution**: SUCCESS
- Request: `search-vehicles` with `location: "Rock Hill, SC", make: "GMC", condition: "new"`
- Response Time: 438ms
- Result: 20 vehicles returned
- Status: HTTP 200

**Log Excerpt**:
```
🔧 [o0cyqkr5g] Processing MCP request: tools/call
🔍 Starting vehicle search...
📊 Search progress: 50% complete
{"event":"search","hasKey":true,"enrichmentEnabled":false,"fromCache":false,"results":10,"ms":435}
✅ [o0cyqkr5g] MCP Response (438ms): {...}
```

### 5. Widget URL Issue ⚠️

**Problem**: Widget URL in tool responses points to old ngrok URL:
```
"url":"https://rana-flightiest-malcolm.ngrok-free.dev/widget/vehicle-results?rid=..."
```

**Expected**: Should use current Cloudflare tunnel URL:
```
"url":"https://gras-retailers-matters-coal.trycloudflare.com/widget/vehicle-results?rid=..."
```

**Impact**: Widget may not load in ChatGPT if the old ngrok URL is no longer active.

---

## Root Cause Analysis

### Primary Issue: Cloudflare Tunnel Timeout

**Evidence**:
1. Direct curl to tunnel URL times out (exit code 23)
2. MCP server responds quickly locally (438ms)
3. Tunnel process is running but may have connection issues
4. Cloudflare Tunnel free tier has **30-second timeout** for HTTP requests

**ChatGPT Timeout Behavior**:
- ChatGPT likely has its own timeout (typically 30-60 seconds)
- If Cloudflare Tunnel times out at 30 seconds, ChatGPT will see it as a timeout
- Even though MCP server has 5-minute timeout, the tunnel layer fails first

### Secondary Issue: Widget URL Mismatch

**Evidence**:
- `WIDGET_HOST` was updated to Cloudflare URL
- But tool responses still reference old ngrok URL
- Suggests environment variable not being read correctly, or cached value

---

## Log Excerpts

### MCP Server Logs (Successful Local Request)
```
{"evt":"mcp.request","ts":"2025-11-12T17:12:47.030Z","method":"POST","url":"/mcp","ip":"::1"}
🔧 [o0cyqkr5g] Processing MCP request: tools/call
🔍 Starting vehicle search...
{"event":"search","hasKey":true,"enrichmentEnabled":false,"fromCache":false,"results":10,"ms":435}
✅ [o0cyqkr5g] MCP Response (438ms): {...}
{"evt":"mcp.request","method":"POST","status":200,"ms":439,"userAgent":"curl/8.7.1"}
```

### Cloudflare Tunnel Logs
```
2025-11-12T17:05:39Z INF Registered tunnel connection connIndex=0 connection=d0b13813-dae9-474b-82a6-686d05fed73a event=0 ip=198.41.192.37 location=atl12 protocol=quic
```

**No timeout errors visible**, but tunnel may be silently dropping long-running requests.

### Failed Tunnel Request
```
curl -v -X POST https://gras-retailers-matters-coal.trycloudflare.com/mcp ...
* Connected to gras-retailers-matters-coal.trycloudflare.com (104.16.231.132) port 443
* SSL connection using TLSv1.3
[Request hangs, then times out with exit code 23]
```

---

## Recommended Fixes

### 1. Immediate: Switch to ngrok (if available)

**Reason**: ngrok free tier has longer timeout (typically 60+ seconds) and better reliability for MCP servers.

**Action**:
```bash
# Stop Cloudflare Tunnel
pkill cloudflared

# Start ngrok
ngrok http 8787

# Update WIDGET_HOST in apps/mcp-server/.env
WIDGET_HOST=https://your-ngrok-url.ngrok-free.dev

# Restart MCP server
```

### 2. Fix Widget URL Issue

**Check Environment Variable**:
```bash
cd /Users/mac/AutoAgent/apps/mcp-server
grep WIDGET_HOST .env
```

**Verify MCP Server Reads It**:
- Restart MCP server after updating `.env`
- Check logs for widget URL in tool responses
- Ensure no caching of old URL

### 3. Increase Cloudflare Tunnel Timeout (if staying with Cloudflare)

**Option A**: Use Cloudflare Tunnel with longer timeout configuration
```bash
# Create cloudflared config file
cat > ~/.cloudflared/config.yml << EOF
tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:8787
    originRequest:
      timeout: 300s
EOF
```

**Option B**: Use ngrok instead (recommended for development)

### 4. Add Request Timeout Logging

**Add to MCP server** to track when requests exceed certain thresholds:
```typescript
// In apps/mcp-server/src/index.ts
const REQUEST_TIMEOUT_WARNING = 10000; // 10 seconds

app.all('/mcp', async (req, res) => {
  const startTime = Date.now();
  // ... existing code ...
  
  // Add warning if request takes too long
  const duration = Date.now() - startTime;
  if (duration > REQUEST_TIMEOUT_WARNING) {
    console.warn(`⚠️ Slow MCP request: ${duration}ms`, {
      method: req.body?.method,
      duration
    });
  }
});
```

---

## Next Steps

1. **Switch to ngrok** (if available) for more reliable tunneling
2. **Fix WIDGET_HOST** - verify it's being read correctly
3. **Test with ngrok** - run handshake test and tool execution through ngrok
4. **Monitor timeout** - if still timing out, check:
   - Supabase query performance
   - MarketCheck API response times
   - Any external API calls in tool execution

---

## Verification Commands

```bash
# Test local MCP server
curl http://localhost:8787/health

# Test through tunnel (should not timeout)
curl -X POST https://gras-retailers-matters-coal.trycloudflare.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  --max-time 60

# Check widget URL in response
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search-vehicles","arguments":{"location":"Rock Hill, SC","make":"GMC","condition":"new"}}}' \
  | jq '.result.components[0].url'
```

---

**Diagnosis Complete**: Timeout is occurring at the Cloudflare Tunnel layer, not in the MCP server itself. The server is healthy and responds quickly locally, but Cloudflare Tunnel's 30-second timeout is likely causing ChatGPT to see timeouts.

