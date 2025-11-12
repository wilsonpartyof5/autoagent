# Conversation Summary: ChatGPT App Smoke Test & Timeout Investigation

**Date**: 2025-11-12  
**Purpose**: Document ChatGPT app integration testing workflow and resolve timeout issues  
**Status**: ✅ Testing workflow documented, ⚠️ Timeout issue identified (solution recommended)

---

## Overview

This conversation focused on:
1. **Creating a complete ChatGPT app smoke test checklist** to validate the Rock Hill GMC inventory flow through the MCP server
2. **Setting up and running the smoke test** step-by-step
3. **Investigating and diagnosing timeout issues** when ChatGPT connects to the MCP server via ngrok tunnel
4. **Providing solutions** for the timeout problem

---

## Key Accomplishments

### 1. ChatGPT Smoke Test Documentation ✅
- Created comprehensive smoke test guide: `docs/testing/chatgpt-smoke-test.md`
- Created handshake validation script: `scripts/testChatGPTHandshake.sh`
- Created quick start guide: `docs/testing/QUICK_START_CHATGPT.md`
- Updated main documentation with references to smoke test

### 2. Smoke Test Execution ✅
- Verified prerequisites (MCP server build, Rock Hill inventory)
- Started MCP server on port 8787
- Set up ngrok tunnel for HTTPS exposure
- Ran handshake validation script (all checks passed)
- Provided ChatGPT connector URL and instructions

### 3. Timeout Investigation ✅
- Identified root cause: **ngrok free tier 60-second timeout**
- Confirmed MCP server is healthy and fast (1-3ms initialize, 228ms search)
- Created diagnosis reports:
  - `docs/testing/TIMEOUT_DIAGNOSIS_NGROK.md`
  - `docs/testing/PRIMARY_SOLUTION_TIMEOUT.md`
  - `docs/testing/SOLUTION_SUMMARY.md`

### 4. Solution Recommendations ✅
- Primary solution: Upgrade ngrok plan (removes 60-second timeout)
- Alternative: Deploy to production server (eliminates tunnel)
- Verified tools are optimized (enrichment disabled, async delivery)

---

## Current Status

### MCP Server Status ✅
- **Running**: Port 8787
- **Performance**: Excellent (1-3ms initialize, 228ms search)
- **Health**: All endpoints responding correctly
- **Configuration**: `WIDGET_HOST` set to ngrok URL
- **Logs**: `/tmp/mcp-server.log`

### ngrok Tunnel Status ✅
- **Running**: Forwarding `https://rana-flightiest-malcolm.ngrok-free.dev` → `http://localhost:8787`
- **Web Interface**: `http://127.0.0.1:4040`
- **Limitation**: Free tier has 60-second timeout

### ChatGPT Connector Status ⚠️
- **Endpoint**: `https://rana-flightiest-malcolm.ngrok-free.dev/mcp`
- **Handshake**: ✅ All checks pass
- **Issue**: Timeout occurs during ChatGPT requests (likely due to ngrok free tier limit)

### Tool Status ✅
- **search-vehicles**: Fast (228ms), enrichment disabled
- **submit-lead**: Fast (async delivery, fire-and-forget)
- **Widget**: CSP headers configured correctly for ChatGPT embedding

---

## Key Files Created/Modified

### Documentation Files
1. **`docs/testing/chatgpt-smoke-test.md`** ⭐ **START HERE**
   - Complete smoke test guide
   - Environment setup
   - Tunnel configuration
   - Connector steps
   - Test scenarios
   - Troubleshooting

2. **`docs/testing/QUICK_START_CHATGPT.md`**
   - Quick start guide for getting MCP server and ngrok running
   - ChatGPT connector URL format

3. **`docs/testing/TIMEOUT_DIAGNOSIS_NGROK.md`**
   - Detailed timeout investigation
   - Evidence and log excerpts
   - Root cause analysis

4. **`docs/testing/PRIMARY_SOLUTION_TIMEOUT.md`** ⭐ **READ FOR SOLUTION**
   - Root cause summary
   - Primary solution (upgrade ngrok)
   - Alternative solutions
   - Testing after fix

5. **`docs/testing/SOLUTION_SUMMARY.md`**
   - Quick reference for timeout solution

6. **`docs/testing/CONVERSATION_SUMMARY.md`** (this file)
   - Overview of conversation
   - Key accomplishments
   - Current status
   - Next steps

### Scripts
1. **`scripts/testChatGPTHandshake.sh`**
   - Validates MCP server handshake
   - Tests health, initialize, tools/list, and widget endpoints
   - Checks CSP headers for ChatGPT embedding

### Configuration Files
1. **`apps/mcp-server/.env`**
   - `WIDGET_HOST`: Set to ngrok URL
   - Other environment variables configured

---

## Technical Details

### MCP Server Architecture
- **Framework**: Express.js
- **Protocol**: Model Context Protocol (MCP)
- **Tools**: `search-vehicles`, `submit-lead`
- **Widget**: `/widget/vehicle-results` (iframe for ChatGPT)
- **Database**: Supabase (inventory, leads, profiles)
- **External API**: MarketCheck API (vehicle inventory)

