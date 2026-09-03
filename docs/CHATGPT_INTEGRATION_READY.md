# ChatGPT App Integration - Ready for Demo

**Date**: 2025-02-21  
**Status**: ✅ **Ready for live demo**

> **📋 Complete Smoke Test Guide**: For a comprehensive step-by-step validation checklist, see [`docs/testing/chatgpt-smoke-test.md`](./testing/chatgpt-smoke-test.md). This guide covers environment setup, tunnel configuration, connector registration, test scenarios, and troubleshooting.

## Summary

Drevvy is now ready for end-to-end ChatGPT App integration testing with:
- ✅ **MarketCheck Integration**: Rock Hill GMC (dealer 11042155) API verified - 232 vehicles available
- ✅ **Sync Function**: Enhanced to auto-detect source parameter for dealer 11042155
- ✅ **Onboarding Guide**: Complete step-by-step guide for Rock Hill GMC onboarding
- ✅ **Demo Inventory**: 10 seeded demo vehicles available as fallback
- ✅ **Lead Delivery**: Configured for httpbin.org testing with ADF XML generation
- ✅ **Widget**: Ready for ChatGPT embedding (CSP headers, ui:ready events)
- ✅ **MCP Server**: Handshake validation documented and ready
- ⏳ **Live Inventory**: Pending manual sync execution (see onboarding guide)

## Inventory Status

**Current**: ⏳ **Pending Manual Sync Execution**

**Rock Hill GMC (Dealer 11042155)**:
- ✅ API verified: 232 vehicles available via source endpoint
- ✅ Sync function enhanced: Auto-detects source parameter
- ✅ Onboarding guide created: `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md`
- ✅ Onboarding summary: `docs/marketcheck/ROCK_HILL_ONBOARDING_SUMMARY.md`
- ✅ Migration script: `scripts/run-all-migrations.sql` (consolidated)
- ✅ Server running: Port 3000 (HTTP 200)
- ✅ Verification tools: `scripts/verifyRockHillInventory.js`, `scripts/captureRockHillSync.sh`
- ⏳ Migrations: Manual execution required (see `docs/marketcheck/MIGRATION_INSTRUCTIONS.md`)
- ⏳ Profile update: Manual execution required (see onboarding guide)
- ⏳ Sync execution: Manual execution required (see onboarding guide)
- ⏳ Inventory verification: Pending sync completion

**Next Step**: Follow `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md` or `docs/marketcheck/ROCK_HILL_ONBOARDING_SUMMARY.md` to import real MarketCheck inventory.

## Quick Start

### 1. Import MarketCheck Inventory (Rock Hill GMC)

**Recommended**: Use real MarketCheck inventory from Rock Hill GMC

1. Follow the complete onboarding guide: `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md`
2. Sign in at `http://localhost:3000/auth`
3. Navigate to `/app/setup` and select **MarketCheck** as your inventory provider (CDK and vAuto are coming soon)
4. Enter **Dealership name** (e.g., "Rock Hill GMC"), dealer_id=11042155, ZIP=29730
5. Run sync - should import 10+ GMC vehicles
6. Verify inventory in `/app/inventory`

**Note**: The dealership name field is now required. This allows you to manage multiple stores from one account.

**Expected Result**: 10+ GMC vehicles (Sierra, Yukon, etc.) from Rock Hill GMC

**Alternative - Demo Inventory**: If MarketCheck sync fails, use seeded demo inventory:
- Run `scripts/seed-demo-inventory.sql` in Supabase SQL Editor
- See `docs/marketcheck/ROCK_HILL_ONBOARDING_GUIDE.md` for details

### 2. Configure Lead Delivery

1. Navigate to `http://localhost:3000/app/settings`
2. Scroll to "Lead Delivery" section
3. Select "HTTP Endpoint"
4. Enter: `https://httpbin.org/post`
5. Click "Save Lead Delivery Settings"

### 3. Start Servers

```bash
# Terminal 1: MCP Server
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev

# Terminal 2: Dashboard
pnpm --filter dealer-dashboard dev

# Terminal 3: Expose MCP (ngrok)
ngrok http 8787
# Copy the HTTPS URL (e.g., https://abc123.ngrok-free.dev)
```

### 4. Connect to ChatGPT

1. Go to ChatGPT → Settings → Connectors
2. Add/Edit connector
3. **MCP Server URL**: `https://your-ngrok-url.ngrok-free.dev/mcp`
4. **Authentication**: None (or bearer token if configured)
5. ChatGPT will automatically validate connection

### 5. Test Search

In ChatGPT, try:
- "Search for used Toyota Camry near Tomball, TX"
- "Find new SUVs under $40,000"
- "Show me electric vehicles"

**Expected**: Widget loads with seeded vehicles displayed on map

### 6. Test Lead Submission

