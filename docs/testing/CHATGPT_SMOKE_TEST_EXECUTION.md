# ChatGPT Smoke Test - Step-by-Step Execution Guide

**Date**: 2025-02-21  
**Status**: Ready to Execute

---

## ✅ Prerequisites Verified

### 1. Rock Hill GMC Inventory ✅
- **Status**: ✅ **PASS**
- **Vehicles Found**: 10
- **Dealer ID**: 11042155
- **Sample VINs**: Verified (1GKS1BRD6SR419321, 1GT4UPEY0TF160619, etc.)
- **Command Used**: `node scripts/verifyRockHillInventory.js`

### 2. MCP Server Configuration ✅
- **Status**: ✅ **PASS**
- **Package.json**: ✅ Exists
- **Environment File**: ✅ `.env` exists at `apps/mcp-server/.env`

### 3. ngrok Installation ⚠️
- **Status**: ⚠️ **Not in PATH** (may be installed elsewhere)
- **Check**: Run `which ngrok` or `ngrok version` in your terminal
- **If missing**: Install via `brew install ngrok` (macOS) or download from https://ngrok.com/download

---

## Step 1: Start MCP Server

### Terminal 1: MCP Server

**Command:**
```bash
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev
```

**Expected Output:**
```
🚗 AutoAgent MCP Server running on http://localhost:8787
📊 Health check: http://localhost:8787/health
🔧 MCP endpoint: http://localhost:8787/mcp
🎨 Widget: http://localhost:8787/widget/vehicle-results
```

**✅ Checkpoint 1.1: Verify Server Started**

In a **new terminal window**, run:
```bash
curl http://localhost:8787/health
```

**Expected Response:**
```json
{
  "ok": true,
  "status": "healthy",
  "service": "autoagent-mcp-server",
  "version": "1.0.0"
}
```

**✅ Status**: [ ] Server running on port 8787  
**✅ Status**: [ ] Health check returns 200 OK

**⚠️ If Health Check Fails:**
- Check Terminal 1 for error messages
- Verify `.env` file has required variables (MARKETCHECK_API_KEY, SUPABASE_URL, etc.)
- Check if port 8787 is already in use: `lsof -i :8787`

---

## Step 2: Start HTTPS Tunnel (ngrok)

### Terminal 2: ngrok Tunnel

**Command:**
```bash
ngrok http 8787
```

**Expected Output:**
```
Session Status                online
Account                       Your Account (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.dev -> http://localhost:8787
```

**⚠️ IMPORTANT: Copy the HTTPS URL!**

**✅ Checkpoint 2.1: Capture Tunnel URL**

**Your ngrok HTTPS URL**: `https://____________________.ngrok-free.dev`

**✅ Checkpoint 2.2: Verify Tunnel Works**

In a **new terminal window**, run:
```bash
curl https://YOUR-NGROK-URL.ngrok-free.dev/health
```

**Expected Response:**
```json
{
  "ok": true,
  "status": "healthy",
  "service": "autoagent-mcp-server",
  "version": "1.0.0"
}
```

**✅ Status**: [ ] ngrok tunnel active  
**✅ Status**: [ ] Health check through tunnel returns 200 OK

**⚠️ If Tunnel Fails:**
- Verify MCP server is running (Step 1)
- Check ngrok is authenticated: `ngrok config check`
- Try restarting ngrok
- Alternative: Use Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:8787`

---

## Step 3: Update WIDGET_HOST (If Needed)

**Action**: Update `apps/mcp-server/.env` with your ngrok URL

**Edit the file:**
```bash
# Open in your editor
nano apps/mcp-server/.env
# or
code apps/mcp-server/.env
```

**Add/Update this line:**
```bash
WIDGET_HOST=https://YOUR-NGROK-URL.ngrok-free.dev
```

**⚠️ IMPORTANT: Restart MCP Server After Updating**

1. In Terminal 1, press `Ctrl+C` to stop the server
2. Restart: `pnpm --filter mcp-server dev`
3. Verify it's running again: `curl http://localhost:8787/health`

**✅ Status**: [ ] WIDGET_HOST updated in .env  
**✅ Status**: [ ] MCP server restarted

---

## Step 4: Run Handshake Test Script

### Terminal 3: Handshake Validation

**Command:**
```bash
cd /Users/mac/AutoAgent
bash scripts/testChatGPTHandshake.sh https://YOUR-NGROK-URL.ngrok-free.dev
```

