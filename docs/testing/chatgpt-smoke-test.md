# ChatGPT App Smoke Test - Rock Hill GMC Inventory Flow

**Purpose**: Complete validation checklist for testing the ChatGPT App integration with the Drevvy MCP server using Rock Hill GMC inventory data.

**Estimated Time**: 45-60 minutes

**Prerequisites**:
- Node.js 20+ and pnpm 8+ installed
- ngrok account (free tier works) or Cloudflare Tunnel
- ChatGPT account with connector access
- Supabase project with migrations applied
- MarketCheck API key (for live inventory sync)

---

## Table of Contents

1. [Environment Prep](#1-environment-prep)
2. [Tunnel Setup](#2-tunnel-setup)
3. [ChatGPT Connector Steps](#3-chatgpt-connector-steps)
4. [Test Scenarios](#4-test-scenarios)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Environment Prep

### 1.1 Start MCP Server

**Terminal 1: MCP Server**
```bash
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev
```

**Expected Output**:
```
🚗 Drevvy MCP Server running on http://localhost:8787
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

### 1.2 Start Dashboard (Optional but Recommended)

**Terminal 2: Dashboard**
```bash
cd /Users/mac/AutoAgent
pnpm --filter dealer-dashboard dev
```

**Expected Output**:
```
✓ Ready in XXXms
○ Local: http://localhost:3000
```

**Verification**: Open `http://localhost:3000` in browser

### 1.3 Verify Rock Hill GMC Inventory

**Option A: Via SQL (Supabase SQL Editor)**

1. Open Supabase Dashboard → SQL Editor
2. Run the following query (replace `YOUR_USER_ID` with your actual user ID):

```sql
-- Get your user ID first
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Count Rock Hill GMC vehicles
SELECT 
  COUNT(*) as total_vehicles,
  COUNT(*) FILTER (WHERE data_source = 'marketcheck-api') as marketcheck_vehicles,
  COUNT(*) FILTER (WHERE dealer_id = '11042155') as rock_hill_vehicles,
  COUNT(DISTINCT make) as makes,
  COUNT(DISTINCT condition) as conditions,
  MIN(year) as min_year,
  MAX(year) as max_year
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID'
  AND dealer_id = '11042155';

-- Sample vehicles
SELECT 
  vin,
  year,
  make,
  model,
  condition,
  price,
  miles,
  dealer_id,
  data_source,
  created_at
FROM inventory_vehicles
WHERE user_id = 'YOUR_USER_ID'
  AND dealer_id = '11042155'
  AND data_source = 'marketcheck-api'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results**:
- At least 10+ vehicles from Rock Hill GMC (dealer_id: 11042155)
- Make: GMC
- Models: Sierra, Yukon, etc.
- Condition: NEW
- Data source: `marketcheck-api`

**Option B: Via Verification Script**

```bash
cd /Users/mac/AutoAgent
node scripts/verifyRockHillInventory.js
```

**Expected Output**:
```
✅ Found X vehicles for Rock Hill GMC
📊 Summary:
   Total vehicles: X
   From MarketCheck: X
   Makes: GMC
   Conditions: NEW
   Year range: 2024-2026
```

**If No Inventory Found**:

1. Follow the onboarding guide: `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md`
2. Or use demo inventory: Run `scripts/seed-demo-inventory.sql` in Supabase SQL Editor
3. Verify again using Option A or B above

### 1.4 Required Environment Variables

**MCP Server** (`apps/mcp-server/.env`):
```bash
# Copy example file
cp apps/mcp-server/env.example apps/mcp-server/.env

# Required variables:
PORT=8787
MARKETCHECK_API_KEY=<your-marketcheck-key>
MARKETCHECK_BASE_URL=https://api.marketcheck.com
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>  # Recommended for RLS bypass
LEAD_ENC_KEY=<32-byte-base64-key>  # Generate with: openssl rand -base64 32
DASHBOARD_INGEST_URL=http://localhost:3000/api/ingest/lead
DASHBOARD_INGEST_TOKEN=<optional-bearer-token>
WIDGET_HOST=<will-be-set-after-tunnel-setup>
```

**Dashboard** (`apps/dealer-dashboard/.env.local`):
```bash
# Copy example file
cp apps/dealer-dashboard/.env.example apps/dealer-dashboard/.env.local

# Required variables:
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**Generate Lead Encryption Key**:
```bash
openssl rand -base64 32
```

**Verify Environment**:
```bash
# Check MCP server can read env vars
cd /Users/mac/AutoAgent/apps/mcp-server
node -e "require('dotenv').config(); console.log('MARKETCHECK_API_KEY:', process.env.MARKETCHECK_API_KEY ? 'SET' : 'MISSING');"
```

---

## 2. Tunnel Setup

### 2.1 ngrok (Preferred)

**Installation** (if not already installed):
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

**Start Tunnel**:

**Terminal 3: ngrok**
```bash
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

**Important**: Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

**Verify Tunnel**:
```bash
# Test health endpoint through tunnel
curl https://abc123.ngrok-free.dev/health

# Test MCP endpoint
curl https://abc123.ngrok-free.dev/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

**Update WIDGET_HOST**:
```bash
# In apps/mcp-server/.env, set:
WIDGET_HOST=https://abc123.ngrok-free.dev
```

**Note**: If using ngrok free tier, you may see a warning page on first visit. This is normal and can be bypassed.

### 2.2 Cloudflare Tunnel (Alternative)

**Installation**:
```bash
# macOS
brew install cloudflared

# Or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

**Start Tunnel**:
```bash
cloudflared tunnel --url http://localhost:8787
```

**Expected Output**:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://abc123.trycloudflare.com
+--------------------------------------------------------------------------------------------+
```

**Verify Tunnel**:
```bash
curl https://abc123.trycloudflare.com/health
```

**Update WIDGET_HOST**:
```bash
# In apps/mcp-server/.env, set:
WIDGET_HOST=https://abc123.trycloudflare.com
```

**Restart MCP Server** after updating `WIDGET_HOST`:
```bash
# In Terminal 1, stop (Ctrl+C) and restart:
pnpm --filter mcp-server dev
```

### 2.3 Confirm MCP Endpoint Reachable

**Test Script**:
```bash
# Use the helper script
cd /Users/mac/AutoAgent
bash scripts/testChatGPTHandshake.sh https://your-tunnel-url.ngrok-free.dev
```

**Or Manual Test**:
```bash
# Health check
curl https://your-tunnel-url.ngrok-free.dev/health

# MCP initialize
curl https://your-tunnel-url.ngrok-free.dev/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
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
```

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "tools": {
        "listChanged": true
      },
      "resources": {
        "subscribe": true,
        "listChanged": true
      },
      "prompts": {
        "listChanged": true
      },
      "logging": {}
    },
    "serverInfo": {
      "name": "autoagent-mcp-server",
      "version": "1.0.0"
    },
    "initialized": true
  }
}
```

---

## 3. ChatGPT Connector Steps

### 3.1 Register/Update Connector

1. **Open ChatGPT** → Settings → Connectors (or Apps → Connectors)
2. **Add New Connector** or **Edit Existing**:
   - **MCP Server URL**: `https://your-tunnel-url.ngrok-free.dev/mcp`
   - **Authentication**: None (unless you've configured bearer token auth)
   - **Name** (optional): "Drevvy MCP Server"
3. **Save** the connector

### 3.2 Handshake Validation

ChatGPT will automatically perform the MCP handshake when you save the connector. The handshake consists of:

1. **Initialize Request**:
   ```json
   {
     "jsonrpc": "2.0",
     "method": "initialize",
     "id": 1,
     "params": {
       "protocolVersion": "2025-06-18",
       "capabilities": {},
       "clientInfo": {
         "name": "ChatGPT",
         "version": "1.0.0"
       }
     }
   }
   ```

2. **Initialized Notification** (sent by server):
   ```json
   {
     "jsonrpc": "2.0",
     "method": "initialized",
     "params": {}
   }
   ```

3. **Tools List Request**:
   ```json
   {
     "jsonrpc": "2.0",
     "method": "tools/list",
     "id": 2
   }
   ```

**Success Indicators**:
- ✅ Connector shows "Connected" status in ChatGPT
- ✅ No error messages in connector settings
- ✅ Tools appear available in ChatGPT interface

**Failure Indicators**:
- ❌ Connector shows "Connection failed" or timeout
- ❌ Error message: "Unable to reach MCP server"
- ❌ Tools not appearing in ChatGPT

**Check MCP Server Logs** (Terminal 1):
```
🔧 Initialize request received: { protocolVersion: '2025-06-18', ... }
📢 Sending initialized notification
✅ Initialized notification received
🔧 Tools list request received
```

**Manual Handshake Test**:
```bash
# Test initialize
curl https://your-tunnel-url.ngrok-free.dev/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | jq .

# Test tools/list
curl https://your-tunnel-url.ngrok-free.dev/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq .
```

**Expected tools/list Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "search-vehicles",
        "description": "Search for vehicles by location, make, model, condition, price range, and other filters",
        "inputSchema": {
          "type": "object",
          "properties": {
            "location": { "type": "string", "description": "..." },
            "make": { "type": "string", "description": "..." },
            ...
          }
        }
      },
      {
        "name": "submit-lead",
        "description": "Submit a lead for a vehicle",
        "inputSchema": {
          "type": "object",
          "properties": {
            "vehicleId": { "type": "string" },
            "vin": { "type": "string" },
            "user": { "type": "object", ... },
            ...
          }
        }
      }
    ]
  }
}
```

---

## 4. Test Scenarios

### 4.1 Search Scenario: "Show me new GMC trucks near Rock Hill"

**In ChatGPT**, type:
```
Show me new GMC trucks near Rock Hill, SC
```

**Expected Behavior**:
1. ChatGPT calls `search-vehicles` tool with parameters:
   ```json
   {
     "location": "Rock Hill, SC",
     "make": "GMC",
     "condition": "new",
     "bodyType": "Truck"
   }
   ```
2. MCP server queries Supabase for Rock Hill GMC inventory (dealer_id: 11042155)
3. Returns vehicle results with widget component
4. ChatGPT embeds the vehicle-results widget
5. Widget displays vehicles on map with markers

**Expected Tool Response**:
```json
{
  "content": [
    {
      "type": "text",
      "text": "Found 15 new GMC trucks near Rock Hill, SC"
    },
    {
      "type": "component",
      "component": {
        "type": "ui",
        "name": "vehicle-results",
        "props": {
          "vehicles": [
            {
              "vin": "1GT...",
              "year": 2025,
              "make": "GMC",
              "model": "Sierra",
              "price": 45000,
              "dealer": {
                "name": "My Rock Hill GMC",
                "city": "Rock Hill",
                "state": "SC"
              },
              ...
            }
          ]
        }
      }
    }
  ]
}
```

**Verification Steps**:

1. **Check MCP Server Logs** (Terminal 1):
   ```
   🔍 Search vehicles request: { location: 'Rock Hill, SC', make: 'GMC', condition: 'new', ... }
   📊 Querying inventory for dealer: 11042155
   ✅ Found 15 vehicles
   ```

2. **Check Widget Renders**:
   - Widget should appear in ChatGPT interface
   - Map should show vehicle markers
   - Clicking a vehicle should show details

3. **Check Widget Events** (Browser DevTools if accessible):
   - `openai:set_globals` event received
   - `ui:ready` event emitted
   - No console errors

4. **Verify Vehicle Data**:
   - All vehicles should be from Rock Hill GMC (dealer_id: 11042155)
   - Condition should be "NEW"
   - Make should be "GMC"
   - Models: Sierra, Yukon, etc.

**Alternative Test Queries**:
- "Find used GMC SUVs under $50,000 near Rock Hill"
- "Show me all new vehicles from Rock Hill GMC"
- "Search for GMC Sierra trucks in South Carolina"

### 4.2 Lead Submission Scenario

**Prerequisites**:
- Lead delivery must be configured in dashboard (`/app/settings`)
- Set delivery method to "HTTP Endpoint"
- Set endpoint URL (e.g., `https://httpbin.org/post` for testing)

