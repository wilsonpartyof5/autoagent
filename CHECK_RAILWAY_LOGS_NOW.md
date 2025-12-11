# Check Railway Logs - Quick Guide

## Direct Access

**Railway Dashboard URL:**
https://railway.app

**Steps:**
1. Login to Railway Dashboard
2. Navigate to your project
3. Click on **MCP Server** service
4. Click **"Logs"** tab

## What to Look For (Around 16:39 UTC)

### Search/Filter for:
- `ingestion_api_error`
- `ingestion_service_failed`
- `/api/ingest/marketcheck`
- `SUPABASE_URL`
- `uvs_vehicles`

### Error Patterns:
```
[event: 'ingestion_api_error']
  provider: 'marketcheck'
  error: '...'
  stack: '...'
```

OR

```
[event: 'ingestion_service_failed']
  error: 'relation "uvs_vehicles" does not exist'
```

## Copy Here:
1. Full error message
2. Stack trace (if present)
3. Timestamp

---

## Alternative: Use Railway CLI (if you have it)

```bash
cd apps/mcp-server
railway login
railway link
railway logs --tail 200 | grep -i "ingest\|error\|500"
```

---

**Please check Railway Dashboard logs and paste the error here!**

