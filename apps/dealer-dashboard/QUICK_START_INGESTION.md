# Quick Start: Ingestion Automation

## 🚀 Quick Setup (5 minutes)

### 1. Set Environment Variables

**Railway (MCP Server):**
```bash
INGESTION_API_TOKEN=<generate-token>
# Generate: openssl rand -base64 32
```

**Vercel (Dealer Dashboard):**
```bash
MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
INGESTION_API_TOKEN=<same-token-as-railway>
```

### 2. Deploy

```bash
git add .
git commit -m "Add automated ingestion flow"
git push
```

Railway and Vercel will auto-deploy.

### 3. Test

**Test Onboarding:**
1. Go to dashboard → Setup
2. Enter dealer ID: `11042155`
3. Click "Sync MarketCheck Inventory"
4. ✅ Should see success message

**Test Nightly Endpoint:**
```bash
node scripts/test-nightly-ingest.js
```

## 📋 What Was Added

- ✅ Server action: `fetchAndIngestMarketCheckInventory()`
- ✅ Nightly endpoint: `POST /api/ingest/nightly`
- ✅ Cron job: Runs daily at 2 AM UTC
- ✅ Onboarding integration: Auto-uses new endpoint

## 🔍 Monitoring

**Check Logs:**
- Vercel: Dashboard → Functions → `/api/ingest/nightly`
- Railway: MCP Server logs

**Success Indicators:**
- `✅ Successfully synced` in logs
- `imported: X` in response
- Vehicles appear in inventory

## 📚 Full Documentation

- `apps/dealer-dashboard/docs/INGESTION_AUTOMATION.md` - Complete guide
- `apps/dealer-dashboard/DEPLOYMENT_CHECKLIST.md` - Deployment steps
- `INGESTION_AUTOMATION_SUMMARY.md` - Implementation summary