**In ChatGPT**, after viewing vehicle results:
1. Click on a vehicle in the widget
2. Click "Request Info" or "Schedule Test Drive"
3. Fill out the lead form:
   - Name: "John Doe"
   - Email: "john.doe@example.com"
   - Phone: "555-123-4567" (optional)
   - Preferred Time: "Morning" (optional)
4. Check consent checkbox
5. Submit the form

**Expected Behavior**:
1. Widget calls `submit-lead` tool via ChatGPT
2. MCP server:
   - Validates input
   - Encrypts lead data
   - Stores lead in database
   - Forwards to dashboard (`/api/ingest/lead`)
   - Delivers to configured endpoint (httpbin.org or CRM)
   - Logs delivery attempt

**Expected Tool Response**:
```json
{
  "success": true,
  "content": [
    {
      "type": "text",
      "text": "Thank you! Your request has been submitted. A representative from My Rock Hill GMC will contact you soon."
    }
  ],
  "structuredContent": {
    "leadId": "abc123...",
    "vehicleId": "vehicle-123",
    "dealerId": "11042155",
    "vin": "1GT..."
  }
}
```

**Verification Steps**:

1. **Check MCP Server Logs** (Terminal 1):
   ```
   📝 Submit lead request: { vehicleId: '...', vin: '...', user: { name: 'John Doe', ... } }
   ✅ Lead submitted: abc123...
   📤 Forwarding lead to dashboard
   📦 Delivering lead to https://httpbin.org/post
   ✅ Lead delivery successful: HTTP 200
   ```