**Expected Output:**
```
🧪 AutoAgent ChatGPT MCP Handshake Test
========================================
MCP Server URL: https://YOUR-NGROK-URL.ngrok-free.dev
MCP Endpoint: https://YOUR-NGROK-URL.ngrok-free.dev/mcp
Health Endpoint: https://YOUR-NGROK-URL.ngrok-free.dev/health

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test 1: Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Testing Health Check...
✅ Health Check: HTTP 200
{
  "ok": true,
  "status": "healthy",
  ...
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test 2: MCP Initialize
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Testing MCP Initialize...
✅ MCP Initialize: HTTP 200
✅ Initialize response includes 'initialized' field
✅ Initialize response includes 'serverInfo'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test 3: MCP Tools List
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Testing MCP Tools List...
✅ MCP Tools List: HTTP 200
✅ 'search-vehicles' tool found
✅ 'submit-lead' tool found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test 4: Widget Endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Testing Widget Endpoint...
✅ Widget endpoint: HTTP 200
✅ CSP header includes ChatGPT domains
✅ X-Frame-Options header not present (good for embedding)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All handshake tests completed
```

**✅ Checkpoint 4.1: All Tests Pass**

**Required Results:**
- [ ] Health Check: HTTP 200
- [ ] MCP Initialize: HTTP 200 + includes 'initialized' field
- [ ] Tools List: HTTP 200 + 'search-vehicles' found + 'submit-lead' found
- [ ] Widget Endpoint: HTTP 200 + CSP headers correct

**✅ Status**: [ ] All handshake tests pass

**⚠️ If Any Test Fails:**
- Review error messages in the script output
- Check MCP server logs (Terminal 1) for errors
- Verify tunnel URL is correct
- See Troubleshooting section below

---

## Step 5: ChatGPT Connector Configuration

### Your ChatGPT MCP Server URL

**⚠️ IMPORTANT: Use this exact format**

```
https://YOUR-NGROK-URL.ngrok-free.dev/mcp
```

**Example:**
```
https://abc123.ngrok-free.dev/mcp
```

**✅ Write Your URL Here:**
```
https://____________________.ngrok-free.dev/mcp
```

### How to Configure in ChatGPT

1. **Open ChatGPT**
   - Go to **Settings** → **Connectors**
   - Or **Apps** → **Connectors** (depending on your ChatGPT interface)