1. Click on a vehicle in the widget
2. Click "Request Info" or "Schedule Test Drive"
3. Fill out lead form
4. Submit

**Expected**:
- Lead appears in `/app/leads` with "Success" delivery status
- Delivery log in Supabase shows HTTP 200 to httpbin.org
- ADF XML visible at https://httpbin.org/post

## Verification Checklist

### Inventory
- [ ] 10 vehicles visible in `/app/inventory`
- [ ] Mix of new/used conditions
- [ ] Various body styles (Sedan, SUV, Pickup, Coupe)
- [ ] All tagged with `data_source = 'seed-demo'`
- [ ] Filter UI accessible via "Filters" button
- [ ] Filters persist in URL (shareable links)
- [ ] Active filter chips display and can be removed
- [ ] Filter by condition (new, used, certified), body type, price/MSRP range, days on lot, and boolean flags (has photos, seller comments, options)

### Settings
- [ ] MarketCheck dealer ID: 10015450
- [ ] ZIP: 77375
- [ ] Lead delivery: HTTP endpoint configured
- [ ] Endpoint URL: https://httpbin.org/post

### MCP Server
- [ ] Health check: `curl http://localhost:8787/health`
- [ ] Tools list: `curl -X POST http://localhost:8787/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`
- [ ] Widget accessible: `curl -I http://localhost:8787/widget/vehicle-results`
- [ ] CSP headers include `frame-ancestors https://chat.openai.com https://chatgpt.com`

### Lead Delivery
- [ ] Submit test lead via widget or MCP
- [ ] Check `/app/leads` for delivery status
- [ ] Verify delivery log in Supabase `lead_delivery_logs` table
- [ ] Check httpbin.org/post for ADF XML payload

## Known Issues

### MarketCheck API
- **Issue**: Returns `num_found: 1298` but `listings: []`
- **Workaround**: Using seeded demo inventory
- **Next Step**: MarketCheck confirmed **My Rock Hill GMC** (`mc_website_id 11042155`, `source=myrockhillgmc.com`) is returning data. Run the `/v2/car/dealer/inventory/active` call with `source=myrockhillgmc.com` and, once listings are confirmed, rerun the dashboard sync using that dealer so we can replace the seed data with live vehicles.

### Email Delivery
- **Status**: Stubbed (logs but doesn't send)
- **Next Step**: Integrate email service (SendGrid/SES)

### Supabase Service Role Key
- **Status**: MCP server falls back to anon key if not configured
- **Impact**: May have RLS limitations when fetching dealer settings
- **Fix**: Add `SUPABASE_SERVICE_ROLE_KEY` to `apps/mcp-server/.env`

## Files Created/Modified

**New Scripts**:
- `scripts/seed-demo-inventory.sql` - SQL to seed 10 demo vehicles
- `scripts/setupDemoUser.js` - Automated setup script (requires SERVICE_ROLE_KEY)
- `scripts/testLeadDelivery.js` - Test lead delivery to httpbin.org

**Documentation Updates**:
- `docs/marketcheck/dealer-sync-ask-jorge-lopez.md` - Added seeded inventory section
- `docs/marketcheck/STATUS.md` - Added demo workaround section
- `docs/lead-delivery/STATUS.md` - Updated with implementation status
- `docs/lead-delivery/adf-payload.md` - Added test results section
- `README.md` - Added "ChatGPT Live Test" section
- `docs/CHATGPT_INTEGRATION_READY.md` - This file

## SQL Output (for documentation)

**Vehicles Inserted**: 10  
**Conditions**: 2 (new, used)  
**Body Styles**: 4 (Sedan, SUV, Pickup, Coupe)  
**Dealer ID**: 10015450  
**Data Source**: seed-demo

See `scripts/seed-demo-inventory.sql` for complete SQL statements.

## Next Steps

1. ✅ **Complete**: All systems ready for demo
2. ⏳ **MarketCheck**: Contact support about API issue
3. ⏳ **Production**: Test with real CRM endpoints
4. ⏳ **Email**: Implement email delivery service

## Troubleshooting

**No vehicles in inventory**:
- Run `scripts/seed-demo-inventory.sql` in Supabase SQL Editor
- Verify `user_id` is correct
- Check RLS policies allow reads

**Lead delivery fails**:
- Verify lead delivery settings in `/app/settings`
- Check MCP server logs for errors
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is configured
- Check Supabase `lead_delivery_logs` table for error details

**Widget doesn't load in ChatGPT**:
- Verify ngrok/Cloudflare tunnel is active
- Check CSP headers include ChatGPT domains
- Test widget directly: `https://your-url/widget/vehicle-results`
- Check browser console for errors

**MCP connection fails**:
- Verify MCP server is running: `curl http://localhost:8787/health`
- Check ngrok URL is correct
- Verify no firewall blocking port 8787
- Check MCP server logs for errors