2. **Check Dashboard** (`http://localhost:3000/app/leads`):
   - Lead should appear in leads list
   - Status should be "Success"
   - Delivery method should show "HTTP"
   - Delivery endpoint should show the configured URL

3. **Check Supabase** (`lead_delivery_logs` table):
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

   **Expected Result**:
   ```
   lead_id: abc123...
   delivery_method: http
   delivery_target: https://httpbin.org/post
   status: success
   http_status: 200
   attempted_at: 2025-02-21 10:30:00
   ```

4. **Check httpbin.org** (if using for testing):
   - Visit `https://httpbin.org/post` (or check your CRM endpoint)
   - Should see ADF XML payload in request body
   - XML should contain lead information (encrypted user data, vehicle info)

**ADF XML Structure** (example):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect>
    <id source="Drevvy">abc123...</id>
    <requestdate>2025-02-21T10:30:00Z</requestdate>
    <vehicle>
      <vin>1GT...</vin>
      <year>2025</year>
      <make>GMC</make>
      <model>Sierra</model>
    </vehicle>
    <customer>
      <contact>
        <name part="full">John Doe</name>
        <email>john.doe@example.com</email>
        <phone type="voice">555-123-4567</phone>
      </contact>
    </customer>
  </prospect>
</adf>
```

### 4.3 Widget Verification

**Verify Widget Renders in ChatGPT**:

1. **Widget Loads**:
   - Widget iframe appears in ChatGPT interface
   - Map renders with vehicle markers
   - No blank/white screen

2. **Widget Events** (check MCP server logs):
   ```
   🎨 Widget request: /widget/vehicle-results
   📡 Widget state received: { vehicles: [...], ... }
   ```

3. **Widget Interactivity**:
   - Clicking vehicle markers shows details
   - Lead form opens when clicking "Request Info"
   - Form submission works

4. **Widget CSP Headers** (verify via curl):
   ```bash
   curl -I https://your-tunnel-url.ngrok-free.dev/widget/vehicle-results
   ```

   **Expected Headers**:
   ```
   Content-Security-Policy: default-src 'self'; ... frame-ancestors https://chat.openai.com https://chatgpt.com
   ```

   **Note**: Should NOT include `X-Frame-Options: DENY`

---

## 5. Troubleshooting

### 5.1 MCP Endpoint Unreachable

**Symptoms**:
- ChatGPT connector shows "Connection failed"
- `curl` to tunnel URL returns timeout or connection refused
- Health check fails

**Diagnosis**:
```bash
# Check if MCP server is running
curl http://localhost:8787/health

