# Railway Logs Monitoring Guide

**Date:** 2025-11-13  
**Service:** @autoagent/mcp-server  
**URL:** https://autoagentmcp-server-production.up.railway.app

---

## How to Monitor Railway Logs During ChatGPT Connector Creation

### Step 1: Open Railway Dashboard

1. Go to https://railway.app
2. Sign in to your account
3. Navigate to your project
4. Click on **@autoagent/mcp-server** service
5. Click on **"Logs"** tab (or **"Deploy Logs"** / **"HTTP Logs"**)

### Step 2: Watch for Incoming Requests

**What to Look For:**

When you click "Create" in ChatGPT connector wizard, you should see:

```
POST /mcp
```

Or in HTTP logs:
```
[timestamp] POST /mcp HTTP/1.1 200
```

**Key Indicators:**
- Request method: `POST`
- Path: `/mcp`
- Timestamp: Should match when you clicked "Create"
- Response code: `200` (success) or `5xx` (error)

### Step 3: Check Request Details

**Look for:**
1. **Request Headers:**
   - `User-Agent`: Should mention OpenAI/ChatGPT
   - `Origin`: May be `https://chat.openai.com`
   - `Content-Type`: `application/json`

2. **Request Body:**
   - Should contain `{"jsonrpc":"2.0","method":"initialize",...}`
   - Or `{"jsonrpc":"2.0","method":"tools/list",...}`

3. **Response Time:**
   - Check log timestamps
   - If request arrives and response sent quickly (< 1s), issue is on OpenAI's side
   - If request takes > 30s, server is slow (unlikely based on tests)

### Step 4: Interpret Results

#### ✅ **Scenario A: Request Appears in Logs**

**What it means:**
- ✅ Request reached Railway
- ✅ Server is receiving the connection

**Check:**
- Response time: How long between request and response?
- If < 1s: Issue is likely on OpenAI's side (they're timing out before receiving response)
- If > 30s: Server is slow (check for errors in logs)

**Next Steps:**
- If fast response: OpenAI may have network issues or timeout settings
- If slow response: Check for errors, MarketCheck API timeouts, etc.

#### ❌ **Scenario B: No Request in Logs**

**What it means:**
- ❌ Request never reached Railway
- ❌ OpenAI can't connect to Railway subdomain

**Possible Causes:**
1. OpenAI blocking `*.up.railway.app` domains
2. DNS resolution failure from OpenAI's network
3. Network routing issue
4. Firewall/VPN blocking

**Solution: Use Custom Domain**

1. **Get a Custom Domain:**
   - Example: `mcp.your-domain.com` or `api.autoagent.app`
   - Purchase if needed (e.g., via Namecheap, Google Domains)

2. **Configure in Railway:**
   - Go to Railway dashboard
   - Service → Settings → Domains
   - Click "Add Domain"
   - Enter your custom domain (e.g., `mcp.your-domain.com`)
   - Railway will show DNS records to add

3. **Update DNS:**
   - Go to your domain registrar
   - Add CNAME record:
     - Name: `mcp` (or `@` for root)
     - Value: Railway-provided CNAME target
   - Wait for DNS propagation (5-60 minutes)

4. **Update Environment Variables:**
   - In Railway dashboard → Service → Variables
   - Update `WIDGET_HOST`:
     ```
     WIDGET_HOST=https://autoagentmcp-server-production.up.railway.app
     ```
   - Or whatever your custom domain is

5. **Redeploy:**
   - Railway will automatically redeploy
   - Or trigger manual redeploy

6. **Test:**
   - Use new URL in ChatGPT connector: `https://autoagentmcp-server-production.up.railway.app/mcp`
   - Test handshake: `bash scripts/testChatGPTHandshake.sh https://autoagentmcp-server-production.up.railway.app`

---

## What to Capture

If you see the request in logs, capture:

1. **Request Timestamp:**
   ```
   [2025-11-13 19:58:23] POST /mcp
   ```

2. **Response Time:**
   ```
   MCP Response (132ms): {...}
   ```

3. **Any Errors:**
   ```
   ❌ [request-id] MCP request error: ...
   ```

4. **Full Log Snippet:**
   - Copy 10-20 lines around the request
   - Include request and response

---

## Quick Checklist

- [ ] Railway logs tab open
- [ ] ChatGPT connector wizard open
- [ ] Click "Create" in ChatGPT
- [ ] Watch Railway logs immediately
- [ ] Note if POST /mcp appears
- [ ] If appears: Note response time
- [ ] If doesn't appear: Set up custom domain

---

## Current Server Status

**Health:**
- ✅ Service is healthy
- ✅ Response times: < 200ms
- ✅ HTTPS certificate: Valid
- ✅ DNS resolution: Working
- ✅ MCP endpoint: Accessible

**If requests aren't reaching Railway:**
- Server is fine
- Issue is connectivity from OpenAI to Railway
- Custom domain usually resolves this

---

## Example Log Patterns

### Successful Request:
```
[2025-11-13 19:58:23.456] 🔧 [abc123] Processing MCP request: initialize
[2025-11-13 19:58:23.589] ✅ [abc123] MCP Response (133ms): {...}
```

### Timeout (if request arrives):
```
[2025-11-13 19:58:23.456] 🔧 [abc123] Processing MCP request: initialize
[2025-11-13 19:58:53.789] ❌ [abc123] MCP request timeout (30000ms)
```

### No Request (if not reaching Railway):
```
[No log entries around the time you clicked "Create"]
```

---

**Last Updated:** 2025-11-13  
**Server Commit:** `0af2275`

