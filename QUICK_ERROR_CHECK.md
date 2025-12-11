# Quick Error Log Check

## What Error Did You See?

Please tell me the **exact error message** you saw in the UI when you clicked "Sync Inventory". This will help us identify the issue immediately.

## Check Logs Now - 3 Options:

### Option 1: Vercel Dashboard (FASTEST - 30 seconds)

1. Go to: https://vercel.com/dustins-projects-2a4636fb/autoagent-dealer-dashboard
2. Click **"Deployments"** tab
3. Click on the **latest deployment** (top of the list, ~8 minutes ago)
4. Click **"Functions"** tab on the left
5. Look for function: `/app/app/setup/actions.ts` 
6. Click it to see recent invocations
7. Look for logs containing: `[fetchAndIngestMarketCheckInventory]`

### Option 2: Tell Me the Error Message

The UI shows the error message directly. Common ones:

- ❌ **"MCP_SERVER_URL or INGESTION_SERVICE_URL must be configured"**
  → Missing env var in Vercel

- ❌ **"Unauthorized" or 401 error**
  → Missing or wrong INGESTION_API_TOKEN

- ❌ **"MCP fetch-and-ingest failed (500)"**
  → MCP server error - check Railway logs

- ❌ **"MarketCheck API key is not configured"**
  → Missing MARKETCHECK_API_KEY in Railway

### Option 3: Quick Test Script

Run this to test the endpoint directly:

```bash
cd /Users/mac/AutoAgent
export MCP_SERVER_URL=https://autoagentmcp-server-production.up.railway.app
export INGESTION_API_TOKEN=<your-token>
./scripts/test-sync-endpoint.sh 11042155 myrockhillgmc.com
```

## Most Likely Issue

Based on the code at line 120-122, the most common error is:

**"MCP_SERVER_URL or INGESTION_SERVICE_URL must be configured"**

This means the environment variable isn't set in Vercel. 

**Fix:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add: `MCP_SERVER_URL` = `https://autoagentmcp-server-production.up.railway.app`
3. Add: `INGESTION_API_TOKEN` = (same value as Railway)
4. Redeploy

---

**What error message did you see?** Paste it here and I'll tell you exactly what's wrong.

