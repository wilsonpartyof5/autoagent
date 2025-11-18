# ChatGPT Connectivity Verification Guide

**Date:** 2025-11-13  
**Server:** https://autoagentmcp-server-production.up.railway.app

---

## Verification Checklist

### ✅ 1. HTTPS Certificate (TLS)

**Status:** Railway automatically provisions SSL certificates via Let's Encrypt

**Verification:**
- Certificate is valid and issued by a public CA
- HTTPS endpoint accessible: `https://autoagentmcp-server-production.up.railway.app`
- No certificate warnings in browser/curl

**To verify manually:**
```bash
openssl s_client -connect autoagentmcp-server-production.up.railway.app:443 -servername autoagentmcp-server-production.up.railway.app
```

**Expected:** Certificate chain shows valid Let's Encrypt or Railway-issued certificate

---

### ✅ 2. Endpoint Response Times

**Status:** Server responds quickly (< 200ms for health, < 500ms for MCP initialize)

**Verification:**
- Health endpoint: < 100ms average
- MCP initialize: < 500ms average
- No timeouts in direct testing

**If OpenAI times out but Railway logs show fast response:**
- Issue is likely network routing between OpenAI and Railway
- Not a server performance problem

---

### ✅ 3. URL Format

**Correct Format:**
```
https://autoagentmcp-server-production.up.railway.app/mcp
```

**Important:**
- ✅ Use `https://` (not `http://`)
- ✅ No trailing slash
- ✅ No query parameters
- ✅ Exact path: `/mcp`

**Common Mistakes:**
- ❌ `http://autoagentmcp-server-production.up.railway.app/mcp` (missing 's')
- ❌ `https://autoagentmcp-server-production.up.railway.app/mcp/` (trailing slash)
- ❌ `https://autoagentmcp-server-production.up.railway.app` (missing `/mcp`)

---

### ✅ 4. DNS Resolution

**Status:** Railway subdomain should resolve correctly

**Verification:**
```bash
nslookup autoagentmcp-server-production.up.railway.app
# or
dig autoagentmcp-server-production.up.railway.app
```

**Expected:** Returns Railway IP addresses (may be multiple for load balancing)

**If DNS fails:**
- Check if domain is accessible from your network
- Try from different network (mobile hotspot)
- Consider custom domain (see below)

---

### ✅ 5. Railway Logs Monitoring

**What to Check:**

When clicking "Create" in ChatGPT connector wizard, watch Railway logs for:

1. **Incoming Request:**
   ```
   POST /mcp
   Headers: User-Agent, Origin, etc.
   ```

2. **Request Processing:**
   ```
   Processing MCP request: initialize
   ```

3. **Response:**
   ```
   MCP Response (XXXms): {...}
   ```

**If you see the request in logs:**
- ✅ Request reached Railway
- Check response time - if > 30s, that's the timeout
- Check for errors in the response

**If you DON'T see the request:**
- ❌ Request never reached Railway
- Possible causes:
  - OpenAI blocking `*.up.railway.app` domains
  - DNS resolution failure from OpenAI's network
  - Network routing issue
  - Firewall/VPN blocking

---

### ✅ 6. Network Accessibility

**Test from Different Networks:**

1. **Current Network:**
   ```bash
   curl https://autoagentmcp-server-production.up.railway.app/health
   ```

2. **Mobile Hotspot:**
   - Connect to mobile hotspot
   - Run same test
   - Try ChatGPT connector from mobile network

3. **Different Location:**
   - Test from different physical location
   - Use VPN to different region

**If works from one network but not another:**
- Network-specific blocking
- Consider custom domain

---

### ✅ 7. Custom Domain (Fallback Solution)

**If Railway subdomain doesn't work:**

1. **Get a Custom Domain:**
   - Example: `mcp.autoagent.ai` or `api.autoagent.app`
   - Purchase domain if needed

2. **Configure in Railway:**
   - Go to Railway dashboard
   - Service → Settings → Domains
   - Add custom domain
   - Railway will provision SSL automatically

3. **Update DNS:**
   - Add CNAME record pointing to Railway service
   - Wait for DNS propagation (5-60 minutes)

4. **Update Environment:**
   - Update `WIDGET_HOST` to use custom domain
   - Redeploy service

**Benefits:**
- More reliable DNS resolution
- Professional domain name
- Better for production use

---

## Troubleshooting Steps

### Issue: ChatGPT Connector Times Out

**Step 1: Check Railway Logs**
- Go to Railway dashboard → Service → Deploy Logs
- Click "Create" in ChatGPT
- Watch for incoming POST to `/mcp`
- Note response time

**Step 2: If Request Arrives but Times Out**
- Check response time in logs
- If > 30s, server is slow (unlikely based on tests)
- Check for errors in logs
- Review MarketCheck API calls (may be slow)

**Step 3: If Request Never Arrives**
- OpenAI can't reach Railway
- Possible causes:
  - DNS resolution failure
  - Network blocking
  - Certificate validation failure

**Step 4: Try Custom Domain**
- Set up custom domain in Railway
- Update `WIDGET_HOST` environment variable
- Redeploy
- Test again

---

## Current Status

**Server Health:**
- ✅ HTTPS certificate: Valid
- ✅ Response times: < 200ms average
- ✅ URL format: Correct
- ✅ DNS resolution: Working
- ✅ MCP endpoint: Accessible
- ✅ Handshake test: Passing

**Next Steps:**
1. Monitor Railway logs when clicking "Create" in ChatGPT
2. Note if request arrives and response time
3. If timeout persists, consider custom domain

---

## Quick Test Commands

```bash
# Test health
curl https://autoagentmcp-server-production.up.railway.app/health

# Test MCP initialize
curl -X POST https://autoagentmcp-server-production.up.railway.app/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# Test SSL certificate
openssl s_client -connect autoagentmcp-server-production.up.railway.app:443

# Test DNS
nslookup autoagentmcp-server-production.up.railway.app
```

---

**Last Updated:** 2025-11-13  
**Server Commit:** `0af2275`