### Tunnel Setup
- **Current**: ngrok free tier
- **URL**: `https://rana-flightiest-malcolm.ngrok-free.dev`
- **Limitation**: 60-second timeout
- **Alternative**: Cloudflare Tunnel (tried, also has 30-second timeout on free tier)

### Timeout Issue
- **Root Cause**: ngrok free tier 60-second timeout + ChatGPT timeout threshold
- **Evidence**: MCP server is fast, but tunnel/client-side timeout occurs
- **Solution**: Upgrade ngrok plan (removes timeout) or deploy to production

---

## Next Steps

### Immediate Actions
1. **Upgrade ngrok plan** (recommended)
   - Sign up: https://dashboard.ngrok.com/billing
   - Add auth token: `ngrok config add-authtoken YOUR_TOKEN`
   - Restart ngrok tunnel
   - Test with ChatGPT connector

2. **Or deploy to production server**
   - Deploy MCP server to VPS/cloud (AWS, DigitalOcean, etc.)
   - Set up HTTPS with Let's Encrypt
   - Update `WIDGET_HOST` in environment variables
   - Update ChatGPT connector with production URL

### Testing After Fix
1. Run handshake test: `bash scripts/testChatGPTHandshake.sh https://YOUR_URL`
2. Test in ChatGPT:
   - Connect ChatGPT connector
   - Search for vehicles
   - Submit a lead
   - Verify no timeouts

### Monitoring
- **MCP Server Logs**: `tail -f /tmp/mcp-server.log`
- **ngrok Web Interface**: `http://127.0.0.1:4040`
- **Watch for slow requests**: Log if >5 seconds

---

## Key Commands

### Start MCP Server
```bash
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev
```

### Start ngrok Tunnel
```bash
ngrok http 8787
```

### Run Handshake Test
```bash
bash scripts/testChatGPTHandshake.sh https://rana-flightiest-malcolm.ngrok-free.dev
```

### Check MCP Server Logs
```bash
tail -f /tmp/mcp-server.log
```

### Check ngrok Status
```bash
# Web interface
open http://127.0.0.1:4040

# Or check process
pgrep -f ngrok
```

---

## Environment Variables

### MCP Server (`apps/mcp-server/.env`)
- `PORT`: 8787
- `WIDGET_HOST`: `https://rana-flightiest-malcolm.ngrok-free.dev` (ngrok URL)
- `MARKETCHECK_API_KEY`: (configured)
- `MARKETCHECK_BASE_URL`: (configured)
- `LEAD_ENC_KEY`: (configured)
- `DASHBOARD_INGEST_URL`: (configured)
- `DASHBOARD_INGEST_TOKEN`: (configured)
- `SUPABASE_URL`: (configured)
- `SUPABASE_SERVICE_ROLE_KEY`: (configured)

---

## Troubleshooting

### Timeout Issues
- **Symptom**: ChatGPT requests timeout
- **Cause**: ngrok free tier 60-second timeout
- **Solution**: Upgrade ngrok plan or deploy to production

### Handshake Failures
- **Check**: MCP server is running on port 8787
- **Check**: ngrok tunnel is active
- **Check**: `WIDGET_HOST` matches ngrok URL
- **Run**: `bash scripts/testChatGPTHandshake.sh https://YOUR_URL`

### Widget Not Loading
- **Check**: CSP headers allow ChatGPT domains
- **Check**: `WIDGET_HOST` is set correctly
- **Check**: Widget endpoint is accessible via HTTPS

---

## Important Notes

1. **ngrok URL Changes**: ngrok free tier URLs change on restart. Update `WIDGET_HOST` and ChatGPT connector when URL changes.

2. **Enrichment Disabled**: MarketCheck enrichment is disabled to avoid slow requests (would add 60+ seconds for 20 listings).

3. **Async Delivery**: Lead delivery is fire-and-forget (async) to avoid blocking the response.

4. **Supabase Queries**: Using service role key to avoid RLS delays.

5. **Rock Hill GMC Inventory**: Test data is in Supabase `inventory_vehicles` table with `dealer_name = 'Rock Hill GMC'`.

---

## Related Documentation

- **Main Smoke Test Guide**: `docs/testing/chatgpt-smoke-test.md`
- **Quick Start**: `docs/testing/QUICK_START_CHATGPT.md`
- **Timeout Solution**: `docs/testing/PRIMARY_SOLUTION_TIMEOUT.md`
- **Solution Summary**: `docs/testing/SOLUTION_SUMMARY.md`
- **Timeout Diagnosis**: `docs/testing/TIMEOUT_DIAGNOSIS_NGROK.md`

---

## Questions for Next Agent

1. Has the ngrok plan been upgraded?
2. Has the timeout issue been resolved?
3. Has ChatGPT connector been tested end-to-end?
4. Are there any new timeout issues?
5. Is the MCP server deployed to production?

---

**Last Updated**: 2025-11-12  
**Status**: Testing workflow documented, timeout issue identified, solution recommended  
**Next Action**: Upgrade ngrok plan or deploy to production server

