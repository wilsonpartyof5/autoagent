# ChatGPT Smoke Test - Execution Log

**Date**: 2025-02-21  
**Status**: In Progress

---

## ✅ Completed Steps

### 1. Inventory Verification ✅

**Command**: `node scripts/verifyRockHillInventory.js`

**Result**: **SUCCESS**
- ✅ Found 1 user with Rock Hill GMC inventory
- ✅ Found **10 vehicles** for Rock Hill GMC (dealer_id: 11042155)
- ✅ All vehicles from MarketCheck API
- ✅ Makes: GMC
- ✅ Conditions: new
- ✅ Year range: 2025-2026

**Sample Vehicles**:
1. 2025 GMC Yukon (VIN: 1GKS1BRD6SR419321) - $71,485
2. 2026 GMC Sierra 2500HD (VIN: 1GT4UPEY0TF160619) - $88,254
3. 2026 GMC Sierra 2500HD (VIN: 1GT4URE70TF171025) - $79,454
4. 2026 GMC Sierra 2500HD (VIN: 1GT4UPEY8TF129974) - $87,184
5. 2026 GMC Sierra 2500HD (VIN: 1GT4UPEYXTF144699) - $88,379

**Status**: ✅ **READY** - Inventory is available for testing

---

## ⏳ Pending Steps (Manual Execution Required)

### 2. Start MCP Server

**Issue**: `pnpm` not available in automated shell environment

**Manual Steps**:
```bash
# Terminal 1: Start MCP Server
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev
```

**Expected Output**:
```
🚗 AutoAgent MCP Server running on http://localhost:8787
📊 Health check: http://localhost:8787/health
🔧 MCP endpoint: http://localhost:8787/mcp
🎨 Widget: http://localhost:8787/widget/vehicle-results
```

**Verification**:
```bash
curl http://localhost:8787/health
```

**Expected Response**:
```json
{
  "ok": true,
  "status": "healthy",
  "service": "autoagent-mcp-server",
  "version": "1.0.0"
}
```

---

### 3. Start Dealer Dashboard (Optional)

**Manual Steps**:
```bash
# Terminal 2: Start Dashboard
cd /Users/mac/AutoAgent
pnpm --filter dealer-dashboard dev
```

**Expected Output**:
```
✓ Ready in XXXms
○ Local: http://localhost:3000
```

**Verification**: Open `http://localhost:3000` in browser

---

### 4. Start ngrok Tunnel

**Manual Steps**:
```bash
# Terminal 3: Start ngrok
ngrok http 8787
```

**Expected Output**:
```
Session Status                online
Account                       Your Account (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.dev -> http://localhost:8787
```

**Action Required**: Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

**Update WIDGET_HOST**:
```bash
# Edit apps/mcp-server/.env
WIDGET_HOST=https://abc123.ngrok-free.dev

# Restart MCP server after updating
```

---

### 5. Run Handshake Test Script

**Manual Steps**:
```bash
# After ngrok is running and you have the HTTPS URL
cd /Users/mac/AutoAgent
bash scripts/testChatGPTHandshake.sh https://abc123.ngrok-free.dev
```

**Expected Output**:
```
🧪 AutoAgent ChatGPT MCP Handshake Test
========================================
MCP Server URL: https://abc123.ngrok-free.dev
MCP Endpoint: https://abc123.ngrok-free.dev/mcp
Health Endpoint: https://abc123.ngrok-free.dev/health

🧪 Testing Health Check...
✅ Health Check: HTTP 200

🧪 Testing MCP Initialize...
✅ MCP Initialize: HTTP 200
✅ Initialize response includes 'initialized' field
✅ Initialize response includes 'serverInfo'

🧪 Testing MCP Tools List...
✅ MCP Tools List: HTTP 200
✅ 'search-vehicles' tool found
✅ 'submit-lead' tool found

🧪 Testing Widget Endpoint...
✅ Widget endpoint: HTTP 200
✅ CSP header includes ChatGPT domains
✅ X-Frame-Options header not present (good for embedding)

📊 Test Summary
✅ All handshake tests completed
```

---

### 6. Configure ChatGPT Connector

**Manual Steps**:
1. Open ChatGPT → Settings → Connectors
2. Add/Edit connector:
   - **MCP Server URL**: `https://abc123.ngrok-free.dev/mcp`
   - **Authentication**: None
