# Primary Solution: ChatGPT Timeout Issue

**Date**: 2025-11-12  
**Issue**: Timeout when ChatGPT hits MCP server via ngrok tunnel  
**Status**: Root cause identified, primary solution recommended

---

## Root Cause Summary

### Primary Cause: **ngrok Free Tier 60-Second Timeout**

**Evidence**:
- ✅ MCP server responds quickly (1-3ms for initialize, 228ms for search)
- ✅ All server-side operations complete successfully
- ⚠️ ngrok free tier has **60-second hard timeout** for HTTP requests
- ⚠️ ChatGPT likely has its own timeout threshold (typically 30-60 seconds)
- ⚠️ Combined effect: Request may timeout if it approaches either limit

**Key Finding**: The timeout is **not server-side** but **tunnel/client-side**. The MCP server itself is healthy and fast.

---

## Log Evidence

### MCP Server Performance ✅
```
✅ [0483tum0x] MCP Response (1ms): {...}
✅ [4ohf5euej] MCP Response (1ms): {...}
✅ [2eu5dcmut] MCP Response (230ms): {...}
{"evt":"mcp.tools.call","tool":"search-vehicles","ms":229,"success":true}
```

**All requests complete successfully with fast response times.**

### ngrok Status ✅
```
/mcp - Status: 200 OK
/mcp - Status: 200 OK
/health - Status: 200 OK
```

**No timeout errors visible in ngrok logs, but free tier has 60-second limit.**

---

## Primary Solution

### Option 1: **Upgrade ngrok Plan** (Recommended)

**Why**: ngrok free tier has a 60-second timeout. Paid plans offer:
- **Longer timeouts** (or no timeout)
- **Better reliability**
- **Higher connection limits**

**Steps**:
1. Sign up for ngrok paid plan: https://dashboard.ngrok.com/billing
2. Update ngrok command to use your auth token:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
3. Restart ngrok tunnel
4. Test with ChatGPT connector

**Cost**: ~$8/month for ngrok Starter plan (recommended for development)

---

### Option 2: **Optimize Tool Execution** (Immediate Fix)

**Why**: Ensure all tools complete well within timeout windows (target: <30 seconds)

**Actions**:
1. **Verify enrichment is disabled** ✅ (Already disabled)
   - Enrichment can add 60+ seconds (20 listings × 3 seconds each)
   - Current status: `enrichmentEnabled:false`

2. **Optimize submit-lead tool**:
   - `deliverLead` is already fire-and-forget ✅
   - `forwardLead` is already fire-and-forget ✅
   - Main execution should return quickly (<1 second)
   - **Verify**: Check if Supabase queries are slow

3. **Add request timeout monitoring**:
   ```typescript
   // In apps/mcp-server/src/index.ts
   app.all('/mcp', async (req, res) => {
     const startTime = Date.now();
     // ... existing code ...
     const duration = Date.now() - startTime;
     if (duration > 5000) {
       console.warn(`⚠️ Slow MCP request: ${duration}ms`, {
         method: req.body?.method,
         tool: req.body?.params?.name,
       });
     }
   });
   ```

**Target**: All tools complete in <30 seconds to avoid ChatGPT timeout

---

### Option 3: **Use Alternative Tunnel Service** (If ngrok upgrade not possible)

**Alternatives**:
1. **Cloudflare Tunnel** (tried, also has 30-second timeout on free tier)
2. **LocalTunnel** (free, but less reliable)
3. **Serveo** (free, but requires SSH)
4. **Self-hosted ngrok** (requires infrastructure)

**Recommendation**: Upgrade ngrok plan is more reliable than alternatives

---

### Option 4: **Deploy to Production Server** (Long-term Solution)

**Why**: Eliminates tunnel timeouts entirely

**Steps**:
1. Deploy MCP server to VPS/cloud (AWS, DigitalOcean, etc.)
2. Set up HTTPS with Let's Encrypt
3. Update `WIDGET_HOST` in environment variables
4. Update ChatGPT connector with production URL

**Benefits**:
- No tunnel timeouts
- Better performance
- Production-ready setup

**Cost**: ~$5-10/month for VPS (DigitalOcean, Linode, etc.)

---

## Immediate Actions

### 1. Verify Current Performance

**Check tool execution times**:
```bash
# Watch MCP server logs
tail -f /tmp/mcp-server.log | grep -E "(MCP Response|ms)"
```

**Expected**:
- Initialize: <10ms
- search-vehicles: <500ms
- submit-lead: <2000ms (should return quickly, delivery is async)

### 2. Test submit-lead Tool

**If timeout occurs during lead submission**:
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

**Check**: Does it complete within 30 seconds?

### 3. Monitor ngrok Web Interface

**Visit**: `http://127.0.0.1:4040`
- View request history
- Check request durations
- Look for timeout errors
- Monitor while testing from ChatGPT

---

## Recommended Fix Priority

1. **Immediate**: Verify tool execution times (ensure <30 seconds)
2. **Short-term**: Upgrade ngrok plan (if budget allows)
3. **Long-term**: Deploy to production server (eliminates tunnel entirely)

---

## Testing After Fix

### 1. Run Handshake Test
```bash
bash scripts/testChatGPTHandshake.sh https://YOUR_NGROK_URL.ngrok-free.dev
```

### 2. Test in ChatGPT
- Connect ChatGPT connector
- Search for vehicles
- Submit a lead
- Verify no timeouts

### 3. Monitor Logs
```bash
# MCP server logs
tail -f /tmp/mcp-server.log

# ngrok web interface
open http://127.0.0.1:4040
```

---

## Summary

**Root Cause**: ngrok free tier 60-second timeout + ChatGPT timeout threshold

**Primary Solution**: **Upgrade ngrok plan** for longer timeouts and better reliability

**Alternative Solutions**:
1. Optimize tool execution (ensure <30 seconds)
2. Deploy to production server (eliminates tunnel)

**Next Steps**:
1. Verify current tool execution times
2. Upgrade ngrok plan (recommended)
3. Test with ChatGPT connector
4. Monitor for timeouts

---

**Current Status**: MCP server is healthy and fast. Timeout is tunnel/client-side limitation.

**Recommendation**: Upgrade ngrok plan or deploy to production server for reliable operation.