# Check if tunnel is running
# ngrok: Check http://127.0.0.1:4040 (web interface)
# cloudflared: Check terminal output

# Test tunnel URL directly
curl https://your-tunnel-url.ngrok-free.dev/health
```

**Solutions**:

1. **MCP Server Not Running**:
   ```bash
   # Restart MCP server
   cd /Users/mac/AutoAgent
   pnpm --filter mcp-server dev
   ```

2. **Tunnel Not Running**:
   ```bash
   # Restart ngrok
   ngrok http 8787
   
   # Or restart cloudflared
   cloudflared tunnel --url http://localhost:8787
   ```

3. **Port Conflict**:
   ```bash
   # Check if port 8787 is in use
   lsof -i :8787
   
   # Kill process if needed
   kill -9 <PID>
   ```

4. **Firewall/Network Issues**:
   - Check firewall settings
   - Verify network connectivity
   - Try different tunnel service (ngrok vs Cloudflare)

5. **SSL Certificate Issues** (Cloudflare Tunnel):
   - Cloudflare Tunnel uses its own SSL
   - If issues persist, try ngrok instead

### 5.2 Supabase Auth Errors

**Symptoms**:
- MCP server logs show "Supabase authentication failed"
- Inventory queries return empty results
- Lead submission fails with auth error

**Diagnosis**:
```bash
# Check Supabase credentials in .env
cd /Users/mac/AutoAgent/apps/mcp-server
cat .env | grep SUPABASE