3. Save connector
4. Verify connection status shows "Connected"

**Expected Behavior**:
- ChatGPT automatically calls `initialize` and `tools/list`
- Tools appear in ChatGPT interface
- No error messages

---

### 7. End-to-End Test: Search

**In ChatGPT**, type:
```
Show me new GMC trucks near Rock Hill, SC
```

**Expected Behavior**:
1. ChatGPT calls `search-vehicles` tool
2. MCP server queries Supabase for Rock Hill GMC inventory
3. Returns vehicle results with widget component
4. Widget displays 10 GMC vehicles on map

**Verification**:
- Check MCP server logs (Terminal 1) for search request
- Verify widget renders in ChatGPT
- Confirm vehicles shown are from Rock Hill GMC

---

### 8. End-to-End Test: Lead Submission

**Prerequisites**:
- Lead delivery configured in dashboard (`/app/settings`)
- Set delivery method to "HTTP Endpoint"
- Set endpoint URL: `https://httpbin.org/post`

**In ChatGPT**:
1. Click on a vehicle in the widget
2. Click "Request Info" or "Schedule Test Drive"
3. Fill out lead form:
   - Name: "John Doe"
   - Email: "john.doe@example.com"
   - Phone: "555-123-4567"
4. Check consent checkbox
5. Submit form

**Expected Behavior**:
1. Lead submitted successfully
2. Lead appears in `/app/leads` dashboard
3. Delivery log shows success in Supabase

**Verification**:
```sql
-- Check lead_delivery_logs in Supabase SQL Editor
SELECT 
  lead_id,
  delivery_method,
  delivery_target,
  status,
  http_status,
  attempted_at
FROM lead_delivery_logs
ORDER BY attempted_at DESC
LIMIT 1;
```

**Expected Result**:
- `status`: `success`
- `http_status`: `200`
- `delivery_target`: `https://httpbin.org/post`

---

## 🔍 Troubleshooting

### If MCP Server Won't Start

1. **Check environment variables**:
   ```bash
   cd /Users/mac/AutoAgent/apps/mcp-server
   cat .env
   ```

2. **Verify required variables are set**:
   - `MARKETCHECK_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

3. **Check for port conflicts**:
   ```bash
   lsof -i :8787
   ```

### If ngrok Tunnel Fails

1. **Check ngrok is installed**:
   ```bash
   ngrok version
   ```

2. **Verify ngrok account is authenticated**:
   ```bash
   ngrok config check
   ```

3. **Try Cloudflare Tunnel as alternative**:
   ```bash
   cloudflared tunnel --url http://localhost:8787
   ```

### If Handshake Test Fails

1. **Verify MCP server is running**:
   ```bash
   curl http://localhost:8787/health
   ```

2. **Check tunnel is active**:
   ```bash
   curl https://your-ngrok-url.ngrok-free.dev/health
   ```

3. **Review MCP server logs** for errors

### If ChatGPT Connector Fails

1. **Check tunnel URL is correct** (must include `/mcp` endpoint)
2. **Verify MCP server logs** show initialize request
3. **Check for SSL certificate issues** (ngrok free tier warning page)
4. **Try disconnecting and reconnecting** connector

---

## 📊 Test Results Summary

| Step | Status | Notes |
|------|--------|-------|
| 1. Inventory Verification | ✅ PASS | 10 Rock Hill GMC vehicles found |
| 2. Start MCP Server | ⏳ PENDING | Manual execution required |
| 3. Start Dashboard | ⏳ PENDING | Optional, manual execution |
| 4. Start ngrok Tunnel | ⏳ PENDING | Manual execution required |
| 5. Run Handshake Test | ⏳ PENDING | Depends on steps 2 & 4 |
| 6. Configure ChatGPT Connector | ⏳ PENDING | Depends on step 5 |
| 7. Test Search | ⏳ PENDING | Depends on step 6 |
| 8. Test Lead Submission | ⏳ PENDING | Depends on step 7 |

---

## 🎯 Next Actions

1. **Start MCP server** in Terminal 1
2. **Start ngrok tunnel** in Terminal 3
3. **Run handshake test script** with ngrok URL
4. **Configure ChatGPT connector** with tunnel URL
5. **Execute end-to-end tests** in ChatGPT

---

**Last Updated**: 2025-02-21  
**Next Review**: After manual execution of pending steps

