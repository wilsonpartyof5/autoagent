# Timeout Diagnosis - ngrok Setup

**Date**: 2025-11-12  
**Tunnel**: ngrok (`https://autoagentmcp-server-production.up.railway.app`)  
**MCP Endpoint**: `https://autoagentmcp-server-production.up.railway.app/mcp`

---

## Summary

**Status**: ✅ **MCP server is healthy and responding quickly**  
**Issue**: Timeout likely occurring at **ngrok free tier layer** or **ChatGPT's timeout threshold**

**Key Findings**:
- ✅ MCP server responds in 1-3ms for initialize requests
- ✅ Tool execution (search-vehicles) completes in 228-438ms
- ✅ All requests through ngrok show HTTP 200 in ngrok API
- ⚠️ Direct curl through ngrok times out (exit code 23) - but this may be a curl-specific issue
- ⚠️ ngrok free tier has **60-second timeout** for HTTP requests

---

## Evidence

### 1. MCP Server Performance ✅

**Initialize Requests**: 1-3ms
```
✅ [0483tum0x] MCP Response (1ms): {...}
✅ [4ohf5euej] MCP Response (1ms): {...}
```

**Tool Execution**: 228-438ms
```
🔍 Starting vehicle search...
✅ [2eu5dcmut] MCP Response (230ms): {...}
{"evt":"mcp.tools.call","tool":"search-vehicles","ms":229,"success":true}
```

**Server Configuration**:
- Timeout: 300000ms (5 minutes) ✅
- Keep-alive: 300000ms (5 minutes) ✅
- Headers timeout: 300000ms (5 minutes) ✅

### 2. ngrok Tunnel Status ✅

**Tunnel Process**: Running (PID 37182)
```
/tmp/ngrok http 8787
```

**Recent Requests** (from ngrok API):
```
/mcp - Status: 200 OK
/mcp - Status: 200 OK
/mcp - Status: 200 OK
/health - Status: 200 OK
```

**No timeout errors visible** in ngrok request history.

### 3. ChatGPT Requests ✅

**Successful Requests from ChatGPT**:
```
user-agent: "openai-mcp/1.0.0"
✅ MCP Response (1ms): {...}
✅ MCP Response (2ms): {...}
```

**All ChatGPT requests completing successfully** with very fast response times.

### 4. Direct curl Test ⚠️

**Test Through ngrok**:
```bash
curl -v -X POST https://autoagentmcp-server-production.up.railway.app/mcp ...
# Exit code: 23 (timeout)
# Connection established, TLS handshake complete, but request hangs
```

**However**: Tool execution test through ngrok **succeeds**:
```bash
curl -X POST https://autoagentmcp-server-production.up.railway.app/mcp ...
# Returns full response with 20 vehicles
# Response time: ~1 second
```

---

## Root Cause Analysis

### Primary Hypothesis: ngrok Free Tier Timeout

**ngrok Free Tier Limitations**:
- **60-second timeout** for HTTP requests
- Connection may timeout if:
  - Request takes longer than 60 seconds
  - Connection is idle for too long
  - Multiple concurrent requests exceed limits

**ChatGPT Timeout Behavior**:
- ChatGPT likely has its own timeout (typically 30-60 seconds)
- If a request takes longer than ChatGPT's timeout, it will show as timeout
- Even if ngrok allows 60 seconds, ChatGPT may timeout at 30 seconds

### Secondary Hypothesis: Tool-Specific Timeout

**Possible Slow Operations**:
1. **MarketCheck API calls** (if enrichment enabled):
   - Each listing enrichment adds ~3-5 seconds
   - 20 listings × 3 seconds = 60+ seconds total
   - Could exceed ngrok/ChatGPT timeout

2. **Supabase queries** (in submit-lead):
   - Fetching dealer settings
   - Fetching vehicle info
   - Inserting lead delivery logs
   - Multiple sequential queries could add up

3. **Lead delivery** (in submit-lead):
   - HTTP POST to CRM endpoint
   - 5-second timeout configured
   - If endpoint is slow, could cause overall timeout

### Evidence Against Timeout

**Contradictory Evidence**:
- ✅ All logged requests complete successfully
- ✅ Response times are fast (1-3ms for initialize, 228ms for search)
- ✅ No errors in MCP server logs
- ✅ ngrok shows HTTP 200 for all requests

**This suggests**:
- Timeout might be **intermittent**
- Timeout might be **ChatGPT-side** (not server-side)
- Timeout might be **specific to certain tool calls** (submit-lead?)

---

## Log Excerpts

### Successful ChatGPT Requests
```
{"evt":"mcp.request","ts":"2025-11-12T17:22:16.089Z","method":"POST","url":"/mcp","ip":"::1","headers":{"host":"autoagentmcp-server-production.up.railway.app","user-agent":"openai-mcp/1.0.0",...}}
✅ [0483tum0x] MCP Response (1ms): {...}
{"evt":"mcp.request","method":"POST","status":200,"ms":2,"userAgent":"openai-mcp/1.0.0"}
```