# Test Supabase connection
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
supabase.from('inventory_vehicles').select('count').limit(1).then(r => console.log('Connection:', r.error ? 'FAILED' : 'OK'));
"
```

**Solutions**:

1. **Missing SUPABASE_SERVICE_ROLE_KEY**:
   - Add `SUPABASE_SERVICE_ROLE_KEY` to `apps/mcp-server/.env`
   - Service role key bypasses RLS policies
   - Get from Supabase Dashboard → Settings → API

2. **Invalid Credentials**:
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
   - Check Supabase Dashboard for correct values

3. **RLS Policy Issues**:
   - If using anon key, ensure RLS policies allow reads
   - Or use service role key for MCP server

4. **Missing Migrations**:
   ```bash
   # Run migrations in Supabase SQL Editor
   # File: scripts/run-all-migrations.sql
   ```

### 5.3 MarketCheck API Issues

**Symptoms**:
- Search returns 0 vehicles
- MCP server logs show "MarketCheck API error"
- Inventory sync fails

**Diagnosis**:
```bash
# Check MarketCheck API key
cd /Users/mac/AutoAgent/apps/mcp-server
cat .env | grep MARKETCHECK

# Test MarketCheck API directly
curl "https://api.marketcheck.com/v2/car/dealer/inventory/active?dealer_id=11042155&api_key=YOUR_KEY" | jq .
```

**Solutions**:

1. **Missing API Key**:
   - Add `MARKETCHECK_API_KEY` to `apps/mcp-server/.env`
   - Get key from MarketCheck dashboard

2. **Invalid API Key**:
   - Verify key is correct
   - Check key hasn't expired
   - Regenerate if needed

3. **Rate Limiting**:
   - MarketCheck may rate limit requests
   - Wait a few minutes and retry
   - Check MarketCheck dashboard for rate limit status

4. **Dealer ID Not Found**:
   - Verify dealer_id: 11042155 (Rock Hill GMC)
   - Check MarketCheck dashboard for correct dealer ID
   - Ensure dealer has active inventory feed

5. **Use Local Inventory Instead**:
   - If MarketCheck API fails, use Supabase inventory
   - Ensure Rock Hill GMC vehicles are synced to `inventory_vehicles` table
   - MCP server will query Supabase directly

### 5.4 Lead Delivery Failures

**Symptoms**:
- Lead submission succeeds but delivery fails
- Dashboard shows "Failed" status
- `lead_delivery_logs` shows error status

**Diagnosis**:
```bash
# Check lead delivery logs in Supabase
# Run in Supabase SQL Editor:
SELECT 
  lead_id,
  delivery_method,
  delivery_target,
  status,
  http_status,
  error_message,
  attempted_at