2. **Add/Edit Connector**
   - Click **"Add Connector"** or **"Edit"** existing connector
   - **MCP Server URL**: Paste your URL from above
   - **Authentication**: Select **"None"** (unless you've configured bearer token auth)
   - **Name** (optional): "AutoAgent MCP Server"

3. **Save**
   - Click **"Save"** or **"Connect"**
   - ChatGPT will automatically test the connection

4. **Verify Connection**
   - Status should show **"Connected"** (green checkmark)
   - No error messages
   - Tools should appear as available

**✅ Checkpoint 5.1: Connector Configured**

**Status**: [ ] Connector URL pasted correctly  
**Status**: [ ] Connection status shows "Connected"  
**Status**: [ ] No error messages  
**Status**: [ ] Tools appear in ChatGPT interface

**⚠️ If Connection Fails:**
- Verify URL includes `/mcp` at the end
- Check ngrok tunnel is still running (Terminal 2)
- Verify MCP server is still running (Terminal 1)
- Check for ngrok warning page (first visit may require clicking "Visit Site")
- See Troubleshooting section below

---

## Step 6: Manual QA Testing in ChatGPT

### Test 1: Vehicle Search

**Query in ChatGPT:**
```
Show me new GMC trucks near Rock Hill, SC
```

**Expected Behavior:**
1. ChatGPT calls `search-vehicles` tool automatically
2. MCP server queries Supabase for Rock Hill GMC inventory
3. Returns vehicle results with widget component
4. Widget appears in ChatGPT interface
5. Map displays with 10 GMC vehicle markers

**Verification Checklist:**
- [ ] ChatGPT shows it's calling `search-vehicles` tool
- [ ] Widget appears in ChatGPT interface (not blank/white)
- [ ] Map renders with vehicle markers
- [ ] Vehicles shown are GMC (Sierra, Yukon, etc.)
- [ ] Vehicles are from Rock Hill GMC (dealer_id: 11042155)
- [ ] Vehicle details visible (year, make, model, price)

**Check MCP Server Logs (Terminal 1):**
Look for:
```
🔍 Search vehicles request: { location: 'Rock Hill, SC', make: 'GMC', condition: 'new', ... }
📊 Querying inventory for dealer: 11042155
✅ Found 10 vehicles
```

**✅ Status**: [ ] Search test passes

---

### Test 2: Lead Submission

**Prerequisites:**
- Lead delivery must be configured in dashboard
- Navigate to `http://localhost:3000/app/settings`
- Set delivery method to "HTTP Endpoint"
- Set endpoint URL: `https://httpbin.org/post` (for testing)
- Click "Save Lead Delivery Settings"

**Steps in ChatGPT:**
1. After viewing vehicle results from Test 1
2. Click on a vehicle in the widget
3. Click **"Request Info"** or **"Schedule Test Drive"**
4. Fill out the lead form:
   - **Name**: "John Doe"
   - **Email**: "john.doe@example.com"
   - **Phone**: "555-123-4567" (optional)
   - **Preferred Time**: "Morning" (optional)
5. Check **consent checkbox** (required)
6. Click **"Submit"**

**Expected Behavior:**
1. Form submits successfully
2. Success message appears: "Thank you! Your request has been submitted..."
3. Lead is stored in database
4. Lead is forwarded to dashboard
5. Lead is delivered to configured endpoint (httpbin.org)

**Verification Checklist:**

**A. In ChatGPT:**
- [ ] Success message appears after submission
- [ ] No error messages

**B. In Dashboard (`http://localhost:3000/app/leads`):**
- [ ] Lead appears in leads list
- [ ] Status shows "Success"
- [ ] Delivery method shows "HTTP"
- [ ] Delivery endpoint shows configured URL

**C. In Supabase (SQL Editor):**
```sql
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

**Expected Result:**
- `delivery_method`: `http`
- `delivery_target`: `https://httpbin.org/post`
- `status`: `success`
- `http_status`: `200`

**D. Check httpbin.org:**
- Visit `https://httpbin.org/post` (if accessible)
- Should see ADF XML payload in request body

**Check MCP Server Logs (Terminal 1):**
Look for:
```
📝 Submit lead request: { vehicleId: '...', vin: '...', user: { name: 'John Doe', ... } }
✅ Lead submitted: abc123...
📤 Forwarding lead to dashboard
📦 Delivering lead to https://httpbin.org/post
✅ Lead delivery successful: HTTP 200
```

**✅ Status**: [ ] Lead submission test passes

---

## Troubleshooting Guide

### Issue: MCP Server Won't Start

**Symptoms:**
- `pnpm --filter mcp-server dev` fails
- Port 8787 already in use
- Health check fails

**Solutions:**
1. **Check port conflict:**
   ```bash
   lsof -i :8787
   # Kill process if needed: kill -9 <PID>
   ```

2. **Check environment variables:**
   ```bash
   cd /Users/mac/AutoAgent/apps/mcp-server
   cat .env
   # Verify MARKETCHECK_API_KEY, SUPABASE_URL, etc. are set
   ```

3. **Check for errors in Terminal 1:**
   - Look for TypeScript compilation errors
   - Check for missing dependencies
   - Verify Node.js version (requires 20+)

---

### Issue: ngrok Tunnel Fails

**Symptoms:**
- `ngrok http 8787` fails
- Tunnel URL not accessible
- Health check through tunnel fails

**Solutions:**
1. **Verify ngrok is installed:**
   ```bash
   ngrok version
   # If missing: brew install ngrok (macOS)
   ```

2. **Check ngrok authentication:**
   ```bash
   ngrok config check
   # If not authenticated, sign up at https://ngrok.com
   ```

3. **Verify MCP server is running:**
   ```bash
   curl http://localhost:8787/health
   ```

4. **Try Cloudflare Tunnel as alternative:**
   ```bash
   cloudflared tunnel --url http://localhost:8787
   ```

---

### Issue: Handshake Test Fails

**Symptoms:**
- Health check fails
- Initialize request fails
- Tools list returns empty
- Widget endpoint fails

**Solutions:**
1. **Verify MCP server is running:**
   ```bash
   curl http://localhost:8787/health
   ```

2. **Check tunnel URL is correct:**
   - Must be HTTPS (not HTTP)
   - Must match ngrok output exactly

3. **Check MCP server logs (Terminal 1):**
   - Look for error messages
   - Verify requests are being received

4. **Test endpoints individually:**
   ```bash
   # Health
   curl https://YOUR-URL.ngrok-free.dev/health
   
   # Initialize
   curl -X POST https://YOUR-URL.ngrok-free.dev/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
   ```

---

### Issue: ChatGPT Connector Fails

**Symptoms:**
- "Connection failed" error
- Connector shows error status
- Tools don't appear

**Solutions:**
1. **Verify URL format:**
   - Must include `/mcp` at the end
   - Must be HTTPS (not HTTP)
   - Example: `https://abc123.ngrok-free.dev/mcp`

2. **Check tunnel is still running:**
   - Look at Terminal 2 (ngrok)
   - Verify URL hasn't changed (ngrok free tier URLs can change)

3. **Check MCP server is still running:**
   - Look at Terminal 1
   - Verify no crashes or errors

4. **Handle ngrok warning page:**
   - First visit to ngrok URL shows warning
   - Click "Visit Site" to proceed
   - This is normal for ngrok free tier

5. **Try disconnecting and reconnecting:**
   - Disconnect connector in ChatGPT
   - Wait a few seconds
   - Reconnect with same URL

---

### Issue: Search Returns No Results

**Symptoms:**
- Widget appears but shows no vehicles
- Search returns empty results
- Error message in ChatGPT

**Solutions:**
1. **Verify inventory exists:**
   ```bash
   node scripts/verifyRockHillInventory.js
   ```

2. **Check MCP server logs (Terminal 1):**
   - Look for search request
   - Check for database query errors
   - Verify Supabase connection

3. **Check Supabase credentials:**
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
   - Or use `SUPABASE_SERVICE_ROLE_KEY` for RLS bypass

4. **Test search manually:**
   ```bash
   curl -X POST https://YOUR-URL.ngrok-free.dev/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search-vehicles","arguments":{"location":"Rock Hill, SC","make":"GMC","condition":"new"}}}'
   ```

---

### Issue: Widget Doesn't Load

**Symptoms:**
- Widget area is blank/white
- Widget doesn't appear in ChatGPT
- Browser console shows errors (if accessible)

**Solutions:**
1. **Verify WIDGET_HOST is set:**
   ```bash
   cd /Users/mac/AutoAgent/apps/mcp-server
   grep WIDGET_HOST .env
   # Should match your ngrok URL
   ```

2. **Check widget endpoint:**
   ```bash
   curl -I https://YOUR-URL.ngrok-free.dev/widget/vehicle-results
   # Should return HTTP 200
   ```

3. **Verify CSP headers:**
   ```bash
   curl -I https://YOUR-URL.ngrok-free.dev/widget/vehicle-results | grep -i "content-security-policy"
   # Should include: frame-ancestors https://chat.openai.com https://chatgpt.com
   ```

4. **Check MCP server logs (Terminal 1):**
   - Look for widget request
   - Check for errors

---

### Issue: Lead Submission Fails

**Symptoms:**
- Form submission fails
- Error message in ChatGPT
- Lead doesn't appear in dashboard

**Solutions:**
1. **Verify lead delivery is configured:**
   - Navigate to `http://localhost:3000/app/settings`
   - Check "Lead Delivery" section
   - Ensure method and endpoint are set

2. **Check MCP server logs (Terminal 1):**
   - Look for submit-lead request
   - Check for validation errors
   - Verify encryption key is set (`LEAD_ENC_KEY`)

3. **Check Supabase lead_delivery_logs:**
   ```sql
   SELECT * FROM lead_delivery_logs 
   ORDER BY attempted_at DESC 
   LIMIT 5;
   ```
   - Look for error messages
   - Check delivery status

4. **Verify dashboard is running:**
   - Check `http://localhost:3000` is accessible
   - Verify `/api/ingest/lead` endpoint exists

---

## Final Checklist

Before testing in ChatGPT, verify:

- [ ] ✅ MCP server running on port 8787
- [ ] ✅ ngrok tunnel active with HTTPS URL
- [ ] ✅ WIDGET_HOST updated in .env (if needed)
- [ ] ✅ MCP server restarted after .env update
- [ ] ✅ Handshake test script passes all checks
- [ ] ✅ ChatGPT connector URL ready: `https://YOUR-URL.ngrok-free.dev/mcp`
- [ ] ✅ Lead delivery configured in dashboard (for lead test)

**Your ChatGPT MCP Server URL:**
```
https://____________________.ngrok-free.dev/mcp
```

---

## Quick Reference

| Service | Local URL | Tunnel URL | Status Check |
|---------|-----------|------------|--------------|
| MCP Server | `http://localhost:8787` | `https://YOUR-URL.ngrok-free.dev` | `curl http://localhost:8787/health` |
| MCP Endpoint | `http://localhost:8787/mcp` | `https://YOUR-URL.ngrok-free.dev/mcp` | Handshake test script |
| Widget | `http://localhost:8787/widget/vehicle-results` | `https://YOUR-URL.ngrok-free.dev/widget/vehicle-results` | `curl -I <url>` |
| Dashboard | `http://localhost:3000` | N/A | Open in browser |

---

**Last Updated**: 2025-02-21  
**Next Step**: Execute steps 1-5, then proceed to ChatGPT testing (Step 6)