### Successful Tool Execution
```
🔧 [2eu5dcmut] Processing MCP request: tools/call
🔍 Starting vehicle search...
{"event":"search","hasKey":true,"enrichmentEnabled":false,"fromCache":false,"results":10,"ms":228}
✅ [2eu5dcmut] MCP Response (230ms): {...}
```

### ngrok Request History
```
/mcp - Status: 200 OK
/mcp - Status: 200 OK
/mcp - Status: 200 OK
```

**No failed requests or timeouts visible** in ngrok logs.

---

## Recommended Investigation Steps

### 1. Check for Incomplete Requests

**Look for requests that started but didn't complete**:
```bash
# Check MCP server logs for requests without corresponding response
tail -1000 /tmp/mcp-server.log | grep "MCP Request received" | while read line; do
  request_id=$(echo "$line" | grep -o '\[[^]]*\]' | head -1)
  if ! grep -q "MCP Response.*$request_id" /tmp/mcp-server.log; then
    echo "Incomplete request: $request_id"
  fi
done
```

### 2. Test submit-lead Tool

**If timeout happens during lead submission**:
```bash
curl -X POST https://autoagentmcp-server-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":6,
    "method":"tools/call",
    "params":{
      "name":"submit-lead",
      "arguments":{
        "vehicleId":"test-123",
        "vin":"1HGCM82633A004352",
        "user":{"name":"Test User","email":"test@example.com"},
        "consent":true
      }
    }
  }' \
  --max-time 90
```

**Check for**:
- Supabase query delays
- Lead delivery endpoint timeouts
- Overall request duration

### 3. Check ngrok Free Tier Limits

**ngrok Free Tier**:
- 60-second request timeout
- Connection limits
- Rate limiting

**If hitting limits**:
- Consider ngrok paid tier (longer timeouts)
- Or optimize tool execution to complete faster

### 4. Add Request Duration Logging

**Add to MCP server** to track slow requests:
```typescript
// In apps/mcp-server/src/index.ts
app.all('/mcp', async (req, res) => {
  const startTime = Date.now();
  // ... existing code ...
  
  const duration = Date.now() - startTime;
  if (duration > 5000) { // Log if > 5 seconds
    console.warn(`⚠️ Slow MCP request: ${duration}ms`, {
      method: req.body?.method,
      tool: req.body?.params?.name,
      duration
    });
  }
});
```

---

## Immediate Actions

### 1. Verify Which Tool Times Out

**Ask user**: Which specific action in ChatGPT causes the timeout?
- Initial connection/handshake?
- Search for vehicles?
- Lead submission?

### 2. Check ngrok Web Interface

**Visit**: `http://127.0.0.1:4040`
- View request history
- Check for failed requests
- Look at request durations
- Check for timeout errors

### 3. Monitor Real-Time

**Watch MCP server logs while testing**:
```bash
tail -f /tmp/mcp-server.log | grep -E "(MCP Request|MCP Response|timeout|error)"
```

**Watch ngrok web interface** while making requests from ChatGPT.

---

## Potential Fixes

### If Timeout is in submit-lead:

1. **Optimize Supabase Queries**:
   - Use service role key to avoid RLS delays
   - Batch queries where possible
   - Add query timeouts

2. **Optimize Lead Delivery**:
   - Make delivery async (don't wait for response)
   - Reduce delivery timeout from 5s to 2s
   - Add retry logic

3. **Add Request Timeout**:
   - Set explicit timeout for entire tool execution
   - Return partial results if timeout approaches

### If Timeout is in search-vehicles:

1. **Disable Enrichment** (if enabled):
   - Enrichment adds 3-5 seconds per listing
   - 20 listings = 60+ seconds total
   - This would exceed ngrok/ChatGPT timeout

2. **Reduce Result Count**:
   - Return fewer vehicles (10 instead of 20)
   - Faster response time

3. **Optimize MarketCheck API**:
   - Use cached results when possible
   - Reduce API timeout

### If Timeout is ngrok-Related:

1. **Upgrade ngrok Plan**:
   - Paid tier has longer timeouts
   - Better reliability

2. **Use Alternative Tunnel**:
   - Cloudflare Tunnel (if timeout can be configured)
   - LocalTunnel
   - Serveo

---

## Next Steps

1. **Identify the specific tool/action** that times out
2. **Check ngrok web interface** (`http://127.0.0.1:4040`) for failed requests
3. **Monitor logs in real-time** while reproducing the timeout
4. **Test submit-lead tool** specifically (if that's where timeout occurs)
5. **Check if enrichment is enabled** (could cause 60+ second delays)

---

**Current Status**: MCP server is healthy and fast. Timeout is likely:
- ngrok free tier 60-second limit
- ChatGPT's own timeout threshold
- Slow tool execution (enrichment or Supabase queries)

**Recommendation**: Identify which specific action times out, then optimize that specific tool or upgrade ngrok plan.