FROM lead_delivery_logs
ORDER BY attempted_at DESC
LIMIT 5;
```

**Solutions**:

1. **Delivery Endpoint Not Configured**:
   - Navigate to `http://localhost:3000/app/settings`
   - Configure lead delivery method (HTTP or Email)
   - Set endpoint URL or email address
   - Save settings

2. **Invalid Endpoint URL**:
   - Verify endpoint URL is correct
   - Test endpoint with curl:
     ```bash
     curl -X POST https://your-endpoint-url.com/leads \
       -H "Content-Type: application/xml" \
       -d '<adf>...</adf>'
     ```

3. **Endpoint Returns Error**:
   - Check endpoint logs
   - Verify endpoint accepts ADF XML
   - Check endpoint authentication (if required)

4. **Email Delivery Issues**:
   - Email delivery is currently stubbed (logs but doesn't send)
   - Use HTTP endpoint for testing
   - See `docs/lead-delivery/STATUS.md` for email implementation status

5. **Resend Failed Lead**:
   - Navigate to `http://localhost:3000/app/leads`
   - Find failed lead
   - Click "Resend" button
   - Check logs for new delivery attempt

### 5.5 Widget Not Loading in ChatGPT

**Symptoms**:
- Widget doesn't appear in ChatGPT interface
- Blank/white screen where widget should be
- Browser console shows CSP errors

**Diagnosis**:
```bash
# Check widget endpoint
curl -I https://your-tunnel-url.ngrok-free.dev/widget/vehicle-results

# Check CSP headers
curl -I https://your-tunnel-url.ngrok-free.dev/widget/vehicle-results | grep -i "content-security-policy"
```

**Solutions**:

1. **CSP Headers Missing**:
   - Verify `frame-ancestors` includes ChatGPT domains
   - Check MCP server code: `apps/mcp-server/src/index.ts`
   - Ensure CSP middleware is applied

2. **X-Frame-Options Blocking**:
   - Verify `X-Frame-Options` header is removed
   - Check MCP server code removes this header

3. **Widget Host Not Set**:
   - Ensure `WIDGET_HOST` is set in `apps/mcp-server/.env`
   - Should match tunnel URL
   - Restart MCP server after updating

4. **Tunnel URL Changed**:
   - ngrok free tier URLs change on restart
   - Update `WIDGET_HOST` and restart MCP server
   - Update ChatGPT connector URL

5. **Browser Console Errors**:
   - Open ChatGPT in browser (if possible)
   - Check browser console for errors
   - Look for CSP violations or network errors

### 5.6 Tools Not Appearing in ChatGPT

**Symptoms**:
- ChatGPT connector connects but tools don't appear
- `tools/list` returns empty array
- ChatGPT doesn't call tools

**Diagnosis**:
```bash
# Test tools/list manually
curl https://your-tunnel-url.ngrok-free.dev/mcp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq .
```

**Solutions**:

1. **Invalid Tool Schema**:
   - Check MCP server logs for schema errors
   - Verify tool definitions in `apps/mcp-server/src/tools/`
   - Ensure JSON schema is valid

2. **Handshake Incomplete**:
   - Verify `initialize` response includes `initialized: true`
   - Check that `initialized` notification is sent
   - Restart MCP server if needed

3. **Protocol Version Mismatch**:
   - ChatGPT may require specific protocol version
   - Check MCP server supports protocol version in initialize request
   - Update if needed

4. **ChatGPT Cache**:
   - Disconnect and reconnect connector
   - Clear ChatGPT cache (if possible)
   - Try in incognito/private window

### 5.7 Log File Locations

**MCP Server Logs**:
- Console output (Terminal 1)
- Structured JSON logs (if configured)
- Check for errors, warnings, or failed requests

**Dashboard Logs**:
- Console output (Terminal 2)
- Next.js dev server logs
- Check for API errors or database connection issues

**Monitor Logs**:
```bash
# Tail MCP server logs (if logging to file)
tail -f /path/to/mcp-server.log

# Monitor ngrok requests
# Open http://127.0.0.1:4040 in browser

# Check Supabase logs
# Supabase Dashboard → Logs → API Logs
```

### 5.8 Diagnostic Scripts

**Test MCP Handshake**:
```bash
cd /Users/mac/AutoAgent
bash scripts/testChatGPTHandshake.sh https://your-tunnel-url.ngrok-free.dev
```

**Monitor MCP Server**:
```bash
cd /Users/mac/AutoAgent
bash scripts/monitor-mcp.sh
```

**Diagnose Inventory Issues**:
```bash
cd /Users/mac/AutoAgent
node scripts/diagnose-inventory-issue.js
```

**Verify Rock Hill Inventory**:
```bash
cd /Users/mac/AutoAgent
node scripts/verifyRockHillInventory.js
```

**Test Lead Delivery**:
```bash
cd /Users/mac/AutoAgent
node scripts/testLeadDelivery.js
```

---

## Quick Reference

### Key URLs
- **MCP Server**: `http://localhost:8787`
- **Dashboard**: `http://localhost:3000`
- **Health Check**: `http://localhost:8787/health`
- **MCP Endpoint**: `http://localhost:8787/mcp`
- **Widget**: `http://localhost:8787/widget/vehicle-results`

### Key Commands
```bash
# Start MCP server
pnpm --filter mcp-server dev

# Start dashboard
pnpm --filter dealer-dashboard dev

# Start ngrok tunnel
ngrok http 8787

# Test handshake
bash scripts/testChatGPTHandshake.sh https://your-tunnel-url.ngrok-free.dev

# Verify inventory
node scripts/verifyRockHillInventory.js
```

### Key Environment Variables
- `MARKETCHECK_API_KEY`: MarketCheck API key
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (recommended)
- `LEAD_ENC_KEY`: 32-byte base64 encryption key
- `WIDGET_HOST`: Tunnel URL (set after tunnel setup)

### Rock Hill GMC Details
- **Dealer ID**: 11042155
- **ZIP**: 29730
- **Location**: Rock Hill, SC
- **Source**: myrockhillgmc.com
- **Expected Inventory**: 10+ GMC vehicles (Sierra, Yukon, etc.)

---

## Success Criteria

✅ **Environment Prep**:
- MCP server running on port 8787
- Dashboard running on port 3000 (optional)
- Rock Hill GMC inventory verified (10+ vehicles)
- All environment variables set

✅ **Tunnel Setup**:
- Tunnel active and reachable
- Health check returns 200 OK
- MCP endpoint responds to initialize request
- `WIDGET_HOST` updated and MCP server restarted

✅ **ChatGPT Connector**:
- Connector shows "Connected" status
- Handshake completes successfully
- Tools appear in ChatGPT interface

✅ **Test Scenarios**:
- Search returns Rock Hill GMC vehicles
- Widget renders in ChatGPT
- Lead submission succeeds
- Lead appears in dashboard
- Delivery log shows success status

---

## Next Steps

After completing the smoke test:

1. **Document Results**: Note any issues or deviations from expected behavior
2. **Update Configuration**: Adjust settings based on test results
3. **Production Readiness**: Review deployment checklist before going live
4. **Monitor**: Set up monitoring and alerting for production

For production deployment, see:
- `docs/deployment/production.md`
- `docs/CHATGPT_INTEGRATION_READY.md`

---

**Last Updated**: 2025-02-21  
**Version**: 1.0.0

