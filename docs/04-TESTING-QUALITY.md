# Testing & Quality Assurance

**Last Updated**: 2025-11-12  
**Status**: ✅ Active Documentation

This document consolidates all testing guides, quality assurance procedures, validation reports, and troubleshooting documentation.

---

## Table of Contents

1. [ChatGPT Smoke Test Guide](#chatgpt-smoke-test-guide)
2. [Quick Start for Testing](#quick-start-for-testing)
3. [Timeout Investigation & Solutions](#timeout-investigation--solutions)
4. [Strict Validation Implementation](#strict-validation-implementation)
5. [Test Execution Logs](#test-execution-logs)
6. [Troubleshooting Guide](#troubleshooting-guide)

---

## ChatGPT Smoke Test Guide

### Purpose

Complete validation checklist for testing the ChatGPT App integration with the Drevvy MCP server using Rock Hill GMC inventory data.

**Estimated Time**: 45-60 minutes

### Prerequisites

- Node.js 20+ and pnpm 8+ installed
- ngrok account (free tier works) or Cloudflare Tunnel
- ChatGPT account with connector access
- Supabase project with migrations applied
- MarketCheck API key (for live inventory sync)

### Environment Prep

#### 1.1 Start MCP Server

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

#### 1.2 Start Dashboard (Optional but Recommended)

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

#### 1.3 Verify Rock Hill GMC Inventory

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

1. Follow the onboarding guide: `docs/05-MARKETCHECK-INTEGRATION.md`
2. Or use demo inventory: Run `scripts/seed-demo-inventory.sql` in Supabase SQL Editor

### Tunnel Setup

#### 2.1 Start ngrok Tunnel

**Terminal 3: ngrok**
```bash
ngrok http 8787
```

**Expected Output**:
```
Forwarding  https://abc123.ngrok-free.dev -> http://localhost:8787
```

**Important**: Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

#### 2.2 Update WIDGET_HOST

**Update `apps/mcp-server/.env`**:
```bash
WIDGET_HOST=https://abc123.ngrok-free.dev
```

**Restart MCP Server** (Terminal 1):
- Stop the server (Ctrl+C)
- Restart: `pnpm --filter mcp-server dev`

#### 2.3 Verify Tunnel

```bash
curl https://abc123.ngrok-free.dev/health
```

**Expected Response**: `{"ok":true,"status":"healthy",...}`

### ChatGPT Connector Steps

#### 3.1 Create/Update Connector

1. Go to ChatGPT → Settings → Connectors
2. Click "Add Connector" or edit existing
3. **MCP Server URL**: `https://abc123.ngrok-free.dev/mcp`
4. **Authentication**: None (or bearer token if configured)
5. Click "Save" or "Connect"

#### 3.2 Verify Connection

ChatGPT should automatically:
- Call `initialize` method
- Call `tools/list` method
- Display available tools in interface

**If connection fails**:
- Check ngrok tunnel is active
- Verify MCP server is running
- Check MCP server logs for errors
- Run handshake test script (see below)

### Test Scenarios

#### 4.1 Vehicle Search Test

**In ChatGPT**, try:
- "Search for used Toyota Camry near Tomball, TX"
- "Find new SUVs under $40,000"
- "Show me electric vehicles"

**Expected Results**:
- Widget loads with vehicle results displayed on map
- Vehicle cards show VIN, price, mileage, photos
- Map pins correspond to vehicle locations
- Filter chips work correctly

#### 4.2 Lead Submission Test

1. Click on a vehicle in the widget
2. Click "Request Info" or "Schedule Test Drive"
3. Fill out lead form:
   - Name: Test User
   - Email: test@example.com
   - Phone: (optional)
   - Consent: Check box (required)
4. Submit

**Expected Results**:
- Success message appears
- Lead appears in `/app/leads` dashboard
- Delivery status shows "Success" or "Pending"
- Delivery log created in Supabase

#### 4.3 Handshake Test Script

Run comprehensive handshake validation:

```bash
bash scripts/testChatGPTHandshake.sh https://abc123.ngrok-free.dev
```

**Expected Output**:
```
🧪 Drevvy ChatGPT MCP Handshake Test
========================================
MCP Server URL: https://abc123.ngrok-free.dev
MCP Endpoint: https://abc123.ngrok-free.dev/mcp
Health Endpoint: https://abc123.ngrok-free.dev/health

✅ Health Check: HTTP 200
✅ MCP Initialize: HTTP 200
✅ MCP Tools List: HTTP 200
✅ Widget endpoint: HTTP 200
✅ CSP header includes ChatGPT domains
✅ All handshake tests completed
```

---

## Quick Start for Testing

### Current Status

- ✅ MCP server running on port 8787
- ✅ ngrok tunnel: `https://autoagentmcp-server-production.up.railway.app`
- ✅ Handshake tests passing
- ⚠️ Timeout issue: ngrok free tier 60-second limit

### Quick Commands

```bash
# Start MCP server
cd /Users/mac/AutoAgent
pnpm --filter mcp-server dev

# Start ngrok tunnel
ngrok http 8787

# Run handshake test
bash scripts/testChatGPTHandshake.sh https://autoagentmcp-server-production.up.railway.app

# Check logs
tail -f /tmp/mcp-server.log
```

### Important Links

- **ChatGPT Connector URL**: `https://autoagentmcp-server-production.up.railway.app/mcp`
- **ngrok Web Interface**: `http://127.0.0.1:4040`
- **MCP Server Logs**: `/tmp/mcp-server.log`
- **ngrok Dashboard**: https://dashboard.ngrok.com

---

## Timeout Investigation & Solutions

### Root Cause

**ngrok free tier 60-second timeout** + ChatGPT timeout threshold

### Evidence

- MCP server is healthy and fast (1-3ms initialize, 228ms search)
- ngrok tunnel is stable
- Timeout occurs at tunnel/client-side layer
- Tools are optimized (enrichment disabled, async delivery)

### Primary Solution: Upgrade ngrok Plan

**Steps**:
1. Sign up for ngrok paid plan: https://dashboard.ngrok.com/billing
2. Add auth token: `ngrok config add-authtoken YOUR_TOKEN`
3. Restart ngrok tunnel
4. Test with ChatGPT connector

**Benefits**:
- Removes 60-second timeout limit
- More stable connections
- Better performance

### Alternative Solution: Deploy to Production

**Steps**:
1. Deploy MCP server to VPS/cloud (AWS, DigitalOcean, Railway, etc.)
2. Set up HTTPS with Let's Encrypt (or use Railway/Vercel automatic SSL)
3. Update `WIDGET_HOST` in environment variables
4. Update ChatGPT connector with production URL

**Benefits**:
- Eliminates tunnel entirely
- More reliable
- Better performance
- Production-ready

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

## Strict Validation Implementation

### Overview

This implementation enforces strict provider validation and enrichment consistency for UVS ingestion. All provider mappers validate outputs against schemas with enums and required fields. Invalid payloads are quarantined/logged and not written to UVS.

### Key Features

#### Strict Validation
- All required blocks must be present and valid
- All enum values are strictly enforced
- Invalid units (e.g., "miles" instead of "mi") are rejected
- Range validations prevent invalid data

#### Quarantine System
- Invalid records are never written to UVS
- Structured logging with provider, vehicleId, and error details
- Metrics tracking for monitoring and debugging
- Error categorization (validation, normalization, processing)

#### No Invalid Data in UVS
- Validation at orchestrator level (primary)
- Validation at storage level (safety check)
- Quarantine system prevents any invalid data from being persisted

### Implementation Details

#### 1. Strict Zod Schemas ✅

**Location**: `packages/shared/src/uvs-provider-schemas.ts`

Created comprehensive Zod schemas that enforce:
- **Required blocks**: `baseIdentity`, `pricing`, `location`, `operational`
- **Enums**: 
  - `fuelType`: gasoline, diesel, electric, hybrid, plug-in hybrid, flex fuel, natural gas, hydrogen, other
  - `drivetrain`: fwd, rwd, awd, 4wd, part-time 4wd
  - `transmission.type`: automatic, manual, cvt, dual clutch, automated manual
  - `odometer.unit`: "mi" or "km" (strict validation)
- **Valid ranges/types**:
  - Year: 1900-2100
  - Price: ≥ 0
  - Odometer value: ≥ 0

#### 2. Updated Validation ✅

**Location**: `apps/mcp-server/src/validation/validateUVS.ts`

- Updated to use strict schemas from `@autoagent/shared`
- Maintains backward compatibility with existing code
- Provides detailed error information for logging

#### 3. Provider Mapper Integration ✅

**Location**: `apps/mcp-server/src/ingestion/orchestrator.ts`

- All provider mappers are validated through the orchestrator
- Validation happens after normalization and enrichment
- Invalid records are quarantined before storage
- No invalid data reaches the storage layer

#### 4. Quarantine System ✅

**Location**: `apps/mcp-server/src/ingestion/quarantine.ts`

Comprehensive quarantine system that:
- Logs invalid records with structured logging (provider, vehicleId, errors)
- Tracks metrics (counts by provider, error type, error code)
- Provides quarantine functions for:
  - Validation failures
  - Normalization failures
  - Processing failures
- Logs metrics summary at end of ingestion batches

#### 5. Storage Safety Checks ✅

**Location**: `apps/mcp-server/src/ingestion/storage.ts`

- Added final validation check before storage (safety measure)
- Only validated records are persisted to database
- Invalid records are quarantined even if they somehow reach storage
- No "best effort" writes - strict validation only

#### 6. Comprehensive Tests ✅

**Location**: `apps/mcp-server/test/strict-uvs-validation.test.ts`

Tests cover:
- **Positive tests**: Valid payloads with all required blocks and enums
- **Negative tests**: 
  - Missing required blocks
  - Invalid enum values
  - Invalid ranges (year, price, odometer)
  - Invalid types/format
- **Edge cases**: Null, undefined, zero values

**Test Documentation**: `apps/mcp-server/test/STRICT_VALIDATION_README.md`

### Running Tests

```bash
# Run strict validation tests
pnpm --filter mcp-server test strict-uvs-validation

# Run all tests
pnpm --filter mcp-server test
```

---

## Test Execution Logs

### Conversation Summary

**Date**: 2025-11-12  
**Purpose**: Document ChatGPT app integration testing workflow and resolve timeout issues  
**Status**: ✅ Testing workflow documented, ⚠️ Timeout issue identified (solution recommended)

#### Key Accomplishments

1. **ChatGPT Smoke Test Documentation ✅**
   - Created comprehensive smoke test guide
   - Created handshake validation script
   - Created quick start guide
   - Updated main documentation with references to smoke test

2. **Smoke Test Execution ✅**
   - Verified prerequisites (MCP server build, Rock Hill inventory)
   - Started MCP server on port 8787
   - Set up ngrok tunnel for HTTPS exposure
   - Ran handshake validation script (all checks passed)
   - Provided ChatGPT connector URL and instructions

3. **Timeout Investigation ✅**
   - Identified root cause: **ngrok free tier 60-second timeout**
   - Confirmed MCP server is healthy and fast (1-3ms initialize, 228ms search)
   - Created diagnosis reports

4. **Solution Recommendations ✅**
   - Primary solution: Upgrade ngrok plan (removes 60-second timeout)
   - Alternative: Deploy to production server (eliminates tunnel)
   - Verified tools are optimized (enrichment disabled, async delivery)

### Current Status

#### MCP Server Status ✅
- **Running**: Port 8787
- **Performance**: Excellent (1-3ms initialize, 228ms search)
- **Health**: All endpoints responding correctly
- **Configuration**: `WIDGET_HOST` set to ngrok URL
- **Logs**: `/tmp/mcp-server.log`

#### ngrok Tunnel Status ✅
- **Running**: Forwarding `https://autoagentmcp-server-production.up.railway.app` → `http://localhost:8787`
- **Web Interface**: `http://127.0.0.1:4040`
- **Limitation**: Free tier has 60-second timeout

#### ChatGPT Connector Status ⚠️
- **Endpoint**: `https://autoagentmcp-server-production.up.railway.app/mcp`
- **Handshake**: ✅ All checks pass
- **Issue**: Timeout occurs during ChatGPT requests (likely due to ngrok free tier limit)

#### Tool Status ✅
- **search-vehicles**: Fast (228ms), enrichment disabled
- **submit-lead**: Fast (async delivery, fire-and-forget)
- **Widget**: CSP headers configured correctly for ChatGPT embedding

---

## Troubleshooting Guide

### Timeout Issues

**Symptom**: ChatGPT requests timeout

**Cause**: ngrok free tier 60-second timeout

**Solution**: 
- Upgrade ngrok plan (recommended)
- Or deploy to production server

**Verification**:
- Run handshake test script
- Check MCP server logs for slow requests
- Monitor ngrok web interface for timeout errors

### Handshake Failures

**Symptom**: ChatGPT connector fails to connect

**Checklist**:
- [ ] MCP server is running on port 8787
- [ ] ngrok tunnel is active
- [ ] `WIDGET_HOST` matches ngrok URL
- [ ] Run handshake test: `bash scripts/testChatGPTHandshake.sh https://YOUR_URL`

**Common Issues**:
- MCP server not running
- ngrok tunnel expired
- Environment variables not set correctly
- Port conflicts

### Widget Not Loading

**Symptom**: Widget iframe fails inside ChatGPT

**Checklist**:
- [ ] CSP headers allow ChatGPT domains (`frame-ancestors https://chat.openai.com https://chatgpt.com`)
- [ ] `WIDGET_HOST` is set correctly
- [ ] Widget endpoint is accessible via HTTPS
- [ ] Test widget directly: `https://your-url/widget/vehicle-results?diag=1`

**Common Issues**:
- CSP headers missing or incorrect
- Widget URL incorrect
- HTTPS certificate issues
- CORS configuration

### Tools Not Appearing

**Symptom**: Tools don't appear in ChatGPT interface

**Checklist**:
- [ ] MCP server logs show `tools/list` response
- [ ] Tool schemas are valid JSON
- [ ] Test tools manually via curl (see examples in API documentation)
- [ ] Verify `initialize` response includes `initialized: true`

**Common Issues**:
- Invalid tool schemas
- MCP protocol compliance issues
- Server errors in tool handlers

### Lead Submission Errors

**Symptom**: Lead submission fails

**Checklist**:
- [ ] `LEAD_ENC_KEY` is 32-byte base64
- [ ] Consent flag is `true`
- [ ] VIN format is valid (11-17 alphanumeric, excludes I, O, Q)
- [ ] Required fields are present (name, email)
- [ ] Check MCP server logs for error details

**Common Issues**:
- Missing or invalid encryption key
- Consent not provided
- Invalid VIN format
- Missing required fields

### Server Changes Not Applying

**Symptom**: Code changes not reflected in running server

**Solution**:
```bash
# Kill stray dev servers
pkill -f "tsx src/index.ts"

# Restart MCP server
pnpm --filter mcp-server dev
```

**Common Issues**:
- Orphaned processes
- Hot reload not working
- Build cache issues

---

## Important Notes

1. **ngrok URL Changes**: ngrok free tier URLs change on restart. Update `WIDGET_HOST` and ChatGPT connector when URL changes.

2. **Enrichment Disabled**: MarketCheck enrichment is disabled to avoid slow requests (would add 60+ seconds for 20 listings).

3. **Async Delivery**: Lead delivery is fire-and-forget (async) to avoid blocking the response.

4. **Supabase Queries**: Using service role key to avoid RLS delays.

5. **Rock Hill GMC Inventory**: Test data is in Supabase `inventory_vehicles` table with `dealer_name = 'Rock Hill GMC'`.

---

**Related Documentation**:
- Core Documentation: `docs/01-CORE-DOCUMENTATION.md`
- API Reference: `docs/03-API-INTEGRATION.md`
- Deployment Guides: `docs/02-DEPLOYMENT-INFRASTRUCTURE.md`
- MarketCheck Integration: `docs/05-MARKETCHECK-INTEGRATION.md`

